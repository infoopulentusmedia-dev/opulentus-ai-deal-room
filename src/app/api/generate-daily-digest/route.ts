import { NextResponse } from 'next/server';
import { supabaseAdmin } from "@/lib/supabase";
import { findMatchesForBuyBox, scoreProperty, BuyBox } from "@/lib/matching/engine";
import { checkTaxIncentives } from "@/app/api/tax-incentive-check/route";

/**
 * DAILY DIGEST — Deterministic matching, zero AI calls.
 * Finds properties matching a buy box, scores them, generates briefing and strategy feedback.
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { buybox } = body;

        if (!buybox) {
            return NextResponse.json({ error: "Missing buybox criteria." }, { status: 400 });
        }

        // Load properties from Supabase
        const { data: properties, error: dbErr } = await supabaseAdmin.from('properties')
            .select('id, platform, address, price, property_type, property_data_json')
            .order('id', { ascending: false })
            .limit(500);

        if (dbErr || !properties || properties.length === 0) {
            return NextResponse.json({
                briefing: "No scraped properties in the database yet. The daily scraper will populate data at 7 AM UTC.",
                properties: [],
                strategyFeedback: null,
            });
        }

        const validProperties = properties.filter(p => p.property_data_json != null);

        // Run matching engine
        const bb: BuyBox = {
            propertyType: buybox.propertyType,
            transactionType: buybox.transactionType,
            location: buybox.location,
            priceMin: buybox.priceMin,
            priceMax: buybox.priceMax,
            sizeMin: buybox.sizeMin,
            sizeMax: buybox.sizeMax,
            specialCriteria: buybox.specialCriteria,
            portfolioHoldings: buybox.portfolioHoldings,
        };

        const { matches, nearMisses } = findMatchesForBuyBox(bb, validProperties, {
            limit: 20,
            includeNearMisses: true,
        });

        // Enrich matched properties with tax incentives and full data
        const curatedProperties = matches.map(m => {
            const prop = m.property;
            let taxResult = null;
            try {
                taxResult = checkTaxIncentives(prop.zipCode || prop.zip_code || "");
            } catch { /* non-fatal */ }

            // Price drop reasoning (deterministic)
            let priceDropReasoning = null;
            if (prop._historicalPriceDrop && prop._historicalPriceDrop > 0) {
                const dropPct = prop._historicalOriginalPrice
                    ? Math.round((prop._historicalPriceDrop / prop._historicalOriginalPrice) * 100)
                    : null;
                priceDropReasoning = dropPct
                    ? `Price dropped ${dropPct}% ($${(prop._historicalPriceDrop / 1000).toFixed(0)}K) from original — seller likely motivated to close.`
                    : `Price reduced by $${(prop._historicalPriceDrop / 1000).toFixed(0)}K — signals willingness to negotiate.`;
            }

            // Arbitrage analysis (deterministic)
            let arbitrageAnalysis = null;
            if (prop._ghostListingData) {
                const ghost = prop._ghostListingData;
                if (ghost.priceDifference !== 0) {
                    const cheaper = ghost.priceDifference > 0 ? ghost.otherPlatform : prop.platform;
                    arbitrageAnalysis = `Listed $${Math.abs(ghost.priceDifference).toLocaleString()} cheaper on ${cheaper?.toUpperCase()}. ${ghost.daysDifference > 0 ? `Also ${Math.abs(ghost.daysDifference)} days staler on ${ghost.otherPlatform}.` : ""}`;
                }
            }

            // Portfolio fit (deterministic)
            let portfolioFitScore = null;
            let portfolioFitReasoning = null;
            if (buybox.portfolioHoldings) {
                const holdings = buybox.portfolioHoldings.toLowerCase();
                const propType = (prop.propertyType || "").toLowerCase();
                const propCity = (prop.city || "").toLowerCase();

                if (holdings.includes(propType) && holdings.includes(propCity)) {
                    portfolioFitScore = 40;
                    portfolioFitReasoning = `Same type and area as existing holdings — increases concentration risk.`;
                } else if (holdings.includes(propType)) {
                    portfolioFitScore = 60;
                    portfolioFitReasoning = `Same property type but different geography — moderate diversification.`;
                } else if (holdings.includes(propCity)) {
                    portfolioFitScore = 75;
                    portfolioFitReasoning = `Different property type in a familiar market — good diversification play.`;
                } else {
                    portfolioFitScore = 90;
                    portfolioFitReasoning = `New market and property type — strong portfolio diversification.`;
                }
            }

            return {
                ...prop,
                aiReasoning: m.reasoning,
                aiMatchScore: m.totalScore,
                aiRedFlags: m.redFlags,
                aiPriceDropReasoning: priceDropReasoning,
                aiArbitrageAnalysis: arbitrageAnalysis,
                aiPortfolioFitScore: portfolioFitScore,
                aiPortfolioFitReasoning: portfolioFitReasoning,
                taxIncentives: taxResult,
            };
        });

        // Generate briefing text
        const clientName = buybox.name || "your client";
        const location = buybox.location || "target markets";
        const type = buybox.propertyType || "commercial properties";

        let briefing: string;
        if (curatedProperties.length > 0) {
            const top = curatedProperties[0];
            briefing = `Found ${curatedProperties.length} ${type} listing${curatedProperties.length > 1 ? "s" : ""} matching ${clientName}'s criteria in ${location}. `;
            briefing += `Top match: ${top.address || top.propertyType} in ${top.city || "the target area"} at $${(top.price || 0).toLocaleString()} (score: ${top.aiMatchScore}/100). `;
            if (curatedProperties.some((p: any) => p.aiPriceDropReasoning)) {
                briefing += `Notable: ${curatedProperties.filter((p: any) => p.aiPriceDropReasoning).length} listing(s) with recent price reductions — potential negotiation leverage.`;
            }
        } else {
            briefing = `No ${type} listings exactly matching ${clientName}'s criteria in ${location} today. Scanned ${validProperties.length} active properties across Crexi, LoopNet, and MLS.`;
        }

        // Strategy feedback (only if zero matches)
        let strategyFeedback = null;
        if (curatedProperties.length === 0 && nearMisses.length > 0) {
            const topNM = nearMisses[0];
            const bd = topNM.breakdown;
            if (bd.failedDimension === "price") {
                strategyFeedback = `${nearMisses.length} properties came close but exceeded the budget. Consider raising the max price by 15-20% to unlock viable options in your target area.`;
            } else if (bd.failedDimension === "location") {
                strategyFeedback = `Properties matching the type and price criteria exist in adjacent markets. Consider expanding the search radius to neighboring counties.`;
            } else if (bd.failedDimension === "type") {
                strategyFeedback = `The ${location} area has limited ${type} inventory right now. Consider related property types that could serve the same investment thesis.`;
            } else {
                strategyFeedback = `${nearMisses.length} properties nearly matched — slight adjustments to criteria (price, location, or size) could unlock quality deals.`;
            }
        }

        return NextResponse.json({
            briefing,
            strategyFeedback,
            properties: curatedProperties,
            engine: "deterministic",
        });

    } catch (error: any) {
        console.error("Daily Digest Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
