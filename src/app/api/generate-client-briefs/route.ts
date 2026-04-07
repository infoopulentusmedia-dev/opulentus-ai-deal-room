import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { generateAnalysis } from "@/lib/gemini/client";
import { checkTaxIncentives } from "@/app/api/tax-incentive-check/route";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CRON_SECRET = process.env.CRON_SECRET || "";

const BRIEF_SYSTEM = `You are an elite Commercial Real Estate Acquisitions Director for Opulentus Private Wealth.
A client's "Buy Box" criteria and a filtered set of properties will be provided. Your job is to:

1. Rank the properties by relevance to the client's Buy Box.
2. For each property, assign a matchScore (0-100), write a 2-3 sentence reasoning, and list any redFlags.
3. If ZERO properties match, find 1-3 "nearMisses" — properties that ALMOST matched but missed on one dimension.

Return JSON matching this schema:
{
    "briefing": "1-2 sentence summary tailored to this specific client.",
    "curatedProperties": [
        {
            "sourceId": "CRX-123 or LN-123 or MLS-123456",
            "reasoning": "Fits because...",
            "matchScore": 95,
            "redFlags": ["High vacancy"]
        }
    ],
    "nearMisses": [
        {
            "sourceId": "CRX-456",
            "whyItAlmostMatched": "...",
            "suggestion": "Consider offering..."
        }
    ]
}`;

interface ClientRecord {
    id: string;
    name: string;
    email: string | null;
    buy_box_json: any;
}

// ---------------------------------------------------------------------------
// Pre-filter: score properties against a client's buy box and return top 30
// ---------------------------------------------------------------------------
function preFilterProperties(properties: any[], buyBox: any): any[] {
    if (!buyBox) return properties.slice(0, 30);

    const location = (buyBox.location || "").toLowerCase();
    const propType = (buyBox.propertyType || "").toLowerCase();
    const priceMax = parseInt(buyBox.priceMax) || Infinity;
    const priceMin = parseInt(buyBox.priceMin) || 0;

    const locationKeywords = location
        .split(/[,|/&]+/)
        .map((s: string) => s.trim().replace(/\bcounty\b/i, "").trim())
        .filter(Boolean);

    const scored = properties.map(p => {
        let score = 0;
        const pData = p.property_data_json || p;
        const pType = (pData.propertyType || p.property_type || "").toLowerCase();
        const pCity = (pData.city || "").toLowerCase();
        const pState = (pData.state || "").toLowerCase();
        const pZip = pData.zipCode || pData.zip_code || "";
        const pPrice = typeof pData.price === "number" ? pData.price : (typeof p.price === "number" ? p.price : null);

        // Type match (fuzzy)
        if (propType && pType) {
            if (pType.includes(propType) || propType.includes(pType)) score += 40;
            const typeAliases: Record<string, string[]> = {
                "retail": ["retail", "strip", "plaza", "shopping"],
                "industrial": ["industrial", "warehouse", "manufacturing", "flex"],
                "office": ["office", "professional", "medical office"],
                "residential": ["residential", "single", "multi", "duplex", "house", "home"],
                "auto": ["auto", "mechanic", "collision", "car wash", "gas station"],
                "land": ["land", "lot", "acreage", "vacant"],
            };
            for (const [, aliases] of Object.entries(typeAliases)) {
                if (aliases.some(a => propType.includes(a)) && aliases.some(a => pType.includes(a))) {
                    score += 30;
                    break;
                }
            }
        }

        // Location match
        if (locationKeywords.length > 0) {
            for (const kw of locationKeywords) {
                if (pCity && (pCity.includes(kw) || kw.includes(pCity))) score += 25;
                if (pZip && pZip === kw) score += 30;
                if (pState && pState.includes(kw)) score += 5;
            }
        }

        // Price match
        if (pPrice !== null && pPrice > 0) {
            if (pPrice >= priceMin && pPrice <= priceMax) score += 20;
            else if (pPrice <= priceMax * 1.3 && pPrice >= priceMin * 0.7) score += 10;
        }

        return { property: p, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.filter(s => s.score > 0).slice(0, 30).map(s => s.property);
}

// ---------------------------------------------------------------------------
// Supabase Storage helpers
// ---------------------------------------------------------------------------
async function uploadBrief(fileName: string, data: any): Promise<void> {
    const body = JSON.stringify(data);

    // Try PUT (update) first, fall back to POST (create)
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/briefs/${fileName}.json`, {
        method: "PUT",
        headers: {
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
        },
        body,
    });

    if (!res.ok) {
        const res2 = await fetch(`${SUPABASE_URL}/storage/v1/object/briefs/${fileName}.json`, {
            method: "POST",
            headers: {
                "apikey": SUPABASE_KEY,
                "Authorization": `Bearer ${SUPABASE_KEY}`,
                "Content-Type": "application/json",
            },
            body,
        });
        if (!res2.ok) {
            const text = await res2.text();
            throw new Error(`Storage upload failed for ${fileName}: ${res2.status} ${text}`);
        }
    }
}

async function readManifest(): Promise<any> {
    try {
        const res = await fetch(`${SUPABASE_URL}/storage/v1/object/public/briefs/manifest.json?t=${Date.now()}`, {
            cache: "no-store",
        });
        if (!res.ok) return { clientIds: [], clientNames: {} };
        return await res.json();
    } catch {
        return { clientIds: [], clientNames: {} };
    }
}

async function deleteBriefFile(fileName: string): Promise<void> {
    try {
        await fetch(`${SUPABASE_URL}/storage/v1/object/briefs/${fileName}.json`, {
            method: "DELETE",
            headers: {
                "apikey": SUPABASE_KEY,
                "Authorization": `Bearer ${SUPABASE_KEY}`,
            },
        });
    } catch {
        // Non-fatal: orphan files are harmless
    }
}

// ---------------------------------------------------------------------------
// Gemini call with retry + fallback
// ---------------------------------------------------------------------------
async function callGeminiWithRetry(systemPrompt: string, userPrompt: string, retries = 2): Promise<any> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            if (attempt > 0) {
                // Exponential backoff: 2s, 4s
                await new Promise(r => setTimeout(r, 2000 * attempt));
            }
            return await generateAnalysis(systemPrompt, userPrompt);
        } catch (err: any) {
            lastError = err;
            console.warn(`[Brief Gen] Gemini attempt ${attempt + 1} failed: ${err.message}`);
        }
    }
    throw lastError || new Error("Gemini failed after retries");
}

// ---------------------------------------------------------------------------
// Generate brief for a single client
// ---------------------------------------------------------------------------
async function generateBriefForClient(client: ClientRecord, allProperties: any[]): Promise<any> {
    const buyBox = client.buy_box_json || {};
    const filtered = preFilterProperties(allProperties, buyBox);

    const result: any = {
        clientId: client.id,
        clientName: client.name,
        generatedAt: new Date().toISOString(),
        scanDate: new Date().toISOString().split("T")[0],
        briefing: "",
        matchCount: 0,
        properties: [],
        nearMisses: [],
    };

    if (filtered.length === 0) {
        result.briefing = `No active listings matching ${client.name}'s criteria today. We'll keep scanning Crexi, LoopNet, and MLS around the clock.`;
        return result;
    }

    const feedForAI = filtered.map(p => p.property_data_json || p);

    try {
        const promptPayload = `
Client: ${client.name}
Buy Box Criteria:
- Type: ${buyBox.propertyType || "Any"}
- Transaction: ${buyBox.transactionType || "Any"}
- Location: ${buyBox.location || "Any"}
- Min Price: ${buyBox.priceMin || "None"}
- Max Price: ${buyBox.priceMax || "None"}
- Min Size: ${buyBox.sizeMin || "None"}
- Max Size: ${buyBox.sizeMax || "None"}
- Special: ${buyBox.specialCriteria || "None"}

Filtered Property Feed (${feedForAI.length} properties):
${JSON.stringify(feedForAI, null, 2)}
`;

        const aiAnalysis = await callGeminiWithRetry(BRIEF_SYSTEM, promptPayload);

        const curatedProperties = (aiAnalysis.curatedProperties || []).map((ai: any) => {
            const rawProp = feedForAI.find((p: any) => p.sourceId === ai.sourceId);
            if (!rawProp) return null;
            const taxResult = checkTaxIncentives(rawProp.zipCode || "");
            return {
                ...rawProp,
                aiReasoning: ai.reasoning,
                aiMatchScore: ai.matchScore,
                aiRedFlags: ai.redFlags || [],
                taxIncentives: taxResult,
            };
        }).filter(Boolean);

        const nearMisses = (aiAnalysis.nearMisses || []).map((nm: any) => {
            const rawProp = feedForAI.find((p: any) => p.sourceId === nm.sourceId);
            return {
                ...(rawProp || {}),
                whyItAlmostMatched: nm.whyItAlmostMatched,
                suggestion: nm.suggestion,
            };
        });

        result.briefing = aiAnalysis.briefing || `Found ${curatedProperties.length} properties matching ${client.name}'s criteria.`;
        result.matchCount = curatedProperties.length;
        result.properties = curatedProperties;
        result.nearMisses = nearMisses;
    } catch (err: any) {
        console.error(`[Brief Gen] Gemini failed for ${client.name} after retries:`, err.message);
        // Fallback: show pre-filtered properties with basic scoring
        result.briefing = `Found ${Math.min(filtered.length, 5)} properties that may match ${client.name}'s criteria. AI analysis temporarily unavailable.`;
        result.properties = filtered.slice(0, 5).map(p => {
            const d = p.property_data_json || p;
            return { ...d, aiMatchScore: 70, aiReasoning: "Matched based on location and property type criteria." };
        });
        result.matchCount = result.properties.length;
    }

    return result;
}

// ---------------------------------------------------------------------------
// Load recent properties (last 7 days of scans, not entire table)
// ---------------------------------------------------------------------------
async function loadRecentProperties(): Promise<any[]> {
    // First try: get property IDs from recent daily_scans (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const { data: recentScans, error: scanErr } = await supabaseAdmin
        .from("daily_scans")
        .select("property_ids")
        .gte("date", sevenDaysAgo)
        .order("date", { ascending: false })
        .limit(7);

    if (scanErr || !recentScans || recentScans.length === 0) {
        // Fallback: load most recent 500 properties directly
        console.warn("[Brief Gen] No recent scans found, falling back to direct property load");
        const { data: props } = await supabaseAdmin
            .from("properties")
            .select("id, platform, address, price, property_type, property_data_json")
            .order("id", { ascending: false })
            .limit(500);
        return props || [];
    }

    // Collect unique property IDs from recent scans
    const allIds = new Set<string>();
    for (const scan of recentScans) {
        if (Array.isArray(scan.property_ids)) {
            for (const id of scan.property_ids) allIds.add(id);
        }
    }

    if (allIds.size === 0) {
        return [];
    }

    // Fetch property data for these IDs (batch in chunks of 200 to avoid URL limits)
    const idArray = Array.from(allIds);
    const allProperties: any[] = [];

    for (let i = 0; i < idArray.length; i += 200) {
        const chunk = idArray.slice(i, i + 200);
        const { data: props } = await supabaseAdmin
            .from("properties")
            .select("id, platform, address, price, property_type, property_data_json")
            .in("id", chunk);
        if (props) allProperties.push(...props);
    }

    return allProperties;
}

// ---------------------------------------------------------------------------
// MAIN: Generate briefs for all clients or a single client
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
    try {
        // Auth check: if CRON_SECRET is configured, require it via header or query param
        // This prevents unauthorized external calls to this expensive endpoint
        if (CRON_SECRET) {
            const headerSecret = req.headers.get("x-cron-secret") || "";
            const { searchParams: authParams } = new URL(req.url);
            const querySecret = authParams.get("secret") || "";
            // Also allow Vercel's built-in cron authorization header
            const vercelCron = req.headers.get("authorization") === `Bearer ${CRON_SECRET}`;
            if (headerSecret !== CRON_SECRET && querySecret !== CRON_SECRET && !vercelCron) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
        }

        const { searchParams } = new URL(req.url);
        const singleClientId = searchParams.get("clientId");

        // 1. Load clients
        let clients: ClientRecord[] = [];
        if (singleClientId) {
            const { data, error } = await supabaseAdmin
                .from("clients")
                .select("id, name, email, buy_box_json")
                .eq("id", singleClientId)
                .single();
            if (error || !data) {
                return NextResponse.json({ error: "Client not found" }, { status: 404 });
            }
            clients = [data];
        } else {
            const { data, error } = await supabaseAdmin
                .from("clients")
                .select("id, name, email, buy_box_json");
            if (error || !data) {
                return NextResponse.json({ error: "Failed to load clients" }, { status: 500 });
            }
            clients = data;
        }

        if (clients.length === 0) {
            return NextResponse.json({ success: true, message: "No clients to generate briefs for." });
        }

        // 2. Load RECENT properties (last 7 days, not the entire table)
        const allProperties = await loadRecentProperties();
        console.log(`[Brief Gen] Loaded ${allProperties.length} recent properties, generating briefs for ${clients.length} client(s)`);

        // 3. Generate briefs sequentially (respect Gemini rate limits)
        const results: Record<string, any> = {};
        for (const client of clients) {
            try {
                console.log(`[Brief Gen] Processing ${client.name}...`);
                const brief = await generateBriefForClient(client, allProperties);
                results[client.id] = brief;
                await uploadBrief(client.id, brief);
                console.log(`[Brief Gen] Stored brief for ${client.name}: ${brief.matchCount} matches`);
            } catch (err: any) {
                console.error(`[Brief Gen] Failed for ${client.name}:`, err.message);
                results[client.id] = {
                    clientId: client.id,
                    clientName: client.name,
                    generatedAt: new Date().toISOString(),
                    scanDate: new Date().toISOString().split("T")[0],
                    briefing: `Brief generation failed for ${client.name}. Will retry on next cycle.`,
                    matchCount: 0,
                    properties: [],
                    nearMisses: [],
                    error: err.message,
                };
            }
        }

        // 4. Update manifest — MERGE with existing manifest, don't overwrite
        const existingManifest = await readManifest();
        const existingClientIds: string[] = existingManifest.clientIds || [];
        const existingNames: Record<string, string> = existingManifest.clientNames || {};

        if (singleClientId) {
            // Single client: ADD to existing manifest, don't replace
            const mergedIds = Array.from(new Set([...existingClientIds, singleClientId]));
            const mergedNames = { ...existingNames };
            for (const c of clients) mergedNames[c.id] = c.name;

            await uploadBrief("manifest", {
                generatedAt: existingManifest.generatedAt || new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                clientIds: mergedIds,
                clientNames: mergedNames,
            });
        } else {
            // Full generation: rebuild manifest from current clients
            // Also clean up orphaned brief files from deleted clients
            const currentIds = new Set(clients.map(c => c.id));
            const orphanedIds = existingClientIds.filter((id: string) => !currentIds.has(id));
            for (const orphanId of orphanedIds) {
                console.log(`[Brief Gen] Cleaning up orphaned brief for deleted client: ${orphanId}`);
                await deleteBriefFile(orphanId);
            }

            await uploadBrief("manifest", {
                generatedAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                clientIds: clients.map(c => c.id),
                clientNames: Object.fromEntries(clients.map(c => [c.id, c.name])),
            });
        }

        return NextResponse.json({
            success: true,
            generated: clients.length,
            results: Object.fromEntries(
                Object.entries(results).map(([id, r]: [string, any]) => [id, { matchCount: r.matchCount, error: r.error }])
            ),
        });
    } catch (err: any) {
        console.error("[Brief Gen] Error:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function GET(req: Request) {
    return POST(req);
}
