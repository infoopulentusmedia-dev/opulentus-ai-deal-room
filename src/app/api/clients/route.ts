import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET all active clients
export async function GET() {
    try {
        const { data, error } = await supabaseAdmin.from('clients').select('id, name, email, buy_box_json, alert_preferences_json, created_at');

        if (error) {
            console.error("Supabase GET /api/clients fetch error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST a new client or update an existing one
export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Destructure known potential properties
        const { id, name, email, alert_preferences_json, ...restOfBuyBox } = body;

        if (!name) {
            return NextResponse.json({ error: "Client name is required" }, { status: 400 });
        }

        const upsertPayload: any = {
            name: name,
            updated_at: new Date().toISOString()
        };

        // Only update these columns if provided in the payload
        if (Object.keys(restOfBuyBox).length > 0) {
            upsertPayload.buy_box_json = restOfBuyBox;
        }

        if (alert_preferences_json !== undefined) {
            upsertPayload.alert_preferences_json = alert_preferences_json;
        }

        if (email !== undefined) {
            upsertPayload.email = email;
        }

        // We use the admin client so it bypasses RLS safely on the backend
        const { data, error } = await supabaseAdmin.from('clients').upsert(
            upsertPayload,
            { onConflict: 'name' }
        ).select();

        if (error) {
            console.error("Supabase POST /api/clients error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, client: data[0] });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
