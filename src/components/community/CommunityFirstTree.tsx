import React, { useState, useEffect } from 'react';
import { Icons } from '../ui/Icons';
import { Community, Lifetree } from '../../types';
import { SectionTitle } from '../ui/SectionTitle';
import { tabTone } from '../../utils/tabTheme';
import { firestoreStore } from '../../adapters/firestore';
import { GuardianButton } from './GuardianButton';
import { useLanguage } from '../../contexts/LanguageContext';

import { Picture } from '../ui/Picture';
interface CommunityFirstTreeProps {
  community: Community;
  // The first lifetree rooted in this community's domain (earliest planted), if any.
  firstTree: Lifetree | null;
  onViewTree?: (tree: Lifetree) => void;
  // Guardianship is shared state (also shown on the Community Trees tab), so it lives in the shell.
  guardedTreeIds: Set<string>;
  togglingId: string | null;
  onToggleGuardian: (tree: Lifetree) => void;
}

// First Tree tab — the featured (earliest) lifetree of this community's domain.
export const CommunityFirstTree: React.FC<CommunityFirstTreeProps> = ({
  community,
  firstTree,
  onViewTree,
  guardedTreeIds,
  togglingId,
  onToggleGuardian,
}) => {
    const { t } = useLanguage();
  // Featured tree's guardian count — a prism over its incoming 'guardian' links.
  const [firstTreeGuardians, setFirstTreeGuardians] = useState(0);
  const firstTreeId = firstTree?.id;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when there is no featured tree, before the async links fetch below
    if (!firstTreeId) { setFirstTreeGuardians(0); return; }
    let alive = true;
    firestoreStore.linksTo(firstTreeId, 'guardian')
      .then(links => { if (alive) setFirstTreeGuardians(links.length); })
      .catch(() => {});
    return () => { alive = false; };
  }, [firstTreeId, guardedTreeIds]);

  return (
    <div>
      <SectionTitle title="First Tree" sub="The first lifetree rooted in this community's domain." />
      {!firstTree ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-400">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-500"><Icons.Tree /></div>
          <p className="text-sm">{t('community_no_tree')}</p>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div
            className={`relative h-64 md:h-80 w-full overflow-hidden rounded-2xl shadow-xl ${onViewTree ? 'cursor-pointer group' : ''}`}
            onClick={() => onViewTree?.(firstTree)}
          >
            {firstTree.latestGrowthUrl || firstTree.imageUrl ? (
              <Picture size={1200} src={firstTree.latestGrowthUrl || firstTree.imageUrl} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" alt={firstTree.name} />
            ) : (
              <div className="h-full w-full" style={{ backgroundColor: community.theme?.primary || tabTone('communities') }} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-5 left-5 right-5 text-white">
              <h2 className="break-words text-3xl font-light tracking-wide">{firstTree.name}</h2>
              {firstTree.shortTitle && <p className="mt-1 text-sm font-bold uppercase tracking-widest text-emerald-300">{firstTree.shortTitle}</p>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {firstTree.locationName && (
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600"><Icons.Loc /> {firstTree.locationName}</span>
            )}
            {firstTree.validated && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-bold text-emerald-700">{t('validated')}</span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
              {firstTreeGuardians} {firstTreeGuardians === 1 ? 'guardian' : 'guardians'}
            </span>
          </div>

          {firstTree.body && (
            <p className="whitespace-pre-line text-justify font-serif text-lg leading-relaxed text-slate-700">{firstTree.body}</p>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <GuardianButton tree={firstTree} guardian={guardedTreeIds.has(firstTree.id)} busy={togglingId === firstTree.id} onToggle={onToggleGuardian} />
            {onViewTree && (
              <button onClick={() => onViewTree(firstTree)} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-900">
                <Icons.ArrowRight /> View full tree
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
