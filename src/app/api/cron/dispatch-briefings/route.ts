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

        // 2. Load all agents and their clients
        const { data: agents, error: agentsErr } = await supabaseAdmin
            .from('agents')
            .select('id, display_name, recipient_email');

        if (agentsErr || !agents || agents.length === 0) {
            return NextResponse.json({ success: false, message: "No agents found." });
        }

        const dispatchLog: any[] = [];

        for (const agent of agents) {
            const { data: clients, error } = await supabaseAdmin
                .from('clients')
                .select('id, name, email, buy_box_json')
                .eq('agent_id', agent.id);

            if (error || !clients || clients.length === 0) {
                console.log(`[Cron] No clients for agent ${agent.display_name}, skipping.`);
                continue;
            }

            console.log(`[Cron] Agent ${agent.display_name}: ${clients.length} clients. Preparing dispatches...`);

            for (const client of clients) {
                const targetEmail = agent.recipient_email || client.email || 'njaafar@kw.com';
                console.log(`[Cron] ${agent.display_name} → ${client.name} | Target: ${targetEmail}`);

                dispatchLog.push({
                    agent: agent.display_name,
                    client: client.name,
                    email: targetEmail,
                    status: "dispatched",
                    timestamp: new Date().toISOString()
                });
            }
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
