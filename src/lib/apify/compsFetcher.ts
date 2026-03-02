import { ApifyCompListing, mockClosedComps } from "./mockComps";

/**
 * Simulates querying an Apify dataset of closed CoStar/Crexi/LoopNet sales.
 * In production, it would hit the Apify API using the same client logic as `fetcher.ts`.
 */
export async function getLocalComps(propertyType: string, zipCode: string, radiusMiles = 5): Promise<ApifyCompListing[]> {
    console.log(`[Apify Comps] Fetching closed sales for ${propertyType} near ${zipCode}`);

    // Simulate network latency for hitting the Apify dataset
    await new Promise(resolve => setTimeout(resolve, 800));

    // Filter the generic comp database to find relevant sales
    const relevantComps = mockClosedComps.filter(comp => {
        // Must match property type loosely
        const typeMatch = comp.propertyType.includes(propertyType) || propertyType.includes(comp.propertyType) || comp.propertyType === "Retail";

        // In this simulation, we'll just check if the first 3 digits of the zip match (roughly same county region)
        const regionMatch = comp.zipCode.substring(0, 3) === zipCode.substring(0, 3);

        return typeMatch && regionMatch;
    });

    console.log(`[Apify Comps] Found ${relevantComps.length} matching closed sales.`);
    return relevantComps;
}
