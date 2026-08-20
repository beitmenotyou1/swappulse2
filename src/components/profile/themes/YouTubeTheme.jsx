import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Radio, Youtube as YoutubeIcon } from 'lucide-react';
import BlockRenderer, { BlockShell } from '@/components/profile/BlockRenderer';
import Avatar from '@/components/Avatar';
import { base44 } from '@/api/base44Client';

// YouTubeTheme — red banner strip, a horizontal video-thumbnail grid for
// podcasts and voice spaces, and a subscriptions/follows strip. Subscribe
// maps to the existing FollowBellButton (in the profile header). About section
// uses BlockRenderer for personal blocks below the video grid.
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
        base44.entities.VoiceSpace.filter({ did }, '-created_date', 6).catch(() => []),
        base44.entities.Follow.filter({ did }, '-created_date', 12).catch(() => []),
      ]);
      if (!active) return;
      setPodcasts(p || []);
      setSpaces(s || []);
      setFollows(f || []);
    })();
    return () => { active = false; };
  }, [did]);

  const videos = [
    ...podcasts.map((p) => ({ id: p.id, title: p.title, thumb: p.cover_image_url, duration: p.duration_seconds, to: `/spaces`, kind: 'podcast' })),
    ...spaces.map((s) => ({ id: s.id, title: s.title, thumb: '', duration: null, to: `/spaces/${s.id}`, kind: 'space' })),
  ];

  return (
    <div className="py-4">
      <div className="mb-4 h-2 rounded-full bg-[#FF0000]" />

      <div className="mb-4 flex items-center gap-3 border-b border-border pb-3">
        <Avatar name={profile?.name} src={profile?.avatar} size={64} className="rounded-full" />
        <div className="flex-1">
          <h2 className="text-lg font-bold">{profile?.name}</h2>
          <p className="text-xs text-muted-foreground">{profile?.followers || 0} subscribers</p>
        </div>
      </div>

      <BlockShell className="border-[#FF0000]/20">
        <div className="mb-3 flex items-center gap-2">
          <YoutubeIcon className="h-5 w-5 text-[#FF0000]" />
          <h3 className="text-sm font-bold">Content</h3>
        </div>
        {videos.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No podcasts or spaces yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {videos.map((v) => (
              <Link key={v.id} to={v.to} className="group">
                <div className="relative aspect-video overflow-hidden rounded-xl bg-secondary">
                  {v.thumb ? (
                    <img src={v.thumb} alt={v.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-muted-foreground">
                      {v.kind === 'space' ? <Radio className="h-8 w-8" /> : <Play className="h-8 w-8" />}
                    </div>
                  )}
                  <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] font-medium text-white">
                    {v.kind === 'space' ? 'SPACE' : 'POD'}
                  </span>
                  <span className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:bg-black/20 group-hover:opacity-100">
                    <Play className="h-8 w-8 fill-white text-white" />
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs font-medium">{v.title}</p>
              </Link>
            ))}
          </div>
        )}
      </BlockShell>

      {follows.length > 0 && (
        <BlockShell title="Subscriptions" className="mt-3 border-[#FF0000]/20">
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

      <div className="mt-4 space-y-3">
        {['bio', 'interests', 'favourite_pokemon', 'favourite_sets', 'milestones', 'contact', 'binder', 'trades', 'collections', 'hub'].map((key) => (
          <BlockRenderer key={key} blockKey={key} data={data} did={did} isOwner={isOwner} />
        ))}
      </div>
    </div>
  );
}