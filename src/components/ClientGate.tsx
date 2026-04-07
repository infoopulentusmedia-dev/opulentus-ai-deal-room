"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ClientGateProps {
    clientName: string;
    clientId: string;
    onUnlock: () => void;
}

export default function ClientGate({ clientName, clientId, onUnlock }: ClientGateProps) {
    const [phase, setPhase] = useState<"greeting" | "pin">("greeting");
    const [pin, setPin] = useState("");
    const [errorShake, setErrorShake] = useState(false);
    const [success, setSuccess] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-advance greeting -> pin
    useEffect(() => {
        const timer = setTimeout(() => {
            setPhase("pin");
        }, 3000);
        return () => clearTimeout(timer);
    }, []);

    // Focus input when entering pin phase
    useEffect(() => {
        if (phase === "pin") {
            setTimeout(() => inputRef.current?.focus(), 100);
            
            // Re-focus on window focus to ensure mobile keyboards stay up or can be brought up
            const handleFocus = () => inputRef.current?.focus();
            window.addEventListener('focus', handleFocus);
            return () => window.removeEventListener('focus', handleFocus);
        }
    }, [phase]);

    const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (success) return;
        const val = e.target.value.replace(/\D/g, "").slice(0, 4);
        setPin(val);

        if (val.length === 4) {
            if (val === "1234") {
                setSuccess(true);
                // Save to local storage for persistence
                try {
                    localStorage.setItem(`opulentus_access_${clientId}`, "true");
                } catch(e) { } // Ignore incognito quota errors
                setTimeout(() => {
                    onUnlock();
                }, 1000);
            } else {
                setErrorShake(true);
                setTimeout(() => {
                    setErrorShake(false);
                    setPin("");
                    // Ensure focus is totally kept after shake
                    inputRef.current?.focus();
                }, 500);
            }
        }
    };

    return (
        <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0A0A0A]/90 backdrop-blur-xl"
        >
            <AnimatePresence mode="wait">
                {phase === "greeting" && (
                    <motion.div
                        key="greeting"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.05, filter: "blur(8px)" }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                        className="text-center select-none"
                    >
                        <h1 className="font-display text-4xl md:text-6xl text-white tracking-tight font-medium">
                            Welcome, {clientName || "Guest"}
                        </h1>
                    </motion.div>
                )}

                {phase === "pin" && (
                    <motion.div
                        key="pin"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center"
                    >
                        <h2 className="font-display text-2xl text-white mb-8 tracking-wide">Enter Authorized PIN</h2>
                        
                        <div className="relative cursor-text" onClick={() => inputRef.current?.focus()}>
                            {/* Hidden actual input */}
                            <input
                                ref={inputRef}
                                type="tel"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={pin}
                                onChange={handlePinChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-text"
                                maxLength={4}
                                disabled={success}
                            />
                            
                            {/* Visual Boxes */}
                            <motion.div 
                                className="flex gap-4 pointer-events-none"
                                animate={errorShake ? { x: [-10, 10, -10, 10, 0] } : {}}
                                transition={{ duration: 0.4 }}
                            >
                                {[0, 1, 2, 3].map((index) => {
                                    const digit = pin[index];
                                    return (
                                        <div 
                                            key={index}
                                            className={`w-14 h-16 md:w-16 md:h-20 border rounded-xl flex items-center justify-center text-2xl md:text-3xl font-display transition-all duration-300 ${
                                                success ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37] shadow-[0_0_20px_rgba(212,175,55,0.4)]' :
                                                digit ? 'border-[#FAFAFA] text-white bg-[#FAFAFA]/5' : 'border-[#333] bg-[#171717]/50'
                                            }`}
                                        >
                                            {digit ? "•" : ""}
                                        </div>
                                    );
                                })}
                            </motion.div>
                        </div>
                        
                        {success && (
                            <motion.p 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-8 text-[#D4AF37] font-mono uppercase tracking-widest text-sm"
                            >
                                Access Granted
                            </motion.p>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
