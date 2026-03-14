import { NextResponse } from 'next/server';
import { generateAnalysis } from "@/lib/gemini/client";
import { supabaseAdmin } from "@/lib/supabase";

// ═══════════════════════════════════════
// STEP 1: INTENT CLASSIFICATION PROMPT
// ═══════════════════════════════════════
const INTENT_ROUTER = `You are the Opulentus Command Center Router.
Your ONLY job is to classify a broker's command into exactly one intent and extract the relevant parameters.

INTENTS:
1. "add" — The user wants to ADD or CREATE a new client. Triggers: "add", "lock in", "new client", "sign up", "onboard", or any sentence describing a new person with property criteria.
2. "edit" — The user wants to UPDATE or CHANGE an existing client's details. Triggers: "update", "change", "modify", "edit", "set", "switch", "adjust", "bump", "raise", "lower".
3. "delete" — The user wants to REMOVE or DELETE an existing client. Triggers: "remove", "delete", "drop", "kick", "take off", "deactivate".
4. "query" — The user wants to SEE or CHECK an existing client's status or matched deals. Triggers: "show", "what", "how", "check", "status", "deals for", "matches for", "latest for".
5. "blast" — The user wants to TRIGGER the daily email blast immediately. Triggers: "send", "blast", "trigger", "fire", "email", "dispatch", "push the email".

OUTPUT STRICTLY VALID JSON:
{
  "intent": "add" | "edit" | "delete" | "query" | "blast",
  "clientName": "Name of the client referenced (or empty if blast)",
  "rawCommand": "The full original command repeated back"
}
`;

// ═══════════════════════════════════════
// STEP 2: ADD CLIENT — FULL NLP PARSER
// ═══════════════════════════════════════
const ADD_CLIENT_PROMPT = `You are the Opulentus Master Router Client Intake AI.
Your SOLE job is to extract a real estate client's "Buy Box" from a natural language command.

RULE 1 — NAME: Extract the client's full name. Handle first-name-only, hyphenated, Arabic names. If none found, use "Unknown Client".
RULE 2 — EMAIL: Extract any email address. Normalize spacing. If none, return "".
RULE 3 — PROPERTY TYPE: Map to EXACTLY ONE of:
  "Strip Center / Retail Plaza" (retail, strip center, strip mall, plaza, shopping center, mixed use retail)
  "Warehouse / Industrial" (warehouse, industrial, distribution, manufacturing, factory, flex)
  "Multifamily" (multifamily, apartments, duplex, triplex, apartment complex)
  "Mechanic / Dealership" (mechanic, auto repair, car dealership, body shop)
  "Residential" (residential, house, home, single family, SFR, townhouse, condo)
  "Commercial" (office, commercial, gas station, medical, land, vacant — DEFAULT if vague)
RULE 4 — PRICES: Convert to raw integers. "$5M"→"5000000", "$500k"→"500000". "under $5M"→max only. "between $1-4M"→both. No price→"".
RULE 5 — LOCATION: Extract geography. Counties, cities, zips, regions. Multiple OK. No location→"Any Location".
RULE 6 — SPECIAL: Distressed, cap rate, sqft constraints → specialCriteria. Size → sizeMin/sizeMax. None→"".

OUTPUT JSON:
{ "name":"","email":"","propertyType":"","location":"","priceMin":"","priceMax":"","sizeMin":"","sizeMax":"","specialCriteria":"" }
`;

// ═══════════════════════════════════════
// STEP 3: EDIT CLIENT — FIELD EXTRACTOR
// ═══════════════════════════════════════
const EDIT_CLIENT_PROMPT = `You are the Opulentus Client Editor AI.
The broker wants to update an existing client's Buy Box. Extract ONLY the fields they want to change.

RULES:
- "clientName": The name of the client being edited (REQUIRED).
- Only include fields the user explicitly mentions changing. Do NOT invent or guess values for unmentioned fields.
- For price changes: "$3M"→"3000000", "$500k"→"500000".
- For email changes: extract the new email address.
- For location changes: extract the new location.
- For property type changes: map to the standard types (Strip Center / Retail Plaza, Warehouse / Industrial, Multifamily, Mechanic / Dealership, Residential, Commercial).

OUTPUT JSON (include ONLY changed fields plus clientName):
{ "clientName":"Ali Beydoun", "priceMax":"3000000" }
or
{ "clientName":"Fadi", "email":"newemail@invest.com", "location":"Oakland County" }
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

            default:
                return NextResponse.json({
                    intent: "unknown",
                    success: false,
                    message: "I didn't understand that command. Try: add a client, edit a client, remove a client, check a client's deals, or trigger the daily blast."
                });
        }

    } catch (error: any) {
        console.error("Command Center Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
