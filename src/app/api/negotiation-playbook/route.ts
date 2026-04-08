import { NextRequest, NextResponse } from "next/server";
import { MARKET_CONSTANTS } from "@/lib/scoring";

/**
 * NEGOTIATION PLAYBOOK — Formula-based strategy, zero AI calls.
 * Calculates leverage score, offer ladder, counter tactics, and opening script.
 */
export async function POST(req: NextRequest) {
    try {
        const { property } = await req.json();

        if (!property) {
            return NextResponse.json({ error: "Missing property data" }, { status: 400 });
        }

        const listPrice = property.listPrice || property.price || 0;
        const dom = property.dom || property.daysOnPlatform || 0;
        const city = property.city || "Unknown";
        const propertyType = property.propertyType || "Commercial";
        const yearBuilt = property.yearBuilt || 0;
        const sqft = property.squareFeet || property.sqft || property.buildingSizeSqft || 0;
        const dealScore = property.dealScore || 50;
        const dealReasons: string[] = property.dealReasons || [];
        const remarks = property.remarks || "";

        // Market avg DOM for this city
        const avgDOM = MARKET_CONSTANTS.avgDaysOnMarket[city as keyof typeof MARKET_CONSTANTS.avgDaysOnMarket]
            || MARKET_CONSTANTS.avgDaysOnMarket.Default;

        // ── LEVERAGE SCORE CALCULATION (0-100) ──
        let leverageScore = 30; // Base

        // DOM factor (most important signal)
        if (dom > avgDOM * 3) leverageScore += 30;       // Very stale — strong leverage
        else if (dom > avgDOM * 2) leverageScore += 22;
        else if (dom > avgDOM * 1.5) leverageScore += 15;
        else if (dom > avgDOM) leverageScore += 8;
        else if (dom < avgDOM * 0.5) leverageScore -= 10; // Hot property — less leverage

        // Price drop signal
        const priceDrop = property._historicalPriceDrop || 0;
        if (priceDrop > 0) {
            const dropPct = listPrice > 0 ? (priceDrop / (listPrice + priceDrop)) * 100 : 0;
            if (dropPct > 15) leverageScore += 20;
            else if (dropPct > 8) leverageScore += 12;
            else if (dropPct > 3) leverageScore += 6;
        }

        // Age factor
        const currentYear = new Date().getFullYear();
        if (yearBuilt > 0 && currentYear - yearBuilt > 40) leverageScore += 5;
        if (yearBuilt > 0 && currentYear - yearBuilt > 60) leverageScore += 5;

        // Remarks signals
        const lowerRemarks = remarks.toLowerCase();
        if (lowerRemarks.includes("motivated") || lowerRemarks.includes("must sell")) leverageScore += 10;
        if (lowerRemarks.includes("as-is") || lowerRemarks.includes("estate sale")) leverageScore += 8;
        if (lowerRemarks.includes("price reduced") || lowerRemarks.includes("reduced")) leverageScore += 5;
        if (lowerRemarks.includes("multiple offers") || lowerRemarks.includes("pending")) leverageScore -= 15;

        leverageScore = Math.max(0, Math.min(100, leverageScore));

        // ── LEVERAGE FACTORS ──
        const leverageFactors: string[] = [];
        if (dom > avgDOM * 2) leverageFactors.push(`Listed ${dom} days — ${Math.round(dom / avgDOM)}x the market average of ${avgDOM} days`);
        if (priceDrop > 0) leverageFactors.push(`Price already reduced by $${(priceDrop / 1000).toFixed(0)}K — seller is adjusting expectations`);
        if (yearBuilt > 0 && currentYear - yearBuilt > 40) leverageFactors.push(`Built in ${yearBuilt} — age may deter competing buyers`);
        if (lowerRemarks.includes("motivated")) leverageFactors.push("Listing remarks indicate motivated seller");
        if (lowerRemarks.includes("as-is")) leverageFactors.push("Sold as-is — seller wants a clean exit");
        if (dom < avgDOM) leverageFactors.push("Fresh listing — limited leverage, expect competition");
        if (leverageFactors.length === 0) leverageFactors.push("Standard market conditions — negotiate based on comps and inspection findings");

        // ── OFFER LADDER ──
        let anchorDiscount: number;
        let targetDiscount: number;
        let walkawayDiscount: number;

        if (leverageScore >= 70) {
            anchorDiscount = 0.82;   // 18% below ask
            targetDiscount = 0.88;   // 12% below ask
            walkawayDiscount = 0.93; // 7% below ask
        } else if (leverageScore >= 50) {
            anchorDiscount = 0.88;   // 12% below ask
            targetDiscount = 0.92;   // 8% below ask
            walkawayDiscount = 0.96; // 4% below ask
        } else {
            anchorDiscount = 0.93;   // 7% below ask
            targetDiscount = 0.95;   // 5% below ask
            walkawayDiscount = 0.98; // 2% below ask
        }

        const offerLadder = [
            {
                level: "Anchor",
                price: Math.round(listPrice * anchorDiscount),
                rationale: `Open at $${(listPrice * anchorDiscount).toLocaleString()} (${Math.round((1 - anchorDiscount) * 100)}% below ask) to set the negotiation range and test seller's floor.`,
            },
            {
                level: "Target",
                price: Math.round(listPrice * targetDiscount),
                rationale: `Target $${(listPrice * targetDiscount).toLocaleString()} (${Math.round((1 - targetDiscount) * 100)}% below ask) — the price where the deal makes financial sense.`,
            },
            {
                level: "WalkAway",
                price: Math.round(listPrice * walkawayDiscount),
                rationale: `Walk away above $${(listPrice * walkawayDiscount).toLocaleString()} (${Math.round((1 - walkawayDiscount) * 100)}% below ask) — above this, returns don't justify the risk.`,
            },
        ];

        // ── OPENING SCRIPT ──
        const leveragePhrase = leverageScore >= 70
            ? `I noticed this has been on the market for ${dom} days — my client is ready to move quickly with clean financing if the price is right.`
            : leverageScore >= 50
                ? `My client is interested and has financing in place. We'd like to make a competitive offer — what's the seller's flexibility on price?`
                : `My client wants to move fast on this one. We're prepared to close within 30 days with standard contingencies.`;

        const openingScript = `Hi, this is [Agent Name] with Opulentus Private Wealth. I'm calling about the ${propertyType} at ${property.address || "the listing"} in ${city}. ${leveragePhrase} What can you tell me about the seller's timeline and motivation?`;

        // ── COUNTER TACTICS ──
        const counterTactics: string[] = [];
        counterTactics.push("If countered above target: ask for seller concessions (closing costs, repairs, rate buydown)");
        counterTactics.push("If countered at or near list: reference comps and inspection findings to justify your position");
        if (dom > avgDOM) counterTactics.push(`Use the ${dom}-day DOM as evidence of market resistance to the current price`);
        if (priceDrop > 0) counterTactics.push("Reference the prior price reduction as evidence the market has already spoken");
        counterTactics.push("If multiple counters stall: propose a split-the-difference with a 14-day close timeline as sweetener");

        // ── VERIFICATION QUESTIONS ──
        const verificationQuestions = [
            "What is the seller's timeline for closing?",
            "Are there any pending offers or recent showings?",
            "Why is the seller selling — relocation, portfolio rebalancing, or financial pressure?",
            "Are there any deferred maintenance items or known issues?",
            "Would the seller consider seller financing or a lease-back arrangement?",
        ];

        // ── TIMELINE ──
        const timeline = leverageScore >= 70
            ? "Move within 48 hours — high leverage means the seller may accept quickly. Don't give time for competing offers."
            : leverageScore >= 50
                ? "Submit within 5 business days. Allow time for inspection and financing verification."
                : "Standard 7-10 day timeline. Ensure thorough due diligence given limited leverage.";

        const confidence = leverageScore >= 65 ? "high" : leverageScore >= 40 ? "medium" : "low";

        return NextResponse.json({
            leverageScore,
            leverageFactors,
            openingScript,
            offerLadder,
            counterTactics,
            verificationQuestions,
            timeline,
            confidence,
            engine: "deterministic",
        });

    } catch (error) {
        console.error("Negotiation error:", error);
        return NextResponse.json({ error: "Negotiation playbook failed" }, { status: 500 });
    }
}
