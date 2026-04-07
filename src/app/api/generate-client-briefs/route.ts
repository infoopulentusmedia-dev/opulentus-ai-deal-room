import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { generateAnalysis } from "@/lib/gemini/client";
import { checkTaxIncentives } from "@/app/api/tax-incentive-check/route";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

// Pre-filter properties to those roughly matching a client's buy box
function preFilterProperties(properties: any[], buyBox: any): any[] {
    if (!buyBox) return properties.slice(0, 30);

    const location = (buyBox.location || "").toLowerCase();
    const propType = (buyBox.propertyType || "").toLowerCase();
    const priceMax = parseInt(buyBox.priceMax) || Infinity;
    const priceMin = parseInt(buyBox.priceMin) || 0;

    // Extract location keywords (cities, counties, zips)
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
            // Broad category matching
            const typeAliases: Record<string, string[]> = {
                "retail": ["retail", "strip", "plaza", "shopping"],
                "industrial": ["industrial", "warehouse", "manufacturing", "flex"],
                "office": ["office", "professional", "medical office"],
                "residential": ["residential", "single", "multi", "duplex", "house", "home"],
                "auto": ["auto", "mechanic", "collision", "car wash", "gas station"],
            };
            for (const [category, aliases] of Object.entries(typeAliases)) {
                if (aliases.some(a => propType.includes(a)) && aliases.some(a => pType.includes(a))) {
                    score += 30;
                    break;
                }
            }
        }

        // Location match
        if (locationKeywords.length > 0) {
            for (const kw of locationKeywords) {
                if (pCity.includes(kw) || kw.includes(pCity)) score += 25;
                if (pZip === kw) score += 30;
                if (pState.includes(kw)) score += 5;
            }
        }

        // Price match
        if (pPrice !== null) {
            if (pPrice >= priceMin && pPrice <= priceMax) score += 20;
            // Allow 30% over budget as near misses
            else if (pPrice <= priceMax * 1.3 && pPrice >= priceMin * 0.7) score += 10;
        }

        return { property: p, score };
    });

    // Sort by score descending, take top 30
    scored.sort((a, b) => b.score - a.score);
    return scored.filter(s => s.score > 0).slice(0, 30).map(s => s.property);
}

async function uploadBrief(clientId: string, data: any): Promise<void> {
    const body = JSON.stringify(data);
    const path = `briefs/${clientId}.json`;

    // Try update first, fall back to insert
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/briefs/${clientId}.json`, {
        method: "PUT",
        headers: {
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
        },
        body,
    });

    if (!res.ok) {
        // May not exist yet, try POST
        const res2 = await fetch(`${SUPABASE_URL}/storage/v1/object/briefs/${clientId}.json`, {
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
            throw new Error(`Storage upload failed: ${res2.status} ${text}`);
        }
    }
}

async function generateBriefForClient(client: ClientRecord, allProperties: any[]): Promise<any> {
    const buyBox = client.buy_box_json || {};
    const filtered = preFilterProperties(allProperties, buyBox);

    // Build result even if no AI available
    const result: any = {
        clientId: client.id,
        clientName: client.name,
        generatedAt: new Date().toISOString(),
        briefing: "",
        matchCount: 0,
        properties: [],
        nearMisses: [],
    };

    if (filtered.length === 0) {
        result.briefing = `No active listings matching ${client.name}'s criteria today. We'll keep scanning Crexi, LoopNet, and MLS around the clock.`;
        return result;
    }

    // Prepare feed for Claude — use property_data_json if available
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

        const aiAnalysis = await generateAnalysis(BRIEF_SYSTEM, promptPayload);

        // Map curated IDs back to full property objects
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
        console.error(`[Brief Gen] Claude failed for ${client.name}:`, err.message);
        // Fallback: use pre-filtered properties with basic scoring
        result.briefing = `Found ${Math.min(filtered.length, 5)} properties that may match ${client.name}'s criteria. AI analysis temporarily unavailable.`;
        result.properties = filtered.slice(0, 5).map(p => {
            const d = p.property_data_json || p;
            return { ...d, aiMatchScore: 70, aiReasoning: "Matched based on location and property type criteria." };
        });
        result.matchCount = result.properties.length;
    }

    return result;
}

// POST: Generate briefs for all clients (or one specific client)
// Called by daily cron or when a new client is added
export async function POST(req: Request) {
    try {
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

        // 2. Load all properties from Supabase
        const { data: properties, error: propErr } = await supabaseAdmin
            .from("properties")
            .select("id, platform, address, price, property_type, property_data_json");

        if (propErr) {
            console.error("[Brief Gen] Failed to load properties:", propErr);
            return NextResponse.json({ error: "Failed to load properties" }, { status: 500 });
        }

        const allProperties = properties || [];
        console.log(`[Brief Gen] Loaded ${allProperties.length} properties, generating briefs for ${clients.length} client(s)`);

        // 3. Generate briefs for each client (sequentially to avoid rate limits)
        const results: Record<string, any> = {};
        for (const client of clients) {
            try {
                console.log(`[Brief Gen] Processing ${client.name}...`);
                const brief = await generateBriefForClient(client, allProperties);
                results[client.id] = brief;

                // 4. Upload to Supabase Storage
                await uploadBrief(client.id, brief);
                console.log(`[Brief Gen] Stored brief for ${client.name}: ${brief.matchCount} matches`);
            } catch (err: any) {
                console.error(`[Brief Gen] Failed for ${client.name}:`, err.message);
                results[client.id] = {
                    clientId: client.id,
                    clientName: client.name,
                    briefing: `Brief generation failed for ${client.name}. Will retry on next cycle.`,
                    matchCount: 0,
                    properties: [],
                    nearMisses: [],
                    error: err.message,
                };
            }
        }

        // 5. Upload manifest (index of all briefs)
        const manifest = {
            generatedAt: new Date().toISOString(),
            clientIds: clients.map(c => c.id),
            clientNames: Object.fromEntries(clients.map(c => [c.id, c.name])),
        };
        await uploadBrief("manifest", manifest);

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

// Also support GET for manual trigger
export async function GET(req: Request) {
    return POST(req);
}
