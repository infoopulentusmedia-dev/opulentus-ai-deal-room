import { NextResponse } from 'next/server';
import { generateAnalysis } from "@/lib/gemini/client";
import { supabaseAdmin } from "@/lib/supabase";

// ═══════════════════════════════════════
// STEP 1: INTENT CLASSIFICATION PROMPT
// ═══════════════════════════════════════
const INTENT_ROUTER = `You are the Opulentus Command Center Router.
Your ONLY job is to classify a broker's command into exactly one intent and extract the relevant parameters.

INTENTS:
1. "add" — The user wants to ADD or CREATE a new client. Triggers: "add", "lock in", "new client", "sign up", "onboard", or any sentence describing a new person with property criteria AND their name.
2. "edit" — The user wants to UPDATE or CHANGE an existing client's details. Triggers: "update", "change", "modify", "edit", "set", "switch", "adjust", "bump", "raise", "lower".
3. "delete" — The user wants to REMOVE or DELETE an existing client. Triggers: "remove", "delete", "drop", "kick", "take off", "deactivate".
4. "query" — The user wants to SEE or CHECK an existing client's status or matched deals. Triggers: "show me [client]'s", "what did [client] get", "check [client]", "status for", "deals for", "matches for".
5. "blast" — The user wants to TRIGGER the daily email blast immediately. Triggers: "send blast", "trigger blast", "fire the email", "dispatch", "push the email", "send the daily".
6. "search" — The user wants to SEARCH for properties or deals in the MLS database. Triggers: "find", "search", "look for", "any", "properties", "listings", "deals", "foreclosures", "distressed", or any sentence describing property criteria WITHOUT mentioning a specific person to add/edit/remove. This is the DEFAULT if the command doesn't clearly match intents 1-5.

CRITICAL DISTINCTION:
- "Add Fadi, warehouses in Macomb" = "add" (has a person's name + onboarding language)
- "Find warehouses in Macomb" = "search" (searching for properties, no person being added)
- "Distressed multifamilies in Wayne County" = "search" (property search query)
- "Show me Fadi's deals" = "query" (checking a specific person's info)

OUTPUT STRICTLY VALID JSON:
{
  "intent": "add" | "edit" | "delete" | "query" | "blast" | "search",
  "clientName": "Name of the client referenced (or empty if blast/search)",
  "searchQuery": "The property search query text (only for search intent, else empty)",
  "rawCommand": "The full original command repeated back"
}
`;

// ═══════════════════════════════════════
// STEP 2: ADD CLIENT — FULL NLP PARSER
// ═══════════════════════════════════════
const ADD_CLIENT_PROMPT = `You are the Opulentus Master Router Client Intake AI.
Your SOLE job is to extract a real estate client's "Buy Box" from a natural language command.

═══════════════════════════════════════
RULE 1 — NAME EXTRACTION
═══════════════════════════════════════
- Extract the client's full name exactly as spoken.
- Handle first-name-only ("Fadi"), hyphenated ("Mary-Jane"), Arabic ("Hussein Al-Zeitoun"), compound ("Van Der Berg").
- If the name is buried mid-sentence ("I got a new buyer named Mike Torres"), still extract it.
- If absolutely no name exists, use "Unknown Client".

═══════════════════════════════════════
RULE 2 — EMAIL EXTRACTION
═══════════════════════════════════════
- Extract any email address found anywhere in the text. Normalize spacing ("john @ kw . com" → "john@kw.com").
- If no email exists, return an empty string "".

═══════════════════════════════════════
RULE 3 — PROPERTY TYPE MAPPING
═══════════════════════════════════════
Map the requested asset to EXACTLY ONE of these strings:
- "Strip Center / Retail Plaza" (retail, strip center, mall, plaza)
- "Warehouse / Industrial" (warehouse, industrial, distro, manufacturing)
- "Multifamily" (multifamily, apartments, duplex, complex)
- "Mechanic / Dealership" (mechanic, auto repair, dealership)
- "Residential" (house, home, single family, condo)
- "Commercial" (office, gas station, land — DEFAULT if vague)

═══════════════════════════════════════
RULE 4 — PRICE NORMALIZATION
═══════════════════════════════════════
Convert ALL price references to raw integer strings:
- "$5M", "5 mil", "5 million" → "5000000"
- "$500k", "500 thousand" → "500000"
- "between $1M and $4M" → priceMin: "1000000", priceMax: "4000000"
- "under $5M", "max 5 million" → priceMax: "5000000"
- "over $1M", "starting at $1M" → priceMin: "1000000"
- If NO price is mentioned, return "" for both.

═══════════════════════════════════════
RULE 5 — LOCATION, SIZE & SPECIAL
═══════════════════════════════════════
- Extract geography (Counties, cities, zips). Multiple OK. None → "Any Location".
- "40k sqft minimum" → sizeMin: "40000"
- Distressed, cap rate, constraints → specialCriteria. None → "".

OUTPUT STRICTLY VALID JSON:
{ "name":"","email":"","propertyType":"","location":"","priceMin":"","priceMax":"","sizeMin":"","sizeMax":"","specialCriteria":"" }
`;

// ═══════════════════════════════════════
// STEP 3: EDIT CLIENT — FIELD EXTRACTOR
// ═══════════════════════════════════════
const EDIT_CLIENT_PROMPT = `You are the Opulentus Client Editor AI.
The broker wants to update an existing client's Buy Box based on conversational input.

RULES FOR EXTRACTION:
1. "clientName": The name of the client being edited (REQUIRED). If the broker says "Update Ali's budget", clientName is "Ali".
2. Only include fields the user explicitly mentions changing. Do NOT guess values for unmentioned fields.
3. PRICE RULES: Convert "$3M" or "3 mil" to "3000000", and "$500k" to "500000". "Raise budget to $5M" means priceMax="5000000". "Looking over $1M" means priceMin="1000000".
4. PROPERTY TYPE RULES: Map to ONLY "Strip Center / Retail Plaza", "Warehouse / Industrial", "Multifamily", "Mechanic / Dealership", "Residential", or "Commercial".
5. EMAIL RULES: Extract standard emails.
6. LOCATION: Exact phrases (e.g. "Wayne County", "Detroit").
7. SIZE: "Expand to 50k sqft" -> sizeMax="50000". "At least 10k sqft" -> sizeMin="10000".

OUTPUT STRICTLY VALID JSON (include ONLY changed fields plus clientName):
{ "clientName":"Ali Beydoun", "priceMax":"3000000" }
or
{ "clientName":"Fadi", "propertyType":"Warehouse / Industrial", "location":"Oakland County" }
`;

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { prompt } = body;

        if (!prompt) {
            return NextResponse.json({ error: "Missing command." }, { status: 400 });
        }

        console.log("[Command Center] Received:", prompt);

        // ═══ STEP 1: CLASSIFY INTENT ═══
        const routing = await generateAnalysis(INTENT_ROUTER, `Command: "${prompt}"`);
        const intent = routing.intent;

        console.log("[Command Center] Classified intent:", intent);

        // ═══ STEP 2: EXECUTE INTENT ═══
        switch (intent) {

            // ───────────────────────────
            // ADD CLIENT
            // ───────────────────────────
            case "add": {
                const analysis = await generateAnalysis(ADD_CLIENT_PROMPT, `Broker Command: "${prompt}"`);
                const clientId = analysis.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

                const upsertPayload: any = {
                    name: analysis.name,
                    updated_at: new Date().toISOString(),
                    buy_box_json: {
                        id: clientId,
                        name: analysis.name,
                        propertyType: analysis.propertyType || "Commercial",
                        transactionType: "Buy",
                        location: analysis.location || "Any Location",
                        priceMin: analysis.priceMin || "",
                        priceMax: analysis.priceMax || "",
                        sizeMin: analysis.sizeMin || "",
                        sizeMax: analysis.sizeMax || "",
                        specialCriteria: analysis.specialCriteria || ""
                    }
                };
                if (analysis.email) upsertPayload.email = analysis.email;

                const { data, error } = await supabaseAdmin.from('clients').upsert(
                    upsertPayload, { onConflict: 'name' }
                ).select();

                if (error) throw error;

                return NextResponse.json({
                    intent: "add",
                    success: true,
                    message: `${analysis.name} has been locked into the 7:00 AM Deal Flow.`,
                    client: data[0]
                });
            }

            // ───────────────────────────
            // EDIT CLIENT
            // ───────────────────────────
            case "edit": {
                const edits = await generateAnalysis(EDIT_CLIENT_PROMPT, `Broker Command: "${prompt}"`);
                const targetName = edits.clientName || routing.clientName;

                if (!targetName) {
                    return NextResponse.json({ intent: "edit", success: false, message: "Could not identify which client to edit." });
                }

                // Fetch existing client
                const { data: existing } = await supabaseAdmin
                    .from('clients')
                    .select('*')
                    .ilike('name', `%${targetName}%`)
                    .limit(1);

                if (!existing || existing.length === 0) {
                    return NextResponse.json({ intent: "edit", success: false, message: `Client "${targetName}" not found in your portfolio.` });
                }

                const client = existing[0];
                const currentBuyBox = client.buy_box_json || {};

                // Merge only the fields Gemini extracted
                const updatedBuyBox = { ...currentBuyBox };
                if (edits.propertyType) updatedBuyBox.propertyType = edits.propertyType;
                if (edits.location) updatedBuyBox.location = edits.location;
                if (edits.priceMin !== undefined && edits.priceMin !== "") updatedBuyBox.priceMin = edits.priceMin;
                if (edits.priceMax !== undefined && edits.priceMax !== "") updatedBuyBox.priceMax = edits.priceMax;
                if (edits.sizeMin) updatedBuyBox.sizeMin = edits.sizeMin;
                if (edits.sizeMax) updatedBuyBox.sizeMax = edits.sizeMax;
                if (edits.specialCriteria) updatedBuyBox.specialCriteria = edits.specialCriteria;

                const updatePayload: any = {
                    buy_box_json: updatedBuyBox,
                    updated_at: new Date().toISOString()
                };
                if (edits.email) updatePayload.email = edits.email;

                const { data: updated, error } = await supabaseAdmin
                    .from('clients')
                    .update(updatePayload)
                    .eq('id', client.id)
                    .select();

                if (error) throw error;

                return NextResponse.json({
                    intent: "edit",
                    success: true,
                    message: `${client.name}'s Buy Box has been updated.`,
                    client: updated?.[0] || client
                });
            }

            // ───────────────────────────
            // DELETE CLIENT
            // ───────────────────────────
            case "delete": {
                const targetName = routing.clientName;
                if (!targetName) {
                    return NextResponse.json({ intent: "delete", success: false, message: "Could not identify which client to remove." });
                }

                const { data: found } = await supabaseAdmin
                    .from('clients')
                    .select('id, name')
                    .ilike('name', `%${targetName}%`)
                    .limit(1);

                if (!found || found.length === 0) {
                    return NextResponse.json({ intent: "delete", success: false, message: `Client "${targetName}" not found.` });
                }

                const { error } = await supabaseAdmin
                    .from('clients')
                    .delete()
                    .eq('id', found[0].id);

                if (error) throw error;

                return NextResponse.json({
                    intent: "delete",
                    success: true,
                    message: `${found[0].name} has been removed from the Deal Flow.`,
                    deletedName: found[0].name
                });
            }

            // ───────────────────────────
            // QUERY CLIENT
            // ───────────────────────────
            case "query": {
                const targetName = routing.clientName;
                if (!targetName) {
                    return NextResponse.json({ intent: "query", success: false, message: "Could not identify which client to query." });
                }

                const { data: clients } = await supabaseAdmin
                    .from('clients')
                    .select('*')
                    .ilike('name', `%${targetName}%`)
                    .limit(1);

                if (!clients || clients.length === 0) {
                    return NextResponse.json({ intent: "query", success: false, message: `Client "${targetName}" not found.` });
                }

                const client = clients[0];
                const bb = client.buy_box_json || {};

                // Fetch their latest AI analyses
                const { data: analyses } = await supabaseAdmin
                    .from('ai_analyses')
                    .select('property_id, score, reason, created_at')
                    .eq('client_id', client.name)
                    .order('score', { ascending: false })
                    .limit(5);

                return NextResponse.json({
                    intent: "query",
                    success: true,
                    message: `${client.name}: ${bb.propertyType || "Commercial"} in ${bb.location || "Any Location"}, ${bb.priceMin ? "$" + (parseInt(bb.priceMin)/1000000).toFixed(1) + "M" : "$0"} – ${bb.priceMax ? "$" + (parseInt(bb.priceMax)/1000000).toFixed(1) + "M" : "No Max"}`,
                    client,
                    recentMatches: analyses || []
                });
            }

            // ───────────────────────────
            // BLAST (Trigger Daily Email)
            // ───────────────────────────
            case "blast": {
                try {
                    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
                    const blastRes = await fetch(`${APP_URL}/api/cron/daily-blast`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    const blastResult = await blastRes.json();

                    return NextResponse.json({
                        intent: "blast",
                        success: true,
                        message: `Daily Blast fired! ${blastResult.totalDealsRouted || 0} deals routed across ${blastResult.clientsMatched || 0} clients.`,
                        details: blastResult
                    });
                } catch (blastErr: any) {
                    return NextResponse.json({
                        intent: "blast",
                        success: false,
                        message: `Blast trigger failed: ${blastErr.message}`
                    });
                }
            }

            // ───────────────────────────
            // SEARCH (MLS Property Search)
            // ───────────────────────────
            case "search": {
                const searchQuery = routing.searchQuery || prompt;
                return NextResponse.json({
                    intent: "search",
                    success: true,
                    searchQuery,
                    message: `Searching: "${searchQuery}"`
                });
            }

            default:
                // Fallback: treat as a search query
                return NextResponse.json({
                    intent: "search",
                    success: true,
                    searchQuery: prompt,
                    message: `Searching: "${prompt}"`
                });
        }

    } catch (error: any) {
        console.error("Command Center Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
