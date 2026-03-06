"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface ScrapedProperty {
    sourceId: string;
    platform: string;
    propertyUrl: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    price: number | null;
    propertyType: string;
    buildingSizeSqft: number | null;
    capRate: number | null;
    daysOnPlatform: number;
}

export default function GlobalFeedBento() {
    const router = useRouter();
    const [properties, setProperties] = useState<ScrapedProperty[]>([]);
    const [isScraping, setIsScraping] = useState<Record<string, boolean>>({
        crexi: false,
        loopnet: false,
        mls: false
    });

    // Stats for Bento Boxes
    const [stats, setStats] = useState({
        crexi: 0,
        loopnet: 0,
        mls: 0
    });

    // Fetch initial data on mount (cached or quick fetch)
    useEffect(() => {
        // We'll auto-fetch loopnet just to populate the board quickly
        handleScrape("loopnet");
    }, []);

    useEffect(() => {
        // Recalculate stats whenever properties change
        const currentStats = { crexi: 0, loopnet: 0, mls: 0 };
        properties.forEach(p => {
            if (p.platform === "crexi") currentStats.crexi++;
            else if (p.platform === "loopnet") currentStats.loopnet++;
            else if (p.platform === "mls") currentStats.mls++;
        });
        setStats(currentStats);
    }, [properties]);

    const handleScrape = async (source: "crexi" | "loopnet" | "mls") => {
        setIsScraping(prev => ({ ...prev, [source]: true }));
        try {
            const res = await fetch(`/api/scrape?source=${source}`);
            const data = await res.json();

            if (data.properties) {
                setProperties(prev => {
                    // Remove old properties from this source, add new ones
                    const filtered = prev.filter(p => p.platform !== source);
                    return [...data.properties, ...filtered];
                });
            }
        } catch (err) {
            console.error(`Failed to scrape ${source}:`, err);
        } finally {
            setIsScraping(prev => ({ ...prev, [source]: false }));
        }
    };

    const handleSyncAll = async () => {
        setIsScraping({ crexi: true, loopnet: true, mls: true });
        try {
            const res = await fetch(`/api/scrape?source=all`);
            const data = await res.json();

            if (data.properties) {
                setProperties(data.properties);
            }
        } catch (err) {
            console.error(`Failed to sync all:`, err);
        } finally {
            setIsScraping({ crexi: false, loopnet: false, mls: false });
        }
    };

    const handleRowClick = (prop: ScrapedProperty) => {
        // AI Deal Room deep linking — pass full object to guarantee it never fails
        sessionStorage.setItem('deal_room_transfer', JSON.stringify(prop));
        router.push('/chat?transfer=true');
    };

    const getSourceBadge = (platform: string) => {
        switch (platform) {
            case "crexi": return { label: "CREXI", icon: "🔴", color: "bg-red-500/10 text-red-400 border-red-500/30", btnColor: "bg-[#2A1111] hover:bg-[#3D1A1A] text-red-500 border border-red-500/20" };
            case "loopnet": return { label: "LOOPNET", icon: "🔵", color: "bg-blue-500/10 text-blue-400 border-blue-500/30", btnColor: "bg-[#0A1B2E] hover:bg-[#0F2942] text-blue-500 border border-blue-500/20" };
            case "mls": return { label: "LOCAL MLS", icon: "🟡", color: "bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/30", btnColor: "bg-[#2B230B] hover:bg-[#3B3010] text-[#D4AF37] border border-[#D4AF37]/20" };
            default: return { label: platform.toUpperCase(), icon: "⚪", color: "bg-[#242424] text-[#A3A3A3] border-[#333]", btnColor: "bg-[#171717] hover:bg-[#242424] text-[#A3A3A3] border border-[#333]" };
        }
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Control Panel Bento */}
            <div className="bg-[#171717] border border-[#242424] rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#D4AF37]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                <div>
                    <h2 className="text-2xl font-display font-medium text-white tracking-tight flex items-center gap-3">
                        <span className="text-[#D4AF37]">📡</span> Global Feed Command Center
                    </h2>
                    <p className="text-xs font-mono text-[#A3A3A3] mt-2 uppercase tracking-wider">Scrape Apify Data Sources</p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                    {(["loopnet", "crexi", "mls"] as const).map(source => {
                        const loading = isScraping[source];
                        const formatting = getSourceBadge(source);
                        return (
                            <button
                                key={source}
                                onClick={() => handleScrape(source)}
                                disabled={loading}
                                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-medium transition-all shadow-lg shadow-black/20 ${loading ? 'bg-[#242424] text-[#7C7C7C] cursor-not-allowed border border-[#333]' : `${formatting.btnColor} hover:scale-105 active:scale-95`}`}
                            >
                                {loading && <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />}
                                {!loading && <span>{formatting.icon}</span>}
                                {loading ? "SCRAPING..." : `SCRAPE ${formatting.label}`}
                            </button>
                        );
                    })}
                    <div className="w-px h-8 bg-[#333] mx-1 hidden md:block" />
                    <button
                        onClick={handleSyncAll}
                        className="hidden md:flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-medium bg-[#D4AF37] hover:bg-[#C2A032] text-black transition-all hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(212,175,55,0.2)]"
                    >
                        ⚡ SYNC ALL
                    </button>
                </div>
            </div>

            {/* Stats Bento Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#171717] border border-[#242424] rounded-xl p-5 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-mono text-[#7C7C7C] uppercase tracking-widest mb-1">Active LoopNet Deals</p>
                        <p className="text-3xl font-display font-medium text-white">{isScraping.loopnet ? <span className="text-[#333] animate-pulse">---</span> : stats.loopnet}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xl">🔵</div>
                </div>
                <div className="bg-[#171717] border border-[#242424] rounded-xl p-5 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-mono text-[#7C7C7C] uppercase tracking-widest mb-1">Active Crexi Deals</p>
                        <p className="text-3xl font-display font-medium text-white">{isScraping.crexi ? <span className="text-[#333] animate-pulse">---</span> : stats.crexi}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-xl">🔴</div>
                </div>
                <div className="bg-[#171717] border border-[#242424] rounded-xl p-5 flex items-center justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                    <div className="relative z-10">
                        <p className="text-[10px] font-mono text-[#D4AF37]/80 uppercase tracking-widest mb-1">Local MLS Feeds</p>
                        <p className="text-3xl font-display font-medium text-white">{isScraping.mls ? <span className="text-[#333] animate-pulse">---</span> : stats.mls}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center text-xl relative z-10">🟡</div>
                </div>
            </div>

            {/* The Huge Data Table Bento */}
            <div className="bg-[#171717] border border-[#242424] rounded-2xl overflow-hidden flex flex-col flex-1 min-h-[500px]">
                <div className="px-6 py-4 border-b border-[#242424] bg-[#111] flex items-center justify-between">
                    <h3 className="text-sm font-display font-medium text-white tracking-wide">Live Property Terminal</h3>
                    <span className="text-[10px] font-mono text-[#7C7C7C] uppercase tracking-wider">Click Any Row For AI Deal Room</span>
                </div>

                {properties.length === 0 && !isScraping.crexi && !isScraping.loopnet && !isScraping.mls ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-24 text-center">
                        <span className="text-4xl mb-4">📭</span>
                        <h4 className="text-lg font-display text-white mb-2">No Properties Loaded</h4>
                        <p className="text-sm text-[#A3A3A3] mb-6">Click one of the scrape buttons above to initialize the data feed.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-[#242424] bg-[#0A0A0A]">
                                    <th className="px-6 py-3 text-[10px] font-mono text-[#7C7C7C] font-semibold uppercase tracking-widest w-24">Source</th>
                                    <th className="px-6 py-3 text-[10px] font-mono text-[#7C7C7C] font-semibold uppercase tracking-widest">Address</th>
                                    <th className="px-6 py-3 text-[10px] font-mono text-[#7C7C7C] font-semibold uppercase tracking-widest text-right">Price</th>
                                    <th className="px-6 py-3 text-[10px] font-mono text-[#7C7C7C] font-semibold uppercase tracking-widest text-right">Size</th>
                                    <th className="px-6 py-3 text-[10px] font-mono text-[#7C7C7C] font-semibold uppercase tracking-widest">Type</th>
                                    <th className="px-6 py-3 text-[10px] font-mono text-[#7C7C7C] font-semibold uppercase tracking-widest text-right">Cap</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#242424]">
                                <AnimatePresence>
                                    {properties.map((prop, idx) => {
                                        const badge = getSourceBadge(prop.platform);
                                        return (
                                            <motion.tr
                                                key={`${prop.platform}-${prop.sourceId}-${idx}`}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.2, delay: Math.min(idx * 0.05, 0.5) }}
                                                onClick={() => handleRowClick(prop)}
                                                className="group hover:bg-[#1E1E1E] cursor-pointer transition-colors"
                                            >
                                                <td className="px-6 py-3.5 whitespace-nowrap">
                                                    <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${badge.color}`}>
                                                        {badge.label}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3.5">
                                                    <p className="text-[13px] font-medium text-white group-hover:text-[#D4AF37] transition-colors truncate max-w-[280px]">{prop.address}</p>
                                                    <p className="text-[10px] font-mono text-[#7C7C7C] mt-0.5 truncate">{prop.city}, {prop.state} {prop.zipCode}</p>
                                                </td>
                                                <td className="px-6 py-3.5 whitespace-nowrap text-right">
                                                    <p className="text-[13px] font-mono font-medium text-green-400">
                                                        {prop.price ? `$${prop.price.toLocaleString()}` : "Unpriced"}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-3.5 whitespace-nowrap text-right">
                                                    <p className="text-[12px] font-mono text-[#A3A3A3]">
                                                        {prop.buildingSizeSqft ? `${prop.buildingSizeSqft.toLocaleString()} sf` : "—"}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-3.5 whitespace-nowrap">
                                                    <p className="text-[12px] text-[#A3A3A3] truncate max-w-[150px]">{prop.propertyType}</p>
                                                </td>
                                                <td className="px-6 py-3.5 whitespace-nowrap text-right">
                                                    <p className="text-[12px] font-mono font-medium text-white">
                                                        {prop.capRate ? `${prop.capRate}%` : "—"}
                                                    </p>
                                                </td>
                                            </motion.tr>
                                        );
                                    })}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
