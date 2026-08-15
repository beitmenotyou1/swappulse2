import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Star, ShieldCheck, Fingerprint, Copy, Check, Mic, Share2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import LiveAvatar from '@/components/LiveAvatar';
import PostCard from '@/components/feed/PostCard';
import { cardImageUrl } from '@/lib/tcgdex';
import { formatPrice } from '@/lib/format';
import { ensureUserDid } from '@/lib/atproto';
import NotificationToggle from '@/components/pwa/NotificationToggle';
import DataPrivacy from '@/components/profile/DataPrivacy';
import WeeklyDigestToggle from '@/components/profile/WeeklyDigestToggle';
import JournalsTab from '@/components/profile/JournalsTab';
import PodcastsTab from '@/components/profile/PodcastsTab';
import CrossPostTab from '@/components/crosspost/CrossPostTab';
import TradeActivityTab from '@/components/profile/TradeActivityTab';
import ReputationDashboard from '@/components/profile/ReputationDashboard';
import GoLiveModal from '@/components/spaces/GoLiveModal';
import GoLiveControl from '@/components/profile/GoLiveControl';
import LiveCountdownBadge from '@/components/profile/LiveCountdownBadge';
import DomainHandleCard from '@/components/profile/DomainHandleCard';
import EditProfileModal from '@/components/profile/EditProfileModal';
import NetworkFeedSection from '@/components/feed/NetworkFeedSection';
import FollowingTab from '@/components/profile/FollowingTab';
import ActivityTab from '@/components/profile/ActivityTab';
import ProfileHandle from '@/components/profile/ProfileHandle';

const TABS = ['Posts', 'Activity', 'Binder', 'Collection', 'Trades', 'Trade Activity', 'Reputation', 'Following', 'Journals', 'Podcasts', 'Cross-Posting', 'Privacy'];

export default function Profile() {
  const { user } = useAuth();
  const [tab, setTab] = useState('Posts');
  const [posts, setPosts] = useState([]);
  const [collection, setCollection] = useState([]);
  const [trades, setTrades] = useState([]);
  const [did, setDid] = useState('');
  const [reputation, setReputation] = useState([]);
  const [journals, setJournals] = useState([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [liveSpace, setLiveSpace] = useState(null);
  const [showGoLive, setShowGoLive] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [ending, setEnding] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { did: myDid } = await ensureUserDid();
      setDid(myDid);
      const [p, c, t, r, j, vs] = await Promise.all([
        base44.entities.Post.filter({}, '-created_date', 50),
        base44.entities.CollectionEntry.list('-updated_date', 100),
        base44.entities.TradeListing.filter({}, '-created_date', 20),
        base44.entities.Reputation.filter({ did: myDid }, '-created_date', 50).catch(() => []),
        base44.entities.Journal.filter({}, '-created_date', 50),
        base44.entities.VoiceSpace.filter({ did: myDid, status: 'live' }, '-created_date', 1).catch(() => []),
      ]);
      setPosts(p);
      setCollection(c);
      setTrades(t);
      setReputation(r);
      setJournals(j);
      setLiveSpace(vs[0] || null);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Keep the live-stream state fresh when any VoiceSpace record changes.
  useEffect(() => {
    if (!did) return;
    const unsub = base44.entities.VoiceSpace.subscribe(() => {
      base44.entities.VoiceSpace.filter({ did, status: 'live' }, '-created_date', 1)
        .then((r) => setLiveSpace(r[0] || null))
        .catch(() => {});
    });
    return unsub;
  }, [did]);

  const endStream = async () => {
    if (!liveSpace || ending) return;
    setEnding(true);
    try {
      await base44.entities.VoiceSpace.update(liveSpace.id, { status: 'ended', ended_at: new Date().toISOString() });
      setLiveSpace(null);
    } catch {
      /* keep liveSpace so the user can retry */
    } finally {
      setEnding(false);
    }
  };

  const repAvg = reputation.length
    ? (reputation.reduce((s, r) => s + (r.rating || 0), 0) / reputation.length).toFixed(1)
    : null;

  const copyDid = () => {
    navigator.clipboard?.writeText(did);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const myPosts = posts.filter((p) => p.author_name === user?.full_name);
  const myCollection = collection;
  const myTrades = trades.filter((t) => t.author_name === user?.full_name || t.author_name === '');
  const myJournals = journals.filter((j) => j.did === did || j.author_name === user?.full_name);
  const portfolioValue = myCollection.reduce((s, c) => s + (c.market_value || c.purchase_price || 0), 0);
  const binderCards = myCollection.slice(0, 9);

  return (
    <div>
      <div className="h-40 w-full overflow-hidden bg-gradient-to-r from-primary/40 via-rarity-holo/30 to-accent/30">
        {user?.header ? (
          <img src={user.header} alt="Profile header" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="px-4">
        <div className="-mt-12 flex items-end justify-between">
          <span className="relative inline-block">
            <LiveAvatar did={did} name={user?.display_name || user?.full_name} src={user?.avatar} size={96} className="ring-4 ring-background" />
            {liveSpace && <LiveCountdownBadge autoEndAt={liveSpace.auto_end_at} />}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEdit(true)}
              className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
            >
              Edit profile
            </button>
            <GoLiveControl liveSpace={liveSpace} onOpenModal={() => setShowGoLive(true)} onEndStream={endStream} ending={ending} />
          </div>
        </div>
        <div className="mt-3">
          <h1 className="text-xl font-extrabold">{user?.display_name || user?.full_name || 'Collector'}</h1>
          <ProfileHandle
            bskyHandle={user?.bsky_handle}
            username={user?.username}
            did={did}
            verified={user?.handle_verified}
          />
          {user?.description && <p className="mt-2 text-sm">{user.description}</p>}
          <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
            {repAvg && (
              <span className="flex items-center gap-1 text-accent">
                <Star className="h-3.5 w-3.5 fill-current" />
                Trusted Trader · {repAvg}★ ({reputation.length})
              </span>
            )}
          </div>

          <div className="mt-3"><NotificationToggle /></div>
          <div className="mt-3 flex gap-4 text-sm">
            <span><b>{myPosts.length}</b> <span className="text-muted-foreground">Posts</span></span>
            <span><b>{myCollection.length}</b> <span className="text-muted-foreground">Cards</span></span>
            <span><b>{myTrades.length}</b> <span className="text-muted-foreground">Trades</span></span>
          </div>
        </div>

        <div className="mt-4 flex overflow-x-auto border-b border-border">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative flex-1 shrink-0 whitespace-nowrap px-2 py-3 text-sm font-semibold transition-colors ${tab === t ? 'text-foreground' : 'text-muted-foreground hover:bg-secondary'}`}
            >
              {t === 'Podcasts' && <Mic className="mr-1 inline h-5 w-5 align-text-bottom text-muted-foreground" />}
              {t === 'Cross-Posting' && <Share2 className="mr-1 inline h-5 w-5 align-text-bottom text-muted-foreground" />}
              {t}
              {tab === t && <span className="absolute bottom-0 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-primary" />}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : tab === 'Posts' ? (
          myPosts.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">No posts yet.</p>
          ) : (
            myPosts.map((p) => <PostCard key={p.id} post={p} />)
          )
        ) : tab === 'Activity' ? (
          <ActivityTab did={did} />
        ) : tab === 'Binder' ? (
          <div className="p-4">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-3">
              {binderCards.map((c) => (
                <Link key={c.id} to={`/card/${c.card_id}`}>
                  <img src={cardImageUrl(c.card_image)} alt={c.card_name} className="aspect-[3/4] w-full rounded-lg object-cover" />
                </Link>
              ))}
              {binderCards.length === 0 && <p className="col-span-3 py-10 text-center text-sm text-muted-foreground">Your binder is empty. Add cards to your collection.</p>}
            </div>
          </div>
        ) : tab === 'Collection' ? (
          <div className="p-4">
            <p className="mb-3 text-sm text-muted-foreground">Portfolio value: <b className="text-foreground">{formatPrice(portfolioValue)}</b></p>
            <NetworkFeedSection type="collections" did={did} limit={24} title="My Collection on the Network" />
          </div>
        ) : tab === 'Trades' ? (
          <div className="p-4">
            <NetworkFeedSection type="trades" did={did} limit={20} title="My Trades on the Network" />
          </div>
        ) : tab === 'Trade Activity' ? (
          <TradeActivityTab />
        ) : tab === 'Reputation' ? (
          <ReputationDashboard reputation={reputation} trades={myTrades} />
        ) : tab === 'Following' ? (
          <FollowingTab />
        ) : tab === 'Journals' ? (
          <JournalsTab journals={myJournals} collection={myCollection} onSaved={load} />
        ) : tab === 'Podcasts' ? (
          <PodcastsTab did={did} />
        ) : tab === 'Cross-Posting' ? (
          <CrossPostTab />
        ) : (
          <div className="p-4 space-y-4">
            <DomainHandleCard />
            <WeeklyDigestToggle />
            <DataPrivacy />
          </div>
        )}
      </div>
      {showGoLive && (
        <GoLiveModal onClose={() => setShowGoLive(false)} onLive={() => { setShowGoLive(false); load(); }} />
      )}
      {showEdit && (
        <EditProfileModal onClose={() => setShowEdit(false)} onSaved={load} />
      )}
    </div>
  );
}