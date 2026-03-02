"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { loadBuyBox, loadClientBuyBox, BuyBoxCriteria } from "@/lib/buybox";
import MogulFactLoader from "@/components/MogulFactLoader";
import GlobalFeedBento from "@/components/GlobalFeedBento";

interface DailyDigestResponse {
    briefing: string;
    strategyFeedback?: string;
    properties: any[];
}

function DailyUpdatesContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const clientId = searchParams.get("client");

    if (!clientId) {
        return (
            <div className="flex-1 bg-[#0A0A0A] p-4 md:p-8 min-h-screen">
                <div className="w-full max-w-7xl mx-auto">
                    <GlobalFeedBento />
                </div>
            </div>
        );
    }

    const [digest, setDigest] = useState<DailyDigestResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [buybox, setBuybox] = useState<BuyBoxCriteria | null>(null);
    const [clientName, setClientName] = useState<string>("Global Feed");

    // Step 11: Comp Check State
    const [compAnalyses, setCompAnalyses] = useState<Record<string, string>>({});
    const [isCheckingComp, setIsCheckingComp] = useState<Record<string, boolean>>({});

    // Step 13: Negotiation Playbook State
    const [playbooks, setPlaybooks] = useState<Record<string, any>>({});
    const [isGeneratingPlaybook, setIsGeneratingPlaybook] = useState<Record<string, boolean>>({});

    // Step 15: Market Watchdog Alerts
    const [marketAlerts, setMarketAlerts] = useState<any[]>([]);
    const [showWatchdog, setShowWatchdog] = useState(false);

    useEffect(() => {
        let box: BuyBoxCriteria | null = null;
        if (clientId) {
            box = loadClientBuyBox(clientId);
            if (box) setClientName(box.name);
        } else {
            box = loadBuyBox();
            setClientName("Global Feed");
        }

        setBuybox(box);

        if (!box) {
            setIsLoading(false);
            return;
        }

        async function fetchDigest() {
            setIsLoading(true);
            try {
                const res = await fetch("/api/generate-daily-digest", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ buybox: box }),
                });
                const data = await res.json();
                setDigest(data);
            } catch (err) {
                console.error("Failed to load digest:", err);
            } finally {
                setIsLoading(false);
            }
        }

        fetchDigest();
    }, [clientId]);

    // Step 15: Fetch Market Watchdog Alerts
    useEffect(() => {
        async function fetchWatchdog() {
            try {
                const res = await fetch("/api/market-watchdog");
                const data = await res.json();
                if (data.alerts && data.alerts.length > 0) {
                    setMarketAlerts(data.alerts);
                }
            } catch (err) {
                console.error("Market Watchdog fetch failed:", err);
            }
        }
        fetchWatchdog();
    }, []);

    const handlePropertyClick = (property: any) => {
        router.push(`/chat?apifyId=${property.sourceId}&platform=${property.platform}`);
    };

    const handleCompCheck = async (e: React.MouseEvent, property: any) => {
        e.stopPropagation(); // Prevent opening the Deal Room

        setIsCheckingComp(prev => ({ ...prev, [property.sourceId]: true }));
        try {
            const res = await fetch("/api/comp-check", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ property })
            });
            const data = await res.json();

            if (res.ok && data.analysis) {
                setCompAnalyses(prev => ({ ...prev, [property.sourceId]: data.analysis }));
            } else {
                setCompAnalyses(prev => ({ ...prev, [property.sourceId]: data.error || "Comp Check failed." }));
            }
        } catch (err) {
            setCompAnalyses(prev => ({ ...prev, [property.sourceId]: "Connection to Opulentus Analysis Server failed." }));
        } finally {
            setIsCheckingComp(prev => ({ ...prev, [property.sourceId]: false }));
        }
    };

    const handlePlaybook = async (e: React.MouseEvent, property: any) => {
        e.stopPropagation();

        setIsGeneratingPlaybook(prev => ({ ...prev, [property.sourceId]: true }));
        try {
            const res = await fetch("/api/negotiation-playbook", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    property: {
                        address: property.address,
                        city: property.city,
                        listPrice: property.price,
                        propertyType: property.propertyType,
                        squareFeet: property.buildingSizeSqft,
                        yearBuilt: property.yearBuilt,
                        dom: property.daysOnMarket || "Unknown",
                        dealScore: property.aiMatchScore,
                        dealReasons: property.aiRedFlags || [],
                        remarks: property.aiReasoning || ""
                    }
                })
            });
            const data = await res.json();
            if (res.ok) {
                setPlaybooks(prev => ({ ...prev, [property.sourceId]: data }));
            }
        } catch (err) {
            console.error("Playbook generation failed:", err);
        } finally {
            setIsGeneratingPlaybook(prev => ({ ...prev, [property.sourceId]: false }));
        }
    };

    return (
        <div className="min-h-screen bg-[#0A0A0A] text-[#FAFAFA] flex flex-col items-center">
            {/* Header */}
            <header className="w-full h-16 border-b border-[#242424] flex items-center justify-between px-8 bg-[#0A0A0A] sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <h1 className="font-display text-lg font-medium text-white tracking-tight">Daily Digest</h1>
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                        <span className="text-[11px] font-mono text-green-400/80 uppercase tracking-wider">Webhooks Active</span>
                    </div>
                    <span className="text-[11px] font-mono text-[#D4AF37] uppercase tracking-wider">Crexi / LoopNet Connected</span>
                </div>
            </header>

            {/* Step 15: Market Watchdog Alert Banner */}
            {marketAlerts.length > 0 && (
                <div className="w-full max-w-5xl mx-auto px-6 mt-4">
                    <button
                        onClick={() => setShowWatchdog(!showWatchdog)}
                        className="w-full flex items-center justify-between bg-[#171717] border border-[#242424] hover:border-[#333] px-5 py-3 rounded-xl transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-lg">🐕</span>
                            <span className="text-sm font-mono text-[#D4AF37] uppercase tracking-wider font-bold">Market Watchdog</span>
                            <span className="bg-[#D4AF37]/10 text-[#D4AF37] text-[10px] font-mono px-2 py-0.5 rounded border border-[#D4AF37]/30">{marketAlerts.length} Alerts</span>
                        </div>
                        <span className="text-[#7C7C7C] text-xs">{showWatchdog ? "▲ Hide" : "▼ Show"}</span>
                    </button>
                    {showWatchdog && (
                        <div className="mt-3 space-y-2">
                            {marketAlerts.map((alert: any, i: number) => (
                                <div key={i} className={`flex items-start gap-3 px-5 py-3 rounded-lg border ${alert.severity === 'high' ? 'bg-red-500/5 border-red-500/20' : alert.severity === 'medium' ? 'bg-[#D4AF37]/5 border-[#D4AF37]/20' : 'bg-[#171717] border-[#242424]'}`}>
                                    <span className="text-xs mt-0.5">{alert.type === 'price_trend' ? '📉' : alert.type === 'inventory_anomaly' ? '📦' : alert.type === 'velocity_change' ? '⚡' : '📍'}</span>
                                    <div>
                                        <div className="text-sm text-white font-medium">{alert.headline}</div>
                                        <p className="text-xs text-[#A3A3A3] leading-relaxed mt-0.5">{alert.detail}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <main className="w-full max-w-5xl py-12 px-6">
                <div className="flex justify-between items-end mb-12">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h2 className="text-3xl font-display font-medium tracking-tight">Morning Briefing</h2>
                            <span className="px-2.5 py-1 bg-[#171717] border border-[#242424] rounded-md text-xs font-mono text-[#D4AF37] uppercase tracking-wider">{clientName}</span>
                        </div>
                        <p className="text-[#A3A3A3] font-mono text-xs uppercase tracking-wider">Curated by Opulentus AI</p>
                    </div>
                    {buybox && (
                        <div className="flex items-center gap-4">
                            <div className="bg-[#171717] border border-[#242424] px-4 py-2 rounded-lg flex items-center gap-3 text-sm text-[#A3A3A3]">
                                <span>Active Box: <strong className="text-white">{buybox.location || "Anywhere"} • {buybox.propertyType || "All Types"}</strong></span>
                            </div>
                            <button
                                onClick={() => {
                                    const encodedData = encodeURIComponent(Buffer.from(JSON.stringify(buybox)).toString('base64'));
                                    const shareUrl = `${window.location.origin}/shared?data=${encodedData}`;
                                    navigator.clipboard.writeText(shareUrl);
                                    alert('Public Share Link Copied to Clipboard!');
                                }}
                                className="bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 border border-[#D4AF37]/50 text-[#D4AF37] px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors"
                            >
                                <span>🔗</span>
                                <span>Share Portfolio</span>
                            </button>
                        </div>
                    )}
                </div>

                {!buybox ? (
                    <div className="text-center py-24 bg-[#171717] border border-[#242424] rounded-2xl">
                        <h3 className="text-2xl font-display text-white mb-4">No Buy Box Found</h3>
                        <p className="text-[#A3A3A3] mb-8">
                            {clientId
                                ? `The client "${clientId}" does not have an active Buy Box.`
                                : "Click 'Add Client' in the left sidebar to set up an investment criteria."
                            }
                        </p>
                    </div>
                ) : isLoading ? (
                    <div className="py-24">
                        <MogulFactLoader message="Analyzing Market Intelligence..." />
                    </div>
                ) : !digest ? (
                    <div className="text-[#A3A3A3]">Failed to generate briefing.</div>
                ) : (
                    <>
                        {/* Briefing Text */}
                        <div className="bg-[#171717] border border-[#242424] p-8 rounded-2xl mb-12 leading-relaxed text-[#D1D1D1] text-[15px] whitespace-pre-wrap shadow-xl">
                            {digest.briefing}
                        </div>

                        {/* Strategy Feedback (Zero Matches Edge Case) */}
                        {digest.strategyFeedback && digest.properties.length === 0 && (
                            <div className="bg-[#D4AF37]/5 border border-[#D4AF37]/30 p-8 rounded-2xl mb-12 text-center">
                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#D4AF37]/10 mb-4">
                                    <span className="text-xl">💡</span>
                                </div>
                                <h3 className="text-xl font-display font-medium text-white mb-3">AI Strategy Optimization</h3>
                                <p className="text-[#D1D1D1] leading-relaxed max-w-2xl mx-auto italic">
                                    "{digest.strategyFeedback}"
                                </p>
                                <button
                                    onClick={() => document.querySelector<HTMLButtonElement>('aside nav button')?.click()}
                                    className="mt-6 px-6 py-2.5 rounded-lg bg-[#FAFAFA] text-[#0A0A0A] text-sm font-medium hover:bg-[#E5E5E5] transition-colors"
                                >
                                    Adjust Buy Box
                                </button>
                            </div>
                        )}

                        {digest.properties.length > 0 && (
                            <>
                                <h3 className="text-xl font-display font-medium mb-6 tracking-tight flex items-center gap-3">
                                    Top Deals Matches <span className="bg-[#242424] text-white px-2 py-0.5 rounded-full text-sm">{digest.properties.length}</span>
                                </h3>

                                {/* Bento Grid */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                                    {[...digest.properties]
                                        .sort((a, b) => {
                                            // Sort by score descending. Treat missing scores as 0.
                                            const scoreA = a.aiMatchScore || 0;
                                            const scoreB = b.aiMatchScore || 0;
                                            return scoreB - scoreA;
                                        })
                                        .map((property, idx) => (
                                            <button
                                                key={`${property.platform}-${property.sourceId}-${idx}`}
                                                onClick={() => handlePropertyClick(property)}
                                                className="text-left group bg-[#171717] border border-[#242424] hover:border-[#404040] rounded-2xl overflow-hidden transition-all duration-300 relative flex flex-col h-full"
                                            >
                                                {/* Image Section */}
                                                <div className="h-48 w-full relative bg-[#0A0A0A] shrink-0">
                                                    {property.images?.[0] ? (
                                                        <img src={property.images[0]} alt={property.address} className="object-cover w-full h-full opacity-80 group-hover:opacity-100 transition-opacity" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center font-mono text-[10px] text-[#404040]">NO IMAGE</div>
                                                    )}

                                                    {/* Status Badges */}
                                                    <div className="absolute top-4 left-4 flex flex-col gap-2 items-start">
                                                        {property.aiMatchScore && property.aiMatchScore >= 85 && (
                                                            <div className="bg-[#D4AF37]/20 backdrop-blur flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#D4AF37]/50 shadow-[0_0_10px_rgba(212,175,55,0.3)] animate-pulse">
                                                                <span className="text-sm">🔥</span>
                                                                <span className="text-[10px] font-mono text-[#D4AF37] uppercase font-bold tracking-wider">Hot Deal</span>
                                                            </div>
                                                        )}
                                                        <div className="flex gap-2">
                                                            <div className="bg-[#0A0A0A]/90 backdrop-blur px-2.5 py-1 flex items-center gap-1.5 rounded-md border border-[#333]">
                                                                <div className={`w-1.5 h-1.5 rounded-full ${property.platform === 'crexi' ? 'bg-blue-500' : 'bg-red-500'}`} />
                                                                <span className="text-[10px] font-mono text-[#FAFAFA] uppercase">{property.platform}</span>
                                                            </div>
                                                            {property.aiMatchScore && (
                                                                <div className={`bg-[#0A0A0A]/90 backdrop-blur flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-mono uppercase ${property.aiMatchScore >= 90 ? 'border-green-500/50 text-green-400' : 'border-[#D4AF37]/50 text-[#D4AF37]'}`}>
                                                                    Score: {property.aiMatchScore}/100
                                                                </div>
                                                            )}
                                                            {property._historicalPriceDrop && (
                                                                <div className="bg-red-500/10 backdrop-blur flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-red-500/20 text-[10px] font-mono uppercase text-red-500">
                                                                    📉 Price Drop: -${property._historicalPriceDrop.toLocaleString()}
                                                                </div>
                                                            )}
                                                            {property._ghostListingData && (
                                                                <div className="bg-[#5EEAD4]/10 backdrop-blur flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#5EEAD4]/20 text-[10px] font-mono uppercase text-[#5EEAD4]">
                                                                    👻 Ghost Listing
                                                                </div>
                                                            )}
                                                            {property.taxIncentives?.isOpportunityZone && (
                                                                <div className="bg-emerald-500/10 backdrop-blur flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-emerald-500/30 text-[10px] font-mono uppercase text-emerald-400">
                                                                    💰 Opportunity Zone
                                                                </div>
                                                            )}
                                                            {property.taxIncentives?.isRenaissanceZone && (
                                                                <div className="bg-sky-500/10 backdrop-blur flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-sky-500/30 text-[10px] font-mono uppercase text-sky-400">
                                                                    🏛️ Renaissance Zone
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Content Section */}
                                                <div className="p-6 flex flex-col flex-1">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <h4 className="font-display text-xl font-medium text-white group-hover:text-[#D4AF37] transition-colors leading-tight pr-4">
                                                            {property.address}
                                                        </h4>
                                                        <div className="flex flex-col items-end shrink-0">
                                                            <span className="text-lg font-medium text-green-400">
                                                                ${property.price?.toLocaleString() || "Unpriced"}
                                                            </span>
                                                            {property._historicalOriginalPrice && property._historicalPriceDrop && (
                                                                <span className="text-xs text-[#7C7C7C] line-through">
                                                                    ${property._historicalOriginalPrice.toLocaleString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <p className="text-sm text-[#A3A3A3] mb-5 line-clamp-1">
                                                        {property.city}, {property.state} {property.zipCode}
                                                    </p>

                                                    {/* AI Reasoning Block */}
                                                    {property.aiReasoning && (
                                                        <div className="mb-4 bg-[#D4AF37]/5 border border-[#D4AF37]/20 rounded-lg p-4 relative">
                                                            <div className="absolute -top-2 -left-2 bg-[#171717] rounded-full p-1 border border-[#242424]">✨</div>
                                                            <p className="text-sm text-[#D1D1D1] italic leading-relaxed">"{property.aiReasoning}"</p>
                                                        </div>
                                                    )}

                                                    {/* AI Price Drop Analysis Block */}
                                                    {property.aiPriceDropReasoning && (
                                                        <div className="mb-4 bg-red-500/5 border border-red-500/20 rounded-lg p-4 relative">
                                                            <div className="absolute -top-2 -left-2 bg-[#171717] rounded-full p-1 border border-[#242424] text-xs">🩸</div>
                                                            <p className="text-sm text-red-100/80 italic leading-relaxed">"{property.aiPriceDropReasoning}"</p>
                                                        </div>
                                                    )}

                                                    {/* AI Arbitrage Analysis Block */}
                                                    {property.aiArbitrageAnalysis && (
                                                        <div className="mb-6 bg-[#5EEAD4]/5 border border-[#5EEAD4]/20 rounded-lg p-4 relative">
                                                            <div className="absolute -top-2 -left-2 bg-[#171717] rounded-full p-1 border border-[#242424] text-xs">👀</div>
                                                            <p className="text-sm text-[#5EEAD4]/80 italic leading-relaxed">"{property.aiArbitrageAnalysis}"</p>
                                                        </div>
                                                    )}

                                                    {/* Step 12: Portfolio Fit Score */}
                                                    {property.aiPortfolioFitScore && (
                                                        <div className="mb-4 bg-[#7C3AED]/5 border border-[#7C3AED]/20 rounded-lg p-4 relative">
                                                            <div className="absolute -top-2 -left-2 bg-[#171717] rounded-full p-1 border border-[#242424] text-xs">🧩</div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-[10px] font-mono text-[#A78BFA] uppercase font-bold tracking-wider">Portfolio Fit</span>
                                                                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${property.aiPortfolioFitScore >= 80 ? 'text-green-400 border-green-500/30 bg-green-500/10' : property.aiPortfolioFitScore >= 50 ? 'text-[#D4AF37] border-[#D4AF37]/30 bg-[#D4AF37]/10' : 'text-red-400 border-red-500/30 bg-red-500/10'}`}>{property.aiPortfolioFitScore}/100</span>
                                                            </div>
                                                            <p className="text-sm text-[#E0E7FF]/80 italic leading-relaxed">"{property.aiPortfolioFitReasoning}"</p>
                                                        </div>
                                                    )}

                                                    {/* AI Red Flags */}
                                                    {property.aiRedFlags && property.aiRedFlags.length > 0 && (
                                                        <div className="mb-6 flex flex-wrap gap-2">
                                                            {property.aiRedFlags.map((flag: string, i: number) => (
                                                                <span key={i} className="text-[10px] font-mono bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-1 rounded flex items-center gap-1.5">
                                                                    ⚠️ {flag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}

                                                    <div className="mt-auto grid grid-cols-3 gap-4 border-t border-[#242424] pt-5">
                                                        <div>
                                                            <div className="text-[10px] uppercase font-mono tracking-wider text-[#7C7C7C] mb-1">Type</div>
                                                            <div className="text-sm text-[#FAFAFA] font-medium">{property.propertyType}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] uppercase font-mono tracking-wider text-[#7C7C7C] mb-1">Size</div>
                                                            <div className="text-sm text-[#FAFAFA] font-medium">{property.buildingSizeSqft ? `${property.buildingSizeSqft.toLocaleString()} SF` : "N/A"}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] uppercase font-mono tracking-wider text-[#7C7C7C] mb-1">Cap Rate</div>
                                                            <div className="text-sm text-[#D4AF37] font-medium">{property.capRate ? `${property.capRate}%` : "Unlisted"}</div>
                                                        </div>
                                                    </div>

                                                    {/* Step 11: Instant Comp Check Button */}
                                                    {compAnalyses[property.sourceId] ? (
                                                        <div className="mt-5 p-4 bg-[#7C3AED]/10 border border-[#7C3AED]/30 rounded-lg" onClick={(e) => e.stopPropagation()}>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className="text-xl">📊</span>
                                                                <span className="text-xs uppercase font-mono text-[#A78BFA] font-bold tracking-wider">Apify Comp Analysis</span>
                                                            </div>
                                                            <p className="text-sm text-[#E0E7FF] leading-relaxed italic">{compAnalyses[property.sourceId]}</p>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={(e) => handleCompCheck(e, property)}
                                                            disabled={isCheckingComp[property.sourceId]}
                                                            className="mt-5 w-full py-2.5 bg-[#1A1A1A] hover:bg-[#242424] border border-[#333] rounded-lg text-sm text-[#FAFAFA] transition-colors flex items-center justify-center gap-2 group-hover:border-[#7C3AED]/50 disabled:opacity-50"
                                                        >
                                                            {isCheckingComp[property.sourceId] ? (
                                                                <span className="animate-pulse flex items-center gap-2">
                                                                    <div className="w-3 h-3 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin"></div>
                                                                    Cross-referencing LoopNet Sold Data...
                                                                </span>
                                                            ) : (
                                                                <>
                                                                    <span>📊</span>
                                                                    <span>Instant Comp Check</span>
                                                                </>
                                                            )}
                                                        </button>
                                                    )}

                                                    {/* Step 13: One-Click Negotiation Playbook */}
                                                    {playbooks[property.sourceId] ? (
                                                        <div className="mt-4 p-4 bg-[#D4AF37]/5 border border-[#D4AF37]/30 rounded-lg" onClick={(e) => e.stopPropagation()}>
                                                            <div className="flex items-center justify-between mb-3">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-lg">⚔️</span>
                                                                    <span className="text-xs uppercase font-mono text-[#D4AF37] font-bold tracking-wider">Negotiation Playbook</span>
                                                                </div>
                                                                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${playbooks[property.sourceId].leverageScore >= 70 ? 'text-green-400 border-green-500/30 bg-green-500/10' : 'text-[#D4AF37] border-[#D4AF37]/30 bg-[#D4AF37]/10'}`}>
                                                                    Leverage: {playbooks[property.sourceId].leverageScore}/100
                                                                </span>
                                                            </div>
                                                            {playbooks[property.sourceId].offerLadder && (
                                                                <div className="grid grid-cols-3 gap-2 mb-3">
                                                                    {playbooks[property.sourceId].offerLadder.map((offer: any, i: number) => (
                                                                        <div key={i} className="bg-[#0A0A0A] rounded p-2 border border-[#242424]">
                                                                            <div className="text-[9px] font-mono text-[#7C7C7C] uppercase mb-1">{offer.level}</div>
                                                                            <div className="text-sm text-white font-medium">${offer.price?.toLocaleString()}</div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {playbooks[property.sourceId].openingScript && (
                                                                <p className="text-xs text-[#D1D1D1] italic leading-relaxed border-t border-[#242424] pt-2">"{playbooks[property.sourceId].openingScript}"</p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={(e) => handlePlaybook(e, property)}
                                                            disabled={isGeneratingPlaybook[property.sourceId]}
                                                            className="mt-3 w-full py-2.5 bg-[#1A1A1A] hover:bg-[#242424] border border-[#333] rounded-lg text-sm text-[#FAFAFA] transition-colors flex items-center justify-center gap-2 group-hover:border-[#D4AF37]/50 disabled:opacity-50"
                                                        >
                                                            {isGeneratingPlaybook[property.sourceId] ? (
                                                                <span className="animate-pulse flex items-center gap-2">
                                                                    <div className="w-3 h-3 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
                                                                    Generating Playbook...
                                                                </span>
                                                            ) : (
                                                                <>
                                                                    <span>⚔️</span>
                                                                    <span>Generate Playbook</span>
                                                                </>
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                </div>
                            </>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}

export default function DailyUpdatesPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-24"><MogulFactLoader message="Loading Feed..." /></div>}>
            <DailyUpdatesContent />
        </Suspense>
    );
}
