import { NextResponse } from "next/server";
import { getLiveApifyFeed } from "@/lib/apify/fetcher";
import { requireAgent } from "@/lib/supabase/auth-helpers";

export async function GET(req: Request) {
    // Each call burns paid Apify compute — require an authenticated agent.
    const auth = await requireAgent();
    if (auth.error) return auth.error;

    try {
        const { searchParams } = new URL(req.url);
        const source = searchParams.get("source");

        if (!source || !["crexi", "loopnet", "mls", "all"].includes(source)) {
            return NextResponse.json({ error: "Invalid source parameter. Use ?source=crexi|loopnet|mls|all" }, { status: 400 });
        }

        // We leverage getLiveApifyFeed to perform the live fetches, map the schemas securely, 
        // and populate the local DB instantly.
        console.log(`[Scrape Route] User triggered manual live sync for: ${source}`);
        const allProperties = await getLiveApifyFeed(source as "crexi" | "loopnet" | "mls" | "all");

        console.log(`[Scrape Route] getLiveApifyFeed returned ${allProperties.length} total properties. Platforms: ${[...new Set(allProperties.map(p => p.platform))].join(',') || 'none'}`);

        if (source === "all") {
            console.log(`[Scrape Route] Returning all ${allProperties.length} records`);
            return NextResponse.json({ source: "all", properties: allProperties });
        }

        // Filter the newly captured dataset down to just the requested source for the frontend table
        const filteredData = allProperties.filter(p => p.platform === source);
        console.log(`[Scrape Route] Returning ${filteredData.length} records for ${source}`);

        return NextResponse.json({ source, properties: filteredData });

    } catch (err: any) {
        console.error("[Scrape API Route] Error:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
