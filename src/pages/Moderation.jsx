import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { ShieldAlert, RefreshCw, Filter } from 'lucide-react';
import KpiStrip from '@/components/moderation/KpiStrip';
import FilterSidebar from '@/components/moderation/FilterSidebar';
import FlaggedPostsTable from '@/components/moderation/FlaggedPostsTable';
import ReviewPanel from '@/components/moderation/ReviewPanel';
import ActivityFeed from '@/components/moderation/ActivityFeed';
import BulkActions from '@/components/moderation/BulkActions';
import TradeDisputesSection from '@/components/moderation/TradeDisputesSection';
import AccountEnforcementSection from '@/components/moderation/AccountEnforcementSection';
import BotAttemptsSection from '@/components/moderation/BotAttemptsSection';
import ManualReviewQueue from '@/components/moderation/ManualReviewQueue';
import GuideFooterLink from '@/components/help/GuideFooterLink';
import { useT } from '@/lib/i18n/I18nProvider';
import useSEO from '@/hooks/useSEO';

const DEFAULT_FILTERS = {
  severity: [],
  labelType: [],
  timeframe: '7d',
  authorDid: '',
  status: ['pending'],
  confidenceMin: 0,
};

export default function Moderation() {
  const t = useT();
  useSEO({
    title: 'Moderation Dashboard',
    description: 'Review flagged content, manage trade disputes, and enforce community standards on SwapPulse.',
    canonicalPath: '/moderation',
  });
  const { user } = useAuth();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [posts, setPosts] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ pending: 0, resolvedToday: 0, highSeverity: 0, avgResponseMin: 0, escalations: 0, autoResolved: 0, total: 0 });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [resolving, setResolving] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [tab, setTab] = useState('posts');

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('moderation', { op: 'list', ...filters, page, pageSize: 20 });
      setPosts(res.data.posts || []);
      setTotalCount(res.data.totalCount || 0);
      setTotalPages(res.data.totalPages || 1);
    } catch (e) {
      console.error('moderation list failed', e);
    }
    setLoading(false);
  }, [filters, page]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('moderation', { op: 'stats', ...filters });
      setStats(res.data.stats || stats);
    } catch (e) {
      console.error('moderation stats failed', e);
    }
  }, [filters]);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('moderation', { op: 'activity' });
      setLogs(res.data.logs || []);
    } catch (e) {
      console.error('moderation activity failed', e);
    }
  }, []);

  useEffect(() => {
    fetchList();
    fetchStats();
  }, [fetchList, fetchStats]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  // Real-time refresh when posts change (new flags / resolutions)
  useEffect(() => {
    const unsubscribe = base44.entities.Post.subscribe(() => {
      fetchList();
      fetchStats();
      fetchActivity();
    });
    return unsubscribe;
  }, [fetchList, fetchStats, fetchActivity]);

  const onFiltersChange = (next) => {
    setFilters(next);
    setPage(1);
  };

  const toggleSelect = (id) =>
    setSelectedIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const clearSelection = () => setSelectedIds([]);

  const handleResolve = async (decision, notes) => {
    if (!selectedPost) return;
    setResolving(true);
    try {
      await base44.functions.invoke('moderation', { op: 'resolve', post_id: selectedPost.id, decision, notes });
      setSelectedPost(null);
      fetchList();
      fetchStats();
      fetchActivity();
    } catch (e) {
      console.error('resolve failed', e);
    }
    setResolving(false);
  };

  const handleBulk = async (action) => {
    setResolving(true);
    try {
      await base44.functions.invoke('moderation', { op: 'bulk', post_ids: selectedIds, action });
      clearSelection();
      fetchList();
      fetchStats();
      fetchActivity();
    } catch (e) {
      console.error('bulk failed', e);
    }
    setResolving(false);
  };

  if (user?.role !== 'admin' && user?.role !== 'moderator') {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <h1 className="text-xl font-bold">{t('moderation.staffOnly')}</h1>
        <p className="text-sm text-muted-foreground">{t('moderation.staffOnlySub')}</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('moderation.title')} subtitle={t('moderation.subtitle')}>
        <Button variant="outline" size="sm" onClick={() => { fetchList(); fetchStats(); fetchActivity(); }}>
          <RefreshCw className="h-4 w-4" /> {t('moderation.refresh')}
        </Button>
      </PageHeader>

      <div className="mx-auto max-w-7xl space-y-4 p-4">
        <div className="flex gap-2 border-b border-border">
          {[
            ['review', 'AI Review Queue'],
            ['posts', t('moderation.tab.posts')],
            ['disputes', t('moderation.tab.disputes')],
            ['enforcement', t('moderation.tab.enforcement')],
            ['bots', t('moderation.tab.bots')],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`relative px-3 py-2.5 text-sm font-semibold transition-colors ${tab === key ? 'text-foreground' : 'text-muted-foreground hover:bg-secondary'}`}
            >
              {label}
              {tab === key && <span className="absolute bottom-0 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-primary" />}
            </button>
          ))}
        </div>

        {tab === 'review' ? (
          <ManualReviewQueue />
        ) : tab === 'disputes' ? (
          <TradeDisputesSection />
        ) : tab === 'enforcement' ? (
          <AccountEnforcementSection />
        ) : tab === 'bots' ? (
          <BotAttemptsSection />
        ) : (
          <>
        <KpiStrip stats={stats} />
        <BulkActions selectedCount={selectedIds.length} onBulk={handleBulk} onClear={clearSelection} />

        <Button
          variant="outline"
          className="w-full lg:hidden"
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
        >
          <Filter className="h-4 w-4" />
          {showFilters ? t('moderation.hideFilters') : t('moderation.showFilters')}
        </Button>

        <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-4">
          <div className={`${showFilters ? 'block' : 'hidden'} lg:block`}>
            <div className="lg:sticky lg:top-20">
              <FilterSidebar filters={filters} onChange={onFiltersChange} />
            </div>
          </div>
          <div className="mt-4 space-y-4 lg:mt-0">
            <FlaggedPostsTable
              rows={posts}
              loading={loading}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onSelect={(row) => setSelectedPost(row)}
              page={page}
              totalPages={totalPages}
              totalCount={totalCount}
              onPage={setPage}
            />
            <ActivityFeed logs={logs} onRefresh={fetchActivity} />
          </div>
        </div>
          </>
        )}
      </div>

      <ReviewPanel post={selectedPost} open={!!selectedPost} onClose={() => setSelectedPost(null)} onResolve={handleResolve} resolving={resolving} />
      <GuideFooterLink slug="moderation" />
    </div>
  );
}