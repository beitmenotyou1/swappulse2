import React, { useState, useEffect } from 'react';
import { BookMarked, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// SubscribeToWritingButton — toggles a site.standard.graph.subscription to
// another collector's per-author site.standard.publication. Distinct from the
// existing Follow: it subscribes to the collector's long-form writing (journals,
// reviews, binder descriptions), not their social feed.
//
// Props:
//   authorDid — DID of the collector whose writing to subscribe to
export default function SubscribeToWritingButton({ authorDid }) {
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasPublication, setHasPublication] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!authorDid) return;
      try {
        const me = await base44.auth.me().catch(() => null);
        if (!me || me.did === authorDid) { setHasPublication(false); return; }
        // Check if the author has a publication and if the user is already subscribed
        const [pubs, subs] = await Promise.all([
          base44.entities.StandardPublication.filter({ did: authorDid }, '-created_date', 1).catch(() => []),
          base44.entities.StandardSubscription.filter({ did: me.did, author_did: authorDid }, '-created_date', 1).catch(() => []),
        ]);
        if (!alive) return;
        if (!pubs?.length || !pubs[0]?.publication_uri) {
          setHasPublication(false);
          return;
        }
        setHasPublication(true);
        if (subs?.length > 0) setSubscribed(true);
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [authorDid]);

  const toggle = async () => {
    if (!authorDid || loading || !hasPublication) return;
    setLoading(true);
    const prev = subscribed;
    setSubscribed(!prev);
    try {
      const res = await base44.functions.invoke('toggle-standard-subscription', { authorDid });
      const data = res?.data ?? res;
      if (data?.subscribed !== undefined) setSubscribed(data.subscribed);
    } catch (e) {
      setSubscribed(prev);
    } finally {
      setLoading(false);
    }
  };

  if (!hasPublication) return null;

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
        subscribed
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border hover:bg-secondary'
      }`}
      aria-pressed={subscribed}
      title={subscribed ? 'Unsubscribe from writing' : 'Subscribe to this collector\'s writing'}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookMarked className={`h-3.5 w-3.5 ${subscribed ? 'fill-current' : ''}`} />}
      {subscribed ? 'Subscribed' : 'Subscribe to writing'}
    </button>
  );
}