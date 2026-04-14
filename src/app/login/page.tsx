"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

// Typed cubic-bezier tuple so Framer Motion v12 accepts it as BezierDefinition
const SPRING = [0.16, 1, 0.3, 1] as [number, number, number, number];

// ─── Agent roster ─────────────────────────────────────────────────────────────
const AGENTS = [
    { firstName: "Nick",    email: "njaafar@kw.com"         },
    { firstName: "Zack",    email: "zackd@kw.com"           },
    { firstName: "Hussein", email: "husseinalmaliki@kw.com" },
] as const;

type Agent = typeof AGENTS[number];
type Phase = "intro" | "select" | "password" | "welcome";

// ─── Shared stagger variants (no `ease` — avoids FM v12 type issue) ───────────
const staggerParent = {
    hidden: {},
    show:   { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};
const staggerChild = {
    hidden: { opacity: 0, y: 18 },
    show:   { opacity: 1,  y: 0  },
};

// ─── Act 1: Overture ──────────────────────────────────────────────────────────
function IntroScreen() {
    const letters = "OPULENTUS".split("");

    return (
        <motion.div
            key="intro"
            className="flex flex-col items-center justify-center text-center select-none"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, y: -28, transition: { duration: 0.45 } }}
        >
            {/* Logo square */}
            <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1,   opacity: 1 }}
                transition={{ duration: 0.7, ease: SPRING }}
                className="mb-6"
                style={{ boxShadow: "0 0 40px 8px rgba(212,175,55,0.22), 0 0 80px 20px rgba(212,175,55,0.07)" }}
            >
                <div className="w-16 h-16 rounded-2xl bg-[#D4AF37] flex items-center justify-center">
                    <span className="text-[#0A0A0A] font-bold text-3xl font-display">O</span>
                </div>
            </motion.div>

            {/* Staggered wordmark */}
            <div className="flex items-center gap-[2px] mb-3">
                {letters.map((letter, i) => (
                    <motion.span
                        key={i}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 + i * 0.055, duration: 0.4, ease: SPRING }}
                        className="text-white font-display font-bold text-3xl tracking-[0.18em]"
                    >
                        {letter}
                    </motion.span>
                ))}
            </div>

            {/* Tagline */}
            <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1, duration: 0.5, ease: SPRING }}
                className="text-[#A3A3A3] text-sm font-mono tracking-wider"
            >
                AI-Powered Real Estate Intelligence
            </motion.p>
        </motion.div>
    );
}

// ─── Act 2a: Agent selector ───────────────────────────────────────────────────
function AgentSelector({ onSelect }: { onSelect: (agent: Agent) => void }) {
    return (
        <motion.div
            key="select"
            className="w-full max-w-sm text-center"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, ease: SPRING }}
        >
            <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4, ease: SPRING }}
                className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#7C7C7C] mb-8"
            >
                Who&apos;s logging in?
            </motion.p>

            <motion.div
                className="flex items-center justify-center gap-6"
                variants={staggerParent}
                initial="hidden"
                animate="show"
            >
                {AGENTS.map((agent) => (
                    <motion.button
                        key={agent.email}
                        variants={staggerChild}
                        transition={{ duration: 0.5, ease: SPRING }}
                        whileHover={{ scale: 1.07 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => onSelect(agent)}
                        className="flex flex-col items-center gap-2.5 group cursor-pointer"
                    >
                        <div className="w-[72px] h-[72px] rounded-full bg-[#171717] border-2 border-[#D4AF37]/60 flex items-center justify-center transition-all duration-300 group-hover:border-[#D4AF37] group-hover:shadow-[0_0_18px_4px_rgba(212,175,55,0.25)]">
                            <span className="text-[#D4AF37] font-display font-bold text-2xl">
                                {agent.firstName[0]}
                            </span>
                        </div>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-[#7C7C7C] group-hover:text-[#D4AF37] transition-colors">
                            {agent.firstName}
                        </span>
                    </motion.button>
                ))}
            </motion.div>
        </motion.div>
    );
}

// ─── Act 2b: Password form ────────────────────────────────────────────────────
function PasswordForm({
    agent,
    onBack,
    onSuccess,
}: {
    agent: Agent;
    onBack: () => void;
    onSuccess: () => void;
}) {
    const [password, setPassword] = useState("");
    const [error, setError]       = useState<string | null>(null);
    const [loading, setLoading]   = useState(false);
    const [shake, setShake]       = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const t = setTimeout(() => inputRef.current?.focus(), 380);
        return () => clearTimeout(t);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password) return;
        setError(null);
        setLoading(true);

        const supabase = createSupabaseBrowserClient();
        const { error: authError } = await supabase.auth.signInWithPassword({
            email: agent.email,
            password,
        });

        if (authError) {
            setLoading(false);
            setError("Incorrect password. Try again.");
            setShake(true);
            setTimeout(() => setShake(false), 500);
            return;
        }

        onSuccess();
    };

    return (
        <motion.div
            key="password"
            className="w-full max-w-sm"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, ease: SPRING }}
        >
            {/* Avatar chip + greeting */}
            <motion.div
                className="flex flex-col items-center mb-8"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.45, ease: SPRING }}
            >
                <div
                    className="w-12 h-12 rounded-full bg-[#171717] border-2 border-[#D4AF37] flex items-center justify-center mb-4"
                    style={{ boxShadow: "0 0 20px 4px rgba(212,175,55,0.2)" }}
                >
                    <span className="text-[#D4AF37] font-display font-bold text-lg">
                        {agent.firstName[0]}
                    </span>
                </div>
                <p className="text-[11px] font-mono text-[#D4AF37] uppercase tracking-[0.18em] mb-1">
                    Welcome back,
                </p>
                <p className="text-white font-display font-bold text-2xl tracking-wide">
                    {agent.firstName}
                </p>
            </motion.div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12, duration: 0.45, ease: SPRING }}
                >
                    <input
                        ref={inputRef}
                        type="password"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(null); }}
                        placeholder="Enter your password"
                        required
                        className={[
                            "w-full bg-[#0A0A0A] border rounded-xl px-4 py-3.5 text-sm text-white placeholder:text-[#444] focus:outline-none transition-all duration-200",
                            error
                                ? "border-red-500/70 focus:border-red-500"
                                : "border-[#333] focus:border-[#D4AF37]",
                            shake ? "animate-shake" : "",
                        ].join(" ")}
                    />
                    <AnimatePresence>
                        {error && (
                            <motion.p
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.25 }}
                                className="text-[11px] font-mono text-red-400 mt-2 px-1"
                            >
                                {error}
                            </motion.p>
                        )}
                    </AnimatePresence>
                </motion.div>

                <motion.button
                    type="submit"
                    disabled={loading || !password}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.22, duration: 0.4, ease: SPRING }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full bg-[#D4AF37] hover:bg-[#E5C158] text-black font-bold text-sm py-3.5 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                >
                    {loading ? (
                        <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    ) : (
                        "Sign In"
                    )}
                </motion.button>
            </form>

            {/* Back link */}
            <motion.button
                type="button"
                onClick={onBack}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.35 }}
                className="mt-5 w-full text-center text-[11px] font-mono text-[#555] hover:text-[#A3A3A3] transition-colors uppercase tracking-widest cursor-pointer"
            >
                ← Choose different
            </motion.button>
        </motion.div>
    );
}

// ─── Act 3: Welcome moment ────────────────────────────────────────────────────
function WelcomeScreen({ agent }: { agent: Agent }) {
    const name = agent.firstName.toUpperCase();

    return (
        <motion.div
            key="welcome"
            className="fixed inset-0 z-50 bg-[#0A0A0A] flex flex-col items-center justify-center text-center select-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.03, transition: { duration: 0.55 } }}
            transition={{ duration: 0.3 }}
        >
            {/* Radial glow burst */}
            <motion.div
                className="absolute inset-0 pointer-events-none"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 3 }}
                transition={{ duration: 0.9, ease: SPRING }}
                style={{
                    background: "radial-gradient(ellipse at center, rgba(212,175,55,0.18) 0%, transparent 65%)",
                }}
            />

            <div className="relative z-10 flex flex-col items-center gap-4">
                {/* "Welcome," label */}
                <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.5, ease: SPRING }}
                    className="text-[#D4AF37] font-mono text-sm uppercase tracking-[0.25em]"
                >
                    Welcome,
                </motion.p>

                {/* Agent name — large display */}
                <motion.h1
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35, duration: 0.65, ease: SPRING }}
                    className="text-white font-display font-bold tracking-[0.22em]"
                    style={{ fontSize: "clamp(3rem, 10vw, 6rem)", lineHeight: 1 }}
                >
                    {name}
                </motion.h1>

                {/* Gold rule */}
                <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.6, duration: 0.5, ease: SPRING }}
                    style={{ originX: 0.5 }}
                    className="h-px w-48 bg-[#D4AF37]/60"
                />

                {/* Tagline */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.85, duration: 0.5 }}
                    className="text-[#555] font-mono text-xs uppercase tracking-[0.2em]"
                >
                    Your portfolio awaits.
                </motion.p>
            </div>
        </motion.div>
    );
}

// ─── Root orchestrator ─────────────────────────────────────────────────────────
export default function LoginPage() {
    const router = useRouter();
    const [phase, setPhase]                 = useState<Phase>("intro");
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

    // Auto-advance intro → select after 2.4 s
    useEffect(() => {
        if (phase !== "intro") return;
        const t = setTimeout(() => setPhase("select"), 2400);
        return () => clearTimeout(t);
    }, [phase]);

    const handleAgentSelect = (agent: Agent) => {
        setSelectedAgent(agent);
        setPhase("password");
    };

    const handleBack = () => {
        setSelectedAgent(null);
        setPhase("select");
    };

    const handleSuccess = () => {
        setPhase("welcome");
        // Start routing while the welcome overlay is visible — covers the nav blank
        setTimeout(() => {
            router.push("/");
            router.refresh();
        }, 1800);
    };

    return (
        <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4 overflow-hidden">

            {/* Ambient breathing glow — always present */}
            <div
                className="pointer-events-none fixed inset-0 animate-breathe"
                style={{
                    background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(212,175,55,0.14) 0%, transparent 70%)",
                }}
            />

            {/* Main stage */}
            <div className="relative z-10 w-full flex flex-col items-center">
                <AnimatePresence mode="wait">
                    {phase === "intro" && (
                        <IntroScreen key="intro" />
                    )}
                    {phase === "select" && (
                        <AgentSelector key="select" onSelect={handleAgentSelect} />
                    )}
                    {phase === "password" && selectedAgent && (
                        <PasswordForm
                            key="password"
                            agent={selectedAgent}
                            onBack={handleBack}
                            onSuccess={handleSuccess}
                        />
                    )}
                </AnimatePresence>
            </div>

            {/* Invite-only footer — visible after intro */}
            <AnimatePresence>
                {phase !== "intro" && phase !== "welcome" && (
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: 0.5 }}
                        className="fixed bottom-8 left-0 right-0 text-center text-[10px] font-mono text-[#2a2a2a] uppercase tracking-widest pointer-events-none"
                    >
                        Opulentus &bull; Invite Only
                    </motion.p>
                )}
            </AnimatePresence>

            {/* Act 3: Welcome overlay (fixed, above everything) */}
            <AnimatePresence>
                {phase === "welcome" && selectedAgent && (
                    <WelcomeScreen key="welcome" agent={selectedAgent} />
                )}
            </AnimatePresence>
        </div>
    );
}
