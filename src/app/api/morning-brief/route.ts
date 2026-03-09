import { NextResponse } from "next/server";
import { generateAnalysis } from "@/lib/gemini/client";
import { getLatestScan } from "@/lib/db";

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
        const scan = await getLatestScan();
        const apifyFeed = scan?.properties || [];

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

Merged Property Feed (${mergedFeed.length} properties from Crexi + LoopNet):
${JSON.stringify(mergedFeed, null, 2)}
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
