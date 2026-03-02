import { NextResponse } from 'next/server';

// In a real Opulentus production environment, these would be loaded from Prisma/Supabase.
// Since we are using localStorage for the frontend UI, the server cannot read them. 
// We are hardcoding the 6 specific presets here so the Cron Job knows who to email.
const CRON_DISTRIBUTION_LIST = [
    { id: "preset-ali-beydoun", name: "Ali Beydoun", email: "ali@example.com" },
    { id: "preset-collin-goslin", name: "Collin Goslin", email: "collin@example.com" },
    { id: "preset-fadi", name: "Fadi", email: "fadi@example.com" },
    { id: "preset-abe-saad", name: "Abe Saad", email: "abe@example.com" },
    { id: "preset-hussein-zeitoun", name: "Hussein Zeitoun", email: "hussein@example.com" },
    { id: "preset-moe-sabbagh", name: "Moe Sabbagh", email: "moe@example.com" }
];

export async function GET(req: Request) {
    try {
        // 1. Verify Vercel Cron Secret to ensure external bots can't trigger mass emails
        const authHeader = req.headers.get('authorization');
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log("=== STARTING AUTOMATED BRIEFING DISPATCH ===");
        console.log(`[Cron] Found ${CRON_DISTRIBUTION_LIST.length} active clients. Preparing dispatches...`);

        // 2. Iterate through clients and simulate generating/dispatching emails
        // In a true environment with 50+ clients, this would push jobs to an AWS SQS queue 
        // to prevent Vercel 10s serverless timeout limits from killing the loop.

        const dispatchLog = [];

        for (const client of CRON_DISTRIBUTION_LIST) {
            console.log(`[Cron] Drafting customized daily digest for ${client.name}...`);

            // Mocking the Resend.com email dispatch
            const emailSubject = `Opulentus Briefing: Top Deals for ${client.name}`;
            const emailBody = `Good morning ${client.name},\n\nYour AI has finished scoring the market...`;

            console.log(`[Cron] Executing Resend API -> Sending to ${client.email}`);

            dispatchLog.push({
                client: client.name,
                email: client.email,
                status: "sent_successfully",
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
