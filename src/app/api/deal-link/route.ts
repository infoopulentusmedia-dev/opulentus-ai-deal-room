import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/deal-link?id=LN-39664350
 * 
 * Fetches a property from Supabase by sourceId and returns the full
 * property_data_json blob. Used by email deep links to pre-load a
 * property into the AI Deal Room without needing sessionStorage.
 */
export async function GET(req: NextRequest) {
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
