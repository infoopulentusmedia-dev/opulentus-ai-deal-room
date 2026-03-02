import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Stub response for the fallback search route
        const searchDiagnostics = {
            passUsed: "strict",
            countyResolutionMode: "exact",
            strictResultCount: 1,
            fallbackResultCount: 0,
            commercialConfidence: 0.1,
            provider: "realcomp",
            realcompUsed: true,
            endpointUsed: "https://idxapi.realcomp.com/odata/Property",
        };

        const properties = [
            {
                listingId: "12345",
                mlsNumber: "20240012",
                address: "19420 Grand River Ave",
                city: "Detroit",
                state: "MI",
                zip: "48223",
                county: "Wayne",
                pricing: { listPrice: 145000, originalPrice: 160000 },
                status: "Active",
                dom: 124,
                remarks: "Cash only, major roof repair needed. Value-add opportunity.",
                marketContext: {
                    medianPrice: 180000,
                    averageDOM: 45
                },
                scoreFields: {
                    dealScore: 94,
                    scoreBand: "excellent",
                    reasons: ["price_drop", "high_dom", "high_cap_potential"],
                    watchouts: ["major_capex_needed"],
                    missingDataReasons: []
                },
                realcompFilteredByDistress: true
            }
        ];

        return NextResponse.json({
            properties,
            searchDiagnostics,
        });
    } catch (error) {
        return NextResponse.json({ error: "Search failed" }, { status: 500 });
    }
}
