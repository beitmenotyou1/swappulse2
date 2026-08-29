import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';
import { bridgeMeetup } from '@/lib/federatedBridge';
import { useT } from '@/lib/i18n/I18nProvider';

export default function CreateMeetupModal({ open, onClose, onCreated }) {
  const t = useT();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [duration, setDuration] = useState(120);
  const [locationName, setLocationName] = useState('');
  const [region, setRegion] = useState('');
  const [capacity, setCapacity] = useState(10);
  const [requiredVouches, setRequiredVouches] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const submit = async () => {
    if (!title.trim() || !description.trim() || !scheduledAt || !locationName.trim()) {
      return setError(t('meetup.errorRequired'));
    }
    setSaving(true);
    setError('');
    try {
      const { did, signingKey } = await ensureUserDid();
      const me = await base44.auth.me();
      const stamped = await stampRecord(
        {
          title: title.trim(),
          description: description.trim(),
          scheduled_at: new Date(scheduledAt).toISOString(),
          estimated_duration: Number(duration) || 120,
          location_name: locationName.trim(),
          region: region.trim(),
          capacity: Math.min(50, Math.max(2, Number(capacity) || 10)),
          required_vouches: Math.max(0, Number(requiredVouches) || 0),
          status: 'scheduled',
          creator_did: did,
          rsvp_count: 0,
          author_name: me?.full_name || '',
          author_handle: me?.custom_handle || me?.username || me?.bsky_handle || '',
        },
        NSID.MEETUP,
        did,
        signingKey,
      );
      const created = await base44.entities.Meetup.create(stamped);
      bridgeMeetup(stamped).then((res) => {
        if (res.bridged) base44.entities.Meetup.update(created.id, res).catch(() => {});
      }).catch(() => {});
      setTitle(''); setDescription(''); setScheduledAt(''); setLocationName(''); setRegion(''); setCapacity(10); setRequiredVouches(0);
      onCreated?.();
      onClose();
    } catch (e) {
      setError(e.message || t('meetup.errorFailed'));
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="mt-8 w-full max-w-lg animate-slide-up rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-bold">{t('meetup.new')}</h2>
          <button aria-label="Close meetup form" onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 p-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="a11y-fb49b43a0d">{t('meetup.titleLabel')}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} className={field} placeholder="e.g. South London Trade Night"  id="a11y-fb49b43a0d"/>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="a11y-777c8ccca0">{t('meetup.descLabel')}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={3} className={`resize-none ${field}`} placeholder="What to bring, format, etc."  id="a11y-777c8ccca0"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="a11y-27b774dd1c">{t('meetup.dateTime')}</label>
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className={field}  id="a11y-27b774dd1c"/>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="a11y-7b228169e4">{t('meetup.duration')}</label>
              <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} min={15} className={field}  id="a11y-7b228169e4"/>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="a11y-d0902eee39">{t('meetup.venue')}</label>
            <input value={locationName} onChange={(e) => setLocationName(e.target.value)} maxLength={200} className={field} placeholder="e.g. The Hood Arms, Sutton"  id="a11y-d0902eee39"/>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="a11y-5ded2b743b">{t('meetup.region')}</label>
            <input value={region} onChange={(e) => setRegion(e.target.value)} className={field} placeholder="e.g. London"  id="a11y-5ded2b743b"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="a11y-b16c53d1e4">{t('meetup.capacity')}</label>
              <input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} min={2} max={50} className={field}  id="a11y-b16c53d1e4"/>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="a11y-cd11304a63">{t('meetup.requiredVouches')}</label>
              <input type="number" value={requiredVouches} onChange={(e) => setRequiredVouches(e.target.value)} min={0} className={field}  id="a11y-cd11304a63"/>
              <p className="mt-1 text-[11px] text-muted-foreground">{t('meetup.requiredVouchesHint')}</p>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-4">
          <button onClick={onClose} className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary">{t('common.cancel')}</button>
          <button onClick={submit} disabled={saving} className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t('meetup.create')}
          </button>
        </div>
      </div>
    </div>
  );
}