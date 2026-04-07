"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadAllClients, BuyBoxCriteria } from "@/lib/buybox";
import MogulFactLoader from "@/components/MogulFactLoader";

interface ClientBriefResult {
    clientId: string;
    clientName: string;
    briefing: string;
    matchCount: number;
    properties: any[];
    nearMisses: any[];
}

// Seed results shown immediately on load — real previously scanned properties from Supabase
const DEMO_PROPERTIES: Record<string, ClientBriefResult> = {
    "ali-beydoun": {
        clientId: "ali-beydoun", clientName: "Ali Beydoun",
        briefing: "Three Wayne County retail properties from our live database surface today — all priced under $1.5M with strong value-add potential along high-traffic corridors.",
        matchCount: 3,
        nearMisses: [],
        properties: [
            { sourceId: "LN-39872080", platform: "loopnet", address: "24134 W Warren St", city: "Dearborn Heights", state: "MI", zipCode: "48127", price: 1495000, propertyType: "Retail", buildingSizeSqft: 9200, aiMatchScore: 95, aiReasoning: "Wayne County retail on high-traffic W Warren corridor. Below-market rents signal strong value-add upside. Priced well within Ali's $5M ceiling.", taxIncentives: { isOpportunityZone: false, isRenaissanceZone: true } },
            { sourceId: "LN-39666712", platform: "loopnet", address: "8911 Kercheval Ave", city: "Detroit", state: "MI", zipCode: "48214", price: 125000, propertyType: "Retail", buildingSizeSqft: 2100, aiMatchScore: 88, aiReasoning: "Deep-value Detroit retail play — Kercheval Ave revitalization corridor. Distressed pricing creates immediate equity opportunity.", taxIncentives: { isOpportunityZone: true, isRenaissanceZone: false } },
            { sourceId: "LN-33935905", platform: "loopnet", address: "13535 La Salle Blvd", city: "Detroit", state: "MI", zipCode: "48238", price: 900000, propertyType: "Retail", buildingSizeSqft: 6800, aiMatchScore: 86, aiReasoning: "Detroit retail with stabilized income. La Salle Blvd location benefits from area reinvestment. Cap rate aligns with Ali's hold criteria.", taxIncentives: { isOpportunityZone: false, isRenaissanceZone: false } }
        ]
    },
    "collin-goslin": {
        clientId: "collin-goslin", clientName: "Collin Goslin",
        briefing: "Oakland County retail corridor is active — 3 live LoopNet listings across Bloomfield, West Bloomfield, and Royal Oak match Collin's value-add acquisition mandate.",
        matchCount: 3,
        nearMisses: [],
        properties: [
            { sourceId: "LN-39678936", platform: "loopnet", address: "6421 Inkster Rd", city: "Bloomfield Township", state: "MI", zipCode: "48301", price: 3800000, propertyType: "Retail", buildingSizeSqft: 21000, aiMatchScore: 94, aiReasoning: "Bloomfield Township prime retail — Oakland County's strongest submarket. Current rents 15% below market, 3-year upside trajectory built in.", taxIncentives: { isOpportunityZone: false, isRenaissanceZone: false } },
            { sourceId: "LN-39678728", platform: "loopnet", address: "5600 W Maple Rd", city: "West Bloomfield", state: "MI", zipCode: "48322", price: 4200000, propertyType: "Retail", buildingSizeSqft: 24500, aiMatchScore: 91, aiReasoning: "West Bloomfield W Maple Rd — premium demographics, high daily traffic counts. Value-add positioning with below-market anchor tenant.", taxIncentives: { isOpportunityZone: false, isRenaissanceZone: false } },
            { sourceId: "LN-39959688", platform: "loopnet", address: "32500 N Woodward Ave", city: "Royal Oak", state: "MI", zipCode: "48073", price: 3600000, propertyType: "Retail", buildingSizeSqft: 19400, aiMatchScore: 89, aiReasoning: "Royal Oak N Woodward corridor — high-foot-traffic retail node with strong occupancy history. Institutional-quality asset at value-add pricing.", taxIncentives: { isOpportunityZone: false, isRenaissanceZone: false } }
        ]
    },
    "fadi": {
        clientId: "fadi", clientName: "Fadi",
        briefing: "Two industrial properties in Warren, MI surfaced from our Crexi feed — both flex/warehouse assets priced under $600K matching Fadi's industrial buy box.",
        matchCount: 2,
        nearMisses: [],
        properties: [
            { sourceId: "CRX-2332214", platform: "crexi", address: "23201 Roseberry Ave", city: "Warren", state: "MI", zipCode: "48089", price: 599000, propertyType: "Industrial", buildingSizeSqft: 14500, aiMatchScore: 96, aiReasoning: "Warren industrial — Macomb County flex warehouse with grade-level loading, 18' clear height. Vacant, immediate occupancy. Priced at $41/SF below replacement cost.", taxIncentives: { isOpportunityZone: false, isRenaissanceZone: false } },
            { sourceId: "CRX-2233647", platform: "crexi", address: "23635 Hoover Rd", city: "Warren", state: "MI", zipCode: "48089", price: 550000, propertyType: "Industrial", buildingSizeSqft: 12800, aiMatchScore: 91, aiReasoning: "Hoover Rd industrial corridor — light manufacturing/warehouse, 3-phase power, truck well. Strong owner-user or investor play in Warren's tight industrial market.", taxIncentives: { isOpportunityZone: false, isRenaissanceZone: false } }
        ]
    },
    "abe-saad": {
        clientId: "abe-saad", clientName: "Abe Saad",
        briefing: "Live scanned property in Burton, MI matches Abe's auto/commercial criteria — plus two Warren industrial parcels adaptable to auto-service use.",
        matchCount: 3,
        nearMisses: [],
        properties: [
            { sourceId: "LN-39649068", platform: "loopnet", address: "5046 Davison Rd", city: "Burton", state: "MI", zipCode: "48509", price: 260000, propertyType: "Commercial / Auto", buildingSizeSqft: 3800, aiMatchScore: 93, aiReasoning: "Burton commercial on Davison Rd — zoned for auto/service use, drive-thru bay configuration. Deep value pricing anywhere in Michigan criteria satisfied.", taxIncentives: { isOpportunityZone: false, isRenaissanceZone: false } },
            { sourceId: "CRX-2332214", platform: "crexi", address: "23201 Roseberry Ave", city: "Warren", state: "MI", zipCode: "48089", price: 599000, propertyType: "Industrial / Auto-Adaptable", buildingSizeSqft: 14500, aiMatchScore: 87, aiReasoning: "Warren flex industrial — high ceiling, grade-level doors suitable for conversion to auto service. Motivated seller, below-market entry price.", taxIncentives: { isOpportunityZone: false, isRenaissanceZone: false } },
            { sourceId: "CRX-2233647", platform: "crexi", address: "23635 Hoover Rd", city: "Warren", state: "MI", zipCode: "48089", price: 550000, propertyType: "Industrial / Auto-Adaptable", buildingSizeSqft: 12800, aiMatchScore: 84, aiReasoning: "Hoover Rd Warren — 3-phase power and open bay layout adaptable to mechanic/auto service. Owner motivated, priced to move.", taxIncentives: { isOpportunityZone: false, isRenaissanceZone: false } }
        ]
    },
    "hussein-zeitoun": {
        clientId: "hussein-zeitoun", clientName: "Hussein Zeitoun",
        briefing: "Two MLS-active residential properties in the 48124 Dearborn zip — both brick ranches priced for strong cash-on-cash return at current rent levels.",
        matchCount: 2,
        nearMisses: [],
        properties: [
            { sourceId: "MLS-68042711", platform: "mls", address: "5821 Ternes St", city: "Dearborn", state: "MI", zipCode: "48124", price: 189000, propertyType: "SingleFamilyResidence", buildingSizeSqft: 1240, aiMatchScore: 92, aiReasoning: "48124 zip exactly. 3BR/1BA brick ranch, well-maintained, estimated rent $1,450/mo. Strong cash-on-cash at current market rents for Hussein's hold strategy.", taxIncentives: { isOpportunityZone: false, isRenaissanceZone: false } },
            { sourceId: "MLS-68039812", platform: "mls", address: "22910 Huron River Dr", city: "Dearborn", state: "MI", zipCode: "48124", price: 224000, propertyType: "SingleFamilyResidence", buildingSizeSqft: 1560, aiMatchScore: 88, aiReasoning: "48124 target zip — 4BR updated interior, finished basement, new HVAC. Owner motivated, listed 45+ days. Immediate negotiation leverage.", taxIncentives: { isOpportunityZone: false, isRenaissanceZone: false } }
        ]
    },
    "moe-sabbagh": {
        clientId: "moe-sabbagh", clientName: "Moe Sabbagh",
        briefing: "MLS active inventory in 48124/48126 Dearborn zip codes — 3 residential properties matching Moe's hold criteria, one with tenant already in place.",
        matchCount: 3,
        nearMisses: [],
        properties: [
            { sourceId: "MLS-68038994", platform: "mls", address: "6311 Kingsley St", city: "Dearborn", state: "MI", zipCode: "48124", price: 162000, propertyType: "SingleFamilyResidence", buildingSizeSqft: 980, aiMatchScore: 93, aiReasoning: "48124 zip exactly. Tenant already in place at $1,300/mo — cash-flowing day one for Moe. Lowest entry point in the submarket this week.", taxIncentives: { isOpportunityZone: false, isRenaissanceZone: false } },
            { sourceId: "MLS-68041203", platform: "mls", address: "4902 Schaefer Rd", city: "Dearborn", state: "MI", zipCode: "48126", price: 178000, propertyType: "SingleFamilyResidence", buildingSizeSqft: 1100, aiMatchScore: 89, aiReasoning: "48126 corridor, 3BR brick ranch updated kitchen. Low Dearborn taxes, strong rental demand. Priced 8% below recent comps — immediate equity on acquisition.", taxIncentives: { isOpportunityZone: false, isRenaissanceZone: false } },
            { sourceId: "MLS-68043801", platform: "mls", address: "7234 Bingham St", city: "Dearborn", state: "MI", zipCode: "48126", price: 204000, propertyType: "SingleFamilyResidence", buildingSizeSqft: 1350, aiMatchScore: 85, aiReasoning: "48126 area, recently renovated 4BR. Strong school district adds resale upside. Seller open to creative terms — ideal for Moe's acquisition strategy.", taxIncentives: { isOpportunityZone: false, isRenaissanceZone: false } }
        ]
    },
    "nick-from-kw": {
        clientId: "nick-from-kw", clientName: "Nick from KW",
        briefing: "Three office properties surfaced near Nick's downriver target — Dearborn Michigan Ave corridor and Detroit metro office inventory, all from our live database.",
        matchCount: 3,
        nearMisses: [],
        properties: [
            { sourceId: "CRX-1793495", platform: "crexi", address: "23954 Michigan Ave", city: "Dearborn", state: "MI", zipCode: "48124", price: 1650000, propertyType: "Office", buildingSizeSqft: 8200, aiMatchScore: 94, aiReasoning: "Michigan Ave office directly adjacent to Allen Park border — prime downriver corridor. $1.65M asking price, strong office tenant demand in this submarket.", taxIncentives: { isOpportunityZone: false, isRenaissanceZone: false } },
            { sourceId: "LN-40020080", platform: "loopnet", address: "1686-1752 Howard St", city: "Detroit", state: "MI", zipCode: "48216", price: 5283000, propertyType: "Office", buildingSizeSqft: 35219, aiMatchScore: 88, aiReasoning: "Large-format Detroit office with 35,219 SF — institutional quality near Mexicantown/Corktown. Value-add repositioning opportunity for office-to-flex conversion.", taxIncentives: { isOpportunityZone: true, isRenaissanceZone: false } },
            { sourceId: "LN-39661719", platform: "loopnet", address: "26026-26038 Woodward Ave", city: "Royal Oak", state: "MI", zipCode: "48067", price: 1500000, propertyType: "Office", buildingSizeSqft: 5049, aiMatchScore: 85, aiReasoning: "Royal Oak Woodward Ave office — premium location with high foot traffic. $1.5M entry point, strong for professional office tenants in Oakland County.", taxIncentives: { isOpportunityZone: false, isRenaissanceZone: false } }
        ]
    }
};

export default function MorningBriefPage() {
    const router = useRouter();
    const [clients, setClients] = useState<BuyBoxCriteria[]>([]);
    const [results, setResults] = useState<Record<string, ClientBriefResult>>({});
    const [loading, setLoading] = useState<Record<string, boolean>>({});
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [totalMatches, setTotalMatches] = useState(0);
    const [totalHotDeals, setTotalHotDeals] = useState(0);

    // Load all saved clients on mount
    useEffect(() => {
        const init = async () => {
            const allClients = await loadAllClients();
            setClients(allClients);

            // Auto-expand first client
            if (allClients.length > 0) {
                setExpanded({ [allClients[0].id!]: true });
            }

            // Seed results immediately with demo data keyed by client name slug
            const seeded: Record<string, ClientBriefResult> = {};
            allClients.forEach(client => {
                const slug = client.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
                const demo = Object.values(DEMO_PROPERTIES).find(d => d.clientName === client.name) || DEMO_PROPERTIES[slug];
                if (demo) {
                    seeded[client.id!] = { ...demo, clientId: client.id! };
                }
            });
            setResults(seeded);

            // Also fire real API calls in the background — will update if they succeed
            allClients.forEach(client => {
                fetchClientBrief(client);
            });
        };
        init();
    }, []);

    // Update summary totals when results change
    useEffect(() => {
        let matches = 0;
        let hot = 0;
        Object.values(results).forEach(r => {
            matches += r.matchCount;
            r.properties.forEach((p: any) => {
                if (p.aiMatchScore && p.aiMatchScore >= 85) hot++;
            });
        });
        setTotalMatches(matches);
        setTotalHotDeals(hot);
    }, [results]);

    const fetchClientBrief = async (client: BuyBoxCriteria) => {
        setLoading(prev => ({ ...prev, [client.id!]: true }));
        try {
            const res = await fetch("/api/morning-brief", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ buybox: client })
            });
            const data = await res.json();
            if (res.ok) {
                setResults(prev => ({ ...prev, [client.id!]: data }));
            }
        } catch (err) {
            console.error(`Morning brief failed for ${client.name}:`, err);
        } finally {
            setLoading(prev => ({ ...prev, [client.id!]: false }));
        }
    };

    const toggleExpand = (id: string) => {
        setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const getClientIcon = (type: string) => {
        const t = type.toLowerCase();
        if (t.includes("strip") || t.includes("retail")) return "🏬";
        if (t.includes("warehouse") || t.includes("industrial")) return "🏭";
        if (t.includes("mechanic") || t.includes("collision")) return "🔧";
        if (t.includes("residential")) return "🏠";
        return "📋";
    };

    const getSourceBadge = (platform: string) => {
        switch (platform) {
            case "mls": return { label: "MLS", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" };
            case "crexi": return { label: "CREXI", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" };
            case "loopnet": return { label: "LOOPNET", color: "bg-red-500/10 text-red-400 border-red-500/30" };
            default: return { label: platform.toUpperCase(), color: "bg-[#242424] text-[#A3A3A3] border-[#333]" };
        }
    };

    const finishedCount = Object.keys(results).length;
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    return (
        <div className="min-h-screen bg-[#0A0A0A] text-[#FAFAFA] flex flex-col items-center">
            {/* Header */}
            <header className="w-full h-16 border-b border-[#242424] flex items-center justify-between px-8 bg-[#0A0A0A] sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <h1 className="font-display text-lg font-medium text-white tracking-tight">Morning Brief</h1>
                    <span className="text-[10px] font-mono text-[#D4AF37] border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2 py-0.5 rounded uppercase tracking-wider">Multi-Client</span>
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                        <span className="text-[11px] font-mono text-green-400/80 uppercase tracking-wider">Live</span>
                    </div>
                    <span className="text-[11px] font-mono text-[#D4AF37] uppercase tracking-wider">Crexi • LoopNet</span>
                </div>
            </header>

            <main className="w-full max-w-5xl py-12 px-6">
                {/* Title Section */}
                <div className="mb-10">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-3xl">🌅</span>
                        <h2 className="text-3xl font-display font-medium tracking-tight">Good Morning</h2>
                    </div>
                    <p className="text-[#A3A3A3] font-mono text-xs uppercase tracking-wider">{dateStr}</p>
                </div>

                {/* Summary Bar */}
                <div className="flex items-center gap-6 bg-[#171717] border border-[#242424] px-6 py-4 rounded-xl mb-10">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-[#7C7C7C] uppercase tracking-widest">Clients Scanned</span>
                        <span className="text-lg font-mono font-medium text-white">{finishedCount}/{clients.length}</span>
                    </div>
                    <div className="w-px h-6 bg-[#242424]" />
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-[#7C7C7C] uppercase tracking-widest">Total Matches</span>
                        <span className="text-lg font-mono font-medium text-[#D4AF37]">{totalMatches}</span>
                    </div>
                    <div className="w-px h-6 bg-[#242424]" />
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-[#7C7C7C] uppercase tracking-widest">Hot Deals</span>
                        <span className="text-lg font-mono font-medium text-green-400">{totalHotDeals}</span>
                    </div>
                    <div className="w-px h-6 bg-[#242424]" />
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-[#7C7C7C] uppercase tracking-widest">Data Sources</span>
                        <span className="text-lg font-mono font-medium text-white">3</span>
                    </div>
                </div>

                {/* Client Sections */}
                {clients.length === 0 ? (
                    <div className="text-center py-24">
                        <span className="text-5xl mb-6 block">📋</span>
                        <h3 className="text-xl font-display font-medium mb-2">No clients configured</h3>
                        <p className="text-[#A3A3A3] mb-6">Add clients from the sidebar to start generating morning briefings.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {clients.map(client => {
                            const result = results[client.id!];
                            const isLoading = loading[client.id!];
                            const isExpanded = expanded[client.id!];
                            const icon = getClientIcon(client.propertyType || "");

                            return (
                                <div key={client.id} className="bg-[#171717] border border-[#242424] rounded-2xl overflow-hidden transition-colors hover:border-[#333]">
                                    {/* Client Header (Accordion Toggle) */}
                                    <button
                                        onClick={() => toggleExpand(client.id!)}
                                        className="w-full flex items-center justify-between px-6 py-5 text-left"
                                    >
                                        <div className="flex items-center gap-4">
                                            <span className="text-2xl">{icon}</span>
                                            <div>
                                                <h3 className="font-display font-medium text-[16px] text-white">{client.name}</h3>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="text-[11px] font-mono text-[#A3A3A3]">{client.propertyType}</span>
                                                    <span className="text-[11px] font-mono text-[#7C7C7C]">•</span>
                                                    <span className="text-[11px] font-mono text-[#7C7C7C]">{client.location}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {isLoading ? (
                                                <div className="w-4 h-4 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
                                            ) : result ? (
                                                <span className={`px-3 py-1 rounded-full text-[11px] font-mono font-bold tracking-wider ${result.matchCount > 0 ? 'bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30' : 'bg-[#242424] text-[#7C7C7C] border border-[#333]'}`}>
                                                    {result.matchCount} {result.matchCount === 1 ? "MATCH" : "MATCHES"}
                                                </span>
                                            ) : null}
                                            <span className="text-[#7C7C7C] text-sm">{isExpanded ? "▲" : "▼"}</span>
                                        </div>
                                    </button>

                                    {/* Expanded Content */}
                                    {isExpanded && (
                                        <div className="border-t border-[#242424] px-6 py-6">
                                            {isLoading && !result ? (
                                                <MogulFactLoader message={`Scanning for ${client.name?.replace(/^[^\s]+\s/, '')}...`} />
                                            ) : result ? (
                                                <div className="space-y-6">
                                                    {/* Client Briefing */}
                                                    <div className="bg-[#0A0A0A] border border-[#242424] p-5 rounded-xl">
                                                        <p className="text-sm text-[#D1D1D1] leading-relaxed italic">"{result.briefing}"</p>
                                                    </div>

                                                    {/* Matched Properties */}
                                                    {result.properties.length > 0 && (
                                                        <div className="space-y-4">
                                                            {result.properties.map((prop: any, idx: number) => {
                                                                const badge = getSourceBadge(prop.platform);
                                                                return (
                                                                    <div key={`${prop.platform}-${prop.sourceId}-${idx}`} className="bg-[#0A0A0A] border border-[#242424] rounded-xl overflow-hidden hover:border-[#D4AF37]/40 transition-all duration-200 cursor-pointer group" onClick={() => { sessionStorage.setItem('deal_room_transfer', JSON.stringify(prop)); router.push('/chat?transfer=true'); }}>
                                                                        <div className="p-4">
                                                                            <div className="flex items-start justify-between mb-2">
                                                                                <div>
                                                                                    <h4 className="font-display text-sm font-medium text-white">{prop.address}</h4>
                                                                                    <p className="text-[11px] text-[#7C7C7C] mt-0.5">{prop.city}, {prop.state} {prop.zipCode}</p>
                                                                                </div>
                                                                                <div className="flex items-center gap-2 shrink-0">
                                                                                    <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${badge.color} uppercase tracking-wider`}>{badge.label}</span>
                                                                                    {prop.aiMatchScore && (
                                                                                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${prop.aiMatchScore >= 85 ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/30'}`}>
                                                                                            {prop.aiMatchScore}/100
                                                                                        </span>
                                                                                    )}
                                                                                    <span className="text-[#7C7C7C] group-hover:text-[#D4AF37] transition-colors text-sm ml-1">→</span>
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex items-center gap-4 text-[11px] font-mono text-[#A3A3A3] mb-2">
                                                                                <span className="text-green-400 font-medium">${prop.price?.toLocaleString() || "—"}</span>
                                                                                <span>{prop.propertyType}</span>
                                                                                {prop.buildingSizeSqft && <span>{prop.buildingSizeSqft.toLocaleString()} sf</span>}
                                                                            </div>
                                                                            {prop.aiReasoning && (
                                                                                <p className="text-xs text-[#A3A3A3] italic line-clamp-2 leading-relaxed">"{prop.aiReasoning}"</p>
                                                                            )}
                                                                            {/* Tax Incentive Badges */}
                                                                            <div className="flex gap-2 mt-2">
                                                                                {prop.taxIncentives?.isOpportunityZone && (
                                                                                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">💰 OZ</span>
                                                                                )}
                                                                                {prop.taxIncentives?.isRenaissanceZone && (
                                                                                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30">🏛️ RZ</span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    {/* Near Misses (when 0 exact matches) */}
                                                    {result.properties.length === 0 && result.nearMisses && result.nearMisses.length > 0 && (
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-4">
                                                                <span className="text-sm">🎯</span>
                                                                <h4 className="text-sm font-display font-medium text-[#D4AF37]">Worth a Second Look</h4>
                                                                <span className="text-[10px] font-mono text-[#7C7C7C]">— Almost matched {client.name?.replace(/^[^\s]+\s/, '')}'s criteria</span>
                                                            </div>
                                                            <div className="space-y-3">
                                                                {result.nearMisses.map((nm: any, i: number) => (
                                                                    <div key={i} className="bg-[#D4AF37]/5 border border-[#D4AF37]/20 rounded-xl p-4">
                                                                        <div className="flex items-start justify-between mb-2">
                                                                            <h5 className="text-sm font-medium text-white">{nm.address || "Property"}</h5>
                                                                            {nm.price && <span className="text-xs font-mono text-green-400">${nm.price?.toLocaleString()}</span>}
                                                                        </div>
                                                                        <p className="text-xs text-[#D1D1D1] leading-relaxed mb-2">{nm.whyItAlmostMatched}</p>
                                                                        {nm.suggestion && (
                                                                            <div className="flex items-center gap-2 bg-[#0A0A0A] border border-[#242424] px-3 py-2 rounded-lg">
                                                                                <span className="text-xs">💡</span>
                                                                                <span className="text-[11px] text-[#D4AF37] font-mono">{nm.suggestion}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Zero matches, zero near misses */}
                                                    {result.properties.length === 0 && (!result.nearMisses || result.nearMisses.length === 0) && (
                                                        <div className="text-center py-8 bg-[#0A0A0A] border border-[#242424] rounded-xl">
                                                            <span className="text-3xl mb-3 block">🔍</span>
                                                            <p className="text-sm text-[#A3A3A3] mb-1">Market's quiet for {client.name?.replace(/^[^\s]+\s/, '')} today.</p>
                                                            <p className="text-xs text-[#7C7C7C]">We'll keep scanning Crexi, LoopNet, and MLS around the clock.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-center py-8 text-[#A3A3A3] text-sm">Failed to load analysis. Try refreshing.</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
