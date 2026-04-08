import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { analyzePropertiesForClient, BuyBox } from "@/lib/matching/engine";
import { BuyBoxCriteria } from "@/lib/buybox";

/**
 * MORNING BRIEF — Deterministic matching, zero AI calls.
 * Takes a single client's buy box, matches against recent properties.
 */
export async function POST(req: Request) {
    try {
        const { buybox } = await req.json() as { buybox: BuyBoxCriteria };

        if (!buybox) {
            return NextResponse.json({ error: "Missing buybox criteria." }, { status: 400 });
        }

        // Load recent properties from Supabase
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const { data: recentScans } = await supabaseAdmin
            .from("daily_scans")
            .select("property_ids")
            .gte("date", sevenDaysAgo)
            .order("date", { ascending: false })
            .limit(7);

        let allProperties: any[] = [];
        if (recentScans && recentScans.length > 0) {
            const allIds = new Set<string>();
            for (const scan of recentScans) {
                if (Array.isArray(scan.property_ids)) {
                    for (const id of scan.property_ids) allIds.add(id);
                }
            }
            if (allIds.size > 0) {
                const idArray = Array.from(allIds);
                for (let i = 0; i < idArray.length; i += 200) {
                    const chunk = idArray.slice(i, i + 200);
                    const { data: props } = await supabaseAdmin
                        .from("properties")
                        .select("id, platform, address, price, property_type, property_data_json")
                        .in("id", chunk);
                    if (props) allProperties.push(...props);
                }
            }
        }

        allProperties = allProperties.filter(p => p.property_data_json != null);

        if (allProperties.length === 0) {
            return NextResponse.json({
                clientId: buybox.id,
                clientName: buybox.name,
                briefing: "No active listings found in either the commercial scrapers or MLS today.",
                matchCount: 0,
                properties: [],
                nearMisses: [],
            });
        }

        // Run deterministic matching
        const result = analyzePropertiesForClient(
            buybox.id || "unknown",
            buybox.name || "Client",
            buybox as unknown as BuyBox,
            allProperties,
        );

        return NextResponse.json(result);

    } catch (error: any) {
        console.error("[Morning Brief API] Error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
