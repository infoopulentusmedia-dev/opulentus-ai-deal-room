import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/supabase/auth-helpers";

export async function GET() {
    // Returns market-intel layers — cheap to generate, but gate for consistency with the rest of the app.
    const auth = await requireAgent();
    if (auth.error) return auth.error;

    return NextResponse.json({
        layers: [
            { id: "distress_heat", band: "high", source: "realcomp", confidence: 0.9, value: "Concentrated distress in NW Detroit" }
        ],
        marketContextV2: {
            absorptionRate: "fast",
            averageDOM: 42
        }
    });
}
