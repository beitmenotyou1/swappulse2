import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, Calendar, Users, Plus, Radio } from 'lucide-react';
import Avatar from '@/components/Avatar';
import { format, formatDistanceToNow } from 'date-fns';
import useSEO from '@/hooks/useSEO';
import GuideFooterLink from '@/components/help/GuideFooterLink';
import { useT } from '@/lib/i18n/I18nProvider';

// PackParties — synchronized pack-opening events. Collectors schedule or join
// a party for a specific set, then open packs together in real time and share
// reactions. Parties are federated to the AT Protocol for cross-instance discovery.
export default function PackParties() {
  const t = useT();
  useSEO({
    title: 'Pack Parties',
    description: 'Join synchronised Pokémon TCG pack-opening events on SwapPulse, open together and share reactions live.',
    canonicalPath: '/pack-parties',
  });
  const [user, setUser] = useState(null);
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    loadParties();
  }, []);

  const loadParties = async () => {
    try {
      const data = await base44.entities.PackParty.list('-scheduled_at', 50);
      setParties(data);
    } catch { setParties([]); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen pb-20">
      <PageHeader title={t('page.packParties.title')} subtitle={t('page.packParties.subtitle')}>
        {user && (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> New Party
          </Button>
        )}
      </PageHeader>

      <div className="p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : parties.length === 0 ? (
          <div className="mx-auto max-w-md py-16 text-center">
            <Sparkles className="mx-auto h-12 w-12 text-primary/40" />
            <h2 className="mt-4 text-lg font-bold">No pack parties yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Schedule a synchronized pack opening and invite collectors to join the fun.
            </p>
            {user && (
              <Button className="mt-4" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4" /> Schedule a Party
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {parties.map((p) => <PartyCard key={p.id} party={p} />)}
          </div>
        )}
      </div>

      {showCreate && user && (
        <CreatePartyModal
          user={user}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadParties(); }}
        />
      )}
      <GuideFooterLink slug="pack-parties" />
    </div>
  );
}

function PartyCard({ party }) {
  const live = party.status === 'live';
  const scheduled = party.status === 'scheduled';
  const time = party.scheduled_at ? new Date(party.scheduled_at) : null;

  return (
    <div className={`rounded-2xl border bg-card p-4 ${live ? 'border-success/40 shadow-raised' : 'border-border'}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {live ? (
            <span className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-bold text-success">
              <Radio className="h-3 w-3 live-ring" /> LIVE
            </span>
          ) : scheduled ? (
            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              <Calendar className="h-3 w-3" /> {time ? formatDistanceToNow(time, { addSuffix: true }) : ''}
            </span>
          ) : (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">Completed</span>
          )}
        </div>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> {party.participant_count}/{party.max_participants}
        </span>
      </div>

      <h3 className="mt-2 font-bold">{party.title}</h3>
      {party.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{party.description}</p>}

      {party.set_name && (
        <p className="mt-2 text-xs text-primary">{party.set_name}</p>
      )}

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar name={party.host_name} src={party.host_avatar} size={24} />
          <span className="text-xs text-muted-foreground">{party.host_name}</span>
        </div>
        {live && (
          <Button size="sm" variant="default">Join Now</Button>
        )}
      </div>
    </div>
  );
}

function CreatePartyModal({ user, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [setId, setSetId] = useState('');
  const [setName, setSetName] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(50);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!title || !scheduledAt) return;
    setSubmitting(true);
    try {
      await base44.entities.PackParty.create({
        title,
        description: description.trim(),
        set_id: setId,
        set_name: setName,
        scheduled_at: new Date(scheduledAt).toISOString(),
        status: 'scheduled',
        host_name: user.full_name || user.email?.split('@')[0] || 'Collector',
        host_handle: user.email?.split('@')[0] || '',
        max_participants: maxParticipants,
      });
      onCreated();
    } catch (e) {
      alert('Could not create party: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl bg-background p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">Schedule a Pack Party</h2>
        <p className="mt-1 text-sm text-muted-foreground">Pick a set, set a time, and invite collectors to open packs together.</p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-sm font-medium">Title</label>
            <input
              className="mt-1 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
              placeholder="Friday Night Pulls"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description (optional)</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
              placeholder="Opening 5 packs of Scarlet & Violet..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Set (optional)</label>
            <input
              className="mt-1 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
              placeholder="sv3"
              value={setId}
              onChange={(e) => { setSetId(e.target.value); setSetName(e.target.value); }}
            />
          </div>
          <div>
            <label className="text-sm font-medium">When</label>
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Max participants</label>
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" disabled={!title || !scheduledAt || submitting} onClick={submit}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Schedule'}
          </Button>
        </div>
      </div>
    </div>
  );
}