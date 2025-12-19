
import React, { ReactNode } from 'react';

interface ModalProps {
    children?: ReactNode;
    onClose: () => void;
    title: string;
    backgroundImage?: string;
}

export const Modal = ({ children, onClose, title, backgroundImage }: ModalProps) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md">
        <div 
            className={`rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 ${backgroundImage ? 'text-white' : 'bg-white'}`}
            style={backgroundImage ? { backgroundImage: `url("${backgroundImage}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
        >
            <div className={`shrink-0 px-4 py-3 border-b flex justify-between items-center ${backgroundImage ? 'bg-slate-900/90 border-white/10 backdrop-blur-md' : 'bg-slate-50 border-slate-100'}`}>
                <h3 className={`font-semibold ${backgroundImage ? 'text-emerald-100 drop-shadow-md' : 'text-slate-800'}`}>{title}</h3>
                <button onClick={onClose} className={`p-1 rounded-full transition-colors ${backgroundImage ? 'text-white/80 hover:bg-white/20 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}>&times;</button>
            </div>
            <div className={`flex-1 overflow-y-auto p-4 ${backgroundImage ? 'bg-slate-900/90 backdrop-blur-md' : ''}`}>
                {children}
            </div>
        </div>
    </div>
);
