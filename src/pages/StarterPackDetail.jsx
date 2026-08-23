import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Users, Sparkles, Rss, BookOpen, Loader2, UserPlus, Check, Clock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import LiveAvatar from '@/components/LiveAvatar';
import useSEO from '@/hooks/useSEO';
import { useToast } from '@/components/ui/use-toast';

export default function StarterPackDetail() {
  const { packId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [pack, setPack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followed, setFollowed] = useState(new Set());
  const [pending, setPending] = useState([]);
  const [circleNames, setCircleNames] = useState({});

  useSEO({ title: pack?.name || 'Starter Pack', description: 'A curated starter pack of collectors, circles, and feeds for a Pokémon TCG niche on SwapPulse.', canonicalPath: `/starter-packs/${packId}` });

  const isAuthor = pack && user && (pack.did === (user.data?.did || user.did));

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const p = await base44.entities.StarterPack.get(packId);
        setPack(p);
        // Resolve circle names for display.
        const ids = (p.circle_ids || []).filter(Boolean);
        if (ids.length) {
          const names = {};
          await Promise.all(ids.map(async (id) => {
            try {
              const c = await base44.entities.Circle.get(id);
              if (c) names[id] = c.name;
            } catch { names[id] = ''; }
          }));
          setCircleNames(names);
        }
      } catch { setPack(null); } finally { setLoading(false); }
    })();
  }, [packId]);

  // Author-only: load pending inclusion requests for this pack.
  useEffect(() => {
    if (!isAuthor) { setPending([]); return; }
    let alive = true;
    (async () => {
      try {
        const list = await base44.entities.StarterPackRequest.filter(
          { pack_id: packId, status: 'pending' },
          '-created_date',
          100,
        );
        if (alive) setPending(list || []);
      } catch { if (alive) setPending([]); }
    })();
    return () => { alive = false; };
  }, [packId, isAuthor]);

  const followAll = async () => {
    if (!pack?.member_dids?.length) return;
    setFollowing(true);
    const done = new Set(followed);
    for (const did of pack.member_dids) {
      if (done.has(did)) continue;
      try {
        await base44.entities.Follow.create({ did, target_did: did, target_handle: '', target_name: '' });
        done.add(did);
      } catch { /* ignore duplicates */ }
    }
    setFollowed(done);
    setFollowing(false);
    toast({ title: `Followed ${done.size} collectors` });
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!pack) return <div className="py-20 text-center text-sm text-muted-foreground">Starter pack not found.</div>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-4 pb-24 md:pb-8">
      <Link to="/starter-packs" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All packs
      </Link>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {pack.cover_image_url ? (
          <div className="h-32 w-full overflow-hidden"><img src={pack.cover_image_url} alt="" className="h-full w-full object-cover" /></div>
        ) : (
          <div className="h-32 w-full bg-gradient-to-br from-primary/20 to-accent/15" />
        )}
        <div className="p-5">
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold capitalize text-primary">{pack.category}</span>
          <h1 className="mt-2 text-xl font-bold">{pack.name}</h1>
          {pack.description && <p className="mt-1 text-sm text-muted-foreground">{pack.description}</p>}
          <div className="mt-3 flex items-center gap-2">
            <LiveAvatar did={pack.did} name={pack.author_name} src={pack.author_avatar} size={24} />
            <span className="text-sm text-muted-foreground">by {pack.author_name || 'Collector'}</span>
          </div>
          <button
            onClick={followAll}
            disabled={following || !pack.member_dids?.length}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {following ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Follow all {pack.member_dids?.length || 0} collectors
          </button>
        </div>
      </div>

      {/* Author-only: pending inclusion requests */}
      {isAuthor && pending.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold"><Clock className="h-4 w-4 text-warning" /> Pending requests <span className="rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-bold text-warning">{pending.length}</span></h2>
          <p className="mb-2 text-xs text-muted-foreground">These collectors haven't responded yet — they're hidden from the public member list.</p>
          <div className="space-y-2">
            {pending.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <LiveAvatar did={r.target_did} name={r.target_name} src={r.target_avatar} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.target_name || r.target_handle || 'Collector'}</p>
                  {r.target_handle && <p className="truncate text-xs text-muted-foreground">@{r.target_handle}</p>}
                </div>
                <span className="flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning"><Clock className="h-2.5 w-2.5" /> pending</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold"><Users className="h-4 w-4" /> Members</h2>
        {pack.member_dids?.length ? (
          <div className="space-y-2">
            {pack.member_dids.map((did) => (
              <div key={did} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <LiveAvatar did={did} name="" size={36} />
                <Link to={`/profile/${did}`} className="min-w-0 flex-1 text-sm font-semibold hover:underline">
                  {did.replace('did:plc:', '').slice(0, 12)}…
                </Link>
                {followed.has(did) ? (
                  <span className="flex items-center gap-1 text-xs text-success"><Check className="h-3.5 w-3.5" /> Followed</span>
                ) : (
                  <span className="text-xs text-muted-foreground">external</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-card p-4 text-center text-xs text-muted-foreground">
            {isAuthor ? 'No confirmed members yet — pending requests will appear above.' : 'Members will appear here once they accept.'}
          </p>
        )}
      </section>

      {(pack.circle_ids?.length > 0) && (
        <section className="mt-6">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold"><Sparkles className="h-4 w-4" /> Recommended Circles</h2>
          <div className="space-y-2">
            {pack.circle_ids.map((id) => (
              <Link key={id} to={`/circles/${id}`} className="block rounded-xl border border-border bg-card p-3 text-sm font-semibold hover:bg-secondary">
                {circleNames[id] || `Circle ${id.slice(0, 8)}…`}
              </Link>
            ))}
          </div>
        </section>
      )}

      {(pack.feed_uris?.length > 0) && (
        <section className="mt-6">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold"><Rss className="h-4 w-4" /> Pinned Feeds</h2>
          <div className="space-y-2">
            {pack.feed_uris.map((uri, i) => (
              <div key={uri} className="rounded-xl border border-border bg-card p-3">
                <p className="text-sm font-semibold">{pack.feed_names?.[i] || uri}</p>
                <p className="mt-0.5 break-all text-[11px] text-muted-foreground">{uri}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {(pack.featured_binder_id || pack.featured_journal_id) && (
        <section className="mt-6">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold"><BookOpen className="h-4 w-4" /> Featured</h2>
          <div className="flex gap-2">
            {pack.featured_binder_id && <Link to={`/binder/${pack.featured_binder_id}`} className="rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-secondary">View Binder</Link>}
            {pack.featured_journal_id && <Link to={`/journal/${pack.featured_journal_id}`} className="rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-secondary">View Journal</Link>}
          </div>
        </section>
      )}
    </div>
  );
}