"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function DeepSearchProgress({ query }: { query: string }) {
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState("Initializing intelligence engines...");

    useEffect(() => {
        let isMounted = true;
        let p = 0;

        // Extract some context from query for dynamic text
        const qLower = query.toLowerCase();
        
        let keywordContext = "investment opportunities";
        if (qLower.includes("distress") || qLower.includes("foreclos")) keywordContext = "distressed assets";
        if (qLower.includes("multifamily") || qLower.includes("multi-family") || qLower.includes("apartment")) keywordContext = "multifamily properties";
        if (qLower.includes("commercial")) keywordContext = "commercial real estate";
        if (qLower.includes("retail") || qLower.includes("strip")) keywordContext = "retail centers";
        if (qLower.includes("industrial") || qLower.includes("warehouse")) keywordContext = "industrial spaces";

        let geoContext = "target zones";
        const miCounties = ["wayne", "macomb", "oakland", "washtenaw", "kent", "monroe"];
        const foundCounty = miCounties.find(c => qLower.includes(c));
        if (foundCounty) geoContext = `${foundCounty.charAt(0).toUpperCase() + foundCounty.slice(1)} County boundaries`;
        else if (qLower.includes("detroit")) geoContext = "Detroit metro area";
        else if (qLower.includes("michigan") || qLower.includes(" mi ")) geoContext = "Michigan statewide network";

        const steps = [
            { threshold: 0, text: `Analyzing investment intent for ${keywordContext}...` },
            { threshold: 18, text: `Establishing geographic parameters around ${geoContext}...` },
            { threshold: 40, text: `Connecting to multi-node data streams (LoopNet, Crexi)...` },
            { threshold: 65, text: `Cross-referencing active market listings...` },
            { threshold: 80, text: `Scoring potential matches against Opulentus underwriting algorithms...` },
            { threshold: 92, text: `Finalizing Deal Room analysis for top-rated assets...` },
            { threshold: 98, text: `Structuring presentation...` }
        ];

        const interval = setInterval(() => {
            if (!isMounted) return;
            
            // Randomly jump 1-3 percent points to feel like real streaming progress
            const jump = Math.floor(Math.random() * 3) + 1;
            p = Math.min(p + jump, 99); // max out at 99% until fully done
            
            setProgress(p);

            // Find current text step
            const currentStep = [...steps].reverse().find(s => p >= s.threshold);
            if (currentStep && currentStep.text !== statusText) {
                setStatusText(currentStep.text);
            }
        }, 150);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [query]);

    return (
        <div className="w-full h-full min-h-[160px] rounded-2xl bg-[#171717] border border-[#242424] flex flex-col items-center justify-center p-6 text-center shadow-lg my-4">
            <div className="relative w-16 h-16 flex items-center justify-center mb-5">
                {/* Background Ring */}
                <svg className="w-full h-full transform -rotate-90">
                    <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke="rgba(212, 175, 55, 0.1)"
                        strokeWidth="4"
                        fill="transparent"
                        className="transition-all duration-300"
                    />
                    {/* Progress Ring */}
                    <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke="#D4AF37"
                        strokeWidth="4"
                        fill="transparent"
                        strokeDasharray={2 * Math.PI * 28}
                        strokeDashoffset={2 * Math.PI * 28 * (1 - progress / 100)}
                        strokeLinecap="round"
                        className="transition-all duration-150 ease-out shadow-[0_0_15px_rgba(212,175,55,0.4)]"
                    />
                </svg>
                {/* Number */}
                <span className="absolute text-[13px] font-mono font-bold text-[#D4AF37] tracking-tighter">
                    {progress}%
                </span>
            </div>

            <div className="min-h-8 flex items-center justify-center w-full max-w-sm mx-auto">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={statusText}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.3 }}
                        className="text-[11px] font-mono font-medium text-[#A3A3A3] tracking-widest uppercase leading-relaxed"
                    >
                        {statusText}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}
