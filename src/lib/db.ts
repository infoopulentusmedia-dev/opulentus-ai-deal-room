import { ApifyPropertyListing } from './apify/mockFeed';
import { supabaseAdmin } from './supabase';

export interface DailyScanRecord {
    date: string; // YYYY-MM-DD
    timestamp: number;
    properties: ApifyPropertyListing[];
}

// Memory Cache for Vercel Serverless (Digests only for now)
let memoryDigest: Record<string, any> = {};

// ─────────────────────────────────────────────────────────────────
// READ HELPERS
// ─────────────────────────────────────────────────────────────────

/**
 * Read all scans — FIXED: Single batched query instead of N+1.
 * Previously did one SELECT per scan row; now collects all property IDs
 * across all scans, fetches them in one query, then re-distributes.
 */
export async function readAllScans(): Promise<DailyScanRecord[]> {
    try {
        const { data: scans, error } = await supabaseAdmin
            .from('daily_scans')
            .select('*')
            .order('inserted_at', { ascending: false });

        if (error || !scans || scans.length === 0) {
            if (error) console.error("Supabase fetch error:", error);
            return [];
        }

        // Collect ALL unique property IDs across every scan
        const allIds = new Set<string>();
        for (const scan of scans) {
            if (Array.isArray(scan.property_ids)) {
                for (const id of scan.property_ids) allIds.add(id);
            }
        }

        if (allIds.size === 0) return scans.map(s => ({
            date: s.date,
            timestamp: new Date(s.inserted_at).getTime(),
            properties: [],
        }));

        // Single batched fetch for ALL properties (chunk in 500s for Supabase .in() limit)
        const propertyMap = new Map<string, any>();
        const idArray = Array.from(allIds);
        for (let i = 0; i < idArray.length; i += 500) {
            const chunk = idArray.slice(i, i + 500);
            const { data: props } = await supabaseAdmin
                .from('properties')
                .select('id, property_data_json')
                .in('id', chunk);
            if (props) {
                for (const p of props) propertyMap.set(p.id, p.property_data_json);
            }
        }

        // Re-distribute into per-scan records
        return scans.map(scan => ({
            date: scan.date,
            timestamp: new Date(scan.inserted_at).getTime(),
            properties: (scan.property_ids || [])
                .map((id: string) => propertyMap.get(id))
                .filter(Boolean),
        }));
    } catch (e) {
        console.error("Failed to read DB:", e);
        return [];
    }
}

// Get the most recent scan — now O(1) query instead of loading all scans
export async function getLatestScan(): Promise<DailyScanRecord | null> {
    try {
        const { data: scan, error } = await supabaseAdmin
            .from('daily_scans')
            .select('*')
            .order('date', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error || !scan) return null;

        const ids = Array.isArray(scan.property_ids) ? scan.property_ids : [];
        if (ids.length === 0) {
            return { date: scan.date, timestamp: new Date(scan.inserted_at).getTime(), properties: [] };
        }

        const allProps: any[] = [];
        for (let i = 0; i < ids.length; i += 500) {
            const chunk = ids.slice(i, i + 500);
            const { data: props } = await supabaseAdmin
                .from('properties')
                .select('property_data_json')
                .in('id', chunk);
            if (props) allProps.push(...props.map((p: any) => p.property_data_json).filter(Boolean));
        }

        return { date: scan.date, timestamp: new Date(scan.inserted_at).getTime(), properties: allProps };
    } catch (e) {
        console.error("Failed to get latest scan:", e);
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────
// SAVE — Merges property_ids when cron runs multiple times per day
// ─────────────────────────────────────────────────────────────────

/**
 * Cross-platform dedup: if the same physical property appears on both
 * Crexi and LoopNet (same normalized address+zip), keep the one with
 * more data (has price > no price, has description > empty, etc.).
 */
function deduplicateCrossPlatform(properties: ApifyPropertyListing[]): ApifyPropertyListing[] {
    const normalize = (addr: string) => (addr || "").toLowerCase().replace(/[^a-z0-9]/g, '');
    const byAddress = new Map<string, ApifyPropertyListing>();

    for (const p of properties) {
        if (!p.address || p.address === "Unknown Address") {
            // Can't dedup without an address — keep it
            byAddress.set(p.sourceId, p);
            continue;
        }
        const key = normalize(p.address) + (p.zipCode || '');
        const existing = byAddress.get(key);
        if (!existing) {
            byAddress.set(key, p);
        } else {
            // Pick the richer listing: prefer one with price, then description, then more images
            const scoreA = (existing.price ? 3 : 0) + (existing.description?.length || 0 > 20 ? 2 : 0) + (existing.images?.length || 0);
            const scoreB = (p.price ? 3 : 0) + (p.description?.length || 0 > 20 ? 2 : 0) + (p.images?.length || 0);
            if (scoreB > scoreA) {
                byAddress.set(key, p);
            }
            // else keep existing
        }
    }
    const deduped = Array.from(byAddress.values());
    if (deduped.length < properties.length) {
        console.log(`[Dedup] Removed ${properties.length - deduped.length} cross-platform duplicates.`);
    }
    return deduped;
}

export async function saveDailyScan(properties: ApifyPropertyListing[]): Promise<DailyScanRecord> {
    const today = new Date().toISOString().split('T')[0];

    // GUARD: Don't save an empty scan — it would overwrite today's good data
    if (!properties || properties.length === 0) {
        console.warn("[saveDailyScan] Refusing to save empty scan — preserving existing data.");
        return { date: today, timestamp: Date.now(), properties: [] };
    }

    // Cross-platform dedup: same building on Crexi + LoopNet → keep the richer listing
    properties = deduplicateCrossPlatform(properties);

    // 1. Upsert all properties into the `properties` table
    const propertyRecords = properties.map(p => ({
        id: p.sourceId,
        platform: p.platform,
        address: p.address || "Unknown Address",
        price: typeof p.price === 'number' && isFinite(p.price) ? p.price : null,
        property_type: p.propertyType || "Commercial",
        property_data_json: p
    }));

    const { error: propErr } = await supabaseAdmin
        .from('properties')
        .upsert(propertyRecords, { onConflict: 'id' });

    if (propErr) {
        console.error("Failed to upsert properties:", propErr);
    }

    // 2. MERGE today's property IDs with any existing ones (don't overwrite)
    const newIds = properties.map(p => p.sourceId);

    const { data: existingScan } = await supabaseAdmin
        .from('daily_scans')
        .select('property_ids')
        .eq('date', today)
        .maybeSingle();

    const existingIds: string[] = existingScan?.property_ids || [];
    const mergedIds = Array.from(new Set([...existingIds, ...newIds]));

    const { error: scanErr } = await supabaseAdmin
        .from('daily_scans')
        .upsert({
            date: today,
            property_ids: mergedIds,
            inserted_at: new Date().toISOString()
        }, { onConflict: 'date' });

    if (scanErr) {
        console.error("Failed to upsert daily scan:", scanErr);
    }

    return {
        date: today,
        timestamp: Date.now(),
        properties: properties
    };
}

// ─────────────────────────────────────────────────────────────────
// 24-HOUR RETENTION CLEANUP
// Deletes scans older than 1 day and their orphaned properties.
// Called at the end of each daily scrape after new data is saved.
// ─────────────────────────────────────────────────────────────────

export async function cleanupOldData(): Promise<{ deletedScans: number; deletedProperties: number }> {
    const today = new Date().toISOString().split('T')[0];
    let deletedScans = 0;
    let deletedProperties = 0;

    try {
        // 1. Find today's property IDs (the ones we KEEP)
        const { data: todayScan } = await supabaseAdmin
            .from('daily_scans')
            .select('property_ids')
            .eq('date', today)
            .maybeSingle();

        const keepIds = new Set<string>(todayScan?.property_ids || []);

        // 2. Find all old scans (anything before today)
        const { data: oldScans } = await supabaseAdmin
            .from('daily_scans')
            .select('date, property_ids')
            .lt('date', today);

        if (oldScans && oldScans.length > 0) {
            // Collect all property IDs from old scans that are NOT in today's scan
            const orphanIds: string[] = [];
            for (const scan of oldScans) {
                if (Array.isArray(scan.property_ids)) {
                    for (const id of scan.property_ids) {
                        if (!keepIds.has(id)) orphanIds.push(id);
                    }
                }
            }

            // 3. Delete orphaned properties (cascade deletes ai_analyses and deal_matches)
            if (orphanIds.length > 0) {
                const uniqueOrphans = Array.from(new Set(orphanIds));
                for (let i = 0; i < uniqueOrphans.length; i += 500) {
                    const chunk = uniqueOrphans.slice(i, i + 500);
                    const { error, count } = await supabaseAdmin
                        .from('properties')
                        .delete()
                        .in('id', chunk);
                    if (error) console.error("Failed to delete orphan properties:", error);
                    else deletedProperties += (count || chunk.length);
                }
            }

            // 4. Delete old daily_scans rows
            const { error, count } = await supabaseAdmin
                .from('daily_scans')
                .delete()
                .lt('date', today);
            if (error) console.error("Failed to delete old scans:", error);
            else deletedScans = count || oldScans.length;
        }

        console.log(`[Cleanup] Deleted ${deletedScans} old scans, ${deletedProperties} orphaned properties. Kept ${keepIds.size} active properties.`);
    } catch (e) {
        console.error("[Cleanup] Failed:", e);
    }

    return { deletedScans, deletedProperties };
}

// ─────────────────────────────────────────────────────────────────
// AI ANALYSIS CACHE (Supabase Postgres)
// Saves AI token costs by preventing re-analysis of unchanged properties
// ─────────────────────────────────────────────────────────────────

export interface CachedAnalysis {
    property_id: string;
    client_id: string;
    agent_id?: string | null;
    ai_score: number;
    ai_reason: string;
    property_price: number | null;
}

export async function getAiAnalysesForClient(clientId: string): Promise<CachedAnalysis[]> {
    try {
        const { data, error } = await supabaseAdmin
            .from('ai_analyses')
            .select('*')
            .eq('client_id', clientId);

        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error(`Status: Failed to fetch AI cache for client ${clientId}`, e);
        return [];
    }
}

export async function saveAiAnalysesBulk(analyses: CachedAnalysis[]): Promise<void> {
    if (!analyses || analyses.length === 0) return;

    try {
        const { error } = await supabaseAdmin
            .from('ai_analyses')
            .upsert(analyses, { onConflict: 'property_id,client_id' });

        if (error) throw error;
    } catch (e) {
        console.error("Status: Failed to bulk save AI analyses to cache", e);
    }
}
