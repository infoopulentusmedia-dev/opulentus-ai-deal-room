import { NextRequest, NextResponse } from "next/server";
import { generateAnalysis } from "@/lib/gemini/client";

const SYSTEM_INSTRUCTION = `You are Opulentus Negotiation Strategist, an AI specializing in real estate deal negotiation for Michigan commercial and residential properties.
Given property details, DOM, price signals, and listing remarks, formulate a negotiation strategy.

Return valid JSON matching this schema:
{
  "leverageScore": number (0-100, higher = more leverage for buyer),
  "leverageFactors": ["string"],
  "openingScript": "string (the first call script to the listing agent)",
  "offerLadder": [
    { "level": "Anchor" | "Target" | "WalkAway", "price": number, "rationale": "string" }
  ],
  "counterTactics": ["string"],
  "verificationQuestions": ["string"],
  "timeline": "string (recommended timeline)",
  "confidence": "high" | "medium" | "low"
}`;

export async function POST(req: NextRequest) {
    try {
        const { property } = await req.json();

        const prompt = `Create a negotiation playbook for:
Address: ${property?.address || "Unknown"}
City: ${property?.city || "Unknown"}, MI
List Price: $${property?.listPrice || 0}
Property Type: ${property?.propertyType || "SFR"}
Square Feet: ${property?.squareFeet || property?.sqft || "Unknown"}
Year Built: ${property?.yearBuilt || "Unknown"}
Days on Market: ${property?.dom || "Unknown"}
Deal Score: ${property?.dealScore || "Unknown"}
Signals: ${property?.dealReasons?.join(", ") || "None identified"}
Remarks: ${property?.remarks || "None"}

Generate a negotiation strategy with offer ladder, opening script, and leverage analysis.`;

        const result = await generateAnalysis(SYSTEM_INSTRUCTION, prompt);
        return NextResponse.json(result);

    } catch (error) {
        console.error("Negotiation error:", error);
        return NextResponse.json({ error: "Negotiation playbook failed" }, { status: 500 });
    }
}
