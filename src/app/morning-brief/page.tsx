"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadAllClients, BuyBoxCriteria } from "@/lib/buybox";

interface ClientBriefResult {
    clientId: string;
    clientName: string;
    briefing: string;
    matchCount: number;
    properties: any[];
    nearMisses: any[];
    generatedAt?: string;
}

export default function MorningBriefPage() {
    const router = useRouter();
    const [clients, setClients] = useState<BuyBoxCriteria[]>([]);
    const [results, setResults] = useState<Record<string, ClientBriefResult>>({});
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [totalMatches, setTotalMatches] = useState(0);
    const [totalHotDeals, setTotalHotDeals] = useState(0);
    const [briefsLoaded, setBriefsLoaded] = useState(false);
    const [generatedAt, setGeneratedAt] = useState<string | null>(null);

    // Load clients + pre-computed briefs on mount — single fetch, no background calls
    useEffect(() => {
        const init = async () => {
            // Load clients from Supabase
            const allClients = await loadAllClients();
            setClients(allClients);

            if (allClients.length > 0) {
                setExpanded({ [allClients[0].id!]: true });
            }

            // Fetch pre-computed briefs from Supabase Storage (via API)
            try {
                const res = await fetch("/api/client-briefs", { cache: "no-store" });
                if (res.ok) {
                    const data = await res.json();
                    const briefs: Record<string, ClientBriefResult> = data.briefs || {};
                    setResults(briefs);
                    setGeneratedAt(data.generatedAt);
                }
            } catch (err) {
                console.error("Failed to load pre-computed briefs:", err);
            }

            setBriefsLoaded(true);
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

    const toggleExpand = (id: string) => {
        setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const getClientIcon = (type: string) => {
        const t = type.toLowerCase();
        if (t.includes("strip") || t.includes("retail")) return "🏬";
        if (t.includes("warehouse") || t.includes("industrial")) return "🏭";
        if (t.includes("mechanic") || t.includes("collision") || t.includes("auto")) return "🔧";
        if (t.includes("residential") || t.includes("single")) return "🏠";
        if (t.includes("office")) return "🏢";
        return "📋";
    };

    const getSourceBadge = (platform: string) => {
        switch (platform) {
            case "mls": return { label: "MLS", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" };
            case "crexi": return { label: "CREXI", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" };
            case "loopnet": return { label: "LOOPNET", color: "bg-red-500/10 text-red-400 border-red-500/30" };
            default: return { label: platform?.toUpperCase() || "N/A", color: "bg-[#242424] text-[#A3A3A3] border-[#333]" };
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
                    <span className="text-[11px] font-mono text-[#D4AF37] uppercase tracking-wider">Crexi • LoopNet • MLS</span>
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
                    {generatedAt && (
                        <p className="text-[#7C7C7C] font-mono text-[10px] uppercase tracking-wider mt-1">
                            Last scan: {new Date(generatedAt).toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, month: "short", day: "numeric" })}
                        </p>
                    )}
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
                {clients.length === 0 && briefsLoaded ? (
                    <div className="text-center py-24">
                        <span className="text-5xl mb-6 block">📋</span>
                        <h3 className="text-xl font-display font-medium mb-2">No clients configured</h3>
                        <p className="text-[#A3A3A3] mb-6">Add clients from the sidebar to start generating morning briefings.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {clients.map(client => {
                            const result = results[client.id!];
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
                                            {result ? (
                                                <span className={`px-3 py-1 rounded-full text-[11px] font-mono font-bold tracking-wider ${result.matchCount > 0 ? 'bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30' : 'bg-[#242424] text-[#7C7C7C] border border-[#333]'}`}>
                                                    {result.matchCount} {result.matchCount === 1 ? "MATCH" : "MATCHES"}
                                                </span>
                                            ) : briefsLoaded ? (
                                                <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold tracking-wider bg-[#242424] text-[#7C7C7C] border border-[#333]">
                                                    PENDING
                                                </span>
                                            ) : null}
                                            <span className="text-[#7C7C7C] text-sm">{isExpanded ? "▲" : "▼"}</span>
                                        </div>
                                    </button>

                                    {/* Expanded Content */}
                                    {isExpanded && (
                                        <div className="border-t border-[#242424] px-6 py-6">
                                            {result ? (
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
                                                                                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">OZ</span>
                                                                                )}
                                                                                {prop.taxIncentives?.isRenaissanceZone && (
                                                                                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30">RZ</span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    {/* Near Misses */}
                                                    {result.properties.length === 0 && result.nearMisses && result.nearMisses.length > 0 && (
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-4">
                                                                <span className="text-sm">🎯</span>
                                                                <h4 className="text-sm font-display font-medium text-[#D4AF37]">Worth a Second Look</h4>
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
                                                            <p className="text-sm text-[#A3A3A3] mb-1">Market's quiet for {client.name} today.</p>
                                                            <p className="text-xs text-[#7C7C7C]">We'll keep scanning Crexi, LoopNet, and MLS around the clock.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : briefsLoaded ? (
                                                <div className="text-center py-8 bg-[#0A0A0A] border border-[#242424] rounded-xl">
                                                    <span className="text-3xl mb-3 block">⏳</span>
                                                    <p className="text-sm text-[#A3A3A3] mb-1">Analysis pending for {client.name}.</p>
                                                    <p className="text-xs text-[#7C7C7C]">Brief will be generated on the next daily scan cycle.</p>
                                                </div>
                                            ) : (
                                                <div className="text-center py-8 text-[#A3A3A3] text-sm">Loading...</div>
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
