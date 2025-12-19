
import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { createOracleChat, generateImage } from '../services/gemini';
import { checkAndIncrementAiUsage, mintPulse, uploadBase64Image, listenToUserProfile } from '../services/firebase';
import { useLifeseed } from '../hooks/useLifeseed';
import { Chat, GenerateContentResponse } from "@google/genai";
import { Icons } from './ui/Icons';

export const OracleChat = () => {
    const { t } = useLanguage();
    const { lightseed, activeTree } = useLifeseed();
    const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
    const [input, setInput] = useState('');
    const [chat, setChat] = useState<Chat | null>(null);
    const [isTyping, setIsTyping] = useState(false);
    const [isMinting, setIsMinting] = useState(false);
    const [usage, setUsage] = useState(0);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        try {
            const c = createOracleChat();
            setChat(c);
            setMessages([{role: 'model', text: t('oracle_greeting')}]);
        } catch(e: any) {
            console.error("Oracle Init Error:", e);
            let errorText = "The connection to the spirits (API) is severed.";
            if (e.message && (e.message.includes("API Key") || e.message.includes("apiKey"))) {
                errorText = "Connection severed: Spirit Key (API Key) is missing in deployment.";
            } else if (e.message) {
                errorText = `Connection severed: ${e.message}`;
            }
            setMessages([{role: 'model', text: errorText}]);
        }
    }, []);

    useEffect(() => {
        if (lightseed) {
            const unsub = listenToUserProfile(lightseed.uid, (data) => {
                setUsage(data?.dailyAiText || 0);
            });
            return () => unsub();
        }
    }, [lightseed]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;
        
        if (!chat) {
             setMessages(prev => [...prev, {role: 'user', text: input}, {role: 'model', text: "The Oracle is not connected."}]);
             setInput('');
             return;
        }

        // Check daily limit before proceeding
        try {
            const allowed = await checkAndIncrementAiUsage('text');
            if (!allowed) {
                setMessages(prev => [...prev, {role: 'user', text: input}, {role: 'model', text: t('ai_login_required')}]);
                setInput('');
                return;
            }
        } catch (error: any) {
            setMessages(prev => [...prev, {role: 'user', text: input}, {role: 'model', text: error.message || t('daily_limit_text')}]);
            setInput('');
            return;
        }

        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, {role: 'user', text: userMsg}]);
        setIsTyping(true);

        try {
            const response: GenerateContentResponse = await chat.sendMessage({ message: userMsg });
            setMessages(prev => [...prev, {role: 'model', text: response.text || "..."}]);
        } catch(e: any) {
            console.error("Oracle Error:", e);
            let msg = "The wind is too strong (Error connecting to AI).";
            
            if (e.message?.includes("403")) {
                msg = "Forbidden (403): The Oracle cannot hear you. Please ensure your API Key is valid.";
            } else if (e.message?.includes("429")) {
                msg = "The spirits are overwhelmed (Rate Limit). Please wait a moment.";
            } else if (e.message) {
                msg = `Error: ${e.message}`;
            }
            
            setMessages(prev => [...prev, {role: 'model', text: msg}]);
        }
        setIsTyping(false);
    }

    const handleMint = async () => {
        if (!lightseed || !activeTree) {
            alert("You need a planted Lifetree to mint this conversation.");
            return;
        }
        if (messages.length <= 1) return; // Only greeting

        setIsMinting(true);
        try {
            // Format conversation
            const conversationText = messages.map(m => `${m.role === 'user' ? 'Seeker' : 'Oracle'}: ${m.text}`).join('\n\n');
            const summaryPrompt = conversationText.substring(0, 1000); // Limit context for generation

            // Check AI limit for image
            await checkAndIncrementAiUsage('image');

            // Generate Image
            const prompt = `Create an abstract, artistic image representing the essence of this conversation: ${summaryPrompt}. Do not contain any text, words, letters, or typography in the image.`;
            const imageUrl = await generateImage(prompt);
            let finalImageUrl = "";

            if (imageUrl && imageUrl.startsWith('data:')) {
                 finalImageUrl = await uploadBase64Image(imageUrl, `pulses/ai/${Date.now()}`);
            }

            await mintPulse({
                lifetreeId: activeTree.id,
                type: 'STANDARD',
                title: 'Oracle Wisdom',
                body: conversationText,
                imageUrl: finalImageUrl,
                authorId: lightseed.uid,
                authorName: lightseed.displayName || "Soul",
                authorPhoto: lightseed.photoURL,
            });
            alert("Conversation minted as a Pulse!");
        } catch (e: any) {
            console.error(e);
            alert("Minting failed: " + e.message);
        }
        setIsMinting(false);
    }

    return (
        <div className="max-w-2xl mx-auto h-[70vh] flex flex-col bg-white rounded-xl shadow-lg border border-indigo-100 overflow-hidden relative">
            {/* Header/Actions */}
            <div className="absolute top-4 left-4 z-10 bg-indigo-50 text-indigo-800 px-3 py-1 rounded-full text-[10px] font-bold border border-indigo-100 shadow-sm backdrop-blur-sm">
                Oracle Wisdom: {usage}/21
            </div>

            {messages.length > 1 && lightseed && (
                <div className="absolute top-4 right-4 z-10">
                    <button 
                        onClick={handleMint} 
                        disabled={isMinting}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1.5 rounded-full font-bold shadow-md transition-all active:scale-95 flex items-center gap-1 disabled:opacity-50"
                    >
                        {isMinting ? (
                            <>
                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Minting...</span>
                            </>
                        ) : (
                            <>
                                <Icons.HeartPulse />
                                <span>Mint as Pulse</span>
                            </>
                        )}
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 pt-16">
                {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div dir="auto" className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                            m.role === 'user' 
                                ? 'bg-indigo-600 text-white rounded-br-none' 
                                : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none shadow-sm'
                        }`}>
                            {m.text}
                        </div>
                    </div>
                ))}
                {isTyping && (
                    <div className="flex justify-start">
                        <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
                            <div className="flex space-x-1">
                                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></div>
                                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={bottomRef}></div>
            </div>
            <form onSubmit={handleSend} className="p-4 bg-white border-t border-slate-100 flex space-x-2">
                <input 
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder={t('ask_oracle')}
                    className="flex-1 border border-slate-200 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button type="submit" disabled={isTyping || !input.trim()} className="bg-indigo-600 text-white p-2 rounded-full hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                    <Icons.Send />
                </button>
            </form>
        </div>
    )
}
