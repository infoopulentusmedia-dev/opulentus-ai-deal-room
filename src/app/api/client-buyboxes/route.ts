import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAgent } from "@/lib/supabase/auth-helpers";

export async function GET() {
    try {
        const auth = await requireAgent();
        if (auth.error) return auth.error;

        const { data, error } = await supabaseAdmin
            .from('clients')
            .select('id, name, buy_box_json')
            .eq('agent_id', auth.agentId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error("Supabase GET /api/client-buyboxes error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const buyBoxes = (data || []).map((client: any) => {
            const bb = client.buy_box_json || {};
            return {
                id: client.id,
                name: client.name,
                propertyType: bb.propertyType || "Commercial",
                transactionType: bb.transactionType || "Buy",
                location: bb.location || "Any Location",
                priceMin: bb.priceMin || "",
                priceMax: bb.priceMax || "",
                sizeMin: bb.sizeMin || "",
                sizeMax: bb.sizeMax || "",
                specialCriteria: bb.specialCriteria || "",
                active: true,
            };
        });

        return NextResponse.json({ buyBoxes });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
