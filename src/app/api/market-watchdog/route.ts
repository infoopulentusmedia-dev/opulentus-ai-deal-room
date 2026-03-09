import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getLatestScan } from "@/lib/db";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `You are Opulentus Market Intelligence, an AI that analyzes real estate market data to detect macro-level trends and anomalies.

Given a batch of current property listings, identify 2-4 actionable market alerts. Focus on:
1. Price trend shifts (e.g., "Industrial asking prices in Wayne County are trending 8% below Q3 averages")
2. Inventory anomalies (e.g., "3 properties from the same owner listed this week — possible bulk discount opportunity")
3. Market velocity changes (e.g., "Retail vacancy in Oakland County dropped 4% month-over-month")
4. Geographic hotspots (e.g., "6 new listings in 48228 this week — emerging seller activity")

Return valid JSON matching this schema:
{
    "alerts": [
        {
            "type": "price_trend" | "inventory_anomaly" | "velocity_change" | "geographic_hotspot",
            "severity": "high" | "medium" | "low",
            "headline": "Short 1-line alert title",
            "detail": "1-2 sentence explanation with specific numbers"
        }
    ]
}`;

export async function GET() {
    try {
        const scan = await getLatestScan();
        const feed = scan?.properties || [];

        if (feed.length === 0) {
            return NextResponse.json({ alerts: [] });
        }

        const prompt = `Analyze this batch of ${feed.length} current Michigan property listings and generate market intelligence alerts:\n\n${JSON.stringify(feed, null, 2)}`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                temperature: 0.3,
            }
        });

        const text = response.text?.trim() || "";

        // Parse the JSON from Gemini response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return NextResponse.json({ alerts: [] });
        }

        const parsed = JSON.parse(jsonMatch[0]);
        return NextResponse.json(parsed);

    } catch (error: any) {
        console.error("[Market Watchdog] Error:", error.message);
        return NextResponse.json({ alerts: [] });
    }
}
