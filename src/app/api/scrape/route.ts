import { NextResponse } from "next/server";
import { getLatestScan } from "@/lib/db";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const source = searchParams.get("source");

        // Instantly read today's locked-in database snapshot instead of live fetching
        const latestScan = getLatestScan();
        const allProperties = latestScan ? latestScan.properties : [];

        if (source === "crexi") {
            const data = allProperties.filter(p => p.platform === "crexi");
            return NextResponse.json({ source: "crexi", properties: data });
        }

        if (source === "loopnet") {
            const data = allProperties.filter(p => p.platform === "loopnet");
            return NextResponse.json({ source: "loopnet", properties: data });
        }

        if (source === "mls") {
            const data = allProperties.filter(p => p.platform === "mls");
            return NextResponse.json({ source: "mls", properties: data });
        }

        return NextResponse.json({ error: "Invalid or missing source parameter. Use ?source=crexi|loopnet|mls" }, { status: 400 });

    } catch (err: any) {
        console.error("[Scrape API] Error:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
