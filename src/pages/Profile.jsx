import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Star, Mic, Share2, SlidersHorizontal } from 'lucide-react';
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
import ProfileEditorModal from '@/components/profile/ProfileEditorModal';
import PersonalInfoSection from '@/components/profile/PersonalInfoSection';
import MilestonesTimeline from '@/components/profile/MilestonesTimeline';
import EngagementHub from '@/components/profile/EngagementHub';
import NetworkFeedSection from '@/components/feed/NetworkFeedSection';
import FollowingTab from '@/components/profile/FollowingTab';
import ActivityTab from '@/components/profile/ActivityTab';
import ProfileHandle from '@/components/profile/ProfileHandle';
import ProfileMetricsBar from '@/components/profile/ProfileMetricsBar';
import ProfileHeader from '@/components/profile/ProfileHeader';
import ProfileTabNav from '@/components/profile/ProfileTabNav';
import { useMergedProfile } from '@/hooks/useMergedProfile';
import { useOwnProfileConfig } from '@/hooks/useProfileConfig';
import { themeGradient, DEFAULT_OWNER_SECTIONS } from '@/lib/profileThemes';
import RichText from '@/components/RichText';
import GuideFooterLink from '@/components/help/GuideFooterLink';
import { useT } from '@/lib/i18n/I18nProvider';

export default function Profile() {
  const t = useT();
  const { user } = useAuth();
  const [tab, setTab] = useState('Posts');
  const [posts, setPosts] = useState([]);
  const [collection, setCollection] = useState([]);
  const [trades, setTrades] = useState([]);
  const [did, setDid] = useState('');
  const [reputation, setReputation] = useState([]);
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveSpace, setLiveSpace] = useState(null);
  const [showGoLive, setShowGoLive] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [ending, setEnding] = useState(false);

  // Merged profile overlays live Bluesky identity (remote wins for shared
  // fields) on top of the local user record for the header display.
  const { profile: merged } = useMergedProfile({ did });
  // Owner's enhanced profile config (personal info, milestones, theme, layout).
  const { config, saving: configSaving, save: saveConfig, reload: reloadConfig } = useOwnProfileConfig();

  const load = async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const { did: myDid } = await ensureUserDid();
      setDid(myDid);
      const [p, c, t, r, j, vs] = await Promise.all([
        base44.entities.Post.filter({ created_by_id: user.id }, '-created_date', 50),
        base44.entities.CollectionEntry.filter({ created_by_id: user.id }, '-updated_date', 100),
        base44.entities.TradeListing.filter({ created_by_id: user.id }, '-created_date', 20),
        base44.entities.Reputation.filter({ did: myDid }, '-created_date', 50).catch(() => []),
        base44.entities.Journal.filter({ created_by_id: user.id }, '-created_date', 50),
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

  useEffect(() => { if (user?.id) load(); }, [user?.id]);

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

  const myPosts = posts;
  const myCollection = collection;
  const myTrades = trades;
  const myJournals = journals;
  const portfolioValue = myCollection.reduce((s, c) => s + (c.market_value || c.purchase_price || 0), 0);
  const binderCards = myCollection.slice(0, 9);

  // Base tab definitions (with the new enhanced sections). The owner's
  // section_order/hidden_sections from ProfileConfig reorder and toggle these.
  const baseTabs = [
    { key: 'About', label: 'About' },
    { key: 'Posts', label: t('profile.tab.posts') },
    { key: 'Journey', label: 'Journey' },
    { key: 'Hub', label: 'Hub' },
    { key: 'Activity', label: t('profile.tab.activity') },
    { key: 'Binder', label: t('profile.tab.binder') },
    { key: 'Collection', label: t('profile.tab.collection') },
    { key: 'Trades', label: t('profile.tab.trades') },
    { key: 'Trade Activity', label: t('profile.tab.tradeActivity') },
    { key: 'Reputation', label: t('profile.tab.reputation') },
    { key: 'Following', label: t('profile.tab.following') },
    { key: 'Journals', label: t('profile.tab.journals') },
    { key: 'Podcasts', label: t('profile.tab.podcasts'), icon: <Mic className="h-4 w-4" /> },
    { key: 'Cross-Posting', label: t('profile.tab.crossPosting'), icon: <Share2 className="h-4 w-4" /> },
    { key: 'Privacy', label: t('profile.tab.privacy') },
  ];
  const sectionLabels = Object.fromEntries(baseTabs.map((b) => [b.key, b.label]));
  const order = config?.section_order?.length ? config.section_order : DEFAULT_OWNER_SECTIONS;
  const hidden = new Set(config?.hidden_sections || []);
  const tabs = order
    .map((k) => baseTabs.find((b) => b.key === k))
    .filter(Boolean)
    .concat(baseTabs.filter((b) => !order.includes(b.key)))
    .filter((b) => b.key === 'Posts' || !hidden.has(b.key));

  return (
    <div>
      <ProfileHeader
        banner={merged?.header || user?.header}
        bannerHeight="h-32 sm:h-40"
        bannerGradient={themeGradient(config?.theme)}
        avatar={
          <LiveAvatar
            did={did}
            name={merged?.name || user?.display_name || user?.full_name}
            src={merged?.avatar || user?.avatar}
            size={96}
            className="ring-4 ring-background"
          />
        }
        avatarBadge={liveSpace && <LiveCountdownBadge autoEndAt={liveSpace.auto_end_at} />}
        name={merged?.name || user?.display_name || user?.full_name || t('profile.collector')}
        handleNode={
          <ProfileHandle
            bskyHandle={user?.bsky_handle}
            username={user?.username}
            did={did}
            verified={user?.handle_verified}
            syncedFromBsky={!!merged?.remote_synced}
          />
        }
        metricsNode={
          <ProfileMetricsBar
            followers={merged?.followers_count || 0}
            following={merged?.follows_count || 0}
            posts={myPosts.length}
          />
        }
        description={(merged?.description || user?.description) && (
          <RichText text={merged?.description || user.description} className="text-sm" />
        )}
        reputationNode={repAvg && (
          <span className="flex items-center gap-1 text-sm text-accent">
            <Star className="h-3.5 w-3.5 fill-current" />
            {t('profile.trustedTrader')} · {repAvg}★ ({reputation.length})
          </span>
        )}
        actions={
          <>
            <button
              onClick={() => setShowEdit(true)}
              className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
            >
              {t('profile.editProfile')}
            </button>
            <button
              onClick={() => setShowCustomize(true)}
              className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" /> Customize
            </button>
            <GoLiveControl liveSpace={liveSpace} onOpenModal={() => setShowGoLive(true)} onEndStream={endStream} ending={ending} />
          </>
        }
        extra={
          <>
            <div><NotificationToggle /></div>
            <div className="flex gap-4 text-sm">
              <span><b>{myCollection.length}</b> <span className="text-muted-foreground">{t('page.collection.stats.cards')}</span></span>
              <span><b>{myTrades.length}</b> <span className="text-muted-foreground">{t('profile.tab.trades')}</span></span>
            </div>
          </>
        }
      />

      <div className="px-4">
        <ProfileTabNav tabs={tabs} activeTab={tab} onChange={setTab} primaryCount={5} />

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : tab === 'About' ? (
          <div className="py-4"><PersonalInfoSection data={config} isOwner /></div>
        ) : tab === 'Journey' ? (
          <div className="py-4"><MilestonesTimeline milestones={config?.milestones || []} /></div>
        ) : tab === 'Hub' ? (
          <div className="py-4"><EngagementHub did={did} /></div>
        ) : tab === 'Posts' ? (
          myPosts.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">{t('userProfile.noPostsYet')}</p>
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
              {binderCards.length === 0 && <p className="col-span-3 py-10 text-center text-sm text-muted-foreground">{t('profile.binderEmpty')}</p>}
            </div>
          </div>
        ) : tab === 'Collection' ? (
          <div className="p-4">
            <p className="mb-3 text-sm text-muted-foreground">{t('profile.portfolioValue')} <b className="text-foreground">{formatPrice(portfolioValue)}</b></p>
            <NetworkFeedSection type="collections" did={did} limit={24} title={t('profile.myCollectionNetwork')} />
          </div>
        ) : tab === 'Trades' ? (
          <div className="p-4">
            <NetworkFeedSection type="trades" did={did} limit={20} title={t('profile.myTradesNetwork')} />
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
      {showCustomize && (
        <ProfileEditorModal
          config={config}
          saving={configSaving}
          sectionLabels={sectionLabels}
          onClose={() => setShowCustomize(false)}
          onSave={async (draft) => { await saveConfig(draft); reloadConfig(); }}
        />
      )}
      <GuideFooterLink slug="your-profile" />
    </div>
  );
}