import React, { useState } from 'react';
import { notify } from '../ui/Toast';
import { showAlert } from '../ui/Dialog';
import { Icons } from '../ui/Icons';
import { Lifetree } from '../../types';
import { SectionTitle } from '../ui/SectionTitle';
// GuardianButton is entity-generic despite its home: a guardianship is a lightweight
// follow on a tree — the same act wherever the tree is met.
import { GuardianButton } from '../community/GuardianButton';
import { useLanguage } from '../../contexts/LanguageContext';

import { Picture } from '../ui/Picture';
// Being-generic trees section — the lifetrees standing with any being (Indra's net).
// A community, a node or a person gathers trees the same way; only where the gathering is
// rooted (and therefore how trees are listed, searched and invited) differs, so the owner
// binds those via `trees` / `searchInvitable` / `onInvite` — scope-bound loaders as props,
// like EventsSection's loadEvents. CommunityTreesTab is a thin wrapper over this.

interface TreesSectionProps {
  // Section heading (the owner names its own anatomy).
  title: string;
  sub?: string;
  // Signed-in viewer — inviting requires one, and guardianship acts on their behalf.
  currentUserId?: string;
  // The trees standing here (loaded/deduped by the owner — often shared with other tabs).
  trees: Lifetree[];
  onViewTree?: (tree: Lifetree) => void;
  // Guardianship is shared state (owners often show it on several tabs), so it stays outside.
  guardedTreeIds: Set<string>;
  togglingId: string | null;
  onToggleGuardian: (tree: Lifetree) => void;
  // Scope-bound search for invitable trees (the owner excludes already-standing ones etc.).
  searchInvitable: (term: string) => Promise<Lifetree[]>;
  // Scope-bound invite (community/node/personal scoping is the caller's concern).
  onInvite: (tree: Lifetree) => Promise<unknown>;
  // Shown under the invite search when nothing matches (the owner explains its own filter).
  noMatchesMessage?: string;
  // Shown when no trees stand here yet.
  emptyMessage?: string;
  // Background for thumbnails without an image (the owner's theme accent).
  placeholderColor?: string;
}

// Trees section — the tree grid plus the invite-a-tree flow for any entity.
export const TreesSection: React.FC<TreesSectionProps> = ({
  title,
  sub,
  currentUserId,
  trees,
  onViewTree,
  guardedTreeIds,
  togglingId,
  onToggleGuardian,
  searchInvitable,
  onInvite,
  noMatchesMessage = 'No matching trees.',
  emptyMessage = 'No lifetrees linked here yet.',
  placeholderColor,
}) => {
    const { t } = useLanguage();
  // Inviting a tree to stand with this entity.
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteCandidates, setInviteCandidates] = useState<Lifetree[] | null>(null);
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);

  const searchInviteCandidates = async () => {
    const term = inviteSearch.trim().toLowerCase();
    if (!term) { setInviteCandidates([]); return; }
    setInviteCandidates(null); // loading
    try {
      setInviteCandidates(await searchInvitable(term));
    } catch { setInviteCandidates([]); }
  };

  const handleInviteTree = async (tree: Lifetree) => {
    if (!currentUserId || inviteBusyId) return;
    setInviteBusyId(tree.id);
    try {
      await onInvite(tree);
      notify(`🌱 Invitation sent. ${tree.name}'s keeper will decide.`);
      setInviteCandidates(prev => (prev || []).filter(t => t.id !== tree.id));
    } catch (e) {
      showAlert((e instanceof Error && e.message) || 'Could not send the invite.');
    }
    setInviteBusyId(null);
  };

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <SectionTitle title={title} sub={sub} />
        {currentUserId && (
          <button onClick={() => { setInviteOpen(o => !o); setInviteCandidates(null); setInviteSearch(''); }} className="shrink-0 rounded-full bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-teal-700 active:scale-95">
            <span className="flex items-center gap-1.5"><Icons.Plus /> Invite a tree</span>
          </button>
        )}
      </div>
      {inviteOpen && (
        <div className="mb-4 rounded-lg border border-teal-100 bg-teal-50/50 p-4">
          <div className="flex gap-2">
            <input dir="auto" value={inviteSearch} onChange={e => setInviteSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') searchInviteCandidates(); }}
              placeholder={t('search_trees_ph')}
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-teal-300" />
            <button onClick={searchInviteCandidates} className="shrink-0 rounded-full bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700">{t('search_btn')}</button>
          </div>
          {inviteCandidates !== null && (
            <div className="mt-3 space-y-2">
              {inviteCandidates.length === 0 ? (
                <p className="text-xs text-slate-400">{noMatchesMessage}</p>
              ) : inviteCandidates.map(tr => (
                <div key={tr.id} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white p-2.5">
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {tr.latestGrowthUrl || tr.imageUrl ? <Picture size={480} src={tr.latestGrowthUrl || tr.imageUrl} className="h-full w-full object-cover" alt="" /> : <div className="h-full w-full" style={{ backgroundColor: placeholderColor }} />}
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">{tr.name}</span>
                  <button onClick={() => handleInviteTree(tr)} disabled={inviteBusyId === tr.id} className="shrink-0 rounded-full border border-teal-200 bg-white px-3 py-1.5 text-xs font-bold text-teal-700 hover:bg-teal-50 disabled:opacity-50">
                    {inviteBusyId === tr.id ? '…' : 'Invite'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {trees.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-400">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-500"><Icons.Tree /></div>
          <p className="text-sm">{emptyMessage}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {trees.map(tree => (
            <div
              key={tree.id}
              className={`flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm ${onViewTree ? 'cursor-pointer transition-shadow hover:shadow-md' : ''}`}
              onClick={() => onViewTree?.(tree)}
            >
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                {tree.latestGrowthUrl || tree.imageUrl ? <Picture size={480} src={tree.latestGrowthUrl || tree.imageUrl} className="h-full w-full object-cover" alt={tree.name} /> : <div className="h-full w-full" style={{ backgroundColor: placeholderColor }} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-bold text-slate-800">{tree.name}</p>
                <p className="truncate text-[11px] uppercase tracking-wide text-emerald-600">{tree.locationName || '—'}</p>
              </div>
              <GuardianButton tree={tree} guardian={guardedTreeIds.has(tree.id)} busy={togglingId === tree.id} onToggle={onToggleGuardian} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
