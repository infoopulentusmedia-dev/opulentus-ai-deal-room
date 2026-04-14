import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { analyzePropertiesForClient } from "@/lib/matching/engine";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CRON_SECRET = process.env.CRON_SECRET || "";

// Vercel function timeout safety margin (bail 30s before hard kill)
const MAX_DURATION_MS = 270_000;

// Process this many clients simultaneously. Matching is CPU-bound but
// uploads are I/O-bound, so batching 10 at a time is safe and ~10x faster.
const PARALLEL_BATCH_SIZE = 10;

interface ClientRecord {
    id: string;
    name: string;
    email: string | null;
    buy_box_json: any;
    agent_id: string | null;
}

// ---------------------------------------------------------------------------
// Supabase Storage helpers — scoped by agent
// ---------------------------------------------------------------------------
async function uploadBrief(path: string, data: any): Promise<void> {
    const body = JSON.stringify(data);

    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/briefs/${path}`, {
        method: "PUT",
        headers: {
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
        },
        body,
    });

    if (!res.ok) {
        const res2 = await fetch(`${SUPABASE_URL}/storage/v1/object/briefs/${path}`, {
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
            throw new Error(`Storage upload failed for ${path}: ${res2.status} ${text}`);
        }
    }
}

async function readManifest(agentId: string): Promise<any> {
    try {
        // Use authenticated endpoint (not public) since the bucket is private
        const res = await fetch(`${SUPABASE_URL}/storage/v1/object/briefs/${agentId}/manifest.json?t=${Date.now()}`, {
            headers: {
                "apikey": SUPABASE_KEY,
                "Authorization": `Bearer ${SUPABASE_KEY}`,
            },
            cache: "no-store",
        });
        if (!res.ok) return { clientIds: [], clientNames: {} };
        return await res.json();
    } catch {
        return { clientIds: [], clientNames: {} };
    }
}

async function deleteBriefFile(path: string): Promise<void> {
    try {
        await fetch(`${SUPABASE_URL}/storage/v1/object/briefs/${path}`, {
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
// Load recent properties (last 7 days of scans) — shared data
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
// Process a single client: match + upload brief
// ---------------------------------------------------------------------------
async function processClient(
    agentId: string,
    client: ClientRecord,
    allProperties: any[],
): Promise<{ id: string; brief: any }> {
    try {
        const brief = analyzePropertiesForClient(
            client.id,
            client.name,
            client.buy_box_json || {},
            allProperties,
        );

        // Upload to agent-scoped storage path
        const briefPath = `${agentId}/${client.id}.json`;
        try {
            await uploadBrief(briefPath, brief);
        } catch {
            // Retry once
            try {
                await new Promise(r => setTimeout(r, 500));
                await uploadBrief(briefPath, brief);
            } catch (retryErr: any) {
                console.error(`[Brief Gen] Upload retry failed for ${client.name}:`, retryErr.message);
            }
        }

        return { id: client.id, brief };
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
        try { await uploadBrief(`${agentId}/${client.id}.json`, errorBrief); } catch { /* non-fatal */ }
        return { id: client.id, brief: errorBrief };
    }
}

// ---------------------------------------------------------------------------
// Generate briefs for one agent's clients — PARALLEL batches
// ---------------------------------------------------------------------------
async function generateBriefsForAgent(
    agentId: string,
    clients: ClientRecord[],
    allProperties: any[],
    startTime: number,
    singleClientId: string | null,
): Promise<{ results: Record<string, any>; timedOut: boolean; processed: number }> {
    const results: Record<string, any> = {};
    let timedOut = false;
    let processed = 0;

    // Process clients in parallel batches of PARALLEL_BATCH_SIZE
    for (let batchStart = 0; batchStart < clients.length; batchStart += PARALLEL_BATCH_SIZE) {
        const elapsed = Date.now() - startTime;
        if (elapsed > MAX_DURATION_MS) {
            console.warn(`[Brief Gen] Approaching timeout at ${batchStart}/${clients.length} clients for agent ${agentId}.`);
            timedOut = true;
            for (let j = batchStart; j < clients.length; j++) {
                results[clients[j].id] = { matchCount: null, skipped: true };
            }
            break;
        }

        const batch = clients.slice(batchStart, batchStart + PARALLEL_BATCH_SIZE);
        console.log(`[Brief Gen] Agent ${agentId}: batch ${batchStart / PARALLEL_BATCH_SIZE + 1} (${batch.length} clients, ${batchStart + batch.length}/${clients.length} total)`);

        const batchResults = await Promise.allSettled(
            batch.map(client => processClient(agentId, client, allProperties))
        );

        for (const result of batchResults) {
            if (result.status === "fulfilled") {
                results[result.value.id] = result.value.brief;
                processed++;
            }
        }
    }

    // Update agent-scoped manifest
    const existingManifest = await readManifest(agentId);
    const existingClientIds: string[] = existingManifest.clientIds || [];
    const existingNames: Record<string, string> = existingManifest.clientNames || {};

    if (singleClientId) {
        const mergedIds = Array.from(new Set([...existingClientIds, singleClientId]));
        const mergedNames = { ...existingNames };
        for (const c of clients) mergedNames[c.id] = c.name;

        await uploadBrief(`${agentId}/manifest.json`, {
            generatedAt: existingManifest.generatedAt || new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            clientIds: mergedIds,
            clientNames: mergedNames,
        });
    } else {
        const currentIds = new Set(clients.map(c => c.id));
        const orphanedIds = existingClientIds.filter((id: string) => !currentIds.has(id));
        for (const orphanId of orphanedIds) {
            await deleteBriefFile(`${agentId}/${orphanId}.json`);
        }

        await uploadBrief(`${agentId}/manifest.json`, {
            generatedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            clientIds: clients.map(c => c.id),
            clientNames: Object.fromEntries(clients.map(c => [c.id, c.name])),
        });
    }

    return { results, timedOut, processed };
}

// ---------------------------------------------------------------------------
// MAIN: Generate briefs — Zero Gemini API calls. Pure algorithmic matching.
// Handles up to 300 clients (3 agents × 100) via parallel batching.
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
    const startTime = Date.now();

    try {
        // Auth check (cron secret)
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
        const singleAgentId = searchParams.get("agentId");

        // 1. Load properties (shared — done once for all agents)
        const allProperties = await loadRecentProperties();
        console.log(`[Brief Gen] Loaded ${allProperties.length} recent properties — using deterministic engine (no AI calls)`);

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

        let allResults: Record<string, any> = {};
        let totalGenerated = 0;
        let anyTimedOut = false;

        if (singleClientId && singleAgentId) {
            const { data, error } = await supabaseAdmin
                .from("clients")
                .select("id, name, email, buy_box_json, agent_id")
                .eq("id", singleClientId)
                .eq("agent_id", singleAgentId)
                .single();

            if (error || !data) {
                return NextResponse.json({ error: "Client not found" }, { status: 404 });
            }

            const { results, timedOut, processed } = await generateBriefsForAgent(
                singleAgentId, [data], allProperties, startTime, singleClientId
            );
            allResults = results;
            totalGenerated = processed;
            anyTimedOut = timedOut;

        } else if (singleClientId) {
            const { data, error } = await supabaseAdmin
                .from("clients")
                .select("id, name, email, buy_box_json, agent_id")
                .eq("id", singleClientId)
                .single();

            if (error || !data) {
                return NextResponse.json({ error: "Client not found" }, { status: 404 });
            }

            const agentId = data.agent_id || "unassigned";
            const { results, timedOut, processed } = await generateBriefsForAgent(
                agentId, [data], allProperties, startTime, singleClientId
            );
            allResults = results;
            totalGenerated = processed;
            anyTimedOut = timedOut;

        } else {
            // Full regeneration: process ALL agents in parallel
            const { data: agents } = await supabaseAdmin
                .from("agents")
                .select("id");

            const agentIds = agents?.map(a => a.id) || [];

            // Load all clients grouped by agent in one query
            const { data: allClients } = await supabaseAdmin
                .from("clients")
                .select("id, name, email, buy_box_json, agent_id");

            if (!allClients || allClients.length === 0) {
                return NextResponse.json({
                    success: true,
                    generated: 0,
                    message: "No clients to generate briefs for.",
                    durationMs: Date.now() - startTime,
                });
            }

            // Group clients by agent_id
            const clientsByAgent = new Map<string, ClientRecord[]>();
            for (const client of allClients) {
                const key = client.agent_id || "unassigned";
                if (!clientsByAgent.has(key)) clientsByAgent.set(key, []);
                clientsByAgent.get(key)!.push(client);
            }

            console.log(`[Brief Gen] Processing ${allClients.length} clients across ${clientsByAgent.size} agents`);

            // Process each agent's clients (agents run sequentially, clients within each run in parallel batches)
            for (const [agentId, clients] of clientsByAgent) {
                const elapsed = Date.now() - startTime;
                if (elapsed > MAX_DURATION_MS) {
                    console.warn(`[Brief Gen] Timeout before starting agent ${agentId}`);
                    anyTimedOut = true;
                    break;
                }

                console.log(`[Brief Gen] Starting agent ${agentId}: ${clients.length} clients`);
                const { results, timedOut, processed } = await generateBriefsForAgent(
                    agentId, clients, allProperties, startTime, null
                );

                Object.assign(allResults, results);
                totalGenerated += processed;
                if (timedOut) anyTimedOut = true;
            }
        }

        return NextResponse.json({
            success: true,
            generated: totalGenerated,
            timedOut: anyTimedOut,
            engine: "deterministic",
            durationMs: Date.now() - startTime,
            results: Object.fromEntries(
                Object.entries(allResults).map(([id, r]: [string, any]) => [id, {
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
