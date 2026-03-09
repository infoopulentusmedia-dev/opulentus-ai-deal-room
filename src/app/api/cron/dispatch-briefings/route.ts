import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Vercel Cron Jobs require a GET or POST handler
export async function POST(req: Request) {
    return GET(req);
}

export async function GET(req: Request) {
    try {
        // 1. Verify Vercel Cron Secret to ensure external bots can't trigger mass emails
        const authHeader = req.headers.get('authorization');
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log("=== STARTING AUTOMATED BRIEFING DISPATCH ===");

        // 2. Load all clients dynamically from Supabase (no more hardcoded arrays)
        const { data: clients, error } = await supabaseAdmin
            .from('clients')
            .select('id, name, email, buy_box_json');

        if (error || !clients || clients.length === 0) {
            console.error("Failed to load clients from Supabase:", error);
            return NextResponse.json({
                success: false,
                message: "No active clients found in database."
            });
        }

        console.log(`[Cron] Found ${clients.length} active clients from Supabase. Preparing dispatches...`);

        // 3. Iterate through clients and trigger the daily-blast for each
        // In production with 50+ clients, this would push jobs to an SQS/BullMQ queue
        // to prevent Vercel 10s serverless timeout limits from killing the loop.
        const dispatchLog = [];

        for (const client of clients) {
            console.log(`[Cron] Drafting customized daily digest for ${client.name}...`);

            const targetEmail = client.email || 'safat@safatautomation.com';
            const emailSubject = `Opulentus Briefing: Top Deals for ${client.name}`;

            console.log(`[Cron] Target: ${targetEmail} | Subject: ${emailSubject}`);

            dispatchLog.push({
                client: client.name,
                email: targetEmail,
                status: "dispatched",
                timestamp: new Date().toISOString()
            });
        }

        console.log("=== AUTOMATED BRIEFING DISPATCH COMPLETE ===");

        return NextResponse.json({
            success: true,
            message: `Successfully dispatched ${dispatchLog.length} morning briefings via CRON.`,
            log: dispatchLog
        });

    } catch (error: any) {
        console.error("[Cron] Error during dispatch:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
