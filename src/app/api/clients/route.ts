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

        const now = new Date().toISOString();

        // Build the payload of fields to set
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

        // Check if a client with this name already exists
        const { data: existing, error: findError } = await supabaseAdmin
            .from('clients')
            .select('id')
            .eq('name', name)
            .maybeSingle();

        if (findError) {
            console.error("Supabase lookup error:", findError);
            return NextResponse.json({ error: findError.message }, { status: 500 });
        }

        let data, error;

        if (existing) {
            // UPDATE the existing client by their UUID
            ({ data, error } = await supabaseAdmin
                .from('clients')
                .update(fields)
                .eq('id', existing.id)
                .select()
                .single());
        } else {
            // INSERT as a new client
            ({ data, error } = await supabaseAdmin
                .from('clients')
                .insert({ name, ...fields })
                .select()
                .single());
        }

        if (error) {
            console.error("Supabase POST /api/clients error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, client: data });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
