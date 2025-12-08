import { useState, useEffect, useCallback, useRef } from 'react';
import { Query, getDocs, limit, startAfter, query } from 'firebase/firestore';

export function useInfiniteQuery<T>(baseQuery: Query) {
    const [data, setData] = useState<T[]>([]);
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    
    useEffect(() => {
        setData([]);
        setLastDoc(null);
        setHasMore(true);
        loadMore(true);
    }, [baseQuery]);

    const loadMore = useCallback(async (isInitial = false) => {
        if (loading || (!hasMore && !isInitial)) return;
        setLoading(true);

        try {
            let q = query(baseQuery, limit(12));
            if (!isInitial && lastDoc) {
                q = query(baseQuery, startAfter(lastDoc), limit(12));
            }

            const snapshot = await getDocs(q);
            const newItems = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as T));

            setData(prev => isInitial ? newItems : [...prev, ...newItems]);
            setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
            setHasMore(snapshot.docs.length === 12);
        } catch (error) {
            console.error("Pagination error:", error);
        } finally {
            setLoading(false);
        }
    }, [baseQuery, lastDoc, loading, hasMore]);

    const observer = useRef<IntersectionObserver | null>(null);
    const lastElementRef = useCallback((node: HTMLDivElement | null) => {
        if (loading) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                loadMore();
            }
        });
        if (node) observer.current.observe(node);
    }, [loading, hasMore, loadMore]);

    return { data, loading, hasMore, lastElementRef };
}