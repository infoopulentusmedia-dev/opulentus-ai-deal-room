import { NextResponse } from "next/server";
import { getCrexiFeed, getLoopNetFeed } from "@/lib/apify/fetcher";
import { saveDailyScan } from "@/lib/db";
import { ApifyPropertyListing } from "@/lib/apify/mockFeed";
import { fetchRealCompProperties } from "@/lib/realcomp/api";
import { isRealcompCompliant, mapRealcompProperty } from "@/lib/realcomp/mapper";

// Vercel Cron Jobs require a GET or POST handler
export async function POST(req: Request) {
    return GET(req);
}

export async function GET(req: Request) {
    try {
        console.log("[Cron] Starting daily property scrape...");

        // Fire all fetches in parallel to minimize cron execution time
        // Realcomp fetch fetches default top N (e.g. 100)
        const [crexiData, loopnetData, rcRawData] = await Promise.all([
            getCrexiFeed().catch(e => { console.error("Crexi failed in cron", e); return []; }),
            getLoopNetFeed().catch(e => { console.error("Loopnet failed in cron", e); return []; }),
            fetchRealCompProperties({ top: 100 }).catch(e => { console.error("Realcomp failed in cron", e); return { value: [] }; })
        ]);

        const realcompListings: ApifyPropertyListing[] = (rcRawData.value || [])
            .filter(isRealcompCompliant)
            .map(mapRealcompProperty);

        // Combine all arrays
        const allListings = [...crexiData, ...loopnetData, ...realcompListings];

        // Ensure absolute uniqueness across the cron scrape just in case
        const uniqueMap = new Map<string, ApifyPropertyListing>();
        for (const l of allListings) {
            uniqueMap.set(`${l.platform}-${l.sourceId}`, l);
        }

        const finalListings = Array.from(uniqueMap.values());

        // Save to Database
        const record = await saveDailyScan(finalListings);

        console.log(`[Cron] Successfully scanned and locked in ${finalListings.length} properties for ${record.date}.`);

        // After scraping, generate pre-computed morning briefs for all clients
        try {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://opulentus.vercel.app";
            console.log("[Cron] Triggering morning brief generation for all clients...");
            const briefRes = await fetch(`${appUrl}/api/generate-client-briefs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            const briefData = await briefRes.json();
            console.log(`[Cron] Brief generation result:`, briefData);
        } catch (briefErr: any) {
            // Don't fail the cron if brief generation fails
            console.error("[Cron] Brief generation failed (non-fatal):", briefErr.message);
        }

        return NextResponse.json({
            success: true,
            message: `Locked in ${finalListings.length} properties.`,
            date: record.date,
            stats: {
                crexi: crexiData.length,
                loopnet: loopnetData.length,
                realcomp: realcompListings.length
            }
        });

    } catch (err: any) {
        console.error("[Cron API] Error:", err.message);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
