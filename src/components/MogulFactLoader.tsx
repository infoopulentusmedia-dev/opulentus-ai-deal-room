"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function MogulFactLoader({ message = "Consulting Intelligence Archives..." }: { message?: string }) {
    const [fact, setFact] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        async function fetchFact() {
            try {
                const res = await fetch("/api/mogul-fact");
                const data = await res.json();
                if (isMounted && data.fact) {
                    setFact(data.fact);
                }
            } catch (err) {
                // If API fails, fail silently and keep the circling animation
            }
        }
        fetchFact();
        return () => { isMounted = false; };
    }, []);

    return (
        <div className="w-full h-full min-h-[140px] rounded-2xl bg-[#171717] border border-[#242424] flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin shadow-[0_0_10px_rgba(212,175,55,0.3)]"></div>
                <div className="text-[10px] font-mono font-medium text-[#D4AF37] tracking-widest uppercase animate-pulse">
                    {message}
                </div>
            </div>

            <div className="min-h-16 flex items-center justify-center w-full max-w-2xl mx-auto mt-2">
                <AnimatePresence mode="wait">
                    {fact ? (
                        <motion.div
                            key="fact"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="text-xs text-[#A3A3A3] leading-relaxed italic border-l-2 border-[#D4AF37]/30 pl-3 text-left w-full"
                        >
                            "{fact}"
                        </motion.div>
                    ) : (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-[10px] text-[#A3A3A3]/50 font-mono tracking-wider"
                        >
                            Retrieving historical data...
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
