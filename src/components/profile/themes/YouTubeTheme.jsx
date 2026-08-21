import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Radio, Headphones, Mic } from 'lucide-react';
import BlockRenderer, { BlockShell } from '@/components/profile/BlockRenderer';
import Avatar from '@/components/Avatar';
import { base44 } from '@/api/base44Client';

// YouTubeTheme — podcast-and-live-streaming-centric landing. Leads with a
// featured episode hero, a horizontal live-spaces rail with broadcasting
// indicators (red dot, listener count, REC badge), and an episode list with
// play buttons. Subscriptions strip and personal blocks below.
export default function YouTubeTheme({ data, did, isOwner, profile }) {
  const [podcasts, setPodcasts] = useState([]);
  const [spaces, setSpaces] = useState([]);
  const [follows, setFollows] = useState([]);

  useEffect(() => {
    if (!did) return;
    let active = true;
    (async () => {
      const [p, s, f] = await Promise.all([
        base44.entities.PodcastEpisode.filter({ did }, '-published_at', 12).catch(() => []),
        base44.entities.VoiceSpace.filter({ did }, '-created_date', 8).catch(() => []),
        base44.entities.Follow.filter({ did }, '-created_date', 12).catch(() => []),
      ]);
      if (!active) return;
      setPodcasts(p || []);
      setSpaces(s || []);
      setFollows(f || []);
    })();
    return () => { active = false; };
  }, [did]);

  const featured = podcasts[0];
  const liveSpaces = spaces.filter((s) => s.status === 'live');
  const recentEpisodes = podcasts.slice(1, 7);

  return (
    <div className="py-4 space-y-4">
      {/* Featured episode hero */}
      {featured ? (
        <BlockShell className="overflow-hidden border-[#FF0000]/20 p-0">
          <Link to="/spaces" className="block">
            <div className="flex flex-col sm:flex-row">
              <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-secondary sm:w-48">
                {featured.cover_image_url ? (
                  <img src={featured.cover_image_url} alt={featured.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center bg-gradient-to-br from-red-500/20 to-rose-500/10 text-red-500">
                    <Headphones className="h-10 w-10" />
                  </div>
                )}
                <div className="absolute inset-0 grid place-items-center bg-black/20 opacity-0 transition hover:opacity-100">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-red-600 text-white"><Play className="h-5 w-5 fill-white" /></span>
                </div>
                <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {Math.floor((featured.duration_seconds || 0) / 60)} min
                </span>
              </div>
              <div className="flex-1 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wide text-red-500">Latest episode</span>
                <h3 className="mt-1 line-clamp-2 text-sm font-bold">{featured.title}</h3>
                {featured.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{featured.description}</p>}
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {featured.published_at ? new Date(featured.published_at).toLocaleDateString() : ''}
                </p>
              </div>
            </div>
          </Link>
        </BlockShell>
      ) : (
        <BlockShell className="border-[#FF0000]/20">
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Headphones className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No episodes published yet.</p>
          </div>
        </BlockShell>
      )}

      {/* Live now rail */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Radio className="h-4 w-4 text-red-500" />
          <h3 className="text-sm font-bold">Live Now</h3>
          {liveSpaces.length > 0 && <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{liveSpaces.length}</span>}
        </div>
        {liveSpaces.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-3 text-center text-xs text-muted-foreground">No live spaces right now.</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {liveSpaces.map((s) => (
              <Link key={s.id} to={`/spaces/${s.id}`} className="flex w-36 shrink-0 flex-col rounded-xl border border-red-500/30 bg-red-500/5 p-2 hover:border-red-500/50">
                <div className="flex items-center gap-1 text-[10px] font-bold text-red-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 live-ring" /> LIVE
                  {s.recording_enabled && <span className="ml-auto text-red-400">REC</span>}
                </div>
                <p className="mt-1 line-clamp-2 text-xs font-semibold">{s.title}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{s.listener_count || 0} listening</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Episode list */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Mic className="h-4 w-4 text-[#FF0000]" />
          <h3 className="text-sm font-bold">Episodes</h3>
        </div>
        {recentEpisodes.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-3 text-center text-xs text-muted-foreground">No episodes yet.</p>
        ) : (
          <div className="space-y-1.5">
            {recentEpisodes.map((p, i) => (
              <Link key={p.id} to="/spaces" className="flex items-center gap-3 rounded-xl border border-border bg-card p-2 hover:bg-secondary">
                <span className="w-5 text-right text-xs font-bold text-muted-foreground">{i + 2}</span>
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-secondary">
                  {p.cover_image_url ? (
                    <img src={p.cover_image_url} alt={p.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-red-500"><Play className="h-4 w-4 fill-current" /></div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-xs font-semibold">{p.title}</p>
                  <p className="text-[10px] text-muted-foreground">{Math.floor((p.duration_seconds || 0) / 60)} min · {p.published_at ? new Date(p.published_at).toLocaleDateString() : ''}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Subscriptions */}
      {follows.length > 0 && (
        <BlockShell title="Subscriptions" className="border-[#FF0000]/20">
          <div className="flex gap-3 overflow-x-auto pb-1">
            {follows.map((f) => (
              <Link key={f.id} to={`/profile/${f.subject_did}`} className="flex flex-col items-center gap-1">
                <Avatar name={f.subject_name} src={f.subject_avatar} size={48} />
                <span className="max-w-[64px] truncate text-[10px] font-medium">{f.subject_name}</span>
              </Link>
            ))}
          </div>
        </BlockShell>
      )}

      {/* Personal blocks */}
      <div className="space-y-3">
        {['bio', 'interests', 'favourite_pokemon', 'favourite_sets', 'milestones', 'contact', 'binder', 'trades', 'collections', 'hub'].map((key) => (
          <BlockRenderer key={key} blockKey={key} data={data} did={did} isOwner={isOwner} />
        ))}
      </div>
    </div>
  );
}