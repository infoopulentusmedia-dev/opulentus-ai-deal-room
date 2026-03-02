import { NextRequest, NextResponse } from "next/server";
import { generateAnalysis } from "@/lib/gemini/client";

const SYSTEM_INSTRUCTION = `You are the Opulentus Demographics & Retail-Viability AI Engine.
You specialize in evaluating location intelligence for commercial real estate properties in Michigan.

Given a property address, city, and basic details, you must simulate fetching standard retail/commercial demographic vectors:
- 1, 3, and 5-mile household income rings.
- 1, 3, and 5-mile population density and 5-year growth projections.
- Average Annual Daily Traffic (AADT) for the nearest major artery or intersection.
- Major corporate anchors within 3 miles (e.g., Hospitals, Universities, Fortune 500 regional offices).

Use your training data on Michigan geography to provide highly realistic, mathematically sound estimations for these metrics based on the provided city and location context.

Return valid JSON matching this exact schema:
{
  "aadt": number (Average Annual Daily Traffic, e.g., 25000),
  "trafficRating": "High" | "Medium" | "Low",
  "oneMileIncome": number (Median Household Income, e.g., 85000),
  "threeMileIncome": number,
  "fiveMileIncome": number,
  "populationDensityClass": "Dense Urban" | "Suburban Retail Corridor" | "Industrial Park" | "Rural/Exurb",
  "majorAnchors": ["string (e.g., Corewell Health Royal Oak Hospital 1.2mi away)"],
  "retailViabilityScore": number (1-100),
  "roiTranslation": "string (1 sentence simple English summary: e.g., 'AADT of 30,000+ means this location guarantees $2.5M+ top-line revenue for a QSR drive-thru concept.')",
  "confidence": "high" | "medium" | "low"
}`;

export async function POST(req: NextRequest) {
    try {
        const { property } = await req.json();

        if (!property) {
            return NextResponse.json({ error: "Property data required" }, { status: 400 });
        }

        const prompt = `Simulate hyper-local demographics and traffic counts for this commercial location:
        
Address: ${property.address || "Unknown"}
City: ${property.city || "Unknown"}, MI
Zip: ${property.zip || "Unknown"}
Property Type: ${property.propertyType || "Commercial"}

Identify the AADT, demographic rings, and major corporate/institutional anchors to rate retail viability.`;

        const result = await generateAnalysis(SYSTEM_INSTRUCTION, prompt);
        return NextResponse.json(result);

    } catch (error) {
        console.error("Demographics Intelligence error:", error);
        return NextResponse.json({ error: "Demographics Simulation failed to generate" }, { status: 500 });
    }
}
