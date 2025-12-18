
import React from 'react';
import Logo from '../Logo';

export const Loading = () => {
    return (
        <div className="flex flex-col items-center justify-center p-8 gap-4">
            <div className="animate-pulse">
                <Logo width={80} height={80} />
            </div>
            <p className="text-slate-200 font-bold text-xs uppercase tracking-widest animate-pulse">Loading...</p>
        </div>
    );
};
