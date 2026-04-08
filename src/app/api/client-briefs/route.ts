import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { analyzePropertiesForClient } from "@/lib/matching/engine";

/**
 * LIVE CLIENT BRIEFS — No pre-computed storage. No stale data.
 * Reads fresh clients + properties from Supabase → runs matching engine → returns results.
 * Total time: ~3-4 seconds for 9 clients.
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const singleClientId = searchParams.get("clientId");

        // 1. Load clients
        let clients: any[] = [];
        if (singleClientId) {
            const { data, error } = await supabaseAdmin
                .from("clients")
                .select("id, name, email, buy_box_json")
                .eq("id", singleClientId);
            if (!error && data) clients = data;
        } else {
            const { data, error } = await supabaseAdmin
                .from("clients")
                .select("id, name, email, buy_box_json");
            if (!error && data) clients = data;
        }

        if (clients.length === 0) {
            return NextResponse.json({ briefs: {}, generatedAt: null });
        }

        // 2. Load recent properties (last 7 days)
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
        } else {
            // Fallback: most recent 500
            const { data: props } = await supabaseAdmin
                .from("properties")
                .select("id, platform, address, price, property_type, property_data_json")
                .order("id", { ascending: false })
                .limit(500);
            allProperties = props || [];
        }

        // Filter out null property_data_json
        allProperties = allProperties.filter(p => p.property_data_json != null);

        // 3. Run deterministic matching engine for each client
        const briefs: Record<string, any> = {};
        for (const client of clients) {
            const brief = analyzePropertiesForClient(
                client.id,
                client.name,
                client.buy_box_json || {},
                allProperties,
            );
            briefs[client.id] = brief;
        }

        return NextResponse.json({
            briefs,
            generatedAt: new Date().toISOString(),
            engine: "deterministic",
            propertyCount: allProperties.length,
        });
    } catch (err: any) {
        console.error("[Client Briefs] Error:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
