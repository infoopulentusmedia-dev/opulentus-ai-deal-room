"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const supabase = createSupabaseBrowserClient();
            const { error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) {
                setError(authError.message);
                setLoading(false);
                return;
            }

            router.push("/");
            router.refresh();
        } catch (err: any) {
            setError(err.message || "Something went wrong");
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-10">
                    <div className="w-16 h-16 rounded-2xl bg-[#D4AF37] flex items-center justify-center mx-auto mb-5">
                        <span className="text-[#0A0A0A] font-bold text-3xl font-display">O</span>
                    </div>
                    <h1 className="font-display text-3xl font-bold text-white tracking-tight">Opulentus</h1>
                    <p className="text-[#A3A3A3] text-sm mt-2">AI-Powered Real Estate Intelligence</p>
                </div>

                {/* Login Form */}
                <form onSubmit={handleLogin} className="bg-[#171717] border border-[#242424] rounded-2xl p-8">
                    <h2 className="font-display text-xl font-semibold text-white mb-6">Sign In</h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-[11px] font-mono text-[#7C7C7C] uppercase tracking-wider mb-2">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                required
                                className="w-full bg-[#0A0A0A] border border-[#333] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#D4AF37] transition-colors"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-mono text-[#7C7C7C] uppercase tracking-wider mb-2">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                required
                                className="w-full bg-[#0A0A0A] border border-[#333] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#D4AF37] transition-colors"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="mt-4 px-4 py-2.5 rounded-lg text-sm font-mono bg-red-500/10 border border-red-500/20 text-red-400">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !email || !password}
                        className="w-full mt-6 bg-[#D4AF37] hover:bg-[#E5C158] text-black font-bold text-sm py-3.5 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        ) : (
                            "Sign In"
                        )}
                    </button>
                </form>

                <p className="text-center text-[11px] font-mono text-[#555] mt-8 uppercase tracking-wider">
                    Opulentus &bull; Invite Only
                </p>
            </div>
        </div>
    );
}
