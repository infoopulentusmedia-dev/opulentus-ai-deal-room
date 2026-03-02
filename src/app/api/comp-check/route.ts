import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getLocalComps } from "@/lib/apify/compsFetcher";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `You are Opulentus Valuation Analyst, an elite commercial real estate AI. 
Your job is to compare an active asking price against recently closed sales data (comps) to determine if a property is overpriced, underpriced, or at market value.

Given the active property details and a list of closed comps, provide a short, punchy, hyper-analytical paragraph (2-3 sentences max).
Calculate the variance (e.g., "$10/sqft higher than market average") and declare whether the client has negotiation leverage.`;

export async function POST(req: Request) {
    try {
        const { property } = await req.json();

        if (!property) {
            return NextResponse.json({ error: "Missing property data" }, { status: 400 });
        }

        // 1. Fetch Closed Comps from our Apify Simulator (Step 10)
        // We use a fallback zip code to ensure we get some data in this demo.
        const comps = await getLocalComps(property.propertyType, property.zipCode || "481");

        if (comps.length === 0) {
            return NextResponse.json({
                analysis: "Insufficient closed sales data in this immediate submarket over the last 6 months to perform an accurate valuation."
            });
        }

        // 2. Format the Prompt for Gemini
        const prompt = `
Active Property:
Address: ${property.address}, ${property.city}
Type: ${property.propertyType}
Asking Price: $${property.price?.toLocaleString() || "Unpriced"}
Size: ${property.buildingSizeSqft ? `${property.buildingSizeSqft.toLocaleString()} sqft` : "Unknown"}

Closed Sales Data (Comps):
${JSON.stringify(comps, null, 2)}

Provide the valuation analysis paragraph.
`;

        // 3. Generate the Comp Analysis
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                temperature: 0.2,
            }
        });

        const analysis = response.text?.trim() || "Valuation analysis could not overlap with historical indices.";

        return NextResponse.json({ analysis });

    } catch (error: any) {
        console.error("[Comp Check API] Error:", error.message);
        return NextResponse.json({ error: "Failed to generate comp analysis" }, { status: 500 });
    }
}
