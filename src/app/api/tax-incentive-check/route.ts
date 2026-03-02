import { NextResponse } from "next/server";

/**
 * Step 14: Tax Incentive Zones Geo-Lookup
 *
 * In a production Opulentus build, this would query the U.S. Treasury's CDFI Fund API
 * or a cached GeoJSON of Michigan's Qualified Opportunity Zones and Renaissance Zones.
 *
 * For this implementation, we simulate the lookup using known Michigan zip codes
 * that fall within designated tax incentive zones.
 */

// Michigan Opportunity Zone Census Tracts (simplified to zip codes for demo)
const OPPORTUNITY_ZONE_ZIPS = new Set([
    "48201", "48202", "48204", "48206", "48207", "48208", "48209", "48210",
    "48211", "48212", "48213", "48214", "48215", "48216", "48217", "48219",
    "48221", "48224", "48226", "48227", "48228", "48233", "48234", "48235",
    "48238", "48501", "48502", "48503", "48504", "48505", "48506", "48507",
    "48529", "48602", "48601", "49503", "49504", "49507"
]);

// Michigan Renaissance Zone zip codes
const RENAISSANCE_ZONE_ZIPS = new Set([
    "48201", "48207", "48209", "48211", "48216", "48226",
    "48501", "48502", "48503",
    "49503"
]);

export interface TaxIncentiveResult {
    isOpportunityZone: boolean;
    isRenaissanceZone: boolean;
    incentives: string[];
}

export function checkTaxIncentives(zipCode: string): TaxIncentiveResult {
    const incentives: string[] = [];
    const isOZ = OPPORTUNITY_ZONE_ZIPS.has(zipCode);
    const isRZ = RENAISSANCE_ZONE_ZIPS.has(zipCode);

    if (isOZ) incentives.push("Qualified Opportunity Zone – Capital gains deferral & potential exclusion");
    if (isRZ) incentives.push("Renaissance Zone – Up to 15 years of tax abatements (property, income, utility)");

    return { isOpportunityZone: isOZ, isRenaissanceZone: isRZ, incentives };
}

export async function POST(req: Request) {
    try {
        const { zipCode } = await req.json();

        if (!zipCode) {
            return NextResponse.json({ error: "Missing zipCode" }, { status: 400 });
        }

        const result = checkTaxIncentives(zipCode);
        return NextResponse.json(result);

    } catch (error: any) {
        console.error("[Tax Incentive API] Error:", error.message);
        return NextResponse.json({ error: "Tax incentive check failed" }, { status: 500 });
    }
}
