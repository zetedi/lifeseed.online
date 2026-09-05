import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from '../ui/Icons';
import { setNewsletterSubscription, updateUserProfile, setOnlyValidatedCanReach, deleteUserAccount, logout, fetchAllLifetrees, exportPerson } from '../../services/firebase';
import { fetchMyRays } from '../../services/firebase/light';
import type { Lifetree } from '../../types';
import { isLightPathOn, setLightPathOn } from '../PathwayCTA';
import { SectionTitle } from '../ui/SectionTitle';
import { Modal } from '../ui/Modal';
import { SigningKeyModal } from '../modals/SigningKeyModal';
import { speak } from '../../utils/translations';

import { Picture } from '../ui/Picture';
// Module-scope (not created during render) so React keeps the DOM node between renders.
const Toggle = ({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    onClick={onClick}
    disabled={disabled}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-50 ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}
  >
    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${on ? 'translate-x-5' : 'translate-x-0'}`} />
  </button>
);

interface ProfileSettingsProps {
  uid: string;
  email: string | null;
  // The toggle values live in the shell, where the live profile listener writes them;
  // the change callbacks reflect a successful save back into that shared state.
  onlyValidatedCanReach: boolean;
  onOnlyValidatedChange: (value: boolean) => void;
  newsletterSubscribed: boolean;
  onNewsletterChange: (value: boolean) => void;
  dmEmailNotifications: boolean;
  onDmEmailChange: (value: boolean) => void;
  // Surfaces notices via the shell's shared dialog modal.
  notify: (message: string) => void;
}

// Settings tab — contact privacy, newsletter and email-notification toggles, account deletion.
export const ProfileSettings: React.FC<ProfileSettingsProps> = ({
  uid,
  email,
  onlyValidatedCanReach,
  onOnlyValidatedChange,
  newsletterSubscribed,
  onNewsletterChange,
  dmEmailNotifications,
  onDmEmailChange,
  notify,
}) => {
  const { t } = useLanguage();
  const [togglingNewsletter, setTogglingNewsletter] = useState(false);
  const [togglingDmEmail, setTogglingDmEmail] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [togglingValidatedReach, setTogglingValidatedReach] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSigningKey, setShowSigningKey] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // THE LAST SPEND (ring 2026-07-21): if the being holds light, the delete door offers an heir.
  // The heir is chosen AS A TREE (identity is the tree); their owner receives the light through
  // the prism. Left unchosen, the light dissolves into the communities' (or the node's) glow.
  const [lightUnits, setLightUnits] = useState<number | null>(null); // null = not yet known
  const [heirForest, setHeirForest] = useState<Lifetree[]>([]);
  const [heirQuery, setHeirQuery] = useState('');
  const [heirTree, setHeirTree] = useState<Lifetree | null>(null);
  useEffect(() => {
    if (!showDeleteConfirm) return;
    let alive = true;
    fetchMyRays(uid)
      .then(rays => { if (alive) setLightUnits(rays.reduce((sum, r) => sum + r.units, 0)); })
      .catch(() => { if (alive) setLightUnits(0); });
    fetchAllLifetrees(undefined, undefined, ['public', 'node'])
      .then(f => { if (alive) setHeirForest(f.filter(tr => tr.ownerId && tr.ownerId !== uid)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [showDeleteConfirm, uid]);
  const heirMatches = heirQuery.trim().length >= 2
    ? heirForest.filter(tr => tr.name?.toLowerCase().includes(heirQuery.trim().toLowerCase())).slice(0, 5)
    : [];
  const [lightPathOn, setLightPathOnState] = useState(isLightPathOn);

  const handleLightPathToggle = () => {
    const next = !lightPathOn;
    setLightPathOn(next); // persists + clears dismissals when turning on
    setLightPathOnState(next);
    notify(next ? 'The Light Path is lit. You will find it on your home page.' : 'The Light Path is off.');
  };

  const handleNewsletterToggle = async () => {
    if (!email || togglingNewsletter) return;
    setTogglingNewsletter(true);
    try {
      const nextValue = !newsletterSubscribed;
      await setNewsletterSubscription(uid, email, nextValue);
      onNewsletterChange(nextValue);
      notify(nextValue ? 'Newsletter subscribed.' : 'Newsletter unsubscribed.');
    } catch (e: any) {
      notify(e.message || 'Failed to update newsletter preference.');
    }
    setTogglingNewsletter(false);
  };

  const handleDmEmailToggle = async () => {
    if (togglingDmEmail) return;
    setTogglingDmEmail(true);
    try {
      const nextValue = !dmEmailNotifications;
      await updateUserProfile(uid, { emailNotifications: { directMessages: nextValue } });
      onDmEmailChange(nextValue);
      notify(nextValue
        ? 'You will be emailed when someone sends you a direct message.'
        : 'Direct message email notifications turned off.');
    } catch (e: any) {
      notify(e.message || 'Failed to update email notification preference.');
    }
    setTogglingDmEmail(false);
  };

  const handleOnlyValidatedToggle = async () => {
    if (togglingValidatedReach) return;
    setTogglingValidatedReach(true);
    try {
      const nextValue = !onlyValidatedCanReach;
      await setOnlyValidatedCanReach(uid, nextValue);
      onOnlyValidatedChange(nextValue);
      notify(nextValue
        ? 'Only validated trees can now send you direct messages.'
        : 'Anyone can now send you direct messages.');
    } catch (e: any) {
      notify(e.message || 'Failed to update contact privacy.');
    }
    setTogglingValidatedReach(false);
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await deleteUserAccount(heirTree?.ownerId);
      await logout();
      notify(t('delete_goodbye'));
      window.location.reload();
    } catch (e: any) {
      console.error('Delete Account Error:', e);
      if (e.message && (e.message.includes('log out') || e.message.includes('recent-login'))) {
        notify(speak('security_reauth'));
        await logout();
        window.location.reload();
        return;
      }
      notify(e.message);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div>
      <SectionTitle title={t('settings_title')} sub={t('settings_sub')} />
      <div className="rounded-2xl border border-slate-100 divide-y divide-slate-100">
        <div className="p-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 text-sm">{t('only_validated_can_reach')}</p>
            <p className="text-xs text-slate-500">{t('only_validated_can_reach_help')}</p>
          </div>
          <Toggle on={onlyValidatedCanReach} onClick={handleOnlyValidatedToggle} disabled={togglingValidatedReach} />
        </div>
        <div className="p-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 text-sm">{t('newsletter')}</p>
            <p className="text-xs text-slate-500">A gentle update from the network every few weeks.</p>
          </div>
          <Toggle on={newsletterSubscribed} onClick={handleNewsletterToggle} disabled={togglingNewsletter || !email} />
        </div>
        <div className="p-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 text-sm">{t('dm_email_toggle')}</p>
            <p className="text-xs text-slate-500">{t('toggle_anytime')}</p>
          </div>
          <Toggle on={dmEmailNotifications} onClick={handleDmEmailToggle} disabled={togglingDmEmail || !email} />
        </div>
        <div className="p-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 text-sm">Light Path {lightPathOn ? <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">on</span> : <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">off</span>}</p>
            <p className="text-xs text-slate-500">{t('lightpath_note')}</p>
          </div>
          <Toggle on={lightPathOn} onClick={handleLightPathToggle} />
        </div>
        <div className="p-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 text-sm">{t('signing_key')}</p>
            <p className="text-xs text-slate-500">{t('signing_key_help')}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowSigningKey(true)}
            className="rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold px-4 py-2 transition-colors whitespace-nowrap"
          >
            {t('edit')}
          </button>
        </div>
      </div>
      {/* The export ceremony (domain/export): what the privacy words promise, made real —
          a ZIP of this being's records, chains and images, gathered with their own sight. */}
      <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-emerald-800 text-sm">{t('export_my_data')}</p>
          <p className="text-xs text-emerald-700/70">{t('export_my_data_note')}</p>
        </div>
        <button onClick={async () => {
          if (exporting) return;
          setExporting(true);
          try { await exportPerson(uid); notify(t('export_ready')); }
          catch { notify(t('err_export')); }
          setExporting(false);
        }} disabled={exporting} className="rounded-full border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-600 hover:text-white text-xs font-bold px-4 py-2 transition-colors whitespace-nowrap self-start sm:self-auto disabled:opacity-50">
          {exporting ? t('exporting') : t('export')}
        </button>
      </div>
      <div className="mt-6 rounded-2xl border border-red-100 bg-red-50/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-red-700 text-sm">{t('delete_account')}</p>
          <p className="text-xs text-red-500/80">{t('delete_account_note')}</p>
        </div>
        <button onClick={() => { setHeirTree(null); setHeirQuery(''); setLightUnits(null); setShowDeleteConfirm(true); }} className="rounded-full border border-red-200 bg-white text-red-600 hover:bg-red-600 hover:text-white text-xs font-bold px-4 py-2 transition-colors whitespace-nowrap self-start sm:self-auto">{t('delete_account')}</button>
      </div>

      {showSigningKey && <SigningKeyModal uid={uid} notify={notify} onClose={() => setShowSigningKey(false)} />}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <Modal title={t('delete_confirm_title')} onClose={() => setShowDeleteConfirm(false)}>
          <div className="space-y-6">
            <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-red-800 text-sm">
              <p className="font-bold mb-1">{t('delete_confirm_desc')}</p>
            </div>

            {/* The last spend — shown only when there is light to pass on. */}
            {lightUnits !== null && lightUnits > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-bold text-amber-900">You hold {lightUnits} units of light.</p>
                <p className="mt-1 text-xs leading-relaxed text-amber-800/90">
                  Leaving is the last spend. Name an heir below and your light passes to them
                  (a seventh dissolves into the commons on the way). Name no one and it dissolves
                  into your communities&apos; glow, or the node&apos;s.
                </p>
                {heirTree ? (
                  <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2">
                    <span className="min-w-0 truncate text-sm text-amber-900">
                      Your light goes to <span className="font-bold">{heirTree.name}</span>&apos;s keeper.
                    </span>
                    <button type="button" onClick={() => setHeirTree(null)} className="shrink-0 text-xs font-bold text-amber-700 underline">{t('change')}</button>
                  </div>
                ) : (
                  <div className="mt-3">
                    <input
                      value={heirQuery}
                      onChange={e => setHeirQuery(e.target.value)}
                      placeholder={t('heir_ph')}
                      className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-amber-400"
                    />
                    {heirMatches.length > 0 && (
                      <div className="mt-1 overflow-hidden rounded-lg border border-amber-100 bg-white">
                        {heirMatches.map(tr => (
                          <button
                            key={tr.id}
                            type="button"
                            onClick={() => { setHeirTree(tr); setHeirQuery(''); }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-amber-50"
                          >
                            {(tr.latestGrowthUrl || tr.imageUrl)
                              ? <Picture size={480} src={tr.latestGrowthUrl || tr.imageUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                              : <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><Icons.Tree /></span>}
                            <span className="truncate">{tr.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* The exit stays easy (GDPR is a promise, not a maze): the red act keeps the room
                and a clear margin on phones; Cancel is present but modest, never half the sheet. */}
            <div className="flex items-stretch gap-3 pt-1">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="shrink-0 bg-slate-100 hover:bg-slate-200 text-slate-600 px-5 py-3 rounded-xl text-sm font-bold transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="flex-1 min-w-0 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-xl text-sm font-bold shadow-lg shadow-red-200 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? <div className="w-4 h-4 shrink-0 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4"><Icons.Trash /></span>}
                <span className="truncate">{t('delete_account')}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
