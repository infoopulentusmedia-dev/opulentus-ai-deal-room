import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAgent } from '@/lib/supabase/auth-helpers';

export async function GET(req: Request) {
    const auth = await requireAgent();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');

    let query = supabaseAdmin
        .from('chat_sessions')
        .select('*')
        .eq('agent_id', auth.agentId)
        .order('updated_at', { ascending: false })
        .limit(10);

    if (clientId) {
        query = query.eq('client_id', clientId);
    }

    const { data, error } = await query;
    if (error) {
        console.error("Supabase fetch chat_sessions error:", error);
        return NextResponse.json([], { status: 200 });
    }

    return NextResponse.json(data);
}

export async function POST(req: Request) {
    try {
        const auth = await requireAgent();
        if (auth.error) return auth.error;

        const body = await req.json();
        const { session, clientId } = body;

        if (!session || !session.id) {
            return NextResponse.json({ error: "Missing session data" }, { status: 400 });
        }

        const record = {
            id: session.id,
            client_id: clientId || 'global',
            agent_id: auth.agentId,
            chat_json: session,
            updated_at: new Date(session.updatedAt || Date.now()).toISOString()
        };

        const { error } = await supabaseAdmin
            .from('chat_sessions')
            .upsert(record, { onConflict: 'id' });

        if (error) {
            console.error("Supabase upsert error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
