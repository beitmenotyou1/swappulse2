import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Users, Sparkles, Rss, BookOpen, Loader2, UserPlus, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import LiveAvatar from '@/components/LiveAvatar';
import useSEO from '@/hooks/useSEO';
import { useToast } from '@/components/ui/use-toast';

export default function StarterPackDetail() {
  const { packId } = useParams();
  const { toast } = useToast();
  const [pack, setPack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followed, setFollowed] = useState(new Set());

  useSEO({ title: pack?.name || 'Starter Pack', description: 'A curated starter pack of collectors, circles, and feeds for a Pokémon TCG niche on SwapPulse.', canonicalPath: `/starter-packs/${packId}` });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const p = await base44.entities.StarterPack.get(packId);
        setPack(p);
      } catch { setPack(null); } finally { setLoading(false); }
    })();
  }, [packId]);

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

      <section className="mt-6">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold"><Users className="h-4 w-4" /> Members</h2>
        <div className="space-y-2">
          {(pack.member_dids || []).map((did) => (
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
      </section>

      {(pack.circle_ids?.length > 0) && (
        <section className="mt-6">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold"><Sparkles className="h-4 w-4" /> Recommended Circles</h2>
          <div className="space-y-2">
            {pack.circle_ids.map((id) => (
              <Link key={id} to={`/circles/${id}`} className="block rounded-xl border border-border bg-card p-3 text-sm font-semibold hover:bg-secondary">
                Circle {id.slice(0, 8)}…
              </Link>
            ))}
          </div>
        </section>
      )}

      {(pack.feed_uris?.length > 0) && (
        <section className="mt-6">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold"><Rss className="h-4 w-4" /> Pinned Feeds</h2>
          <div className="space-y-2">
            {pack.feed_uris.map((uri) => (
              <div key={uri} className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground break-all">{uri}</div>
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