import { NextResponse } from "next/server";
import { getLatestScan } from "@/lib/db";

export async function GET() {
    try {
        const latestScan = getLatestScan();
        const totalProps = latestScan ? latestScan.properties.length : 0;

        // Build contextual starter questions based on what's in the database
        let questions: string[] = [];

        if (totalProps > 0) {
            const props = latestScan!.properties;
            const types = [...new Set(props.map(p => p.propertyType).filter(Boolean))];
            const cities = [...new Set(props.map(p => p.city).filter(Boolean))].slice(0, 5);
            const cheapest = props.filter(p => p.price && p.price > 0).sort((a, b) => (a.price || Infinity) - (b.price || Infinity))[0];

            // Pick 3 questions that are relevant to today's feed
            questions = [
                `What are the best deals in Michigan today?`,
                cities.length > 0 ? `Show me properties in ${cities[0]}` : `What's trending in the Michigan market?`,
                cheapest ? `Tell me about the cheapest listing — $${(cheapest.price || 0).toLocaleString()} in ${cheapest.city}` : `Find me commercial properties under $500K`,
            ];
        } else {
            // No data yet — generic starters
            questions = [
                "What's the current Michigan commercial market looking like?",
                "Find me industrial properties in Wayne County",
                "What should I look for in a strip center investment?"
            ];
        }

        return NextResponse.json({ suggestedQuestions: questions });
    } catch (err: any) {
        console.error("[Suggested Questions] Error:", err.message);
        return NextResponse.json({
            suggestedQuestions: [
                "Show me the best deals today",
                "What's new in Michigan real estate?",
                "Find me commercial properties"
            ]
        });
    }
}
