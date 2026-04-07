import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const MODEL = 'gemini-2.0-flash';

/**
 * Extract JSON from Gemini response text.
 * Handles: markdown code fences, leading/trailing text around JSON,
 * and responses where Gemini wraps JSON in explanation text.
 */
function extractJson(text: string): string {
    // Step 1: Strip markdown code fences
    let cleaned = text.replace(/```json\n?|\n?```/g, '').trim();

    // Step 2: If it already looks like valid JSON, return it
    if ((cleaned.startsWith('{') && cleaned.endsWith('}')) ||
        (cleaned.startsWith('[') && cleaned.endsWith(']'))) {
        return cleaned;
    }

    // Step 3: Extract the outermost JSON object or array via regex
    const objMatch = cleaned.match(/(\{[\s\S]*\})/);
    if (objMatch) return objMatch[1];

    const arrMatch = cleaned.match(/(\[[\s\S]*\])/);
    if (arrMatch) return arrMatch[1];

    // Step 4: Nothing found — return as-is (will throw on JSON.parse, caught by caller)
    return cleaned;
}

export async function generateOrchestratorPlan(prompt: string) {
    try {
        const response = await ai.models.generateContent({
            model: MODEL,
            contents: prompt,
            config: {
                maxOutputTokens: 4096,
                systemInstruction: `You are Opulentus, a Real Estate AI dealing exclusively in exact deals.
Your goal is to parse user intents, query the RealComp database, and formulate a highly structured response plan.
Respond in valid JSON only matching the established assistant-command schema.`,
            },
        });

        const text = response.text;
        if (text) return JSON.parse(extractJson(text));

        throw new Error('Empty response from Gemini');
    } catch (error) {
        console.error('Gemini OrchestratorPlan Error:', error);
        throw error;
    }
}

/**
 * General-purpose Gemini analysis for Deal Room tabs.
 * Accepts a system instruction, user prompt, returns parsed JSON.
 */
export async function generateAnalysis(systemInstruction: string, prompt: string): Promise<any> {
    try {
        const response = await ai.models.generateContent({
            model: MODEL,
            contents: prompt,
            config: {
                maxOutputTokens: 4096,
                systemInstruction,
            },
        });

        const text = response.text;
        if (text) return JSON.parse(extractJson(text));

        throw new Error('Empty response from Gemini analysis');
    } catch (error) {
        console.error('Gemini Analysis Error:', error);
        throw error;
    }
}

/**
 * Generate a freeform text narrative (not JSON).
 */
export async function generateNarrative(systemInstruction: string, prompt: string): Promise<string> {
    try {
        const response = await ai.models.generateContent({
            model: MODEL,
            contents: prompt,
            config: {
                maxOutputTokens: 2048,
                systemInstruction,
            },
        });

        return response.text || 'No analysis generated.';
    } catch (error) {
        console.error('Gemini Narrative Error:', error);
        throw error;
    }
}
