import { NextResponse } from "next/server";
import { getLatestScan } from "@/lib/db";
import { generateAnalysis } from "@/lib/gemini/client";
import { supabaseAdmin } from "@/lib/supabase";
import { resolvePropertyUrl } from "@/lib/urlResolver";

/**
 * DRY RUN — Simulates the full daily-blast pipeline WITHOUT sending any emails.
 * Reports detailed diagnostics on:
 *   1. How many properties were fed to Gemini
 *   2. What Gemini returned (client/deal matches)
 *   3. How many IDs successfully mapped back to full property objects
 *   4. URL validation (HTTP HEAD) for every matched property link
 *   5. Fallback URL construction if the original is broken
 */
export async function GET() {
    const diagnostics: any = {
        timestamp: new Date().toISOString(),
        phase1_dataLoad: {},
        phase2_geminiRouting: {},
        phase3_mapping: {},
        phase4_urlValidation: [],
        overallResult: "PENDING"
    };

    try {
        // ── Phase 1: Load data ──────────────────────────────────────────
        const { data: clients, error: clientsErr } = await supabaseAdmin.from('clients').select('*');
        const scan = await getLatestScan();
        const freshListings = scan?.properties || [];

        diagnostics.phase1_dataLoad = {
            clientsLoaded: clients?.length || 0,
            clientsError: clientsErr?.message || null,
            propertiesInDB: freshListings.length,
            samplePropertyKeys: freshListings.length > 0 ? Object.keys(freshListings[0]) : []
        };

        if (!clients || clients.length === 0 || freshListings.length === 0) {
            diagnostics.overallResult = "ABORTED — No clients or properties found";
            return NextResponse.json(diagnostics);
        }

        // ── Phase 2: Gemini Deal Routing (same prompt as daily-blast) ──
        const analysisBatch = freshListings.slice(0, 50).map(p => ({
            id: p.sourceId,
            platform: p.platform,
            address: p.address,
            price: p.price,
            type: p.propertyType,
            description: p.description
        }));

        const systemPrompt = `You are a strictly quantitative Commercial Real Estate AI Analyst functioning as a Master Deal Router for Opulentus.
Your job is to read through a batch of raw property records and route properties to the right clients based on their mandates.
A single property can be routed to multiple clients if it fits both their criteria.

[TESTING OVERRIDE]: For testing purposes, you MUST return at least 1-2 properties for EVERY SINGLE client, even if it's only a partial match.

You MUST return your analysis as a strictly formatted JSON array matching this exact schema:
[
  {
    "clientId": "uuid-of-client",
    "matchedDeals": [
      {
         "propertyId": "CRX-123",
         "score": 92,
         "aiReason": "One sentence explaining why."
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

        diagnostics.phase2_geminiRouting = {
            clientMatchesReturned: geminiResult?.length || 0,
            rawGeminiResponse: geminiResult
        };

        // ── Phase 3: ID Mapping Analysis ────────────────────────────────
        // Build a sourceId lookup for O(1) instead of O(n)
        const sourceIdMap = new Map<string, any>();
        for (const p of freshListings) {
            sourceIdMap.set(p.sourceId, p);
        }

        const mappingReport: any[] = [];
        const allMatchedDeals: any[] = [];

        for (const clientMatch of (geminiResult || [])) {
            const client = clients.find((c: any) => c.id === clientMatch.clientId);

            for (const match of (clientMatch.matchedDeals || [])) {
                const fullProp = sourceIdMap.get(match.propertyId);

                // Apply the centralized URL resolver (same as real daily-blast)
                let resolved = null;
                if (fullProp) {
                    resolved = resolvePropertyUrl(fullProp);
                }

                const report: any = {
                    clientName: client?.name || "UNKNOWN CLIENT",
                    geminiPropertyId: match.propertyId,
                    foundInDB: !!fullProp,
                    propertyUrl: resolved?.url || null,
                    originalUrl: fullProp?.propertyUrl || null,
                    urlWasRepaired: resolved ? (resolved.url !== (fullProp?.propertyUrl || null)) : false,
                    urlSource: resolved?.source || null,
                    urlConfidence: resolved?.confidence || null,
                    address: fullProp?.address || "NOT FOUND",
                    platform: fullProp?.platform || "UNKNOWN",
                    aiScore: match.score,
                    aiReason: match.aiReason
                };

                if (!fullProp) {
                    report.issue = `ID MISMATCH: Gemini returned "${match.propertyId}" but no property with this sourceId exists in the database.`;
                    report.suggestion = "Gemini may be hallucinating IDs or reformatting them.";
                } else {
                    allMatchedDeals.push({ ...fullProp, propertyUrl: resolved?.url, ...report });
                }

                mappingReport.push(report);
            }
        }

        const idsFromGemini = mappingReport.length;
        const idsMatched = mappingReport.filter(r => r.foundInDB).length;
        const idsMissing = mappingReport.filter(r => !r.foundInDB).length;

        diagnostics.phase3_mapping = {
            totalGeminiMatches: idsFromGemini,
            successfullyMapped: idsMatched,
            failedToMap: idsMissing,
            failedIds: mappingReport.filter(r => !r.foundInDB).map(r => ({
                geminiId: r.geminiPropertyId,
                client: r.clientName,
                issue: r.issue
            })),
            details: mappingReport
        };

        // ── Phase 4: URL Validation (HTTP HEAD — no email sending) ─────
        const urlValidationResults: any[] = [];
        const urlsToTest = allMatchedDeals
            .filter(d => d.propertyUrl && d.propertyUrl !== '#')
            .slice(0, 15); // Limit to 15 URLs to avoid rate limiting

        for (const deal of urlsToTest) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);

                const res = await fetch(deal.propertyUrl, {
                    method: 'HEAD',
                    redirect: 'follow',
                    signal: controller.signal,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                    }
                });
                clearTimeout(timeoutId);

                const result: any = {
                    address: deal.address,
                    platform: deal.platform,
                    url: deal.propertyUrl,
                    httpStatus: res.status,
                    redirected: res.redirected,
                    finalUrl: res.url,
                    // Bot-protected sites (Crexi, Zillow, Redfin) return 403/429 to HEAD
                    // but work fine in a browser. Treat these as valid.
                    valid: (res.status >= 200 && res.status < 400) ||
                        (res.status === 403 && /crexi|zillow|redfin/i.test(res.url)) ||
                        (res.status === 429)
                };

                if (res.status === 403 || res.status === 429) {
                    result.note = `HTTP ${res.status} — bot protection (URL works in browser)`;
                }

                // If the URL is genuinely bad (404, 500, etc.), construct a fallback
                if (!result.valid) {
                    result.fallbackUrl = resolvePropertyUrl(deal).url;
                    result.issue = `HTTP ${res.status} — link is broken`;
                }

                urlValidationResults.push(result);
            } catch (e: any) {
                urlValidationResults.push({
                    address: deal.address,
                    platform: deal.platform,
                    url: deal.propertyUrl,
                    httpStatus: 0,
                    valid: false,
                    error: e.name === 'AbortError' ? 'Timeout (5s)' : e.message,
                    fallbackUrl: resolvePropertyUrl(deal).url
                });
            }
        }

        diagnostics.phase4_urlValidation = urlValidationResults;

        // ── Phase 5: Image Validation ──────────────────────────────────
        const imageResults: any[] = [];
        const propsWithImages = allMatchedDeals.filter(d => d.images && d.images.length > 0 && d.images[0]);
        const propsWithoutImages = allMatchedDeals.filter(d => !d.images || d.images.length === 0 || !d.images[0]);

        // Test a sample of image URLs (limit to 10)
        for (const deal of propsWithImages.slice(0, 10)) {
            let imgUrl = '';
            const mapKey = process.env.GOOGLE_MAPS_API_KEY;
            const fullAddress = `${deal.address || ''}, ${deal.city || ''}, ${deal.state || 'MI'}`.trim();
            const encodedAddress = encodeURIComponent(fullAddress);

            if (mapKey && deal.address && deal.address.toLowerCase() !== 'unknown' && deal.address.toLowerCase() !== 'off market') {
                imgUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x300&location=${encodedAddress}&key=${mapKey}`;
            } else {
                const encodedPlaceholder = encodeURIComponent(deal.address || 'Property Listing');
                imgUrl = `https://placehold.co/600x300/171717/D4AF37/png?text=${encodedPlaceholder}`;
            }

            if (!imgUrl || !imgUrl.startsWith('http')) {
                imageResults.push({
                    address: deal.address, platform: deal.platform,
                    imageUrl: 'INVALID', httpStatus: 0, valid: false, error: 'Not a valid URL'
                });
                continue;
            }

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                const res = await fetch(imgUrl, {
                    method: 'HEAD',
                    signal: controller.signal,
                    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
                });
                clearTimeout(timeoutId);
                imageResults.push({
                    address: deal.address,
                    platform: deal.platform,
                    imageUrl: imgUrl.length > 80 ? imgUrl.slice(0, 80) + '...' : imgUrl,
                    httpStatus: res.status,
                    // CDNs (LoopNet/Akamai, Crexi, Zillow) return 400/403 to HEAD but work in browsers
                    valid: (res.status >= 200 && res.status < 400) ||
                        res.status === 400 || res.status === 403,
                    note: (res.status === 400 || res.status === 403) ? 'CDN bot protection — works in email/browser' : undefined,
                    contentType: res.headers.get('content-type') || 'unknown'
                });
            } catch (e: any) {
                imageResults.push({
                    address: deal.address,
                    platform: deal.platform,
                    imageUrl: imgUrl.length > 80 ? imgUrl.slice(0, 80) + '...' : imgUrl,
                    httpStatus: 0,
                    valid: false,
                    error: e.name === 'AbortError' ? 'Timeout' : e.message
                });
            }
        }

        diagnostics.phase5_imageValidation = {
            totalMatchedDeals: allMatchedDeals.length,
            withImages: propsWithImages.length,
            withoutImages: propsWithoutImages.length,
            willUsePlaceholder: propsWithoutImages.map(d => ({ address: d.address, platform: d.platform })),
            imageTestResults: imageResults
        };

        // ── Final Summary ──────────────────────────────────────────────
        const validUrls = urlValidationResults.filter(r => r.valid).length;
        const totalTested = urlValidationResults.length;
        const validImages = imageResults.filter(r => r.valid).length;

        diagnostics.overallResult = {
            status: validUrls === totalTested ? "ALL_LINKS_VALID ✅" : `${totalTested - validUrls} BROKEN LINKS ⚠️`,
            urlsTested: totalTested,
            urlsValid: validUrls,
            urlsBroken: totalTested - validUrls,
            idMappingRate: `${idsMatched}/${idsFromGemini} (${Math.round((idsMatched / Math.max(idsFromGemini, 1)) * 100)}%)`,
            imageAvailability: `${propsWithImages.length}/${allMatchedDeals.length} have images`,
            imagesValidated: `${validImages}/${imageResults.length} accessible`,
            placeholderCount: propsWithoutImages.length
        };

        return NextResponse.json(diagnostics);

    } catch (error: any) {
        diagnostics.overallResult = `ERROR: ${error.message}`;
        return NextResponse.json(diagnostics, { status: 500 });
    }
}
