import { lazy, Suspense, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation, useNavigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import { LivePresenceProvider } from '@/lib/livePresence';
import { PodcastPlayerProvider } from '@/lib/podcastPlayer';
import { MembershipProvider } from '@/lib/membershipContext';
import Layout from '@/components/Layout';
import ExternalLinkConfirm from '@/components/ExternalLinkConfirm';
import { I18nProvider } from '@/lib/i18n/I18nProvider';
import { LightboxProvider } from '@/lib/lightboxContext';

// Lazy-load all page components to split the bundle and improve initial paint.
const Home = lazy(() => import('@/pages/Home'));
const Explore = lazy(() => import('@/pages/Explore'));
const DiscoverUsers = lazy(() => import('@/pages/DiscoverUsers'));
const CardDetail = lazy(() => import('@/pages/CardDetail'));
const Collection = lazy(() => import('@/pages/Collection'));
const Sets = lazy(() => import('@/pages/Sets'));
const TradeBoard = lazy(() => import('@/pages/TradeBoard'));
const Profile = lazy(() => import('@/pages/Profile'));
const PackOpenings = lazy(() => import('@/pages/PackOpenings'));
const MarketWatch = lazy(() => import('@/pages/MarketWatch'));
const Share = lazy(() => import('@/pages/Share'));
const PostDetail = lazy(() => import('@/pages/PostDetail'));
const TradeThread = lazy(() => import('@/pages/TradeThread'));
const TradeTemplates = lazy(() => import('@/pages/TradeTemplates'));
const TradeDashboard = lazy(() => import('@/pages/TradeDashboard'));
const TradeStatusBoard = lazy(() => import('@/pages/TradeStatusBoard'));
const Compose = lazy(() => import('@/pages/Compose'));
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const Invite = lazy(() => import('@/pages/Invite'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const Activate = lazy(() => import('@/pages/Activate'));
const StarterPacks = lazy(() => import('@/pages/StarterPacks'));
const StarterPackDetail = lazy(() => import('@/pages/StarterPackDetail'));
const Feeds = lazy(() => import('@/pages/Feeds'));
const BoardDetail = lazy(() => import('@/pages/BoardDetail'));
const CircleDirectory = lazy(() => import('@/pages/CircleDirectory'));
const Labelers = lazy(() => import('@/pages/Labelers'));
const SearchPage = lazy(() => import('@/pages/Search'));
const Grading = lazy(() => import('@/pages/Grading'));
const Binders = lazy(() => import('@/pages/Binders'));
const BinderEdit = lazy(() => import('@/pages/BinderEdit'));
const BinderDetail = lazy(() => import('@/pages/BinderDetail'));
const Trust = lazy(() => import('@/pages/Trust'));
const Predictions = lazy(() => import('@/pages/Predictions'));
const Circles = lazy(() => import('@/pages/Circles'));
const CircleDetail = lazy(() => import('@/pages/CircleDetail'));
const Meetups = lazy(() => import('@/pages/Meetups'));
const MeetupDetail = lazy(() => import('@/pages/MeetupDetail'));
const OnlineCollectors = lazy(() => import('@/pages/OnlineCollectors'));
const UserProfile = lazy(() => import('@/pages/UserProfile'));
const VoiceSpaces = lazy(() => import('@/pages/VoiceSpaces'));
const SpaceRoom = lazy(() => import('@/pages/SpaceRoom'));
const Notifications = lazy(() => import('@/pages/Notifications'));
const Wallet = lazy(() => import('@/pages/Wallet'));
const WalletReceive = lazy(() => import('@/pages/WalletReceive'));
const Settings = lazy(() => import('@/pages/Settings'));
const Help = lazy(() => import('@/pages/Help'));
const Status = lazy(() => import('@/pages/Status'));
const IncidentDetail = lazy(() => import('@/pages/IncidentDetail'));
const Donate = lazy(() => import('@/pages/Donate'));
const DonateThanks = lazy(() => import('@/pages/DonateThanks'));
const FiatSuccess = lazy(() => import('@/pages/FiatSuccess'));
const HelpDonations = lazy(() => import('@/pages/HelpDonations'));
const HelpExplore = lazy(() => import('@/pages/help/HelpExplore'));
const HelpCardDetail = lazy(() => import('@/pages/help/HelpCardDetail'));
const HelpSets = lazy(() => import('@/pages/help/HelpSets'));
const HelpCollection = lazy(() => import('@/pages/help/HelpCollection'));
const HelpGrading = lazy(() => import('@/pages/help/HelpGrading'));
const HelpMarketWatch = lazy(() => import('@/pages/help/HelpMarketWatch'));
const HelpTradeBoard = lazy(() => import('@/pages/help/HelpTradeBoard'));
const HelpTradeStatusBoard = lazy(() => import('@/pages/help/HelpTradeStatusBoard'));
const HelpTradeThread = lazy(() => import('@/pages/help/HelpTradeThread'));
const HelpTradeDashboard = lazy(() => import('@/pages/help/HelpTradeDashboard'));
const HelpTrust = lazy(() => import('@/pages/help/HelpTrust'));
const HelpHomeFeed = lazy(() => import('@/pages/help/HelpHomeFeed'));
const HelpCompose = lazy(() => import('@/pages/help/HelpCompose'));
const HelpPostDetail = lazy(() => import('@/pages/help/HelpPostDetail'));
const HelpHashtags = lazy(() => import('@/pages/help/HelpHashtags'));
const HelpProfiles = lazy(() => import('@/pages/help/HelpProfiles'));
const HelpJournals = lazy(() => import('@/pages/help/HelpJournals'));
const HelpBinders = lazy(() => import('@/pages/help/HelpBinders'));
const HelpCircles = lazy(() => import('@/pages/help/HelpCircles'));
const HelpStarterPacks = lazy(() => import('@/pages/help/HelpStarterPacks'));
const HelpMeetups = lazy(() => import('@/pages/help/HelpMeetups'));
const HelpPackOpenings = lazy(() => import('@/pages/help/HelpPackOpenings'));
const HelpPackParties = lazy(() => import('@/pages/help/HelpPackParties'));
const HelpPullOfTheWeek = lazy(() => import('@/pages/help/HelpPullOfTheWeek'));
const HelpPredictions = lazy(() => import('@/pages/help/HelpPredictions'));
const HelpNotifications = lazy(() => import('@/pages/help/HelpNotifications'));
const HelpMessages = lazy(() => import('@/pages/help/HelpMessages'));
const HelpWhoToFollow = lazy(() => import('@/pages/help/HelpWhoToFollow'));
const HelpShare = lazy(() => import('@/pages/help/HelpShare'));
const HelpVoiceSpaces = lazy(() => import('@/pages/help/HelpVoiceSpaces'));
const HelpPodcasts = lazy(() => import('@/pages/help/HelpPodcasts'));
const HelpChallenges = lazy(() => import('@/pages/help/HelpChallenges'));
const HelpAchievements = lazy(() => import('@/pages/help/HelpAchievements'));
const HelpTradeAssistant = lazy(() => import('@/pages/help/HelpTradeAssistant'));
const HelpMarketWatchAssistant = lazy(() => import('@/pages/help/HelpMarketWatchAssistant'));
const HelpCollectionAdvisor = lazy(() => import('@/pages/help/HelpCollectionAdvisor'));
const HelpSentimentAssistant = lazy(() => import('@/pages/help/HelpSentimentAssistant'));
const HelpAchievementGoalTracker = lazy(() => import('@/pages/help/HelpAchievementGoalTracker'));
const HelpNetworkingConcierge = lazy(() => import('@/pages/help/HelpNetworkingConcierge'));
const HelpSettings = lazy(() => import('@/pages/help/HelpSettings'));
const HelpYourProfile = lazy(() => import('@/pages/help/HelpYourProfile'));
const HelpAccount = lazy(() => import('@/pages/help/HelpAccount'));
const HelpStatus = lazy(() => import('@/pages/help/HelpStatus'));
const HelpAdmin = lazy(() => import('@/pages/help/HelpAdmin'));
const HelpModeration = lazy(() => import('@/pages/help/HelpModeration'));
const HandleProfile = lazy(() => import('@/pages/HandleProfile'));
const Admin = lazy(() => import('@/pages/Admin'));
const Moderation = lazy(() => import('@/pages/Moderation'));
const ModerationAgent = lazy(() => import('@/pages/ModerationAgent'));
const AccountDeleted = lazy(() => import('@/pages/AccountDeleted'));
const OrderComplete = lazy(() => import('@/pages/OrderComplete'));
const WhoToFollow = lazy(() => import('@/pages/WhoToFollow'));
const Achievements = lazy(() => import('@/pages/Achievements'));
const Challenges = lazy(() => import('@/pages/Challenges'));
const ChallengeDetail = lazy(() => import('@/pages/ChallengeDetail'));
const Leaderboard = lazy(() => import('@/pages/Leaderboard'));
const TradeAssistant = lazy(() => import('@/pages/TradeAssistant'));
const MarketWatchAssistant = lazy(() => import('@/pages/MarketWatchAssistant'));
const CollectionAdvisor = lazy(() => import('@/pages/CollectionAdvisor'));
const SentimentConversationalist = lazy(() => import('@/pages/SentimentConversationalist'));
const AchievementGoalTracker = lazy(() => import('@/pages/AchievementGoalTracker'));
const NetworkingConcierge = lazy(() => import('@/pages/NetworkingConcierge'));
const PackParties = lazy(() => import('@/pages/PackParties'));
const PullOfTheWeek = lazy(() => import('@/pages/PullOfTheWeek'));
const Messages = lazy(() => import('@/pages/Messages'));
const Terms = lazy(() => import('@/pages/Terms'));
const Privacy = lazy(() => import('@/pages/Privacy'));
const About = lazy(() => import('@/pages/About'));
const SitemapXml = lazy(() => import('@/pages/SitemapXml'));
const RobotsTxt = lazy(() => import('@/pages/RobotsTxt'));
const JournalDetail = lazy(() => import('@/pages/JournalDetail'));
const HashtagPage = lazy(() => import('@/pages/HashtagPage'));

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Native back-button handling for Android WebView (Cordova/Capacitor).
  // Closes open overlays first; otherwise pops the router history.
  useEffect(() => {
    const onBackButton = (e) => {
      const openOverlay = document.querySelector(
        '[data-state="open"][role="dialog"], [data-state="open"][role="presentation"], .fixed.inset-0.z-50'
      );
      if (openOverlay) {
        openOverlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        e.preventDefault();
      } else if (window.history.length > 1) {
        navigate(-1);
      }
    };
    window.addEventListener('backbutton', onBackButton);
    return () => window.removeEventListener('backbutton', onBackButton);
  }, [navigate]);

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors — only block for unregistered users;
  // expired/missing tokens just render the app as a guest (browsable content)
  if (authError && authError.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  // Render the main app
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" /></div>}>
    <AnimatePresence mode="wait">
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
    <Routes location={location}>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/activate" element={<Activate />} />
      <Route path="/donate" element={<Donate />} />
      <Route path="/donate/thanks" element={<DonateThanks />} />
      <Route path="/donate/fiat-success" element={<FiatSuccess />} />
      <Route path="/account-deleted" element={<AccountDeleted />} />
      <Route path="/invite/:code" element={<Invite />} />
      <Route path="/order-complete" element={<OrderComplete />} />
      <Route path="/status" element={<Status />} />
      <Route path="/sitemap.xml" element={<SitemapXml />} />
      <Route path="/robots.txt" element={<RobotsTxt />} />

      <Route path="/incidents/:incidentId" element={<IncidentDetail />} />
      <Route path="/u/:handle" element={<HandleProfile />} />
      {/* Public browsable content, no login required */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/discover/users" element={<DiscoverUsers />} />
        <Route path="/card/:cardId" element={<CardDetail />} />
        <Route path="/set/:setId" element={<Explore />} />
        <Route path="/sets" element={<Sets />} />
        <Route path="/trades" element={<TradeBoard />} />
        <Route path="/trade-board" element={<TradeStatusBoard />} />
        <Route path="/trade/:tradeId" element={<TradeThread />} />
        <Route path="/packs" element={<PackOpenings />} />
        <Route path="/market" element={<MarketWatch />} />
        <Route path="/share" element={<Share />} />
        <Route path="/post/at/:atUri" element={<PostDetail />} />
        <Route path="/post/:postId" element={<PostDetail />} />
        <Route path="/journal/:journalId" element={<JournalDetail />} />
        <Route path="/binders" element={<Binders />} />
        <Route path="/binder/:binderId" element={<BinderDetail />} />
        <Route path="/trust" element={<Trust />} />
        <Route path="/circles" element={<Circles />} />
        <Route path="/circles/:circleId" element={<CircleDetail />} />
        <Route path="/meetups" element={<Meetups />} />
        <Route path="/meetups/:meetupId" element={<MeetupDetail />} />
        <Route path="/online-now" element={<OnlineCollectors />} />
        <Route path="/profile/:did" element={<UserProfile />} />
        <Route path="/predictions" element={<Predictions />} />
        <Route path="/spaces" element={<VoiceSpaces />} />
        <Route path="/spaces/:spaceId" element={<SpaceRoom />} />
        <Route path="/challenges" element={<Challenges />} />
        <Route path="/challenges/:challengeId" element={<ChallengeDetail />} />
        <Route path="/challenges/:challengeId/leaderboard" element={<Leaderboard />} />
        <Route path="/pack-parties" element={<PackParties />} />
        <Route path="/pull-of-the-week" element={<PullOfTheWeek />} />
        <Route path="/help" element={<Help />} />
        <Route path="/help/donations" element={<HelpDonations />} />
        <Route path="/help/explore" element={<HelpExplore />} />
        <Route path="/help/card-detail" element={<HelpCardDetail />} />
        <Route path="/help/sets" element={<HelpSets />} />
        <Route path="/help/collection" element={<HelpCollection />} />
        <Route path="/help/grading" element={<HelpGrading />} />
        <Route path="/help/market-watch" element={<HelpMarketWatch />} />
        <Route path="/help/trade-board" element={<HelpTradeBoard />} />
        <Route path="/help/trade-status-board" element={<HelpTradeStatusBoard />} />
        <Route path="/help/trade-threads" element={<HelpTradeThread />} />
        <Route path="/help/trade-dashboard" element={<HelpTradeDashboard />} />
        <Route path="/help/trust" element={<HelpTrust />} />
        <Route path="/help/home-feed" element={<HelpHomeFeed />} />
        <Route path="/help/compose" element={<HelpCompose />} />
        <Route path="/help/post-detail" element={<HelpPostDetail />} />
        <Route path="/help/hashtags" element={<HelpHashtags />} />
        <Route path="/help/profiles" element={<HelpProfiles />} />
        <Route path="/help/journals" element={<HelpJournals />} />
        <Route path="/help/binders" element={<HelpBinders />} />
        <Route path="/help/circles" element={<HelpCircles />} />
        <Route path="/help/starter-packs" element={<HelpStarterPacks />} />
        <Route path="/help/meetups" element={<HelpMeetups />} />
        <Route path="/help/pack-openings" element={<HelpPackOpenings />} />
        <Route path="/help/pack-parties" element={<HelpPackParties />} />
        <Route path="/help/pull-of-the-week" element={<HelpPullOfTheWeek />} />
        <Route path="/help/predictions" element={<HelpPredictions />} />
        <Route path="/help/notifications" element={<HelpNotifications />} />
        <Route path="/help/messages" element={<HelpMessages />} />
        <Route path="/help/who-to-follow" element={<HelpWhoToFollow />} />
        <Route path="/help/share" element={<HelpShare />} />
        <Route path="/help/voice-spaces" element={<HelpVoiceSpaces />} />
        <Route path="/help/podcasts" element={<HelpPodcasts />} />
        <Route path="/help/challenges" element={<HelpChallenges />} />
        <Route path="/help/achievements" element={<HelpAchievements />} />
        <Route path="/help/trade-assistant" element={<HelpTradeAssistant />} />
        <Route path="/help/market-watch-assistant" element={<HelpMarketWatchAssistant />} />
        <Route path="/help/collection-advisor" element={<HelpCollectionAdvisor />} />
        <Route path="/help/sentiment-assistant" element={<HelpSentimentAssistant />} />
        <Route path="/help/achievement-goal-tracker" element={<HelpAchievementGoalTracker />} />
        <Route path="/help/networking-concierge" element={<HelpNetworkingConcierge />} />
        <Route path="/help/settings" element={<HelpSettings />} />
        <Route path="/help/your-profile" element={<HelpYourProfile />} />
        <Route path="/help/account" element={<HelpAccount />} />
        <Route path="/help/status" element={<HelpStatus />} />
        <Route path="/help/admin" element={<HelpAdmin />} />
        <Route path="/help/moderation" element={<HelpModeration />} />
        <Route path="/about" element={<About />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/hashtag/:tag" element={<HashtagPage />} />
        <Route path="/starter-packs" element={<StarterPacks />} />
        <Route path="/starter-packs/:packId" element={<StarterPackDetail />} />
        <Route path="/feeds" element={<Feeds />} />
        <Route path="/boards/:boardId" element={<BoardDetail />} />
        <Route path="/circles-directory" element={<CircleDirectory />} />
        <Route path="/labelers" element={<Labelers />} />
        <Route path="/search" element={<SearchPage />} />
      </Route>
      {/* Auth required, login gate */}
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<Layout />}>
          <Route path="/compose" element={<Compose />} />
          <Route path="/collection" element={<Collection />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/grading" element={<Grading />} />
          <Route path="/binders/new" element={<BinderEdit />} />
          <Route path="/binder/:binderId/edit" element={<BinderEdit />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/trade-dashboard" element={<TradeDashboard />} />
          <Route path="/trade-templates" element={<TradeTemplates />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/messages/:conversationId" element={<Messages />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/wallet/receive" element={<WalletReceive />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/moderation" element={<Moderation />} />
          <Route path="/moderation-agent" element={<ModerationAgent />} />
          <Route path="/who-to-follow" element={<WhoToFollow />} />
          <Route path="/achievements" element={<Achievements />} />
          <Route path="/trade-assistant" element={<TradeAssistant />} />
          <Route path="/market-watch-assistant" element={<MarketWatchAssistant />} />
          <Route path="/collection-advisor" element={<CollectionAdvisor />} />
          <Route path="/sentiment-conversationalist" element={<SentimentConversationalist />} />
          <Route path="/achievement-goal-tracker" element={<AchievementGoalTracker />} />
          <Route path="/networking-concierge" element={<NetworkingConcierge />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </motion.div>
    </AnimatePresence>
    </Suspense>
  );
};


function App() {

  return (
    <AuthProvider>
      <I18nProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <LivePresenceProvider>
            <PodcastPlayerProvider>
              <MembershipProvider>
                <LightboxProvider>
                  <AuthenticatedApp />
                </LightboxProvider>
              </MembershipProvider>
            </PodcastPlayerProvider>
          </LivePresenceProvider>
        </Router>
        <ExternalLinkConfirm />
        <Toaster />
      </QueryClientProvider>
      </I18nProvider>
    </AuthProvider>
  )
}

export default App