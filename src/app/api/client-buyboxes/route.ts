import { NextResponse } from "next/server";

export async function GET() {
    const buyBoxes = [
        { id: "bb_1", name: "Alpha Cash Flow", criteria: "Multifamily, 8%+ Cap Rate", active: true },
        { id: "bb_2", name: "Detroit Rehabs", criteria: "SFR, Distress Signals", active: false }
    ];

    return NextResponse.json({ buyBoxes });
}
