import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    return NextResponse.json({
        template: "standard_brief",
        title: "Investment Brief: 19420 Grand River Ave",
        summary: "Strong value-add play in NW Detroit requiring $40k CapEx.",
        markdown: "# Investment Brief\n\n## 19420 Grand River Ave\n*..."
    });
}
