import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * MARKET WATCHDOG — Deterministic market intelligence alerts.
 * Analyzes property data for price trends, inventory anomalies,
 * geographic hotspots, and velocity changes. Zero AI calls.
 */

interface Alert {
    type: "price_trend" | "inventory_anomaly" | "velocity_change" | "geographic_hotspot";
    severity: "high" | "medium" | "low";
    headline: string;
    detail: string;
}

export async function GET() {
    try {
        // Load last 14 days of scans for trend comparison
        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

        const { data: scans } = await supabaseAdmin
            .from("daily_scans")
            .select("date, property_ids")
            .gte("date", fourteenDaysAgo)
            .order("date", { ascending: true });

        if (!scans || scans.length === 0) {
            return NextResponse.json({ alerts: [] });
        }

        // Split into this week vs last week
        const thisWeekIds = new Set<string>();
        const lastWeekIds = new Set<string>();
        let thisWeekCount = 0;
        let lastWeekCount = 0;

        for (const scan of scans) {
            const ids = Array.isArray(scan.property_ids) ? scan.property_ids : [];
            if (scan.date >= sevenDaysAgo) {
                ids.forEach((id: string) => thisWeekIds.add(id));
                thisWeekCount += ids.length;
            } else {
                ids.forEach((id: string) => lastWeekIds.add(id));
                lastWeekCount += ids.length;
            }
        }

        // Load current properties for analysis
        const recentIds = Array.from(thisWeekIds).slice(0, 500);
        let properties: any[] = [];
        if (recentIds.length > 0) {
            for (let i = 0; i < recentIds.length; i += 200) {
                const chunk = recentIds.slice(i, i + 200);
                const { data: props } = await supabaseAdmin
                    .from("properties")
                    .select("id, platform, price, property_type, property_data_json")
                    .in("id", chunk);
                if (props) properties.push(...props);
            }
        }

        properties = properties.filter(p => p.property_data_json != null);
        const alerts: Alert[] = [];

        // ─── ALERT 1: Inventory change week-over-week ───
        if (lastWeekCount > 0 && thisWeekCount > 0) {
            const newListings = [...thisWeekIds].filter(id => !lastWeekIds.has(id)).length;
            const removedListings = [...lastWeekIds].filter(id => !thisWeekIds.has(id)).length;
            const inventoryChange = ((thisWeekIds.size - lastWeekIds.size) / lastWeekIds.size) * 100;

            if (newListings > 5) {
                alerts.push({
                    type: "inventory_anomaly",
                    severity: newListings > 15 ? "high" : "medium",
                    headline: `${newListings} New Listings This Week`,
                    detail: `${newListings} properties appeared that weren't in last week's scan. Total active inventory is now ${thisWeekIds.size} listings (${inventoryChange > 0 ? "+" : ""}${inventoryChange.toFixed(0)}% WoW).`,
                });
            }

            if (removedListings > 3) {
                alerts.push({
                    type: "velocity_change",
                    severity: removedListings > 10 ? "high" : "medium",
                    headline: `${removedListings} Properties Went Off-Market`,
                    detail: `${removedListings} listings from last week are no longer active — likely sold or withdrawn. Market velocity is ${removedListings > 10 ? "accelerating" : "steady"}.`,
                });
            }
        }

        // ─── ALERT 2: Price drops (properties with historical price drops) ───
        const priceDrops = properties.filter(p => {
            const d = p.property_data_json;
            return d && d._historicalPriceDrop && d._historicalPriceDrop > 0;
        });

        if (priceDrops.length > 0) {
            const totalDropK = priceDrops.reduce((sum: number, p: any) => sum + (p.property_data_json._historicalPriceDrop || 0), 0) / 1000;
            const avgDropK = totalDropK / priceDrops.length;
            alerts.push({
                type: "price_trend",
                severity: priceDrops.length > 5 ? "high" : "medium",
                headline: `${priceDrops.length} Price Reductions Detected`,
                detail: `${priceDrops.length} active listings have reduced their asking price (avg drop: $${avgDropK.toFixed(0)}K). Motivated sellers may be open to below-ask offers.`,
            });
        }

        // ─── ALERT 3: Geographic hotspots (zip code concentration) ───
        const zipCounts: Record<string, number> = {};
        const cityCounts: Record<string, number> = {};
        for (const p of properties) {
            const d = p.property_data_json;
            const zip = d?.zipCode || "";
            const city = d?.city || "";
            if (zip) zipCounts[zip] = (zipCounts[zip] || 0) + 1;
            if (city) cityCounts[city] = (cityCounts[city] || 0) + 1;
        }

        // Find hottest zip code
        const hotZip = Object.entries(zipCounts).sort(([, a], [, b]) => b - a)[0];
        if (hotZip && hotZip[1] >= 4) {
            alerts.push({
                type: "geographic_hotspot",
                severity: hotZip[1] >= 8 ? "high" : "medium",
                headline: `${hotZip[1]} Listings in ZIP ${hotZip[0]}`,
                detail: `Concentrated activity in ${hotZip[0]} with ${hotZip[1]} active listings. Could indicate emerging seller activity or development opportunity.`,
            });
        }

        // ─── ALERT 4: Type distribution shift ───
        const typeCounts: Record<string, number> = {};
        for (const p of properties) {
            const t = (p.property_data_json?.propertyType || p.property_type || "other").toLowerCase();
            const category =
                t.includes("retail") || t.includes("strip") ? "Retail" :
                t.includes("industrial") || t.includes("warehouse") ? "Industrial" :
                t.includes("office") ? "Office" :
                t.includes("residential") || t.includes("single") || t.includes("multi") ? "Residential" :
                "Other";
            typeCounts[category] = (typeCounts[category] || 0) + 1;
        }

        const dominantType = Object.entries(typeCounts).sort(([, a], [, b]) => b - a)[0];
        if (dominantType && properties.length > 10) {
            const pct = Math.round((dominantType[1] / properties.length) * 100);
            if (pct > 40) {
                alerts.push({
                    type: "inventory_anomaly",
                    severity: "low",
                    headline: `${dominantType[0]} Dominates at ${pct}% of Inventory`,
                    detail: `${dominantType[0]} properties make up ${pct}% of active listings (${dominantType[1]} of ${properties.length}). ${dominantType[0] === "Retail" ? "Retail vacancy may be rising." : "Competition is concentrated in this segment."}`,
                });
            }
        }

        // ─── ALERT 5: Stale listings (properties on market 90+ days) ───
        const staleListings = properties.filter(p => {
            const dom = p.property_data_json?.daysOnPlatform;
            return dom && dom > 90;
        });

        if (staleListings.length >= 3) {
            alerts.push({
                type: "velocity_change",
                severity: staleListings.length > 8 ? "high" : "low",
                headline: `${staleListings.length} Stale Listings (90+ Days)`,
                detail: `${staleListings.length} properties have been on the market for 90+ days — potentially motivated sellers. Consider targeting these for below-market offers.`,
            });
        }

        // Sort by severity
        const severityOrder = { high: 0, medium: 1, low: 2 };
        alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

        return NextResponse.json({ alerts: alerts.slice(0, 5) });

    } catch (error: any) {
        console.error("[Market Watchdog] Error:", error.message);
        return NextResponse.json({ alerts: [] });
    }
}
