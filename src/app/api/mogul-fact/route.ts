import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `You are a historian of commercial real estate. Your sole job is to provide exactly ONE fascinating, little-known fact about an iconic real estate mogul from history (e.g., John Jacob Astor, Arthur Zeckendorf, Trammell Crow, Gerald Hines, William Zeckendorf, Sam Zell, etc.) and a core business principle they used to build their empire.

Rules:
1. Keep it under 2 sentences. Make it engaging, punchy, and highly intelligent.
2. It must be a REAL, historically accurate fact.
3. Do not use Markdown formatting, bolding, or lists. Just raw text.
4. Provide a different fact every single time.`;

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const prompt = "Give me a random, unique historical fact about a real estate mogul and their business principle. Ensure it is entirely different from the last one you generated.";

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                temperature: 0.9, // High temp for randomness
            }
        });

        const text = response.text?.trim() || "John Jacob Astor believed that buying land in the path of development was the ultimate wealth generator. He purchased Manhattan real estate before the grid expanded, defining the strategy of long-term land banking.";

        // Clean up markdown if AI ignored rules
        const cleanText = text.replace(/[*_#]/g, '');

        return NextResponse.json({ fact: cleanText });

    } catch (error: any) {
        console.error("[Mogul Fact API] Error:", error.message);
        return NextResponse.json({ fact: "Arthur Zeckendorf popularized the concept of 'highest and best use' by assembling small parcels into massive developments. He believed that the assembled whole was always worth more than the sum of its parts." });
    }
}
