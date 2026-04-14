import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAgent } from "@/lib/supabase/auth-helpers";

/**
 * GET /api/deal-link?id=LN-39664350
 *
 * Fetches a property from Supabase by sourceId and returns the full
 * property_data_json blob. Used by email deep links to pre-load a
 * property into the AI Deal Room without needing sessionStorage.
 *
 * Emails are sent to our agents, so the recipient should have (or
 * re-establish) a session before this API call fires.
 */
export async function GET(req: NextRequest) {
    const auth = await requireAgent();
    if (auth.error) return auth.error;

    const sourceId = req.nextUrl.searchParams.get("id");

    if (!sourceId) {
        return NextResponse.json(
            { error: "Missing required 'id' parameter (e.g., ?id=LN-39664350)" },
            { status: 400 }
        );
    }

    try {
        const { data, error } = await supabaseAdmin
            .from("properties")
            .select("property_data_json")
            .eq("id", sourceId)
            .single();

        if (error || !data) {
            return NextResponse.json(
                { error: `Property not found: ${sourceId}` },
                { status: 404 }
            );
        }

        return NextResponse.json({
            property: data.property_data_json
        });
    } catch (e: any) {
        return NextResponse.json(
            { error: e.message },
            { status: 500 }
        );
    }
}
