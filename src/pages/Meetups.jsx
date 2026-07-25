import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Loader2, CalendarDays, MapPin, Users, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import CreateMeetupModal from '@/components/meetups/CreateMeetupModal';

function MeetupCard({ m }) {
  const when = m.scheduled_at ? new Date(m.scheduled_at) : null;
  return (
    <Link to={`/meetups/${m.id}`} className="block rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40 hover:shadow-raised">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{m.title}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            {when ? when.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : 'TBD'}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> {m.location_name}{m.region ? ` · ${m.region}` : ''}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${m.status === 'cancelled' ? 'bg-destructive/15 text-destructive' : 'bg-success/15 text-success'}`}>
          {m.status}
        </span>
      </div>
      {m.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{m.description}</p>}
      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {m.rsvp_count || 0} / {m.capacity || '-'}</span>
        {m.required_vouches > 0 && (
          <span className="flex items-center gap-1 text-accent"><ShieldCheck className="h-3.5 w-3.5" /> {m.required_vouches} vouches</span>
        )}
      </div>
    </Link>
  );
}

export default function Meetups() {
  const [meetups, setMeetups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await base44.entities.Meetup.filter({}, 'scheduled_at', 100);
      const upcoming = all
        .filter((m) => m.status === 'scheduled' || m.status === 'ongoing')
        .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
      setMeetups(upcoming);
    } catch {
      setMeetups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageHeader title="Meetups" subtitle="Vouch-gated local collector meetups">
        <button onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90">
          <Plus className="h-4 w-4" /> New meetup
        </button>
      </PageHeader>

      <div className="mx-auto max-w-2xl space-y-3 px-4 py-4 pb-24 md:pb-8">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : meetups.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <CalendarDays className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No meetups scheduled. Organise the first one.</p>
          </div>
        ) : (
          meetups.map((m) => <MeetupCard key={m.id} m={m} />)
        )}
      </div>

      <CreateMeetupModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />
    </div>
  );
}