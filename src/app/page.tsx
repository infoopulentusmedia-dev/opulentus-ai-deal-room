"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loadSessions, ChatSession } from "@/lib/chatStore";
import WatchtowerDrawer from "@/components/WatchtowerDrawer";

const CLIENT_BUY_BOXES = [
  {
    slug: "ali-beydoun",
    name: "Ali Beydoun",
    type: "Strip Center / Retail Plaza",
    location: "Wayne County",
    price: "$1M – $5M",
    icon: "🏬",
    prompt: "Find strip centers or retail plazas in Wayne County between $1,000,000 and $5,000,000"
  },
  {
    slug: "collin-goslin",
    name: "Collin Goslin",
    type: "Strip Center / Retail Plaza",
    location: "Wayne or Oakland County",
    price: "$1M – $4M",
    icon: "🏪",
    prompt: "Find strip centers or retail plazas in Wayne County or Oakland County between $1,000,000 and $4,000,000"
  },
  {
    slug: "fadi",
    name: "Fadi",
    type: "Warehouse / Industrial",
    location: "Wayne County",
    price: "40k–80k sqft • No max",
    icon: "🏭",
    prompt: "Find warehouse or industrial properties in Wayne County between 40000 and 80000 square feet"
  },
  {
    slug: "abe-saad",
    name: "Abe Saad",
    type: "Mechanic / Collision / Dealership",
    location: "Anywhere in Michigan",
    price: "$100k – $800k",
    icon: "🔧",
    prompt: "Find mechanic shops, collision shops, or car dealerships anywhere in Michigan between $100,000 and $800,000"
  },
  {
    slug: "hussein-zeitoun",
    name: "Hussein Zeitoun",
    type: "Residential",
    location: "48124 Zip Code",
    price: "$400k – $750k",
    icon: "🏠",
    prompt: "Find residential properties in zip code 48124 between $400,000 and $750,000"
  },
  {
    slug: "moe-sabbagh",
    name: "Moe Sabbagh",
    type: "Residential",
    location: "48124 & 48128 Zips",
    price: "$500k – $675k",
    icon: "🏡",
    prompt: "Find residential properties in zip codes 48124 and 48128 between $500,000 and $675,000"
  }
];

export default function Home() {
  const router = useRouter();
  const [recentSessions, setRecentSessions] = useState<ChatSession[]>([]);
  const [isWatchtowerOpen, setIsWatchtowerOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    setRecentSessions(loadSessions());
  }, []);

  const handleSearch = () => {
    if (!searchInput.trim()) return;
    router.push(`/chat?q=${encodeURIComponent(searchInput.trim())}`);
  };

  const handleBuyBox = (slug: string) => {
    router.push(`/chat?buybox=${slug}`);
  };

  const handleResumeSession = (id: string) => {
    router.push(`/chat?session=${id}`);
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-border flex items-center justify-between px-8 bg-[#0A0A0A] sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#171717] border border-border flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FAFAFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></svg>
          </div>
          <h1 className="font-display text-xl font-bold text-foreground tracking-tight">Opulentus</h1>
          <span className="text-[10px] font-mono text-[#D4AF37] border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2 py-0.5 rounded uppercase tracking-wider ml-1">Live</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-[#A3A3A3] uppercase tracking-wider">Apify Scrapers Online</span>
          <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
        </div>
      </header>

      <main className="flex-1 flex flex-col px-6 md:px-12 max-w-7xl mx-auto w-full py-10 gap-12">

        {/* Hero */}
        <section className="flex flex-col items-center text-center max-w-3xl mx-auto w-full gap-8 pt-8">
          <div>
            <p className="text-[11px] font-mono text-primary uppercase tracking-[0.2em] mb-4 font-medium">AI-Powered Deal Intelligence</p>
            <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-[1.1] tracking-tight">
              Hunt deals with<br />
              unfair advantages.
            </h2>
          </div>

          {/* Search Bar */}
          <div className="w-full max-w-2xl relative">
            <div className="relative flex items-center bg-[#0A0A0A] rounded-xl border border-border focus-within:border-[#404040] transition-colors overflow-hidden">
              <svg className="ml-5 text-muted-foreground shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search MLS by address, ID, or describe what you want..."
                className="flex-1 bg-transparent px-4 py-4 outline-none text-sm text-foreground placeholder:text-muted-foreground"
              />
              <button
                onClick={handleSearch}
                disabled={!searchInput.trim()}
                className="h-10 w-10 flex items-center justify-center bg-[#242424] text-foreground rounded border border-border mr-2 hover:bg-[#333333] disabled:opacity-50 transition-colors shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
              </button>
            </div>
          </div>

          {/* Quick Prompts */}
          <div className="flex flex-wrap gap-2 justify-center mt-2">

            {["Distressed multifamilies in Wayne County", "Properties with <10 DOM", "Latest foreclosures near Detroit"].map((prompt, i) => (
              <button
                key={i}
                onClick={() => router.push(`/chat?q=${encodeURIComponent(prompt)}`)}
                className="text-[11px] font-mono px-4 py-1.5 rounded-full border border-border bg-[#171717] hover:border-[#404040] hover:text-[#FAFAFA] transition-colors text-[#A3A3A3] cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>
        </section>

        {/* Client Buy Boxes */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-display text-xl font-bold text-foreground">Client Buy Boxes</h3>
              <p className="text-[13px] text-[#A3A3A3] mt-1">Click to instantly search your client&apos;s criteria</p>
            </div>
            <span className="text-[11px] font-mono text-[#7C7C7C] uppercase tracking-wider">{CLIENT_BUY_BOXES.length} Active</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CLIENT_BUY_BOXES.map((box) => (
              <button
                key={box.slug}
                onClick={() => handleBuyBox(box.slug)}
                className="group text-left p-5 rounded-xl border border-border bg-[#171717] hover:border-[#404040] transition-colors relative overflow-hidden"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-2xl opacity-80">{box.icon}</div>
                  <svg className="text-[#A3A3A3] group-hover:text-foreground transition-colors" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                </div>
                <h4 className="font-display font-medium text-[15px] text-[#FAFAFA] mb-1">{box.name}</h4>
                <p className="text-[13px] text-[#A3A3A3] mb-4">{box.type}</p>
                <div className="flex items-center gap-3 text-[11px] font-mono">
                  <span className="text-[#D4AF37] border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2 py-0.5 rounded">{box.price}</span>
                  <span className="text-[#7C7C7C]">{box.location}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Bottom Row: Recent Sessions + Watchtower */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Recent Sessions */}
          <section className="col-span-2 border border-border bg-[#171717] rounded-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display text-[15px] font-medium text-foreground">Recent Sessions</h3>
              <button
                onClick={() => router.push("/chat")}
                className="text-[11px] font-mono text-[#D4AF37] hover:text-[#FAFAFA] uppercase tracking-wider transition-colors"
              >
                + New Chat
              </button>
            </div>
            {recentSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-[#242424] rounded-lg">
                <div className="w-10 h-10 rounded border border-border bg-[#242424] flex items-center justify-center mb-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#A3A3A3]"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                </div>
                <p className="text-[13px] text-[#A3A3A3] mb-1">No recent sessions</p>
                <p className="text-[11px] text-[#7C7C7C]">Start a search or click a buy box above</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {recentSessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => handleResumeSession(session.id)}
                    className="group flex items-center justify-between p-4 rounded-lg border border-border hover:border-[#404040] bg-[#0A0A0A] transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-[13px] text-[#FAFAFA] truncate group-hover:text-foreground transition-colors">{session.headline}</h4>
                      <p className="text-[11px] text-[#7C7C7C] mt-1.5 truncate font-mono">
                        {session.messages.length} MESSAGE{session.messages.length !== 1 && 'S'}
                        {session.buyboxSlug && ` • BUY BOX`}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-[#7C7C7C] shrink-0 ml-4 uppercase">{formatTime(session.updatedAt)}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Watchtower */}
          <section className="col-span-1 border border-border bg-[#171717] rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-[15px] font-medium text-foreground">Watchtower</h3>
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              </div>
              <p className="text-[13px] text-[#A3A3A3] mb-6">Monitoring Active Deals & Market Signals</p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-2xl font-mono font-medium text-foreground">12</div>
                  <div className="text-[10px] font-mono text-[#7C7C7C] uppercase tracking-wider mt-1">Watchlist</div>
                </div>
                <div>
                  <div className="text-2xl font-mono font-medium text-[#FAFAFA]">3</div>
                  <div className="text-[10px] font-mono text-[#7C7C7C] uppercase tracking-wider mt-1">Alerts</div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsWatchtowerOpen(true)}
              className="w-full mt-6 py-2.5 rounded border border-[#242424] bg-[#242424] hover:bg-[#333333] transition-colors text-[13px] font-medium text-foreground"
            >
              View Digest Reports
            </button>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 px-8 text-center">
        <p className="text-xs font-mono text-muted uppercase tracking-wider">Opulentus • Apify Actors • Gemini AI</p>
      </footer>
      <WatchtowerDrawer isOpen={isWatchtowerOpen} onClose={() => setIsWatchtowerOpen(false)} />
    </div>
  );
}
