/**
 * Deterministic Property Matching Engine
 * =======================================
 * Replaces Gemini API calls with pure algorithmic matching.
 * Scores every property against every buy box dimension,
 * generates human-readable reasoning, detects red flags,
 * and identifies near-misses — all without any AI API calls.
 *
 * Reusable across: morning briefs, property search, client alerts, deal room.
 */

import { checkTaxIncentives } from "@/app/api/tax-incentive-check/route";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface BuyBox {
    propertyType?: string;
    transactionType?: string;
    location?: string;
    priceMin?: string | number;
    priceMax?: string | number;
    sizeMin?: string | number;
    sizeMax?: string | number;
    specialCriteria?: string;
    portfolioHoldings?: string;
}

export interface ScoredProperty {
    property: any;               // Full property_data_json
    totalScore: number;          // 0-100
    breakdown: ScoreBreakdown;
    reasoning: string;           // Human-readable explanation
    redFlags: string[];          // Detected concerns
    classification: "strong" | "near-miss" | "no-match";
}

export interface ScoreBreakdown {
    typeScore: number;           // 0-35
    locationScore: number;       // 0-30
    priceScore: number;          // 0-20
    sizeScore: number;           // 0-15
    bonuses: number;             // 0-10 (cap rate, special criteria, etc.)
    typeMatch: string;           // "exact", "alias", "broad", "none"
    locationMatch: string;       // "city", "zip", "county", "state", "none"
    priceMatch: string;          // "in-range", "near", "over", "under", "unknown"
    sizeMatch: string;           // "in-range", "near", "over", "under", "unknown"
    failedDimension?: string;    // For near-misses: which dimension failed
    failedReason?: string;       // For near-misses: human explanation of failure
}

export interface BriefResult {
    clientId: string;
    clientName: string;
    generatedAt: string;
    scanDate: string;
    briefing: string;
    matchCount: number;
    properties: any[];           // Enriched matched properties
    nearMisses: any[];           // Near-miss properties with explanations
}

// ---------------------------------------------------------------------------
// Property Type Taxonomy
// ---------------------------------------------------------------------------
const TYPE_CATEGORIES: Record<string, string[]> = {
    retail: ["retail", "strip", "strip mall", "strip center", "plaza", "shopping", "shopping center", "storefront", "store", "mall", "outlet"],
    industrial: ["industrial", "warehouse", "manufacturing", "flex", "flex space", "distribution", "logistics", "factory", "cold storage", "self storage", "storage"],
    office: ["office", "professional", "medical office", "coworking", "executive suite", "class a", "class b", "class c"],
    residential: ["residential", "single family", "single-family", "sfr", "multi-family", "multifamily", "multi family", "duplex", "triplex", "quadplex", "fourplex", "house", "home", "apartment", "condo", "townhouse", "townhome"],
    auto: ["auto", "automotive", "mechanic", "collision", "car wash", "gas station", "service station", "body shop", "auto repair", "tire", "oil change", "detail"],
    land: ["land", "lot", "acreage", "vacant", "vacant land", "development", "development site", "build-to-suit"],
    mixed: ["mixed use", "mixed-use", "live-work", "live/work"],
    hospitality: ["hotel", "motel", "hospitality", "inn", "bed and breakfast", "bnb", "airbnb", "short-term rental"],
    medical: ["medical", "dental", "healthcare", "clinic", "hospital", "urgent care", "surgery center", "pharmacy"],
    restaurant: ["restaurant", "food", "fast food", "cafe", "bar", "pub", "tavern", "drive-thru", "qsr", "food service"],
    specialpurpose: ["church", "school", "daycare", "gym", "fitness", "laundromat", "car dealership", "funeral"],
};

// Reverse map: alias → category
const ALIAS_TO_CATEGORY: Record<string, string> = {};
for (const [category, aliases] of Object.entries(TYPE_CATEGORIES)) {
    for (const alias of aliases) {
        ALIAS_TO_CATEGORY[alias] = category;
    }
}

// ---------------------------------------------------------------------------
// Michigan County → Cities Mapping (primary market)
// ---------------------------------------------------------------------------
const COUNTY_CITIES: Record<string, string[]> = {
    wayne: ["detroit", "dearborn", "dearborn heights", "livonia", "westland", "canton", "redford", "garden city", "inkster", "taylor", "romulus", "wayne", "hamtramck", "highland park", "ecorse", "river rouge", "lincoln park", "allen park", "melvindale", "southgate", "wyandotte", "riverview", "trenton", "woodhaven", "flat rock", "rockwood", "brownstown", "huron township", "van buren township", "belleville", "plymouth", "northville"],
    oakland: ["troy", "birmingham", "bloomfield hills", "royal oak", "ferndale", "southfield", "farmington", "farmington hills", "novi", "walled lake", "wixom", "commerce township", "west bloomfield", "orchard lake", "pontiac", "auburn hills", "rochester", "rochester hills", "clarkston", "lake orion", "oxford", "berkley", "clawson", "madison heights", "hazel park", "huntington woods", "pleasant ridge", "oak park", "lathrup village", "waterford"],
    macomb: ["warren", "sterling heights", "clinton township", "shelby township", "macomb township", "roseville", "eastpointe", "st clair shores", "mount clemens", "fraser", "harrison township", "chesterfield", "new baltimore", "richmond", "romeo", "utica", "center line", "new haven", "ray township"],
    washtenaw: ["ann arbor", "ypsilanti", "saline", "chelsea", "dexter", "milan", "manchester"],
    livingston: ["brighton", "howell", "hartland", "fowlerville", "pinckney"],
    genesee: ["flint", "burton", "grand blanc", "fenton", "davison", "clio", "flushing", "swartz creek"],
    kent: ["grand rapids", "wyoming", "kentwood", "walker", "grandville", "byron center", "caledonia", "rockford", "cedar springs"],
    ingham: ["lansing", "east lansing", "mason", "williamston", "okemos", "haslett"],
};

// Reverse map: city → county
const CITY_TO_COUNTY: Record<string, string> = {};
for (const [county, cities] of Object.entries(COUNTY_CITIES)) {
    for (const city of cities) {
        CITY_TO_COUNTY[city] = county;
    }
}

// ---------------------------------------------------------------------------
// Utility: safe number parser (handles "$500,000", "1,200,000", etc.)
// ---------------------------------------------------------------------------
function safeNum(val: any): number | null {
    if (val === null || val === undefined || val === "") return null;
    if (typeof val === "number") return isNaN(val) ? null : val;
    if (typeof val === "string") {
        const s = val.trim().toLowerCase();
        // Handle M/K suffixes: "$1.5M" → 1500000, "$500K" → 500000
        const mMatch = s.match(/^\$?\s*([\d,.]+)\s*m$/i);
        if (mMatch) {
            const num = parseFloat(mMatch[1].replace(/,/g, ""));
            return isNaN(num) ? null : Math.round(num * 1_000_000);
        }
        const kMatch = s.match(/^\$?\s*([\d,.]+)\s*k$/i);
        if (kMatch) {
            const num = parseFloat(kMatch[1].replace(/,/g, ""));
            return isNaN(num) ? null : Math.round(num * 1_000);
        }
        // Standard: strip non-numeric, parse
        const cleaned = val.replace(/[^0-9.]/g, "");
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
    }
    return null;
}

// ---------------------------------------------------------------------------
// Utility: normalize text for matching
// ---------------------------------------------------------------------------
function norm(s: any): string {
    return String(s || "").toLowerCase().trim();
}

// ---------------------------------------------------------------------------
// Get the category for a property type string
// ---------------------------------------------------------------------------
function getTypeCategory(typeStr: string): string | null {
    const t = norm(typeStr);
    if (!t) return null;

    // Direct alias lookup
    if (ALIAS_TO_CATEGORY[t]) return ALIAS_TO_CATEGORY[t];

    // Partial match: check if any alias is contained in the string or vice versa
    for (const [alias, category] of Object.entries(ALIAS_TO_CATEGORY)) {
        if (t.includes(alias) || alias.includes(t)) return category;
    }

    return null;
}

// ---------------------------------------------------------------------------
// Parse location string into structured search terms
// ---------------------------------------------------------------------------
interface ParsedLocation {
    cities: string[];
    zips: string[];
    counties: string[];
    states: string[];
    raw: string[];
}

// Metro area aliases that expand to multiple counties
const METRO_ALIASES: Record<string, string[]> = {
    "metro detroit": ["wayne", "oakland", "macomb"],
    "southeast michigan": ["wayne", "oakland", "macomb", "washtenaw", "livingston"],
    "se michigan": ["wayne", "oakland", "macomb", "washtenaw", "livingston"],
    "tri-county": ["wayne", "oakland", "macomb"],
    "tri county": ["wayne", "oakland", "macomb"],
    "downriver": ["wayne"], // subset of Wayne (Southgate, Wyandotte, Trenton, etc.)
    "metro grand rapids": ["kent"],
};

// Normalize township/city suffixes for matching
function normalizeCity(city: string): string {
    return city
        .replace(/\s+(township|twp|charter township|village|city of)\s*$/i, "")
        .replace(/\s+/g, " ")
        .trim();
}

function parseLocation(locationStr: string): ParsedLocation {
    const result: ParsedLocation = { cities: [], zips: [], counties: [], states: [], raw: [] };
    if (!locationStr) return result;

    const lower = locationStr.toLowerCase().trim();

    // Check metro area aliases FIRST (before splitting on commas)
    for (const [alias, counties] of Object.entries(METRO_ALIASES)) {
        if (lower.includes(alias)) {
            result.counties.push(...counties);
            // Remove the alias from the string so it doesn't get re-parsed
            const remaining = lower.replace(alias, "").trim();
            if (!remaining) return result;
        }
    }

    const parts = lower
        .split(/[,|/&;]+/)
        .map(s => s.trim())
        .filter(Boolean);

    for (const part of parts) {
        // Skip if already handled as metro alias
        if (Object.keys(METRO_ALIASES).some(a => part.includes(a))) continue;

        // Zip codes: 5-digit numbers
        if (/^\d{5}$/.test(part)) {
            result.zips.push(part);
            continue;
        }

        // State abbreviations
        if (/^(mi|michigan|oh|ohio|il|illinois|in|indiana|fl|florida|tx|texas|ca|california|ny|new york)$/i.test(part)) {
            result.states.push(part.length === 2 ? part : part.substring(0, 2));
            continue;
        }

        // County detection
        const countyMatch = part.match(/^(.+?)\s*county$/i);
        if (countyMatch) {
            const countyName = countyMatch[1].trim();
            result.counties.push(countyName);
            continue;
        }

        // Known county names without "county" suffix
        if (COUNTY_CITIES[part]) {
            result.counties.push(part);
            continue;
        }

        // Normalize city name (strip "Township", "Twp", etc.) and add
        const normalized = normalizeCity(part);
        result.cities.push(normalized);
        result.raw.push(normalized);
    }

    return result;
}

// ---------------------------------------------------------------------------
// CORE: Score a single property against a buy box
// ---------------------------------------------------------------------------
export function scoreProperty(property: any, buyBox: BuyBox): ScoredProperty {
    const pData = property.property_data_json || property;
    const pType = norm(pData.propertyType || property.property_type);
    const pCity = norm(pData.city);
    const pState = norm(pData.state);
    const pZip = String(pData.zipCode || pData.zip_code || "").trim();
    const pPrice = safeNum(pData.price) ?? safeNum(property.price);
    const pSize = safeNum(pData.buildingSizeSqft) ?? safeNum(pData.lotSizeSqft);
    const pCapRate = safeNum(pData.capRate);
    const pYearBuilt = safeNum(pData.yearBuilt);
    const pOccupancy = safeNum(pData.occupancy);
    const pAddress = pData.address || property.address || "";

    // Parse buy box criteria
    const bbType = norm(buyBox.propertyType);
    const bbTransaction = norm(buyBox.transactionType);
    const bbLocation = parseLocation(buyBox.location || "");
    const bbPriceMin = safeNum(buyBox.priceMin) ?? 0;
    const bbPriceMax = safeNum(buyBox.priceMax) ?? Infinity;
    const bbSizeMin = safeNum(buyBox.sizeMin) ?? 0;
    const bbSizeMax = safeNum(buyBox.sizeMax) ?? Infinity;
    const bbSpecial = norm(buyBox.specialCriteria);

    const breakdown: ScoreBreakdown = {
        typeScore: 0,
        locationScore: 0,
        priceScore: 0,
        sizeScore: 0,
        bonuses: 0,
        typeMatch: "none",
        locationMatch: "none",
        priceMatch: "unknown",
        sizeMatch: "unknown",
    };

    // ==========================================
    // TYPE SCORING (0-35)
    // ==========================================
    if (bbType && pType) {
        const bbCategory = getTypeCategory(bbType);
        const pCategory = getTypeCategory(pType);

        if (bbCategory && pCategory && bbCategory === pCategory) {
            // Same category
            if (pType.includes(bbType) || bbType.includes(pType)) {
                breakdown.typeScore = 35; // Exact or substring match
                breakdown.typeMatch = "exact";
            } else {
                breakdown.typeScore = 30; // Alias match within same category
                breakdown.typeMatch = "alias";
            }
        } else if (pType.includes(bbType) || bbType.includes(pType)) {
            breakdown.typeScore = 25; // Direct string overlap but different categories
            breakdown.typeMatch = "broad";
        } else {
            breakdown.typeScore = 0;
            breakdown.typeMatch = "none";
        }
    } else if (!bbType) {
        // No type preference — give partial credit
        breakdown.typeScore = 15;
        breakdown.typeMatch = "broad";
    }

    // ==========================================
    // LOCATION SCORING (0-30)
    // ==========================================
    const hasLocationCriteria = bbLocation.cities.length > 0 || bbLocation.zips.length > 0 || bbLocation.counties.length > 0;

    if (hasLocationCriteria) {
        let bestLocationScore = 0;
        let bestLocationMatch = "none";

        // Zip code match (strongest — exact)
        if (pZip && bbLocation.zips.includes(pZip)) {
            bestLocationScore = 30;
            bestLocationMatch = "zip";
        }

        // City match
        if (pCity) {
            for (const targetCity of bbLocation.cities) {
                if (pCity === targetCity) {
                    if (bestLocationScore < 30) { bestLocationScore = 30; bestLocationMatch = "city"; }
                } else if (pCity.includes(targetCity) || targetCity.includes(pCity)) {
                    if (bestLocationScore < 25) { bestLocationScore = 25; bestLocationMatch = "city"; }
                }
            }
        }

        // County match (check if property's city is in a target county)
        if (pCity) {
            const propertyCounty = CITY_TO_COUNTY[pCity];
            if (propertyCounty) {
                for (const targetCounty of bbLocation.counties) {
                    if (propertyCounty === targetCounty || propertyCounty.includes(targetCounty) || targetCounty.includes(propertyCounty)) {
                        if (bestLocationScore < 25) { bestLocationScore = 25; bestLocationMatch = "county"; }
                    }
                }
            }
        }

        // Also check if property city appears in any raw location keyword
        if (pCity && bestLocationScore < 20) {
            for (const raw of bbLocation.raw) {
                if (pCity.includes(raw) || raw.includes(pCity)) {
                    bestLocationScore = 20;
                    bestLocationMatch = "city";
                }
            }
        }

        // State match (weakest)
        if (pState && bbLocation.states.length > 0 && bestLocationScore < 5) {
            const stateAbbr = pState.length === 2 ? pState : pState.substring(0, 2);
            if (bbLocation.states.some(s => s === stateAbbr || s === pState)) {
                bestLocationScore = 5;
                bestLocationMatch = "state";
            }
        }

        breakdown.locationScore = bestLocationScore;
        breakdown.locationMatch = bestLocationMatch;
    } else {
        // No location criteria — partial credit
        breakdown.locationScore = 10;
        breakdown.locationMatch = "none";
    }

    // ==========================================
    // PRICE SCORING (0-20)
    // ==========================================
    if (pPrice !== null && pPrice > 0) {
        if (bbPriceMax === Infinity && bbPriceMin === 0) {
            // No price criteria
            breakdown.priceScore = 10;
            breakdown.priceMatch = "unknown";
        } else if (pPrice >= bbPriceMin && pPrice <= bbPriceMax) {
            breakdown.priceScore = 20;
            breakdown.priceMatch = "in-range";
        } else if (pPrice > bbPriceMax) {
            const overBy = ((pPrice - bbPriceMax) / bbPriceMax) * 100;
            if (overBy <= 10) { breakdown.priceScore = 14; breakdown.priceMatch = "near"; }
            else if (overBy <= 20) { breakdown.priceScore = 10; breakdown.priceMatch = "near"; }
            else if (overBy <= 30) { breakdown.priceScore = 5; breakdown.priceMatch = "over"; }
            else { breakdown.priceScore = 0; breakdown.priceMatch = "over"; }
        } else if (pPrice < bbPriceMin) {
            const underBy = ((bbPriceMin - pPrice) / bbPriceMin) * 100;
            if (underBy <= 20) { breakdown.priceScore = 15; breakdown.priceMatch = "near"; }
            else if (underBy <= 40) { breakdown.priceScore = 10; breakdown.priceMatch = "under"; }
            else { breakdown.priceScore = 5; breakdown.priceMatch = "under"; }
        }
    } else {
        // Price not available
        breakdown.priceScore = 5;
        breakdown.priceMatch = "unknown";
    }

    // ==========================================
    // SIZE SCORING (0-15)
    // ==========================================
    if (pSize !== null && pSize > 0) {
        if (bbSizeMax === Infinity && bbSizeMin === 0) {
            breakdown.sizeScore = 8;
            breakdown.sizeMatch = "unknown";
        } else if (pSize >= bbSizeMin && pSize <= bbSizeMax) {
            breakdown.sizeScore = 15;
            breakdown.sizeMatch = "in-range";
        } else if (pSize > bbSizeMax) {
            const overBy = ((pSize - bbSizeMax) / bbSizeMax) * 100;
            if (overBy <= 15) { breakdown.sizeScore = 10; breakdown.sizeMatch = "near"; }
            else if (overBy <= 30) { breakdown.sizeScore = 6; breakdown.sizeMatch = "over"; }
            else { breakdown.sizeScore = 0; breakdown.sizeMatch = "over"; }
        } else {
            const underBy = ((bbSizeMin - pSize) / bbSizeMin) * 100;
            if (underBy <= 20) { breakdown.sizeScore = 10; breakdown.sizeMatch = "near"; }
            else if (underBy <= 40) { breakdown.sizeScore = 5; breakdown.sizeMatch = "under"; }
            else { breakdown.sizeScore = 0; breakdown.sizeMatch = "under"; }
        }
    } else {
        breakdown.sizeScore = 3;
        breakdown.sizeMatch = "unknown";
    }

    // ==========================================
    // BONUS SCORING (0-10)
    // ==========================================
    // Cap rate bonus
    if (pCapRate !== null && pCapRate >= 6) breakdown.bonuses += 3;
    else if (pCapRate !== null && pCapRate >= 4.5) breakdown.bonuses += 1;

    // Special criteria keyword match
    if (bbSpecial && pType) {
        const specialWords = bbSpecial.split(/\s+/).filter(w => w.length > 3);
        const matchedSpecial = specialWords.filter(w =>
            pType.includes(w) ||
            norm(pData.description || "").includes(w) ||
            norm(pAddress).includes(w)
        );
        if (matchedSpecial.length > 0) breakdown.bonuses += Math.min(5, matchedSpecial.length * 2);
    }

    // Transaction type match bonus
    if (bbTransaction) {
        const pTransaction = norm(pData.transactionType || pData.status);
        if (pTransaction && (pTransaction.includes(bbTransaction) || bbTransaction.includes(pTransaction))) {
            breakdown.bonuses += 2;
        }
    }

    breakdown.bonuses = Math.min(10, breakdown.bonuses);

    // ==========================================
    // TOTAL SCORE
    // ==========================================
    const totalScore = Math.min(100,
        breakdown.typeScore +
        breakdown.locationScore +
        breakdown.priceScore +
        breakdown.sizeScore +
        breakdown.bonuses
    );

    // ==========================================
    // RED FLAGS
    // ==========================================
    const redFlags: string[] = [];

    if (pPrice !== null && bbPriceMax !== Infinity && pPrice > bbPriceMax * 0.9 && pPrice <= bbPriceMax) {
        redFlags.push("Near budget ceiling");
    }
    if (pPrice !== null && bbPriceMax !== Infinity && pPrice > bbPriceMax) {
        const overPct = Math.round(((pPrice - bbPriceMax) / bbPriceMax) * 100);
        redFlags.push(`${overPct}% over max budget`);
    }
    if (pYearBuilt !== null && pYearBuilt < 1970) {
        redFlags.push("Older building — may need renovation");
    }
    if (pOccupancy !== null && pOccupancy < 70) {
        redFlags.push(`Low occupancy (${pOccupancy}%)`);
    }
    if (pCapRate !== null && pCapRate < 3.5) {
        redFlags.push(`Low cap rate (${pCapRate}%)`);
    }
    if (pPrice === null) {
        redFlags.push("Price not disclosed");
    }
    if (pData.daysOnPlatform && pData.daysOnPlatform > 180) {
        redFlags.push("Listed 6+ months — investigate why");
    }
    if (pData._historicalPriceDrop && pData._historicalPriceDrop > 0) {
        redFlags.push(`Price dropped $${(pData._historicalPriceDrop / 1000).toFixed(0)}K — possible negotiation leverage`);
    }

    // ==========================================
    // CLASSIFICATION
    // ==========================================
    let classification: "strong" | "near-miss" | "no-match";
    if (totalScore >= 55) {
        classification = "strong";
    } else if (totalScore >= 30) {
        classification = "near-miss";
        // Identify which dimension failed for near-miss explanation
        if (breakdown.typeMatch === "none" && bbType) {
            breakdown.failedDimension = "type";
            breakdown.failedReason = `Looking for ${buyBox.propertyType} but this is ${pData.propertyType || "unknown type"}`;
        } else if (breakdown.locationMatch === "none" || breakdown.locationMatch === "state") {
            breakdown.failedDimension = "location";
            breakdown.failedReason = `Located in ${pData.city || "unknown"}, ${pData.state || ""} — outside target area of ${buyBox.location || "unspecified"}`;
        } else if (breakdown.priceMatch === "over") {
            const overAmt = pPrice && bbPriceMax !== Infinity ? pPrice - bbPriceMax : 0;
            breakdown.failedDimension = "price";
            breakdown.failedReason = `Priced at $${pPrice?.toLocaleString()} — $${overAmt.toLocaleString()} over the $${bbPriceMax.toLocaleString()} max`;
        } else if (breakdown.sizeMatch === "over" || breakdown.sizeMatch === "under") {
            breakdown.failedDimension = "size";
            breakdown.failedReason = `${pSize?.toLocaleString()} sf ${breakdown.sizeMatch === "over" ? "exceeds" : "below"} the ${buyBox.sizeMin}-${buyBox.sizeMax} sf criteria`;
        }
    } else {
        classification = "no-match";
    }

    // ==========================================
    // REASONING
    // ==========================================
    const reasoning = generateReasoning(pData, buyBox, breakdown, totalScore, redFlags);

    return {
        property: pData,
        totalScore,
        breakdown,
        reasoning,
        redFlags,
        classification,
    };
}

// ---------------------------------------------------------------------------
// Generate human-readable reasoning for a match
// ---------------------------------------------------------------------------
function generateReasoning(
    prop: any,
    buyBox: BuyBox,
    breakdown: ScoreBreakdown,
    totalScore: number,
    redFlags: string[]
): string {
    const parts: string[] = [];
    const pType = prop.propertyType || prop.property_type || "Property";
    const pCity = prop.city || "";
    const pState = prop.state || "";
    const pPrice = safeNum(prop.price);
    const pSize = safeNum(prop.buildingSizeSqft);

    // Opening — what it is and where
    if (pCity) {
        parts.push(`${pType} in ${pCity}${pState ? `, ${pState}` : ""}`);
    } else {
        parts.push(`${pType} listing`);
    }

    // Type fit
    if (breakdown.typeMatch === "exact") {
        parts.push(`directly matches the ${buyBox.propertyType} criteria`);
    } else if (breakdown.typeMatch === "alias") {
        parts.push(`fits within the ${buyBox.propertyType} category`);
    }

    // Price fit
    if (pPrice !== null) {
        const bbMin = safeNum(buyBox.priceMin);
        const bbMax = safeNum(buyBox.priceMax);
        if (breakdown.priceMatch === "in-range") {
            if (bbMin && bbMax && bbMax < Infinity) {
                parts.push(`priced at $${pPrice.toLocaleString()} within the $${bbMin.toLocaleString()}-$${bbMax.toLocaleString()} range`);
            } else {
                parts.push(`priced at $${pPrice.toLocaleString()}`);
            }
        } else if (breakdown.priceMatch === "near") {
            parts.push(`priced at $${pPrice.toLocaleString()} (slightly outside target range but worth considering)`);
        }
    }

    // Size fit
    if (pSize !== null && breakdown.sizeMatch === "in-range") {
        parts.push(`${pSize.toLocaleString()} sf meets the size requirement`);
    }

    // Location fit
    if (breakdown.locationMatch === "city" || breakdown.locationMatch === "zip") {
        parts.push(`located in a target area`);
    } else if (breakdown.locationMatch === "county") {
        parts.push(`within the target county`);
    }

    // Cap rate if notable
    const capRate = safeNum(prop.capRate);
    if (capRate !== null && capRate >= 5) {
        parts.push(`${capRate}% cap rate indicates solid returns`);
    }

    // Combine into 2-3 sentences
    if (parts.length <= 2) {
        return parts.join(" — ") + ".";
    }

    // First sentence: type + location. Second: price + size. Third: extras.
    const s1 = parts.slice(0, 2).join(" ");
    const s2 = parts.slice(2, 4).join(" and ");
    const s3 = parts.length > 4 ? parts.slice(4).join(". ") : "";

    let text = `${s1}. ${s2 ? s2 + "." : ""}`;
    if (s3) text += ` ${s3}.`;

    // Add red flag summary if any
    if (redFlags.length > 0 && redFlags.length <= 2) {
        text += ` Note: ${redFlags.join("; ")}.`;
    }

    return text.replace(/\.\./g, ".").trim();
}

// ---------------------------------------------------------------------------
// Generate near-miss explanation and suggestion
// ---------------------------------------------------------------------------
function generateNearMissExplanation(scored: ScoredProperty, buyBox: BuyBox): { whyItAlmostMatched: string; suggestion: string } {
    const bd = scored.breakdown;
    const prop = scored.property;

    // Identify what WAS good
    const strengths: string[] = [];
    if (bd.typeMatch === "exact" || bd.typeMatch === "alias") strengths.push(`matches the ${buyBox.propertyType || "target"} type`);
    if (bd.locationMatch === "city" || bd.locationMatch === "zip" || bd.locationMatch === "county") strengths.push(`in the target area`);
    if (bd.priceMatch === "in-range") strengths.push(`within budget`);
    if (bd.sizeMatch === "in-range") strengths.push(`right size`);

    const strengthText = strengths.length > 0
        ? `Strong on: ${strengths.join(", ")}.`
        : "Partial criteria overlap.";

    // Explain what failed
    let failText = bd.failedReason || "Missed on one or more criteria.";
    let suggestion = "Review the listing details for potential fit.";

    if (bd.failedDimension === "price") {
        const pPrice = safeNum(prop.price);
        const bbMax = safeNum(buyBox.priceMax);
        if (pPrice && bbMax && bbMax < Infinity) {
            const overAmt = pPrice - bbMax;
            suggestion = overAmt < bbMax * 0.15
                ? `Only ${Math.round((overAmt / bbMax) * 100)}% over — seller may negotiate.`
                : `Significantly over budget. Consider as a stretch opportunity if financing allows.`;
        }
    } else if (bd.failedDimension === "location") {
        suggestion = "Nearby market — may be worth expanding search radius.";
    } else if (bd.failedDimension === "type") {
        suggestion = "Different property type, but fundamentals align. Consider for portfolio diversification.";
    } else if (bd.failedDimension === "size") {
        suggestion = bd.sizeMatch === "over"
            ? "Larger than needed — could sublease excess space or plan for growth."
            : "Smaller than ideal — evaluate if core needs can still be met.";
    }

    return {
        whyItAlmostMatched: `${strengthText} ${failText}`,
        suggestion,
    };
}

// ---------------------------------------------------------------------------
// Generate client briefing summary text
// ---------------------------------------------------------------------------
function generateBriefingSummary(
    clientName: string,
    buyBox: BuyBox,
    strongMatches: ScoredProperty[],
    nearMisses: ScoredProperty[],
    totalPropertyCount: number,
): string {
    const location = buyBox.location || "your target markets";
    const type = buyBox.propertyType || "properties";

    if (strongMatches.length === 0 && nearMisses.length === 0) {
        return `No active ${type} listings matching ${clientName}'s criteria in ${location} today. We scanned ${totalPropertyCount} properties across Crexi, LoopNet, and MLS — we'll keep monitoring around the clock.`;
    }

    if (strongMatches.length === 0 && nearMisses.length > 0) {
        return `No exact matches for ${clientName}'s ${type} criteria today, but ${nearMisses.length} listing${nearMisses.length > 1 ? "s" : ""} came close and may be worth a second look. Scanned ${totalPropertyCount} total properties.`;
    }

    // Build dynamic summary based on top match
    const topMatch = strongMatches[0];
    const topProp = topMatch.property;
    const topPrice = safeNum(topProp.price);
    const topCity = topProp.city || "";

    let summary = `Found ${strongMatches.length} ${type} listing${strongMatches.length > 1 ? "s" : ""} matching ${clientName}'s criteria`;

    if (topCity) summary += ` in the ${location} area`;
    summary += ".";

    // Highlight the best one
    if (topPrice && topCity) {
        summary += ` Top match: ${topProp.address || topProp.propertyType} in ${topCity} at $${topPrice.toLocaleString()} (score: ${topMatch.totalScore}/100).`;
    }

    // Note near misses if any
    if (nearMisses.length > 0) {
        summary += ` Plus ${nearMisses.length} near-miss${nearMisses.length > 1 ? "es" : ""} worth reviewing.`;
    }

    return summary;
}


// ===========================================================================
// PUBLIC API: Analyze all properties for a single client
// ===========================================================================
export function analyzePropertiesForClient(
    clientId: string,
    clientName: string,
    buyBox: BuyBox,
    allProperties: any[],
): BriefResult {
    const now = new Date();

    // Score every property against this client's buy box
    const scored = allProperties.map(p => scoreProperty(p, buyBox));

    // Separate into strong matches and near-misses
    const strongMatches = scored
        .filter(s => s.classification === "strong")
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 15); // Cap at 15 matches

    const nearMisses = scored
        .filter(s => s.classification === "near-miss")
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 5); // Cap at 5 near-misses

    // Build enriched property objects (same shape the frontend expects)
    const enrichedProperties = strongMatches.map(s => {
        let taxResult = null;
        try {
            taxResult = checkTaxIncentives(s.property.zipCode || s.property.zip_code || "");
        } catch { /* non-fatal */ }

        return {
            ...s.property,
            aiMatchScore: s.totalScore,
            aiReasoning: s.reasoning,
            aiRedFlags: s.redFlags,
            taxIncentives: taxResult,
        };
    });

    const enrichedNearMisses = nearMisses.map(s => {
        const { whyItAlmostMatched, suggestion } = generateNearMissExplanation(s, buyBox);
        return {
            ...s.property,
            whyItAlmostMatched,
            suggestion,
            aiMatchScore: s.totalScore,
        };
    });

    const briefing = generateBriefingSummary(
        clientName,
        buyBox,
        strongMatches,
        nearMisses,
        allProperties.length,
    );

    return {
        clientId,
        clientName,
        generatedAt: now.toISOString(),
        scanDate: now.toISOString().split("T")[0],
        briefing,
        matchCount: enrichedProperties.length,
        properties: enrichedProperties,
        nearMisses: enrichedNearMisses,
    };
}


// ===========================================================================
// PUBLIC API: Find matches for a buy box (reusable for property search, alerts)
// ===========================================================================
export function findMatchesForBuyBox(
    buyBox: BuyBox,
    allProperties: any[],
    options?: { limit?: number; includeNearMisses?: boolean }
): { matches: ScoredProperty[]; nearMisses: ScoredProperty[] } {
    const limit = options?.limit ?? 20;
    const includeNearMisses = options?.includeNearMisses ?? true;

    const scored = allProperties.map(p => scoreProperty(p, buyBox));

    const matches = scored
        .filter(s => s.classification === "strong")
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, limit);

    const nearMisses = includeNearMisses
        ? scored
            .filter(s => s.classification === "near-miss")
            .sort((a, b) => b.totalScore - a.totalScore)
            .slice(0, 5)
        : [];

    return { matches, nearMisses };
}
