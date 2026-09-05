import React, { useEffect, useMemo, useState } from 'react';
import { Radio, Headphones, Loader2, Users, Clock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import LiveStreamCard from '@/components/spaces/LiveStreamCard';
import GoLiveModal from '@/components/spaces/GoLiveModal';
import EpisodeCard from '@/components/podcast/EpisodeCard';
import { useRealtimeEvent } from '@/hooks/useRealtimeEvent';
import useSEO from '@/hooks/useSEO';
import DocumentationLink from '@/components/DocumentationLink';
import { useT } from '@/lib/i18n/I18nProvider';

// Platform names are proper nouns — no translation needed.

const TABS = [
  { key: 'live', tKey: 'spaces.tab.live', Icon: Radio },
  { key: 'recordings', tKey: 'spaces.tab.recordings', Icon: Headphones },
];

export default function VoiceSpaces() {
  const t = useT();
  useSEO({
    title: 'Voice Spaces',
    description: 'Join live Pokémon TCG audio spaces on SwapPulse, go live with external streams or host in-platform voice rooms.',
    canonicalPath: '/spaces',
  });
  const [spaces, setSpaces] = useState([]);
  const [podcasts, setPodcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGoLive, setShowGoLive] = useState(false);
  const [tab, setTab] = useState('live');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [sortBy, setSortBy] = useState('viewers');

  const load = async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        base44.entities.VoiceSpace.list('-created_date', 200),
        base44.entities.PodcastEpisode.list('-published_at', 50),
      ]);
      setSpaces(s);
      setPodcasts(p);
    } catch {
      setSpaces([]);
      setPodcasts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useRealtimeEvent('space.started', load);
  useRealtimeEvent('space.ended', load);
  useRealtimeEvent('podcast.new', load);

  const live = useMemo(
    () => spaces.filter((s) => s.status === 'live' && s.stream_url),
    [spaces],
  );

  const platformCounts = useMemo(() => {
    const counts = {};
    for (const s of live) {
      const p = s.platform || 'custom';
      counts[p] = (counts[p] || 0) + 1;
    }
    return counts;
  }, [live]);

  const visible = useMemo(() => {
    const filtered = platformFilter === 'all'
      ? live
      : live.filter((s) => (s.platform || 'custom') === platformFilter);
    return [...filtered].sort((a, b) =>
      sortBy === 'viewers'
        ? (b.viewer_count_estimate || 0) - (a.viewer_count_estimate || 0)
        : new Date(b.started_at || b.created_date) - new Date(a.started_at || a.created_date),
    );
  }, [live, platformFilter, sortBy]);

  return (
    <div>
      <PageHeader title={t('page.spaces.title')} subtitle={t('page.spaces.subtitle')}>
        <button
          onClick={() => setShowGoLive(true)}
          className="live-go-pulse flex items-center gap-1.5 rounded-full bg-destructive px-4 py-2 text-sm font-bold text-white"
        >
          <Radio className="h-4 w-4" /> {t('page.spaces.goLive')}
        </button>
      </PageHeader>

      <div className="flex border-b border-border">
        {TABS.map(({ key, tKey, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`relative flex-1 py-3 text-sm font-semibold transition-colors ${tab === key ? 'text-foreground' : 'text-muted-foreground hover:bg-secondary'}`}
          >
            <span className="flex items-center justify-center gap-1.5"><Icon className="h-4 w-4" /> {t(tKey)}</span>
            {tab === key && <span className="absolute bottom-0 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-primary" />}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : tab === 'live' ? (
        <div className="p-4">
          {live.length > 0 && (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setPlatformFilter('all')}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold ${platformFilter === 'all' ? 'bg-primary text-primary-foreground' : 'border border-border bg-background'}`}
                >
                  {t('spaces.all')} ({live.length})
                </button>
                {Object.entries(platformCounts).map(([p, c]) => (
                  <button
                    key={p}
                    onClick={() => setPlatformFilter(p)}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold ${platformFilter === p ? 'bg-primary text-primary-foreground' : 'border border-border bg-background'}`}
                  >
                    {p} ({c})
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-1 rounded-xl border border-border bg-background p-1">
                  <button
                    onClick={() => setSortBy('viewers')}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${sortBy === 'viewers' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                  >
                    <Users className="h-3.5 w-3.5" /> {t('spaces.sort.viewers')}
                  </button>
                  <button
                    onClick={() => setSortBy('recency')}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${sortBy === 'recency' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                  >
                    <Clock className="h-3.5 w-3.5" /> {t('spaces.sort.recent')}
                  </button>
                </div>
              </div>
              {visible.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">{t('spaces.noStreamsPlatform')}</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {visible.map((s) => <LiveStreamCard key={s.id} space={s} />)}
                </div>
              )}
            </>
          )}
          {live.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <span className="h-4 w-4 rounded-full bg-destructive" />
              <p className="text-sm font-semibold">{t('spaces.noStreamsLive')}</p>
              <p className="text-xs text-muted-foreground">{t('spaces.beFirst')}</p>
              <button
                onClick={() => setShowGoLive(true)}
                className="live-go-pulse mt-1 flex items-center gap-1.5 rounded-full bg-destructive px-4 py-2 text-sm font-bold text-white"
              >
                <Radio className="h-4 w-4" /> {t('page.spaces.goLive')}
              </button>
            </div>
          )}
        </div>
      ) : podcasts.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">{t('spaces.noRecordings')}</p>
      ) : (
        <div className="space-y-2 p-4">{podcasts.map((ep) => <EpisodeCard key={ep.id} episode={ep} />)}</div>
      )}

      {showGoLive && <GoLiveModal onClose={() => setShowGoLive(false)} onLive={() => { setShowGoLive(false); load(); }} />}
      <DocumentationLink slug="voice-spaces" />
    </div>
  );
}