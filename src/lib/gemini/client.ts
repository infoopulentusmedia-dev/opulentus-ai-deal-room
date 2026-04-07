import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-6';

const cleanJson = (text: string): string =>
    text.replace(/```json\n?|\n?```/g, '').trim();

export async function generateOrchestratorPlan(prompt: string) {
    try {
        const message = await client.messages.create({
            model: MODEL,
            max_tokens: 4096,
            system: `You are Opulentus, a Real Estate AI dealing exclusively in exact deals.
Your goal is to parse user intents, query the RealComp database, and formulate a highly structured response plan.
Respond in valid JSON only matching the established assistant-command schema.`,
            messages: [{ role: 'user', content: prompt }],
        });

        const text = (message.content[0] as { type: string; text: string }).text;
        if (text) return JSON.parse(cleanJson(text));

        throw new Error('Empty response from Claude');
    } catch (error) {
        console.error('Claude OrchestratorPlan Error:', error);
        throw error;
    }
}

/**
 * General-purpose Claude analysis for Deal Room tabs.
 * Accepts a system instruction, user prompt, returns parsed JSON.
 */
export async function generateAnalysis(systemInstruction: string, prompt: string): Promise<any> {
    try {
        const message = await client.messages.create({
            model: MODEL,
            max_tokens: 4096,
            system: systemInstruction,
            messages: [{ role: 'user', content: prompt }],
        });

        const text = (message.content[0] as { type: string; text: string }).text;
        if (text) return JSON.parse(cleanJson(text));

        throw new Error('Empty response from Claude analysis');
    } catch (error) {
        console.error('Claude Analysis Error:', error);
        throw error;
    }
}

/**
 * Generate a freeform text narrative (not JSON).
 */
export async function generateNarrative(systemInstruction: string, prompt: string): Promise<string> {
    try {
        const message = await client.messages.create({
            model: MODEL,
            max_tokens: 2048,
            system: systemInstruction,
            messages: [{ role: 'user', content: prompt }],
        });

        return (message.content[0] as { type: string; text: string }).text || 'No analysis generated.';
    } catch (error) {
        console.error('Claude Narrative Error:', error);
        throw error;
    }
}
