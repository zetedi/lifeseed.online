
import React, { useRef, ChangeEvent } from 'react';
import { Icons } from './Icons';

interface ImagePickerProps {
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
    previewUrl: string;
    loading: boolean;
}

export const ImagePicker = ({ onChange, previewUrl, loading }: ImagePickerProps) => {
    const fileInput = useRef<HTMLInputElement>(null);
    return (
        <div className="space-y-2">
             <div onClick={() => fileInput.current?.click()} className={`border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-slate-50 transition-colors h-40 ${previewUrl ? 'border-none p-0' : ''}`}>
                <input type="file" ref={fileInput} className="hidden" accept="image/*" onChange={onChange} />
                {loading ? <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div> : previewUrl ? <img src={previewUrl} className="w-full h-full object-cover rounded-xl" /> : <div className="text-center text-slate-400"><Icons.Camera /><span className="text-xs mt-2 block">Upload Photo</span></div>}
             </div>
        </div>
    );
};
