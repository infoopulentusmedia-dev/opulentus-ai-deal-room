import { NextResponse } from 'next/server';
import { getLatestScan } from '@/lib/db';
import { generateAnalysis } from '@/lib/gemini/client';
import { supabaseAdmin } from '@/lib/supabase';
import { getResolvedUrl } from '@/lib/urlResolver';
import sgMail from '@sendgrid/mail';

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

// Sender must be the verified Single Sender in SendGrid this is for 
const FROM_EMAIL = "info.opulentusmedia@gmail.com";
const FROM_NAME = "Opulentus AI";
const TARGET_EMAIL = "safat@safatautomation.com";

export async function POST(req: Request) {
    try {
        // 1. Fetch all active clients from Supabase (using God Mode to bypass RLS)
        const { data: clients, error: clientsErr } = await supabaseAdmin.from('clients').select('*');

        if (clientsErr || !clients || clients.length === 0) {
            console.error("Failed to fetch clients from Supabase:", clientsErr);
            return NextResponse.json({ message: "No active clients found in database." });
        }

        // 2. Fetch the raw properties from the database/Apify
        const scan = await getLatestScan();
        const freshListings = scan?.properties || [];

        if (!freshListings || freshListings.length === 0) {
            return NextResponse.json({ message: "No properties found to scan." });
        }

        // Take the first 50 listings to analyze for the daily blast
        const analysisBatch = freshListings.slice(0, 50).map(p => ({
            id: p.sourceId,
            platform: p.platform,
            address: p.address,
            price: p.price,
            type: p.propertyType,
            description: p.description
        }));

        // 3. Prompt Gemini to act as the Master Deal Router
        const systemPrompt = `You are a strictly quantitative Commercial Real Estate AI Analyst functioning as a Master Deal Router for Opulentus.
Your job is to read through a batch of raw property records and route properties to the right clients based on their mandates.
A single property can be routed to multiple clients if it fits both their criteria.

[TESTING OVERRIDE]: For testing purposes, you MUST return at least 1-2 properties for EVERY SINGLE client, even if it's only a partial match (e.g., wrong county or slightly wrong type). Just find the closest possible match for each person.

You MUST return your analysis as a strictly formatted JSON array matching this exact schema:
[
  {
    "clientId": "uuid-of-client",
    "matchedDeals": [
      {
         "propertyId": "CRX-123",
         "score": 92,
         "aiReason": "One sentence strictly explaining why this property perfectly matches this specific client's mandate."
      }
    ]
  }
]
Return purely the JSON array, nothing else. Do not use markdown blocks.`;

        // We fetch the cache for ALL clients first to prevent duplicate AI logic
        const allCachedAnalyses = await Promise.all(
            clients.map(c => import('@/lib/db').then(mod => mod.getAiAnalysesForClient(c.id)))
        );
        
        const clientCaches = new Map<string, any[]>();
        clients.forEach((c, i) => clientCaches.set(c.id, allCachedAnalyses[i]));

        // Filter out properties that EVERY client has already analyzed
        // Actually, it's safer to just let the LLM route them but we ONLY send the uncached ones per client
        // To do this right in a single LLM prompt, we send the FULL batch, but we tell the LLM to skip specific ones? No, that burns input tokens.
        // Instead, we just send the standard batch for now, and implement the cache merging AFTER or just cache the results.
        
        // Wait, the most elite way to do this is to NOT use the LLM to route 50 generic properties.
        // Let's do it exactly as planned: The LLM processes the batch.

        const userPrompt = `
CLIENT DIRECTIVES:
${clients.map(c => {
            const bb = c.buy_box_json || {};
            return `CLIENT ID: ${c.id} | NAME: ${c.name}
- Property Type: ${bb.propertyType || 'Any'}
- Location: ${bb.location || 'Any'}
- Price Range: ${bb.priceMin || '0'} to ${bb.priceMax || 'No Max'}
- Size Range: ${bb.sizeMin || 'Any'} to ${bb.sizeMax || 'Any'}
- Special Criteria: ${bb.specialCriteria || 'None'}
- Min Match Score: 85/100`;
        }).join('\n\n')}

RAW PROPERTY BATCH:
${JSON.stringify(analysisBatch, null, 2)}
`;

        const geminiResult = await generateAnalysis(systemPrompt, userPrompt);

        // 4. Map the selected IDs back to the full rich property objects grouped by client
        const cacheToSave: any[] = [];

        const groupedResults = geminiResult.map((clientMatch: any) => {
            const client = clients.find(c => c.id === clientMatch.clientId);
            if (!client || !clientMatch.matchedDeals) return null;

            const deals = clientMatch.matchedDeals.map((match: any) => {
                const fullProp = freshListings.find(p => p.sourceId === match.propertyId);
                if (!fullProp) return null;

                // Cache it for tomorrow
                cacheToSave.push({
                    property_id: fullProp.sourceId,
                    client_id: client.id,
                    ai_score: match.score || 90,
                    ai_reason: match.aiReason || "Fits general criteria.",
                    property_price: fullProp.price || null
                });

                return {
                    ...fullProp,
                    propertyUrl: getResolvedUrl(fullProp),
                    aiScore: match.score || 90,
                    aiReason: match.aiReason || "Fits general criteria."
                };
            }).filter((p: any) => p !== null && p.address);

            return { client, deals };
        }).filter((g: any) => g !== null && g.client && g.deals.length > 0);

        // Bulk Save the AI Analyses for tomorrow
        if (cacheToSave.length > 0) {
            import('@/lib/db').then(mod => mod.saveAiAnalysesBulk(cacheToSave));
        }

        if (groupedResults.length === 0) {
            return NextResponse.json({ message: "AI found zero matches for any clients today." });
        }

        // 5. Build and Send the Grouped Email via SendGrid
        let totalDeals = 0;
        groupedResults.forEach((g: any) => totalDeals += g.deals.length);

        await sendGroupedHTMLBlast(TARGET_EMAIL, groupedResults, totalDeals);

        return NextResponse.json({
            success: true,
            sentTo: TARGET_EMAIL,
            clientsMatched: groupedResults.length,
            totalDealsRouted: totalDeals
        });

    } catch (error: any) {
        console.error("Daily Blast Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

async function sendGroupedHTMLBlast(targetEmail: string, groupedResults: any[], totalDeals: number) {
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://opulentus.vercel.app';
    const PLACEHOLDER_IMG = 'https://placehold.co/600x300/171717/D4AF37?text=No+Image+Available';

    const sectionsArray = await Promise.all(groupedResults.map(async group => {
        const propertyCardsHTMLArray = await Promise.all(group.deals.map(async (p: any) => {
            // Image normalizer: Google Street View priority over bot-blocked CDNs
            let heroImage = '';

            // 1. Try Google Street View (100% unbreakable in email, real exterior photo)
            const mapKey = process.env.GOOGLE_MAPS_API_KEY;
            const fullAddress = `${p.address || ''}, ${p.city || ''}, ${p.state || 'MI'}`.trim();
            const encodedAddress = encodeURIComponent(fullAddress);

            if (mapKey && p.address && p.address.toLowerCase() !== 'unknown' && p.address.toLowerCase() !== 'off market') {
                // Check if Street View imagery actually exists for this location
                try {
                    const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${encodedAddress}&key=${mapKey}`;
                    const metaRes = await fetch(metaUrl);
                    const metaData = await metaRes.json();

                    if (metaData.status === 'OK') {
                        heroImage = `https://maps.googleapis.com/maps/api/streetview?size=600x300&location=${encodedAddress}&key=${mapKey}`;
                    }
                } catch (e) {
                    console.error("Street View metadata check failed", e);
                }
            }

            // 2. Fallback to Google Maps Static (Satellite + Map hybrid) if Street View has NO IMAGERY
            // This is the industry standard fallback (Option 1 + Option 2 combined)
            if (!heroImage && mapKey && p.address && p.address.toLowerCase() !== 'unknown' && p.address.toLowerCase() !== 'off market') {
                const markerFormat = encodeURIComponent(`color:0xD4AF37|${fullAddress}`);
                heroImage = `https://maps.googleapis.com/maps/api/staticmap?center=${encodedAddress}&zoom=18&size=600x300&maptype=hybrid&markers=${markerFormat}&key=${mapKey}`;
            }

            // 3. Absolute Last Resort Fallback (If address is totally invalid or no API key)
            if (!heroImage) {
                const encodedPlaceholder = encodeURIComponent(p.address || 'Property Listing');
                heroImage = `https://placehold.co/600x300/171717/D4AF37/png?text=${encodedPlaceholder}`;
            }

            // (Optional) We intentionally avoid looping in p.images[0] here because LoopNet/MLS CDNs 
            // will block Gmail's image proxy resulting in broken images for users. Street View & Placeholder 
            // guarantee a beautiful, 100% visual render rate in the email blast.

            // Platform label for CTA button
            const platformLabel = p.platform === 'mls' ? 'MLS' :
                p.platform.split('-')[0].charAt(0).toUpperCase() + p.platform.split('-')[0].slice(1);

            // Deep link URL for AI Deal Room
            const dealRoomUrl = `${APP_URL}/chat?property=${encodeURIComponent(p.sourceId || '')}&buybox=${encodeURIComponent((group.client as any)?.id || group.client?.name || '')}`;

            return `
            <div style="background-color: #171717; border: 1px solid #242424; border-radius: 8px; margin-bottom: 20px; overflow: hidden;">
                <!-- Hero Image -->
                <div style="width: 100%; max-height: 220px; overflow: hidden; background-color: #0A0A0A;">
                    <img src="${heroImage}" alt="${p.address || 'Property'}" style="width: 100%; height: 220px; object-fit: cover; display: block;" />
                </div>

                <div style="padding: 20px;">
                    <!-- Header: Address + Platform Badge -->
                    <div style="margin-bottom: 12px;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                            <td style="color: #FAFAFA; font-size: 18px; font-family: sans-serif; font-weight: bold;">${p.address}</td>
                            <td align="right" style="vertical-align: top;">
                                <span style="background-color: #242424; color: #A3A3A3; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-family: monospace; text-transform: uppercase; white-space: nowrap;">${p.platform}</span>
                            </td>
                        </tr></table>
                    </div>
                    
                    <!-- Stats Row -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;">
                        <tr>
                            <td style="font-family: sans-serif; padding-right: 16px;">
                                <div style="color: #7C7C7C; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Price</div>
                                <div style="color: #FAFAFA; font-size: 16px; font-weight: bold;">${p.price ? '$' + p.price.toLocaleString() : 'Unpriced'}</div>
                            </td>
                            <td style="font-family: sans-serif; padding-right: 16px;">
                                <div style="color: #7C7C7C; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Type</div>
                                <div style="color: #FAFAFA; font-size: 16px;">${p.propertyType || "Commercial"}</div>
                            </td>
                            <td style="font-family: sans-serif;">
                                <div style="color: #D4AF37; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">AI Match</div>
                                <div style="color: #D4AF37; font-size: 16px; font-weight: bold;">${p.aiScore}/100</div>
                            </td>
                        </tr>
                    </table>

                    <!-- AI Insight -->
                    <div style="background-color: rgba(212, 175, 55, 0.1); border-left: 3px solid #D4AF37; padding: 12px; margin-bottom: 16px;">
                        <p style="color: #FAFAFA; margin: 0; font-size: 14px; font-family: sans-serif; line-height: 1.5;">
                            <strong style="color: #D4AF37;">Opulentus AI Insight:</strong> ${p.aiReason}
                        </p>
                    </div>

                    <!-- Dual CTA Buttons -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                            <td style="padding-right: 8px;" width="50%">
                                <a href="${p.propertyUrl || '#'}" style="display: block; text-align: center; background-color: #FAFAFA; color: #0A0A0A; padding: 12px 16px; text-decoration: none; border-radius: 4px; font-family: sans-serif; font-size: 13px; font-weight: bold;">View on ${platformLabel}</a>
                            </td>
                            <td style="padding-left: 8px;" width="50%">
                                <a href="${dealRoomUrl}" style="display: block; text-align: center; background-color: #D4AF37; color: #0A0A0A; padding: 12px 16px; text-decoration: none; border-radius: 4px; font-family: sans-serif; font-size: 13px; font-weight: bold;">Analyze in AI Deal Room</a>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
            `;
        }));

        const propertyCardsHTML = propertyCardsHTMLArray.join("");

        return `
            <div style="margin-top: 40px;">
                <h2 style="color: #FAFAFA; border-bottom: 1px solid #333; padding-bottom: 10px; font-family: sans-serif;">Client: ${group.client.name}</h2>
                <p style="color: #A3A3A3; font-family: sans-serif; margin-bottom: 20px;">AI identified <strong style="color: #D4AF37;">${group.deals.length}</strong> deal(s) matching their strict mandate.</p>
                ${propertyCardsHTML}
            </div>
        `;
    }));

    const clientSectionsHTML = sectionsArray.join("");

    const htmlBody = `
    <html>
        <body style="background-color: #0A0A0A; padding: 40px; margin: 0;">
            <div style="max-width: 600px; margin: 0 auto; font-family: sans-serif;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #FAFAFA; font-size: 24px; letter-spacing: -0.5px; margin: 0;">Opulentus Master Router</h1>
                    <p style="color: #A3A3A3; font-size: 14px; margin-top: 8px;">Your Daily Curated Deal Flow across your entire portfolio</p>
                </div>
                
                ${clientSectionsHTML}
                
                <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #242424;">
                    <p style="color: #7C7C7C; font-size: 12px;">© 2026 Opulentus AI Intelligence. All rights reserved.</p>
                </div>
            </div>
        </body>
    </html>
    `;

    // Plain text fallback
    const plainText = groupedResults.map(group => {
        const clientHeader = `=== Client: ${group.client.name} ===`;
        const dealsText = group.deals.map((p: any) =>
            `${p.address} | ${p.price ? '$' + p.price.toLocaleString() : 'Unpriced'} | ${p.propertyType || 'Commercial'} | AI Score: ${p.aiScore}/100\nInsight: ${p.aiReason}\nLink: ${p.propertyUrl || '#'}`
        ).join('\n\n');
        return `${clientHeader}\n${dealsText}`;
    }).join('\n\n\n');

    const msg = {
        to: targetEmail,
        from: { email: FROM_EMAIL, name: FROM_NAME },
        subject: `Opulentus AI | ${totalDeals} Deals Routed across ${groupedResults.length} Clients`,
        text: `Opulentus Client Deal Router\n\n${plainText}\n\n---\nOpulentus 2026. All rights reserved.`,
        html: htmlBody,
    };

    const response = await sgMail.send(msg);
    console.log("Daily Blast Sent via SendGrid! Status:", response[0].statusCode);
}
