import fs from 'fs';
import path from 'path';
import { ApifyPropertyListing } from './apify/mockFeed';

const IS_VERCEL = !!process.env.VERCEL || process.env.NODE_ENV === "production";
const DB_DIR = IS_VERCEL ? '/tmp/.data' : path.join(process.cwd(), '.data');
const DB_FILE = path.join(DB_DIR, 'daily_scans.json');
const DIGEST_CACHE_FILE = path.join(DB_DIR, 'daily_digests.json');

export interface DailyScanRecord {
    date: string; // YYYY-MM-DD
    timestamp: number;
    properties: ApifyPropertyListing[];
}

// Ensure the database files exist
function initDB() {
    if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify([]), 'utf-8');
    }
    if (!fs.existsSync(DIGEST_CACHE_FILE)) {
        fs.writeFileSync(DIGEST_CACHE_FILE, JSON.stringify({}), 'utf-8');
    }
}

// Memory Cache for Vercel Serverless
let memoryScans: DailyScanRecord[] = [];
let memoryDigest: Record<string, any> = {};

// Read all historical scans
export function readAllScans(): DailyScanRecord[] {
    if (IS_VERCEL) return memoryScans;

    try {
        initDB();
        const data = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(data) as DailyScanRecord[];
    } catch (e) {
        console.error("Failed to read DB:", e);
        return memoryScans;
    }
}

// Get the scan for today, or the most recent day available
export function getLatestScan(): DailyScanRecord | null {
    const scans = readAllScans();
    if (scans.length === 0) return null;

    // Sort by timestamp descending
    scans.sort((a, b) => b.timestamp - a.timestamp);
    return scans[0];
}

// Save a new scan to the persistent JSON file
export function saveDailyScan(properties: ApifyPropertyListing[]): DailyScanRecord {
    let scans = readAllScans();

    // YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    const newRecord: DailyScanRecord = {
        date: today,
        timestamp: Date.now(),
        properties: properties
    };

    // Replace if same day, otherwise push
    const existingIndex = scans.findIndex(s => s.date === today);
    if (existingIndex >= 0) {
        scans[existingIndex] = newRecord;
    } else {
        scans.push(newRecord);

        // Keep max 30 days of history to avoid huge files
        if (scans.length > 30) {
            scans.sort((a, b) => b.timestamp - a.timestamp);
            scans.length = 30; // Truncate
        }
    }

    if (IS_VERCEL) {
        memoryScans = scans;
    } else {
        try {
            fs.writeFileSync(DB_FILE, JSON.stringify(scans, null, 2), 'utf-8');
        } catch (e) {
            console.warn(`[DB] Failed to save DB_FILE on local execution context:`, e);
            memoryScans = scans;
        }
    }

    return newRecord;
}

// ─────────────────────────────────────────────────────────────────
// DIGEST CACHE (Saves Gemini AI costs and load times)
// ─────────────────────────────────────────────────────────────────

export function getDigestCache(clientId: string, date: string): any | null {
    const key = `${clientId}_${date}`;
    if (IS_VERCEL) return memoryDigest[key] || null;

    try {
        initDB();
        const data = fs.readFileSync(DIGEST_CACHE_FILE, 'utf-8');
        const cache = JSON.parse(data);
        return cache[key] || null;
    } catch (e) {
        return memoryDigest[key] || null;
    }
}

export function saveDigestCache(clientId: string, date: string, digestData: any) {
    const key = `${clientId}_${date}`;

    if (IS_VERCEL) {
        memoryDigest[key] = digestData;
        return;
    }

    try {
        initDB();
        const data = fs.readFileSync(DIGEST_CACHE_FILE, 'utf-8');
        const cache = JSON.parse(data);

        cache[key] = digestData;

        // simple cleanup if cache gets too big (>100 keys)
        const keys = Object.keys(cache);
        if (keys.length > 100) {
            delete cache[keys[0]]; // remove oldest since object keys implicitly retain insertion order roughly
        }

        fs.writeFileSync(DIGEST_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
    } catch (e) {
        console.error("Failed to save digest cache", e);
        memoryDigest[key] = digestData;
    }
}
