import React, { useState } from 'react';
import { useSession } from '../../contexts/SessionContext';
import { Icons } from '../ui/Icons';
import { BeingQr } from '../ui/BeingQr';
import { LoveButton } from '../ui/LoveButton';
import { mintBeingQr } from '../../services/firebase/beings';
import { setOfferingActive, acceptOffering, declineOffering, withdrawOffering } from '../../services/firebase';
import { offeringStatusOf, canWithdrawOffering, canAnswerOffering } from '../../domain/offering';
import { BeingProfile, type BeingSection } from '../BeingProfile';
import { ChainTree } from '../sections/ChainTree';
import { formatLight } from '../../domain/light';
import { tabTone } from '../../utils/tabTheme';
import { notify } from '../ui/Toast';
import { showAlert } from '../ui/Dialog';
import type { Pulse } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

// THE OFFERING'S OWN FACE — an offering is a being (it carries a lid, a QR, a heart), so it
// wears the shared BeingProfile like a tree or a bed. Its tree view is its LIFECYCLE: the
// offering stands as the chain's root today, and the acts of its life (stays, appreciations,
// renewals) will grow the chain above it as those rungs arrive. The author may pause and
// rewake it here; a paused offering leaves the shared feed but never loses its history.

interface OfferingProfileProps {
  offering: Pulse;
  onClose: () => void;
  onUpdate?: (u: Partial<Pulse>) => void;
  onEdit?: () => void;
}

export const OfferingProfile: React.FC<OfferingProfileProps> = ({ offering, onClose, onUpdate, onEdit }) => {
    const { t } = useLanguage();
  const { lightseed, myTrees, tendedTrees } = useSession();
  const isAuthor = !!lightseed && offering.authorId === lightseed.uid;
  const [active, setActive] = useState(offering.offeringActive !== false);
  const [busy, setBusy] = useState(false);

  // THE OFFERING OF CARE (ring 2026-09-06): made TO a being, answered here. The receiver's
  // side — the tree's keeper, co-owners and stewards, the vision's author — sees a green
  // Accept (yes / not now) and a Decline; the author sees Withdraw while it is open. Accepting
  // calls the server, which mints the twin blocks on both chains (functions/acceptOffering).
  const [status, setStatus] = useState(offeringStatusOf(offering));
  const [confirming, setConfirming] = useState(false);
  const uid = lightseed?.uid || '';
  const standsForReceiver = !!uid && (
    offering.offeredToKeeperUid === uid
    || (offering.offeredToKind === 'tree' && [...(myTrees || []), ...(tendedTrees || []).map(x => x.tree)].some(tr => tr.id === offering.offeredToId))
  );
  const lifecycle = { authorId: offering.authorId, offeredToKind: offering.offeredToKind, offeringStatus: status };
  const mayAnswer = canAnswerOffering(lifecycle, uid, standsForReceiver);
  const mayWithdraw = canWithdrawOffering(lifecycle, uid);

  const answer = async (what: 'accept' | 'decline' | 'withdraw') => {
    if (busy) return;
    setBusy(true);
    try {
      if (what === 'accept') { await acceptOffering(offering.id); setStatus('accepted'); onUpdate?.({ offeringStatus: 'accepted' }); notify(t('offer_accepted_toast')); }
      else if (what === 'decline') { await declineOffering(offering.id, uid); setStatus('declined'); onUpdate?.({ offeringStatus: 'declined' }); notify(t('offer_declined_toast')); }
      else { await withdrawOffering(offering.id); setStatus('withdrawn'); onUpdate?.({ offeringStatus: 'withdrawn' }); notify(t('offer_withdrawn_toast')); }
    } catch (err: any) {
      showAlert(err?.message || 'err_offering_change');
    }
    setConfirming(false);
    setBusy(false);
  };

  const statusTone = { open: 'bg-amber-50 text-amber-700', accepted: 'bg-emerald-50 text-emerald-700', withdrawn: 'bg-slate-100 text-slate-500', declined: 'bg-slate-100 text-slate-500' } as const;
  // The offered-to card: visible in every section (BeingProfile's banner seat).
  const careBanner = status ? (
    <div className="mx-auto mb-4 max-w-2xl rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('offering_offered_to')}</div>
          <p dir="auto" className="truncate text-sm font-semibold text-slate-800">{offering.offeredToName || (offering.offeredToKind === 'vision' ? 'a vision' : 'a tree')}</p>
          {offering.offeringFromTreeName && <p className="truncate text-xs text-slate-500">{t('offering_from')} {offering.offeringFromTreeName}</p>}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${statusTone[status]}`}>{t(`offering_status_${status}`)}</span>
      </div>
      {(mayAnswer || mayWithdraw) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          {mayAnswer && !confirming && (
            <>
              <button type="button" disabled={busy} onClick={() => setConfirming(true)}
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
                style={{ backgroundColor: tabTone('offerings') }}>
                <span className="[&>svg]:h-3.5 [&>svg]:w-3.5"><Icons.Sun /></span> {t('offer_accept')}
              </button>
              <button type="button" disabled={busy} onClick={() => answer('decline')}
                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50">
                {t('offer_decline')}
              </button>
            </>
          )}
          {mayAnswer && confirming && (
            <div className="flex w-full flex-wrap items-center gap-2">
              <p className="mr-auto text-xs font-medium text-slate-600">{t('offer_accept_q')}</p>
              <button type="button" disabled={busy} onClick={() => answer('accept')}
                className="rounded-full px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
                style={{ backgroundColor: tabTone('offerings') }}>
                {busy ? t('saving') : t('offer_accept_yes')}
              </button>
              <button type="button" disabled={busy} onClick={() => setConfirming(false)}
                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-50">
                {t('offer_accept_no')}
              </button>
            </div>
          )}
          {mayWithdraw && (
            <button type="button" disabled={busy} onClick={() => answer('withdraw')}
              className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50">
              {t('offer_withdraw')}
            </button>
          )}
        </div>
      )}
    </div>
  ) : null;
  const HEART = tabTone('offerings');
  const isBed = offering.offeringKind === 'bed';
  // The same face the card wears: the first of imageUrls, else the single imageUrl.
  const img = offering.imageUrls?.length ? offering.imageUrls[0] : (offering.imageUrl || '');

  const toggleActive = async () => {
    if (!isAuthor || busy) return;
    const next = !active;
    setBusy(true);
    try {
      await setOfferingActive(offering.id, next);
      setActive(next);
      onUpdate?.({ offeringActive: next });
      notify(next ? '🌿 The offering stands again.' : 'The offering rests.');
    } catch {
      showAlert('err_offering_change');
    }
    setBusy(false);
  };

  const createdLabel = offering.createdAt?.toDate
    ? offering.createdAt.toDate().toLocaleDateString()
    : '';

  const chainRoot = {
    imageUrl: img || null,
    name: offering.title,
    body: offering.content || offering.body || null,
    plantedLabel: `${createdLabel}${offering.authorName ? ` · by ${offering.authorName}` : ''}`,
    hash: offering.hash,
  };

  const sections: BeingSection[] = [
    {
      key: 'lifecycle', label: 'Lifecycle', icon: <Icons.Leaf />, render: () => (
        <ChainTree
          blocks={[]}
          loading={false}
          onViewPulse={() => {}}
          emptyText="The offering's lifecycle will grow here: stays, appreciations, renewals."
          root={chainRoot}
        />
      ),
    },
    {
      key: 'details', label: 'Details', icon: <Icons.Info />, render: () => (
        <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6">
          {(offering.content || offering.body) && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{t('the_offering')}</div>
              <p dir="auto" className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{offering.content || offering.body}</p>
            </div>
          )}

          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{t('offer_suggested')}</div>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-700">
              <span className="text-amber-500 [&>svg]:h-4 [&>svg]:w-4"><Icons.Sun /></span>
              {formatLight(offering.offeringAppreciationLight || 0)}
              <span className="text-xs text-slate-400">· after receiving, never a condition</span>
            </p>
          </div>

          {offering.offeringBedName && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-slate-400">The bed</div>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-700">
                <span className="text-indigo-400 [&>svg]:h-4 [&>svg]:w-4"><Icons.Moon /></span>
                {offering.offeringBedName}
              </p>
            </div>
          )}

          {offering.offeringUrl && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-slate-400">More detail</div>
              <a href={offering.offeringUrl} target="_blank" rel="noopener noreferrer"
                className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100">
                <span className="[&>svg]:h-3.5 [&>svg]:w-3.5"><Icons.Globe /></span>
                <span className="truncate">{offering.offeringUrl.replace(/^https?:\/\//, '')}</span>
              </a>
            </div>
          )}

          {offering.authorName && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Offered by</div>
              <p className="mt-1 flex items-center gap-2 text-sm text-slate-700">
                {offering.authorPhoto
                  ? <img src={offering.authorPhoto} alt="" className="h-6 w-6 rounded-full object-cover" referrerPolicy="no-referrer" />
                  : <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 [&>svg]:h-3.5 [&>svg]:w-3.5"><Icons.Tree /></span>}
                {offering.authorName}
              </p>
            </div>
          )}

          {isAuthor && (
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">{active ? 'Standing' : 'Resting'}</p>
                <p className="text-xs text-slate-500">{active ? 'Others can find this offering in the feed.' : 'Paused: only you see it, its history stays.'}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={active}
                disabled={busy}
                onClick={toggleActive}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-50 ${active ? 'bg-emerald-500' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${active ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <BeingProfile
      className="min-h-screen animate-in fade-in zoom-in-95 duration-300"
      onClose={onClose}
      banner={careBanner}
      backLabel="Back"
      hero={{
        imageUrl: img,
        avatar: (
          <div className="relative">
            {img
              ? <img src={img} alt={offering.title} className="h-16 w-16 rounded-full border-4 border-white bg-white object-cover shadow-xl md:h-24 md:w-24" />
              : <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white text-white shadow-xl md:h-24 md:w-24 [&>svg]:h-8 [&>svg]:w-8" style={{ backgroundColor: HEART }}>{isBed ? <Icons.Moon /> : <Icons.Drop />}</div>}
          </div>
        ),
        title: offering.title,
        subtitle: <p className="mt-1 text-sm text-white/60">{isBed ? 'A bed offered through trust' : 'A service offered through trust'}</p>,
        chips: (
          <>
            <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white" style={{ backgroundColor: HEART }}>
              {isBed ? 'Bed' : 'Service'}
            </span>
            {!active && (
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/80">Resting</span>
            )}
            {!!offering.offeringAppreciationLight && (
              <span title="Suggested appreciation after receiving this offering" className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-amber-950">
                <span className="[&>svg]:h-2.5 [&>svg]:w-2.5"><Icons.Sun /></span> {formatLight(offering.offeringAppreciationLight)}
              </span>
            )}
            {isAuthor && onEdit && (
              <button type="button" onClick={onEdit}
                className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-white/25">
                <span className="[&>svg]:h-3 [&>svg]:w-3"><Icons.Pencil /></span> Edit
              </button>
            )}
            <BeingQr lid={offering.lid} name={offering.title} savedHref={offering.qr?.href} canMint={isAuthor}
              onMint={(href) => mintBeingQr('pulses', offering.id, href)} className="text-white/70" />
            <LoveButton collection="pulses" id={offering.id} initialCount={offering.loveCount || 0} className="rounded-full bg-white/15 px-2 py-0.5 text-white hover:bg-white/25" />
          </>
        ),
      }}
      sections={sections}
    />
  );
};
