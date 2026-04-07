import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

// GET: Read all pre-computed client morning briefs from Supabase Storage
// These are public files — no auth needed for reads
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const singleClientId = searchParams.get("clientId");

        // If requesting a single client's brief
        if (singleClientId) {
            const url = `${SUPABASE_URL}/storage/v1/object/public/briefs/${singleClientId}.json?t=${Date.now()}`;
            const res = await fetch(url, { cache: "no-store" });
            if (!res.ok) {
                return NextResponse.json({ clientId: singleClientId, briefing: "No analysis available yet.", matchCount: 0, properties: [], nearMisses: [] });
            }
            const data = await res.json();
            return NextResponse.json(data);
        }

        // Load manifest to know which clients have briefs (cache-bust to avoid CDN staleness)
        const manifestUrl = `${SUPABASE_URL}/storage/v1/object/public/briefs/manifest.json?t=${Date.now()}`;
        const manifestRes = await fetch(manifestUrl, { cache: "no-store" });

        if (!manifestRes.ok) {
            return NextResponse.json({ briefs: {}, generatedAt: null });
        }

        const manifest = await manifestRes.json();
        const clientIds: string[] = manifest.clientIds || [];

        // Fetch all briefs in parallel (with JSON parse safety)
        const briefPromises = clientIds.map(async (id: string) => {
            try {
                const url = `${SUPABASE_URL}/storage/v1/object/public/briefs/${id}.json?t=${Date.now()}`;
                const res = await fetch(url, { cache: "no-store" });
                if (!res.ok) return [id, null];
                const text = await res.text();
                try {
                    const data = JSON.parse(text);
                    // Ensure critical arrays exist to prevent frontend crashes
                    if (!Array.isArray(data.properties)) data.properties = [];
                    if (!Array.isArray(data.nearMisses)) data.nearMisses = [];
                    if (typeof data.matchCount !== "number") data.matchCount = data.properties.length;
                    return [id, data];
                } catch {
                    console.error(`[Client Briefs] Corrupt JSON for client ${id}`);
                    return [id, null];
                }
            } catch {
                return [id, null];
            }
        });

        const results = await Promise.all(briefPromises);
        const briefs: Record<string, any> = {};
        for (const [id, data] of results) {
            if (data) briefs[id as string] = data;
        }

        return NextResponse.json({
            briefs,
            generatedAt: manifest.generatedAt,
        });
    } catch (err: any) {
        console.error("[Client Briefs] Error:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
