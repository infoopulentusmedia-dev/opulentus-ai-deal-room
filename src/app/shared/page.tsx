"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BuyBoxCriteria } from "@/lib/buybox";
import MogulFactLoader from "@/components/MogulFactLoader";

interface DailyDigestResponse {
    briefing: string;
    strategyFeedback?: string;
    properties: any[];
}

function SharedPortfolioContent() {
    const searchParams = useSearchParams();
    const [buybox, setBuybox] = useState<BuyBoxCriteria | null>(null);
    const [digest, setDigest] = useState<DailyDigestResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState("");

    useEffect(() => {
        const dataParam = searchParams.get('data');
        if (!dataParam) {
            setErrorMsg("No portfolio data found in this link.");
            setIsLoading(false);
            return;
        }

        try {
            // Decode URL-encoded base64 string
            const decodedBase64 = decodeURIComponent(dataParam);
            const jsonString = Buffer.from(decodedBase64, 'base64').toString('utf8');
            const parsedBox = JSON.parse(jsonString) as BuyBoxCriteria;
            setBuybox(parsedBox);
            generateDigest(parsedBox);
        } catch (e) {
            console.error(e);
            setErrorMsg("Invalid portfolio link.");
            setIsLoading(false);
        }
    }, [searchParams]);

    const generateDigest = async (criteria: BuyBoxCriteria) => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/generate-daily-digest", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ buybox: criteria })
            });
            const data = await res.json();
            if (res.ok) {
                setDigest(data);
            } else {
                setErrorMsg(data.error || "Failed to generate briefing.");
            }
        } catch (err) {
            setErrorMsg("Error connecting to Opulentus Intelligence.");
        } finally {
            setIsLoading(false);
        }
    };

    if (errorMsg) {
        return (
            <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
                <div className="text-center bg-[#171717] border border-[#242424] p-12 rounded-2xl">
                    <div className="w-16 h-16 rounded-2xl bg-[#D4AF37]/20 flex items-center justify-center mx-auto mb-6">
                        <span className="text-[#D4AF37] text-2xl">⚠️</span>
                    </div>
                    <h2 className="text-2xl font-display text-white mb-2">Portfolio Unavailable</h2>
                    <p className="text-[#A3A3A3]">{errorMsg}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0A0A0A] text-[#FAFAFA] flex flex-col items-center">
            {/* Header */}
            <header className="w-full h-16 border-b border-[#242424] flex items-center justify-center px-8 bg-[#0A0A0A] sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded bg-[#D4AF37] flex items-center justify-center">
                        <span className="text-[#0A0A0A] font-bold text-xs font-display">O</span>
                    </div>
                    <h1 className="font-display text-lg font-medium text-white tracking-tight">Opulentus Private Wealth</h1>
                </div>
            </header>

            <main className="w-full max-w-5xl py-12 px-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h2 className="text-3xl font-display font-medium tracking-tight">Daily Briefing</h2>
                            {buybox?.name && (
                                <span className="px-2.5 py-1 bg-[#171717] border border-[#242424] rounded-md text-xs font-mono text-[#D4AF37] uppercase tracking-wider">{buybox.name}</span>
                            )}
                        </div>
                        <p className="text-[#A3A3A3] font-mono text-xs uppercase tracking-wider">Curated by Opulentus AI</p>
                    </div>
                    {buybox && (
                        <div className="bg-[#171717] border border-[#242424] px-4 py-2 rounded-lg flex items-center gap-3 text-sm text-[#A3A3A3]">
                            <span>Active Box: <strong className="text-white">{buybox.location || "Anywhere"} • {buybox.propertyType || "All Types"}</strong></span>
                        </div>
                    )}
                </div>

                {isLoading ? (
                    <div className="py-24">
                        <MogulFactLoader message="Analyzing Portfolio Data..." />
                    </div>
                ) : !digest ? (
                    null
                ) : (
                    <>
                        <div className="bg-[#171717] border border-[#242424] p-8 rounded-2xl mb-12 leading-relaxed text-[#D1D1D1] text-[15px] whitespace-pre-wrap shadow-xl">
                            {digest.briefing}
                        </div>

                        {digest.strategyFeedback && digest.properties.length === 0 && (
                            <div className="bg-[#D4AF37]/5 border border-[#D4AF37]/30 p-8 rounded-2xl mb-12 text-center">
                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#D4AF37]/10 mb-4">
                                    <span className="text-xl">💡</span>
                                </div>
                                <h3 className="text-xl font-display font-medium text-white mb-3">AI Strategy Optimization</h3>
                                <p className="text-[#D1D1D1] leading-relaxed max-w-2xl mx-auto italic">
                                    "{digest.strategyFeedback}"
                                </p>
                            </div>
                        )}

                        {digest.properties.length > 0 && (
                            <>
                                <h3 className="text-xl font-display font-medium mb-6 tracking-tight flex items-center gap-3">
                                    Top Deals Matches <span className="bg-[#242424] text-white px-2 py-0.5 rounded-full text-sm">{digest.properties.length}</span>
                                </h3>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                                    {[...digest.properties].sort((a, b) => (b.aiMatchScore || 0) - (a.aiMatchScore || 0)).map((property, idx) => (
                                        <div
                                            key={`${property.platform}-${property.sourceId}-${idx}`}
                                            className="text-left group bg-[#171717] border border-[#242424] rounded-2xl overflow-hidden relative flex flex-col h-full"
                                        >
                                            <div className="h-48 w-full relative bg-[#0A0A0A] shrink-0">
                                                {property.images?.[0] ? (
                                                    <img src={property.images[0]} alt={property.address} className="object-cover w-full h-full opacity-90" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center font-mono text-[10px] text-[#404040]">NO IMAGE</div>
                                                )}

                                                <div className="absolute top-4 left-4 flex flex-col gap-2 items-start">
                                                    {property.aiMatchScore && property.aiMatchScore >= 85 && (
                                                        <div className="bg-[#D4AF37]/20 backdrop-blur flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#D4AF37]/50 shadow-[0_0_10px_rgba(212,175,55,0.3)]">
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
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-6 flex flex-col flex-1">
                                                <div className="flex justify-between items-start mb-3">
                                                    <h4 className="font-display text-xl font-medium text-white leading-tight pr-4">
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

                                                {property.aiReasoning && (
                                                    <div className="mb-4 bg-[#D4AF37]/5 border border-[#D4AF37]/20 rounded-lg p-4 relative">
                                                        <div className="absolute -top-2 -left-2 bg-[#171717] rounded-full p-1 border border-[#242424]">✨</div>
                                                        <p className="text-sm text-[#D1D1D1] italic leading-relaxed">"{property.aiReasoning}"</p>
                                                    </div>
                                                )}

                                                {property.aiPriceDropReasoning && (
                                                    <div className="mb-4 bg-red-500/5 border border-red-500/20 rounded-lg p-4 relative">
                                                        <div className="absolute -top-2 -left-2 bg-[#171717] rounded-full p-1 border border-[#242424] text-xs">🩸</div>
                                                        <p className="text-sm text-red-100/80 italic leading-relaxed">"{property.aiPriceDropReasoning}"</p>
                                                    </div>
                                                )}

                                                {property.aiArbitrageAnalysis && (
                                                    <div className="mb-6 bg-[#5EEAD4]/5 border border-[#5EEAD4]/20 rounded-lg p-4 relative">
                                                        <div className="absolute -top-2 -left-2 bg-[#171717] rounded-full p-1 border border-[#242424] text-xs">👀</div>
                                                        <p className="text-sm text-[#5EEAD4]/80 italic leading-relaxed">"{property.aiArbitrageAnalysis}"</p>
                                                    </div>
                                                )}

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
                                                        <div className="text-sm text-[#FAFAFA] font-medium">
                                                            {property.buildingSizeSqft ? `${property.buildingSizeSqft.toLocaleString()} sf` : "Unlisted"}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] uppercase font-mono tracking-wider text-[#7C7C7C] mb-1">Platform</div>
                                                        <div className="text-sm text-[#FAFAFA] font-medium capitalize">{property.platform}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
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

export default function SharedPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-24"><MogulFactLoader message="Loading Portfolio..." /></div>}>
            <SharedPortfolioContent />
        </Suspense>
    );
}
