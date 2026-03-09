import { ApifyPropertyListing } from './mockFeed';
import { supabaseAdmin } from '../supabase';

interface PricePoint {
    date: string; // ISO string
    price: number;
}

export interface HistoricalProperty {
    sourceId: string; // e.g., CRX-12345 or LN-67890
    platform: "crexi" | "loopnet" | "mls";
    firstSeen: string; // ISO string
    lastSeen: string; // ISO string
    address: string;
    originalPrice: number | null;
    currentPrice: number | null;
    priceHistory: PricePoint[];
    latestData: ApifyPropertyListing;
}

// Load the current database from Supabase
export async function loadHistoryDB(): Promise<Record<string, HistoricalProperty>> {
    try {
        const { data, error } = await supabaseAdmin.from('properties').select('id, property_data_json');
        if (error || !data) return {};

        const db: Record<string, HistoricalProperty> = {};
        for (const row of data) {
            if (row.property_data_json && row.property_data_json._history) {
                db[row.id] = row.property_data_json._history;
            }
        }
        return db;
    } catch (e) {
        console.error("Failed to load property history from Supabase:", e);
        return {};
    }
}

// Record a new snapshot of listings and merge price history into Supabase
export async function recordSnapshot(listings: ApifyPropertyListing[]) {
    const db = await loadHistoryDB();
    const today = new Date().toISOString();

    let updatedCount = 0;
    let newCount = 0;

    const upsertBatch = [];

    for (const listing of listings) {
        const id = listing.sourceId;
        const currentPrice = listing.price || null;

        let history: HistoricalProperty;

        if (db[id]) {
            // Property already exists in history
            history = db[id];
            history.lastSeen = today;
            history.latestData = listing;

            if (currentPrice !== null) {
                const lastPricePoint = history.priceHistory[history.priceHistory.length - 1];
                if (!lastPricePoint || lastPricePoint.price !== currentPrice) {
                    history.priceHistory.push({ date: today, price: currentPrice });
                    history.currentPrice = currentPrice;
                }
            }
            updatedCount++;
        } else {
            // New property
            const priceHistory: PricePoint[] = [];
            if (currentPrice !== null) {
                priceHistory.push({ date: today, price: currentPrice });
            }

            history = {
                sourceId: listing.sourceId,
                platform: listing.platform as any,
                firstSeen: today,
                lastSeen: today,
                address: listing.address || "Unknown",
                originalPrice: currentPrice,
                currentPrice: currentPrice,
                priceHistory: priceHistory,
                latestData: listing
            };
            newCount++;
        }

        // Prepare for UPSERT
        const enrichedListing = { ...listing, _history: history };
        upsertBatch.push({
            id: id,
            platform: listing.platform,
            address: listing.address,
            price: currentPrice,
            property_type: listing.propertyType,
            property_data_json: enrichedListing
        });
    }

    if (upsertBatch.length > 0) {
        const { error } = await supabaseAdmin.from('properties').upsert(upsertBatch, { onConflict: 'id' });
        if (error) {
            console.error("[History Store] Failed to push history snapshot to Supabase:", error);
        } else {
            console.log(`[History Store] Snapshot synced. New: ${newCount}, Updated: ${updatedCount}.`);
        }
    }
}

// Helper: Get properties that have dropped in price
export async function getPriceDrops(): Promise<HistoricalProperty[]> {
    const db = await loadHistoryDB();
    const drops: HistoricalProperty[] = [];

    for (const id in db) {
        const prop = db[id];
        if (prop.originalPrice && prop.currentPrice && prop.currentPrice < prop.originalPrice) {
            drops.push(prop);
        }
    }

    return drops;
}
