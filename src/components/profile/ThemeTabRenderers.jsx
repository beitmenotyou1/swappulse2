import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Trophy, BarChart3, Star, Target, TrendingUp, Award, Play, Radio, ArrowUpRight } from 'lucide-react';
import PostCard from '@/components/feed/PostCard';
import Avatar from '@/components/Avatar';
import { base44 } from '@/api/base44Client';
import { cardImageUrl } from '@/lib/tcgdex';
import { formatPrice } from '@/lib/format';

// ── Likes Tab ─────────────────────────────────────────────────────────────
export function LikesTab({ did, isOwner }) {
  const [likes, setLikes] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!isOwner) { setLoading(false); return; }
    let active = true;
    (async () => {
      try {
        const res = await base44.functions.invoke('get-my-likes', {});
        const data = res?.data ?? res;
        if (active) setLikes(data?.items || data || []);
      } catch {} finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [isOwner]);
  if (!isOwner) return <p className="py-16 text-center text-sm text-muted-foreground">Likes are private.</p>;
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (likes.length === 0) return <p className="py-16 text-center text-sm text-muted-foreground">No likes yet.</p>;
  return <div>{likes.map((p) => <PostCard key={p.id} post={p} />)}</div>;
}

// ── Binder Tab ────────────────────────────────────────────────────────────
export function BinderTab({ collection, did }) {
  const [entries, setEntries] = useState(collection || []);
  const [loading, setLoading] = useState(!collection?.length);
  useEffect(() => {
    if (!did || collection?.length) return;
    let active = true;
    base44.entities.CollectionEntry.filter({ did }, '-updated_date', 60)
      .then((e) => { if (active) setEntries(e || []); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [did, collection]);
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!entries || entries.length === 0) return <p className="py-16 text-center text-sm text-muted-foreground">No cards in binder yet.</p>;
  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {entries.slice(0, 60).map((c) => (
          <Link key={c.id} to={`/card/${c.card_id}`}>
            <img src={cardImageUrl(c.card_image)} alt={c.card_name} className="aspect-[3/4] w-full rounded-lg object-cover" />
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Trade Stats Tab (Competitive) ──────────────────────────────────────────
export function TradeStatsTab({ trades, did }) {
  const [listings, setListings] = useState(trades || []);
  useEffect(() => {
    if (!did || trades?.length) return;
    let active = true;
    base44.entities.TradeListing.filter({ did }, '-created_date', 50)
      .then((l) => { if (active) setListings(l || []); })
      .catch(() => {});
    return () => { active = false; };
  }, [did, trades]);
  const completed = listings.filter((t) => t.status === 'completed').length;
  const open = listings.filter((t) => t.status === 'open' || t.status === 'active').length;
  const winRate = listings.length ? Math.round((completed / listings.length) * 100) : 0;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Trophy} label="Win Rate" value={`${winRate}%`} color="text-blue-400" />
        <StatCard icon={BarChart3} label="Completed" value={completed} color="text-green-400" />
        <StatCard icon={Target} label="Open" value={open} color="text-yellow-400" />
        <StatCard icon={Star} label="Total" value={listings.length} color="text-red-400" />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-blue-500/30 bg-slate-800/50 p-4 text-center">
      <Icon className={`h-6 w-6 ${color}`} />
      <span className="mt-2 text-2xl font-black">{value}</span>
      <span className="text-xs uppercase tracking-wide text-slate-400">{label}</span>
    </div>
  );
}

// ── Achievements Tab ──────────────────────────────────────────────────────
export function AchievementsTab({ did, isOwner }) {
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!did) return;
    let active = true;
    base44.entities.Achievement.filter({ did }, '-created_date', 50)
      .then((a) => { if (active) setAchievements(a || []); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [did]);
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (achievements.length === 0) return (
    <div className="py-16 text-center">
      <p className="text-sm text-muted-foreground">No achievements yet.</p>
      {isOwner && <Link to="/achievements" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">View achievements <ArrowUpRight className="h-3.5 w-3.5" /></Link>}
    </div>
  );
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {achievements.map((a) => (
          <div key={a.id} className="flex flex-col items-center rounded-xl border border-border bg-card p-3 text-center">
            <Award className="h-10 w-10 text-amber-500" />
            <p className="mt-2 line-clamp-2 text-xs font-semibold">{a.title || a.name}</p>
          </div>
        ))}
      </div>
      {isOwner && <Link to="/achievements" className="mt-4 block text-center text-sm font-semibold text-primary hover:underline">View all achievements</Link>}
    </div>
  );
}

// ── Rewards Tab (Shiny) ───────────────────────────────────────────────────
export function RewardsTab({ did }) {
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!did) return;
    let active = true;
    base44.entities.Achievement.filter({ did }, '-created_date', 50)
      .then((a) => { if (active) setAchievements(a || []); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [did]);
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-amber-500" /></div>;
  if (achievements.length === 0) return <p className="py-16 text-center text-sm text-muted-foreground">No rewards earned yet.</p>;
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {achievements.map((a) => (
          <div key={a.id} className="flex flex-col items-center rounded-xl border border-amber-200 bg-gradient-to-b from-amber-50 to-yellow-50 p-4 text-center rarity-glow-holo">
            <Award className="h-10 w-10 text-amber-500" />
            <p className="mt-2 line-clamp-2 text-xs font-semibold text-amber-800">{a.title || a.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Leaderboard Tab (Competitive) ─────────────────────────────────────────
export function LeaderboardTab({ did }) {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    base44.entities.Challenge.filter({ status: 'active' }, '-created_date', 10)
      .then((c) => { if (active) setChallenges(c || []); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>;
  if (challenges.length === 0) return <p className="py-16 text-center text-sm text-muted-foreground">No active leaderboards.</p>;
  return (
    <div className="p-4 space-y-2">
      {challenges.map((c) => (
        <Link key={c.id} to={`/challenges/${c.id}/leaderboard`} className="flex items-center justify-between rounded-lg border border-blue-500/30 bg-slate-800/50 p-3 hover:border-blue-500/60">
          <div>
            <p className="text-sm font-bold">{c.title}</p>
            <p className="text-xs text-slate-400">{c.challenge_type} · {c.mode}</p>
          </div>
          <Trophy className="h-5 w-5 text-blue-400" />
        </Link>
      ))}
    </div>
  );
}

// ── Portfolio Tab (Investment) ────────────────────────────────────────────
export function PortfolioTab({ collection, did }) {
  const [entries, setEntries] = useState(collection || []);
  const [loading, setLoading] = useState(!collection?.length);
  useEffect(() => {
    if (!did || collection?.length) return;
    let active = true;
    base44.entities.CollectionEntry.filter({ did }, '-updated_date', 100)
      .then((e) => { if (active) setEntries(e || []); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [did, collection]);
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>;
  const total = entries.reduce((s, c) => s + (c.market_value || c.purchase_price || 0), 0);
  const avg = entries.length ? total / entries.length : 0;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="flex flex-col rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <TrendingUp className="h-5 w-5 text-emerald-600" />
          <span className="mt-2 text-xl font-bold text-emerald-800">{formatPrice(total)}</span>
          <span className="text-xs text-emerald-600/70">Total Value</span>
        </div>
        <div className="flex flex-col rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <BarChart3 className="h-5 w-5 text-emerald-600" />
          <span className="mt-2 text-xl font-bold text-emerald-800">{entries.length}</span>
          <span className="text-xs text-emerald-600/70">Cards</span>
        </div>
        <div className="flex flex-col rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <Star className="h-5 w-5 text-emerald-600" />
          <span className="mt-2 text-xl font-bold text-emerald-800">{formatPrice(avg)}</span>
          <span className="text-xs text-emerald-600/70">Avg Value</span>
        </div>
      </div>
    </div>
  );
}

// ── Episodes Tab (YouTube → Podcasts) ──────────────────────────────────────
export function EpisodesTab({ did }) {
  const [podcasts, setPodcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!did) return;
    let active = true;
    base44.entities.PodcastEpisode.filter({ did }, '-published_at', 24)
      .then((p) => { if (active) setPodcasts(p || []); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [did]);
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-red-500" /></div>;
  if (podcasts.length === 0) return <p className="py-16 text-center text-sm text-muted-foreground">No episodes yet.</p>;
  return (
    <div className="space-y-2">
      {podcasts.map((p) => (
        <Link key={p.id} to="/spaces" className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:bg-secondary">
          <div className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-red-500/10 text-red-500">
            {p.cover_image_url ? (
              <img src={p.cover_image_url} alt={p.title} className="h-full w-full object-cover" />
            ) : (
              <Play className="h-6 w-6 fill-current" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-sm font-bold">{p.title}</p>
            {p.description && <p className="line-clamp-1 text-xs text-muted-foreground">{p.description}</p>}
            <p className="mt-0.5 text-xs text-muted-foreground">
              {p.published_at ? new Date(p.published_at).toLocaleDateString() : ''} · {Math.floor((p.duration_seconds || 0) / 60)} min
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── Playlists Tab (YouTube → Binders) ─────────────────────────────────────
export function PlaylistsTab({ did }) {
  const [binders, setBinders] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!did) return;
    let active = true;
    base44.entities.Binder.filter({ did }, '-updated_date', 20)
      .then((b) => { if (active) setBinders(b || []); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [did]);
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-red-500" /></div>;
  if (binders.length === 0) return <p className="py-16 text-center text-sm text-muted-foreground">No playlists yet.</p>;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {binders.map((b) => (
        <Link key={b.id} to={`/binder/${b.id}`} className="rounded-xl border border-border bg-card p-3 hover:bg-secondary">
          <div className="mb-2 aspect-video rounded-lg bg-secondary" />
          <p className="text-sm font-bold line-clamp-1">{b.title || b.name}</p>
          <p className="text-xs text-muted-foreground">{b.card_count || 0} cards</p>
        </Link>
      ))}
    </div>
  );
}

// ── Live Tab (YouTube → Live Spaces) ──────────────────────────────────────
export function LiveTab({ did }) {
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!did) return;
    let active = true;
    base44.entities.VoiceSpace.filter({ did }, '-created_date', 12)
      .then((s) => { if (active) setSpaces(s || []); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [did]);
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-red-500" /></div>;
  if (spaces.length === 0) return <p className="py-16 text-center text-sm text-muted-foreground">No live spaces yet.</p>;
  return (
    <div className="space-y-2">
      {spaces.map((s) => {
        const isLive = s.status === 'live';
        return (
          <Link key={s.id} to={`/spaces/${s.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:bg-secondary">
            <div className={`relative grid h-14 w-14 shrink-0 place-items-center rounded-lg ${isLive ? 'bg-red-500/10 text-red-500' : 'bg-secondary text-muted-foreground'}`}>
              <Radio className="h-6 w-6" />
              {isLive && (
                <span className="absolute -right-1 -top-1 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-sm font-bold">{s.title}</p>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                {isLive ? (
                  <>
                    <span className="flex items-center gap-1 font-semibold text-red-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 live-ring" /> LIVE
                    </span>
                    {s.recording_enabled && <span className="flex items-center gap-0.5 text-red-400"><span className="h-1.5 w-1.5 rounded-full bg-red-500" /> REC</span>}
                    <span>· {s.listener_count || 0} listening</span>
                  </>
                ) : (
                  <span>{s.status === 'ended' ? 'Ended' : 'Scheduled'} · {s.started_at ? new Date(s.started_at).toLocaleDateString() : ''}</span>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ── Friends Tab (Facebook) ─────────────────────────────────────────────────
export function FriendsTab({ did }) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!did) return;
    let active = true;
    base44.entities.Friendship.filter({ did, status: 'accepted' }, '-created_date', 50)
      .then((f) => { if (active) setFriends(f || []); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [did]);
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>;
  if (friends.length === 0) return <p className="py-16 text-center text-sm text-muted-foreground">No friends yet.</p>;
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {friends.map((f) => (
        <Link key={f.id} to={`/profile/${f.friend_did}`} className="flex flex-col items-center gap-1">
          <Avatar name={f.friend_name} size={64} />
          <span className="max-w-[80px] truncate text-xs font-medium">{f.friend_name}</span>
        </Link>
      ))}
    </div>
  );
}

// ── Photos Tab (Facebook → Binder cards) ─────────────────────────────────
export function PhotosTab({ collection, did }) {
  const [entries, setEntries] = useState(collection || []);
  const [loading, setLoading] = useState(!collection?.length);
  useEffect(() => {
    if (!did || collection?.length) return;
    let active = true;
    base44.entities.CollectionEntry.filter({ did }, '-updated_date', 60)
      .then((e) => { if (active) setEntries(e || []); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [did, collection]);
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>;
  if (entries.length === 0) return <p className="py-16 text-center text-sm text-muted-foreground">No photos yet.</p>;
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {entries.slice(0, 50).map((c) => (
        <Link key={c.id} to={`/card/${c.card_id}`}>
          <img src={cardImageUrl(c.card_image)} alt={c.card_name} className="aspect-square w-full rounded-lg object-cover" />
        </Link>
      ))}
    </div>
  );
}