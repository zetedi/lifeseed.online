import React, { useState, useEffect, useMemo } from 'react';
import { showAlert, showConfirm } from '../ui/Dialog';
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from '../ui/Icons';
import { firestoreStore } from '../../adapters/firestore';
import { canCareForTree } from '../../domain/policy';
import { SectionCard } from '../ui/SectionCard';
import { fetchAllLifetrees, getPersonName, createTreeInvite, getSentTreeInvites, revokeTreeInvite } from '../../services/firebase';
import { treeCircle } from '../../domain/views/circle';
import { roleLabelKey, roleDescKey, type TreeRelationRole, type InvitableRole, type TreeOwnershipInvite } from '../../domain/treeCircle';
// `translations.en` feeds only the STORED invite message (data on the invite doc — the
// invitee's language is unknown at mint time, so the record keeps the canonical English);
// everything the VIEWER reads goes through t().
import { translations, spokenLine, speak } from '../../utils/translations';
import { WitnessWaterings } from './WitnessWaterings';
import type { Lifetree, Pulse } from '../../types';

import { Picture } from '../ui/Picture';
// THE CIRCLE — the whole circle of care around a Lifetree, one view (the two old tabs merged). It
// is a prism over the tree's incoming links (domain/views/circle), which already groups owner +
// co_owner + guardian + steward + observer. Two layers of belonging live here, kept legible, never
// collapsed: CARING (owner / co-guardian / steward — power to shape and schedule) and WITNESSING
// (guardian — a no-privilege, self-serve follow; the seat of the collective veto). Guardianship is
// the open door anyone may enter; caring is the deeper, invited commitment. Each being is shown AS
// their tree (identity is the tree): the freshest of their public trees lends its face.
type TreeCircleView = ReturnType<typeof treeCircle>;

interface TreeCircleProps {
    tree: Pick<Lifetree, 'id' | 'name' | 'ownerId'>;
    currentUserId?: string;
    currentUserName?: string | null;
    circle: TreeCircleView;
    // The tree's growth blocks (newest first), loaded by the shell and shared with the Digital
    // Tree and Care: the waterings awaiting a witness are read from them.
    growthBlocks: Pulse[];
    // Carer (owner / co-owner / steward / staff): may report danger and invite guardians.
    canEdit: boolean;
    // Owner / staff: may also invite the deeper CARING roles (co-guardian / steward).
    canInviteRoles: boolean;
    // The viewer stands in the circle (keeper / co-owner / steward / guardian) and may witness.
    canWitness: boolean;
    status: 'HEALTHY' | 'DANGER';
    busy: boolean;
    onToggleDanger: () => void;
    // Re-reads the circle in the shell so this view stays in step after a guardian join/leave.
    onGuardianChange: () => void;
    // Reload the shell's chain after a witness landed on a watering.
    onChainRefresh: () => void;
}

interface Face { name?: string; imageUrl?: string }

// A being shown as their tree: the freshest of their public trees with a growth image. `default`
// is private (users doc), so this public freshest tree is the honest public stand-in.
const faceFromForest = (uid: string, forest: Lifetree[]): Face => {
    const mine = forest
        .filter(t => t.ownerId === uid && t.treeType !== 'BED')
        .sort((a, b) => ((b.updatedAt as any)?.toMillis?.() || (b.createdAt as any)?.toMillis?.() || 0)
            - ((a.updatedAt as any)?.toMillis?.() || (a.createdAt as any)?.toMillis?.() || 0));
    const withImage = mine.find(t => t.latestGrowthUrl || t.imageUrl) || mine[0];
    return { name: withImage?.name, imageUrl: withImage?.latestGrowthUrl || withImage?.imageUrl };
};

const Avatar: React.FC<{ imageUrl?: string; seed: string; ring?: string }> = ({ imageUrl, seed, ring = 'ring-slate-100' }) => (
    imageUrl
        ? <Picture size={480} src={imageUrl} alt="" className={`h-11 w-11 shrink-0 rounded-full object-cover ring-2 ${ring}`} />
        : <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-emerald-500 text-sm font-bold text-white ring-2 ${ring}`}>
            {(seed || '?').slice(0, 1).toUpperCase()}
          </span>
);

// Caring roles read warm (emerald), witnessing cool (sky) — power vs witness, at a glance.
const ROLE_RING: Record<TreeRelationRole, string> = {
    owner: 'ring-amber-200', co_owner: 'ring-emerald-100', steward: 'ring-emerald-100',
    guardian: 'ring-sky-100', observer: 'ring-slate-100',
};

export const TreeCircle: React.FC<TreeCircleProps> = ({
    tree, currentUserId, currentUserName, circle, growthBlocks, canEdit, canInviteRoles, canWitness, status, busy, onToggleDanger, onGuardianChange, onChainRefresh,
}) => {
    const treeId = tree.id;
    const { t } = useLanguage();
    // The circle speaks the reader's language through the domain's typed key references —
    // a role without words in translations.ts would fail compilation right here.
    const roleName = (r: TreeRelationRole) => t(roleLabelKey(r));
    const roleDesc = (r: TreeRelationRole) => t(roleDescKey(r));
    const [forest, setForest] = useState<Lifetree[]>([]);
    const [names, setNames] = useState<Record<string, string>>({});
    const [toggleBusy, setToggleBusy] = useState(false);

    // The uids in the circle, and whether I am already a guardian.
    const circleUids = useMemo(() => [...new Set(circle.groups.flatMap(g => g.members))], [circle]);
    const isGuardian = useMemo(
        () => !!currentUserId && circle.groups.some(g => g.role === 'guardian' && g.members.includes(currentUserId)),
        [circle, currentUserId],
    );

    // ── The invitation ledger: who was invited into this circle, as what — and the hand to
    // withdraw an invitation still waiting. Read by the circle's carers (rules: list by
    // lifetreeId is theirs); revocation is a mark on the record, never a delete.
    const [sentInvites, setSentInvites] = useState<TreeOwnershipInvite[]>([]);
    const [inviteNonce, setInviteNonce] = useState(0);
    const [revoking, setRevoking] = useState<string | null>(null);
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- clears the ledger for a viewer outside the circle before the async read below
        if (!canEdit || !currentUserId) { setSentInvites([]); return; }
        let alive = true;
        getSentTreeInvites(treeId)
            .then(list => { if (alive) setSentInvites(list.filter(i => i.status === 'pending')); })
            .catch(() => { if (alive) setSentInvites([]); });
        return () => { alive = false; };
    }, [treeId, canEdit, currentUserId, inviteNonce]);

    // The visible forest, once — lends both the faces and the invite search. Rules-safe (public/node).
    useEffect(() => {
        let alive = true;
        fetchAllLifetrees(undefined, undefined, ['public', 'node']).then(f => { if (alive) setForest(f); }).catch(() => {});
        return () => { alive = false; };
    }, []);

    // Person names as a fallback label for beings whose tree has no face yet — the circle's
    // members and the invited alike. Batched, best-effort.
    const nameUids = useMemo(
        () => [...new Set([...circleUids, ...sentInvites.map(i => i.invitedUserId)])],
        [circleUids, sentInvites],
    );
    useEffect(() => {
        let alive = true;
        const missing = nameUids.filter(uid => !(uid in names));
        if (!missing.length) return;
        Promise.all(missing.map(async uid => [uid, (await getPersonName(uid).catch(() => '')) || ''] as const))
            .then(pairs => { if (alive) setNames(prev => ({ ...prev, ...Object.fromEntries(pairs) })); });
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `names` is the accumulator, not a trigger
    }, [nameUids]);

    const labelFor = (uid: string, face: Face) => uid === currentUserId ? t('you') : (face.name || names[uid] || `${uid.slice(0, 8)}…`);

    // Stepping down is one's own hand: any circle role but the owner's may be laid down
    // (the rules' from == uid delete clause). The owner is the tree's anchor and stays.
    const [steppingDown, setSteppingDown] = useState(false);
    const handleStepDown = async (role: InvitableRole) => {
        if (!currentUserId) return;
        if (!(await showConfirm(spokenLine('step_down_confirm', { role: roleName(role).toLowerCase(), tree: tree.name || '—' }), { title: 'step_down', confirmText: 'confirm', danger: true }))) return;
        setSteppingDown(true);
        try {
            await firestoreStore.unlink(currentUserId, role, treeId);
            onGuardianChange(); // the shell re-reads the circle
        } catch (e) { showAlert(e instanceof Error ? e.message : String(e)); }
        setSteppingDown(false);
    };

    const handleToggleGuardian = async () => {
        if (!canCareForTree(currentUserId)) return;
        setToggleBusy(true);
        try {
            await (isGuardian ? firestoreStore.unlink(currentUserId, 'guardian', treeId) : firestoreStore.link(currentUserId, 'guardian', treeId));
            onGuardianChange(); // the shell re-reads the circle, which flips isGuardian
        } catch (e) { showAlert(e instanceof Error ? e.message : String(e)); }
        setToggleBusy(false);
    };

    // ── Keepership knocks (domain/keeperCircle, ring 2026-08-12): anyone signed-in may ASK to
    // help keep this tree; the knock grants nothing. The keeper answers through the invite box
    // below, choosing the role — the existing circle machinery stays the only privileged door.
    const [keepAsks, setKeepAsks] = useState<{ uid: string; name: string }[]>([]);
    const [myAsk, setMyAsk] = useState(false);
    const [askBusy, setAskBusy] = useState(false);
    const [askNonce, setAskNonce] = useState(0);
    useEffect(() => {
        let alive = true;
        firestoreStore.linksTo(treeId, 'keeper_request').then(async links => {
            if (!alive) return;
            setMyAsk(!!currentUserId && links.some(l => l.from === currentUserId));
            const rows = await Promise.all(links.map(async l =>
                ({ uid: l.from, name: (await getPersonName(l.from).catch(() => '')) || `${l.from.slice(0, 8)}…` })));
            if (alive) setKeepAsks(rows);
        }).catch(() => {});
        return () => { alive = false; };
    }, [treeId, currentUserId, askNonce]);

    const handleAskToKeep = async () => {
        if (!currentUserId) return;
        setAskBusy(true);
        try {
            await (myAsk
                ? firestoreStore.unlink(currentUserId, 'keeper_request', treeId)
                : firestoreStore.link(currentUserId, 'keeper_request', treeId));
            if (!myAsk) showAlert('keeper_request_sent');
            setAskNonce(n => n + 1);
        } catch (e) { showAlert(e instanceof Error ? e.message : String(e)); }
        setAskBusy(false);
    };

    const handleDeclineAsk = async (uid: string) => {
        try {
            await firestoreStore.unlink(uid, 'keeper_request', treeId);
            setAskNonce(n => n + 1);
        } catch (e) { showAlert(e instanceof Error ? e.message : String(e)); }
    };

    // Answering a knock stays inside the circle's ONE privileged door: the keeper sends the
    // asker an invitation in the chosen role, and the knock is withdrawn — keeping begins
    // only when the asker confirms the role they are offered.
    const [askRole, setAskRole] = useState<InvitableRole>(canInviteRoles ? 'steward' : 'guardian');
    const [answering, setAnswering] = useState<string | null>(null);
    const handleAnswerAsk = async (r: { uid: string; name: string }) => {
        if (!currentUserId) return;
        setAnswering(r.uid);
        try {
            await createTreeInvite({
                lifetree: tree as Lifetree,
                invitedUserId: r.uid,
                role: askRole,
                invitedByUserId: currentUserId,
                invitedByName: currentUserName || undefined,
                message: `Would you join the circle of ${tree.name || 'this tree'} as ${translations.en[roleLabelKey(askRole)].toLowerCase()}?`,
            });
            await firestoreStore.unlink(r.uid, 'keeper_request', treeId);
            setAskNonce(n => n + 1);
            setInviteNonce(n => n + 1);
            showAlert(spokenLine('circle_invite_sent', { name: r.name, role: roleName(askRole).toLowerCase(), tree: tree.name || '—' }));
        } catch (e) { showAlert(e instanceof Error ? e.message : String(e)); }
        setAnswering(null);
    };

    // Withdrawing an invitation that still waits: the inviter's own hand, or the keeper's for
    // any invitation on their tree (rules). The record stays, marked revoked.
    const handleRevokeInvite = async (inv: TreeOwnershipInvite) => {
        const who = names[inv.invitedUserId] || faceFromForest(inv.invitedUserId, forest).name || `${inv.invitedUserId.slice(0, 8)}…`;
        if (!(await showConfirm(spokenLine('circle_invite_revoke_confirm', { name: who }), { title: 'invite_revoke', confirmText: 'revoke', danger: true }))) return;
        setRevoking(inv.id);
        try {
            await revokeTreeInvite(inv.id);
            setSentInvites(prev => prev.filter(i => i.id !== inv.id));
        } catch (e) { showAlert(e instanceof Error ? e.message : String(e)); }
        setRevoking(null);
    };

    // ── Invite by tree name ─────────────────────────────────────────────────────────────────────
    const [term, setTerm] = useState('');
    const [inviteRole, setInviteRole] = useState<InvitableRole>('guardian');
    const [inviting, setInviting] = useState<string | null>(null);
    const [invited, setInvited] = useState<Set<string>>(new Set());

    const circleSet = useMemo(() => new Set(circleUids), [circleUids]);
    // Matching trees, each carrying the reason it cannot be invited — or null when it can.
    // An invitation goes to the tree's KEEPER, so a tree kept by this tree's own keeper, or by
    // someone already in the circle, is shown DISABLED with its reason instead of silently
    // omitted (silent omission is how "Phoenix" seemed to not exist: it was the searcher's own).
    const matches = useMemo(() => {
        const q = term.trim().toLowerCase();
        if (q.length < 2) return [];
        return forest
            .filter(t => t.treeType !== 'BED' && t.id !== treeId && (t.name || '').toLowerCase().includes(q))
            .map(t => ({
                tree: t,
                reason: t.ownerId === tree.ownerId
                    ? ('invite_reason_own' as const)
                    : circleSet.has(t.ownerId)
                        ? ('invite_reason_in_circle' as const)
                        : null,
            }))
            .sort((a, b) => Number(!!a.reason) - Number(!!b.reason)) // invitable first
            .slice(0, 6);
    }, [term, forest, treeId, tree.ownerId, circleSet]);

    const handleInvite = async (candidate: Lifetree) => {
        if (!currentUserId) return;
        setInviting(candidate.id);
        try {
            await createTreeInvite({
                lifetree: tree as Lifetree,
                invitedUserId: candidate.ownerId,
                role: inviteRole,
                invitedByUserId: currentUserId,
                invitedByName: currentUserName || undefined,
                message: `Would you join the circle of ${tree.name || 'this tree'} as ${translations.en[roleLabelKey(inviteRole)].toLowerCase()}?`,
            });
            setInvited(prev => new Set(prev).add(candidate.ownerId));
            setInviteNonce(n => n + 1); // the ledger below shows it at once
            showAlert(spokenLine('circle_invite_sent', { name: candidate.name || '—', role: roleName(inviteRole).toLowerCase(), tree: tree.name || '—' }));
        } catch (e) { showAlert(e instanceof Error ? e.message : String(e)); }
        setInviting(null);
    };

    const isBusy = busy || toggleBusy;
    const isOwner = !!currentUserId && currentUserId === tree.ownerId;

    return (
        <SectionCard title={t('circle')} icon={<Icons.Venn />}>
            <p className="mb-5 text-sm text-slate-500">{t('circle_intro')}</p>

            {/* Everyone, grouped by role, each shown as their tree. */}
            {circle.groups.length > 0 ? (
                <div className="mb-5 space-y-4">
                    {circle.groups.map(g => (
                        <div key={g.role}>
                            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                                {roleName(g.role)} · {g.members.length}
                            </p>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {g.members.map(uid => {
                                    const face = faceFromForest(uid, forest);
                                    return (
                                        <div key={`${g.role}:${uid}`} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-2.5 shadow-sm">
                                            <Avatar imageUrl={face.imageUrl} seed={labelFor(uid, face)} ring={ROLE_RING[g.role]} />
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-bold text-slate-800">{labelFor(uid, face)}</p>
                                                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{roleName(g.role)}</p>
                                            </div>
                                            {uid === currentUserId && g.role !== 'owner' && (
                                                <button onClick={() => handleStepDown(g.role as InvitableRole)} disabled={steppingDown}
                                                    className="ml-auto shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50">
                                                    {t('step_down')}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="mb-5 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                    {t('circle_empty')}
                </p>
            )}

            {/* Actions — compact pills, never full width. */}
            <div className="flex flex-wrap items-center gap-2">
                {currentUserId ? (
                    <button
                        onClick={handleToggleGuardian}
                        disabled={isBusy}
                        className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors active:scale-95 disabled:opacity-50 ${isGuardian ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-sky-600 text-white hover:bg-sky-700'}`}
                    >
                        <span className="[&>svg]:h-3.5 [&>svg]:w-3.5"><Icons.Shield /></span>
                        {isGuardian ? t('guard_leave') : t('guard_this_tree')}
                    </button>
                ) : (
                    <p className="text-xs italic text-slate-400">{t('signin_guard')}</p>
                )}

                {canEdit && (
                    <button
                        onClick={onToggleDanger}
                        disabled={isBusy}
                        className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors active:scale-95 disabled:opacity-50 ${status === 'DANGER' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                    >
                        {status === 'DANGER' ? <span>{t('danger_resolve')}</span> : <><span className="[&>svg]:h-3.5 [&>svg]:w-3.5"><Icons.Siren /></span><span>{t('danger_report')}</span></>}
                    </button>
                )}

                {/* Ask to help KEEP — a knock at the circle (keeper_request). */}
                {currentUserId && !circleSet.has(currentUserId) && (
                    <button
                        onClick={handleAskToKeep}
                        disabled={askBusy}
                        className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors active:scale-95 disabled:opacity-50 ${myAsk ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-violet-600 text-white hover:bg-violet-700'}`}
                    >
                        🗝 {myAsk ? t('withdraw_ask') : t('ask_to_keep_tree')}
                    </button>
                )}
            </div>

            {/* Keepership knocks — answered on the row itself, still through the circle's ONE
                privileged door: accepting sends the asker an invitation in the chosen role. */}
            {canEdit && keepAsks.length > 0 && (
                <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
                    <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-700">{t('keeper_requests')}</p>
                        {canInviteRoles && (
                            <select value={askRole} onChange={e => setAskRole(e.target.value as InvitableRole)}
                                className="h-8 rounded-lg border border-violet-200 bg-white px-2 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500">
                                {(['guardian', 'co_owner', 'steward', 'observer'] as InvitableRole[]).map(r => (
                                    <option key={r} value={r}>{t('invite_as_role').replace('{role}', roleName(r))}</option>
                                ))}
                            </select>
                        )}
                    </div>
                    <p className="mb-2 text-[11px] italic text-violet-600">{t('keeper_knock_tree_hint')}</p>
                    {/* What the chosen role truly is — read before anyone offers a word they cannot picture. */}
                    <p className="mb-2 text-xs leading-relaxed text-slate-500">
                        <span className="font-bold text-slate-600">{roleName(askRole)}</span> — {roleDesc(askRole)}
                    </p>
                    <div className="space-y-1.5">
                        {keepAsks.map(r => (
                            <div key={r.uid} className="flex items-center justify-between gap-2 rounded-lg border border-violet-100 bg-white px-3 py-2">
                                <p className="truncate text-sm font-semibold text-slate-700">{r.name}</p>
                                <div className="flex shrink-0 items-center gap-1.5">
                                    <button onClick={() => handleAnswerAsk(r)} disabled={answering === r.uid}
                                        className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-violet-500 disabled:opacity-50">
                                        {answering === r.uid ? '…' : t('accept')}
                                    </button>
                                    <button onClick={() => handleDeclineAsk(r.uid)} disabled={answering === r.uid}
                                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-50">
                                        {t('decline')}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* The invitation ledger — who was invited, as what, since when; withdrawable while it waits. */}
            {canEdit && currentUserId && (
                <div className="mt-5 rounded-2xl border border-slate-100 bg-white p-4">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{t('circle_invitations_pending')}</p>
                    {sentInvites.length === 0 ? (
                        <p className="text-[11px] italic text-slate-400">{t('circle_invitations_none')}</p>
                    ) : (
                        <div className="space-y-1.5">
                            {sentInvites.map(inv => {
                                const face = faceFromForest(inv.invitedUserId, forest);
                                const mayRevoke = canInviteRoles || isOwner || inv.invitedByUserId === currentUserId;
                                return (
                                    <div key={inv.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-2">
                                        <Avatar imageUrl={face.imageUrl} seed={labelFor(inv.invitedUserId, face)} ring={ROLE_RING[inv.role]} />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-bold text-slate-700">{labelFor(inv.invitedUserId, face)}</p>
                                            <p className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                                {roleName(inv.role)}
                                                <span className="ml-1.5 normal-case tracking-normal font-normal">
                                                    · {inv.createdAt?.toMillis ? speak(spokenLine('invited_on', { date: new Date(inv.createdAt.toMillis()).toLocaleDateString() })) : t('pending')}
                                                </span>
                                            </p>
                                        </div>
                                        {mayRevoke && (
                                            <button onClick={() => handleRevokeInvite(inv)} disabled={revoking === inv.id}
                                                className="shrink-0 rounded-lg border border-red-100 bg-white px-2.5 py-1 text-[11px] font-bold text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50">
                                                {revoking === inv.id ? '…' : t('revoke')}
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Witnessing — the circle confirms care it witnessed, kindling its light (the sun ring).
                The same face as on the Care tab; it reads the shell's chain. */}
            {canWitness && (
                <WitnessWaterings
                    className="mt-6"
                    treeName={tree.name}
                    pulses={growthBlocks}
                    currentUserId={currentUserId}
                    canWitness={canWitness}
                    onWitnessed={onChainRefresh}
                />
            )}

            {/* Invite a tree into the circle, found by name. Anyone with edit rights invites
                guardians (the open layer); the owner may also invite the deeper caring roles. */}
            {canEdit && currentUserId && (
                <div className="mt-6 border-t border-slate-100 pt-5">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{t('invite_into_circle')}</p>
                        {canInviteRoles && (
                            <select value={inviteRole} onChange={e => setInviteRole(e.target.value as InvitableRole)}
                                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                                {(['guardian', 'co_owner', 'steward', 'observer'] as InvitableRole[]).map(r => (
                                    <option key={r} value={r}>{t('invite_as_role').replace('{role}', roleName(r))}</option>
                                ))}
                            </select>
                        )}
                    </div>
                    {/* What the chosen role truly is (domain/treeCircle, spoken via role_* keys) — read
                        before anyone accepts a word they cannot picture. */}
                    <p className="mb-2 text-xs leading-relaxed text-slate-500">
                        <span className="font-bold text-slate-600">{roleName(inviteRole)}</span> — {roleDesc(inviteRole)}{' '}
                        <span className="text-slate-400">{t('invite_goes_to_keeper')}</span>
                    </p>
                    <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 [&>svg]:h-4 [&>svg]:w-4"><Icons.Search /></span>
                        <input
                            value={term}
                            onChange={e => setTerm(e.target.value)}
                            placeholder={t('find_tree_by_name')}
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                    </div>
                    {matches.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                            {matches.map(({ tree: m, reason }) => {
                                const already = invited.has(m.ownerId) || sentInvites.some(i => i.invitedUserId === m.ownerId && i.role === inviteRole);
                                return (
                                    <div key={m.id} className={`flex items-center gap-3 rounded-xl border border-slate-100 p-2 shadow-sm ${reason ? 'bg-slate-50/60' : 'bg-white'}`}>
                                        <Avatar imageUrl={m.latestGrowthUrl || m.imageUrl} seed={m.name || '?'} ring={reason ? 'ring-slate-100' : 'ring-emerald-100'} />
                                        <div className="min-w-0 flex-1">
                                            <p className={`truncate text-sm font-bold ${reason ? 'text-slate-400' : 'text-slate-700'}`}>{m.name || 'A tree'}</p>
                                            {reason && <p className="truncate text-[11px] italic text-slate-400">{t(reason)}</p>}
                                        </div>
                                        {!reason && (
                                            <button
                                                onClick={() => handleInvite(m)}
                                                disabled={inviting === m.id || already}
                                                className="shrink-0 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                                            >
                                                {already ? t('invited') : inviting === m.id ? '…' : t('invite')}
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {term.trim().length >= 2 && matches.length === 0 && (
                        <p className="mt-2 text-xs italic text-slate-400">{t('no_tree_to_invite')}</p>
                    )}
                </div>
            )}
        </SectionCard>
    );
};
