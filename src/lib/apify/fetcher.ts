import { ApifyPropertyListing } from "./mockFeed";
import { recordSnapshot, loadHistoryDB } from "./historyStore";
import { fetchRealCompProperties } from "../realcomp/api";
import { isRealcompCompliant, mapRealcompProperty } from "../realcomp/mapper";

const APIFY_TOKEN = process.env.APIFY_API_TOKEN || "";
const CREXI_TASK_ID = "QGmMEd7ThXGV45NTp";
const LOOPNET_TASK_ID = "RPSAB9EzBLJsxEeKm";

async function fetchLatestDataset(taskId: string): Promise<any[]> {
    try {
        const url = `https://api.apify.com/v2/actor-tasks/${taskId}/runs/last/dataset/items?format=json&clean=true&limit=200`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        let res;
        try {
            res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${APIFY_TOKEN}` },
                cache: 'no-store', // Avoid Vercel's 2MB Edge Cache limit crash
                signal: controller.signal
            });
        } catch (e: any) {
            if (e.name === 'AbortError') throw new Error('Apify API request timed out');
            throw e;
        } finally {
            clearTimeout(timeoutId);
        }

        if (!res.ok) {
            console.warn(`Apify fetch for ${taskId} failed with status ${res.status}. (Run might not exist yet).`);
            return [];
        }
        return await res.json();
    } catch (e) {
        console.error(`Failed to fetch Apify dataset for ${taskId}:`, e);
        return [];
    }
}

function detectGhostListings(listings: ApifyPropertyListing[]): ApifyPropertyListing[] {
    // Basic normalization: lower case and strip all non-alphanumeric chars for loose matching
    const normalizeAddress = (addr: string) => addr.toLowerCase().replace(/[^a-z0-9]/g, '');

    const addressMap = new Map<string, ApifyPropertyListing[]>();
    for (const l of listings) {
        if (!l.address) continue;
        // Also include zip code in the matching key to avoid collisions on "123 Main St" across different cities
        const norm = normalizeAddress(l.address) + (l.zipCode || '');
        if (!addressMap.has(norm)) addressMap.set(norm, []);
        addressMap.get(norm)!.push(l);
    }

    return listings.map(l => {
        if (!l.address) return { ...l, _ghostListingData: null };
        const norm = normalizeAddress(l.address) + (l.zipCode || '');
        const matches = addressMap.get(norm)!;

        // Find a match from the OTHER platform
        const other = matches.find(m => m.platform !== l.platform);

        if (other && l.price && other.price) {
            return {
                ...l,
                _ghostListingData: {
                    otherPlatform: other.platform,
                    otherUrl: other.propertyUrl,
                    priceDifference: other.price - l.price, // Positive means the other platform is more expensive
                    daysDifference: (other.daysOnPlatform || 0) - (l.daysOnPlatform || 0)
                }
            };
        }
        return { ...l, _ghostListingData: null };
    });
}

export async function getCrexiFeed(): Promise<ApifyPropertyListing[]> {
    const crexiData = await fetchLatestDataset(CREXI_TASK_ID);
    const listings: ApifyPropertyListing[] = [];

    for (const item of crexiData) {
        if (!item || !item.id) continue;

        // Extract price
        let price = item.askingPrice || item.price || null;
        if (!price && typeof item.priceNumeric === 'number') {
            price = item.priceNumeric;
        }

        // Extract Property Type
        let propertyType = "Commercial";
        if (Array.isArray(item.types) && item.types.length > 0) {
            propertyType = item.types[0];
        } else if (item.type) {
            propertyType = item.type;
        }

        // Extract Location
        let address = "Unknown Address";
        let city = "";
        let state = "";
        let zipCode = "";

        if (item.locations && item.locations.length > 0) {
            const loc = item.locations[0];
            address = loc.address || loc.fullAddress || "Unknown Address";
            city = loc.city || "";
            state = loc.state?.code || loc.state || "";
            zipCode = loc.zip || "";
        } else if (item.address) {
            address = item.address.street || item.address.full || "Unknown Address";
            city = item.address.city || "";
            state = item.address.state || "";
            zipCode = item.address.zip || "";
        }

        listings.push({
            platform: "crexi",
            sourceId: `CRX-${item.id}`,
            propertyUrl: item.url || `https://www.crexi.com/properties/${item.id}`,
            address: address,
            city: city,
            state: state,
            zipCode: zipCode,
            price: price || null,
            propertyType: propertyType,
            buildingSizeSqft: item.buildingSize || item.squareFootage || null,
            lotSizeAcres: item.lotSizeAcres || null,
            capRate: item.capRate || null,
            description: item.description || "",
            images: item.thumbnailUrl ? [item.thumbnailUrl] : (item.media ? item.media.map((m: any) => m.imageUrl).filter(Boolean) : []),
            daysOnPlatform: 0
        });
    }

    if (listings.length > 0) await recordSnapshot(listings);

    // Deduplicate by sourceId to prevent React key collisions from Apify pagination overlaps
    const uniqueListingsMap = new Map<string, ApifyPropertyListing>();
    for (const listing of listings) {
        if (!uniqueListingsMap.has(listing.sourceId)) {
            uniqueListingsMap.set(listing.sourceId, listing);
        }
    }
    const uniqueListings = Array.from(uniqueListingsMap.values());

    const db = await loadHistoryDB();
    return uniqueListings.map(listing => {
        const history = db[listing.sourceId];
        if (history) {
            return {
                ...listing,
                _historicalOriginalPrice: history.originalPrice,
                _historicalPriceDrop: history.originalPrice && listing.price && listing.price < history.originalPrice ? history.originalPrice - listing.price : null
            };
        }
        return listing;
    });
}

export async function getLoopNetFeed(): Promise<ApifyPropertyListing[]> {
    const loopNetData = await fetchLatestDataset(LOOPNET_TASK_ID);
    const listings: ApifyPropertyListing[] = [];

    for (const item of loopNetData) {
        if (!item || !item.propertyId) continue;
        listings.push({
            platform: "loopnet",
            sourceId: `LN-${item.propertyId}`,
            propertyUrl: item.listingUrl || `https://www.loopnet.com/Listing/${item.propertyId}`,
            address: item.address || `${item.city}, ${item.state}`,
            city: item.city || "",
            state: item.state || "",
            zipCode: item.zip || "",
            price: item.priceNumeric || null,
            propertyType: item.propertyTypeDetailed || item.propertyType || "Commercial",
            buildingSizeSqft: item.buildingSize || item.squareFootage || null,
            lotSizeAcres: null,
            capRate: item.capRate || null,
            description: item.description || "",
            images: Array.isArray(item.images) ? item.images : [],
            daysOnPlatform: 0
        });
    }

    if (listings.length > 0) await recordSnapshot(listings);

    // Deduplicate by sourceId to prevent React key collisions from Apify pagination overlaps
    const uniqueListingsMap = new Map<string, ApifyPropertyListing>();
    for (const listing of listings) {
        if (!uniqueListingsMap.has(listing.sourceId)) {
            uniqueListingsMap.set(listing.sourceId, listing);
        }
    }
    const uniqueListings = Array.from(uniqueListingsMap.values());

    const db = await loadHistoryDB();
    return uniqueListings.map(listing => {
        const history = db[listing.sourceId];
        if (history) {
            return {
                ...listing,
                _historicalOriginalPrice: history.originalPrice,
                _historicalPriceDrop: history.originalPrice && listing.price && listing.price < history.originalPrice ? history.originalPrice - listing.price : null
            };
        }
        return listing;
    });
}

export async function getLiveApifyFeed(source?: "crexi" | "loopnet" | "mls" | "all"): Promise<ApifyPropertyListing[]> {
    const promises: Promise<any>[] = [];

    // Always fetch Crexi and Loopnet if they are requested or if 'all' or empty
    if (!source || source === "all" || source === "crexi") {
        promises.push(fetchLatestDataset(CREXI_TASK_ID).catch(() => []));
    } else {
        promises.push(Promise.resolve([]));
    }

    if (!source || source === "all" || source === "loopnet") {
        promises.push(fetchLatestDataset(LOOPNET_TASK_ID).catch(() => []));
    } else {
        promises.push(Promise.resolve([]));
    }

    if (!source || source === "all" || source === "mls") {
        // Limit to 50 Active listings so the response stays well under the 10s serverless timeout
        promises.push(fetchRealCompProperties({ top: 50, filter: "StandardStatus eq 'Active'" }).catch(e => { console.error("Realcomp fetch failed:", e); return { value: [] }; }));
    } else {
        promises.push(Promise.resolve({ value: [] }));
    }

    const [crexiData, loopNetData, rcRawData] = await Promise.all(promises);

    const listings: ApifyPropertyListing[] = [];

    // Normalize Realcomp
    const realcompListings: ApifyPropertyListing[] = (rcRawData?.value || [])
        .filter(isRealcompCompliant)
        .map(mapRealcompProperty);
    listings.push(...realcompListings);

    // Normalize Crexi — field names confirmed from live Apify actor output
    for (const item of crexiData) {
        if (!item || !item.id) continue;

        // Price: top-level askingPrice is the canonical field
        const price = typeof item.askingPrice === 'number' ? item.askingPrice
            : typeof item.price === 'number' ? item.price
            : null;

        // Property type: types[] array takes priority over type string
        const propertyType = (Array.isArray(item.types) && item.types.length > 0)
            ? item.types[0]
            : (item.type || "Commercial");

        // Location: lives in locations[] array (not item.location singular)
        const loc = Array.isArray(item.locations) && item.locations.length > 0 ? item.locations[0] : null;
        const address = loc?.address || loc?.fullAddress || item.name || "Unknown Address";
        const city = loc?.city || "";
        const state = loc?.state?.code || loc?.state?.name || (typeof loc?.state === 'string' ? loc.state : "") || "";
        const zipCode = loc?.zip || "";

        listings.push({
            platform: "crexi",
            sourceId: `CRX-${item.id}`,
            propertyUrl: item.url || `https://www.crexi.com/properties/${item.id}`,
            address,
            city,
            state,
            zipCode,
            price,
            propertyType,
            buildingSizeSqft: item.squareFootage || item.buildingSize || null,
            lotSizeAcres: item.lotSizeAcres || null,
            capRate: item.capRate || null,
            description: item.description || "",
            images: item.thumbnailUrl ? [item.thumbnailUrl] : (item.media ? item.media.map((m: any) => m.imageUrl).filter(Boolean) : []),
            daysOnPlatform: 0
        });
    }

    // Normalize LoopNet
    for (const item of loopNetData) {
        if (!item || !item.propertyId) continue;

        listings.push({
            platform: "loopnet",
            sourceId: `LN-${item.propertyId}`,
            propertyUrl: item.listingUrl || `https://www.loopnet.com/Listing/${item.propertyId}`,
            address: item.address || `${item.city}, ${item.state}`,
            city: item.city || "",
            state: item.state || "",
            zipCode: item.zip || "",
            price: item.priceNumeric || null,
            propertyType: item.propertyTypeDetailed || item.propertyType || "Commercial",
            buildingSizeSqft: item.buildingSize || item.squareFootage || null,
            lotSizeAcres: null,
            capRate: item.capRate || null,
            description: item.description || "",
            images: Array.isArray(item.images) ? item.images : [],
            daysOnPlatform: 0
        });
    }

    // 1. Record the fresh snapshot into our local JSON database
    if (listings.length > 0) {
        await recordSnapshot(listings);
    }

    // 2. Hydrate the list with historical context (e.g., price drop info)
    const db = await loadHistoryDB();
    const enrichedListings = listings.map(listing => {
        const history = db[listing.sourceId];
        if (history) {
            // Give the frontend access to what the original price was
            return {
                ...listing,
                _historicalOriginalPrice: history.originalPrice,
                _historicalPriceDrop: history.originalPrice && listing.price && listing.price < history.originalPrice
                    ? history.originalPrice - listing.price
                    : null
            };
        }
        return listing;
    });

    // 3. Cross-reference LoopNet and Crexi to detect Ghost Listings/Arbitrage
    const finalGhostListings = detectGhostListings(enrichedListings);

    return finalGhostListings;
}
