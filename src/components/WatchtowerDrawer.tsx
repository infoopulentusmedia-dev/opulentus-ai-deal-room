"use client";

import { X, ArrowLeft, ArrowRight, CheckCircle2, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { WATCHLIST_PROPERTIES } from "@/lib/mockData";
import { AlertCriteria, loadAlerts, saveAlert, getAlert } from "@/lib/alerts";

export default function WatchtowerDrawer({
    isOpen,
    onClose
}: {
    isOpen: boolean;
    onClose: () => void;
}) {
    const [view, setView] = useState<"list" | "wizard">("list");
    const [step, setStep] = useState(1);
    const [alertConfig, setAlertConfig] = useState<AlertCriteria>({
        id: "global",
        clientEmail: "",
        platforms: {
            crexi: { enabled: true, predefined: "Value-Add Retail Strips", customInstruction: "" },
            loopnet: { enabled: true, predefined: "Under-market Rents", customInstruction: "" },
            mls: { enabled: true, predefined: "High Density Zoning", customInstruction: "" }
        },
        sendFrequency: "daily",
        minMatchScore: 85
    });

    useEffect(() => {
        if (isOpen) {
            getAlert("global").then(saved => {
                if (saved) setAlertConfig(saved);
            });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const PREDEFINED_OPTIONS = {
        crexi: ["Value-Add Retail Strips", "Distressed / Off-Market", "Medical / Specialized Office", "High-Cap Rate Industrial", "Other (Custom)"],
        loopnet: ["Under-market Rents", "Creative Office Buildouts", "Adaptive Reuse Candidates", "Stabilized NNN Leases", "Other (Custom)"],
        mls: ["High Density Zoning", "Multifamily Potential", "Tear-down / Lot Value", "Mixed-Use Core", "Other (Custom)"]
    };

    const handleSave = async () => {
        await saveAlert(alertConfig);
        alert("Alert preferences saved! The AI will now scan for these deals every morning.");
        setView("list");
        setStep(1);
    };

    const renderWizardStep = () => {
        switch (step) {
            case 1:
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div>
                            <h3 className="text-sm font-mono tracking-wider text-[#A3A3A3] uppercase mb-4">Step 1: The Target</h3>
                            <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Destination Email</label>
                            <input
                                type="email"
                                placeholder="client@example.com"
                                className="w-full bg-[#171717] border border-[#242424] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#D4AF37] transition-colors"
                                value={alertConfig.clientEmail}
                                onChange={e => setAlertConfig({ ...alertConfig, clientEmail: e.target.value })}
                            />
                            <p className="text-xs text-[#7C7C7C] mt-2">The AI Daily Briefing will be sent here every morning at 7:00 AM.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Minimum Match Score</label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="range"
                                    min="50" max="100"
                                    className="w-full accent-[#D4AF37]"
                                    value={alertConfig.minMatchScore}
                                    onChange={e => setAlertConfig({ ...alertConfig, minMatchScore: parseInt(e.target.value) })}
                                />
                                <span className="text-[#D4AF37] font-mono text-sm bg-[#D4AF37]/10 px-2 py-1 rounded">{alertConfig.minMatchScore}+</span>
                            </div>
                            <p className="text-xs text-[#7C7C7C] mt-2">Only deals scoring above this threshold will make it into the email.</p>
                        </div>
                    </div>
                );
            case 2:
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-mono tracking-wider text-[#A3A3A3] uppercase">Step 2: Crexi Protocol</h3>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" className="accent-[#D4AF37]"
                                        checked={alertConfig.platforms.crexi.enabled}
                                        onChange={e => setAlertConfig({ ...alertConfig, platforms: { ...alertConfig.platforms, crexi: { ...alertConfig.platforms.crexi, enabled: e.target.checked } } })}
                                    />
                                    <span className="text-xs font-mono text-[#FAFAFA]">Enable Crexi</span>
                                </label>
                            </div>

                            {alertConfig.platforms.crexi.enabled && (
                                <>
                                    <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Primary Target Profile (Crexi)</label>
                                    <div className="relative mb-4">
                                        <select
                                            className="w-full bg-[#171717] border border-[#242424] rounded-lg px-4 py-3 text-white appearance-none focus:outline-none focus:border-[#D4AF37]"
                                            value={alertConfig.platforms.crexi.predefined}
                                            onChange={e => setAlertConfig({ ...alertConfig, platforms: { ...alertConfig.platforms, crexi: { ...alertConfig.platforms.crexi, predefined: e.target.value } } })}
                                        >
                                            {PREDEFINED_OPTIONS.crexi.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                        <ChevronDown size={16} className="absolute right-4 top-3.5 text-[#7C7C7C] pointer-events-none" />
                                    </div>

                                    <label className="block text-sm font-medium text-[#FAFAFA] mb-2">AI Custom Directives (Optional)</label>
                                    <textarea
                                        placeholder="e.g., 'Only find retail properties with a cap rate over 7% that explicitly mention a motivated seller in the description.'"
                                        className="w-full bg-[#171717] border border-[#242424] rounded-lg px-4 py-3 text-white h-24 resize-none focus:outline-none focus:border-[#D4AF37]"
                                        value={alertConfig.platforms.crexi.customInstruction}
                                        onChange={e => setAlertConfig({ ...alertConfig, platforms: { ...alertConfig.platforms, crexi: { ...alertConfig.platforms.crexi, customInstruction: e.target.value } } })}
                                    />
                                </>
                            )}
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-mono tracking-wider text-[#A3A3A3] uppercase">Step 3: LoopNet Protocol</h3>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" className="accent-[#D4AF37]"
                                        checked={alertConfig.platforms.loopnet.enabled}
                                        onChange={e => setAlertConfig({ ...alertConfig, platforms: { ...alertConfig.platforms, loopnet: { ...alertConfig.platforms.loopnet, enabled: e.target.checked } } })}
                                    />
                                    <span className="text-xs font-mono text-[#FAFAFA]">Enable LoopNet</span>
                                </label>
                            </div>

                            {alertConfig.platforms.loopnet.enabled && (
                                <>
                                    <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Primary Target Profile (LoopNet)</label>
                                    <div className="relative mb-4">
                                        <select
                                            className="w-full bg-[#171717] border border-[#242424] rounded-lg px-4 py-3 text-white appearance-none focus:outline-none focus:border-[#D4AF37]"
                                            value={alertConfig.platforms.loopnet.predefined}
                                            onChange={e => setAlertConfig({ ...alertConfig, platforms: { ...alertConfig.platforms, loopnet: { ...alertConfig.platforms.loopnet, predefined: e.target.value } } })}
                                        >
                                            {PREDEFINED_OPTIONS.loopnet.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                        <ChevronDown size={16} className="absolute right-4 top-3.5 text-[#7C7C7C] pointer-events-none" />
                                    </div>

                                    <label className="block text-sm font-medium text-[#FAFAFA] mb-2">AI Custom Directives (Optional)</label>
                                    <textarea
                                        placeholder="e.g., 'Filter for office units with existing long-term medical tenants.'"
                                        className="w-full bg-[#171717] border border-[#242424] rounded-lg px-4 py-3 text-white h-24 resize-none focus:outline-none focus:border-[#D4AF37]"
                                        value={alertConfig.platforms.loopnet.customInstruction}
                                        onChange={e => setAlertConfig({ ...alertConfig, platforms: { ...alertConfig.platforms, loopnet: { ...alertConfig.platforms.loopnet, customInstruction: e.target.value } } })}
                                    />
                                </>
                            )}
                        </div>
                    </div>
                );
            case 4:
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-mono tracking-wider text-[#A3A3A3] uppercase">Step 4: Realcomp MLS Protocol</h3>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" className="accent-[#D4AF37]"
                                        checked={alertConfig.platforms.mls.enabled}
                                        onChange={e => setAlertConfig({ ...alertConfig, platforms: { ...alertConfig.platforms, mls: { ...alertConfig.platforms.mls, enabled: e.target.checked } } })}
                                    />
                                    <span className="text-xs font-mono text-[#FAFAFA]">Enable Local MLS</span>
                                </label>
                            </div>

                            {alertConfig.platforms.mls.enabled && (
                                <>
                                    <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Primary Target Profile (MLS)</label>
                                    <div className="relative mb-4">
                                        <select
                                            className="w-full bg-[#171717] border border-[#242424] rounded-lg px-4 py-3 text-white appearance-none focus:outline-none focus:border-[#D4AF37]"
                                            value={alertConfig.platforms.mls.predefined}
                                            onChange={e => setAlertConfig({ ...alertConfig, platforms: { ...alertConfig.platforms, mls: { ...alertConfig.platforms.mls, predefined: e.target.value } } })}
                                        >
                                            {PREDEFINED_OPTIONS.mls.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                        <ChevronDown size={16} className="absolute right-4 top-3.5 text-[#7C7C7C] pointer-events-none" />
                                    </div>

                                    <label className="block text-sm font-medium text-[#FAFAFA] mb-2">AI Custom Directives (Optional)</label>
                                    <textarea
                                        placeholder="e.g., 'Look for multi-family zoning codes within Detroit proper that could support heavy density buildouts.'"
                                        className="w-full bg-[#171717] border border-[#242424] rounded-lg px-4 py-3 text-white h-24 resize-none focus:outline-none focus:border-[#D4AF37]"
                                        value={alertConfig.platforms.mls.customInstruction}
                                        onChange={e => setAlertConfig({ ...alertConfig, platforms: { ...alertConfig.platforms, mls: { ...alertConfig.platforms.mls, customInstruction: e.target.value } } })}
                                    />
                                </>
                            )}
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <>
            {/* Backdrop overlay */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity"
                onClick={onClose}
            />

            {/* Right Sliding Drawer */}
            <div className="fixed inset-y-0 right-0 w-full max-w-md bg-[#0A0A0A] border-l border-[#242424] z-50 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out">
                {/* Header */}
                <div className="p-6 border-b border-[#242424] flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h2 className="font-display text-lg font-semibold text-[#FAFAFA]">
                                {view === "list" ? "Watchtower Digest" : "Automated AI Alerts"}
                            </h2>
                            {view === "list" && <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
                        </div>
                        <p className="text-sm text-[#A3A3A3]">
                            {view === "list" ? "Monitoring Active Deals & Market Signals" : "Configure AI Scraper Preferences"}
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            if (view === "wizard") {
                                setView("list");
                                setStep(1);
                            } else {
                                onClose();
                            }
                        }}
                        className="text-[#7C7C7C] hover:text-[#FAFAFA] transition-colors p-1"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {view === "list" ? (
                        <>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-mono text-[#7C7C7C] tracking-wider uppercase">Saved Properties</span>
                                <span className="text-xs font-mono bg-[#171717] px-2 py-0.5 rounded border border-[#242424] text-[#FAFAFA]">
                                    {WATCHLIST_PROPERTIES.length} Items
                                </span>
                            </div>

                            <div className="space-y-4">
                                {WATCHLIST_PROPERTIES.map((property) => (
                                    <Link
                                        key={property.ListingId}
                                        href={`/chat?watchtowerId=${property.ListingId}`}
                                        className="block group border border-[#242424] bg-[#171717] p-4 rounded-xl hover:border-[#404040] transition-colors relative"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-display font-medium text-[#FAFAFA] text-base group-hover:text-white transition-colors">
                                                {property.UnparsedAddress}
                                            </h3>
                                            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[#242424] text-[#A3A3A3]">
                                                {property.PropertyType}
                                            </span>
                                        </div>
                                        <div className="text-sm text-[#A3A3A3] mb-3 line-clamp-2">
                                            {property.PublicRemarks}
                                        </div>
                                        <div className="flex items-center justify-between border-t border-[#242424] pt-3 mt-3">
                                            <div>
                                                <div className="text-[10px] text-[#7C7C7C] font-mono tracking-wider uppercase mb-0.5">List Price</div>
                                                <div className="text-sm font-medium text-[#FAFAFA]">
                                                    ${property.ListPrice.toLocaleString()}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] text-[#7C7C7C] font-mono tracking-wider uppercase mb-0.5">Market Status</div>
                                                <div className="text-sm font-medium text-[#FAFAFA]">
                                                    {property.DaysOnMarket} DOM
                                                </div>
                                            </div>
                                        </div>

                                        <div className="absolute inset-0 border border-white/0 group-hover:border-white/10 rounded-xl transition-colors pointer-events-none" />
                                    </Link>
                                ))}
                            </div>
                        </>
                    ) : (
                        renderWizardStep()
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-[#242424] bg-[#0A0A0A]">
                    {view === "list" ? (
                        <button
                            onClick={() => setView("wizard")}
                            className="w-full py-2.5 rounded border border-[#242424] bg-[#171717] hover:bg-[#242424] transition-colors text-[13px] font-medium text-[#FAFAFA]"
                        >
                            Manage Alerts
                        </button>
                    ) : (
                        <div className="flex gap-4">
                            {step > 1 && (
                                <button
                                    onClick={() => setStep(step - 1)}
                                    className="flex-1 py-2.5 rounded border border-[#242424] bg-[#171717] hover:bg-[#242424] transition-colors text-[13px] font-medium text-[#FAFAFA] flex items-center justify-center gap-2"
                                >
                                    <ArrowLeft size={16} /> Back
                                </button>
                            )}
                            {step < 4 ? (
                                <button
                                    onClick={() => setStep(step + 1)}
                                    className="flex-[2] py-2.5 rounded border border-[#D4AF37]/50 bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 transition-colors text-[13px] font-medium text-[#FAFAFA] flex items-center justify-center gap-2"
                                >
                                    Next Protocol <ArrowRight size={16} />
                                </button>
                            ) : (
                                <button
                                    onClick={handleSave}
                                    className="flex-[2] py-2.5 rounded border border-green-500/50 bg-green-500/10 hover:bg-green-500/20 transition-colors text-[13px] font-medium text-green-400 flex items-center justify-center gap-2"
                                >
                                    Save & Deploy Alerts <CheckCircle2 size={16} />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
