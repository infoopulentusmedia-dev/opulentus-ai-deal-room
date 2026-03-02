import { NextResponse } from "next/server";
import { generateAnalysis } from "@/lib/gemini/client";
import { getLiveApifyFeed } from "@/lib/apify/fetcher";

import { checkTaxIncentives } from "@/app/api/tax-incentive-check/route";
import { BuyBoxCriteria } from "@/lib/buybox";

const MORNING_BRIEF_SYSTEM = `You are an elite Commercial Real Estate Acquisitions Director for Opulentus Private Wealth.
You are analyzing a merged feed of properties from THREE data sources:
1. Crexi (commercial listings)
2. LoopNet (commercial listings)
A client's "Buy Box" criteria will be provided. Your job is to:

1. Filter and rank the merged feed against the client's Buy Box.
2. For matching properties, assign a matchScore (0-100), write a 2-3 sentence reasoning, list redFlags, and note the data source.
3. For any property with "_historicalPriceDrop" > 0, write a "priceDropReasoning" predicting seller motivation.
4. If Portfolio Holdings data is provided, evaluate each property for portfolio concentration risk (0-100 portfolioFitScore).

CRITICAL — NEAR MISSES:
If ZERO properties exactly match the Buy Box, you MUST find 1-3 "nearMisses" — properties that ALMOST matched but missed on one dimension (e.g., $200k over budget, one county away, different sub-type but same use-case). For each near miss, explain EXACTLY what's off and WHY it's still worth a look.

Return JSON matching this schema:
{
    "briefing": "1-2 sentence summary tailored to this specific client.",
    "matchCount": 3,
    "curatedProperties": [
        {
            "sourceId": "CRX-123 or LN-123 or MLS-123456",
            "reasoning": "Fits because...",
            "matchScore": 95,
            "redFlags": ["High vacancy"],
            "priceDropReasoning": "...",
            "portfolioFitScore": 82,
            "portfolioFitReasoning": "..."
        }
    ],
    "nearMisses": [
        {
            "sourceId": "CRX-456",
            "whyItAlmostMatched": "This strip center is just $200k above Ali's max budget but in his exact target area. The broker has it listed for 97 days — a lowball offer could work.",
            "suggestion": "Consider offering $4.8M or widening max price to $5.5M."
        }
    ]
}`;



export async function POST(req: Request) {
    try {
        const { buybox } = await req.json() as { buybox: BuyBoxCriteria };

        if (!buybox) {
            return NextResponse.json({ error: "Missing buybox criteria." }, { status: 400 });
        }

        // 1. Fetch from data sources
        const apifyFeed = await getLiveApifyFeed();

        // 2. Feed is already normalized from Apify fetcher
        const mergedFeed = [...apifyFeed];

        if (mergedFeed.length === 0) {
            return NextResponse.json({
                clientId: buybox.id,
                clientName: buybox.name,
                briefing: "No active listings found in either the commercial scrapers or MLS today.",
                matchCount: 0,
                properties: [],
                nearMisses: []
            });
        }

        // --- PRE-FILTER ENGINE ---
        // To avoid Vercel timeouts and Gemini 429 (Resource Exhausted) errors, 
        // we must not send 6MB of raw JSON to the AI.
        // We will synthetically score the properties in JS and only send the top 15 "candidates" to Gemini.

        const priceMin = parseInt(buybox.priceMin || "0") || 0;
        const priceMax = parseInt(buybox.priceMax || "999999999") || 999999999;
        const targetLocation = (buybox.location || "").toLowerCase();
        const targetType = (buybox.propertyType || "").toLowerCase();

        const scoredFeed = mergedFeed.map(prop => {
            let score = 0;

            // 1. Price Matching (up to 40 points)
            if (prop.price && prop.price >= priceMin && prop.price <= priceMax) {
                score += 40;
            } else if (prop.price) {
                // Partial credit for being somewhat close (e.g., a near miss)
                const margin = priceMax * 0.2; // 20% over budget
                if (prop.price <= priceMax + margin) score += 20;
            }

            // 2. Location Matching (up to 30 points)
            const pLoc = `${prop.address} ${prop.city} ${prop.state} ${prop.zipCode}`.toLowerCase();
            if (targetLocation && pLoc.includes(targetLocation.replace(" county", ""))) {
                score += 30;
            }

            // 3. Type Matching (up to 30 points)
            const pType = (prop.propertyType || "").toLowerCase();
            if (targetType) {
                // simple keyword intersection
                const typeWords = targetType.replace(/[^a-z0-9]/g, ' ').split(' ').filter(Boolean);
                let matchedWords = 0;
                for (const w of typeWords) {
                    if (pType.includes(w) || (prop.description && prop.description.toLowerCase().includes(w))) {
                        matchedWords++;
                    }
                }
                if (matchedWords > 0) {
                    score += Math.min(30, (matchedWords / typeWords.length) * 30);
                }
            }

            return { prop, score };
        });

        // Sort by JS heuristic score, descending
        scoredFeed.sort((a, b) => b.score - a.score);

        // Take only the top 15 properties to send to Gemini
        const preFilteredFeed = scoredFeed.slice(0, 15).map(s => s.prop);

        // 4. Send to Gemini with the client's Buy Box
        const promptPayload = `
Client: ${buybox.name}
Buy Box Criteria:
- Type: ${buybox.propertyType}
- Transaction: ${buybox.transactionType}
- Location: ${buybox.location}
- Min Price: ${buybox.priceMin || "None"}
- Max Price: ${buybox.priceMax || "None"}
- Min Size: ${buybox.sizeMin || "None"}
- Max Size: ${buybox.sizeMax || "None"}
- Special: ${buybox.specialCriteria || "None"}
- Portfolio Holdings: ${buybox.portfolioHoldings || "No existing portfolio data."}

Merged Property Feed (Top ${preFilteredFeed.length} properties pre-filtered for relevance):
${JSON.stringify(preFilteredFeed, null, 2)}
`;

        const aiAnalysis = await generateAnalysis(MORNING_BRIEF_SYSTEM, promptPayload);

        // 5. Map curated IDs back to full property objects
        const curatedProperties = (aiAnalysis.curatedProperties || []).map((geminiData: any) => {
            const rawProp = mergedFeed.find((p: any) => p.sourceId === geminiData.sourceId);
            if (!rawProp) return null;

            const taxResult = checkTaxIncentives(rawProp.zipCode || "");

            return {
                ...rawProp,
                aiReasoning: geminiData.reasoning,
                aiMatchScore: geminiData.matchScore,
                aiRedFlags: geminiData.redFlags || [],
                aiPriceDropReasoning: geminiData.priceDropReasoning || null,
                aiPortfolioFitScore: geminiData.portfolioFitScore || null,
                aiPortfolioFitReasoning: geminiData.portfolioFitReasoning || null,
                taxIncentives: taxResult
            };
        }).filter(Boolean);

        // 6. Map near misses back to full property objects
        const nearMisses = (aiAnalysis.nearMisses || []).map((nm: any) => {
            const rawProp = mergedFeed.find((p: any) => p.sourceId === nm.sourceId);
            return {
                ...(rawProp || {}),
                whyItAlmostMatched: nm.whyItAlmostMatched,
                suggestion: nm.suggestion
            };
        });

        return NextResponse.json({
            clientId: buybox.id,
            clientName: buybox.name,
            briefing: aiAnalysis.briefing,
            matchCount: curatedProperties.length,
            properties: curatedProperties,
            nearMisses: nearMisses
        });

    } catch (error: any) {
        console.error("[Morning Brief API] Error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
