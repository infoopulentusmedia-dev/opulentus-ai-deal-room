"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { User } from "@supabase/supabase-js";

interface AgentProfile {
    id: string;
    display_name: string;
    company: string | null;
    phone: string | null;
    sender_email: string | null;
    recipient_email: string | null;
}

interface AuthContextType {
    user: User | null;
    agentProfile: AgentProfile | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    agentProfile: null,
    loading: true,
    signOut: async () => {},
});

export function useAuth() {
    return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const supabase = createSupabaseBrowserClient();

        // Get initial session
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user);
            if (user) fetchAgentProfile(user.id);
            else setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                const newUser = session?.user ?? null;
                setUser(newUser);
                if (newUser) {
                    fetchAgentProfile(newUser.id);
                } else {
                    setAgentProfile(null);
                    setLoading(false);
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    async function fetchAgentProfile(userId: string) {
        try {
            const supabase = createSupabaseBrowserClient();
            const { data, error } = await supabase
                .from("agents")
                .select("id, display_name, company, phone, sender_email, recipient_email")
                .eq("id", userId)
                .single();

            if (!error && data) {
                setAgentProfile(data);
            }
        } catch {
            // Agent profile may not exist yet — non-fatal
        } finally {
            setLoading(false);
        }
    }

    const signOut = async () => {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut();
        setUser(null);
        setAgentProfile(null);
        window.location.href = "/login";
    };

    return (
        <AuthContext.Provider value={{ user, agentProfile, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}
