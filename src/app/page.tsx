"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loadSessions, ChatSession } from "@/lib/chatStore";
import WatchtowerDrawer from "@/components/WatchtowerDrawer";
import { loadAllClients, BuyBoxCriteria } from "@/lib/buybox";



export default function Home() {
  const router = useRouter();
  const [recentSessions, setRecentSessions] = useState<ChatSession[]>([]);
  const [clientBuyBoxes, setClientBuyBoxes] = useState<any[]>([]);
  const [isWatchtowerOpen, setIsWatchtowerOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    const init = async () => {
      setRecentSessions(await loadSessions());

      const allClients = await loadAllClients();
      const formattedClients = allClients.map((box: BuyBoxCriteria) => {
        let icon = "🏢";
        const typeStr = (box.propertyType || "Commercial").toLowerCase();
        if (typeStr.includes("residential")) icon = "🏡";
        else if (typeStr.includes("industrial") || typeStr.includes("warehouse")) icon = "🏭";
        else if (typeStr.includes("retail") || typeStr.includes("strip")) icon = "🏬";
        else if (typeStr.includes("mechanic") || typeStr.includes("dealership")) icon = "🔧";

        const min = box.priceMin ? `$${(parseInt(box.priceMin) / 1000000).toFixed(1).replace(/\.0$/, '')}M` : "$0";
        const max = box.priceMax ? `$${(parseInt(box.priceMax) / 1000000).toFixed(1).replace(/\.0$/, '')}M` : "No Max";
        let priceStr = `${min} – ${max}`;
        if (!box.priceMin && !box.priceMax) priceStr = "Any Price";

        return {
          slug: box.id,
          name: box.name,
          type: box.propertyType || "Commercial",
          location: box.location || "Any Location",
          price: priceStr,
          icon: icon,
        };
      });
      setClientBuyBoxes(formattedClients);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

        {/* Hero: AI-Powered Chat Bar Client Intake */}
        <section className="flex flex-col max-w-4xl mx-auto w-full gap-6 pt-4">
          <div className="text-center mb-2">
            <h2 className="font-display text-3xl font-bold text-foreground tracking-tight">Master Router Portfolio</h2>
            <p className="text-[#A3A3A3] text-sm mt-1">Type a command to instantly onboard clients into the 7:00 AM Automated Deal Flow.</p>
          </div>

          <div className="bg-[#171717] border border-[#242424] rounded-2xl p-5 shadow-2xl relative overflow-hidden">
            {/* AI Chat Bar */}
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!searchInput.trim() || (window as any).__intakeLoading) return;
              (window as any).__intakeLoading = true;

              // Show loading state
              const btn = (e.target as HTMLFormElement).querySelector('button[type=submit]') as HTMLButtonElement;
              const originalText = btn.innerHTML;
              btn.innerHTML = '<div class="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>';
              btn.disabled = true;

              try {
                const res = await fetch('/api/intake-client-nlp', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ prompt: searchInput.trim() })
                });

                if (res.ok) {
                  const { client } = await res.json();
                  const bb = client.buy_box_json || {};
                  const typeStr = (bb.propertyType || "Commercial").toLowerCase();
                  let icon = "🏢";
                  if (typeStr.includes("residential")) icon = "🏡";
                  else if (typeStr.includes("industrial") || typeStr.includes("warehouse")) icon = "🏭";
                  else if (typeStr.includes("retail") || typeStr.includes("strip")) icon = "🏬";
                  else if (typeStr.includes("mechanic") || typeStr.includes("dealership")) icon = "🔧";
                  else if (typeStr.includes("multifamily")) icon = "🏘️";

                  const min = bb.priceMin ? `$${(parseInt(bb.priceMin) / 1000000).toFixed(1).replace(/\.0$/, '')}M` : "$0";
                  const max = bb.priceMax ? `$${(parseInt(bb.priceMax) / 1000000).toFixed(1).replace(/\.0$/, '')}M` : "No Max";
                  let priceStr = `${min} – ${max}`;

                  const newBox = {
                    slug: client.id || bb.id || client.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                    name: client.name,
                    type: bb.propertyType || "Commercial",
                    location: bb.location || "Any Location",
                    price: priceStr,
                    icon,
                    isNew: true
                  };

                  setClientBuyBoxes(prev => [newBox, ...prev.filter(b => b.slug !== newBox.slug)]);
                  setSearchInput("");
                }
              } catch (err) {
                console.error("NLP Intake Error:", err);
              } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
                (window as any).__intakeLoading = false;
              }
            }}>
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#D4AF37]">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></svg>
                  </div>
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder={`"Add Fadi, industrial warehouses in Macomb County $1M-$4M, fadi@invest.com"`}
                    className="w-full bg-[#0A0A0A] border border-[#333] rounded-xl pl-12 pr-4 py-4 text-sm text-foreground placeholder:text-[#555] focus:outline-none focus:border-[#D4AF37] transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!searchInput.trim()}
                  className="h-[54px] px-6 bg-[#D4AF37] hover:bg-[#E5C158] text-black font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  Lock In
                </button>
              </div>

              {/* Hint Examples */}
              <div className="flex flex-wrap gap-2 mt-4">
                {[
                  "Add John, retail strip centers in Wayne County under $5M, john@deals.com",
                  "Lock in Sarah for residential homes in 48124 zip, $400k-$700k",
                  "New client Mike, multifamily anywhere in Michigan, max $2M"
                ].map((hint, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSearchInput(hint)}
                    className="text-[10px] font-mono px-3 py-1 rounded-full border border-[#242424] bg-[#0A0A0A] hover:border-[#D4AF37]/40 hover:text-[#D4AF37] transition-colors text-[#555] cursor-pointer truncate max-w-[280px]"
                  >
                    {hint}
                  </button>
                ))}
              </div>
            </form>
          </div>
        </section>

        {/* Client Buy Boxes */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-display text-xl font-bold text-foreground">Client Buy Boxes</h3>
              <p className="text-[13px] text-[#A3A3A3] mt-1">Click to instantly search your client&apos;s criteria</p>
            </div>
            <span className="text-[11px] font-mono text-[#7C7C7C] uppercase tracking-wider">{clientBuyBoxes.length} Active</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clientBuyBoxes.map((box) => (
              <button
                key={box.slug}
                onClick={() => handleBuyBox(box.slug)}
                className="group text-left p-5 rounded-xl border border-border bg-[#171717] hover:border-[#404040] transition-colors relative overflow-hidden"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                      <div className="text-2xl opacity-80">{box.icon}</div>
                      <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                          <span className="text-[9px] font-mono text-green-500 uppercase tracking-widest">Active Router</span>
                      </div>
                  </div>
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
