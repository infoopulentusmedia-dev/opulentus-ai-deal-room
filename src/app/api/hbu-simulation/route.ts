import { NextRequest, NextResponse } from "next/server";
import { generateAnalysis } from "@/lib/gemini/client";
import { requireAgent } from "@/lib/supabase/auth-helpers";

const SYSTEM_INSTRUCTION = `You are the Opulentus "Highest & Best Use" (HBU) AI Engine.
You specialize in commercial real estate underwriting and distressed asset repositioning.
Given a property's basic details, you must instantly conceptualize and simulate 3 fundamentally different but realistic underwriting scenarios for the property. 

Scenario Rules:
1. Scenario A should generally be the "As-Is" or "Light Value-Add" play (e.g., raise rents, minor cosmetic updates).
2. Scenario B should be a heavier repositioning or adaptive reuse (e.g., convert office to residential, convert warehouse to self-storage, deep rehab).
3. Scenario C should be a maximum-density or tear-down redevelopment (e.g., scrape and build a 5-story mixed-use, construct townhomes).

For each scenario, calculate standard commercial metrics:
- Estimated Capex/Renovation Cost
- Projected Exit Value
- Projected IRR (Internal Rate of Return)
- Projected Hold Period

You must then mathematically compare the three scenarios and declare a definitive "Winner" (the true Highest & Best Use) based on the highest risk-adjusted IRR.

Return valid JSON matching this exact schema:
{
  "scenarios": [
    {
      "id": "A",
      "name": "string (e.g., As-Is Value Add)",
      "description": "string (1 sentence summary of the play)",
      "estimatedCapex": number,
      "projectedExitValue": number,
      "projectedIRR": number,
      "holdPeriodYears": number
    },
    {
      "id": "B",
      "name": "string",
      "description": "string",
      "estimatedCapex": number,
      "projectedExitValue": number,
      "projectedIRR": number,
      "holdPeriodYears": number
    },
    {
      "id": "C",
      "name": "string",
      "description": "string",
      "estimatedCapex": number,
      "projectedExitValue": number,
      "projectedIRR": number,
      "holdPeriodYears": number
    }
  ],
  "winningScenarioId": "A" | "B" | "C",
  "winnerRationale": "string (2-3 sentences explaining why this mathematically beats the others based on Michigan market dynamics)",
  "confidence": "high" | "medium" | "low"
}`;

export async function POST(req: NextRequest) {
    // 1 Gemini call per request — gate for cost protection.
    const auth = await requireAgent();
    if (auth.error) return auth.error;

    try {
        const { property } = await req.json();

        if (!property) {
            return NextResponse.json({ error: "Property data required" }, { status: 400 });
        }

        const prompt = `Simulate 3 Highest & Best Use (HBU) scenarios for this Michigan property:
        
Address: ${property.address || "Unknown"}
City: ${property.city || "Unknown"}, MI
List Price: $${property.listPrice || 0}
Property Type: ${property.propertyType || "Commercial"}
Square Feet: ${property.squareFeet || property.sqft || "Unknown"}
Lot Size (Acres): ${property.lotSizeAcres || "Unknown"}
Year Built: ${property.yearBuilt || "Unknown"}
Remarks: ${property.remarks || "None"}

Provide 3 distinct scenarios ranging from As-Is to full redevelopment, and mathematically determine the winner based on IRR.`;

        const result = await generateAnalysis(SYSTEM_INSTRUCTION, prompt);
        return NextResponse.json(result);

    } catch (error) {
        console.error("HBU Simulation error:", error);
        return NextResponse.json({ error: "HBU Simulation failed to generate" }, { status: 500 });
    }
}
