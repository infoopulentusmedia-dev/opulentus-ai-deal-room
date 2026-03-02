import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    return NextResponse.json({ success: true, action: "save_listing", id: "20240012" });
}

export async function GET(req: NextRequest) {
    return NextResponse.json({ items: ["20240012", "20240099"] });
}
