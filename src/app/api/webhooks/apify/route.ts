import { NextRequest, NextResponse } from "next/server";
import { getCrexiFeed, getLoopNetFeed } from "@/lib/apify/fetcher";
import { fetchRealCompProperties } from "@/lib/realcomp/api";
import { isRealcompCompliant, mapRealcompProperty } from "@/lib/realcomp/mapper";
import { saveDailyScan } from "@/lib/db";
import { ApifyPropertyListing } from "@/lib/apify/mockFeed";

export async function POST(req: NextRequest) {
    // 1. Authenticate the webhook. FAIL-CLOSED: refuse if APIFY_WEBHOOK_SECRET
    // is unset rather than fall back to a hardcoded default (prior behaviour
    // leaked a public secret via the repo).
    const WEBHOOK_SECRET = process.env.APIFY_WEBHOOK_SECRET || "";
    if (!WEBHOOK_SECRET) {
        console.error("[apify webhook] APIFY_WEBHOOK_SECRET is not set — refusing webhook");
        return NextResponse.json(
            { error: "Server misconfigured: APIFY_WEBHOOK_SECRET not set" },
            { status: 500 }
        );
    }

    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {

        const payload = await req.json();
        console.log(`[Webhook] Received Apify Trigger from Actor: ${payload.actorId}, Run: ${payload.resource?.defaultDatasetId}`);

        // Technically we can fetch just the dataset ID provided in the payload,
        // but for simplicity and safety, we will just trigger the standard combined fetch
        // which downloads the `latest` datasets from both actors.
        
        console.log("[Webhook] Starting backend property ingestion pipeline...");

        const [crexiData, loopnetData, rcRawData] = await Promise.all([
            getCrexiFeed().catch(e => { console.error("Crexi failed in webhook", e); return []; }),
            getLoopNetFeed().catch(e => { console.error("Loopnet failed in webhook", e); return []; }),
            fetchRealCompProperties({ top: 100 }).catch(e => { console.error("Realcomp failed in webhook", e); return { value: [] }; })
        ]);

        const realcompListings: ApifyPropertyListing[] = (rcRawData.value || [])
            .filter(isRealcompCompliant)
            .map(mapRealcompProperty);

        // Combine all arrays
        const allListings = [...crexiData, ...loopnetData, ...realcompListings];

        // Ensure uniqueness
        const uniqueMap = new Map<string, ApifyPropertyListing>();
        for (const l of allListings) {
            uniqueMap.set(`${l.platform}-${l.sourceId}`, l);
        }

        const finalListings = Array.from(uniqueMap.values());

        // Save to Database
        const record = await saveDailyScan(finalListings);
        console.log(`[Webhook] Successfully saved ${finalListings.length} properties to Supabase.`);

        // --- AUTOMATED PUSH COMPONENT ---
        // Instead of waiting for 6:00 AM, the webhook immediately runs the Daily Blast script
        // because we know we just got 100% fresh data.
        
        console.log("[Webhook] Instantly triggering the Daily Blast AI processing...");
        
        // Fire it asynchronously so we don't hold the Apify webhook connection open
        // and risk a timeout while Gemini processes 50 properties.
        // daily-blast now requires CRON_SECRET (SS-1 gate) — forward it on the internal call.
        const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const cronSecret = process.env.CRON_SECRET || "";
        fetch(`${APP_URL}/api/cron/daily-blast`, {
            method: 'POST',
            headers: cronSecret ? { "x-cron-secret": cronSecret } : {},
            // No need to await, let it run detached
        }).catch(err => console.error("Failed to trigger Daily Blast from webhook", err));

        return NextResponse.json({
            success: true,
            message: `Locked in ${finalListings.length} properties and triggered Daily Blast.`,
            stats: {
                crexi: crexiData.length,
                loopnet: loopnetData.length,
                realcomp: realcompListings.length
            }
        });

    } catch (err: any) {
        console.error("[Webhook API] Error:", err.message);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
