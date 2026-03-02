import fs from 'fs';
import path from 'path';
import { ApifyPropertyListing } from './mockFeed';

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
    // We store the full latest listing so we don't have to keep fetching it
    latestData: ApifyPropertyListing;
}

const HISTORY_FILE_PATH = path.join(process.cwd(), 'data', 'property_history.json');

// Ensure the data directory exists
function ensureDataDir() {
    const dataDir = path.dirname(HISTORY_FILE_PATH);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

// Load the current database
export function loadHistoryDB(): Record<string, HistoricalProperty> {
    ensureDataDir();
    if (!fs.existsSync(HISTORY_FILE_PATH)) {
        return {};
    }
    try {
        const raw = fs.readFileSync(HISTORY_FILE_PATH, 'utf-8');
        return JSON.parse(raw);
    } catch (e) {
        console.error("Failed to load property history DB:", e);
        return {};
    }
}

// Save the database back to disk
function saveHistoryDB(db: Record<string, HistoricalProperty>) {
    ensureDataDir();
    try {
        fs.writeFileSync(HISTORY_FILE_PATH, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error("Failed to save property history DB:", e);
    }
}

// Record a new snapshot of listings
export function recordSnapshot(listings: ApifyPropertyListing[]) {
    const db = loadHistoryDB();
    const today = new Date().toISOString();

    let updatedCount = 0;
    let newCount = 0;

    for (const listing of listings) {
        const id = listing.sourceId;
        const currentPrice = listing.price;

        if (db[id]) {
            // Property already exists in history
            const existing = db[id];
            existing.lastSeen = today;
            existing.latestData = listing; // update with freshest data

            // Did the price change? Check the last recorded price point
            if (currentPrice !== null) {
                const lastPricePoint = existing.priceHistory[existing.priceHistory.length - 1];
                if (!lastPricePoint || lastPricePoint.price !== currentPrice) {
                    existing.priceHistory.push({ date: today, price: currentPrice });
                    existing.currentPrice = currentPrice;
                }
            }
            updatedCount++;
        } else {
            // New property we've never seen before
            const priceHistory: PricePoint[] = [];
            if (currentPrice !== null) {
                priceHistory.push({ date: today, price: currentPrice });
            }

            db[id] = {
                sourceId: listing.sourceId,
                platform: listing.platform,
                firstSeen: today,
                lastSeen: today,
                address: listing.address,
                originalPrice: currentPrice,
                currentPrice: currentPrice,
                priceHistory: priceHistory,
                latestData: listing
            };
            newCount++;
        }
    }

    saveHistoryDB(db);
    console.log(`[History Store] Snapshot recorded. New: ${newCount}, Updated: ${updatedCount}. Total in DB: ${Object.keys(db).length}.`);
}

// Helper: Get properties that have dropped in price
export function getPriceDrops(): HistoricalProperty[] {
    const db = loadHistoryDB();
    const drops: HistoricalProperty[] = [];

    for (const id in db) {
        const prop = db[id];
        if (prop.originalPrice && prop.currentPrice && prop.currentPrice < prop.originalPrice) {
            drops.push(prop);
        }
    }

    return drops;
}
