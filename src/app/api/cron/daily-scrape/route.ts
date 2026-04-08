import { NextResponse } from "next/server";
import { getCrexiFeed, getLoopNetFeed } from "@/lib/apify/fetcher";
import { saveDailyScan, cleanupOldData } from "@/lib/db";
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
            .map(mapRealcompProperty)
            .filter((p): p is ApifyPropertyListing => p !== null);

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

        // ZERO-SCRAPE GUARD: Only trigger brief generation if we actually got properties.
        // If all scrapers failed, don't regenerate — it would wipe yesterday's good briefs.
        if (finalListings.length > 0) {
            // FIRE-AND-FORGET: Don't await — brief generation runs independently with its own 300s timeout.
            try {
                const rawUrl = process.env.NEXT_PUBLIC_APP_URL || "";
                const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
                const appUrl = (rawUrl && !rawUrl.includes("localhost")) ? rawUrl : (vercelUrl || "https://opulentus.vercel.app");
                const cronSecret = process.env.CRON_SECRET || "";
                console.log("[Cron] Triggering morning brief generation (fire-and-forget)...");
                fetch(`${appUrl}/api/generate-client-briefs`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...(cronSecret ? { "x-cron-secret": cronSecret } : {}),
                    },
                }).then(res => {
                    console.log(`[Cron] Brief generation responded with status: ${res.status}`);
                }).catch(err => {
                    console.error("[Cron] Brief generation trigger failed (non-fatal):", err.message);
                });
            } catch (briefErr: any) {
                console.error("[Cron] Brief generation trigger failed (non-fatal):", briefErr.message);
            }
        } else {
            console.warn("[Cron] ZERO properties scraped — skipping brief generation to preserve existing briefs.");
        }

        // 24-hour retention: delete yesterday's scans + orphaned properties
        const cleanup = await cleanupOldData();
        console.log(`[Cron] Cleanup complete: ${cleanup.deletedScans} old scans, ${cleanup.deletedProperties} orphaned properties removed.`);

        return NextResponse.json({
            success: true,
            message: `Locked in ${finalListings.length} properties.`,
            date: record.date,
            stats: {
                crexi: crexiData.length,
                loopnet: loopnetData.length,
                realcomp: realcompListings.length
            },
            cleanup
        });

    } catch (err: any) {
        console.error("[Cron API] Error:", err.message);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
