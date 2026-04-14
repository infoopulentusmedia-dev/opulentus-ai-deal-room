import { NextResponse } from 'next/server';
import { supabaseAdmin } from "@/lib/supabase";
import { requireAgent } from '@/lib/supabase/auth-helpers';
import { removeClientFromBriefs } from '@/lib/briefs/storage';

/**
 * COMMAND CENTER — Fully deterministic intent routing + parameter extraction.
 * Zero AI calls. Regex-based parsing handles add/edit/delete/query/blast/search.
 * All operations are scoped to the authenticated agent.
 */

// ═══════════════════════════════════════
// INTENT CLASSIFICATION — Pure keyword matching
// ═══════════════════════════════════════
function classifyIntent(prompt: string): { intent: string; clientName: string; searchQuery: string } {
    const lower = prompt.toLowerCase().trim();

    // BLAST — trigger daily email
    if (/\b(send\s*(the\s*)?blast|trigger\s*blast|fire\s*(the\s*)?email|dispatch|push\s*(the\s*)?email|send\s*(the\s*)?daily)\b/.test(lower)) {
        return { intent: "blast", clientName: "", searchQuery: "" };
    }

    // DELETE — remove a client
    if (/\b(remove|delete|drop|kick|take\s*off|deactivate)\b/.test(lower)) {
        const name = extractNameAfterKeyword(lower, /(remove|delete|drop|kick|take\s*off|deactivate)/);
        return { intent: "delete", clientName: name, searchQuery: "" };
    }

    // QUERY — check a client's status/deals
    if (/\b(show\s*me|what\s*did|check|status\s*for|deals\s*for|matches\s*for|how\s*is|how's)\b/.test(lower)) {
        const name = extractNameFromQuery(lower);
        return { intent: "query", clientName: name, searchQuery: "" };
    }

    // EDIT — update an existing client
    if (/\b(update|change|modify|edit|set|switch|adjust|bump|raise|lower)\b/.test(lower)) {
        const name = extractNameFromEdit(lower);
        return { intent: "edit", clientName: name, searchQuery: "" };
    }

    // ADD — create a new client (must have a person's name + intent language)
    if (/\b(add|lock\s*in|new\s*client|sign\s*up|onboard)\b/.test(lower)) {
        return { intent: "add", clientName: "", searchQuery: "" };
    }

    // Check if it looks like adding (has a person's name + property criteria but no search keywords)
    // Patterns like "Ali, strip centers, Wayne County, $1-5M"
    if (/^[A-Z][a-z]+(\s[A-Z][a-z]+)?,\s/.test(prompt) && !/(find|search|look\s*for|any\b|properties|listings)/.test(lower)) {
        return { intent: "add", clientName: "", searchQuery: "" };
    }

    // SEARCH — default fallback
    return { intent: "search", clientName: "", searchQuery: prompt };
}

function extractNameAfterKeyword(text: string, pattern: RegExp): string {
    const match = text.match(new RegExp(pattern.source + "\\s+(.+?)(?:\\s*from|\\s*$)", "i"));
    if (match) return cleanName(match[1]);
    // Try extracting anything after the keyword
    const parts = text.split(pattern);
    if (parts.length > 1) return cleanName(parts[1].trim());
    return "";
}

function extractNameFromQuery(text: string): string {
    // "show me Ali's deals" → "Ali"
    const possessive = text.match(/(\w+(?:\s+\w+)?)'s/i);
    if (possessive) return cleanName(possessive[1]);
    // "deals for Ali Beydoun" → "Ali Beydoun"
    const forMatch = text.match(/(?:for|about)\s+(.+?)(?:\s*$)/i);
    if (forMatch) return cleanName(forMatch[1]);
    // "check Ali" → "Ali"
    const checkMatch = text.match(/(?:show me|check|status|deals for|matches for|how is|how's)\s+(.+?)(?:\s*$)/i);
    if (checkMatch) return cleanName(checkMatch[1]);
    return "";
}

function extractNameFromEdit(text: string): string {
    // "update Ali's budget" → "Ali"
    const possessive = text.match(/(\w+(?:\s+\w+)?)'s/i);
    if (possessive) return cleanName(possessive[1]);
    // "edit Ali Beydoun" → "Ali Beydoun"
    const afterKeyword = text.match(/(?:update|change|modify|edit|adjust)\s+(.+?)(?:'s|\s+to\b|\s+price|\s+budget|\s+location|\s+type|\s*$)/i);
    if (afterKeyword) return cleanName(afterKeyword[1]);
    return "";
}

function cleanName(name: string): string {
    return name
        .replace(/\b(client|from|the|deals?|status|matches?|his|her|their)\b/gi, "")
        .replace(/['']/g, "")
        .trim();
}

// ═══════════════════════════════════════
// DETERMINISTIC NLP — Regex-based parameter extraction
// ═══════════════════════════════════════

const PROPERTY_TYPE_MAP: Record<string, string> = {
    "strip": "Strip Center / Retail Plaza", "retail": "Strip Center / Retail Plaza", "plaza": "Strip Center / Retail Plaza", "shopping": "Strip Center / Retail Plaza",
    "warehouse": "Warehouse / Industrial", "industrial": "Warehouse / Industrial", "flex": "Warehouse / Industrial", "distribution": "Warehouse / Industrial", "logistics": "Warehouse / Industrial",
    "multifamily": "Multifamily", "multi-family": "Multifamily", "apartment": "Multifamily", "duplex": "Multifamily", "triplex": "Multifamily", "fourplex": "Multifamily",
    "mechanic": "Mechanic / Dealership", "dealership": "Mechanic / Dealership", "auto": "Mechanic / Dealership", "car wash": "Mechanic / Dealership", "gas station": "Mechanic / Dealership",
    "residential": "Residential", "house": "Residential", "home": "Residential", "single family": "Residential", "sfr": "Residential",
    "office": "Commercial", "commercial": "Commercial", "mixed": "Commercial", "medical": "Commercial", "restaurant": "Commercial", "hotel": "Commercial", "hospitality": "Commercial",
    "land": "Commercial", "lot": "Commercial", "vacant": "Commercial",
};

function parsePrice(raw: string): string {
    if (!raw) return "";
    const cleaned = raw.replace(/[$,\s]/g, "").toLowerCase();
    const mMatch = cleaned.match(/([\d.]+)\s*m/);
    if (mMatch) return String(Math.round(parseFloat(mMatch[1]) * 1_000_000));
    const kMatch = cleaned.match(/([\d.]+)\s*k/);
    if (kMatch) return String(Math.round(parseFloat(kMatch[1]) * 1_000));
    const numMatch = cleaned.match(/[\d.]+/);
    if (numMatch) return String(Math.round(parseFloat(numMatch[0])));
    return "";
}

function parseSize(raw: string): string {
    if (!raw) return "";
    const cleaned = raw.replace(/[,\s]/g, "").toLowerCase();
    const kMatch = cleaned.match(/([\d.]+)\s*k/);
    if (kMatch) return String(Math.round(parseFloat(kMatch[1]) * 1_000));
    const numMatch = cleaned.match(/[\d.]+/);
    if (numMatch) return String(Math.round(parseFloat(numMatch[0])));
    return "";
}

function detectPropertyType(text: string): string {
    const lower = text.toLowerCase();
    for (const [keyword, mapped] of Object.entries(PROPERTY_TYPE_MAP)) {
        if (lower.includes(keyword)) return mapped;
    }
    return "Commercial";
}

function detectTransactionType(text: string): string {
    const lower = text.toLowerCase();
    if (/\b(lease|leasing|for lease|nnn|triple net)\b/.test(lower)) return "For Lease";
    if (/\b(auction)\b/.test(lower)) return "Auction";
    return "Buy";
}

const MI_COUNTIES = ["wayne", "oakland", "macomb", "washtenaw", "livingston", "genesee", "kent", "ingham"];
const MI_CITIES = ["detroit", "dearborn", "livonia", "canton", "troy", "southfield", "ann arbor", "farmington", "novi", "warren", "sterling heights", "rochester", "pontiac", "royal oak", "westland", "garden city", "inkster", "taylor", "redford", "allen park"];

function detectLocation(text: string): string {
    const lower = text.toLowerCase();
    // Check counties
    for (const county of MI_COUNTIES) {
        if (lower.includes(county + " county") || lower.includes(county)) {
            return county.charAt(0).toUpperCase() + county.slice(1) + " County";
        }
    }
    // Check cities
    for (const city of MI_CITIES) {
        if (lower.includes(city)) {
            return city.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        }
    }
    // Check metro area
    if (/\b(metro detroit|southeast michigan|se michigan|tri-county|tri county)\b/.test(lower)) {
        return "Metro Detroit";
    }
    // Fallback: grab anything after "in" or after a comma that looks like a location
    const inMatch = text.match(/\bin\s+([A-Z][a-zA-Z\s]+?)(?:,|\s*$|\s*\d)/);
    if (inMatch) return inMatch[1].trim();
    return "";
}

function parseBuyBoxFromText(text: string): {
    name: string; email: string; propertyType: string; transactionType: string;
    location: string; priceMin: string; priceMax: string; sizeMin: string; sizeMax: string; specialCriteria: string;
} {
    // Extract name: first capitalized word(s) before a comma, or after "add"
    let name = "";
    const addMatch = text.match(/(?:add|lock\s*in|new\s*client|onboard)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
    const commaLeadMatch = text.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*,/);
    if (addMatch) name = addMatch[1];
    else if (commaLeadMatch) name = commaLeadMatch[1];

    // Extract email
    const emailMatch = text.match(/[\w.+-]+@[\w.-]+\.\w+/);
    const email = emailMatch ? emailMatch[0] : "";

    // Price range: "$1-5M", "$1M-$5M", "$500k to $2M", "between $1M and $5M"
    let priceMin = "", priceMax = "";
    const rangeMatch = text.match(/\$\s*([\d.]+[mkMK]?)\s*[-–to]+\s*\$?\s*([\d.]+[mkMK]?)/);
    if (rangeMatch) {
        priceMin = parsePrice(rangeMatch[1]);
        priceMax = parsePrice(rangeMatch[2]);
    } else {
        const singlePrice = text.match(/\$\s*([\d.]+[mkMK]?)\s*(?:max|budget|cap)?/);
        if (singlePrice) priceMax = parsePrice(singlePrice[1]);
    }

    // Size range: "5k-20k sqft", "5,000 - 20,000 sf"
    let sizeMin = "", sizeMax = "";
    const sizeRange = text.match(/([\d,.]+[kK]?)\s*[-–to]+\s*([\d,.]+[kK]?)\s*(?:sq\s*ft|sf|square)/i);
    if (sizeRange) {
        sizeMin = parseSize(sizeRange[1]);
        sizeMax = parseSize(sizeRange[2]);
    }

    // Special criteria: anything after "special:", "criteria:", "notes:", or "must have"
    let specialCriteria = "";
    const specialMatch = text.match(/(?:special|criteria|notes|must\s*have|requirement)[:\s]+(.+?)(?:$)/i);
    if (specialMatch) specialCriteria = specialMatch[1].trim();

    return {
        name,
        email,
        propertyType: detectPropertyType(text),
        transactionType: detectTransactionType(text),
        location: detectLocation(text),
        priceMin,
        priceMax,
        sizeMin,
        sizeMax,
        specialCriteria,
    };
}

function parseEditFromText(text: string, existingClientName: string): Record<string, string> {
    const edits: Record<string, string> = {};
    edits.clientName = existingClientName;

    const lower = text.toLowerCase();

    // Property type change
    const typeMatch = lower.match(/(?:type|to|switch\s*to|change\s*to)\s+(strip|retail|warehouse|industrial|multifamily|apartment|office|mechanic|auto|residential|commercial|land)/i);
    if (typeMatch) edits.propertyType = detectPropertyType(typeMatch[1]);

    // Location change
    const locMatch = text.match(/(?:location|area|zone|move\s*to|switch\s*to)\s+([A-Z][a-zA-Z\s]+?)(?:\s*,|\s*$)/);
    if (locMatch) edits.location = locMatch[1].trim();
    else {
        const detectedLoc = detectLocation(text.replace(new RegExp(existingClientName, "gi"), ""));
        if (detectedLoc) edits.location = detectedLoc;
    }

    // Price changes: "budget to $3M", "max $5M", "raise price to $2M", "lower min to $500k"
    const maxMatch = text.match(/(?:max|budget|cap|price\s*max|raise.*?to|bump.*?to)\s*\$?\s*([\d.]+[mkMK]?)/i);
    if (maxMatch) edits.priceMax = parsePrice(maxMatch[1]);
    const minMatch = text.match(/(?:min|floor|price\s*min|lower.*?to)\s*\$?\s*([\d.]+[mkMK]?)/i);
    if (minMatch) edits.priceMin = parsePrice(minMatch[1]);

    // If just a single price mentioned with "to", treat as priceMax
    if (!edits.priceMax && !edits.priceMin) {
        const genericPrice = text.match(/(?:to|at)\s+\$\s*([\d.]+[mkMK]?)/i);
        if (genericPrice) edits.priceMax = parsePrice(genericPrice[1]);
    }

    // Size changes
    const sizeMaxMatch = text.match(/(?:size\s*max|max\s*size|up\s*to)\s*([\d,.]+[kK]?)\s*(?:sq|sf)?/i);
    if (sizeMaxMatch) edits.sizeMax = parseSize(sizeMaxMatch[1]);
    const sizeMinMatch = text.match(/(?:size\s*min|min\s*size|at\s*least)\s*([\d,.]+[kK]?)\s*(?:sq|sf)?/i);
    if (sizeMinMatch) edits.sizeMin = parseSize(sizeMinMatch[1]);

    // Special criteria
    const specialMatch = text.match(/(?:special|criteria|notes|add\s*note)[:\s]+(.+?)(?:$)/i);
    if (specialMatch) edits.specialCriteria = specialMatch[1].trim();

    // Email change
    const emailMatch = text.match(/[\w.+-]+@[\w.-]+\.\w+/);
    if (emailMatch) edits.email = emailMatch[0];

    return edits;
}

export async function POST(req: Request) {
    try {
        const auth = await requireAgent();
        if (auth.error) return auth.error;
        const agentId = auth.agentId;

        const body = await req.json();
        const { prompt } = body;

        if (!prompt) {
            return NextResponse.json({ error: "Missing command." }, { status: 400 });
        }

        console.log("[Command Center] Received:", prompt);

        // ═══ STEP 1: CLASSIFY INTENT (deterministic — no AI) ═══
        const { intent, clientName } = classifyIntent(prompt);
        console.log(`[Command Center] Intent: ${intent}, Client: ${clientName || "N/A"}`);

        // ═══ STEP 2: EXECUTE INTENT (all scoped to authenticated agent) ═══
        switch (intent) {

            // ─── ADD CLIENT (deterministic regex parser) ───
            case "add": {
                const analysis = parseBuyBoxFromText(prompt);

                if (!analysis.name) {
                    return NextResponse.json({ intent: "add", success: false, message: "Could not identify the client's name. Try: 'Add [Name], [property type], [location], [price range]'" });
                }

                const now = new Date().toISOString();
                const buyBoxJson = {
                    name: analysis.name,
                    propertyType: analysis.propertyType || "Commercial",
                    transactionType: analysis.transactionType || "Buy",
                    location: analysis.location || "Any Location",
                    priceMin: analysis.priceMin || "",
                    priceMax: analysis.priceMax || "",
                    sizeMin: analysis.sizeMin || "",
                    sizeMax: analysis.sizeMax || "",
                    specialCriteria: analysis.specialCriteria || "",
                };

                const fields: any = { buy_box_json: buyBoxJson, updated_at: now };
                if (analysis.email) fields.email = analysis.email;

                const { data: existing, error: findError } = await supabaseAdmin
                    .from('clients')
                    .select('id')
                    .eq('name', analysis.name)
                    .eq('agent_id', agentId)
                    .maybeSingle();

                if (findError) throw findError;

                let savedClient;
                if (existing) {
                    const { data, error } = await supabaseAdmin
                        .from('clients')
                        .update(fields)
                        .eq('id', existing.id)
                        .select()
                        .single();
                    if (error) throw error;
                    savedClient = data;
                } else {
                    const { data, error } = await supabaseAdmin
                        .from('clients')
                        .insert({ name: analysis.name, agent_id: agentId, ...fields })
                        .select()
                        .single();
                    if (error) throw error;
                    savedClient = data;
                }

                return NextResponse.json({
                    intent: "add",
                    success: true,
                    message: `${analysis.name} has been locked into the 7:00 AM Deal Flow.`,
                    client: savedClient,
                });
            }

            // ─── EDIT CLIENT (deterministic regex parser) ───
            case "edit": {
                const edits = parseEditFromText(prompt, clientName);
                const targetName = edits.clientName || clientName;

                if (!targetName) {
                    return NextResponse.json({ intent: "edit", success: false, message: "Could not identify which client to edit." });
                }

                const { data: existing } = await supabaseAdmin
                    .from('clients')
                    .select('*')
                    .ilike('name', `%${targetName}%`)
                    .eq('agent_id', agentId)
                    .limit(1);

                if (!existing || existing.length === 0) {
                    return NextResponse.json({ intent: "edit", success: false, message: `Client "${targetName}" not found.` });
                }

                const client = existing[0];
                const updatedBuyBox = { ...client.buy_box_json };
                if (edits.propertyType) updatedBuyBox.propertyType = edits.propertyType;
                if (edits.location) updatedBuyBox.location = edits.location;
                if (edits.priceMin !== undefined && edits.priceMin !== "") updatedBuyBox.priceMin = edits.priceMin;
                if (edits.priceMax !== undefined && edits.priceMax !== "") updatedBuyBox.priceMax = edits.priceMax;
                if (edits.sizeMin) updatedBuyBox.sizeMin = edits.sizeMin;
                if (edits.sizeMax) updatedBuyBox.sizeMax = edits.sizeMax;
                if (edits.specialCriteria) updatedBuyBox.specialCriteria = edits.specialCriteria;

                const updatePayload: any = { buy_box_json: updatedBuyBox, updated_at: new Date().toISOString() };
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
                    client: updated?.[0] || client,
                });
            }

            // ─── DELETE CLIENT (no AI needed) ───
            case "delete": {
                if (!clientName) {
                    return NextResponse.json({ intent: "delete", success: false, message: "Could not identify which client to remove." });
                }

                const { data: found } = await supabaseAdmin
                    .from('clients')
                    .select('id, name')
                    .ilike('name', `%${clientName}%`)
                    .eq('agent_id', agentId)
                    .limit(1);

                if (!found || found.length === 0) {
                    return NextResponse.json({ intent: "delete", success: false, message: `Client "${clientName}" not found.` });
                }

                const { error } = await supabaseAdmin
                    .from('clients')
                    .delete()
                    .eq('id', found[0].id);

                if (error) throw error;

                // DB cascades ai_analyses + deal_matches via FK, but storage
                // is out-of-band — prune the brief file + manifest here so we
                // don't leak orphaned JSON in the briefs bucket (DI-3).
                try {
                    await removeClientFromBriefs(agentId, found[0].id);
                } catch (storageErr: any) {
                    console.warn(
                        `[Command Center] Brief cleanup failed for ${found[0].id}:`,
                        storageErr?.message,
                    );
                }

                return NextResponse.json({
                    intent: "delete",
                    success: true,
                    message: `${found[0].name} has been removed from the Deal Flow.`,
                    deletedName: found[0].name,
                });
            }

            // ─── QUERY CLIENT (no AI needed) ───
            case "query": {
                if (!clientName) {
                    return NextResponse.json({ intent: "query", success: false, message: "Could not identify which client to query." });
                }

                const { data: clients } = await supabaseAdmin
                    .from('clients')
                    .select('*')
                    .ilike('name', `%${clientName}%`)
                    .eq('agent_id', agentId)
                    .limit(1);

                if (!clients || clients.length === 0) {
                    return NextResponse.json({ intent: "query", success: false, message: `Client "${clientName}" not found.` });
                }

                const client = clients[0];
                const bb = client.buy_box_json || {};

                const { data: analyses } = await supabaseAdmin
                    .from('ai_analyses')
                    .select('property_id, ai_score, ai_reason')
                    .eq('client_id', client.id)
                    .order('ai_score', { ascending: false })
                    .limit(5);

                return NextResponse.json({
                    intent: "query",
                    success: true,
                    message: `${client.name}: ${bb.propertyType || "Commercial"} in ${bb.location || "Any Location"}, ${bb.priceMin ? "$" + (parseInt(bb.priceMin) / 1000000).toFixed(1) + "M" : "$0"} – ${bb.priceMax ? "$" + (parseInt(bb.priceMax) / 1000000).toFixed(1) + "M" : "No Max"}`,
                    client,
                    recentMatches: analyses || [],
                });
            }

            // ─── BLAST (no AI needed) ───
            case "blast": {
                try {
                    const rawUrl = process.env.NEXT_PUBLIC_APP_URL || "";
                    const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
                    const appUrl = (rawUrl && !rawUrl.includes("localhost")) ? rawUrl : (vercelUrl || "https://opulentus.vercel.app");

                    const blastRes = await fetch(`${appUrl}/api/cron/daily-blast`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                    });
                    const blastResult = await blastRes.json();

                    return NextResponse.json({
                        intent: "blast",
                        success: true,
                        message: `Daily Blast fired! ${blastResult.totalDealsRouted || 0} deals routed across ${blastResult.clientsMatched || 0} clients.`,
                        details: blastResult,
                    });
                } catch (blastErr: any) {
                    return NextResponse.json({ intent: "blast", success: false, message: `Blast trigger failed: ${blastErr.message}` });
                }
            }

            // ─── SEARCH (no AI needed) ───
            case "search":
            default:
                return NextResponse.json({
                    intent: "search",
                    success: true,
                    searchQuery: prompt,
                    message: `Searching: "${prompt}"`,
                });
        }

    } catch (error: any) {
        console.error("Command Center Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
