import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Star, Mic, Share2, SlidersHorizontal, Lock } from 'lucide-react';
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
import ImmersiveProfile from '@/components/profile/ImmersiveProfile';
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
import { usePaginatedPosts } from '@/hooks/usePaginatedPosts';
import { useOwnProfileConfig } from '@/hooks/useProfileConfig';
import { themeGradient, DEFAULT_OWNER_SECTIONS, ALL_TAB_LABELS } from '@/lib/profileThemes';
import RichText from '@/components/RichText';
import GuideFooterLink from '@/components/help/GuideFooterLink';
import MovedFromBlueskyBadge from '@/components/profile/MovedFromBlueskyBadge';
import OnChainBadge from '@/components/blockchain/OnChainBadge';
import DynamicNftAvatar from '@/components/blockchain/DynamicNftAvatar';
import { useT } from '@/lib/i18n/I18nProvider';
import useSEO from '@/hooks/useSEO';

export default function Profile() {
  const t = useT();
  useSEO({
    title: 'My Profile',
    description: 'View and edit your SwapPulse collector profile, posts, trades, and collections.',
    canonicalPath: '/profile',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      name: 'My SwapPulse Profile',
      description: 'View and edit your SwapPulse collector profile, posts, trades, and collections.',
      url: 'https://swappulse.org/profile',
    },
  });
  const { user } = useAuth();
  const [tab, setTab] = useState('Posts');
  const [collection, setCollection] = useState([]);
  const [trades, setTrades] = useState([]);
  const [did, setDid] = useState('');
  const { posts, loadingMore, hasMore, loadMore } = usePaginatedPosts(did, false);
  const [reputation, setReputation] = useState([]);
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveSpace, setLiveSpace] = useState(null);
  const [showGoLive, setShowGoLive] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [ending, setEnding] = useState(false);
  const [onChainAssets, setOnChainAssets] = useState([]);
  const reverted = !!user?.migration_reverted;

  // Merged profile overlays live Bluesky identity (remote wins for shared
  // fields) on top of the local user record for the header display.
  const { profile: merged, reload: reloadMerged } = useMergedProfile({ did });
  // Owner's enhanced profile config (personal info, milestones, theme, layout).
  const { config, saving: configSaving, save: saveConfig, reload: reloadConfig } = useOwnProfileConfig();

  const load = async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const { did: myDid } = await ensureUserDid();
      setDid(myDid);
      const [c, t, r, j, vs, oa] = await Promise.all([
        base44.entities.CollectionEntry.filter({ created_by_id: user.id }, '-updated_date', 100),
        base44.entities.TradeListing.filter({ created_by_id: user.id }, '-created_date', 20),
        base44.entities.Reputation.filter({ did: myDid }, '-created_date', 50).catch(() => []),
        base44.entities.Journal.filter({ created_by_id: user.id }, '-created_date', 50),
        base44.entities.VoiceSpace.filter({ did: myDid, status: 'live' }, '-created_date', 1).catch(() => []),
        base44.entities.OnChainAsset.filter({ owner_did: myDid }, '-minted_at', 50).catch(() => []),
      ]);
      setCollection(c);
      setTrades(t);
      setReputation(r);
      setJournals(j);
      setLiveSpace(vs[0] || null);
      setOnChainAssets(oa);
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
  const sectionLabels = { ...ALL_TAB_LABELS, ...Object.fromEntries(baseTabs.map((b) => [b.key, b.label])) };
  const order = config?.section_order?.length ? config.section_order : DEFAULT_OWNER_SECTIONS;
  const hidden = new Set(config?.hidden_sections || []);
  const tabs = order
    .map((k) => baseTabs.find((b) => b.key === k))
    .filter(Boolean)
    .concat(baseTabs.filter((b) => !order.includes(b.key)))
    .filter((b) => b.key === 'Posts' || !hidden.has(b.key));

  return (
    <div>
      {reverted && !loading && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/5 px-4 py-2.5">
          <Lock className="h-4 w-4 shrink-0 text-warning" />
          <p className="text-xs text-muted-foreground">
            {t('migration.revertedNotice')}
          </p>
        </div>
      )}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <ImmersiveProfile
          theme="default"
          isOwner
          did={did}
          profile={{
            name: merged?.name || user?.display_name || user?.full_name,
            avatar: merged?.avatar || user?.avatar,
            header: merged?.header || user?.header,
            bsky_handle: user?.bsky_handle,
            username: user?.username,
            handle_verified: user?.handle_verified,
            remote_synced: !!merged?.remote_synced,
            description: merged?.description || user?.description,
            pinned_post_id: user?.pinned_post_id || '',
            followers_count: merged?.followers_count || 0,
            follows_count: merged?.follows_count || 0,
            posts_count: merged?.posts_count || myPosts.length,
          }}
          config={config}
          posts={myPosts}
          collection={myCollection}
          trades={myTrades}
          reputation={reputation}
          journals={myJournals}
          liveSpace={liveSpace}
          loadingMore={loadingMore}
          hasMore={hasMore}
          loadMore={loadMore}
          actions={
            <>
              <button onClick={() => setShowEdit(true)} disabled={reverted} className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed">{reverted ? <><Lock className="h-3 w-3" /> {t('migration.editLocked')}</> : t('profile.editProfile')}</button>
              <button onClick={() => setShowCustomize(true)} disabled={reverted} className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"><SlidersHorizontal className="h-3.5 w-3.5" /> Customize</button>
              <GoLiveControl liveSpace={liveSpace} onOpenModal={() => setShowGoLive(true)} onEndStream={endStream} ending={ending} />
            </>
          }
          badges={
            <>
              {user?.migrated_from_bluesky && <MovedFromBlueskyBadge size="md" />}
              {onChainAssets.length > 0 && <OnChainBadge />}
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
          reputationNode={repAvg && (
            <span className="flex items-center gap-1 text-sm text-accent">
              <Star className="h-3.5 w-3.5 fill-current" />
              {t('profile.trustedTrader')} · {repAvg}★ ({reputation.length})
            </span>
          )}
          avatarBadge={liveSpace && <LiveCountdownBadge autoEndAt={liveSpace.auto_end_at} />}
          onReload={load}
        />
      )}

      {/* Dynamic NFT avatar — shows when the collector has minted a username NFT.
          The @username appears at the top and the visual updates automatically
          whenever profile details or avatar change (via username-nft-metadata). */}
      {!loading && (() => {
        const usernameNft = onChainAssets.find(a => a.asset_type === 'username');
        if (!usernameNft) return null;
        return (
          <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-raised">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase text-muted-foreground">Dynamic NFT Avatar</h3>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">Live</span>
            </div>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:gap-4">
              <DynamicNftAvatar
                handle={usernameNft.handle || user?.bsky_handle || user?.username || ''}
                displayName={merged?.name || user?.display_name || user?.full_name}
                avatar={merged?.avatar || user?.avatar}
                memberSince={user?.created_date}
                did={did}
                size="md"
              />
              <div className="flex-1 text-sm text-muted-foreground">
                <p>Your profile avatar is minted as a soulbound NFT on Polygon. The @username appears at the top and the visual updates automatically whenever you edit your profile details or avatar — no re-minting needed.</p>
                <p className="mt-2 text-xs">Token ID: #{usernameNft.token_id} · Contract: {usernameNft.contract_address?.slice(0, 10)}…</p>
              </div>
            </div>
          </div>
        );
      })()}

      {showGoLive && (
        <GoLiveModal onClose={() => setShowGoLive(false)} onLive={() => { setShowGoLive(false); load(); }} />
      )}
      {showEdit && (
        <EditProfileModal onClose={() => setShowEdit(false)} onSaved={() => { load(); reloadMerged(); }} />
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