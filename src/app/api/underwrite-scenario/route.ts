import { NextRequest, NextResponse } from "next/server";
import { generateAnalysis } from "@/lib/gemini/client";

const SYSTEM_INSTRUCTION = `You are Opulentus Underwriter, a commercial real estate underwriting AI.
Given property details (price, size, type, location, DOM, remarks), produce a complete underwriting scenario.
You must calculate realistic numbers based on the property type and Michigan market conditions.

For residential: assume market rent based on beds/baths and location.
For commercial: assume NNN lease rates per sqft based on property type.
For industrial/warehouse: assume $4-8/sqft NNN.
For retail/strip center: assume $10-18/sqft NNN.

Always return valid JSON matching this exact schema:
{
  "assumptions": {
    "purchasePrice": number,
    "downPaymentPct": number,
    "interestRate": number,
    "amortizationYears": number,
    "capexReservePct": number,
    "vacancyRatePct": number,
    "monthlyGrossRent": number,
    "annualInsurance": number,
    "annualTaxes": number,
    "managementFeePct": number
  },
  "metrics": {
    "NOI": number,
    "capRate": number,
    "cashOnCash": number,
    "DSCR": number,
    "totalCashNeeded": number,
    "annualDebtService": number,
    "monthlyMortgage": number,
    "annualCashFlow": number
  },
  "narrative": "2-3 sentence summary of the deal quality",
  "risks": ["string"],
  "sensitivityGrid": [
    { "scenario": "string", "capRate": number, "cashOnCash": number }
  ],
  "confidence": "high" | "medium" | "low"
}`;

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { property, purchasePrice, downPaymentPct } = body;

        const prompt = `Underwrite this property:
Address: ${property?.address || "Unknown"}
City: ${property?.city || "Unknown"}, MI
List Price: $${property?.listPrice || purchasePrice || 0}
Property Type: ${property?.propertyType || "SFR"}
Square Feet: ${property?.squareFeet || property?.sqft || "Unknown"}
Beds: ${property?.bedrooms || 0} / Baths: ${property?.bathrooms || 0}
Year Built: ${property?.yearBuilt || "Unknown"}
Days on Market: ${property?.dom || "Unknown"}
Remarks: ${property?.remarks || "None"}

User overrides:
Purchase Price: ${purchasePrice || property?.listPrice || "Use list price"}
Down Payment: ${downPaymentPct || 25}%

Generate a complete underwriting scenario with realistic Michigan market assumptions.`;

        const result = await generateAnalysis(SYSTEM_INSTRUCTION, prompt);
        return NextResponse.json(result);

    } catch (error) {
        console.error("Underwrite error:", error);
        return NextResponse.json({ error: "Underwriting analysis failed" }, { status: 500 });
    }
}
