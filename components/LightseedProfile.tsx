
import React, { useState, useEffect } from 'react';
import { type Pulse, type Lifetree, type MatchProposal, type Vision, type VisionSynergy } from '../types';
import { getMyPulses, getMyVisions, getJoinedVisions, getMyMatchesHistory, deleteUserAccount, logout, triggerSystemEmail, monitorMailStatus, sendInvite, listenToUserProfile, deleteVision } from '../services/firebase';
import { findVisionSynergies } from '../services/gemini';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from './ui/Icons';
import { VisionCard } from './VisionCard';
import { Modal } from './ui/Modal';
import { Loading } from './ui/Loading';

export const LightseedProfile = ({ lightseed, myTrees, onViewTree, onDeleteTree, onViewVision, onPlant }: any) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'trees' | 'pulses' | 'visions' | 'history'>('trees');
    const [pulses, setPulses] = useState<Pulse[]>([]);
    const [visions, setVisions] = useState<Vision[]>([]);
    const [joinedVisions, setJoinedVisions] = useState<Vision[]>([]);
    const [history, setHistory] = useState<MatchProposal[]>([]);
    const [loading, setLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [sendingTest, setSendingTest] = useState(false);
    const [mailStatus, setMailStatus] = useState<string | null>(null);
    const [testEmailAddress, setTestEmailAddress] = useState('');
    
    // Invite System
    const [invitesRemaining, setInvitesRemaining] = useState(7);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteMessage, setInviteMessage] = useState('');
    const [sendingInvite, setSendingInvite] = useState(false);

    // AI Matchmaking State
    const [synergies, setSynergies] = useState<VisionSynergy[]>([]);
    const [analyzing, setAnalyzing] = useState(false);

    const hasValidatedTree = myTrees.some((t: Lifetree) => t.validated);
    const allValidated = myTrees.length > 0 && myTrees.every((t: Lifetree) => t.validated);
    const inviteLink = `${window.location.origin}?invite=${lightseed.uid}`;

    useEffect(() => {
        if (!lightseed) return;
        
        // Listen to live user profile for invites
        const unsub = listenToUserProfile(lightseed.uid, (data) => {
            if (data && typeof data.invitesRemaining === 'number') {
                setInvitesRemaining(data.invitesRemaining);
            }
        });

        const fetchData = async () => {
            setLoading(true);
            try {
                if (activeTab === 'pulses') {
                    const data = await getMyPulses(lightseed.uid);
                    setPulses(data);
                } else if (activeTab === 'visions') {
                    const [created, joined] = await Promise.all([
                        getMyVisions(lightseed.uid),
                        getJoinedVisions(lightseed.uid)
                    ]);
                    setVisions(created);
                    setJoinedVisions(joined);
                } else if (activeTab === 'history') {
                    const data = await getMyMatchesHistory(lightseed.uid);
                    setHistory(data);
                }
            } catch (e) {
                console.error("Fetch profile data error", e);
            }
            setLoading(false);
        };
        fetchData();
        return () => unsub();
    }, [activeTab, lightseed]);

    const handleMatchmaking = async () => {
        if (visions.length < 2) {
             const data = await getMyVisions(lightseed.uid);
             if (data.length < 2) {
                 alert("You need at least 2 visions to find synergies.");
                 return;
             }
             setVisions(data);
             performAnalysis(data);
        } else {
            performAnalysis(visions);
        }
    }

    const performAnalysis = async (vs: Vision[]) => {
        setAnalyzing(true);
        setSynergies([]);
        try {
            const results = await findVisionSynergies(vs);
            setSynergies(results);
        } catch (e: any) {
            console.error("AI Analysis Error:", e);
            alert("Analysis failed: " + e.message);
        }
        setAnalyzing(false);
    }

    const copyInvite = () => {
        navigator.clipboard.writeText(inviteLink);
        alert("Invite link copied to clipboard!");
    }

    const handleSendInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail) return;
        setSendingInvite(true);
        try {
            await sendInvite(inviteEmail, inviteMessage, lightseed.uid, inviteLink);
            alert(t('invite_sent'));
            setShowInviteModal(false);
            setInviteEmail('');
            setInviteMessage('');
        } catch (e: any) {
            alert(e.message || "Failed to send invite");
        }
        setSendingInvite(false);
    }

    const handleDeleteVision = async (e: React.MouseEvent, visionId: string) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this vision?")) return;
        try {
            await deleteVision(visionId);
            setVisions(prev => prev.filter(v => v.id !== visionId));
        } catch (e: any) {
            alert("Delete failed: " + e.message);
        }
    }

    const handleTestEmail = async () => {
        const targetEmail = prompt("Enter the email address to send test to:", lightseed.email);
        if (!targetEmail) return;

        setTestEmailAddress(targetEmail);
        setSendingTest(true);
        setMailStatus("SENDING...");
        
        try {
            const docRef = await triggerSystemEmail(
                targetEmail,
                "Debug Test: lightseed Network",
                `This is a test email sent at ${new Date().toLocaleTimeString()} to verify the SMTP pipeline. If you see this, the system is working.`,
                lightseed.uid 
            );
            
            setMailStatus("QUEUED");
            
            const timeoutCheck = setTimeout(() => {
                setMailStatus((current) => {
                    if (current === "QUEUED") {
                        alert("The email is in the DB, but the Extension didn't send it.");
                        return "TIMEOUT: Check Extension Config";
                    }
                    return current;
                });
            }, 10000);

            const unsubscribe = monitorMailStatus(docRef.id, (deliveryStatus: any) => {
                clearTimeout(timeoutCheck);
                if (deliveryStatus) {
                    if (deliveryStatus.state === 'SUCCESS') {
                        setMailStatus(`SUCCESS! Sent to ${targetEmail}`);
                        setTimeout(() => { setSendingTest(false); setMailStatus(null); unsubscribe(); }, 5000);
                    } else if (deliveryStatus.state === 'ERROR') {
                        setMailStatus(`ERROR: ${deliveryStatus.error}`);
                    } else {
                        setMailStatus(`STATUS: ${deliveryStatus.state}`);
                    }
                }
            });

        } catch (e: any) {
            alert("Failed to write to database: " + e.message);
            setSendingTest(false);
            setMailStatus(null);
        }
    }

    const handleDeleteAccount = async () => {
        setIsDeleting(true);
        try {
            await deleteUserAccount();
            await logout();
            alert(t('delete_goodbye'));
            window.location.reload();
        } catch (e: any) {
            console.error("Delete Account Error:", e);
            if (e.message && (e.message.includes("log out") || e.message.includes("recent-login"))) {
                alert("Security Check: Please sign in again to confirm deletion.");
                await logout();
                window.location.reload();
                return;
            }
            alert(e.message);
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    }

    if (!lightseed) return null;

    return (
        <div className="min-h-screen">
            <div className="relative bg-gradient-to-b from-slate-800 to-slate-900 text-white pb-10 pt-10 px-4">
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-8">
                    <div className="relative">
                        <img 
                            src={lightseed.photoURL || `https://ui-avatars.com/api/?name=${lightseed.displayName}`} 
                            className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-white shadow-xl bg-white object-cover"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.onerror = null;
                                target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(lightseed.displayName || 'User')}&background=random&color=fff`;
                            }}
                        />
                        <div className="absolute bottom-1 right-1 bg-emerald-500 w-6 h-6 rounded-full border-4 border-slate-900"></div>
                    </div>
                    <div className="text-center md:text-left flex-1">
                        <h1 className="text-3xl font-light tracking-wide">{lightseed.displayName}</h1>
                        <p className="text-slate-400 text-sm font-mono mt-1">{lightseed.email}</p>
                        
                        <div className="flex flex-col md:flex-row items-center md:items-start gap-4 mt-4">
                            <div className="text-center md:text-left">
                                <span className="block text-2xl font-bold">{myTrees.length}</span>
                                <span className="text-xs text-slate-400 uppercase tracking-wider">{t('my_trees')}</span>
                            </div>

                            <div className="flex flex-wrap items-center justify-center gap-3">
                                {allValidated && (
                                    <button onClick={onPlant} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg transition-transform active:scale-95 flex items-center space-x-2">
                                        <Icons.Tree />
                                        <span>Create Tree</span>
                                    </button>
                                )}
                                
                                <button 
                                    onClick={handleTestEmail} 
                                    disabled={sendingTest && mailStatus?.includes("SUCCESS")}
                                    className={`px-3 py-2 rounded-full text-xs font-bold transition-colors flex items-center space-x-1 border ${mailStatus?.includes('ERROR') || mailStatus?.includes('TIMEOUT') ? 'bg-red-900 border-red-700 text-red-200' : 'bg-sky-700 hover:bg-sky-600 border-sky-600 text-sky-100'}`}
                                >
                                    <Icons.Send />
                                    <span>{mailStatus || "Test Email"}</span>
                                </button>

                                <button onClick={() => setShowDeleteConfirm(true)} className="bg-slate-700 hover:bg-red-900/50 text-slate-300 hover:text-red-200 px-3 py-2 rounded-full text-xs font-bold transition-colors flex items-center space-x-1 border border-slate-600 hover:border-red-800">
                                    <Icons.Trash />
                                    <span>{t('delete_account')}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {hasValidatedTree && (
                    <div className="max-w-4xl mx-auto mt-8 bg-slate-700/50 backdrop-blur border border-slate-600 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center space-x-3">
                            <div className="bg-emerald-500 p-2 rounded-full shrink-0">
                                <Icons.ShieldCheck />
                            </div>
                            <div className="text-center sm:text-left">
                                <h4 className="font-bold text-emerald-400">Contributor Access Unlocked</h4>
                                <p className="text-xs text-slate-300">You are a validated node in the .seed network.</p>
                            </div>
                        </div>
                        <a 
                            href="https://github.com/zetedi/lifeseed.online" 
                            target="_blank" 
                            rel="noreferrer" 
                            className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm font-mono transition-colors border border-white/10 flex items-center space-x-2 whitespace-nowrap"
                        >
                            <span>zetedi/lifeseed.online</span>
                            <Icons.Link />
                        </a>
                    </div>
                )}
            </div>

            <div className="max-w-4xl mx-auto px-4 mt-8">
                {myTrees.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
                                <Icons.SparkleFill /> {t('invitations')}
                            </h3>
                            <p className="text-sm text-slate-500">{t('invites_remaining')}: <span className="font-bold text-emerald-600">{invitesRemaining}</span></p>
                        </div>
                        <div className="flex w-full md:w-auto gap-2">
                            <input readOnly value={inviteLink} className="flex-1 border border-slate-200 rounded px-3 py-2 text-xs bg-slate-50 text-slate-500 w-full md:w-64" />
                            <button onClick={copyInvite} className="bg-slate-200 text-slate-700 px-4 py-2 rounded font-bold text-xs hover:bg-slate-300 transition-colors whitespace-nowrap">
                                {t('copy_invite')}
                            </button>
                            <button onClick={() => setShowInviteModal(true)} disabled={invitesRemaining <= 0} className="bg-emerald-600 text-white px-4 py-2 rounded font-bold text-xs hover:bg-emerald-700 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed">
                                {t('send_invite')}
                            </button>
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden min-h-[500px] mb-20">
                    <div className="flex border-b border-slate-100 overflow-x-auto">
                        <button 
                            onClick={() => setActiveTab('trees')} 
                            className={`flex-1 min-w-[100px] py-4 text-sm font-medium transition-colors ${activeTab === 'trees' ? 'text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50/50' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            {t('my_trees')}
                        </button>
                        <button 
                            onClick={() => setActiveTab('pulses')} 
                            className={`flex-1 min-w-[100px] py-4 text-sm font-medium transition-colors ${activeTab === 'pulses' ? 'text-sky-600 border-b-2 border-sky-500 bg-sky-50/50' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            {t('my_pulses')}
                        </button>
                        <button 
                            onClick={() => setActiveTab('visions')} 
                            className={`flex-1 min-w-[100px] py-4 text-sm font-medium transition-colors ${activeTab === 'visions' ? 'text-amber-600 border-b-2 border-amber-500 bg-amber-50/50' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            {t('visions')}
                        </button>
                        <button 
                            onClick={() => setActiveTab('history')} 
                            className={`flex-1 min-w-[100px] py-4 text-sm font-medium transition-colors ${activeTab === 'history' ? 'text-slate-600 border-b-2 border-slate-500 bg-slate-50/50' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            {t('my_matches')}
                        </button>
                    </div>

                    <div className="p-6">
                        {activeTab === 'trees' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {allValidated && (
                                     <div onClick={onPlant} className="border-2 border-dashed border-slate-300 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-slate-50 min-h-[100px] text-slate-400 hover:text-emerald-600 transition-all group">
                                        <div className="bg-slate-100 p-3 rounded-full group-hover:bg-emerald-100 transition-colors">
                                             <Icons.Tree />
                                        </div>
                                        <span className="font-bold mt-2 text-sm">Plant New Tree</span>
                                    </div>
                                )}

                                {myTrees.length === 0 ? (
                                    !allValidated && <p className="text-slate-400 text-center py-10 col-span-full">No trees planted yet.</p>
                                ) : (
                                    myTrees.map((tree: Lifetree) => (
                                        <div key={tree.id} onClick={() => onViewTree(tree)} className="border border-slate-200 rounded-lg p-4 hover:shadow-md cursor-pointer transition-all flex items-center justify-between group bg-white">
                                            <div className="flex items-center space-x-4">
                                                <img src={tree.imageUrl || 'https://via.placeholder.com/100'} className="w-16 h-16 rounded object-cover bg-slate-100" />
                                                <div>
                                                    <h3 className="font-bold text-slate-800">{tree.name}</h3>
                                                    <p className="text-xs text-slate-500">Block Height: {tree.blockHeight}</p>
                                                    {tree.validated ? (
                                                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">VALIDATED</span>
                                                    ) : (
                                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Pending</span>
                                                    )}
                                                </div>
                                            </div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onDeleteTree(tree.id); }} 
                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                                title="Delete Tree"
                                            >
                                                <Icons.Trash />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                        {activeTab === 'pulses' && (
                            loading ? <div className="flex justify-center py-10"><Loading /></div> : (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {pulses.length === 0 ? <p className="col-span-full text-slate-400 text-center py-10">No pulses emitted yet.</p> : pulses.map((pulse) => (
                                        <div key={pulse.id} className="border border-slate-100 rounded-lg overflow-hidden group">
                                            <div className="h-24 bg-slate-100 relative">
                                                {pulse.imageUrl ? (
                                                    <img src={pulse.imageUrl} className="w-full h-full object-cover" />
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
                            )
                        )}
                         {activeTab === 'visions' && (
                             loading ? <div className="flex justify-center py-10"><Loading /></div> : (
                                <div>
                                    <div className="flex justify-between items-center mb-6">
                                         <h3 className="text-lg font-bold">My Visions</h3>
                                         <button 
                                            onClick={handleMatchmaking}
                                            disabled={analyzing}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center space-x-2 transition-colors disabled:opacity-50"
                                         >
                                             {analyzing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Icons.Sparkles />}
                                             <span>AI Matchmaking</span>
                                         </button>
                                    </div>
                                    
                                    {synergies.length > 0 && (
                                        <div className="mb-8 bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                                            <h4 className="font-bold text-indigo-900 mb-3 flex items-center"><Icons.SparkleFill /> <span className="ml-2">Synergy Report</span></h4>
                                            <div className="space-y-3">
                                                {synergies.map((s, i) => (
                                                    <div key={i} className="bg-white p-3 rounded-lg shadow-sm border border-indigo-100/50">
                                                        <div className="flex justify-between items-start">
                                                            <div className="font-medium text-slate-800 text-sm">
                                                                <span className="text-indigo-600">{s.vision1Title}</span> + <span className="text-indigo-600">{s.vision2Title}</span>
                                                            </div>
                                                            <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-bold">{s.score}%</span>
                                                        </div>
                                                        <p className="text-xs text-slate-600 mt-2 leading-relaxed">{s.reasoning}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-8">
                                        {/* Created Visions */}
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            {visions.length === 0 && joinedVisions.length === 0 ? <p className="col-span-full text-slate-400 text-center py-10">No visions created yet.</p> : visions.map((vision) => (
                                                <div key={vision.id} className="relative group">
                                                    <div onClick={() => onViewVision(vision)} className="cursor-pointer h-full">
                                                        <VisionCard vision={vision} />
                                                    </div>
                                                    <div className="absolute top-2 left-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                                        {vision.title === "Root Vision" ? (
                                                            <div className="bg-white/95 backdrop-blur-sm px-2 py-1.5 rounded-lg text-[9px] text-emerald-700 font-bold border border-emerald-200 shadow-sm flex flex-col">
                                                                <span>ANCHOR (ROOT)</span>
                                                                <span className="text-[8px] text-slate-400 font-normal leading-tight mt-0.5">This vision is the foundation of your tree and cannot be deleted.</span>
                                                            </div>
                                                        ) : (
                                                            <button 
                                                                onClick={(e) => handleDeleteVision(e, vision.id)}
                                                                className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg border border-red-400 transition-all hover:scale-110 active:scale-95"
                                                                title="Delete Vision"
                                                            >
                                                                <Icons.Trash />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Joined Visions Section */}
                                        {joinedVisions.length > 0 && (
                                            <div className="border-t border-slate-100 pt-6">
                                                <h4 className="text-sm font-bold text-amber-600 uppercase tracking-widest mb-4 flex items-center">
                                                    <Icons.Globe /> <span className="ml-2">Joined Visions</span>
                                                </h4>
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                    {joinedVisions.map((vision) => (
                                                        <div key={vision.id} className="relative group">
                                                            <div onClick={() => onViewVision(vision)} className="cursor-pointer h-full">
                                                                <VisionCard vision={vision} />
                                                            </div>
                                                            <div className="absolute top-2 right-2 bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-md">
                                                                JOINED
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                             )
                        )}
                        {activeTab === 'history' && (
                             loading ? <div className="flex justify-center py-10"><Loading /></div> : (
                                <div className="space-y-4">
                                    {history.length === 0 ? <p className="text-slate-400 text-center py-10">No history yet.</p> : history.map((h) => (
                                        <div key={h.id} className="border border-slate-200 p-4 rounded-lg bg-slate-50 flex justify-between items-center">
                                            <div>
                                                <p className="font-bold text-sm text-slate-700">{h.status}</p>
                                                <p className="text-xs text-slate-500">{new Date(h.createdAt?.toMillis()).toLocaleDateString()}</p>
                                            </div>
                                            <div className="text-xs font-mono text-slate-400">{h.id.substring(0,8)}...</div>
                                        </div>
                                    ))}
                                </div>
                             )
                        )}
                    </div>
                </div>
            </div>

            {/* Invite Modal */}
            {showInviteModal && (
                <Modal title={t('send_invite')} onClose={() => setShowInviteModal(false)}>
                    <form onSubmit={handleSendInvite} className="space-y-4">
                        <p className="text-xs text-slate-500 mb-4">{t('invites_remaining')}: {invitesRemaining}</p>
                        <input 
                            required
                            type="email"
                            placeholder={t('invite_email_placeholder')}
                            className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                            value={inviteEmail}
                            onChange={e => setInviteEmail(e.target.value)}
                        />
                        <textarea 
                            placeholder={t('invite_message_placeholder')}
                            className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none h-24"
                            value={inviteMessage}
                            onChange={e => setInviteMessage(e.target.value)}
                        />
                        <button 
                            disabled={sendingInvite}
                            type="submit" 
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg transition-colors shadow-lg active:scale-95 disabled:opacity-50"
                        >
                            {sendingInvite ? t('loading') : t('send_invite')}
                        </button>
                    </form>
                </Modal>
            )}

            {/* Delete Confirm Modal */}
            {showDeleteConfirm && (
                <Modal title={t('delete_confirm_title')} onClose={() => setShowDeleteConfirm(false)}>
                    <div className="space-y-6">
                        <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-red-800 text-sm">
                            <p className="font-bold mb-1">{t('delete_confirm_desc')}</p>
                        </div>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold transition-colors"
                            >
                                {t('cancel')}
                            </button>
                            <button 
                                onClick={handleDeleteAccount}
                                disabled={isDeleting}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-red-200 transition-all active:scale-95 flex items-center justify-center space-x-2 disabled:opacity-50"
                            >
                                {isDeleting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Icons.Trash />}
                                <span>{t('delete_account')}</span>
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
