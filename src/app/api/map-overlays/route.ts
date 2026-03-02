import { NextResponse } from "next/server";

export async function GET() {
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
