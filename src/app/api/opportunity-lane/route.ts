import { NextRequest, NextResponse } from "next/server";
import { generateAnalysis } from "@/lib/gemini/client";
import { requireAgent } from "@/lib/supabase/auth-helpers";

const SYSTEM_INSTRUCTION = `You are Opulentus Opportunity Analyst, an AI that identifies value-add opportunities and exit strategies for Michigan real estate.
Given property details, provide actionable investment insights.

Return valid JSON matching this schema:
{
  "opportunityType": "string (e.g. Value-Add, Cash Flow, Flip, Development)",
  "valueAddPlays": [
    { "play": "string", "estimatedCost": number, "estimatedValueIncrease": number, "timeline": "string" }
  ],
  "exitStrategies": [
    { "strategy": "string", "projectedPrice": number, "holdPeriod": "string", "annualizedReturn": number }
  ],
  "marketContext": "string (2-3 sentences about the local market trend)",
  "riskFactors": ["string"],
  "recommendation": "string (1-2 sentence bottom line)",
  "confidence": "high" | "medium" | "low"
}`;

export async function POST(req: NextRequest) {
    // 1 Gemini call per request — gate for cost protection.
    const auth = await requireAgent();
    if (auth.error) return auth.error;

    try {
        const { property } = await req.json();

        const prompt = `Analyze investment opportunity for:
Address: ${property?.address || "Unknown"}
City: ${property?.city || "Unknown"}, MI
List Price: $${property?.listPrice || 0}
Property Type: ${property?.propertyType || "SFR"}
Square Feet: ${property?.squareFeet || property?.sqft || "Unknown"}
Year Built: ${property?.yearBuilt || "Unknown"}
Days on Market: ${property?.dom || "Unknown"}
Deal Score: ${property?.dealScore || "Unknown"}
Remarks: ${property?.remarks || "None"}

Identify value-add plays, exit strategies, and market context for this Michigan property.`;

        const result = await generateAnalysis(SYSTEM_INSTRUCTION, prompt);
        return NextResponse.json(result);

    } catch (error) {
        console.error("Opportunity error:", error);
        return NextResponse.json({ error: "Opportunity analysis failed" }, { status: 500 });
    }
}
