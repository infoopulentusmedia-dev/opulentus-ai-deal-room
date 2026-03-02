import { NextResponse } from 'next/server';
import { generateAnalysis } from "@/lib/gemini/client";
import { getLatestScan, getDigestCache, saveDigestCache } from "@/lib/db";
import { getLiveApifyFeed } from "@/lib/apify/fetcher";
import { checkTaxIncentives } from "@/app/api/tax-incentive-check/route";

const DAILY_DIGEST_SYSTEM = `You are an elite Commercial Real Estate Acquisitions Director for Opulentus Private Wealth.
Your job is to review a raw daily feed of deeply nested property JSON scraped from Crexi and LoopNet, compare them against a specific client's strict "Buy Box" criteria, and curate the best deals into a morning briefing.

You will be given:
1. The Client's "Buy Box" Criteria.
2. The "Daily Feed" (a JSON array of new properties intelligently merged from RealComp MLS, Crexi, and LoopNet).

YOUR TASK:
1. Filter out any properties that drastically violate the Buy Box.
2. For the remaining valid properties, assign a matchScore (0-100), write a 2-3 sentence reasoning explaining exactly why it fits the criteria, and list any redFlags.
3. CRITICAL: For any property in the JSON that has a "_historicalPriceDrop" value greater than 0, you MUST write a 1-sentence "priceDropReasoning" predicting the seller's motivation level based on the size of the drop in relation to the original price.
4. CRITICAL: For any property in the JSON that has "_ghostListingData", this means the broker has listed it on both Crexi AND LoopNet. You MUST write a 1-to-2 sentence "arbitrageAnalysis" explaining any price differences ("Listed $200k cheaper on LoopNet") or stale days-on-market discrepancies.
5. Write a highly professional, 2-to-3 paragraph "briefing" summarizing the state of the market today, highlighting any major price reductions or arbitrage if applicable.
6. IF ZERO (0) PROPERTIES MATCH the strict criteria, you MUST provide a "strategyFeedback" paragraph. This paragraph should analyze the discarded properties and suggest how the client could slightly tweak their Buy Box (e.g. increase max price or expand radius) to unlock viable deals that closely align with their goals.
7. PORTFOLIO FIT SCORING (Step 12): If "Portfolio Holdings" data is provided, you MUST evaluate each property against the client's existing assets. Score 0-100 on how well the new deal fits (diversification, concentration risk, geographic overlap). Write a 1-sentence "portfolioFitReasoning" explaining whether this deal strengthens or weakens the client's portfolio balance.
8. Return a JSON structure exactly matching this schema:
{
    "briefing": "The 2-to-3 paragraph morning briefing text...",
    "strategyFeedback": "Optional: Only include if 0 properties match. E.g., 'While no properties matched your strict $1M cap, bumping to $1.2M unlocks 3 excellent industrial options...'",
    "curatedProperties": [
        {
            "sourceId": "The CRX- or LN- ID",
            "reasoning": "Fits criteria because...",
            "matchScore": 95,
            "redFlags": ["High vacancy"],
            "priceDropReasoning": "A $100k drop on a $1M asset suggests high motivation to sell before year-end.",
            "arbitrageAnalysis": "Arbitrage alert: This listing is priced $150k lower on Crexi than on LoopNet, offering an immediate negotiation advantage.",
            "portfolioFitScore": 82,
            "portfolioFitReasoning": "Adding this strip center diversifies Ali's retail footprint beyond Dearborn while maintaining his 60/40 retail-industrial split."
        }
    ]
}
`;

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { buybox } = body;

        if (!buybox) {
            return NextResponse.json({ error: "Missing buybox criteria." }, { status: 400 });
        }

        // Extremely fast live fetch from Apify Database instead of ephemeral Vercel local filesystem
        const combinedFeed = await getLiveApifyFeed();

        if (combinedFeed.length === 0) {
            return NextResponse.json({
                briefing: "Your data sources (Apify scrapers and RealComp API) have not pulled any new properties yet today. Trigger a new run or broaden your search criteria to generate the digest.",
                properties: []
            });
        }

        // --- CACHE CHECK ---
        const todayStr = new Date().toISOString().split('T')[0];
        const cachedDigest = getDigestCache(buybox.id, todayStr);
        if (cachedDigest) {
            console.log(`[Digest API] Returning cached digest for client: ${buybox.id} on ${todayStr}`);
            return NextResponse.json(cachedDigest);
        }
        // -------------------

        const promptPayload = `
Client Buy Box Criteria:
- Type: ${buybox.propertyType}
- Transaction: ${buybox.transactionType}
- Location: ${buybox.location}
- Min Price: ${buybox.priceMin || 'None'}
- Max Price: ${buybox.priceMax || 'None'}
- Min Size: ${buybox.sizeMin || 'None'}
- Max Size: ${buybox.sizeMax || 'None'}
- Special: ${buybox.specialCriteria || 'None'}
- Portfolio Holdings: ${buybox.portfolioHoldings || 'No existing portfolio data provided.'}

Daily Feed (JSON):
${JSON.stringify(combinedFeed, null, 2)}
`;

        const aiAnalysis = await generateAnalysis(DAILY_DIGEST_SYSTEM, promptPayload);

        // Map the IDs back into full property objects, injecting the Gemini reasoning natively
        const curatedProperties = aiAnalysis.curatedProperties.map((geminiData: any) => {
            const rawProp = combinedFeed.find((p: any) => p.sourceId === geminiData.sourceId);
            if (!rawProp) return null;

            // Step 14: Auto-stamp tax incentive badges
            const taxResult = checkTaxIncentives(rawProp.zipCode || "");

            return {
                ...rawProp,
                aiReasoning: geminiData.reasoning,
                aiMatchScore: geminiData.matchScore,
                aiRedFlags: geminiData.redFlags || [],
                aiPriceDropReasoning: geminiData.priceDropReasoning || null,
                aiArbitrageAnalysis: geminiData.arbitrageAnalysis || null,
                aiPortfolioFitScore: geminiData.portfolioFitScore || null,
                aiPortfolioFitReasoning: geminiData.portfolioFitReasoning || null,
                taxIncentives: taxResult
            };
        }).filter(Boolean);

        const finalResponse = {
            briefing: aiAnalysis.briefing,
            strategyFeedback: aiAnalysis.strategyFeedback || null,
            properties: curatedProperties
        };

        // Save to cache so subsequent loads today are instant
        saveDigestCache(buybox.id, todayStr, finalResponse);

        return NextResponse.json(finalResponse);

    } catch (error: any) {
        console.error("Daily Digest Generation Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
