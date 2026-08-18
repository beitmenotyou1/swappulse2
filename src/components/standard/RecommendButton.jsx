import React, { useState, useEffect } from 'react';
import { ThumbsUp, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// RecommendButton — toggles a site.standard.graph.recommend record for a
// journal, card review, or binder. Distinct from a like: it's a lightweight
// social signal for long-form content that external aggregators surface.
//
// Props:
//   documentUri — the site.standard.document at:// URI (must be published)
//   entityType  — 'journal' | 'card_review' | 'binder'
//   entityId    — local entity id
//   authorDid   — DID of the content author (for notification routing)
//   initialCount — initial recommend count
export default function RecommendButton({
  documentUri,
  entityType,
  entityId,
  authorDid = '',
  initialCount = 0,
  size = 'sm',
}) {
  const [recommended, setRecommended] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  // Check if the current user has already recommended this document
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!documentUri) return;
      try {
        const me = await base44.auth.me().catch(() => null);
        if (!me) return;
        const existing = await base44.entities.StandardRecommend
          .filter({ did: me.did, document_uri: documentUri }, '-created_date', 1).catch(() => []);
        if (alive && existing?.length > 0) setRecommended(true);
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [documentUri]);

  const toggle = async () => {
    if (!documentUri || loading) return;
    setLoading(true);
    const prevRecommended = recommended;
    setRecommended(!prevRecommended);
    setCount((c) => c + (prevRecommended ? -1 : 1));
    try {
      const res = await base44.functions.invoke('toggle-standard-recommend', {
        documentUri, entityType, entityId, authorDid,
      });
      const data = res?.data ?? res;
      if (data?.recommended !== undefined) {
        setRecommended(data.recommended);
        if (typeof data.count === 'number') setCount(data.count);
      }
    } catch (e) {
      // Revert on error
      setRecommended(prevRecommended);
      setCount((c) => c + (prevRecommended ? 1 : -1));
    } finally {
      setLoading(false);
    }
  };

  if (!documentUri) return null;

  const sizeCls = size === 'sm' ? 'text-xs px-3 py-1.5' : 'text-sm px-4 py-2';

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`flex items-center gap-1.5 rounded-full border font-semibold transition disabled:opacity-50 ${sizeCls} ${
        recommended
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border hover:bg-secondary'
      }`}
      aria-pressed={recommended}
      title={recommended ? 'Un-recommend' : 'Recommend this'}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className={`h-3.5 w-3.5 ${recommended ? 'fill-current' : ''}`} />}
      {recommended ? 'Recommended' : 'Recommend'}
      {count > 0 && <span className="ml-0.5 tabular-nums">{count}</span>}
    </button>
  );
}