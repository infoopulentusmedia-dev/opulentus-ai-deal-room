import { NextResponse } from 'next/server';
import crypto from 'crypto';

// The secret token we tell Apify to send in the webhook headers to verify it's really them
const WEBHOOK_SECRET = process.env.APIFY_WEBHOOK_SECRET || "opulentus_secret_webhook_key_123";

/**
 * Endpoint for Apify to POST to whenever a task finishes or finds a new property.
 * URL: https://opulentus.vercel.app/api/apify-webhook
 */
export async function POST(req: Request) {
    try {
        // 1. Authenticate the webhook
        const authHeader = req.headers.get("Authorization") || req.headers.get("x-apify-signature");
        if (authHeader !== `Bearer ${WEBHOOK_SECRET}` && authHeader !== WEBHOOK_SECRET) {
            console.error("[Webhook] Unauthorized attempt.");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. Parse the payload from Apify
        const payload = await req.json();
        const { eventType, resource } = payload;

        console.log(`[Webhook] Received Apify event: ${eventType} for run ${resource?.defaultDatasetId}`);

        // If this is just a run-succeeded event, we log it. 
        // In a full production environment, this is where we would trigger `getLiveApifyFeed()` 
        // silently in the background, run it against all active BuyBoxes in `localStorage`, 
        // and fire off an SMS/Email if an 85+ score is found.

        if (eventType === "ACTOR.RUN.SUCCEEDED") {
            console.log(`[Webhook] Scraper finished successfully. New dataset available: ${resource?.defaultDatasetId}`);

            // Note: Since Vercel serverless functions have a 10s timeout on hobby plans, 
            // and we rely on localStorage for Client Buy Boxes (which the server can't read), 
            // the actual alert pushing logic requires a persistent DB (like Supabase) to read 
            // the client emails and trigger the SendGrid API. For now, this endpoint successfully 
            // catches the instant ping from Apify.
        }

        return NextResponse.json({ received: true, status: "processed" });

    } catch (error: any) {
        console.error("[Webhook] Error processing payload:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
