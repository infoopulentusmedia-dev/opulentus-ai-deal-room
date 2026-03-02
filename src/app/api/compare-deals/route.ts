import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    return NextResponse.json({
        winner: "20240012",
        comparison: [
            { mlsNumber: "20240012", pros: ["Higher Cap", "Value Add"], cons: ["Condition", "Requires Cash"] },
            { mlsNumber: "20240099", pros: ["Turnkey", "Better Area"], cons: ["Lower Yield", "Priced to Perfection"] }
        ]
    });
}
