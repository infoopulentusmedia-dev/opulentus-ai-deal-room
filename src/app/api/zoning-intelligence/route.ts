import { NextRequest, NextResponse } from "next/server";
import { generateAnalysis } from "@/lib/gemini/client";
import { requireAgent } from "@/lib/supabase/auth-helpers";

const SYSTEM_INSTRUCTION = `You are the Opulentus Zoning & Density AI Engine.
You specialize in analyzing municipal codes to discover "Undercapitalized Density"—which translates directly to massive ROI potential for our investors.

For this analysis, evaluate the property's lot size, existing structure, and assumed baseline commercial zoning rules for a mid-to-large Michigan municipality. 
Assume standard "Mixed-Use Corridor" or "General Commercial" zoning defaults:
- Maximum building height: 5 stories (approx. 60ft)
- Floor Area Ratio (FAR): 3.0 to 4.0
- Setbacks: 10ft front, zero lot line sides.

Your Goal: Determine if there is a severe mismatch between the *current* structure and the *legally allowed maximum* structure (Undercapitalized Density).

Return valid JSON matching this exact schema:
{
  "projectedZoning": "string (e.g., C-2 General Commercial, MU Mixed-Use)",
  "allowedUses": ["string (e.g., Retail, Multifamily, Medical Office)"],
  "currentFar": number,
  "maxFar": number,
  "undercapitalizedDensityScore": number (1-100, where 100 is a single-story shed on a block zoned for skyscrapers),
  "densityAnalysis": "string (2-3 sentences explaining the gap between what is built and what *could* be built)",
  "zoningHack": "string (1 sentence 'developer secret' or variance strategy to maximize value)",
  "roiTranslation": "string (1 sentence simple English summary: e.g., 'Legally zoned for 5 stories, currently 1. You are buying 4 stories of invisible air rights for free.')",
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

        const prompt = `Analyze zoning and density potential for this Michigan property:
        
Address: ${property.address || "Unknown"}
City: ${property.city || "Unknown"}, MI
Property Type: ${property.propertyType || "Commercial"}
Existing Structure SqFt: ${property.squareFeet || property.sqft || "Unknown"}
Lot Size (Acres): ${property.lotSizeAcres || "Unknown"}
Year Built: ${property.yearBuilt || "Unknown"}

Identify the Floor Area Ratio (FAR) gap and calculate the Undercapitalized Density Score.`;

        const result = await generateAnalysis(SYSTEM_INSTRUCTION, prompt);
        return NextResponse.json(result);

    } catch (error) {
        console.error("Zoning Intelligence error:", error);
        return NextResponse.json({ error: "Zoning Intelligence failed to generate" }, { status: 500 });
    }
}
