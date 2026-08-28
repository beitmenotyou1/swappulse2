import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';
import { bridgeMeetupRsvp } from '@/lib/federatedBridge';
import { updateBridgedRecord } from '@/lib/atprotoRecords';
import { useAuth } from '@/lib/AuthContext';
import { CalendarDays, MapPin, Users, ShieldCheck, Loader2, BookOpen } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Avatar from '@/components/Avatar';
import useSEO from '@/hooks/useSEO';
import { useT } from '@/lib/i18n/I18nProvider';

const ATTENDING = [
  ['yes', 'meetup.attending.yes'],
  ['maybe', 'meetup.attending.maybe'],
  ['no', 'meetup.attending.no'],
];

export default function MeetupDetail() {
  const t = useT();
  const { meetupId } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attending, setAttending] = useState('yes');
  const [bringingBinder, setBringingBinder] = useState(false);
  const [lookingFor, setLookingFor] = useState('');
  const [saving, setSaving] = useState(false);
  useSEO({
    title: data?.meetup?.title || 'Pokémon TCG Collector Meetup',
    description: 'A Pokémon TCG collector meetup on SwapPulse, organise, attend, and swap cards in person.',
    canonicalPath: `/meetups/${meetupId}`,
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('getMeetup', { meetupId });
      setData(res.data);
      if (res.data?.myRsvp) {
        setAttending(res.data.myRsvp.attending || 'yes');
        setBringingBinder(!!res.data.myRsvp.bringing_trade_binder);
        setLookingFor((res.data.myRsvp.looking_for_cards || []).join(', '));
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [meetupId]);

  const submitRsvp = async () => {
    setSaving(true);
    try {
      const { did, signingKey } = await ensureUserDid();
      const me = await base44.auth.me();
      const m = data.meetup;
      const cards = lookingFor.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10);
      if (data.myRsvp) {
        await base44.entities.MeetupRsvp.update(data.myRsvp.id, {
          attending,
          bringing_trade_binder: bringingBinder,
          looking_for_cards: cards,
        });
        if (data.myRsvp.bridged && data.myRsvp.at_uri) {
          updateBridgedRecord({ id: data.myRsvp.id, at_uri: data.myRsvp.at_uri, bridged: true }, 'MeetupRsvp').then((res) => {
            if (res?.cid) base44.entities.MeetupRsvp.update(data.myRsvp.id, { cid: res.cid, content_hash: res.content_hash || '' }).catch(() => {});
          }).catch(() => {});
        }
      } else {
        const stamped = await stampRecord(
          {
            meetup_ref: m.at_uri,
            meetup_id: m.id,
            attending,
            bringing_trade_binder: bringingBinder,
            looking_for_cards: cards,
            attendee_name: me?.full_name || '',
            attendee_handle: me?.custom_handle || me?.username || me?.bsky_handle || '',
            attendee_avatar: '',
          },
          NSID.MEETUP_RSVP,
          did,
          signingKey,
        );
        const created = await base44.entities.MeetupRsvp.create(stamped);
        bridgeMeetupRsvp(stamped).then((res) => {
          if (res.bridged) base44.entities.MeetupRsvp.update(created.id, res).catch(() => {});
        }).catch(() => {});
        await base44.entities.Meetup.update(m.id, { rsvp_count: (m.rsvp_count || 0) + 1 });
      }
      await load();
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  const cancelMeetup = async () => {
    if (!confirm(t('meetup.cancelConfirm'))) return;
    try {
      await base44.entities.Meetup.update(data.meetup.id, { status: 'cancelled' });
      if (data.meetup.bridged && data.meetup.at_uri) {
        updateBridgedRecord({ id: data.meetup.id, at_uri: data.meetup.at_uri, bridged: true }, 'Meetup').then((res) => {
          if (res?.cid) base44.entities.Meetup.update(data.meetup.id, { cid: res.cid, content_hash: res.content_hash || '' }).catch(() => {});
        }).catch(() => {});
      }
      await load();
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (!data?.meetup) {
    return <div className="py-16 text-center text-sm text-muted-foreground">{t('meetup.notFound')}</div>;
  }

  const m = data.meetup;
  const when = m.scheduled_at ? new Date(m.scheduled_at) : null;
  const cancelled = m.status === 'cancelled';

  return (
    <div>
      <PageHeader title={m.title} subtitle={m.region || 'Meetup'}>
        {data.isOrganiser && !cancelled && (
          <button onClick={cancelMeetup} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-secondary">{t('common.cancel')}</button>
        )}
      </PageHeader>

      <div className="mx-auto max-w-2xl space-y-5 px-4 py-4 pb-24 md:pb-8">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-primary" />
              {when ? when.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : t('meetup.tbd')}
            </span>
            <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary" /> {m.location_name}</span>
            <span className="flex items-center gap-1.5"><Users className="h-4 w-4 text-primary" /> {t('meetup.stats').replace('{going}', data.yesCount).replace('{maybe}', data.maybeCount).replace('{cap}', m.capacity)}</span>
          </div>
          {m.description && <p className="mt-3 text-sm">{m.description}</p>}
          {cancelled && <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">{t('meetup.cancelled')}</p>}
          <div className="mt-3 flex items-center gap-2">
            <Avatar name={m.author_name} size={24} />
            <span className="text-xs text-muted-foreground">{t('meetup.organisedBy').replace('{name}', m.author_name || t('common.collector'))}</span>
          </div>
        </div>

        {!cancelled && (
          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t('meetup.yourRsvp')}</h2>
            <div className="grid grid-cols-3 gap-2">
              {ATTENDING.map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setAttending(k)}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${attending === k ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-secondary'}`}
                >
                  {t(l)}
                </button>
              ))}
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={bringingBinder} onChange={(e) => setBringingBinder(e.target.checked)} className="h-4 w-4 rounded accent-primary" />
              <span className="flex items-center gap-1.5"><BookOpen className="h-4 w-4" /> {t('meetup.bringingBinder')}</span>
            </label>
            <div className="mt-3">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('meetup.lookingFor')}</label>
              <input
                value={lookingFor}
                onChange={(e) => setLookingFor(e.target.value)}
                placeholder="e.g. Umbreon VMAX, Charizard ex"
                className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={submitRsvp} disabled={saving} className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {data.myRsvp ? t('meetup.updateRsvp') : t('meetup.sendRsvp')}
              </button>
            </div>
          </section>
        )}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t('meetup.attendees')}</h2>
            {m.required_vouches > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" /> {t('meetup.vouchesNeeded').replace('{needed}', m.required_vouches).replace('{yours}', data.viewerVouches)}
              </span>
            )}
          </div>
          {data.canSeeAttendees ? (
            data.attendees.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">{t('meetup.noRsvps')}</div>
            ) : (
              <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
                {data.attendees.map((a) => (
                  <div key={a.id} className="flex items-center gap-2">
                    <Avatar name={a.attendee_name} src={a.attendee_avatar} size={28} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.attendee_name || t('meetup.attendee')}</span>
                    {a.bringing_trade_binder && <span className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent"><BookOpen className="h-3 w-3" /> {t('meetup.binder')}</span>}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${a.attending === 'yes' ? 'bg-success/15 text-success' : a.attending === 'maybe' ? 'bg-accent/15 text-accent' : 'bg-secondary text-muted-foreground'}`}>{a.attending}</span>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-8 text-center">
              <ShieldCheck className="h-8 w-8 text-muted-foreground" />
              <p className="px-6 text-sm text-muted-foreground">
                {t('meetup.vouchGated').replace('{needed}', m.required_vouches).replace('{yours}', data.viewerVouches)}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}