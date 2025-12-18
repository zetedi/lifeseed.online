
import React, { useState } from 'react';
import { Pulse } from '../types';
import { Icons } from './ui/Icons';
import Logo from './Logo';

interface PulseDetailProps {
    pulse: Pulse;
    onClose: () => void;
    backLabel?: string;
}

export const PulseDetail = ({ pulse, onClose, backLabel = "Back" }: PulseDetailProps) => {
    // Mock Exchange State
    const [swapAmount, setSwapAmount] = useState<string>("50");
    const [isBridging, setIsBridging] = useState(false);
    
    // Generate simple link ID
    const pulseLink = `${window.location.origin}?pulse=${pulse.id}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(pulseLink)}`;

    return (
        <div className="min-h-screen animate-in fade-in zoom-in-95 duration-300 pb-20 bg-slate-50">
             {/* Header */}
             <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-4 flex items-center justify-between">
                <button onClick={onClose} className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 font-medium">
                    <Icons.ArrowLeft />
                    <span>{backLabel}</span>
                </button>
                <span dir="ltr" className="text-xs font-mono text-slate-400">ERC-721: {pulse.id.substring(0,8)}...</span>
            </div>

            <div className="max-w-5xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                 {/* Left Column: Visuals */}
                 <div className="space-y-6">
                    <div className="relative h-96 w-full rounded-2xl overflow-hidden shadow-2xl bg-white border border-slate-100 group">
                        {pulse.imageUrl ? (
                            <img src={pulse.imageUrl} alt={pulse.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-200">
                                <Icons.Hash />
                            </div>
                        )}
                        
                        {/* Type Badge */}
                        <div className="absolute top-4 left-4">
                            {pulse.type === 'GROWTH' ? (
                                <span className="bg-emerald-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
                                    <Icons.Leaf /> Growth NFT
                                </span>
                            ) : (
                                <span className="bg-sky-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
                                    <Icons.Sparkles /> Standard Pulse
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Metadata Card */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h1 dir="auto" className="text-2xl font-bold text-slate-800 mb-2">{pulse.title}</h1>
                        <div className="flex items-center space-x-2 text-sm text-slate-500 mb-4">
                             <span>By {pulse.authorName}</span>
                             <span>•</span>
                             <span>{new Date(pulse.createdAt?.toMillis()).toLocaleDateString()}</span>
                        </div>
                        <p dir="auto" className="text-slate-600 leading-relaxed whitespace-pre-wrap font-serif">
                            {pulse.body}
                        </p>
                    </div>
                 </div>

                 {/* Right Column: Exchange & Blockchain */}
                 <div className="space-y-6">
                     
                     {/* Crypto Exchange / Liquidity Bridge */}
                     <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-10 opacity-5">
                            <Logo width={200} height={200} />
                        </div>
                        
                        <div className="relative z-10">
                            <h2 className="text-lg font-bold text-emerald-400 uppercase tracking-wider mb-6 flex items-center">
                                <Icons.Exchange />
                                <span className="ml-2">Liquidity Bridge</span>
                            </h2>

                            <div className="bg-white/5 rounded-xl p-4 border border-white/10 mb-6">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-slate-400 text-xs uppercase">Estimated Value</span>
                                    <span className="text-emerald-400 font-mono text-sm">~ 0.042 ETH</span>
                                </div>
                                <div className="text-3xl font-light">50 <span className="text-sm font-bold text-slate-400">NetLeaves</span></div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center space-x-2 bg-black/20 p-2 rounded-lg border border-white/5">
                                    <div className="bg-indigo-600 p-2 rounded-lg"><Icons.Currency /></div>
                                    <div className="flex-1">
                                        <div className="text-xs text-slate-400">Swap Output</div>
                                        <div className="font-mono text-sm">{swapAmount} NetLeaves</div>
                                    </div>
                                    <button className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded transition-colors">Max</button>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mt-4">
                                    <button 
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-bold text-sm shadow-lg shadow-emerald-900/50 transition-all active:scale-95 flex justify-center items-center gap-2"
                                        onClick={() => alert("Swap initiated via Uniswap Router...")}
                                    >
                                        <Icons.Exchange /> Swap to USDC
                                    </button>
                                    <button 
                                        className="bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-bold text-sm shadow-lg shadow-indigo-900/50 transition-all active:scale-95 flex justify-center items-center gap-2"
                                        onClick={() => { setIsBridging(true); setTimeout(() => { setIsBridging(false); alert("Bridge Request Sent to Arbitrum One."); }, 2000); }}
                                    >
                                        {isBridging ? "Bridging..." : "Bridge to Mainnet"}
                                    </button>
                                </div>
                                <p className="text-[10px] text-center text-slate-500 mt-2">
                                    * Exchange rates are estimated via Uniswap V3 Oracle. Gas fees apply.
                                </p>
                            </div>
                        </div>
                     </div>

                     {/* Blockchain Ledger & QR */}
                     <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl flex flex-col md:flex-row gap-6">
                        <div className="flex-1">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center">
                                <Icons.FingerPrint />
                                <span className="ml-2">Blockchain Ledger</span>
                            </h3>
                            <div className="space-y-3 font-mono text-[10px] text-slate-600 break-all">
                                <div>
                                    <span className="block text-slate-400 uppercase text-[9px] mb-0.5">Pulse ID</span>
                                    <span className="bg-slate-100 px-1 py-0.5 rounded">{pulse.id}</span>
                                </div>
                                <div>
                                    <span className="block text-slate-400 uppercase text-[9px] mb-0.5">Parent Tree</span>
                                    <span className="text-emerald-600 cursor-pointer hover:underline">{pulse.lifetreeId}</span>
                                </div>
                                <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
                                    <span className="text-slate-400">PREV:</span>
                                    <span>{pulse.previousHash}</span>
                                    <span className="text-slate-400">HASH:</span>
                                    <span className="text-indigo-600 font-bold">{pulse.hash}</span>
                                </div>
                                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                                    <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">Verified Block</span>
                                    <a href="#" className="text-indigo-500 hover:underline">View on Etherscan ↗</a>
                                </div>
                            </div>
                        </div>
                        
                        {/* QR Code Section */}
                        <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-slate-100">
                            <div className="mb-2 text-xs font-bold text-slate-400 uppercase tracking-widest">Link</div>
                            <img src={qrUrl} alt="Pulse Link QR" className="w-24 h-24 rounded-lg mix-blend-multiply" />
                            <div className="mt-2 text-[10px] text-slate-400 text-center max-w-[100px]">Scan to view on network</div>
                        </div>
                     </div>

                 </div>
            </div>
        </div>
    );
}
