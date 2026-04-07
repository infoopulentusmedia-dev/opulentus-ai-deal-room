"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BuyBoxCriteria, saveClientBuyBox } from "@/lib/buybox";
import { motion, AnimatePresence } from "framer-motion";

interface BuyBoxWizardProps {
    isOpen: boolean;
    onClose: () => void;
    initialData: BuyBoxCriteria | null;
    isPersonal?: boolean;
    onClientSaved?: () => void;
}

export default function BuyBoxWizard({ isOpen, onClose, initialData, isPersonal, onClientSaved }: BuyBoxWizardProps) {
    const router = useRouter();
    const [step, setStep] = useState(1);

    // Initialize form with previous data or empty structure
    const [formData, setFormData] = useState<BuyBoxCriteria>(initialData || {
        id: "",
        name: "",
        email: "",
        propertyType: "",
        transactionType: "",
        location: "",
        priceMin: "",
        priceMax: "",
        sizeMin: "",
        sizeMax: "",
        specialCriteria: ""
    });

    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleNext = () => {
        if (step < 7) setStep(step + 1);
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
    };

    const normalizeNumeric = (val: string): string => {
        const s = val.trim().replace(/,/g, "").toLowerCase();
        if (!s) return "";
        const multiplier = s.endsWith("m") ? 1_000_000 : s.endsWith("k") ? 1_000 : 1;
        const num = parseFloat(s.replace(/[^0-9.]/g, ""));
        if (isNaN(num)) return val; // leave unchanged if unparseable
        return String(Math.round(num * multiplier));
    };

    const handleSubmit = async () => {
        if (!formData.name.trim()) {
            setSaveError("Client name is required.");
            return;
        }
        setIsSaving(true);
        setSaveError(null);
        try {
            // Normalize price/size fields before saving so "5M" → "5000000", "40k" → "40000"
            const normalizedData = {
                ...formData,
                priceMin: normalizeNumeric(formData.priceMin),
                priceMax: normalizeNumeric(formData.priceMax),
                sizeMin: normalizeNumeric(formData.sizeMin),
                sizeMax: normalizeNumeric(formData.sizeMax),
            };
            const savedUUID = await saveClientBuyBox(normalizedData);
            if (!savedUUID) {
                setSaveError("Failed to save client — database unreachable. Please try again.");
                return;
            }
            if (onClientSaved) onClientSaved();
            onClose();
            // Always route with the Supabase UUID so loadClientBuyBox can find the record
            router.push(`/daily-updates?client=${savedUUID}`);
        } finally {
            setIsSaving(false);
        }
    };

    const updateField = (field: keyof BuyBoxCriteria, value: string) => {
        if (field === "name") {
            const id = isPersonal ? (initialData?.id || "") : value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); // basic slugify
            setFormData(prev => ({ ...prev, name: value, id }));
        } else {
            setFormData(prev => ({ ...prev, [field]: value }));
        }
    };

    const totalSteps = 7;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
                >
                    <motion.div
                        initial={{ scale: 0.95, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        className="bg-[#0A0A0A] border border-[#242424] rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col h-[80vh] max-h-[600px] shadow-2xl"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-[#242424]">
                            <div>
                                <h2 className="text-xl font-display font-medium text-white tracking-tight">{isPersonal ? "Configure My Buy Box" : "Configure Client Portfolio"}</h2>
                                <p className="text-xs font-mono text-[#A3A3A3] mt-1.5 uppercase tracking-wider">Step {step} of {totalSteps}</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 flex items-center justify-center bg-[#171717] hover:bg-[#242424] border border-[#242424] rounded-full text-[#A3A3A3] transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-1 bg-[#171717]">
                            <motion.div
                                className="h-full bg-[#D4AF37]"
                                initial={{ width: `${((step - 1) / totalSteps) * 100}%` }}
                                animate={{ width: `${(step / totalSteps) * 100}%` }}
                                transition={{ duration: 0.3 }}
                            />
                        </div>

                        {/* Content area */}
                        <div className="flex-1 overflow-y-auto p-8">
                            {step === 1 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <h3 className="text-2xl font-display text-white">Who is this portfolio for?</h3>
                                    <div>
                                        <label className="text-xs font-mono text-[#7C7C7C] uppercase block mb-2">Client Name</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Ali Beydoun"
                                            value={formData.name}
                                            onChange={(e) => updateField("name", e.target.value)}
                                            className="w-full bg-[#171717] border border-[#242424] rounded-lg px-4 py-4 text-white text-lg focus:outline-none focus:border-[#404040]"
                                            autoFocus
                                        />
                                    </div>
                                </div>
                            )}

                            {step === 2 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <h3 className="text-2xl font-display text-white">
                                        {isPersonal ? "What asset classes are you targeting for your own book?" : "What type of property are they looking for?"}
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        {["Retail", "Industrial", "Office", "Multifamily", "Land", "Special Purpose"].map(type => (
                                            <button
                                                key={type}
                                                onClick={() => updateField("propertyType", type)}
                                                className={`p-4 rounded-xl border text-left transition-all ${formData.propertyType === type ? 'bg-[#D4AF37]/10 border-[#D4AF37] text-[#D4AF37]' : 'bg-[#171717] border-[#242424] text-[#A3A3A3] hover:border-[#404040]'}`}
                                            >
                                                <div className="font-medium">{type}</div>
                                            </button>
                                        ))}
                                    </div>
                                    <div>
                                        <label className="text-xs font-mono text-[#7C7C7C] uppercase block mb-2">Or type specific asset class</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Strip center... "
                                            value={["Retail", "Industrial", "Office", "Multifamily", "Land", "Special Purpose"].includes(formData.propertyType) ? "" : formData.propertyType}
                                            onChange={(e) => updateField("propertyType", e.target.value)}
                                            className="w-full bg-[#171717] border border-[#242424] rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#404040]"
                                        />
                                    </div>
                                </div>
                            )}

                            {step === 3 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <h3 className="text-2xl font-display text-white">
                                        {isPersonal ? "What is your primary investment thesis?" : "What is the desired transaction type?"}
                                    </h3>
                                    <div className="grid grid-cols-1 gap-3">
                                        {(isPersonal
                                            ? ["Hold (Long-term Income)", "Value-Add / Repositioning", "Wholesale / Quick Flip"]
                                            : ["For Sale", "For Lease", "Auction"]
                                        ).map(type => (
                                            <button
                                                key={type}
                                                onClick={() => updateField("transactionType", type)}
                                                className={`p-4 rounded-xl border text-left transition-all ${formData.transactionType === type ? 'bg-[#D4AF37]/10 border-[#D4AF37] text-[#D4AF37]' : 'bg-[#171717] border-[#242424] text-[#A3A3A3] hover:border-[#404040]'}`}
                                            >
                                                <div className="font-medium">{type}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {step === 4 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <h3 className="text-2xl font-display text-white">
                                        {isPersonal ? "Target geography for your portfolio?" : "Where are they looking to acquire?"}
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        {["Wayne County, MI", "Oakland County, MI", "Detroit, MI", "Anywhere in Michigan"].map(loc => (
                                            <button
                                                key={loc}
                                                onClick={() => updateField("location", loc)}
                                                className={`p-4 rounded-xl border text-left transition-all ${formData.location === loc ? 'bg-[#D4AF37]/10 border-[#D4AF37] text-[#D4AF37]' : 'bg-[#171717] border-[#242424] text-[#A3A3A3] hover:border-[#404040]'}`}
                                            >
                                                <div className="font-medium">{loc}</div>
                                            </button>
                                        ))}
                                    </div>
                                    <div>
                                        <label className="text-xs font-mono text-[#7C7C7C] uppercase block mb-2">Or enter specific cities / zip codes</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. 48124, 48128, Allen Park..."
                                            value={["Wayne County, MI", "Oakland County, MI", "Detroit, MI", "Anywhere in Michigan"].includes(formData.location) ? "" : formData.location}
                                            onChange={(e) => updateField("location", e.target.value)}
                                            className="w-full bg-[#171717] border border-[#242424] rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#404040]"
                                        />
                                    </div>
                                </div>
                            )}

                            {step === 5 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <h3 className="text-2xl font-display text-white">
                                        {isPersonal ? "Capital deployment limitations?" : "What is their target price range?"}
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-mono text-[#7C7C7C] uppercase block mb-2">Minimum Price</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7C7C7C]">$</span>
                                                <input
                                                    type="text"
                                                    placeholder="0"
                                                    value={formData.priceMin}
                                                    onChange={(e) => updateField("priceMin", e.target.value)}
                                                    className="w-full bg-[#171717] border border-[#242424] rounded-lg pl-8 pr-4 py-3 text-sm text-white focus:outline-none focus:border-[#404040]"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-mono text-[#7C7C7C] uppercase block mb-2">Maximum Price</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7C7C7C]">$</span>
                                                <input
                                                    type="text"
                                                    placeholder="5,000,000"
                                                    value={formData.priceMax}
                                                    onChange={(e) => updateField("priceMax", e.target.value)}
                                                    className="w-full bg-[#171717] border border-[#242424] rounded-lg pl-8 pr-4 py-3 text-sm text-white focus:outline-none focus:border-[#404040]"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 6 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <h3 className="text-2xl font-display text-white">
                                        {isPersonal ? "Target Yield (Cap Rate) & Size profile?" : "Target building size (Sq. Ft)?"}
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-mono text-[#7C7C7C] uppercase block mb-2">{isPersonal ? "Min Cap Rate (%)" : "Minimum SF"}</label>
                                            <input
                                                type="text"
                                                placeholder={isPersonal ? "e.g. 7.5" : "e.g. 5,000"}
                                                value={formData.sizeMin}
                                                onChange={(e) => updateField("sizeMin", e.target.value)}
                                                className="w-full bg-[#171717] border border-[#242424] rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#404040]"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-mono text-[#7C7C7C] uppercase block mb-2">{isPersonal ? "Minimum SF" : "Maximum SF"}</label>
                                            <input
                                                type="text"
                                                placeholder={isPersonal ? "e.g. 10,000" : "e.g. 50,000"}
                                                value={formData.sizeMax}
                                                onChange={(e) => updateField("sizeMax", e.target.value)}
                                                className="w-full bg-[#171717] border border-[#242424] rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#404040]"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 7 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <h3 className="text-2xl font-display text-white">Any special criteria or keywords?</h3>
                                    <div className="grid grid-cols-2 gap-3 mb-6">
                                        {["Value-Add", "NNN Leased", "Fully Vacant", "Opportunity Zone"].map(crit => (
                                            <button
                                                key={crit}
                                                onClick={() => {
                                                    const current = formData.specialCriteria;
                                                    const updated = current.includes(crit)
                                                        ? current.replace(crit, "").replace(/,\s*,/g, ",").trim().replace(/^,|,$/g, "")
                                                        : current ? `${current}, ${crit}` : crit;
                                                    updateField("specialCriteria", updated);
                                                }}
                                                className={`p-3 rounded-xl border text-center transition-all ${formData.specialCriteria.includes(crit) ? 'bg-[#D4AF37]/10 border-[#D4AF37] text-[#D4AF37]' : 'bg-[#171717] border-[#242424] text-[#A3A3A3] hover:border-[#404040]'}`}
                                            >
                                                <div className="font-medium text-sm">{crit}</div>
                                            </button>
                                        ))}
                                    </div>
                                    <textarea
                                        placeholder="e.g. Must have drive-thru, high cap rate, heavy power..."
                                        value={formData.specialCriteria}
                                        onChange={(e) => updateField("specialCriteria", e.target.value)}
                                        className="w-full h-32 bg-[#171717] border border-[#242424] rounded-lg p-4 text-sm text-white focus:outline-none focus:border-[#404040] resize-none"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Footer Nav */}
                        <div className="p-6 border-t border-[#242424] bg-[#0A0A0A] flex flex-col gap-3">
                        {saveError && (
                            <div className="w-full text-center text-xs font-mono text-red-400 bg-red-900/20 border border-red-900/40 rounded-lg px-4 py-2">
                                {saveError}
                            </div>
                        )}
                        <div className="flex items-center justify-between">
                            <button
                                onClick={handleBack}
                                disabled={step === 1}
                                className="px-6 py-2.5 rounded-lg border border-[#242424] bg-transparent text-white text-sm font-medium hover:bg-[#171717] transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                            >
                                Back
                            </button>

                            {step < totalSteps ? (
                                <button
                                    onClick={handleNext}
                                    disabled={step === 1 && !formData.name}
                                    className="px-8 py-2.5 rounded-lg bg-[#FAFAFA] text-[#0A0A0A] text-sm font-medium hover:bg-[#E5E5E5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next Step
                                </button>
                            ) : (
                                <button
                                    onClick={handleSubmit}
                                    disabled={isSaving}
                                    className="px-8 py-2.5 rounded-lg bg-[#D4AF37] text-[#0A0A0A] text-sm font-medium hover:bg-[#F3D673] transition-colors shadow-[0_0_15px_rgba(212,175,55,0.3)] disabled:opacity-75 disabled:cursor-not-allowed flex items-center justify-center min-w-[180px]"
                                >
                                    {isSaving ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-[#0A0A0A] border-t-transparent rounded-full animate-spin"></div>
                                            <span>Saving...</span>
                                        </div>
                                    ) : (
                                        "Save Portfolio & Scan"
                                    )}
                                </button>
                            )}
                        </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
