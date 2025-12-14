
import React, { ReactNode } from 'react';

interface ModalProps {
    children: ReactNode;
    onClose: () => void;
    title: string;
}

export const Modal = ({ children, onClose, title }: ModalProps) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-semibold text-slate-800">{title}</h3>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            <div className="p-4 max-h-[80vh] overflow-y-auto">{children}</div>
        </div>
    </div>
);
