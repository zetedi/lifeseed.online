import React, { useCallback, useEffect, useState } from 'react';
import { useSession } from '../../contexts/SessionContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { showConfirm, showAlert } from '../ui/Dialog';
import { Icons } from '../ui/Icons';
import { BeingQr } from '../ui/BeingQr';
import { LoveButton } from '../ui/LoveButton';
import { mintBeingQr } from '../../services/firebase/beings';
import { ValidationBadge } from '../ValidationBadge';
import { BeingProfile, type BeingSection } from '../BeingProfile';
import { ChainTree } from '../sections/ChainTree';
import { TreeCircle } from '../lifetree/TreeCircle';
import { BedCalendar } from './BedCalendar';
import { getPulsesByTreeId, getLightHouseById, updateLifetree, deleteLifetree } from '../../services/firebase';
import { firestoreStore } from '../../adapters/firestore';
import { treeCircle } from '../../domain/views/circle';
import { isHousedBed } from '../../domain/bed';
import { type Pulse, type Lifetree } from '../../types';
import { spokenLine } from '../../utils/translations';

import { Picture } from '../ui/Picture';
// The bed's own profile — a bed IS a Lifetree, so it wears the same face (BeingProfile) and the
// same chain (ChainTree, each stay a leaf). What's its own: a HOUSED/LOOSE pill, a calendar of
// nights, and a details card with no tree machinery (no domain, no convert, no steward).

interface BedProfileProps {
  bed: Lifetree;
  onClose: () => void;
  onViewTree?: (t: Lifetree) => void;
  onViewPulse?: (p: Pulse) => void;
  onUpdate?: (u: Partial<Lifetree>) => void;
  onDelete?: () => void;
}

const VIS: Array<Lifetree['visibility']> = ['public', 'node', 'private'];

export const BedProfile: React.FC<BedProfileProps> = ({ bed, onClose, onViewTree, onViewPulse, onUpdate, onDelete }) => {
  const { t } = useLanguage();
  const { lightseed } = useSession();
  const uid = lightseed?.uid;
  const isOwner = !!uid && bed.ownerId === uid;

  const [genesisBlock, setGenesisBlock] = useState<Pulse | null>(null);
  const [blocks, setBlocks] = useState<Pulse[]>([]);
  const [loadingChain, setLoadingChain] = useState(true);
  const [houseName, setHouseName] = useState('');
  const [vis, setVis] = useState<Lifetree['visibility']>(bed.visibility || 'node');
  const [busy, setBusy] = useState(false);

  // The bed's circle (its carers/guardians) — a prism over its incoming links, re-read when the
  // guardian toggle fires. A bed is a Lifetree, so it wears the same Circle view as a tree.
  const [circleNonce, setCircleNonce] = useState(0);
  const [circle, setCircle] = useState<ReturnType<typeof treeCircle>>({ groups: [], size: 0 });
  useEffect(() => {
    let alive = true;
    firestoreStore.linksTo(bed.id).then(links => { if (alive) setCircle(treeCircle(bed.ownerId, links)); }).catch(() => {});
    return () => { alive = false; };
  }, [bed.id, bed.ownerId, circleNonce]);

  const loadChain = useCallback(() => {
    setLoadingChain(true);
    getPulsesByTreeId(bed.id).then(pulses => {
      const isGen = (p: Pulse) => p.previousHash === '0' || p.title === 'Genesis Pulse';
      setGenesisBlock(pulses.find(isGen) || null);
      setBlocks(pulses.filter(p => !isGen(p)));
    }).finally(() => setLoadingChain(false));
  }, [bed.id]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- async chain fetch kickoff, re-runs per bed
  useEffect(() => { loadChain(); }, [loadChain]);

  useEffect(() => {
    let alive = true;
    if (bed.lightHouseId) getLightHouseById(bed.lightHouseId).then(h => { if (alive) setHouseName(h?.name || ''); }).catch(() => {});
    return () => { alive = false; };
  }, [bed.lightHouseId]);

  const heroImg = bed.latestGrowthUrl || bed.imageUrl || '';
  const housed = isHousedBed(bed);

  const chainRoot = {
    imageUrl: bed.imageUrl,
    name: bed.name,
    body: bed.body,
    plantedLabel: `${bed.createdAt?.toDate ? bed.createdAt.toDate().toLocaleDateString() : (bed.createdAt ? new Date((bed.createdAt?.toMillis?.() ?? bed.createdAt) as unknown as string | number).toLocaleDateString() : '')}${bed.locationName ? ` · ${bed.locationName}` : ''}`,
    hash: bed.genesisHash,
  };

  const changeVisibility = async (next: Lifetree['visibility']) => {
    setVis(next);
    try {
      await updateLifetree(bed.id, { visibility: next });
      onUpdate?.({ visibility: next });
    } catch {
      showAlert('err_visibility');
    }
  };

  const remove = async () => {
    if (!(await showConfirm(spokenLine('bed_release_confirm', { name: bed.name || '' }), { title: 'bed_release', confirmText: 'release', danger: true }))) return;
    setBusy(true);
    try {
      await deleteLifetree(bed.id);
      onDelete?.();
      onClose();
    } catch {
      showAlert('err_bed_release');
      setBusy(false);
    }
  };

  const sections: BeingSection[] = [
    {
      key: 'calendar', label: 'Calendar', icon: <Icons.Moon />, render: () => (
        <BedCalendar bed={bed} onViewTree={onViewTree} />
      ),
    },
    {
      key: 'leaves', label: t('who_stayed'), icon: <Icons.Leaf />, render: () => (
        <ChainTree
          genesisBlock={genesisBlock}
          blocks={blocks}
          loading={loadingChain}
          onViewPulse={onViewPulse ?? (() => {})}
          canCare={false}
          onCare={() => {}}
          root={chainRoot}
          stats={{ blockHeight: bed.blockHeight, genesisHash: bed.genesisHash, latestHash: bed.latestHash }}
        />
      ),
    },
    {
      key: 'carers', label: 'Circle', icon: <Icons.Venn />, render: () => (
        <TreeCircle
          tree={bed}
          currentUserId={uid}
          circle={circle}
          growthBlocks={blocks}
          canEdit={false}
          canInviteRoles={false}
          canWitness={false}
          status={bed.status || 'HEALTHY'}
          busy={false}
          onToggleDanger={() => {}}
          onGuardianChange={() => setCircleNonce(n => n + 1)}
          onChainRefresh={loadChain}
        />
      ),
    },
    {
      key: 'details', label: t('bed_details'), icon: <Icons.Info />, render: () => (
        <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{t('location')}</div>
            <div className="mt-1 flex items-center gap-2 text-sm text-slate-700">
              <span className="text-slate-400 [&>svg]:h-4 [&>svg]:w-4">{housed ? <Icons.Building /> : <Icons.Moon />}</span>
              {housed
                ? <span>{t('housed')}: {houseName || 'a Light House'}</span>
                : <span>{t('loose')}{bed.locationName ? `: ${bed.locationName}` : bed.latitude != null ? `: ${bed.latitude.toFixed(3)}, ${bed.longitude?.toFixed(3)}` : ''}</span>}
            </div>
          </div>
          {bed.body && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{t('body')}</div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{bed.body}</p>
            </div>
          )}
          {isOwner && (
            <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
              <label className="text-xs font-bold uppercase tracking-wide text-slate-400">{t('visibility')}</label>
              <select value={vis} onChange={e => changeVisibility(e.target.value as Lifetree['visibility'])}
                className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-700">
                {VIS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <button type="button" onClick={remove} disabled={busy}
                className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100 disabled:opacity-50">
                <span className="[&>svg]:h-3.5 [&>svg]:w-3.5"><Icons.Trash /></span>Release
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
      backLabel={t('back_forest')}
      hero={{
        imageUrl: heroImg,
        avatar: (
          <div className="relative">
            {heroImg
              ? <Picture size={480} src={heroImg} alt={bed.name} className="h-16 w-16 rounded-full border-4 border-white bg-white object-cover shadow-xl md:h-24 md:w-24" />
              : <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-indigo-400 to-violet-500 text-white shadow-xl md:h-24 md:w-24 [&>svg]:h-8 [&>svg]:w-8"><Icons.Moon /></div>}
            {bed.validated && <div className="absolute -bottom-1 -right-1"><ValidationBadge compact /></div>}
          </div>
        ),
        title: bed.name,
        subtitle: <p className="mt-1 text-sm text-white/60">{t('a_place_to_sleep')}</p>,
        chips: (
          <>
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${housed ? 'bg-amber-400/20 text-amber-200' : 'bg-sky-400/20 text-sky-200'}`}>
              {housed ? t('housed') : t('loose')}
            </span>
            <BeingQr lid={bed.lid} name={bed.name} savedHref={bed.qr?.href} canMint={isOwner}
              onMint={(href) => mintBeingQr('lifetrees', bed.id, href)} className="text-white/70" />
            <LoveButton collection="lifetrees" id={bed.id} initialCount={bed.loveCount || 0} className="rounded-full bg-white/15 px-2 py-0.5 text-white hover:bg-white/25" />
          </>
        ),
      }}
      sections={sections}
    />
  );
};
