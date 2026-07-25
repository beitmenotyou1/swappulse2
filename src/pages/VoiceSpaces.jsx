import React, { useEffect, useState } from 'react';
import { Plus, Radio, CalendarClock, Headphones, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import SpaceCard from '@/components/spaces/SpaceCard';
import CreateSpaceModal from '@/components/spaces/CreateSpaceModal';
import EpisodeCard from '@/components/podcast/EpisodeCard';
import { useRealtimeEvent } from '@/hooks/useRealtimeEvent';

const TABS = [
  { key: 'live', label: 'Live Now', Icon: Radio },
  { key: 'scheduled', label: 'Upcoming', Icon: CalendarClock },
  { key: 'recordings', label: 'Recordings', Icon: Headphones },
];

export default function VoiceSpaces() {
  const [spaces, setSpaces] = useState([]);
  const [podcasts, setPodcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState('live');

  const load = async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        base44.entities.VoiceSpace.list('-created_date', 100),
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

  const live = spaces.filter((s) => s.status === 'live');
  const scheduled = spaces.filter((s) => s.status === 'scheduled').sort((a, b) => new Date(a.scheduled_at || 0) - new Date(b.scheduled_at || 0));

  return (
    <div>
      <PageHeader title="Voice Spaces" subtitle="Live audio conversations with the community">
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
          <Plus className="h-4 w-4" /> Start
        </button>
      </PageHeader>

      <div className="flex border-b border-border">
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setTab(key)} className={`relative flex-1 py-3 text-sm font-semibold transition-colors ${tab === key ? 'text-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
            <span className="flex items-center justify-center gap-1.5"><Icon className="h-4 w-4" /> {label}</span>
            {tab === key && <span className="absolute bottom-0 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-primary" />}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : tab === 'live' ? (
        live.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No live spaces right now. Start one!</p>
        ) : (
          <div className="space-y-3 p-4">{live.map((s) => <SpaceCard key={s.id} space={s} />)}</div>
        )
      ) : tab === 'scheduled' ? (
        scheduled.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No scheduled spaces.</p>
        ) : (
          <div className="space-y-3 p-4">{scheduled.map((s) => <SpaceCard key={s.id} space={s} />)}</div>
        )
      ) : podcasts.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No recordings yet. Record a live space to publish a podcast.</p>
      ) : (
        <div className="space-y-2 p-4">{podcasts.map((ep) => <EpisodeCard key={ep.id} episode={ep} />)}</div>
      )}

      {showCreate && <CreateSpaceModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}