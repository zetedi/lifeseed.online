import { Icons } from './ui/Icons';
import { lightHouseVisibility, isLightHouseKind, lightHouseKindKey, type LightHouse } from '../domain/lightHouse';
import { useLanguage } from '../contexts/LanguageContext';

import { Picture } from './ui/Picture';
// The Light House's card — the same face in every garden: the community's LightHouses tab
// and the forest's card view. Golden glow (its map warmth), lighthouse fallback, badges
// for the 3D door and visibility, name and place over the night.

export const LightHouseCard = ({ lightHouse, onOpen, placeholderColor, className = 'h-56' }: {
    lightHouse: LightHouse;
    onOpen?: (s: LightHouse) => void;
    placeholderColor?: string;
    className?: string;
}) => {
    const { t } = useLanguage();
    const kindLabel = (k: Parameters<typeof lightHouseKindKey>[0]) => t(lightHouseKindKey(k));
    return (
    <div
        onClick={onOpen ? () => onOpen(lightHouse) : undefined}
        role={onOpen ? 'button' : undefined}
        aria-label={onOpen ? `Open ${lightHouse.name}` : undefined}
        className={`group relative overflow-hidden rounded-2xl shadow-lg ring-1 ring-amber-200/60 ${onOpen ? 'cursor-pointer transition-shadow hover:shadow-xl' : ''} ${className}`}
    >
        {lightHouse.imageUrl ? (
            <Picture size={1200} src={lightHouse.imageUrl} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" alt={lightHouse.name} />
        ) : (
            <div className="absolute inset-0" style={{ backgroundColor: placeholderColor || '#04070f' }}>
                <img src="/lighthouse.webp" className="h-full w-full object-cover" alt="" />
            </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/10" />
        {/* The glow every lightHouse wears — the same warmth as its map marker. */}
        <div className="pointer-events-none absolute -inset-8 rounded-full opacity-40" style={{ background: 'radial-gradient(circle, rgba(253,224,71,0.35) 0%, transparent 70%)' }} />
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
            {lightHouse.splatUrl && <span className="rounded-full bg-amber-500/90 px-2 py-0.5 text-[9px] font-bold text-white">3D ✦</span>}
            <span className="rounded-full bg-black/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-100 backdrop-blur">{lightHouseVisibility(lightHouse)}</span>
        </div>
        <div className="absolute left-3 top-3">
            <span className="flex items-center gap-1 rounded-full bg-amber-400/90 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-950 shadow"><Icons.Sun /> {isLightHouseKind(lightHouse.kind) ? kindLabel(lightHouse.kind) : (lightHouse.kind || 'Light House')}</span>
        </div>
        <div className="absolute bottom-4 left-4 right-4 text-white">
            <h3 className="break-words text-lg font-light tracking-wide">{lightHouse.name}</h3>
            {lightHouse.locationName && <p className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-100/90"><Icons.Loc /> {lightHouse.locationName}</p>}
        </div>
    </div>
    );
};
