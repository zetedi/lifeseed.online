import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSession } from '../../contexts/SessionContext';
import { Icons } from '../ui/Icons';
import { Lifetree } from '../../types';
import { SectionTitle } from '../ui/SectionTitle';
import { ValidationBadge } from '../ValidationBadge';
import { firestoreStore } from '../../adapters/firestore';
import type { TendedTree } from '../../services/firebase';
import { roleLabelKey } from '../../domain/treeCircle';
import { isWateringOverdue } from '../../domain/watering';
import { sustainingSeven, SUSTAINING_SEVEN, type GuardianEdge } from '../../domain/sustainingSeven';
import { isExplicitlyValidatedTree, daysUntilLapse } from '../../utils/validation';

import { Picture } from '../ui/Picture';
// The caring/validation state lives in the shell — the hero badge derives from the same
// `caredIds`, so re-caring a tree here must re-light the badge up there immediately.
interface ProfileTreesProps {
  myTrees: Lifetree[];
  // Trees tended through the circle's caring layer (co_owner/steward links) — not owned,
  // so they carry none of the owner's affordances (no delete, no default star, no seven).
  tendedTrees: TendedTree[];
  guardedOnly: Lifetree[];
  // Mahameru — shown to everyone, last: The Original Tree.
  originalTree?: Lifetree | null;
  defaultTreeId?: string;
  onSetDefaultTree?: (treeId: string) => void;
  onViewTree: (tree: Lifetree, section?: string) => void;
  onDeleteTree: (treeId: string) => void;
  onPlant: () => void;
  allValidated: boolean;
  treesNeedingCare: Lifetree[];
  lapsedValidated: (tree: Lifetree) => boolean;
  fadingValidated: (tree: Lifetree) => boolean;
  caringId: string | null;
  onCare: (tree: Lifetree) => void;
}

// My Trees tab — planted trees (owned/stewarded) and trees guarded for others.
export const ProfileTrees: React.FC<ProfileTreesProps> = ({
  myTrees,
  tendedTrees,
  guardedOnly,
  originalTree,
  defaultTreeId,
  onSetDefaultTree,
  onViewTree,
  onDeleteTree,
  onPlant,
  allValidated,
  treesNeedingCare,
  lapsedValidated,
  fadingValidated,
  caringId,
  onCare,
}) => {
  const { t } = useLanguage();

  // THE SUSTAINING SEVEN (domain/sustainingSeven) — the floor's face: seven planted trees,
  // each witnessed by a guardian besides the planter and cared for in its own rhythm. The
  // guardian edges load like the map's counts do: one links read, keyed on the tree ID SET
  // so unrelated re-renders don't refetch. Invited, never enforced: it measures, gates nothing.
  const { lightseed } = useSession();
  const viewerUid = lightseed?.uid;
  const [guardianEdges, setGuardianEdges] = useState<GuardianEdge[]>([]);
  // The seven's mobile accordion: closed by default so the first tree stays above the fold.
  const [sevenOpen, setSevenOpen] = useState(false);
  const treeIdsKey = useMemo(() => myTrees.map(tr => tr.id).sort().join(','), [myTrees]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clears edges before the async scoped read below
    if (!viewerUid || !treeIdsKey) { setGuardianEdges([]); return; }
    let alive = true;
    // Only the guardian links INTO my own trees — not the whole network-wide graph (Lumo's review,
    // 2026-07-20). One scoped read per tree (few); each is the tree's own incoming guardians.
    Promise.all(treeIdsKey.split(',').map(id =>
      firestoreStore.linksTo(id, 'guardian').then(links => links.map(l => ({ from: l.from, to: l.to }))).catch(() => [] as GuardianEdge[]),
    )).then(perTree => { if (alive) setGuardianEdges(perTree.flat()); });
    return () => { alive = false; };
  }, [viewerUid, treeIdsKey]);
  const seven = useMemo(
    () => (viewerUid ? sustainingSeven(myTrees, guardianEdges, viewerUid) : null),
    [myTrees, guardianEdges, viewerUid],
  );
  const sevenLacks = seven ? seven.standings.filter(s => !s.sustaining).slice(0, SUSTAINING_SEVEN) : [];

  return (
    <div className="space-y-8">
      {/* Planted — trees you own and steward */}
      <div>
        <SectionTitle title={t('planted_trees')} sub={t('planted_trees_sub')} />

        {seven && (
          <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
            {/* On MOBILE the seven folds to one line (dots + name), an accordion handle, so the
                first tree stays visible right under it; on sm+ it is always open (the handle
                stops being a button). */}
            <button
              type="button"
              onClick={() => setSevenOpen(o => !o)}
              aria-expanded={sevenOpen}
              className="flex w-full flex-wrap items-center gap-3 text-left sm:pointer-events-none sm:cursor-default"
            >
              <div className="flex items-center gap-1.5" aria-label={`Sustaining seven: ${Math.min(seven.sustaining, seven.target)} of ${seven.target}`}>
                {Array.from({ length: seven.target }, (_, i) => (
                  <span
                    key={i}
                    className={`h-3 w-3 rounded-full ${
                      i < seven.sustaining
                        ? 'bg-emerald-500'
                        : i < seven.planted
                          ? 'border-2 border-emerald-300 bg-white'
                          : 'border border-dashed border-slate-300 bg-transparent'
                    }`}
                  />
                ))}
              </div>
              <p className="text-sm font-bold text-slate-800">
                The sustaining seven
                <span className="ml-2 text-emerald-700">{Math.min(seven.sustaining, seven.target)} / {seven.target}</span>
              </p>
              <span className={`ml-auto text-slate-400 transition-transform sm:hidden ${sevenOpen ? '-rotate-90' : 'rotate-90'}`}>
                <Icons.ChevronRight />
              </span>
            </button>
            <div className={`${sevenOpen ? '' : 'hidden'} sm:block`}>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              {seven.complete
                ? 'Your seven stand: planted, witnessed, and cared for. Roughly what a body asks of the living world.'
                : 'Seven trees, planted and caredFor, each witnessed by a guardian: roughly what a body asks of the living world. Invited, never enforced.'}
            </p>
            {!seven.complete && sevenLacks.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {sevenLacks.map(s => {
                  const lackTree = myTrees.find(tr => tr.id === s.treeId);
                  return (
                    <button
                      key={s.treeId}
                      type="button"
                      onClick={() => lackTree && onViewTree(lackTree, s.witnessed ? 'care' : 'circle')}
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-emerald-100"
                    >
                      <span className="max-w-[9rem] truncate font-bold">{s.name}</span>
                      <span className="text-slate-400">
                        {!s.witnessed && !s.caredFor ? 'needs a witness and water' : !s.witnessed ? 'needs a witness' : 'needs water'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            </div>
          </div>
        )}
        {treesNeedingCare.length > 0 && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <span className="mt-0.5 text-amber-500"><Icons.Eye /></span>
            <p className="text-xs leading-relaxed text-amber-800">{t('care_nudge')}</p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {allValidated && (
            <div onClick={onPlant} className="border-2 border-dashed border-slate-300 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-slate-50 min-h-[100px] text-slate-400 hover:text-emerald-600 transition-all group">
              <div className="bg-slate-100 p-3 rounded-full group-hover:bg-emerald-100 transition-colors">
                <Icons.Tree />
              </div>
              <span className="font-bold mt-2 text-sm">{t('plant_new_tree')}</span>
            </div>
          )}

          {myTrees.length === 0 ? (
            !allValidated && <p className="text-slate-400 text-center py-10 col-span-full">{t('no_trees_yet')}</p>
          ) : (
            [...myTrees].sort((a: Lifetree, b: Lifetree) => (b.id === defaultTreeId ? 1 : 0) - (a.id === defaultTreeId ? 1 : 0)).map((tree: Lifetree) => (
              <div key={tree.id} onClick={() => onViewTree(tree)} className={`border rounded-lg p-4 hover:shadow-md cursor-pointer transition-all flex items-center justify-between group bg-white ${defaultTreeId === tree.id ? 'border-amber-300 ring-1 ring-amber-100' : 'border-emerald-100'}`}>
                <div className="flex items-center space-x-4">
                  <Picture size={480} src={tree.latestGrowthUrl || tree.imageUrl || '/seed.webp'} className="w-16 h-16 rounded object-cover bg-slate-100" />
                  <div>
                    <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
                      {tree.name}
                      {defaultTreeId === tree.id && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700"><Icons.Star filled size={10} /> Default</span>}
                    </h3>
                    <p className="text-xs text-slate-500">Block Height: {tree.blockHeight}</p>
                    {isExplicitlyValidatedTree(tree) ? (
                      <div className="mt-1 flex items-center gap-2">
                        <ValidationBadge compact lapsed={lapsedValidated(tree)} />
                        {isWateringOverdue(tree) && <button type="button" title="Needs water: open tree care" aria-label="Needs water: open tree care" onClick={(e) => { e.stopPropagation(); onViewTree(tree, 'care'); }} className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white ring-2 ring-white/70 shadow-lg shadow-sky-900/30 transition-transform hover:scale-110 active:scale-95"><Icons.Droplet size={18} /></button>}
                        {(lapsedValidated(tree) || fadingValidated(tree)) && (
                          <button onClick={(e) => { e.stopPropagation(); onCare(tree); }} disabled={caringId === tree.id} className="rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                            {caringId === tree.id ? '…' : t('care')}
                          </button>
                        )}
                        {fadingValidated(tree) && !lapsedValidated(tree) && (
                          <span className="text-[10px] font-bold text-amber-600">{daysUntilLapse(tree)}d</span>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-2"><span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{t('pending')}</span>{isWateringOverdue(tree) && <button type="button" title="Needs water: open tree care" aria-label="Needs water: open tree care" onClick={(e) => { e.stopPropagation(); onViewTree(tree, 'care'); }} className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white ring-2 ring-white/70 shadow-lg shadow-sky-900/30 transition-transform hover:scale-110 active:scale-95"><Icons.Droplet size={18} /></button>}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {onSetDefaultTree && (
                    <button
                      onClick={(e) => { e.stopPropagation(); if (defaultTreeId !== tree.id) onSetDefaultTree(tree.id); }}
                      disabled={defaultTreeId === tree.id}
                      className={`p-2 rounded-full transition-colors ${defaultTreeId === tree.id ? 'text-amber-500 cursor-default' : 'text-slate-300 hover:text-amber-500 hover:bg-amber-50 opacity-0 group-hover:opacity-100'}`}
                      title={defaultTreeId === tree.id ? 'Your default tree' : 'Set as my default tree'}
                    >
                      <Icons.Star filled={defaultTreeId === tree.id} />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteTree(tree.id); }}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                    title={t('delete_tree_title')}
                  >
                    <Icons.Trash />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Tended — the circle's caring layer: trees you co-own or steward without owning.
          The tree stays its keeper's, so no delete, star, or seven stands here. */}
      {tendedTrees.length > 0 && (
        <div>
          <SectionTitle title={t('tended_trees')} sub={t('tended_trees_sub')} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tendedTrees.map(({ tree, role }) => (
              <div key={tree.id} onClick={() => onViewTree(tree)} className="border border-emerald-100 rounded-lg p-4 hover:shadow-md cursor-pointer transition-all flex items-center justify-between group bg-emerald-50/30">
                <div className="flex items-center space-x-4">
                  <Picture size={480} src={tree.latestGrowthUrl || tree.imageUrl || '/seed.webp'} className="w-16 h-16 rounded object-cover bg-slate-100" />
                  <div>
                    <h3 className="font-bold text-slate-800">{tree.name}</h3>
                    <p className="text-xs text-slate-500">Block Height: {tree.blockHeight}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold [&>svg]:h-3.5 [&>svg]:w-3.5"><Icons.Venn /> {t(roleLabelKey(role))}</span>
                      {isWateringOverdue(tree) && <button type="button" title="Needs water: open tree care" aria-label="Needs water: open tree care" onClick={(e) => { e.stopPropagation(); onViewTree(tree, 'care'); }} className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white ring-2 ring-white/70 shadow-lg shadow-sky-900/30 transition-transform hover:scale-110 active:scale-95"><Icons.Droplet size={18} /></button>}
                    </div>
                  </div>
                </div>
                {tree.status === 'DANGER' && (
                  <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[9px] font-bold">DANGER</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Guarded — trees you protect as a guardian (you don't own these) */}
      <div>
        <SectionTitle title={t('guarded_trees')} sub={t('guarded_trees_sub')} />
        {guardedOnly.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-sky-500"><Icons.Shield /></div>
            <p className="text-sm">{t('not_guarding')}</p>
            <p className="mt-1 text-xs">{t('guard_hint')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {guardedOnly.map((tree: Lifetree) => (
              <div key={tree.id} onClick={() => onViewTree(tree)} className="border border-sky-100 rounded-lg p-4 hover:shadow-md cursor-pointer transition-all flex items-center justify-between group bg-sky-50/40">
                <div className="flex items-center space-x-4">
                  <Picture size={480} src={tree.latestGrowthUrl || tree.imageUrl || '/seed.webp'} className="w-16 h-16 rounded object-cover bg-slate-100" />
                  <div>
                    <h3 className="font-bold text-slate-800">{tree.name}</h3>
                    <p className="text-xs text-slate-500">Block Height: {tree.blockHeight}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[10px] bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-bold"><Icons.Shield /> Guardian</span>
                      {isWateringOverdue(tree) && <button type="button" title="Needs water: open tree care" aria-label="Needs water: open tree care" onClick={(e) => { e.stopPropagation(); onViewTree(tree, 'care'); }} className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white ring-2 ring-white/70 shadow-lg shadow-sky-900/30 transition-transform hover:scale-110 active:scale-95"><Icons.Droplet size={18} /></button>}
                    </div>
                  </div>
                </div>
                {tree.status === 'DANGER' && (
                  <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[9px] font-bold">DANGER</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* The Original Tree — Mahameru, for everyone, last. */}
      {originalTree && (
        <div>
          <SectionTitle
            title="The Original Tree"
            sub="Indestructible. It has dissolved into Nature, and became part of Phoenix, and of every tree planted since."
          />
          <div
            onClick={() => onViewTree(originalTree)}
            role="button"
            aria-label="Open Mahameru: The Original Tree"
            className="group flex cursor-pointer items-center gap-4 overflow-hidden rounded-2xl border border-amber-200/60 bg-[#04070f] p-4 shadow-lg transition-shadow hover:shadow-xl"
          >
            <Picture size={480} src={originalTree.latestGrowthUrl || originalTree.imageUrl || '/mahameru.svg'} alt="Mahameru"
                 className="h-16 w-16 shrink-0 rounded-full border-2 border-amber-300/70 object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-lg font-light tracking-wide text-amber-100">{originalTree.name || 'Mahameru'}</h3>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{t('sea_of_creation')}</p>
            </div>
            <Icons.ArrowRight size={18} className="shrink-0 text-amber-300/70" />
          </div>
        </div>
      )}
    </div>
  );
};
