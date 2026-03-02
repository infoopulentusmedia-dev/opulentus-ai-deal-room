import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({});

export async function generateOrchestratorPlan(prompt: string) {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: `You are Opulentus, a Real Estate AI dealing exclusively in exact deals. 
Your goal is to parse user intents, query the RealComp database, and formulate a highly structured response plan.
Respond in valid JSON only matching the established assistant-command schema.`,
                temperature: 0.1,
                responseMimeType: "application/json",
            }
        });

        if (response.text) {
            return JSON.parse(response.text);
        }

        throw new Error("Empty response from Gemini");

    } catch (error) {
        console.error("Gemini Generation Error:", error);
        throw error;
    }
}

/**
 * General-purpose Gemini analysis for Deal Room tabs.
 * Accepts a system instruction, user prompt, and expected JSON schema hint.
 */
export async function generateAnalysis(systemInstruction: string, prompt: string): Promise<any> {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction,
                temperature: 0.2,
                responseMimeType: "application/json",
            }
        });

        if (response.text) {
            return JSON.parse(response.text);
        }

        throw new Error("Empty response from Gemini analysis");

    } catch (error) {
        console.error("Gemini Analysis Error:", error);
        throw error;
    }
}

/**
 * Generate a freeform text narrative (not JSON).
 */
export async function generateNarrative(systemInstruction: string, prompt: string): Promise<string> {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction,
                temperature: 0.3,
            }
        });

        return response.text || "No analysis generated.";

    } catch (error) {
        console.error("Gemini Narrative Error:", error);
        throw error;
    }
}
