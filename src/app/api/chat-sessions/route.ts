import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');

    let query = supabaseAdmin
        .from('chat_sessions')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(10);

    if (clientId) {
        query = query.eq('client_id', clientId);
    }

    const { data, error } = await query;
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { session, clientId } = body;

        if (!session || !session.id) {
            return NextResponse.json({ error: "Missing session data" }, { status: 400 });
        }

        const record = {
            id: session.id,
            client_id: clientId || 'global',
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
