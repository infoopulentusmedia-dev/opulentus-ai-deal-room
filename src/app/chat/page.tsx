"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { loadSessions, saveSession, createSession, getSessionById, ChatSession } from "@/lib/chatStore";
import { WATCHLIST_PROPERTIES } from "@/lib/mockData";
import MogulFactLoader from "@/components/MogulFactLoader";

const CLIENT_BUY_BOXES: Record<string, { name: string; prompt: string }> = {
    "ali-beydoun": { name: "Ali Beydoun", prompt: "Find strip centers or retail plazas in Wayne County between $1,000,000 and $5,000,000" },
    "collin-goslin": { name: "Collin Goslin", prompt: "Find strip centers or retail plazas in Wayne County or Oakland County between $1,000,000 and $4,000,000" },
    "fadi": { name: "Fadi", prompt: "Find warehouse or industrial properties in Wayne County between 40000 and 80000 square feet" },
    "abe-saad": { name: "Abe Saad", prompt: "Find mechanic shops, collision shops, or car dealerships anywhere in Michigan between $100,000 and $800,000" },
    "hussein-zeitoun": { name: "Hussein Zeitoun", prompt: "Find residential properties in zip code 48124 between $400,000 and $750,000" },
    "moe-sabbagh": { name: "Moe Sabbagh", prompt: "Find residential properties in zip codes 48124 and 48128 between $500,000 and $675,000" },
};

interface Message {
    role: "user" | "model";
    text: string;
    properties?: any[];
    headline?: string;
    suggestedQuestions?: string[];
}

function ChatContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState("Overview");
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [activeProperty, setActiveProperty] = useState<any>(null);
    const [selectedForComparison, setSelectedForComparison] = useState<any[]>([]);
    const [sessionId, setSessionId] = useState<string>("");
    const [sessionHeadline, setSessionHeadline] = useState("New Chat");
    const [tabData, setTabData] = useState<Record<string, any>>({});
    const [tabLoading, setTabLoading] = useState<string | null>(null);
    const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const hasInitialized = useRef(false);

    const tabs = ["Overview", "Underwrite", "Comps", "Opportunity", "Action"];

    const toggleCompare = (prop: any) => {
        setSelectedForComparison(prev =>
            prev.some(p => p.listingId === prop.listingId)
                ? prev.filter(p => p.listingId !== prop.listingId)
                : [...prev, prop]
        );
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const fetchTabData = async (tabName: string) => {
        if (!activeProperty || tabLoading) return;
        setTabLoading(tabName);

        const endpoints: Record<string, string> = {
            Underwrite: "/api/underwrite-scenario",
            Comps: "/api/comps-records-search",
            Opportunity: "/api/opportunity-lane",
            Action: "/api/negotiation-playbook",
            Zoning: "/api/zoning-intelligence",
            Demographics: "/api/demographic-rings",
            HBU: "/api/hbu-simulation",
        };

        const endpoint = endpoints[tabName];
        if (!endpoint) { setTabLoading(null); return; }

        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ property: activeProperty }),
            });
            const data = await res.json();
            setTabData(prev => ({ ...prev, [tabName]: data }));
        } catch (err) {
            console.error(`Failed to fetch ${tabName}:`, err);
        } finally {
            setTabLoading(null);
        }
    };

    useEffect(() => { scrollToBottom(); }, [messages]);

    // Persist session after every message change
    useEffect(() => {
        if (!sessionId || messages.length === 0) return;
        saveSession({
            id: sessionId,
            headline: sessionHeadline,
            messages,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            buyboxSlug: searchParams.get("buybox") || undefined,
        });
    }, [messages, sessionId, sessionHeadline, searchParams]);

    // Initialize from query params
    useEffect(() => {
        if (hasInitialized.current) return;
        hasInitialized.current = true;

        const existingSessionId = searchParams.get("session");
        const buyboxSlug = searchParams.get("buybox");
        const freeQuery = searchParams.get("q");
        const watchtowerId = searchParams.get("watchtowerId");
        const transfer = searchParams.get("transfer");

        if (existingSessionId) {
            const existing = getSessionById(existingSessionId);
            if (existing) {
                setSessionId(existing.id);
                setSessionHeadline(existing.headline);
                setMessages(existing.messages);
                return;
            }
        }

        // Handle Live Property Terminal deep link via sessionStorage transfer (100% reliable)
        if (transfer) {
            const rawProp = sessionStorage.getItem('deal_room_transfer');
            if (rawProp) {
                try {
                    const prop = JSON.parse(rawProp);
                    sessionStorage.removeItem('deal_room_transfer'); // Clean up after use

                    const label = prop.address && prop.address !== "Unknown Address"
                        ? `${prop.address}, ${prop.city || ""}`
                        : `${prop.sourceId} (${prop.platform})`;

                    const newSession = createSession(`Deal Analysis: ${label}`);
                    setSessionId(newSession.id);
                    setSessionHeadline(newSession.headline);

                    // Map the Apify property shape to the Deal Room's expected shape
                    const dealRoomProp = {
                        listingId: prop.sourceId,
                        mlsNumber: prop.sourceId,
                        address: prop.address || "Unknown",
                        city: prop.city || "",
                        state: prop.state || "MI",
                        zip: prop.zipCode || "",
                        listPrice: prop.price || 0,
                        pricing: { listPrice: prop.price || 0 },
                        propertyType: prop.propertyType || "Commercial",
                        squareFeet: prop.buildingSizeSqft || 0,
                        sqft: prop.buildingSizeSqft || 0,
                        dom: prop.daysOnPlatform || 0,
                        capRate: prop.capRate || null,
                        remarks: prop.description || "",
                        propertyUrl: prop.propertyUrl || "",
                        platform: prop.platform,
                        lotSizeAcres: prop.lotSizeAcres || null,
                        yearBuilt: prop.yearBuilt || null,
                        features: [],
                        dealScore: 0,
                    };

                    setActiveProperty(dealRoomProp);
                    setActiveTab("Overview");

                    // Greeting message
                    setMessages([{
                        role: "model",
                        text: `Loading analysis for **${label}**...`,
                        headline: "Property Loaded",
                        properties: [dealRoomProp],
                    }]);

                    // Build a rich analysis prompt with all available data
                    const priceStr = prop.price ? `$${prop.price.toLocaleString()}` : "Unpriced";
                    const sizeStr = prop.buildingSizeSqft ? `${prop.buildingSizeSqft.toLocaleString()} sqft` : "unknown size";
                    const capStr = prop.capRate ? `${prop.capRate}% cap rate` : "no cap rate listed";
                    const domStr = prop.daysOnPlatform ? `${prop.daysOnPlatform} days on market` : "unknown DOM";

                    const analysisPrompt = `Analyze this property in detail: ${prop.address || "Unknown Address"}, ${prop.city || ""} ${prop.state || "MI"} ${prop.zipCode || ""} — ${priceStr}, ${prop.propertyType || "Commercial"}, ${sizeStr}, ${capStr}, ${domStr}. Tell me everything: why it could be a good deal, what the risks are, what due diligence I should prioritize, and your overall recommendation.`;

                    setTimeout(() => sendMessage(analysisPrompt), 400);

                    // Auto-fetch Opulentus Advantage tabs
                    setTimeout(() => {
                        fetchTabData("Zoning");
                        fetchTabData("Demographics");
                        fetchTabData("HBU");
                    }, 600);

                    if (window.innerWidth < 1024) {
                        router.push('?deal=open', { scroll: false });
                    }
                } catch (err) {
                    console.error("[Chat] Failed to parse transferred property:", err);
                }
            }
            return;
        }

        // Handle Watchtower context load
        if (watchtowerId) {
            const property = WATCHLIST_PROPERTIES.find(p => p.ListingId === watchtowerId);
            if (property) {
                const newSession = createSession(`Watchtower: ${property.UnparsedAddress}`);
                setSessionId(newSession.id);
                setSessionHeadline(newSession.headline);

                // Set the active property to trigger the Deal Room to open
                setActiveProperty(property);
                setActiveTab("Overview");

                // Send the contextual AI greeting
                setMessages([{
                    role: "model",
                    text: `Welcome back. I have loaded ${property.UnparsedAddress} from your Watchtower into the Deal Room. How can we optimize this asset today?`,
                    headline: "Watchtower Context Loaded",
                    properties: [property] // Ensure it's in the history for followup context
                }]);

                // Auto-fetch the Opulentus Advantage data
                setTimeout(() => {
                    fetchTabData("Zoning");
                    fetchTabData("Demographics");
                    fetchTabData("HBU");
                }, 500);

                if (window.innerWidth < 1024) {
                    router.push('?deal=open', { scroll: false });
                }
                return;
            }
        }

        // Create a new generic session if not from Watchtower
        const newSession = createSession(
            buyboxSlug ? `Buy Box: ${CLIENT_BUY_BOXES[buyboxSlug]?.name || buyboxSlug}` : freeQuery ? freeQuery.slice(0, 40) : "New Chat",
            buyboxSlug || undefined
        );
        setSessionId(newSession.id);
        setSessionHeadline(newSession.headline);

        // Welcome message
        setMessages([{
            role: "model",
            text: "I'm the Opulentus agent. How can I help you find deals today?",
            headline: "Agent Ready",
        }]);

        // Auto-fire if we have a buy box or query
        if (buyboxSlug && CLIENT_BUY_BOXES[buyboxSlug]) {
            setTimeout(() => sendMessage(CLIENT_BUY_BOXES[buyboxSlug].prompt), 300);
        } else if (freeQuery) {
            setTimeout(() => sendMessage(freeQuery), 300);
        } else {
            // Fetch starter questions from the API for fresh chats
            fetch("/api/suggested-questions")
                .then(res => res.json())
                .then(data => {
                    if (data.suggestedQuestions) setSuggestedQuestions(data.suggestedQuestions);
                })
                .catch(() => {
                    setSuggestedQuestions([
                        "Show me the best deals today",
                        "What's new in Michigan real estate?",
                        "Find me commercial properties"
                    ]);
                });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /** Collect all visible property addresses from the message history */
    const getVisibleAddresses = (msgs: Message[]): string[] => {
        const addrs: string[] = [];
        for (const m of msgs) {
            if (m.properties && m.properties.length > 0) {
                for (const p of m.properties) {
                    if (p.address) addrs.push(p.address);
                }
            }
        }
        return [...new Set(addrs)];
    };

    const sendMessage = async (query: string) => {
        const currentMessages = [...messages, { role: "user" as const, text: query }];
        setMessages(currentMessages);
        setIsLoading(true);

        try {
            const res = await fetch("/api/assistant-command", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: query,
                    history: currentMessages,
                    activeProperty: activeProperty || null,
                    visibleProperties: getVisibleAddresses(currentMessages),
                    investmentIntent: "investor"
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to fetch");

            const intent = data.intent || "general";
            const headline = data.headline || "Opulentus";
            const properties = data.data?.properties || [];
            const hasProperties = properties.length > 0;

            // Update session headline only on new search results
            if ((intent === "search" || intent === "property_lookup") && hasProperties) {
                setSessionHeadline(headline);
            }

            // Build the agent message — text fallback is intent-aware
            const newMsg: Message = {
                role: "model",
                headline,
                text: data.text || (hasProperties ? "Here's what I found." : ""),
                properties: hasProperties ? properties : [],
                suggestedQuestions: data.suggestedQuestions || [],
            };

            // Update suggested questions state
            if (data.suggestedQuestions && data.suggestedQuestions.length > 0) {
                setSuggestedQuestions(data.suggestedQuestions);
            }

            setMessages(prev => [...prev, newMsg]);

            // Only open Deal Room for search / property_lookup intents that returned results
            if (hasProperties && (intent === "search" || intent === "property_lookup")) {
                const property = properties[0];
                setActiveProperty(property);
                setActiveTab("Overview");
                setTabData({});

                // Auto-fetch the Opulentus Advantage data in the background
                setTimeout(() => {
                    fetchIntelligenceData("Zoning", property);
                    fetchIntelligenceData("Demographics", property);
                    fetchIntelligenceData("HBU", property);
                }, 500);

                if (window.innerWidth < 1024) {
                    router.push('?deal=open', { scroll: false });
                }
            }
            // For "general" and "followup" — do NOT touch activeProperty or Deal Room
        } catch (error: any) {
            setMessages(prev => [...prev, {
                role: "model",
                text: `System Error: ${error.message}`,
                headline: "Error"
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchIntelligenceData = async (type: string, property: any) => {
        const endpoints: Record<string, string> = {
            Zoning: "/api/zoning-intelligence",
            Demographics: "/api/demographic-rings",
            HBU: "/api/hbu-simulation",
        };
        try {
            const res = await fetch(endpoints[type], {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ property }),
            });
            const data = await res.json();
            setTabData(prev => ({ ...prev, [type]: data }));
        } catch (err) {
            console.error(`Failed to fetch ${type}:`, err);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;
        const userMsg = input;
        setInput("");
        await sendMessage(userMsg);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") handleSend();
    };

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-background">
            {/* Header */}
            <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-[#0A0A0A] shrink-0">
                <div className="flex items-center gap-4">
                    <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <div className="w-7 h-7 rounded bg-[#171717] border border-border flex items-center justify-center">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FAFAFA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></svg>
                        </div>
                        <span className="font-display font-medium text-lg text-[#FAFAFA]">Opulentus</span>
                    </Link>
                    <span className="text-[11px] font-mono text-[#A3A3A3] bg-[#171717] border border-border px-2 py-0.5 rounded uppercase">{sessionHeadline}</span>
                </div>
                <div className="flex items-center gap-3">
                    <Link href="/" className="text-[11px] font-mono text-[#A3A3A3] hover:text-[#FAFAFA] uppercase tracking-wider transition-colors">
                        ← Dashboard
                    </Link>
                </div>
            </header>

            {/* Main Layout */}
            <main className="flex-1 flex overflow-hidden">
                {/* Left pane: Chat */}
                <section className={`${activeProperty ? 'w-[55%]' : 'w-full'} flex flex-col border-r border-border bg-background relative transition-all duration-300`}>
                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-6 pb-32 flex flex-col gap-6 hide-scrollbar relative">
                        <AnimatePresence>
                            {messages.map((msg, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4, ease: "easeOut", delay: idx * 0.05 }}
                                    className={`${msg.role === 'user' ? 'self-end max-w-[75%]' : 'self-start max-w-[90%]'} flex flex-col gap-2`}
                                >
                                    {msg.role === 'user' ? (
                                        <div className="bg-[#171717] border border-[#242424] text-[#FAFAFA] py-3 px-5 rounded-xl">
                                            <p className="font-display text-[15px] font-medium tracking-wide">{msg.text}</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="w-5 h-5 rounded bg-[#171717] border border-[#242424] flex items-center justify-center">
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#D4AF37]"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></svg>
                                                </div>
                                                <span className="font-mono font-medium text-[10px] text-[#A3A3A3] uppercase tracking-wider">Agent</span>
                                            </div>

                                            <div className="p-4 text-[15px] leading-relaxed">
                                                {msg.headline && <h4 className="font-display font-semibold text-lg mb-3 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary" />{msg.headline}</h4>}
                                                <p className="mb-4 text-foreground/80">{msg.text}</p>

                                                {msg.properties && msg.properties.length > 0 && (
                                                    <div className="flex flex-col gap-3">
                                                        {msg.properties.map((prop, pIdx) => (
                                                            <div key={pIdx} className="flex flex-col border border-border rounded-xl p-4 bg-[#171717] hover:border-[#404040] transition-colors">
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <div>
                                                                        <h4
                                                                            className="font-medium text-[15px] hover:text-foreground cursor-pointer transition-colors text-[#FAFAFA]"
                                                                            onClick={() => { setActiveProperty(prop); setActiveTab("Overview"); }}
                                                                        >
                                                                            {prop.address || "Unknown Address"}
                                                                        </h4>
                                                                        <p className="text-[11px] font-mono text-[#A3A3A3] mt-0.5">{prop.city}, MI {prop.zip} • MLS #{prop.mlsNumber}</p>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <div className="font-mono font-medium text-[15px] text-[#FAFAFA]">${(prop.listPrice || 0).toLocaleString()}</div>
                                                                        {prop.dealScore != null && (
                                                                            <div className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase inline-block mt-1 ${prop.dealScore >= 70 ? 'text-[#0A0A0A] bg-[#D4AF37]' : 'text-[#7C7C7C] bg-[#242424] border border-border'}`}>
                                                                                {prop.dealScore} Score
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="flex gap-4 text-[11px] font-mono mt-2 py-2 border-y border-border/50 text-[#A3A3A3] uppercase tracking-wider">
                                                                    <div><span className="text-[#FAFAFA]">TYPE:</span> {prop.propertyType}</div>
                                                                    <div><span className="text-[#FAFAFA]">BEDS:</span> {prop.bedrooms || '-'}</div>
                                                                    <div><span className="text-[#FAFAFA]">BATHS:</span> {prop.bathrooms || '-'}</div>
                                                                    <div><span className="text-[#FAFAFA]">DOM:</span> {prop.dom ?? '-'}</div>
                                                                </div>

                                                                {prop.dealReasons && prop.dealReasons.length > 0 && (
                                                                    <div className="text-[11px] font-mono text-[#D4AF37] bg-[#D4AF37]/5 p-2 rounded mt-3 border border-[#D4AF37]/20 uppercase tracking-wide">
                                                                        <strong className="text-[#FAFAFA]">SIGNALS:</strong> {prop.dealReasons.join(" • ")}
                                                                    </div>
                                                                )}

                                                                <div className="flex flex-wrap gap-2 mt-3 pt-3">
                                                                    <button
                                                                        onClick={() => { setActiveProperty(prop); setActiveTab("Overview"); }}
                                                                        className="text-[11px] font-mono uppercase tracking-wider font-medium px-3 py-1.5 rounded bg-[#242424] text-[#FAFAFA] hover:bg-[#333333] border border-border transition-colors"
                                                                    >
                                                                        Open Deal Room
                                                                    </button>
                                                                    <button
                                                                        onClick={() => toggleCompare(prop)}
                                                                        className={`text-[11px] font-mono uppercase tracking-wider font-medium px-3 py-1.5 rounded border transition-colors ${selectedForComparison.some(p => p.listingId === prop.listingId)
                                                                            ? "bg-[#D4AF37]/20 border-[#D4AF37]/50 text-[#D4AF37]"
                                                                            : "bg-[#171717] border-border hover:border-[#404040] text-[#FAFAFA]"
                                                                            }`}
                                                                    >
                                                                        {selectedForComparison.some(p => p.listingId === prop.listingId) ? "Selected" : "Compare"}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {/* Welcome Bento Grid — visible only on empty chat */}
                        {messages.length <= 1 && !isLoading && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.5, delay: 0.2 }}
                                className="grid grid-cols-3 gap-3 mt-4 mb-8 max-w-3xl mx-auto"
                            >
                                {[
                                    { icon: "⚡", title: "Instant Deal Scoring", desc: "Every listing scored by 12 investment signals in real-time", prompt: "Show me the highest-scored deals today" },
                                    { icon: "🔍", title: "Search Michigan Listings", desc: "LoopNet + Crexi — every commercial property in one place", prompt: "Find me commercial properties in Detroit" },
                                    { icon: "🏢", title: "Deep Property Analysis", desc: "AI-powered zoning, demographics & highest-best-use reports", prompt: "What should I know before buying commercial in Michigan?" },
                                    { icon: "📊", title: "Compare Deals Side-by-Side", desc: "Stack properties head-to-head on price, cap rate & upside", prompt: "How do I compare multiple properties effectively?" },
                                    { icon: "🎯", title: "Risk & Opportunity Intel", desc: "Know the red flags and hidden advantages before you offer", prompt: "What are the biggest risks in Michigan commercial real estate?" },
                                    { icon: "💰", title: "Market Pulse", desc: "Live snapshot of today's Michigan market — prices, trends, hot zones", prompt: "What's the Michigan commercial market looking like today?" },
                                ].map((card, i) => (
                                    <motion.button
                                        key={card.title}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.3 + i * 0.08, duration: 0.4, ease: "easeOut" }}
                                        onClick={() => {
                                            setSuggestedQuestions([]);
                                            sendMessage(card.prompt);
                                        }}
                                        className="group text-left p-5 border border-white bg-[#0A0A0A] hover:bg-[#141414] transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                                    >
                                        <div className="text-2xl mb-3">{card.icon}</div>
                                        <h4 className="font-display font-semibold text-[14px] text-white mb-1.5 tracking-wide">{card.title}</h4>
                                        <p className="text-[12px] font-mono text-[#A3A3A3] group-hover:text-white leading-relaxed transition-colors">{card.desc}</p>
                                    </motion.button>
                                ))}
                            </motion.div>
                        )}
                        {isLoading && (
                            <div className="my-4">
                                <MogulFactLoader message="Querying Multi-Data Node..." />
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Floating Compare Action Popup */}
                    <AnimatePresence>
                        {selectedForComparison.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                                className="absolute bottom-28 left-1/2 -translate-x-1/2 max-w-md w-full bg-[#171717] rounded-xl px-5 py-3 flex items-center justify-between z-20 border border-border"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="flex h-6 w-6 rounded bg-[#242424] border border-border text-[#FAFAFA] items-center justify-center text-[11px] font-mono font-medium">{selectedForComparison.length}</span>
                                    <span className="text-[11px] font-mono tracking-widest uppercase text-[#FAFAFA]">Deals selected</span>
                                </div>
                                <div className="flex gap-3 items-center">
                                    <button onClick={() => setSelectedForComparison([])} className="text-[11px] font-mono text-[#A3A3A3] hover:text-[#FAFAFA] uppercase tracking-wider transition-colors">Clear</button>
                                    <button
                                        onClick={() => { setActiveProperty(null); setActiveTab("Compare"); }}
                                        className="text-[11px] font-mono uppercase bg-[#FAFAFA] text-[#0A0A0A] font-bold px-4 py-2 rounded transition-colors hover:bg-white"
                                    >
                                        Compare
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Floating Chat Command Bar */}
                    <div className="absolute bottom-6 left-0 right-0 px-6 z-10 flex flex-col items-center pointer-events-none gap-3">
                        {/* Suggested Question Pills */}
                        {suggestedQuestions.length > 0 && !isLoading && (
                            <div className="max-w-4xl w-full flex flex-wrap gap-2 justify-center pointer-events-auto">
                                {suggestedQuestions.map((q, i) => (
                                    <motion.button
                                        key={`${q}-${i}`}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.1, duration: 0.3 }}
                                        onClick={() => {
                                            setSuggestedQuestions([]);
                                            sendMessage(q);
                                        }}
                                        className="text-[12px] font-mono px-4 py-2 rounded-full bg-[#171717] border border-[#333] text-[#A3A3A3] hover:text-[#FAFAFA] hover:border-[#D4AF37]/50 hover:bg-[#1A1A1A] transition-all duration-200 hover:shadow-[0_0_12px_rgba(212,175,55,0.1)] active:scale-95"
                                    >
                                        {q}
                                    </motion.button>
                                ))}
                            </div>
                        )}

                        <div className={`relative max-w-4xl w-full flex items-center rounded-xl border transition-colors pointer-events-auto p-1.5 bg-[#0A0A0A] ${isLoading ? 'border-[#404040]' : 'border-border focus-within:border-[#404040]'}`}>
                            {isLoading && (
                                <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-[#404040] to-transparent animate-[shimmer_2s_infinite]" />
                            )}
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={isLoading}
                                placeholder="Ask a follow-up, refine filters, or request a report..."
                                className="flex-1 bg-transparent px-5 py-3.5 outline-none text-[15px] font-display font-medium text-[#FAFAFA] placeholder:text-[#7C7C7C]"
                            />
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || isLoading}
                                className="w-10 h-10 flex items-center justify-center bg-[#242424] border border-border text-[#FAFAFA] rounded hover:bg-[#333333] disabled:opacity-30 transition-colors shrink-0 ml-2"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                            </button>
                        </div>
                    </div>
                </section>

                {/* Right pane: Deal Room or Compare */}
                {(activeProperty || activeTab === "Compare") ? (
                    <section className={`${activeProperty || activeTab === "Compare" ? 'w-[45%] max-w-[600px] min-w-[380px]' : 'hidden'} bg-card flex flex-col border-l border-border shrink-0`}>
                        {activeProperty ? (
                            <>
                                {/* Context Header */}
                                <div className="p-5 border-b border-border bg-surface relative">
                                    <button
                                        onClick={() => setActiveProperty(null)}
                                        className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground hover:bg-border/30 rounded-full transition-colors"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                    </button>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-[10px] font-mono bg-primary text-primary-foreground px-1.5 py-0.5 rounded uppercase">Active Deal</span>
                                        <span className="text-xs text-muted-foreground font-mono">MLS #{activeProperty.mlsNumber}</span>
                                    </div>
                                    <h2 className="font-display font-bold text-xl text-foreground pr-8">{activeProperty.address}</h2>
                                    <p className="text-sm text-muted-foreground mt-1">{activeProperty.city}, MI {activeProperty.zip}</p>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Compare Header */}
                                <div className="p-5 border-b border-border bg-[#0A0A0A] relative flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                            <h2 className="font-display font-medium text-[15px] text-[#FAFAFA]">Deal Comparison</h2>
                                        </div>
                                        <p className="text-[11px] font-mono text-[#7C7C7C] uppercase tracking-wider">{selectedForComparison.length} properties selected</p>
                                    </div>
                                    <button
                                        onClick={() => setActiveTab("Overview")}
                                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-border/30 rounded-full transition-colors"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                    </button>
                                </div>
                            </>
                        )}

                        {activeProperty && (
                            <>
                                {/* Tabs */}
                                <div className="flex overflow-x-auto hide-scrollbar border-b border-border px-2 bg-card">
                                    {tabs.map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(tab)}
                                            className={`px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === tab
                                                ? "border-primary text-primary"
                                                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                                                }`}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                </div>

                                {/* Tab Content */}
                                <div className="flex-1 overflow-y-auto p-6 bg-card">
                                    {activeTab === "Overview" && (
                                        <div className="flex flex-col gap-6">
                                            {/* Hero Metrics */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-5 rounded-xl bg-[#0A0A0A] border border-border flex flex-col justify-center">
                                                    <div className="text-[10px] text-[#A3A3A3] font-mono uppercase tracking-widest mb-2 flex items-center gap-2">
                                                        List Price
                                                    </div>
                                                    <div className="text-2xl font-mono font-medium text-[#FAFAFA]">${(activeProperty.listPrice || 0).toLocaleString()}</div>
                                                    {activeProperty.squareFeet && (
                                                        <div className="text-[11px] font-mono text-[#7C7C7C] mt-2 flex items-center gap-1.5">
                                                            <span className="text-[#A3A3A3]">~</span>${Math.round(activeProperty.listPrice / activeProperty.squareFeet)} <span className="uppercase tracking-wider text-[#A3A3A3]">/ sqft</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className={`p-5 rounded-xl border relative overflow-hidden flex items-center gap-4 ${activeProperty.dealScore >= 70 ? 'bg-[#D4AF37]/5 border-[#D4AF37]/30' : 'bg-[#0A0A0A] border-border'}`}>
                                                    {/* SVG Progress Ring */}
                                                    <div className="relative w-14 h-14 shrink-0">
                                                        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                                                            <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-border" />
                                                            <motion.circle
                                                                cx="50" cy="50" r="42"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                strokeWidth="8"
                                                                strokeLinecap="square"
                                                                className={activeProperty.dealScore >= 70 ? 'text-[#D4AF37]' : 'text-[#A3A3A3]'}
                                                                strokeDasharray="264"
                                                                initial={{ strokeDashoffset: 264 }}
                                                                animate={{ strokeDashoffset: 264 - (264 * (activeProperty.dealScore || 50)) / 100 }}
                                                                transition={{ duration: 1.5, ease: "easeOut" }}
                                                            />
                                                        </svg>
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <span className={`text-[15px] font-mono font-medium ${activeProperty.dealScore >= 70 ? 'text-[#FAFAFA]' : 'text-[#A3A3A3]'}`}>
                                                                {activeProperty.dealScore || 50}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col">
                                                        <div className="text-[10px] text-[#A3A3A3] font-mono uppercase tracking-widest mb-1">
                                                            Opulentus Score
                                                        </div>
                                                        <div className="text-[13px] font-medium text-[#FAFAFA]">
                                                            {activeProperty.dealScore >= 70 ? 'Strong Candidate' : 'Fair Fit'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Signals */}
                                            {activeProperty.dealReasons && activeProperty.dealReasons.length > 0 && (
                                                <div>
                                                    <h3 className="text-sm font-bold mb-3 text-foreground flex items-center gap-2">
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
                                                        Acquisition Strengths
                                                    </h3>
                                                    <ul className="space-y-1.5">
                                                        {activeProperty.dealReasons.map((reason: string, i: number) => (
                                                            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                                                                <span className="w-1 h-1 rounded-full bg-primary mt-2 shrink-0"></span>
                                                                {reason}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {/* Property Facts */}
                                            <div>
                                                <h3 className="text-sm font-bold mb-3 border-b border-border pb-2 text-foreground">Property Facts</h3>
                                                <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                                                    <div><span className="text-muted-foreground block mb-0.5 text-xs">Property Type</span> <span className="font-medium text-foreground">{activeProperty.propertyType}</span></div>
                                                    <div><span className="text-muted-foreground block mb-0.5 text-xs">Year Built</span> <span className="font-medium text-foreground">{activeProperty.yearBuilt || '-'}</span></div>
                                                    <div><span className="text-muted-foreground block mb-0.5 text-xs">SqFt</span> <span className="font-medium text-foreground">{activeProperty.squareFeet ? activeProperty.squareFeet.toLocaleString() : '-'}</span></div>
                                                    <div><span className="text-muted-foreground block mb-0.5 text-xs">Beds / Baths</span> <span className="font-medium text-foreground">{activeProperty.bedrooms || '-'} / {activeProperty.bathrooms || '-'}</span></div>
                                                    <div><span className="text-muted-foreground block mb-0.5 text-xs">Status</span> <span className="font-medium text-foreground inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>{activeProperty.status || 'Active'}</span></div>
                                                    <div><span className="text-muted-foreground block mb-0.5 text-xs">Days on Market</span> <span className="font-medium text-primary">{activeProperty.dom ?? '-'}</span></div>
                                                </div>
                                            </div>

                                            {/* THE OPULENTUS ADVANTAGE - COMMERCIAL INTELLIGENCE */}
                                            <div className="mt-2 pt-6 border-t border-border">
                                                <div className="flex items-center gap-2 mb-6">
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#D4AF37]"><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                                                    <h3 className="font-display font-medium text-[15px] text-[#FAFAFA] tracking-wide uppercase">The Opulentus Advantage</h3>
                                                </div>

                                                <div className="flex flex-col gap-4">

                                                    {/* Zoning Intelligence */}
                                                    {tabData.Zoning ? (
                                                        <div className="bg-[#171717] border border-border p-5 rounded-xl relative overflow-hidden transition-colors hover:border-[#404040]">
                                                            <div className="absolute top-0 right-0 p-3 opacity-10">
                                                                <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-[#FAFAFA]"><path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /><path d="M9 9v.01" /><path d="M9 13v.01" /><path d="M9 17v.01" /></svg>
                                                            </div>
                                                            <div className="text-[10px] font-mono font-medium text-[#A3A3A3] tracking-widest uppercase mb-1 flex items-center gap-2">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" /> Zoning & Density Intel
                                                            </div>
                                                            <div className="flex items-end gap-3 mb-3 relative z-10">
                                                                <div className="text-[15px] font-medium text-[#FAFAFA]">{tabData.Zoning.projectedZoning || "Mixed-Use"}</div>
                                                                <div className="text-xs text-muted-foreground pb-1 block">Zoning Potential</div>
                                                            </div>
                                                            <div className="flex items-center gap-2 mb-3">
                                                                {tabData.Zoning.undercapitalizedDensityScore > 70 ? (
                                                                    <span className="px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase rounded bg-green-500/20 text-green-400 border border-green-500/30">High Density Gap</span>
                                                                ) : (
                                                                    <span className="px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase rounded bg-surface text-muted-foreground border border-border">Optimized</span>
                                                                )}
                                                                <span className="text-xs font-mono text-muted-foreground">FAR: {tabData.Zoning.currentFar || "1.0"} → {tabData.Zoning.maxFar || "3.0"}</span>
                                                            </div>
                                                            <p className="text-sm leading-relaxed text-foreground/80 relative z-10 italic border-l-2 border-primary/50 pl-3">
                                                                "{tabData.Zoning.roiTranslation || "Data currently unavailable for this municipality."}"
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <MogulFactLoader message="Analyzing Zoning Potential..." />
                                                    )}

                                                    {/* Demographics & Traffic */}
                                                    {tabData.Demographics ? (
                                                        <div className="bg-[#171717] border border-border p-5 rounded-xl relative overflow-hidden transition-colors hover:border-[#404040]">
                                                            <div className="absolute top-0 right-0 p-3 opacity-10">
                                                                <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-[#FAFAFA]"><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></svg>
                                                            </div>
                                                            <div className="text-[10px] font-mono font-medium text-[#A3A3A3] tracking-widest uppercase mb-1 flex items-center gap-2">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" /> Location Retail Viability
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-4 mt-4 relative z-10">
                                                                <div>
                                                                    <div className="text-[10px] font-mono tracking-widest uppercase text-[#7C7C7C] mb-1">AADT (Traffic)</div>
                                                                    <div className="text-xl font-mono font-medium text-[#FAFAFA]">{(tabData.Demographics.aadt || 0).toLocaleString()} <span className="text-[11px] font-sans text-[#A3A3A3] font-normal uppercase tracking-wider">VPD</span></div>
                                                                </div>
                                                                <div>
                                                                    <div className="text-[10px] font-mono tracking-widest uppercase text-[#7C7C7C] mb-1">1-Mi Median Inc.</div>
                                                                    <div className="text-xl font-mono font-medium text-[#FAFAFA]">${(tabData.Demographics.oneMileIncome || 0).toLocaleString()}</div>
                                                                </div>
                                                            </div>
                                                            <p className="text-[13px] leading-relaxed text-[#A3A3A3] relative z-10 mt-5 italic border-l-2 border-[#D4AF37]/50 pl-3">
                                                                "{tabData.Demographics.roiTranslation || "Traffic data currently unavailable."}"
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <MogulFactLoader message="Extracting Demographics..." />
                                                    )}

                                                    {/* HBU Multi-Scenario Simulation */}
                                                    {tabData.HBU ? (
                                                        <div className="bg-[#171717] border border-border p-5 rounded-xl relative overflow-hidden">
                                                            <div className="text-[10px] font-mono font-medium text-[#A3A3A3] tracking-widest uppercase mb-4 flex items-center gap-2">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" /> Highest & Best Use Simulation
                                                            </div>

                                                            <div className="space-y-3">
                                                                {tabData.HBU.scenarios && tabData.HBU.scenarios.map((scenario: any, i: number) => {
                                                                    const isWinner = scenario.id === tabData.HBU.winningScenarioId;
                                                                    return (
                                                                        <div key={i} className={`p-4 rounded border transition-colors ${isWinner ? 'bg-[#D4AF37]/10 border-[#D4AF37]/50 relative' : 'bg-[#0A0A0A] border-[#242424] hover:border-[#404040]'}`}>
                                                                            {isWinner && (
                                                                                <div className="absolute -top-2 -right-2 bg-[#D4AF37] text-[#0A0A0A] text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded">
                                                                                    Optimal ROI
                                                                                </div>
                                                                            )}
                                                                            <div className="flex justify-between items-start mb-2">
                                                                                <div className="font-display font-medium text-[14px] text-[#FAFAFA]">
                                                                                    {scenario.name}
                                                                                </div>
                                                                                <div className={`font-mono font-medium ${isWinner ? 'text-[#D4AF37]' : 'text-[#FAFAFA]'}`}>
                                                                                    {scenario.projectedIRR}% IRR
                                                                                </div>
                                                                            </div>
                                                                            <p className="text-[13px] text-[#A3A3A3] mb-4 leading-relaxed">
                                                                                {scenario.description}
                                                                            </p>
                                                                            <div className="flex gap-4 text-[10px] font-mono tracking-widest uppercase text-[#7C7C7C] border-t border-[#242424] pt-3">
                                                                                <span>Capex: <strong className="text-[#FAFAFA]">${(scenario.estimatedCapex || 0).toLocaleString()}</strong></span>
                                                                                <span>Exit: <strong className="text-[#FAFAFA]">${(scenario.projectedExitValue || 0).toLocaleString()}</strong></span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <MogulFactLoader message="Simulating HBU multi-scenarios..." />
                                                    )}
                                                </div>
                                            </div>

                                        </div>
                                    )}

                                    {activeTab !== "Overview" && (
                                        <div className="flex flex-col gap-6">
                                            {/* Loading state */}
                                            {tabLoading === activeTab && (
                                                <div className="py-8">
                                                    <MogulFactLoader message={`Generating ${activeTab} analysis...`} />
                                                </div>
                                            )}

                                            {/* If no data yet and not loading, show generate button */}
                                            {!tabData[activeTab] && tabLoading !== activeTab && (
                                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></svg>
                                                    </div>
                                                    <h3 className="font-display font-medium text-foreground mb-1">{activeTab}</h3>
                                                    <p className="text-sm text-muted-foreground max-w-[220px] mb-5">Generate AI-powered {activeTab.toLowerCase()} analysis for this property.</p>
                                                    <button
                                                        onClick={() => fetchTabData(activeTab)}
                                                        className="px-5 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
                                                    >
                                                        Generate {activeTab}
                                                    </button>
                                                </div>
                                            )}

                                            {/* UNDERWRITE TAB */}
                                            {activeTab === "Underwrite" && tabData.Underwrite && (
                                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6 pt-4">
                                                    {tabData.Underwrite.narrative && (
                                                        <div className="bg-[#171717] border border-border rounded-xl p-5 border-l-4 border-l-[#D4AF37]">
                                                            <p className="text-[15px] leading-relaxed text-[#FAFAFA]">{tabData.Underwrite.narrative}</p>
                                                        </div>
                                                    )}

                                                    <div>
                                                        <h4 className="text-[11px] font-mono font-medium text-[#A3A3A3] uppercase tracking-widest mb-4 flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" /> Key Financials
                                                        </h4>
                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                            {[
                                                                { label: "NOI", value: `$${(tabData.Underwrite.metrics?.NOI || 0).toLocaleString()}` },
                                                                { label: "Cap Rate", value: `${tabData.Underwrite.metrics?.capRate || 0}%`, highlight: (tabData.Underwrite.metrics?.capRate || 0) >= 8 },
                                                                { label: "Cash-on-Cash", value: `${tabData.Underwrite.metrics?.cashOnCash || 0}%`, highlight: (tabData.Underwrite.metrics?.cashOnCash || 0) >= 12 },
                                                                { label: "DSCR", value: `${tabData.Underwrite.metrics?.DSCR || 0}x` },
                                                                { label: "Monthly Mrtg", value: `$${(tabData.Underwrite.metrics?.monthlyMortgage || 0).toLocaleString()}` },
                                                                { label: "Annual Cash", value: `$${(tabData.Underwrite.metrics?.annualCashFlow || 0).toLocaleString()}` },
                                                            ].map((m, i) => (
                                                                <div key={i} className={`p-4 rounded-xl border transition-colors ${m.highlight ? 'bg-[#D4AF37]/10 border-[#D4AF37]/30' : 'bg-[#0A0A0A] border-[#242424] hover:border-[#404040]'}`}>
                                                                    <div className={`text-[10px] font-mono uppercase tracking-widest mb-1.5 ${m.highlight ? 'text-[#D4AF37]' : 'text-[#7C7C7C]'}`}>{m.label}</div>
                                                                    <div className={`text-[15px] font-mono font-medium ${m.highlight ? 'text-[#D4AF37]' : 'text-[#FAFAFA]'}`}>{m.value}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {tabData.Underwrite.sensitivityGrid && (
                                                        <div className="mt-4">
                                                            <h4 className="text-xs font-display font-medium text-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-primary" /> Sensitivity Analysis
                                                            </h4>
                                                            <div className="bg-surface border border-border rounded-xl overflow-hidden divide-y divide-border/50">
                                                                {tabData.Underwrite.sensitivityGrid.map((s: any, i: number) => (
                                                                    <div key={i} className="flex items-center justify-between p-4 hover:bg-card/50 transition-colors">
                                                                        <span className="text-sm font-medium text-foreground">{s.scenario}</span>
                                                                        <div className="flex gap-4 items-center">
                                                                            <span className="text-xs text-muted-foreground"><strong className="text-foreground font-mono">{s.capRate}%</strong> Cap</span>
                                                                            <div className="w-px h-3 bg-border" />
                                                                            <span className="text-xs text-muted-foreground"><strong className="text-foreground font-mono">{s.cashOnCash}%</strong> CoC</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {tabData.Underwrite.risks && (
                                                        <div className="mt-4">
                                                            <h4 className="text-xs font-display font-medium text-red-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-red-400" /> Risk Factors
                                                            </h4>
                                                            <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-5">
                                                                <ul className="space-y-3">
                                                                    {tabData.Underwrite.risks.map((r: string, i: number) => (
                                                                        <li key={i} className="flex items-start gap-3 text-sm text-foreground/80 leading-relaxed">
                                                                            <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                                            {r}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        </div>
                                                    )}
                                                </motion.div>
                                            )}

                                            {/* COMPS TAB */}
                                            {activeTab === "Comps" && tabData.Comps && (
                                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6 pt-4">
                                                    {tabData.Comps.estimatedValue && (
                                                        <div className="bg-[#171717] p-6 rounded-xl border border-border relative overflow-hidden transition-colors hover:border-[#404040]">
                                                            <div className="text-[11px] font-mono font-medium text-[#D4AF37] uppercase tracking-widest mb-2 flex items-center gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" /> AI Estimated Value
                                                            </div>
                                                            <div className="text-4xl font-mono font-bold text-[#FAFAFA]">${tabData.Comps.estimatedValue.toLocaleString()}</div>
                                                            {tabData.Comps.valueRange && (
                                                                <div className="text-[13px] text-[#A3A3A3] mt-2 font-mono">
                                                                    Range: <span className="text-[#FAFAFA]">${tabData.Comps.valueRange.low?.toLocaleString()}</span> – <span className="text-[#FAFAFA]">${tabData.Comps.valueRange.high?.toLocaleString()}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    {tabData.Comps.narrative && (
                                                        <p className="text-[15px] leading-relaxed text-[#FAFAFA]">{tabData.Comps.narrative}</p>
                                                    )}

                                                    <div className="mt-2">
                                                        <h4 className="text-[11px] font-mono font-medium text-[#A3A3A3] uppercase tracking-widest mb-4 flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" /> Supported Comparables
                                                        </h4>
                                                        <div className="grid gap-4">
                                                            {tabData.Comps.comps && tabData.Comps.comps.map((comp: any, i: number) => (
                                                                <div key={i} className="p-5 rounded-xl border border-[#242424] bg-[#0A0A0A] hover:border-[#404040] transition-colors">
                                                                    <div className="flex justify-between items-start mb-3">
                                                                        <div>
                                                                            <h4 className="font-display font-medium text-[15px] text-[#FAFAFA] mb-1">{comp.address}</h4>
                                                                            <span className="text-[10px] font-mono font-medium tracking-widest text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/30 px-2 py-1 rounded uppercase">{comp.type}</span>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <div className="font-mono font-medium text-[15px] text-[#FAFAFA]">${(comp.price || comp.adjustedValue || 0).toLocaleString()}</div>
                                                                            <div className="text-[11px] font-mono font-medium text-[#A3A3A3] mt-0.5">{comp.similarityScore}% match</div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex gap-4 text-[11px] font-mono text-[#A3A3A3] mb-3 pt-3 border-t border-[#242424]">
                                                                        <span className="uppercase tracking-wider">{comp.sqft?.toLocaleString()} SQFT</span>
                                                                        <span className="uppercase tracking-wider">{comp.beds} BD / {comp.baths} BA</span>
                                                                        <span className="uppercase tracking-wider">{comp.distanceMiles} MI AWAY</span>
                                                                    </div>
                                                                    {comp.adjustments && (
                                                                        <div className="text-[13px] text-[#A3A3A3] bg-[#171717] p-3 rounded border border-border italic leading-relaxed">
                                                                            {comp.adjustments}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}

                                            {/* OPPORTUNITY TAB */}
                                            {activeTab === "Opportunity" && tabData.Opportunity && (
                                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6 pt-4">
                                                    {tabData.Opportunity.recommendation && (
                                                        <div className="bg-[#171717] p-6 rounded-xl border border-border relative overflow-hidden">
                                                            <div className="text-[11px] font-mono font-medium text-[#D4AF37] uppercase tracking-widest mb-3 flex items-center gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" /> {tabData.Opportunity.opportunityType || "Opportunity Analysis"}
                                                            </div>
                                                            <p className="text-[15px] leading-relaxed text-[#FAFAFA]">{tabData.Opportunity.recommendation}</p>
                                                        </div>
                                                    )}

                                                    {tabData.Opportunity.marketContext && (
                                                        <p className="text-[15px] leading-relaxed text-[#FAFAFA]">{tabData.Opportunity.marketContext}</p>
                                                    )}

                                                    {tabData.Opportunity.valueAddPlays && (
                                                        <div className="mt-2">
                                                            <h4 className="text-[11px] font-mono font-medium text-[#A3A3A3] uppercase tracking-widest mb-4 flex items-center gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" /> Value-Add Plays
                                                            </h4>
                                                            <div className="grid gap-3">
                                                                {tabData.Opportunity.valueAddPlays.map((play: any, i: number) => (
                                                                    <div key={i} className="p-4 rounded-xl border border-[#242424] bg-[#0A0A0A] hover:border-[#404040] transition-colors group">
                                                                        <div className="flex justify-between items-start mb-2">
                                                                            <span className="font-display font-medium text-[15px] text-[#FAFAFA]">{play.play}</span>
                                                                            <span className="text-[13px] font-mono font-medium text-[#D4AF37] bg-[#D4AF37]/5 px-2 py-1 rounded border border-[#D4AF37]/30">+${(play.estimatedValueIncrease || 0).toLocaleString()}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-3 text-[11px] font-mono text-[#A3A3A3] mt-2">
                                                                            <span className="uppercase tracking-wider">Cost: ${(play.estimatedCost || 0).toLocaleString()}</span>
                                                                            <span className="w-1 h-1 rounded-full bg-[#242424]" />
                                                                            <span className="uppercase tracking-wider">Timeline: {play.timeline}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {tabData.Opportunity.exitStrategies && (
                                                        <div className="mt-4">
                                                            <h4 className="text-[11px] font-mono font-medium text-[#A3A3A3] uppercase tracking-widest mb-4 flex items-center gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" /> Exit Strategies
                                                            </h4>
                                                            <div className="bg-[#0A0A0A] border border-border rounded-xl overflow-hidden divide-y divide-[#242424]">
                                                                {tabData.Opportunity.exitStrategies.map((exit: any, i: number) => (
                                                                    <div key={i} className="flex items-center justify-between p-4 hover:bg-[#171717] transition-colors">
                                                                        <div className="flex items-center gap-3">
                                                                            <span className="text-[15px] font-medium text-[#FAFAFA]">{exit.strategy}</span>
                                                                            <span className="text-[11px] font-mono text-[#A3A3A3] uppercase tracking-wider px-2 py-0.5 rounded border border-[#242424]">{exit.holdPeriod} Hold</span>
                                                                        </div>
                                                                        <span className="font-mono text-lg font-bold text-primary">{exit.annualizedReturn}% <span className="text-xs text-muted-foreground font-sans uppercase tracking-widest">IRR</span></span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </motion.div>
                                            )}

                                            {/* ACTION / NEGOTIATION TAB */}
                                            {activeTab === "Action" && tabData.Action && (
                                                <div className="flex flex-col gap-5">
                                                    {tabData.Action.leverageScore != null && (
                                                        <div className={`p-4 rounded-xl border ${tabData.Action.leverageScore >= 70 ? 'bg-[#D4AF37]/10 border-[#D4AF37]/30' : 'bg-[#171717] border-border'}`}>
                                                            <div className="text-[10px] font-mono text-[#A3A3A3] uppercase tracking-widest mb-1">Buyer Leverage</div>
                                                            <div className={`text-2xl font-mono font-medium ${tabData.Action.leverageScore >= 70 ? 'text-[#D4AF37]' : 'text-[#FAFAFA]'}`}>
                                                                {tabData.Action.leverageScore} / 100
                                                            </div>
                                                        </div>
                                                    )}
                                                    {tabData.Action.leverageFactors && (
                                                        <ul className="space-y-1.5">
                                                            {tabData.Action.leverageFactors.map((f: string, i: number) => (
                                                                <li key={i} className="flex items-start gap-2 text-[13px] text-[#A3A3A3]">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] mt-1.5 shrink-0"></span> {f}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                    {tabData.Action.openingScript && (
                                                        <div>
                                                            <h4 className="text-[11px] font-mono font-medium text-[#FAFAFA] uppercase tracking-widest mb-2">Opening Call Script</h4>
                                                            <div className="p-4 rounded-xl bg-[#171717] border border-border text-[13px] text-[#A3A3A3] italic leading-relaxed">
                                                                &ldquo;{tabData.Action.openingScript}&rdquo;
                                                            </div>
                                                        </div>
                                                    )}
                                                    {tabData.Action.offerLadder && (
                                                        <div className="mt-4">
                                                            <h4 className="text-[11px] font-mono font-medium text-[#A3A3A3] uppercase tracking-widest mb-4 flex items-center gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" /> Offer Strategy Ladder
                                                            </h4>
                                                            <div className="flex flex-col gap-3">
                                                                {tabData.Action.offerLadder.map((offer: any, i: number) => (
                                                                    <div key={i} className="flex flex-col md:flex-row md:items-center gap-4 p-5 rounded-xl border border-[#242424] bg-[#0A0A0A] transition-colors group relative overflow-hidden">
                                                                        <div className="flex-shrink-0 md:w-32">
                                                                            <span className={`text-[10px] font-mono font-medium uppercase tracking-widest px-3 py-1.5 rounded border ${offer.level === 'Anchor' ? 'bg-green-950/30 text-green-500 border-green-900/50' : offer.level === 'Target' ? 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/30' : 'bg-red-950/30 text-red-500 border-red-900/50'}`}>
                                                                                {offer.level}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex flex-col md:flex-row md:items-center gap-3 w-full justify-between z-10">
                                                                            <div className="font-mono text-[18px] font-medium text-[#FAFAFA]">${(offer.price || 0).toLocaleString()}</div>
                                                                            <p className="text-[13px] text-[#A3A3A3] md:max-w-[60%] leading-relaxed">{offer.rationale}</p>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {tabData.Action.verificationQuestions && (
                                                        <div className="mt-4">
                                                            <h4 className="text-[11px] font-mono font-medium text-[#A3A3A3] uppercase tracking-widest mb-4 flex items-center gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" /> Due Diligence Questions
                                                            </h4>
                                                            <div className="bg-[#0A0A0A] border border-[#242424] rounded-xl p-6 relative overflow-hidden">
                                                                <div className="absolute top-0 left-0 w-1 h-full bg-[#D4AF37]" />
                                                                <ul className="space-y-4">
                                                                    {tabData.Action.verificationQuestions.map((q: string, i: number) => (
                                                                        <li key={i} className="flex items-start gap-4 text-[13px] text-[#FAFAFA] leading-relaxed">
                                                                            <span className="flex items-center justify-center w-5 h-5 rounded bg-[#171717] border border-border text-[9px] font-mono font-medium text-[#A3A3A3] shrink-0 mt-0.5">{i + 1}</span>
                                                                            {q}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {!activeProperty && activeTab === "Compare" && selectedForComparison.length > 0 && (
                            <div className="flex-1 overflow-y-auto p-6 bg-card flex flex-col gap-6 hide-scrollbar">
                                <motion.div
                                    initial="hidden"
                                    animate="visible"
                                    variants={{
                                        hidden: { opacity: 0 },
                                        visible: {
                                            opacity: 1,
                                            transition: { staggerChildren: 0.1 }
                                        }
                                    }}
                                    className="grid grid-cols-2 gap-6"
                                >
                                    {selectedForComparison.map((prop, idx) => (
                                        <motion.div
                                            key={idx}
                                            variants={{
                                                hidden: { opacity: 0, x: 20 },
                                                visible: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
                                            }}
                                            className="flex flex-col border border-border rounded-xl bg-[#0A0A0A] overflow-hidden hover:border-[#404040] transition-colors"
                                        >

                                            {/* Sticky Header */}
                                            <div className="relative h-20 bg-[#171717] border-b border-[#242424] flex items-center justify-center p-4 text-center shrink-0 sticky top-0 z-10">
                                                <span className="relative z-10 text-[11px] text-[#A3A3A3] font-mono font-medium uppercase tracking-widest">{prop.propertyType}</span>
                                                <div className="absolute top-3 right-3 z-10">
                                                    {prop.dealScore != null && (
                                                        <div className={`text-[10px] font-mono font-medium px-2 py-1 rounded uppercase border ${prop.dealScore >= 70 ? 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/30' : 'bg-[#242424] text-[#A3A3A3] border-border'}`}>
                                                            {prop.dealScore} Score
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Details Body */}
                                            <div className="p-5 flex flex-col gap-4 relative z-0">
                                                <div>
                                                    <h4 className="font-display font-medium text-[15px] text-[#FAFAFA] mb-1.5 leading-tight hover:text-[#D4AF37] transition-colors">{prop.address || "Unknown Address"}</h4>
                                                    <div className="font-mono font-medium text-[18px] text-[#FAFAFA]">${(prop.listPrice || 0).toLocaleString()}</div>
                                                    <p className="text-[11px] font-mono text-[#7C7C7C] mt-2">{prop.city}, MI {prop.zip}</p>
                                                </div>

                                                {/* Key Metrics Grid */}
                                                <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-[11px] border-y border-[#242424] py-4 my-1">
                                                    <div><span className="text-[#7C7C7C] block text-[9px] mb-1 tracking-widest uppercase font-mono">SqFt</span> <span className="font-mono text-[#FAFAFA]">{prop.squareFeet ? prop.squareFeet.toLocaleString() : '-'}</span></div>
                                                    <div><span className="text-[#7C7C7C] block text-[9px] mb-1 tracking-widest uppercase font-mono">Price/SqFt</span> <span className="font-mono text-[#FAFAFA]">{prop.squareFeet && prop.listPrice ? '$' + Math.round(prop.listPrice / prop.squareFeet) : '-'}</span></div>
                                                    <div><span className="text-[#7C7C7C] block text-[9px] mb-1 tracking-widest uppercase font-mono">DOM</span> <span className="font-mono text-[#FAFAFA]">{prop.dom ?? '-'}</span></div>
                                                    <div><span className="text-[#7C7C7C] block text-[9px] mb-1 tracking-widest uppercase font-mono">Beds/Baths</span> <span className="font-mono text-[#FAFAFA]">{prop.bedrooms || '-'}/{prop.bathrooms || '-'}</span></div>
                                                </div>

                                                {/* Deal Reasons / Strengths */}
                                                {prop.dealReasons && prop.dealReasons.length > 0 && (
                                                    <div className="text-[10px] font-mono text-[#D4AF37] bg-[#D4AF37]/5 p-3 rounded-lg mt-1 border border-[#D4AF37]/20 flex items-start gap-2 uppercase tracking-wide">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] mt-0.5 shrink-0" />
                                                        <p className="leading-relaxed">{prop.dealReasons[0]}</p>
                                                    </div>
                                                )}

                                                <button
                                                    onClick={() => { setActiveProperty(prop); setActiveTab("Overview"); }}
                                                    className="w-full mt-3 text-[11px] font-mono font-medium uppercase tracking-wider px-4 py-3 rounded bg-[#242424] text-[#FAFAFA] hover:bg-[#333333] border border-border transition-colors"
                                                >
                                                    Open Deal Room
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </motion.div>
                            </div>
                        )}
                    </section>
                ) : null}
            </main>
        </div >
    );
}

export default function ChatPage() {
    return (
        <Suspense fallback={<div className="h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-24"><MogulFactLoader message="Loading Deal Room..." /></div>}>
            <ChatContent />
        </Suspense>
    );
}
