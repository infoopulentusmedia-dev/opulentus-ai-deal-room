import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    return NextResponse.json({
        variant: "+10% Budget",
        added: ["20240105"],
        dropped: ["20240012"],
        insight: "Bumping budget adds stronger B-class neighborhoods but lowers average cap by 1.2%."
    });
}
