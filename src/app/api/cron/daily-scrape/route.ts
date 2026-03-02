import { NextResponse } from "next/server";
import { getCrexiFeed, getLoopNetFeed } from "@/lib/apify/fetcher";
import { saveDailyScan } from "@/lib/db";
import { ApifyPropertyListing } from "@/lib/apify/mockFeed";

// Vercel Cron Jobs require a GET or POST handler
export async function GET(req: Request) {
    try {
        console.log("[Cron] Starting daily property scrape...");

        // Fire all fetches in parallel to minimize cron execution time
        const [crexiData, loopnetData] = await Promise.all([
            getCrexiFeed().catch(e => { console.error("Crexi failed in cron", e); return []; }),
            getLoopNetFeed().catch(e => { console.error("Loopnet failed in cron", e); return []; })
        ]);

        // Combine all arrays
        const allListings = [...crexiData, ...loopnetData];

        // Ensure absolute uniqueness across the cron scrape just in case
        const uniqueMap = new Map<string, ApifyPropertyListing>();
        for (const l of allListings) {
            uniqueMap.set(`${l.platform}-${l.sourceId}`, l);
        }

        const finalListings = Array.from(uniqueMap.values());

        // Save to Database
        const record = saveDailyScan(finalListings);

        console.log(`[Cron] Successfully scanned and locked in ${finalListings.length} properties for ${record.date}.`);

        return NextResponse.json({
            success: true,
            message: `Locked in ${finalListings.length} properties.`,
            date: record.date,
            stats: {
                crexi: crexiData.length,
                loopnet: loopnetData.length
            }
        });

    } catch (err: any) {
        console.error("[Cron API] Error:", err.message);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
