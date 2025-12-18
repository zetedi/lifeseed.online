
import React, { useRef, ChangeEvent } from 'react';
import { Icons } from './Icons';

interface ImagePickerProps {
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
    previewUrl: string;
    loading: boolean;
    isDark?: boolean;
}

export const ImagePicker = ({ onChange, previewUrl, loading, isDark = false }: ImagePickerProps) => {
    const fileInput = useRef<HTMLInputElement>(null);
    
    const borderColor = isDark ? 'border-white/50' : 'border-slate-300';
    const bgColor = isDark ? 'bg-black/20 hover:bg-black/30' : 'hover:bg-slate-50';
    const textColor = isDark ? 'text-white' : 'text-slate-400';
    const hoverBorder = isDark ? 'hover:border-white' : 'hover:border-emerald-500';

    return (
        <div className="space-y-2">
             <div 
                onClick={() => fileInput.current?.click()} 
                className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors h-40 relative overflow-hidden group ${previewUrl ? 'border-none p-0' : `${borderColor} ${bgColor} ${hoverBorder}`}`}
             >
                <input type="file" ref={fileInput} className="hidden" accept="image/*" onChange={onChange} />
                
                {loading ? (
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                ) : previewUrl ? (
                    <img src={previewUrl} className="w-full h-full object-cover rounded-xl" />
                ) : (
                    <div className={`text-center ${textColor} flex flex-col items-center gap-2`}>
                        <div className={`p-3 rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
                            <Icons.Camera />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wide">Upload Photo</span>
                    </div>
                )}
             </div>
        </div>
    );
};
