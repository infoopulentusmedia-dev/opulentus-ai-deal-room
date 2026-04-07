"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadSessions, ChatSession } from "@/lib/chatStore";
import WatchtowerDrawer from "@/components/WatchtowerDrawer";
import { loadAllClients, BuyBoxCriteria } from "@/lib/buybox";
import ClientGate from "@/components/ClientGate";
import { AnimatePresence } from "framer-motion";

function propertyIcon(propertyType: string): string {
  const t = (propertyType || "").toLowerCase();
  if (t.includes("residential")) return "🏡";
  if (t.includes("industrial") || t.includes("warehouse")) return "🏭";
  if (t.includes("retail") || t.includes("strip")) return "🏬";
  if (t.includes("mechanic") || t.includes("dealership")) return "🔧";
  if (t.includes("multifamily")) return "🏘️";
  return "🏢";
}

function formatPrice(min: string, max: string): string {
  const fmt = (v: string) => {
    const n = parseInt(v);
    if (isNaN(n)) return null;
    return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
      : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}k`
      : `$${n}`;
  };
  const lo = min ? fmt(min) : null;
  const hi = max ? fmt(max) : null;
  if (lo && hi) return `${lo} – ${hi}`;
  if (lo) return `${lo}+`;
  if (hi) return `Up to ${hi}`;
  return "Any Price";
}

function formatSize(min: string, max: string): string | null {
  const fmt = (v: string) => {
    const n = parseInt(v);
    if (isNaN(n)) return null;
    return n >= 1_000 ? `${(n / 1_000).toFixed(0)}k SF` : `${n} SF`;
  };
  const lo = min ? fmt(min) : null;
  const hi = max ? fmt(max) : null;
  if (lo && hi) return `${lo} – ${hi}`;
  if (lo) return `${lo}+`;
  if (hi) return `Up to ${hi}`;
  return null;
}

function formatClientBox(box: BuyBoxCriteria & { id?: string }) {
  return {
    slug: box.id || "",
    name: box.name,
    icon: propertyIcon(box.propertyType),
    type: box.propertyType || "Commercial",
    transactionType: box.transactionType || "Buy",
    location: box.location || "Any Location",
    price: formatPrice(box.priceMin, box.priceMax),
    size: formatSize(box.sizeMin, box.sizeMax),
    specialCriteria: box.specialCriteria || "",
  };
}

export default function Home() {
  const router = useRouter();
  const [recentSessions, setRecentSessions] = useState<ChatSession[]>([]);
  const [clientBuyBoxes, setClientBuyBoxes] = useState<any[]>([]);
  const [isWatchtowerOpen, setIsWatchtowerOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [commandStatus, setCommandStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isClientContext, setIsClientContext] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState<boolean | null>(null);

  useEffect(() => {
    setIsUnlocked(localStorage.getItem('opulentus_access_master_nick') === 'true');
  }, []);

  // Real-time keyword scanner for Client Context Halo
  useEffect(() => {
    const checkContext = () => {
      const txt = searchInput.toLowerCase();
      const isClient = /add |new client|lock in|onboard|sign up|edit |update |change |modify |delete |remove |drop |kick |show me|what did|check |status for|deals for|matches for|send blast|trigger blast|send the daily/i.test(txt);
      setIsClientContext(isClient);
    };
    checkContext();
  }, [searchInput]);

  useEffect(() => {
    const init = async () => {
      setRecentSessions(await loadSessions());

      const allClients = await loadAllClients();
      const formattedClients = allClients.map((box: BuyBoxCriteria) => formatClientBox(box));
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
            <h2 className="font-display text-3xl font-bold text-foreground tracking-tight">Master Router Command Center</h2>
            <p className="text-[#A3A3A3] text-sm mt-1">Add, edit, remove clients, check their deals, or trigger the daily blast — all from one command.</p>
          </div>

          <div className="bg-[#171717] border border-[#242424] rounded-2xl p-5 shadow-2xl relative overflow-hidden transition-all duration-500">
            {/* Floating Client Context Awareness Text */}
            <div className={`absolute top-2 left-6 transition-all duration-500 ease-out z-10 pointer-events-none flex items-center gap-2 ${
              isClientContext ? 'opacity-100 translate-y-0 text-green-500/90' : 'opacity-0 translate-y-3'
            }`}>
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-xs font-mono font-medium tracking-wide">You are asking me concerning your clients...</span>
            </div>

            {/* AI Command Center Bar */}
            <form className="relative z-20 mt-4" onSubmit={async (e) => {
              e.preventDefault();
              if (!searchInput.trim() || (window as any).__intakeLoading) return;
              (window as any).__intakeLoading = true;
              setCommandStatus(null);

              const btn = (e.target as HTMLFormElement).querySelector('button[type=submit]') as HTMLButtonElement;
              const originalText = btn.innerHTML;
              btn.innerHTML = '<div class="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>';
              btn.disabled = true;

              try {
                const res = await fetch('/api/command-center', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ prompt: searchInput.trim() })
                });

                const result = await res.json();

                if (result.intent === 'add' && result.success) {
                  const client = result.client;
                  const bb = client.buy_box_json || {};
                  const newBox = {
                    ...formatClientBox({ ...bb, id: client.id, name: client.name }),
                    isNew: true,
                  };
                  setClientBuyBoxes(prev => [newBox, ...prev.filter(b => b.slug !== newBox.slug)]);
                  setCommandStatus({ message: result.message, type: 'success' });
                  window.dispatchEvent(new Event('opulentus:clients-changed'));

                } else if (result.intent === 'edit' && result.success) {
                  const client = result.client;
                  const bb = client.buy_box_json || {};
                  const updated = formatClientBox({ ...bb, id: client.id, name: client.name });
                  setClientBuyBoxes(prev => prev.map(b => b.slug === client.id ? updated : b));
                  setCommandStatus({ message: result.message, type: 'success' });
                  window.dispatchEvent(new Event('opulentus:clients-changed'));

                } else if (result.intent === 'delete' && result.success) {
                  setClientBuyBoxes(prev => prev.filter(b => b.name !== result.deletedName));
                  setCommandStatus({ message: result.message, type: 'success' });
                  window.dispatchEvent(new Event('opulentus:clients-changed'));

                } else if (result.intent === 'query' && result.success) {
                  const matchCount = result.recentMatches?.length || 0;
                  setCommandStatus({ message: `${result.message} | ${matchCount} recent AI matches found.`, type: 'info' });

                } else if (result.intent === 'blast' && result.success) {
                  setCommandStatus({ message: result.message, type: 'success' });

                } else if (result.intent === 'search' && result.success) {
                  setCommandStatus({ message: `Routing to Deal Hunter...`, type: 'info' });
                  router.push(`/chat?q=${encodeURIComponent(result.searchQuery)}`);
                  return; // Exit early to keep loading state while navigating

                } else {
                  setCommandStatus({ message: result.message || 'Command not understood.', type: 'error' });
                }

                setSearchInput("");
              } catch (err) {
                console.error("Command Center Error:", err);
                setCommandStatus({ message: 'Something went wrong. Please try again.', type: 'error' });
              } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
                (window as any).__intakeLoading = false;
                setTimeout(() => setCommandStatus(null), 6000);
              }
            }}>
              <div className="flex items-center gap-3">
                <div className={`flex-1 relative rounded-xl transition-all duration-500 ${
                  isClientContext ? 'shadow-[0_0_20px_rgba(34,197,94,0.15)] ring-1 ring-green-500/30' : ''
                }`}>
                  <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-500 ${isClientContext ? 'text-green-500' : 'text-[#D4AF37]'}`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></svg>
                  </div>
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder={'Add a client, edit criteria, remove someone, check deals, or fire the blast...'}
                    className={`w-full bg-[#0A0A0A] border rounded-xl pl-12 pr-4 py-4 text-sm text-foreground placeholder:text-[#555] focus:outline-none transition-colors duration-500 relative z-20 ${
                      isClientContext ? 'border-green-500/50 focus:border-green-500' : 'border-[#333] focus:border-[#D4AF37]'
                    }`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!searchInput.trim()}
                  className={`relative z-20 h-[54px] px-6 font-bold text-sm rounded-xl transition-all duration-500 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ${
                    isClientContext ? 'bg-green-600 hover:bg-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'bg-[#D4AF37] hover:bg-[#E5C158] text-black'
                  }`}
                >
                  Execute
                </button>
              </div>

              {/* Command Status Toast */}
              {commandStatus && (
                <div className={`mt-3 px-4 py-2.5 rounded-lg text-sm font-mono border ${
                  commandStatus.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                  commandStatus.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                  'bg-blue-500/10 border-blue-500/20 text-blue-400'
                }`}>
                  {commandStatus.message}
                </div>
              )}

              {/* Hint Examples */}
              <div className="flex flex-wrap gap-2 mt-4">
                {[
                  "Add Fadi, warehouses in Macomb, $1-4M, fadi@invest.com",
                  "Update Ali's budget to $3M",
                  "Remove Mike from the roster",
                  "Show me Fadi's latest deals",
                  "Send the daily blast now",
                  "Find distressed multifamilies in Wayne County"
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

          {clientBuyBoxes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-[#242424] rounded-xl bg-[#0A0A0A]">
              <div className="text-4xl mb-4 opacity-40">🏢</div>
              <p className="text-[14px] text-[#A3A3A3] mb-1 font-medium">No clients yet</p>
              <p className="text-[12px] text-[#555] mb-5">Use the command bar above or the sidebar &ldquo;+&rdquo; button to add your first client.</p>
              <button
                onClick={() => setSearchInput("Add ")}
                className="text-[11px] font-mono px-4 py-1.5 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37] hover:bg-[#D4AF37]/20 transition-colors"
              >
                + Add First Client
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clientBuyBoxes.map((box) => (
                <button
                  key={box.slug}
                  onClick={() => handleBuyBox(box.slug)}
                  className="group text-left rounded-xl border border-border bg-[#171717] hover:border-[#404040] transition-colors relative overflow-hidden flex flex-col"
                >
                  {/* Card Header */}
                  <div className="p-5 border-b border-[#242424]">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl opacity-80">{box.icon}</div>
                        <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-[9px] font-mono text-green-500 uppercase tracking-widest">Active</span>
                        </div>
                      </div>
                      <svg className="text-[#A3A3A3] group-hover:text-foreground transition-colors shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                    </div>
                    <h4 className="font-display font-semibold text-[15px] text-[#FAFAFA] mb-0.5">{box.name}</h4>
                    <p className="text-[12px] text-[#A3A3A3]">{box.type}</p>
                  </div>

                  {/* Criteria Grid */}
                  <div className="p-5 grid grid-cols-2 gap-x-4 gap-y-4 flex-1">
                    <div>
                      <div className="text-[9px] font-mono text-[#555] uppercase tracking-wider mb-1">Transaction</div>
                      <div className="text-[12px] text-[#FAFAFA] font-medium">{box.transactionType}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-mono text-[#555] uppercase tracking-wider mb-1">Price Range</div>
                      <div className="text-[12px] text-[#D4AF37] font-medium border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2 py-0.5 rounded w-fit">{box.price}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-mono text-[#555] uppercase tracking-wider mb-1">Location</div>
                      <div className="text-[12px] text-[#A3A3A3] leading-snug">{box.location}</div>
                    </div>
                    {box.size ? (
                      <div>
                        <div className="text-[9px] font-mono text-[#555] uppercase tracking-wider mb-1">Size</div>
                        <div className="text-[12px] text-[#A3A3A3]">{box.size}</div>
                      </div>
                    ) : <div />}
                  </div>

                  {/* Special Criteria Footer */}
                  {box.specialCriteria && (
                    <div className="px-5 pb-4">
                      <div className="bg-[#0A0A0A] border border-[#242424] rounded-lg p-3">
                        <div className="text-[9px] font-mono text-[#555] uppercase tracking-wider mb-1">Special Criteria</div>
                        <p className="text-[11px] text-[#7C7C7C] leading-relaxed line-clamp-2">{box.specialCriteria}</p>
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
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
      
      {/* Cinematic Authentication Gate */}
      <AnimatePresence>
          {isUnlocked === false && (
              <ClientGate 
                  clientName="Nick" 
                  clientId="master_nick" 
                  onUnlock={() => setIsUnlocked(true)} 
              />
          )}
      </AnimatePresence>
    </div>
  );
}
