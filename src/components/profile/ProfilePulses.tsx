import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from '../ui/Icons';
import { Pulse } from '../../types';
import { getMyPulses } from '../../services/firebase';
import { SectionTitle } from '../ui/SectionTitle';
import { Loading } from '../ui/Loading';

import { Picture } from '../ui/Picture';
interface ProfilePulsesProps {
  uid: string;
  // Opens the pulse's profile view (the same one the pulses page uses).
  onViewPulse?: (pulse: Pulse) => void;
  // The manual "emit a pulse" entry, moved here when the top-level Pulses menu retired.
  onEmit?: () => void;
}

// My Pulses tab: everything the user has emitted, minus mycelial reach/chat messages. Also the
// home of the manual "emit a pulse" button (the top-level Pulses menu retired 2026-07-24).
export const ProfilePulses: React.FC<ProfilePulsesProps> = ({ uid, onViewPulse, onEmit }) => {
  const { t } = useLanguage();
  const [pulses, setPulses] = useState<Pulse[]>([]);
  // Starts true: the component mounts fresh on every tab activation and fetches immediately.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getMyPulses(uid)
      .then((data) => {
        if (!alive) return;
        // My Pulses excludes mycelial reach/chat messages — those live under Reaches.
        // (getMyPulses already drops them; this is defence in depth, hence the widening.)
        setPulses(data.filter((p: Pulse) => { const type: string = p.type ?? ''; return type !== 'reach' && type !== 'tree_chat'; }));
      })
      .catch((e) => console.error('Fetch profile data error', e))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [uid]);

  const emitButton = onEmit && (
    <button onClick={onEmit}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-orange-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-orange-700 active:scale-95">
      <span className="[&>svg]:h-4 [&>svg]:w-4"><Icons.Pulse /></span> {t('emit_pulse')}
    </button>
  );

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <SectionTitle title={t('my_pulses')} sub={t('my_pulses_sub')} />
        {emitButton}
      </div>
      {loading ? <div className="flex justify-center rounded-2xl border border-slate-100 bg-slate-50/50 py-16"><Loading /></div> : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {pulses.length === 0 ? (
            <div className="col-span-full py-10 text-center text-slate-400">
              <p>{t('no_pulses_yet')}</p>
            </div>
          ) : pulses.map((pulse) => (
            <div
              key={pulse.id}
              role={onViewPulse ? 'button' : undefined}
              onClick={() => onViewPulse?.(pulse)}
              className={`border border-slate-100 rounded-lg overflow-hidden group ${onViewPulse ? 'cursor-pointer transition-shadow hover:shadow-md hover:border-emerald-200' : ''}`}
            >
              <div className="h-24 bg-slate-100 relative">
                {pulse.imageUrl ? (
                  <Picture size={480} src={pulse.imageUrl} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300"><Icons.Hash /></div>
                )}
              </div>
              <div className="p-3">
                <h4 className="font-bold text-sm text-slate-800 line-clamp-1">{pulse.title}</h4>
                <div className="mt-1 flex items-center space-x-3 text-[10px] text-slate-400">
                  <span>{pulse.loveCount} Loves</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
