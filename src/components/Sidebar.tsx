"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import BuyBoxWizard from "./BuyBoxWizard";
import { loadPersonalBuyBox, BuyBoxCriteria, PERSONAL_BUYBOX_ID } from "@/lib/buybox";

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [wizardOpen, setWizardOpen] = useState(false);
    const [editingPersonal, setEditingPersonal] = useState(false);
    const [clients, setClients] = useState<any[]>([]);
    const [personalBuyBox, setPersonalBuyBox] = useState<BuyBoxCriteria | null>(null);

    const fetchClients = () => {
        fetch('/api/clients')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setClients(data);
            })
            .catch(console.error);
    };

    // Load clients from Supabase on mount and when wizard closes
    useEffect(() => {
        setMounted(true);
        fetchClients();
        loadPersonalBuyBox().then(setPersonalBuyBox);
    }, [wizardOpen]);

    // Refresh sidebar when the command-center adds/edits/deletes a client
    useEffect(() => {
        const handler = () => fetchClients();
        window.addEventListener('opulentus:clients-changed', handler);
        return () => window.removeEventListener('opulentus:clients-changed', handler);
    }, []);

    // Hide sidebar on public shared links
    if (pathname.startsWith('/shared')) {
        return null;
    }

    return (
        <>
            <aside className="w-[80px] hover:w-[240px] group transition-all duration-300 ease-in-out flex shrink-0 flex-col h-screen border-r border-[#242424] bg-[#0A0A0A] fixed top-0 left-0 z-[60] overflow-hidden">

                {/* Logo Area */}
                <div className="h-16 flex items-center px-6 border-b border-[#242424] shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-[#D4AF37] flex items-center justify-center shrink-0">
                        <span className="text-[#0A0A0A] font-bold text-lg font-display">O</span>
                    </div>
                    <span className="ml-4 text-white font-display font-medium tracking-wide opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Opulentus</span>
                </div>

                {/* Nav Links */}
                <nav className="flex-1 overflow-y-auto py-8 px-4 flex flex-col gap-2 w-full">
                    <button
                        onClick={() => router.push("/")}
                        className={`relative z-10 pointer-events-auto block w-full flex items-center px-2 py-3 rounded-lg transition-colors text-left ${pathname === '/' ? 'bg-[#171717] text-[#D4AF37]' : 'text-[#A3A3A3] hover:bg-[#171717] hover:text-white'}`}
                    >
                        <div className="w-8 flex items-center justify-center shrink-0">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                        </div>
                        <span className="ml-4 font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Dashboard</span>
                    </button>

                    <button
                        onClick={() => router.push("/morning-brief")}
                        className={`relative z-10 pointer-events-auto block w-full flex items-center px-2 py-3 rounded-lg transition-colors text-left ${pathname === '/morning-brief' ? 'bg-[#171717] text-[#D4AF37]' : 'text-[#A3A3A3] hover:bg-[#171717] hover:text-white'}`}
                    >
                        <div className="w-8 flex items-center justify-center shrink-0">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" strokeWidth={2} strokeLinecap="round" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
                        </div>
                        <span className="ml-4 font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Morning Brief</span>
                    </button>

                    <button
                        onClick={() => router.push("/chat")}
                        className={`w-full flex items-center px-2 py-3 rounded-lg transition-colors text-left ${pathname === '/chat' ? 'bg-[#171717] text-[#D4AF37]' : 'text-[#A3A3A3] hover:bg-[#171717] hover:text-white'}`}
                    >
                        <div className="w-8 flex items-center justify-center shrink-0">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                        </div>
                        <span className="ml-4 font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">AI Deal Room</span>
                    </button>

                    {/* Global Feed nested under Deal Room */}
                    <button
                        onClick={() => router.push("/daily-updates")}
                        className={`w-full flex items-center px-2 py-2.5 flex-1 rounded-lg transition-colors text-left ml-4 ${pathname === '/daily-updates' && (!mounted || !window.location.search.includes('client=')) ? 'bg-[#171717] text-[#D4AF37]' : 'text-[#7C7C7C] hover:bg-[#171717] hover:text-[#A3A3A3]'}`}
                    >
                        <div className="w-8 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <span className="ml-3 text-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Global Feed</span>
                    </button>

                    {/* Refresh Cache */}
                    <button
                        onClick={() => {
                            if (window.confirm("Are you sure you want to clear the system cache? This will reset memory and reload the app.")) {
                                localStorage.clear();
                                sessionStorage.clear();
                                window.location.href = '/';
                            }
                        }}
                        className={`w-full flex items-center px-2 py-2.5 flex-1 rounded-lg transition-colors text-left ml-4 text-[#7C7C7C] hover:bg-[#171717] hover:text-[#A3A3A3]`}
                    >
                        <div className="w-8 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </div>
                        <span className="ml-3 text-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Refresh System</span>
                    </button>

                    {/* Divider */}
                    <div className="my-4 border-t border-[#242424] mx-2"></div>

                    {/* Client Portfolios Section */}
                    <div className="px-2 mb-2 flex items-center justify-between h-5 group/clients relative">
                        <span className="text-[10px] font-mono tracking-wider text-[#7C7C7C] uppercase opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Live Clients</span>
                    </div>

                    {clients.map(client => (
                        <button
                            key={client.id}
                            onClick={() => router.push(`/daily-updates?client=${client.id}`)}
                            className={`w-full flex items-center px-2 py-3 rounded-lg transition-colors text-left ${pathname === '/daily-updates' && (mounted && window.location.search.includes(`client=${client.id}`)) ? 'bg-[#171717] text-[#D4AF37]' : 'text-[#A3A3A3] hover:bg-[#171717] hover:text-white'}`}
                        >
                            <div className="w-8 flex items-center justify-center shrink-0">
                                <span className="text-xl">{client.name.match(/[\uD83C-\uDBFF]|[\uDC00-\uDFFF]/) ? '' : '🏢'}</span>
                                {client.name.match(/[\uD83C-\uDBFF]|[\uDC00-\uDFFF]/) ? client.name.split(' ')[0] : ''}
                            </div>
                            <span className="ml-4 font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                {client.name.match(/[\uD83C-\uDBFF]|[\uDC00-\uDFFF]/) ? client.name.split(' ').slice(1).join(' ') : client.name}
                            </span>
                        </button>
                    ))}

                    {/* Add Client Button */}
                    <button
                        onClick={() => {
                            setEditingPersonal(false);
                            setWizardOpen(true);
                        }}
                        className="flex items-center px-2 py-3 rounded-lg transition-colors text-[#A3A3A3] hover:bg-[#171717] hover:text-[#D4AF37] w-full mt-1"
                    >
                        <div className="w-8 flex items-center justify-center shrink-0 border border-dashed border-[#404040] rounded-md h-7 w-7 ml-0.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        </div>
                        <span className="ml-4 font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Add Client</span>
                    </button>

                </nav>
            </aside>

            {/* Hidden spacer to push main content right since sidebar is fixed */}
            <div className="w-[80px] shrink-0 hidden md:block" />

            {/* Render Wizard outside of standard DOM flow */}
            <BuyBoxWizard
                isOpen={wizardOpen}
                onClose={() => {
                    setWizardOpen(false);
                    setEditingPersonal(false);
                }}
                initialData={editingPersonal ? (personalBuyBox || { id: PERSONAL_BUYBOX_ID, name: "", propertyType: "", transactionType: "", location: "", priceMin: "", priceMax: "", sizeMin: "", sizeMax: "", specialCriteria: "" }) : null}
                isPersonal={editingPersonal}
                onClientSaved={fetchClients}
            />
        </>
    );
}
