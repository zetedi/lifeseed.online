
import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { createOracleChat } from '../services/gemini';
import { checkAndIncrementAiUsage } from '../services/firebase';
import { Chat, GenerateContentResponse } from "@google/genai";
import { Icons } from './ui/Icons';

export const OracleChat = ({ hasApiKey }: { hasApiKey: boolean }) => {
    const { t } = useLanguage();
    const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
    const [input, setInput] = useState('');
    const [chat, setChat] = useState<Chat | null>(null);
    const [isTyping, setIsTyping] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!hasApiKey) {
            setMessages([{role: 'model', text: t('oracle_waiting')}]);
            setChat(null);
            return;
        }

        try {
            const c = createOracleChat();
            setChat(c);
            setMessages([{role: 'model', text: t('oracle_greeting')}]);
        } catch(e) {
            setMessages([{role: 'model', text: "The connection to the spirits (API) is severed."}]);
        }
    }, [hasApiKey]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;
        
        if (!chat) {
             setMessages(prev => [...prev, {role: 'user', text: input}, {role: 'model', text: "Please connect your Spirit Key to speak."}]);
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
                msg = "Forbidden (403): The Oracle cannot hear you. Please ensure your API Key is valid and selected via the key icon.";
            } else if (e.message?.includes("429")) {
                msg = "The spirits are overwhelmed (Rate Limit). Please wait a moment.";
            }
            
            setMessages(prev => [...prev, {role: 'model', text: msg}]);
        }
        setIsTyping(false);
    }

    return (
        <div className="max-w-2xl mx-auto h-[70vh] flex flex-col bg-white rounded-xl shadow-lg border border-indigo-100 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
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
