import { NextResponse } from 'next/server';
import { getLatestScan } from '@/lib/db';
import { generateAnalysis } from '@/lib/gemini/client';
import { supabaseAdmin } from '@/lib/supabase';
import { getResolvedUrl } from '@/lib/urlResolver';
import { requireCronSecret } from '@/lib/supabase/auth-helpers';
import sgMail from '@sendgrid/mail';

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

// Default sender (used if agent has no sender_email configured)
const DEFAULT_FROM_EMAIL = "info.opulentusmedia@gmail.com";
const DEFAULT_FROM_NAME = "Opulentus AI";

export async function POST(req: Request) {
    // Gate: Vercel cron header, x-cron-secret header, or ?secret= query param.
    // Fail-closed if CRON_SECRET is unset in the environment.
    const auth = requireCronSecret(req);
    if (auth.error) return auth.error;

    try {
        // 1. Fetch all agents
        const { data: agents, error: agentsErr } = await supabaseAdmin
            .from('agents')
            .select('id, display_name, sender_email, recipient_email');

        if (agentsErr || !agents || agents.length === 0) {
            console.error("Failed to fetch agents:", agentsErr);
            return NextResponse.json({ message: "No agents found." });
        }

        // 2. Fetch the raw properties from the database
        const scan = await getLatestScan();
        const freshListings = scan?.properties || [];

        if (!freshListings || freshListings.length === 0) {
            return NextResponse.json({ message: "No properties found to scan." });
        }

        const analysisBatch = freshListings.slice(0, 50).map(p => ({
            id: p.sourceId,
            platform: p.platform,
            address: p.address,
            price: p.price,
            type: p.propertyType,
            description: p.description
        }));

        // 3. Process each agent separately
        const agentResults: any[] = [];

        for (const agent of agents) {
            // Skip agents without a recipient email
            if (!agent.recipient_email) {
                console.log(`[Daily Blast] Skipping agent ${agent.display_name} — no recipient email`);
                continue;
            }

            // Fetch this agent's clients
            const { data: clients, error: clientsErr } = await supabaseAdmin
                .from('clients')
                .select('*')
                .eq('agent_id', agent.id);

            if (clientsErr || !clients || clients.length === 0) {
                console.log(`[Daily Blast] Skipping agent ${agent.display_name} — no clients`);
                continue;
            }

            // 4. Prompt Gemini to route deals for this agent's clients
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

            // 5. Map results back to full property objects grouped by client
            const cacheToSave: any[] = [];

            const groupedResults = geminiResult.map((clientMatch: any) => {
                const client = clients.find(c => c.id === clientMatch.clientId);
                if (!client || !clientMatch.matchedDeals) return null;

                const deals = clientMatch.matchedDeals.map((match: any) => {
                    const fullProp = freshListings.find(p => p.sourceId === match.propertyId);
                    if (!fullProp) return null;

                    cacheToSave.push({
                        property_id: fullProp.sourceId,
                        client_id: client.id,
                        agent_id: agent.id,
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

            // Cache AI analyses
            if (cacheToSave.length > 0) {
                import('@/lib/db').then(mod => mod.saveAiAnalysesBulk(cacheToSave));
            }

            if (groupedResults.length === 0) {
                console.log(`[Daily Blast] No matches for agent ${agent.display_name}'s clients`);
                continue;
            }

            // 6. Build and send per-agent email
            let totalDeals = 0;
            groupedResults.forEach((g: any) => totalDeals += g.deals.length);

            const fromEmail = agent.sender_email || DEFAULT_FROM_EMAIL;
            const fromName = agent.display_name || DEFAULT_FROM_NAME;

            try {
                await sendGroupedHTMLBlast(
                    agent.recipient_email,
                    fromEmail,
                    fromName,
                    groupedResults,
                    totalDeals
                );
            } catch (sendErr: any) {
                // If agent's sender_email isn't verified in SendGrid, retry with default
                if (fromEmail !== DEFAULT_FROM_EMAIL && sendErr?.code === 403) {
                    console.warn(`[Daily Blast] SendGrid rejected sender ${fromEmail} for agent ${agent.display_name}, retrying with default sender`);
                    await sendGroupedHTMLBlast(
                        agent.recipient_email,
                        DEFAULT_FROM_EMAIL,
                        fromName,
                        groupedResults,
                        totalDeals
                    );
                } else {
                    throw sendErr;
                }
            }

            agentResults.push({
                agentId: agent.id,
                agentName: agent.display_name,
                sentTo: agent.recipient_email,
                clientsMatched: groupedResults.length,
                totalDealsRouted: totalDeals,
            });

            console.log(`[Daily Blast] Sent to ${agent.display_name} (${agent.recipient_email}): ${totalDeals} deals across ${groupedResults.length} clients`);
        }

        return NextResponse.json({
            success: true,
            agentsProcessed: agentResults.length,
            agentResults,
            // Backward-compatible fields
            clientsMatched: agentResults.reduce((sum, a) => sum + a.clientsMatched, 0),
            totalDealsRouted: agentResults.reduce((sum, a) => sum + a.totalDealsRouted, 0),
        });

    } catch (error: any) {
        console.error("Daily Blast Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

async function sendGroupedHTMLBlast(
    targetEmail: string,
    fromEmail: string,
    fromName: string,
    groupedResults: any[],
    totalDeals: number
) {
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://opulentus.vercel.app';

    const sectionsArray = await Promise.all(groupedResults.map(async group => {
        const sortedDeals = [...group.deals].sort((a: any, b: any) => b.aiScore - a.aiScore);
        const topDeals = sortedDeals.slice(0, 3);
        const hiddenCount = sortedDeals.length - topDeals.length;

        const propertyCardsHTMLArray = await Promise.all(topDeals.map(async (p: any) => {
            let heroImage = '';

            const mapKey = process.env.GOOGLE_MAPS_API_KEY;
            const fullAddress = `${p.address || ''}, ${p.city || ''}, ${p.state || 'MI'}`.trim();
            const encodedAddress = encodeURIComponent(fullAddress);

            if (mapKey && p.address && p.address.toLowerCase() !== 'unknown' && p.address.toLowerCase() !== 'off market') {
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

            if (!heroImage && mapKey && p.address && p.address.toLowerCase() !== 'unknown' && p.address.toLowerCase() !== 'off market') {
                const markerFormat = encodeURIComponent(`color:0xD4AF37|${fullAddress}`);
                heroImage = `https://maps.googleapis.com/maps/api/staticmap?center=${encodedAddress}&zoom=18&size=600x300&maptype=hybrid&markers=${markerFormat}&key=${mapKey}`;
            }

            if (!heroImage) {
                const encodedPlaceholder = encodeURIComponent(p.address || 'Property Listing');
                heroImage = `https://placehold.co/600x300/171717/D4AF37/png?text=${encodedPlaceholder}`;
            }

            const platformLabel = p.platform === 'mls' ? 'MLS' :
                p.platform.split('-')[0].charAt(0).toUpperCase() + p.platform.split('-')[0].slice(1);

            const dealRoomUrl = `${APP_URL}/chat?property=${encodeURIComponent(p.sourceId || '')}&buybox=${encodeURIComponent((group.client as any)?.id || group.client?.name || '')}`;

            return `
            <div style="background-color: #171717; border: 1px solid #242424; border-radius: 8px; margin-bottom: 20px; overflow: hidden;">
                <div style="width: 100%; max-height: 220px; overflow: hidden; background-color: #0A0A0A;">
                    <img src="${heroImage}" alt="${p.address || 'Property'}" style="width: 100%; height: 220px; object-fit: cover; display: block;" />
                </div>
                <div style="padding: 20px;">
                    <div style="margin-bottom: 12px;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                            <td style="color: #FAFAFA; font-size: 18px; font-family: sans-serif; font-weight: bold;">${p.address}</td>
                            <td align="right" style="vertical-align: top;">
                                <span style="background-color: #242424; color: #A3A3A3; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-family: monospace; text-transform: uppercase; white-space: nowrap;">${p.platform}</span>
                            </td>
                        </tr></table>
                    </div>
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
                    <div style="background-color: rgba(212, 175, 55, 0.1); border-left: 3px solid #D4AF37; padding: 12px; margin-bottom: 16px;">
                        <p style="color: #FAFAFA; margin: 0; font-size: 14px; font-family: sans-serif; line-height: 1.5;">
                            <strong style="color: #D4AF37;">Opulentus AI Insight:</strong> ${p.aiReason}
                        </p>
                    </div>
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

        const hiddenHTML = hiddenCount > 0 ? `
            <div style="text-align: center; margin-bottom: 30px; padding: 10px;">
                <a href="${APP_URL}" style="display: inline-block; padding: 12px 24px; border: 1px solid #333; border-radius: 4px; color: #A3A3A3; text-decoration: none; font-family: sans-serif; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">
                    View ${hiddenCount} more matching deals in App
                </a>
            </div>
        ` : '';

        return `
            <div style="margin-top: 40px;">
                <h2 style="color: #FAFAFA; border-bottom: 1px solid #333; padding-bottom: 10px; font-family: sans-serif;">Client: ${group.client.name}</h2>
                <p style="color: #A3A3A3; font-family: sans-serif; margin-bottom: 20px;">AI identified <strong style="color: #D4AF37;">${group.deals.length}</strong> total deal(s) matching their strict mandate.</p>
                ${propertyCardsHTML}
                ${hiddenHTML}
            </div>
        `;
    }));

    const clientSectionsHTML = sectionsArray.join("");

    const htmlBodyRaw = `
    <html>
        <body style="background-color: #0A0A0A; padding: 40px; margin: 0;">
            <div style="max-width: 600px; margin: 0 auto; font-family: sans-serif;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #FAFAFA; font-size: 24px; letter-spacing: -0.5px; margin: 0;">Opulentus Master Router</h1>
                    <p style="color: #A3A3A3; font-size: 14px; margin-top: 8px;">Your Daily Curated Deal Flow across your entire portfolio</p>
                </div>
                ${clientSectionsHTML}
                <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #242424;">
                    <p style="color: #7C7C7C; font-size: 12px;">Opulentus AI Intelligence. All rights reserved.</p>
                </div>
            </div>
        </body>
    </html>
    `;

    const minifiedHtml = htmlBodyRaw.replace(/>\s+</g, '><').replace(/\r?\n|\r/g, '').trim();

    const plainText = groupedResults.map(group => {
        const clientHeader = `=== Client: ${group.client.name} ===`;
        const top3DealsForText = [...group.deals].sort((a: any, b: any) => b.aiScore - a.aiScore).slice(0, 3);
        const dealsText = top3DealsForText.map((p: any) =>
            `${p.address} | ${p.price ? '$' + p.price.toLocaleString() : 'Unpriced'} | ${p.propertyType || 'Commercial'} | AI Score: ${p.aiScore}/100\nInsight: ${p.aiReason}\nLink: ${p.propertyUrl || '#'}`
        ).join('\n\n');
        return `${clientHeader}\n${dealsText}`;
    }).join('\n\n\n');

    const msg = {
        to: targetEmail,
        from: { email: fromEmail, name: fromName },
        subject: `Opulentus AI | ${totalDeals} Deals Routed across ${groupedResults.length} Clients`,
        text: `Opulentus Client Deal Router\n\n${plainText}\n\n---\nOpulentus AI. All rights reserved.`,
        html: minifiedHtml,
    };

    const response = await sgMail.send(msg);
    console.log(`[Daily Blast] Email sent to ${targetEmail}! Status: ${response[0].statusCode}`);
}
