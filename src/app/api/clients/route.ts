import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAgent } from '@/lib/supabase/auth-helpers';

// GET all active clients for the authenticated agent
export async function GET() {
    try {
        const auth = await requireAgent();
        if (auth.error) return auth.error;

        const { data, error } = await supabaseAdmin
            .from('clients')
            .select('id, name, email, buy_box_json, alert_preferences_json, created_at')
            .eq('agent_id', auth.agentId);

        if (error) {
            console.error("Supabase GET /api/clients fetch error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST a new client or update an existing one (scoped to authenticated agent)
export async function POST(req: Request) {
    try {
        const auth = await requireAgent();
        if (auth.error) return auth.error;

        const body = await req.json();
        const { id, name, email, alert_preferences_json, ...restOfBuyBox } = body;

        if (!name) {
            return NextResponse.json({ error: "Client name is required" }, { status: 400 });
        }

        const now = new Date().toISOString();
        const fields: any = { updated_at: now };
        if (Object.keys(restOfBuyBox).length > 0) {
            fields.buy_box_json = restOfBuyBox;
        }
        if (alert_preferences_json !== undefined) {
            fields.alert_preferences_json = alert_preferences_json;
        }
        if (email !== undefined) {
            fields.email = email;
        }

        // Check if this agent already has a client with this name
        const { data: existing, error: findError } = await supabaseAdmin
            .from('clients')
            .select('id')
            .eq('name', name)
            .eq('agent_id', auth.agentId)
            .maybeSingle();

        if (findError) {
            console.error("Supabase lookup error:", findError);
            return NextResponse.json({ error: findError.message }, { status: 500 });
        }

        let data, error;

        if (existing) {
            ({ data, error } = await supabaseAdmin
                .from('clients')
                .update(fields)
                .eq('id', existing.id)
                .eq('agent_id', auth.agentId)
                .select()
                .single());
        } else {
            ({ data, error } = await supabaseAdmin
                .from('clients')
                .insert({ name, agent_id: auth.agentId, ...fields })
                .select()
                .single());
        }

        if (error) {
            console.error("Supabase POST /api/clients error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Trigger morning brief generation for this client in the background
        if (data?.id) {
            const rawUrl = process.env.NEXT_PUBLIC_APP_URL || "";
            const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
            const appUrl = (rawUrl && !rawUrl.includes("localhost")) ? rawUrl : (vercelUrl || "https://opulentus.vercel.app");
            const cronSecret = process.env.CRON_SECRET || "";
            fetch(`${appUrl}/api/generate-client-briefs?clientId=${data.id}&agentId=${auth.agentId}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(cronSecret ? { "x-cron-secret": cronSecret } : {}),
                },
            }).catch(err => console.error("[Clients] Brief generation trigger failed (non-fatal):", err.message));
        }

        return NextResponse.json({ success: true, client: data });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
