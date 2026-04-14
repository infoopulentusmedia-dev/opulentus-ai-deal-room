import { NextRequest, NextResponse } from "next/server";
import { generateAnalysis } from "@/lib/gemini/client";
import { requireAgent } from "@/lib/supabase/auth-helpers";

const SYSTEM_INSTRUCTION = `You are Opulentus Comps Analyst, a Michigan real estate comparable analysis AI.
Given a subject property, generate realistic comparable sales and listings from the same area.
Use your knowledge of Michigan real estate markets to create plausible comps.

Return valid JSON matching this schema:
{
  "subjectProperty": {
    "address": "string",
    "listPrice": number,
    "pricePerSqft": number
  },
  "comps": [
    {
      "address": "string",
      "type": "saleComp" | "activeComp",
      "price": number,
      "pricePerSqft": number,
      "sqft": number,
      "beds": number,
      "baths": number,
      "closeDate": "string or null",
      "distanceMiles": number,
      "similarityScore": number,
      "adjustedValue": number,
      "adjustments": "string"
    }
  ],
  "estimatedValue": number,
  "valueRange": { "low": number, "high": number },
  "narrative": "string",
  "confidence": "high" | "medium" | "low"
}`;

export async function POST(req: NextRequest) {
    // Calls Gemini to synthesize comps — gate to signed-in agents to prevent cost abuse.
    const auth = await requireAgent();
    if (auth.error) return auth.error;

    try {
        const { property } = await req.json();

        const prompt = `Generate comparable sales analysis for:
Address: ${property?.address || "Unknown"}
City: ${property?.city || "Unknown"}, MI ${property?.zip || ""}
List Price: $${property?.listPrice || 0}
Property Type: ${property?.propertyType || "SFR"}
Square Feet: ${property?.squareFeet || property?.sqft || "Unknown"}
Beds: ${property?.bedrooms || 0} / Baths: ${property?.bathrooms || 0}
Year Built: ${property?.yearBuilt || "Unknown"}
DOM: ${property?.dom || "Unknown"}

Generate 3-4 realistic comps from the same area with adjusted values.`;

        const result = await generateAnalysis(SYSTEM_INSTRUCTION, prompt);
        return NextResponse.json(result);

    } catch (error) {
        console.error("Comps error:", error);
        return NextResponse.json({ error: "Comps analysis failed" }, { status: 500 });
    }
}
