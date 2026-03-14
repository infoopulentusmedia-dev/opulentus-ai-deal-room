import { NextResponse } from 'next/server';
import { generateAnalysis } from "@/lib/gemini/client";
import { supabaseAdmin } from "@/lib/supabase";

const NLP_INTAKE_SYSTEM = `You are an elite Opulentus Private Wealth Client Intake Orchestrator.
Your exclusive purpose is to read a natural language command from a real estate broker and extract their new client's strict "Buy Box" criteria into a perfectly formatted JSON object.

RULES:
1. Extract the client's name. If no name is found, use "Unknown Client".
2. Extract the email address strictly if provided. If not provided, return an empty string "".
3. Map the requested asset class to EXACTLY ONE of the following precise strings:
   - "Strip Center / Retail Plaza"
   - "Warehouse / Industrial"
   - "Multifamily"
   - "Mechanic / Dealership"
   - "Residential"
   - "Commercial" (Use this as a fallback if the type is vague)
4. Extract the location constraint (e.g. "Wayne County", "Detroit", "48124"). If not mentioned, use "Any Location".
5. Extract the absolute Minimum Price requirement as a raw integer string (e.g. "1000000"). If no minimum is specified, return an empty string "".
6. Extract the absolute Maximum Price requirement as a raw integer string (e.g. "5000000"). If no maximum is specified, return an empty string "".

YOUR OUTPUT MUST BE STRICTLY VALID JSON EXACTLY MATCHING THIS SCHEMA:
{
  "name": "Full Name",
  "email": "email@example.com",
  "propertyType": "Strictly Valid Type String",
  "location": "Target geography",
  "priceMin": "Raw number string or empty",
  "priceMax": "Raw number string or empty"
}
`;

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { prompt } = body;

        if (!prompt) {
            return NextResponse.json({ error: "Missing natural language prompt." }, { status: 400 });
        }

        console.log("[NLP Intake] Processing command:", prompt);

        // 1. Run the prompt through the Gemini JSON parser
        const analysis = await generateAnalysis(NLP_INTAKE_SYSTEM, `Broker Command: "${prompt}"`);
        
        // 2. Format the payload for the existing Supabase Client structure
        const clientId = analysis.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        
        const upsertPayload: any = {
            name: analysis.name,
            updated_at: new Date().toISOString(),
            buy_box_json: {
                id: clientId,
                name: analysis.name,
                propertyType: analysis.propertyType,
                transactionType: "Buy", // Default assumption
                location: analysis.location,
                priceMin: analysis.priceMin,
                priceMax: analysis.priceMax,
                sizeMin: "",
                sizeMax: "",
                specialCriteria: ""
            }
        };

        if (analysis.email) {
            upsertPayload.email = analysis.email;
        }

        // 3. Immediately commit to Supabase to hook them into the 7AM Blast
        const { data, error } = await supabaseAdmin.from('clients').upsert(
            upsertPayload,
            { onConflict: 'name' }
        ).select();

        if (error) {
            console.error("Supabase NLP Intake Commit Error:", error);
            throw error;
        }

        return NextResponse.json({ 
            success: true, 
            client: data[0] 
        });

    } catch (error: any) {
        console.error("NLP Client Intake Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
