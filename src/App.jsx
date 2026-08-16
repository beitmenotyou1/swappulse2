import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import { LivePresenceProvider } from '@/lib/livePresence';
import { PodcastPlayerProvider } from '@/lib/podcastPlayer';
import { MembershipProvider } from '@/lib/membershipContext';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import Explore from '@/pages/Explore';
import CardDetail from '@/pages/CardDetail';
import Collection from '@/pages/Collection';
import Sets from '@/pages/Sets';
import TradeBoard from '@/pages/TradeBoard';
import Profile from '@/pages/Profile';
import PackOpenings from '@/pages/PackOpenings';
import MarketWatch from '@/pages/MarketWatch';
import Share from '@/pages/Share';
import PostDetail from '@/pages/PostDetail';
import TradeThread from '@/pages/TradeThread';
import TradeDashboard from '@/pages/TradeDashboard';
import TradeStatusBoard from '@/pages/TradeStatusBoard';
import Compose from '@/pages/Compose';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Activate from '@/pages/Activate';
// Add page imports here
import Scanner from '@/pages/Scanner';
import Grading from '@/pages/Grading';
import Binders from '@/pages/Binders';
import BinderEdit from '@/pages/BinderEdit';
import BinderDetail from '@/pages/BinderDetail';
import Trust from '@/pages/Trust';
import Predictions from '@/pages/Predictions';
import Circles from '@/pages/Circles';
import CircleDetail from '@/pages/CircleDetail';
import Meetups from '@/pages/Meetups';
import MeetupDetail from '@/pages/MeetupDetail';
import UserProfile from '@/pages/UserProfile';
import VoiceSpaces from '@/pages/VoiceSpaces';
import SpaceRoom from '@/pages/SpaceRoom';
import Notifications from '@/pages/Notifications';
import Settings from '@/pages/Settings';
import Help from '@/pages/Help';
import Status from '@/pages/Status';
import IncidentDetail from '@/pages/IncidentDetail';
import Donate from '@/pages/Donate';
import DonateThanks from '@/pages/DonateThanks';
import HandleProfile from '@/pages/HandleProfile';
import Admin from '@/pages/Admin';
import Moderation from '@/pages/Moderation';
import ModerationAgent from '@/pages/ModerationAgent';
import AccountDeleted from '@/pages/AccountDeleted';
import OrderComplete from '@/pages/OrderComplete';
import WhoToFollow from '@/pages/WhoToFollow';
import Achievements from '@/pages/Achievements';
import Challenges from '@/pages/Challenges';
import ChallengeDetail from '@/pages/ChallengeDetail';
import Leaderboard from '@/pages/Leaderboard';
import TradeAssistant from '@/pages/TradeAssistant';
import MarketWatchAssistant from '@/pages/MarketWatchAssistant';
import CollectionAdvisor from '@/pages/CollectionAdvisor';
import SentimentConversationalist from '@/pages/SentimentConversationalist';
import AchievementGoalTracker from '@/pages/AchievementGoalTracker';
import NetworkingConcierge from '@/pages/NetworkingConcierge';
import PackParties from '@/pages/PackParties';
import PullOfTheWeek from '@/pages/PullOfTheWeek';
import Messages from '@/pages/Messages';
import Terms from '@/pages/Terms';
import Privacy from '@/pages/Privacy';
import SitemapXml from '@/pages/SitemapXml';
import RobotsTxt from '@/pages/RobotsTxt';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

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
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/activate" element={<Activate />} />
      <Route path="/donate" element={<Donate />} />
      <Route path="/donate/thanks" element={<DonateThanks />} />
      <Route path="/account-deleted" element={<AccountDeleted />} />
      <Route path="/order-complete" element={<OrderComplete />} />
      <Route path="/status" element={<Status />} />
      <Route path="/sitemap.xml" element={<SitemapXml />} />
      <Route path="/robots.txt" element={<RobotsTxt />} />
      <Route path="/incidents/:incidentId" element={<IncidentDetail />} />
      <Route path="/u/:handle" element={<HandleProfile />} />
      {/* Public browsable content — no login required */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/card/:cardId" element={<CardDetail />} />
        <Route path="/set/:setId" element={<Explore />} />
        <Route path="/sets" element={<Sets />} />
        <Route path="/trades" element={<TradeBoard />} />
        <Route path="/trade-board" element={<TradeStatusBoard />} />
        <Route path="/trade/:tradeId" element={<TradeThread />} />
        <Route path="/packs" element={<PackOpenings />} />
        <Route path="/market" element={<MarketWatch />} />
        <Route path="/share" element={<Share />} />
        <Route path="/post/:postId" element={<PostDetail />} />
        <Route path="/binders" element={<Binders />} />
        <Route path="/binder/:binderId" element={<BinderDetail />} />
        <Route path="/trust" element={<Trust />} />
        <Route path="/circles" element={<Circles />} />
        <Route path="/circles/:circleId" element={<CircleDetail />} />
        <Route path="/meetups" element={<Meetups />} />
        <Route path="/meetups/:meetupId" element={<MeetupDetail />} />
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
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
      </Route>
      {/* Auth required — login gate */}
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<Layout />}>
          <Route path="/compose" element={<Compose />} />
          <Route path="/collection" element={<Collection />} />
          <Route path="/scan" element={<Scanner />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/grading" element={<Grading />} />
          <Route path="/binders/new" element={<BinderEdit />} />
          <Route path="/binder/:binderId/edit" element={<BinderEdit />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/trade-dashboard" element={<TradeDashboard />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/messages/:conversationId" element={<Messages />} />
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
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <LivePresenceProvider>
            <PodcastPlayerProvider>
              <MembershipProvider>
                <AuthenticatedApp />
              </MembershipProvider>
            </PodcastPlayerProvider>
          </LivePresenceProvider>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App