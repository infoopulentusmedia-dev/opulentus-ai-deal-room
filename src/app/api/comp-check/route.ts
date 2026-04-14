import { NextResponse } from "next/server";
import { getLocalComps } from "@/lib/apify/compsFetcher";
import { MARKET_CONSTANTS } from "@/lib/scoring";
import { requireAgent } from "@/lib/supabase/auth-helpers";

/**
 * COMP CHECK — Deterministic valuation analysis, zero AI calls.
 * Compares asking price vs closed comps, calculates variance, determines negotiation leverage.
 */
export async function POST(req: Request) {
    // Hits the Apify-backed comps cache — gate to signed-in agents.
    const auth = await requireAgent();
    if (auth.error) return auth.error;

    try {
        const { property } = await req.json();

        if (!property) {
            return NextResponse.json({ error: "Missing property data" }, { status: 400 });
        }

        const comps = await getLocalComps(property.propertyType, property.zipCode || "481");

        if (comps.length === 0) {
            return NextResponse.json({
                analysis: "Insufficient closed sales data in this immediate submarket over the last 6 months to perform an accurate valuation. Consider expanding the search radius or checking county records directly.",
                metrics: null,
            });
        }

        // Calculate comp metrics
        const askingPrice = typeof property.price === "number" ? property.price : parseFloat(String(property.price || "0").replace(/[^0-9.]/g, ""));
        const askingSqft = property.buildingSizeSqft || property.squareFeet || property.sqft || 0;
        const askingPpsf = askingSqft > 0 ? askingPrice / askingSqft : null;

        // Comp averages
        const compPrices = comps.map((c: any) => c.salePrice || c.price).filter((p: number) => p > 0);
        const compSqft = comps.map((c: any) => c.buildingSizeSqft || c.sqft).filter((s: number) => s > 0);
        const compPpsf = comps
            .map((c: any) => {
                const p = c.salePrice || c.price;
                const s = c.buildingSizeSqft || c.sqft;
                return p > 0 && s > 0 ? p / s : null;
            })
            .filter((v: number | null): v is number => v !== null);

        const avgCompPrice = compPrices.length > 0 ? compPrices.reduce((a: number, b: number) => a + b, 0) / compPrices.length : 0;
        const avgCompPpsf = compPpsf.length > 0 ? compPpsf.reduce((a: number, b: number) => a + b, 0) / compPpsf.length : 0;
        const medianCompPpsf = compPpsf.length > 0 ? compPpsf.sort((a: number, b: number) => a - b)[Math.floor(compPpsf.length / 2)] : 0;

        // Variance
        const priceVariance = avgCompPrice > 0 ? ((askingPrice - avgCompPrice) / avgCompPrice) * 100 : 0;
        const ppsfVariance = askingPpsf && avgCompPpsf > 0 ? askingPpsf - avgCompPpsf : null;

        // Market average from constants
        const city = property.city || "";
        const marketAvgPpsf = MARKET_CONSTANTS.avgPricePerSqft[city as keyof typeof MARKET_CONSTANTS.avgPricePerSqft]
            || MARKET_CONSTANTS.avgPricePerSqft.Default;

        // Determine valuation stance
        let stance: string;
        let leverageLevel: "strong" | "moderate" | "weak";

        if (priceVariance > 15) {
            stance = "overpriced";
            leverageLevel = "strong";
        } else if (priceVariance > 5) {
            stance = "slightly above market";
            leverageLevel = "moderate";
        } else if (priceVariance > -5) {
            stance = "at market value";
            leverageLevel = "weak";
        } else if (priceVariance > -15) {
            stance = "slightly below market";
            leverageLevel = "weak";
        } else {
            stance = "significantly underpriced";
            leverageLevel = "weak";
        }

        // Build analysis narrative
        let analysis = "";

        if (askingPpsf && avgCompPpsf > 0) {
            const ppsfDiff = Math.abs(askingPpsf - avgCompPpsf).toFixed(0);
            const direction = askingPpsf > avgCompPpsf ? "above" : "below";
            analysis += `At $${askingPpsf.toFixed(0)}/sf, this property is $${ppsfDiff}/sf ${direction} the comp average of $${avgCompPpsf.toFixed(0)}/sf (${comps.length} closed sales). `;
        }

        if (askingPrice > 0 && avgCompPrice > 0) {
            analysis += `The asking price of $${askingPrice.toLocaleString()} is ${Math.abs(priceVariance).toFixed(0)}% ${priceVariance > 0 ? "above" : "below"} comparable sales, suggesting the property is ${stance}. `;
        }

        if (leverageLevel === "strong") {
            analysis += `Buyer has strong negotiation leverage — comps don't support the ask. Consider opening 10-15% below.`;
        } else if (leverageLevel === "moderate") {
            analysis += `Moderate room for negotiation. A 5-8% discount from asking is supported by the data.`;
        } else {
            analysis += `Limited negotiation leverage at this price point — the seller is priced competitively relative to recent closings.`;
        }

        return NextResponse.json({
            analysis,
            metrics: {
                askingPrice,
                askingPpsf: askingPpsf ? Math.round(askingPpsf) : null,
                avgCompPrice: Math.round(avgCompPrice),
                avgCompPpsf: Math.round(avgCompPpsf),
                medianCompPpsf: Math.round(medianCompPpsf),
                marketAvgPpsf: marketAvgPpsf,
                priceVariancePct: Math.round(priceVariance * 10) / 10,
                ppsfVariance: ppsfVariance ? Math.round(ppsfVariance) : null,
                compCount: comps.length,
                stance,
                leverageLevel,
            },
            engine: "deterministic",
        });

    } catch (error: any) {
        console.error("[Comp Check] Error:", error.message);
        return NextResponse.json({ error: "Failed to generate comp analysis" }, { status: 500 });
    }
}
