"use client";

import { X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { WATCHLIST_PROPERTIES } from "@/lib/mockData";

export default function WatchtowerDrawer({
    isOpen,
    onClose
}: {
    isOpen: boolean;
    onClose: () => void;
}) {
    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop overlay */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity"
                onClick={onClose}
            />

            {/* Right Sliding Drawer */}
            <div className="fixed inset-y-0 right-0 w-full max-w-md bg-[#0A0A0A] border-l border-[#242424] z-50 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out">
                {/* Header */}
                <div className="p-6 border-b border-[#242424] flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h2 className="font-display text-lg font-semibold text-[#FAFAFA]">Watchtower Digest</h2>
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        </div>
                        <p className="text-sm text-[#A3A3A3]">Monitoring Active Deals & Market Signals</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-[#7C7C7C] hover:text-[#FAFAFA] transition-colors p-1"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-[#7C7C7C] tracking-wider uppercase">Saved Properties</span>
                        <span className="text-xs font-mono bg-[#171717] px-2 py-0.5 rounded border border-[#242424] text-[#FAFAFA]">
                            {WATCHLIST_PROPERTIES.length} Items
                        </span>
                    </div>

                    <div className="space-y-4">
                        {WATCHLIST_PROPERTIES.map((property) => (
                            <Link
                                key={property.ListingId}
                                href={`/chat?watchtowerId=${property.ListingId}`}
                                className="block group border border-[#242424] bg-[#171717] p-4 rounded-xl hover:border-[#404040] transition-colors relative"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-display font-medium text-[#FAFAFA] text-base group-hover:text-white transition-colors">
                                        {property.UnparsedAddress}
                                    </h3>
                                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[#242424] text-[#A3A3A3]">
                                        {property.PropertyType}
                                    </span>
                                </div>
                                <div className="text-sm text-[#A3A3A3] mb-3 line-clamp-2">
                                    {property.PublicRemarks}
                                </div>
                                <div className="flex items-center justify-between border-t border-[#242424] pt-3 mt-3">
                                    <div>
                                        <div className="text-[10px] text-[#7C7C7C] font-mono tracking-wider uppercase mb-0.5">List Price</div>
                                        <div className="text-sm font-medium text-[#FAFAFA]">
                                            ${property.ListPrice.toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] text-[#7C7C7C] font-mono tracking-wider uppercase mb-0.5">Market Status</div>
                                        <div className="text-sm font-medium text-[#FAFAFA]">
                                            {property.DaysOnMarket} DOM
                                        </div>
                                    </div>
                                </div>

                                <div className="absolute inset-0 border border-white/0 group-hover:border-white/10 rounded-xl transition-colors pointer-events-none" />
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-[#242424] bg-[#0A0A0A]">
                    <button className="w-full py-2.5 rounded border border-[#242424] bg-[#171717] hover:bg-[#242424] transition-colors text-[13px] font-medium text-[#FAFAFA]">
                        Manage Alerts
                    </button>
                </div>
            </div>
        </>
    );
}
