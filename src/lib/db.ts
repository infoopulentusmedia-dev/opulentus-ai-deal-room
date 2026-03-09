import { ApifyPropertyListing } from './apify/mockFeed';
import { supabaseAdmin } from './supabase';

export interface DailyScanRecord {
    date: string; // YYYY-MM-DD
    timestamp: number;
    properties: ApifyPropertyListing[];
}

// Memory Cache for Vercel Serverless (Digests only for now)
let memoryDigest: Record<string, any> = {};

// Read all historical scans from Supabase
export async function readAllScans(): Promise<DailyScanRecord[]> {
    try {
        const { data: scans, error } = await supabaseAdmin
            .from('daily_scans')
            .select('*')
            .order('inserted_at', { ascending: false });

        if (error || !scans) {
            console.error("Supabase fetch error:", error);
            return [];
        }

        // We need to fetch the actual properties for these scans
        // But for performance, if we just want the list of dates, we could optimize this.
        // For now we'll just reconstruct the schema to match the frontend expectations.
        const records: DailyScanRecord[] = [];

        for (const scan of scans) {
            // Fetch properties for this scan
            const { data: props } = await supabaseAdmin
                .from('properties')
                .select('property_data_json')
                .in('id', scan.property_ids);

            records.push({
                date: scan.date,
                timestamp: new Date(scan.inserted_at).getTime(),
                properties: props ? props.map((p: any) => p.property_data_json) : []
            });
        }

        return records;
    } catch (e) {
        console.error("Failed to read DB:", e);
        return [];
    }
}

// Get the scan for today, or the most recent day available
export async function getLatestScan(): Promise<DailyScanRecord | null> {
    const scans = await readAllScans();
    if (scans.length === 0) return null;

    // Sort by timestamp descending
    scans.sort((a, b) => b.timestamp - a.timestamp);
    return scans[0];
}

// Save a new scan to Supabase Postgres
export async function saveDailyScan(properties: ApifyPropertyListing[]): Promise<DailyScanRecord> {
    const today = new Date().toISOString().split('T')[0];

    // 1. Upsert all properties into the `properties` table
    const propertyRecords = properties.map(p => ({
        id: p.sourceId,
        platform: p.platform,
        address: p.address,
        price: typeof p.price === 'number' ? p.price : null,
        property_type: p.propertyType,
        property_data_json: p
    }));

    // Upsert properties (ignore if exists, or update)
    const { error: propErr } = await supabaseAdmin
        .from('properties')
        .upsert(propertyRecords, { onConflict: 'id' });

    if (propErr) {
        console.error("Failed to upsert properties:", propErr);
    }

    // 2. Log the daily scan with the array of property IDs
    const propertyIds = properties.map(p => p.sourceId);

    const { error: scanErr } = await supabaseAdmin
        .from('daily_scans')
        .upsert({
            date: today,
            property_ids: propertyIds,
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
// DIGEST CACHE (Saves Gemini AI costs and load times)
// Note: Keeping in memory for now. Moving to DB is optional.
// ─────────────────────────────────────────────────────────────────

export function getDigestCache(clientId: string, date: string): any | null {
    const key = `${clientId}_${date}`;
    return memoryDigest[key] || null;
}

export function saveDigestCache(clientId: string, date: string, digestData: any) {
    const key = `${clientId}_${date}`;
    memoryDigest[key] = digestData;
}
