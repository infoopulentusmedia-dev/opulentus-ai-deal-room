import { NextResponse } from "next/server";
import { getLatestScan } from "@/lib/db";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const sourceId = searchParams.get("sourceId");

        if (!sourceId) {
            return NextResponse.json({ error: "Missing sourceId parameter" }, { status: 400 });
        }

        const latestScan = getLatestScan();
        if (!latestScan || latestScan.properties.length === 0) {
            return NextResponse.json({ error: "No scan data available" }, { status: 404 });
        }

        const property = latestScan.properties.find(p => p.sourceId === sourceId);

        if (!property) {
            return NextResponse.json({ error: `Property ${sourceId} not found in today's scan` }, { status: 404 });
        }

        return NextResponse.json({ property });

    } catch (err: any) {
        console.error("[Property Lookup] Error:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
