import { NextResponse } from "next/server";

export async function GET() {
    const watchtower = {
        totals: {
            watchlistItems: 12,
            unreadAlerts: 5,
            criticalAlerts: 3
        },
        topActions: ["Review 19420 Grand River Ave price drop", "Approve offer letter for BB_2"],
        dailyFinds: [
            { address: "19420 Grand River Ave", price: "$145,000", tag: "High Upside", dom: "2 DOM", mlsNumber: "20240012" },
            { address: "8124 E Jefferson Ave", price: "$290,000", tag: "Cash Flow", dom: "New", mlsNumber: "20240099" }
        ],
        scheduledNextRun: "2026-02-27T13:00:00Z"
    };

    return NextResponse.json(watchtower);
}
