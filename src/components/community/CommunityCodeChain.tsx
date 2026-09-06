import React, { useState, useEffect, useMemo } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Pulse } from '../../types';
import { ChainTree, ChainRoot, ChainStats } from '../sections/ChainTree';
import { SectionTitle } from '../ui/SectionTitle';
import { useLanguage } from '../../contexts/LanguageContext';

import { charter } from '../../config/charter';
// The node's BODY — its code chain. For the network hub, the repository's git history is the
// growth chain: code changes are its growth, and every deploy carries its own history (Indra's
// net — the artifact contains the record of its own becoming). The commits are mirrored at
// build time (scripts/build-commits.mjs → public/commits.json) and rendered through the same
// ChainTree every other being grows on.

interface CommitEntry {
    sha: string;
    author: string;
    at: number; // epoch ms
    title: string;
}

interface CommitsFile {
    version: string;
    commits: CommitEntry[];
}

// A commit worn as a Pulse — just enough shape for ChainTree's leaf cards.
const commitToPulse = (c: CommitEntry, previousSha: string): Pulse => ({
    id: c.sha,
    type: 'tree_growth',
    title: c.title,
    body: c.author,
    authorId: c.author,
    authorName: c.author,
    createdAt: Timestamp.fromMillis(c.at),
    loveCount: 0,
    commentCount: 0,
    previousHash: previousSha,
    hash: c.sha,
});

const noop = (): void => {};

// The repo the code chain mirrors — each growth leaf links straight to its commit.
const REPO_URL = charter.repo;

export const CommunityCodeChain: React.FC = () => {
    const { t } = useLanguage();
    const [commits, setCommits] = useState<CommitEntry[] | null>(null);
    const [failed, setFailed] = useState(false);

    // Lazy-load the mirrored history on tab mount — it ships with the bundle, so this is local.
    useEffect(() => {
        let alive = true;
        fetch('/commits.json')
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<CommitsFile>; })
            .then(data => { if (alive) setCommits(data.commits || []); })
            .catch(() => { if (alive) setFailed(true); });
        return () => { alive = false; };
    }, []);

    // Newest first (the mirror guarantees it; we trust but don't re-sort). Each block's
    // previousHash points at the commit below it — the chain the repo already is.
    const blocks = useMemo<Pulse[]>(
        () => (commits || []).map((c, i, all) => commitToPulse(c, all[i + 1]?.sha || '')),
        [commits],
    );

    const oldest = commits?.length ? commits[commits.length - 1] : null;
    const root: ChainRoot = {
        name: 'lifeseed',
        body: 'The seed everything unpacks from',
        plantedLabel: oldest ? new Date(oldest.at).toLocaleDateString() : undefined,
        hash: oldest?.sha || null,
    };
    const stats: ChainStats = {
        blockHeight: commits?.length || 0,
        genesisHash: oldest?.sha,
        latestHash: commits?.[0]?.sha,
    };

    return (
        <div>
            <SectionTitle
                title="Code chain"
                sub="The node's body: code changes are its growth; every deploy carries its own history (Indra's net)."
            />
            {failed ? (
                <p className="py-10 text-center text-sm text-slate-400">{t('code_chain_unreadable')}</p>
            ) : (
                <ChainTree
                    blocks={blocks}
                    loading={commits === null}
                    onViewPulse={noop}
                    hrefForBlock={(p) => `${REPO_URL}/commit/${p.hash}`}
                    root={root}
                    stats={stats}
                    emptyText="No commits mirrored yet."
                    // Caring the node's body = contributing code — the crown CTA opens the repo.
                    canCare
                    onCare={() => window.open(REPO_URL, '_blank', 'noopener')}
                />
            )}
        </div>
    );
};
