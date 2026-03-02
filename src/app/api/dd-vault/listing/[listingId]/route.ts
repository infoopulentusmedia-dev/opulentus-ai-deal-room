import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ listingId: string }> }) {
    const { listingId } = await params;
    return NextResponse.json({
        listingId,
        docs: [
            { id: "doc_1", name: "Property Disclosures.pdf", type: "disclosure", uploadedAt: "2026-02-25T10:00:00Z" }
        ],
        extractedMetrics: {
            "Roof Age": { value: "Unknown, needs replacement", confidence: 0.95 }
        },
        unreadUpdates: 1
    });
}
