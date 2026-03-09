/**
 * Bulletproof Property URL Resolver
 * 
 * Guarantees a valid, clickable property URL for every listing across
 * Crexi, LoopNet, and RealComp/MLS platforms. Handles all edge cases:
 * 
 * - Crexi: URLs work in browser but return 403 to server-side HEAD requests (bot protection).
 *          We trust the stored URL if it matches the crexi.com/properties/{id} pattern.
 * - LoopNet: URLs require address slug + ID. Stored URLs from Apify are canonical.
 *            Fallback reconstructs slug from address + city + state fields.
 * - MLS/RealComp: No public consumer pages exist. Multi-aggregator fallback chain:
 *            Zillow → Realtor.com → Redfin → Google search.
 */

// Known domains that don't serve public property pages
const DEAD_DOMAINS = ['realcomp.com'];

export interface ResolvedUrl {
    url: string;
    source: 'stored' | 'reconstructed' | 'aggregator_zillow' | 'aggregator_realtor' | 'aggregator_redfin' | 'google_search';
    confidence: 'high' | 'medium' | 'low';
    platform: string;
}

/**
 * Main entry point — resolves the best possible URL for a property.
 */
export function resolvePropertyUrl(property: any): ResolvedUrl {
    const platform = (property.platform || '').toLowerCase();
    const stored = property.propertyUrl || '';

    // Step 1: Check if stored URL is from a known-dead domain
    const isDead = DEAD_DOMAINS.some(d => stored.includes(d));

    // Step 2: Platform-specific resolution
    switch (platform) {
        case 'crexi':
            return resolveCrexiUrl(property, stored, isDead);
        case 'loopnet':
            return resolveLoopNetUrl(property, stored, isDead);
        case 'mls':
            return resolveMlsUrl(property, stored);
        default:
            return resolveGenericUrl(property, stored, isDead);
    }
}

/**
 * Convenience wrapper that just returns the URL string.
 */
export function getResolvedUrl(property: any): string {
    return resolvePropertyUrl(property).url;
}

// ─────────────────────────────────────────────────────────────────────
// CREXI RESOLVER
// ─────────────────────────────────────────────────────────────────────

function resolveCrexiUrl(property: any, stored: string, isDead: boolean): ResolvedUrl {
    const sourceId = property.sourceId || '';
    const numericId = sourceId.replace('CRX-', '');

    // Case 1: Stored URL is a valid Crexi URL containing the correct numeric ID
    // Crexi returns 403 to server-side requests but works in browser — so we trust it
    if (
        stored &&
        stored.includes('crexi.com/properties/') &&
        stored.includes(numericId) &&
        !isDead
    ) {
        return { url: stored, source: 'stored', confidence: 'high', platform: 'crexi' };
    }

    // Case 2: Stored URL is from a different domain or empty — reconstruct
    if (numericId) {
        // Crexi URL format: https://www.crexi.com/properties/{numericId}
        // The slug after the ID is optional — Crexi redirects to the canonical URL
        return {
            url: `https://www.crexi.com/properties/${numericId}`,
            source: 'reconstructed',
            confidence: 'high',
            platform: 'crexi'
        };
    }

    // Case 3: No numeric ID available — use Google search as last resort
    return googleSearchFallback(property, 'crexi');
}

// ─────────────────────────────────────────────────────────────────────
// LOOPNET RESOLVER
// ─────────────────────────────────────────────────────────────────────

function resolveLoopNetUrl(property: any, stored: string, isDead: boolean): ResolvedUrl {
    const sourceId = property.sourceId || '';
    const numericId = sourceId.replace('LN-', '');

    // Case 1: Stored URL has proper /Listing/{slug}/{id}/ format
    const properFormat = /loopnet\.com\/Listing\/[A-Za-z0-9-]+\/\d+\/?$/;
    if (stored && properFormat.test(stored) && stored.includes(numericId) && !isDead) {
        return { url: stored, source: 'stored', confidence: 'high', platform: 'loopnet' };
    }

    // Case 2: Stored URL exists but is in wrong format (e.g., missing slug)
    // Reconstruct with proper slug format
    if (numericId) {
        const address = property.address || '';
        const city = property.city || '';
        const state = property.state || '';

        // Build slug: "4536 Michigan Ave, Detroit, MI" -> "4536-Michigan-Ave-Detroit-MI"
        const rawSlug = `${address} ${city} ${state}`
            .replace(/,/g, '')          // Remove commas
            .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special chars
            .trim()
            .replace(/\s+/g, '-');      // Spaces to hyphens

        if (rawSlug && rawSlug !== '--') {
            return {
                url: `https://www.loopnet.com/Listing/${rawSlug}/${numericId}/`,
                source: 'reconstructed',
                confidence: 'high',
                platform: 'loopnet'
            };
        }

        // Case 3: No address available — LoopNet can sometimes resolve by ID alone
        // (it will redirect to the canonical URL)
        return {
            url: `https://www.loopnet.com/Listing/${numericId}/`,
            source: 'reconstructed',
            confidence: 'medium',
            platform: 'loopnet'
        };
    }

    return googleSearchFallback(property, 'loopnet');
}

// ─────────────────────────────────────────────────────────────────────
// MLS / REALCOMP RESOLVER
// ─────────────────────────────────────────────────────────────────────

function resolveMlsUrl(property: any, stored: string): ResolvedUrl {
    const address = (property.address || '').trim();
    const city = (property.city || '').replace(/_/g, ' ').trim(); // Clean "FabiusTownship_StJoseph" → "FabiusTownship StJoseph"
    const state = (property.state || 'MI').trim();
    const zipCode = (property.zipCode || '').trim();
    const sourceId = property.sourceId || '';

    // MLS properties have NO public consumer URL on realcomp.com.
    // Multi-strategy fallback chain:

    // Strategy 1: Zillow (most comprehensive, best SEO)
    if (address && address !== 'Unknown Address' && zipCode) {
        const zillowQuery = `${address} ${city} ${state} ${zipCode}`
            .replace(/\s+/g, '-')
            .replace(/[^a-zA-Z0-9-]/g, '');
        return {
            url: `https://www.zillow.com/homes/${encodeURIComponent(address + ' ' + zipCode)}_rb/`,
            source: 'aggregator_zillow',
            confidence: 'high',
            platform: 'mls'
        };
    }

    // Strategy 2: Realtor.com search (fallback if address is incomplete)
    if (address && address !== 'Unknown Address') {
        const searchQuery = `${address} ${city} ${state} ${zipCode}`.trim();
        return {
            url: `https://www.realtor.com/realestateandhomes-search/${encodeURIComponent(searchQuery)}`,
            source: 'aggregator_realtor',
            confidence: 'medium',
            platform: 'mls'
        };
    }

    // Strategy 3: Redfin (works well for residential by zip code)
    if (zipCode) {
        return {
            url: `https://www.redfin.com/zipcode/${zipCode}`,
            source: 'aggregator_redfin',
            confidence: 'low',
            platform: 'mls'
        };
    }

    // Strategy 4: Google search with MLS ID
    return googleSearchFallback(property, 'mls');
}

// ─────────────────────────────────────────────────────────────────────
// GENERIC / GOOGLE FALLBACK
// ─────────────────────────────────────────────────────────────────────

function resolveGenericUrl(property: any, stored: string, isDead: boolean): ResolvedUrl {
    if (stored && stored.startsWith('http') && !isDead) {
        return { url: stored, source: 'stored', confidence: 'medium', platform: property.platform || 'unknown' };
    }
    return googleSearchFallback(property, property.platform || 'unknown');
}

function googleSearchFallback(property: any, platform: string): ResolvedUrl {
    const address = property.address || '';
    const city = property.city || '';
    const state = property.state || '';
    const sourceId = property.sourceId || '';

    // Construct the best possible Google search query
    let query = '';
    if (address && address !== 'Unknown Address') {
        query = `${address} ${city} ${state} commercial property for sale`;
    } else if (sourceId) {
        query = `${sourceId} ${platform} property listing`;
    } else {
        query = `commercial property ${city} ${state}`;
    }

    return {
        url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        source: 'google_search',
        confidence: 'low',
        platform
    };
}
