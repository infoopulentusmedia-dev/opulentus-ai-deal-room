import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { analyzePropertiesForClient } from "@/lib/matching/engine";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CRON_SECRET = process.env.CRON_SECRET || "";

// Vercel function timeout safety margin (bail 30s before hard kill)
const MAX_DURATION_MS = 270_000;

interface ClientRecord {
    id: string;
    name: string;
    email: string | null;
    buy_box_json: any;
}

// ---------------------------------------------------------------------------
// Supabase Storage helpers
// ---------------------------------------------------------------------------
async function uploadBrief(fileName: string, data: any): Promise<void> {
    const body = JSON.stringify(data);

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
        // Non-fatal
    }
}

// ---------------------------------------------------------------------------
// Load recent properties (last 7 days of scans)
// ---------------------------------------------------------------------------
async function loadRecentProperties(): Promise<any[]> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const { data: recentScans, error: scanErr } = await supabaseAdmin
        .from("daily_scans")
        .select("property_ids")
        .gte("date", sevenDaysAgo)
        .order("date", { ascending: false })
        .limit(7);

    if (scanErr || !recentScans || recentScans.length === 0) {
        console.warn("[Brief Gen] No recent scans found, falling back to direct property load");
        const { data: props } = await supabaseAdmin
            .from("properties")
            .select("id, platform, address, price, property_type, property_data_json")
            .order("id", { ascending: false })
            .limit(500);
        return (props || []).filter(p => p.property_data_json != null);
    }

    const allIds = new Set<string>();
    for (const scan of recentScans) {
        if (Array.isArray(scan.property_ids)) {
            for (const id of scan.property_ids) allIds.add(id);
        }
    }

    if (allIds.size === 0) return [];

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

    return allProperties.filter(p => p.property_data_json != null);
}

// ---------------------------------------------------------------------------
// MAIN: Generate briefs for all clients or a single client
// Zero Gemini API calls. Pure algorithmic matching.
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
    const startTime = Date.now();

    try {
        // Auth check
        if (CRON_SECRET) {
            const headerSecret = req.headers.get("x-cron-secret") || "";
            const { searchParams: authParams } = new URL(req.url);
            const querySecret = authParams.get("secret") || "";
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

        // 2. Load recent properties
        const allProperties = await loadRecentProperties();
        console.log(`[Brief Gen] Loaded ${allProperties.length} recent properties for ${clients.length} client(s) — using deterministic engine (no AI calls)`);

        // ZERO-SCRAPE PROTECTION
        if (allProperties.length === 0 && !singleClientId) {
            console.warn("[Brief Gen] ZERO properties loaded — preserving existing briefs.");
            return NextResponse.json({
                success: true,
                generated: 0,
                skipped: true,
                reason: "Zero properties available — preserving existing briefs.",
                durationMs: Date.now() - startTime,
            });
        }

        // 3. Generate briefs — DETERMINISTIC, no API calls, instant per client
        const results: Record<string, any> = {};
        let timedOut = false;

        for (let i = 0; i < clients.length; i++) {
            const client = clients[i];

            // Timeout guard (extremely unlikely since no API calls, but safety first)
            const elapsed = Date.now() - startTime;
            if (elapsed > MAX_DURATION_MS) {
                console.warn(`[Brief Gen] Approaching timeout at ${i}/${clients.length} clients.`);
                timedOut = true;
                for (let j = i; j < clients.length; j++) {
                    results[clients[j].id] = { matchCount: null, skipped: true };
                }
                break;
            }

            try {
                console.log(`[Brief Gen] Matching ${client.name} (${i + 1}/${clients.length})...`);

                // === THE KEY CHANGE: Pure algorithmic matching, no Gemini ===
                const brief = analyzePropertiesForClient(
                    client.id,
                    client.name,
                    client.buy_box_json || {},
                    allProperties,
                );

                results[client.id] = brief;

                // Upload to storage
                try {
                    await uploadBrief(client.id, brief);
                    console.log(`[Brief Gen] Stored brief for ${client.name}: ${brief.matchCount} matches, ${brief.nearMisses.length} near-misses`);
                } catch (uploadErr: any) {
                    console.error(`[Brief Gen] Upload failed for ${client.name}, retrying...`);
                    try {
                        await new Promise(r => setTimeout(r, 1000));
                        await uploadBrief(client.id, brief);
                    } catch (retryErr: any) {
                        console.error(`[Brief Gen] Upload retry failed for ${client.name}:`, retryErr.message);
                    }
                }
            } catch (err: any) {
                console.error(`[Brief Gen] Failed for ${client.name}:`, err.message);
                const errorBrief = {
                    clientId: client.id,
                    clientName: client.name,
                    generatedAt: new Date().toISOString(),
                    scanDate: new Date().toISOString().split("T")[0],
                    briefing: `Brief generation temporarily unavailable for ${client.name}. Will retry on next cycle.`,
                    matchCount: 0,
                    properties: [],
                    nearMisses: [],
                    error: err.message,
                };
                results[client.id] = errorBrief;
                try { await uploadBrief(client.id, errorBrief); } catch { /* non-fatal */ }
            }
        }

        // 4. Update manifest
        const existingManifest = await readManifest();
        const existingClientIds: string[] = existingManifest.clientIds || [];
        const existingNames: Record<string, string> = existingManifest.clientNames || {};

        if (singleClientId) {
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
            const currentIds = new Set(clients.map(c => c.id));
            const orphanedIds = existingClientIds.filter((id: string) => !currentIds.has(id));
            for (const orphanId of orphanedIds) {
                console.log(`[Brief Gen] Cleaning up orphaned brief: ${orphanId}`);
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
            timedOut,
            engine: "deterministic", // Flag: no AI used
            durationMs: Date.now() - startTime,
            results: Object.fromEntries(
                Object.entries(results).map(([id, r]: [string, any]) => [id, {
                    matchCount: r.matchCount ?? 0,
                    nearMisses: r.nearMisses?.length ?? 0,
                    error: r.error,
                    skipped: r.skipped,
                }])
            ),
        });
    } catch (err: any) {
        console.error("[Brief Gen] Error:", err.message);
        return NextResponse.json({ error: err.message, durationMs: Date.now() - startTime }, { status: 500 });
    }
}

export async function GET(req: Request) {
    return POST(req);
}
