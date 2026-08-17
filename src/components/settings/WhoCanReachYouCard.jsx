import React, { useEffect, useState } from 'react';
import { Users, Globe, BellOff, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Switch } from '@/components/ui/switch';

// "Who can reach you" — two independent controls (relationship filter +
// origin filter) plus a master pause switch. Persisted to the user's
// NotificationPreference entity (separate from the SettingsConfig blob)
// and enforced centrally by the notificationFilter backend helper.
export default function WhoCanReachYouCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pref, setPref] = useState(null);
  const [recordId, setRecordId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const did = user?.did;
  const userId = user?.id;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!did) { setLoading(false); return; }
      try {
        const list = await base44.entities.NotificationPreference.filter({ did }, '-updated_date', 1);
        if (cancelled) return;
        if (list.length) {
          setPref({
            who_filter: list[0].who_filter || 'everyone',
            on_site_only: !!list[0].on_site_only,
            paused: !!list[0].paused,
          });
          setRecordId(list[0].id);
        } else {
          setPref({ who_filter: 'everyone', on_site_only: false, paused: false });
        }
      } catch (e) {
        console.error('WhoCanReachYouCard: load failed', e?.message || e);
        setPref({ who_filter: 'everyone', on_site_only: false, paused: false });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [did]);

  const save = async (next) => {
    if (!did || !userId || saving) return;
    setSaving(true);
    try {
      if (recordId) {
        await base44.entities.NotificationPreference.update(recordId, next);
      } else {
        const rec = await base44.entities.NotificationPreference.create({
          user_id: userId,
          did,
          who_filter: next.who_filter ?? 'everyone',
          on_site_only: !!next.on_site_only,
          paused: !!next.paused,
        });
        setRecordId(rec.id);
      }
    } catch (e) {
      console.error('WhoCanReachYouCard: save failed', e?.message || e);
      toast({ title: 'Could not save preference', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const setWho = (value) => {
    setPref((p) => ({ ...p, who_filter: value }));
    save({ who_filter: value });
  };
  const toggleOnSite = (value) => {
    setPref((p) => ({ ...p, on_site_only: value }));
    save({ on_site_only: value });
  };
  const togglePaused = (value) => {
    setPref((p) => ({ ...p, paused: value }));
    save({ paused: value });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  const whoOptions = [
    { value: 'everyone', label: 'Everyone', desc: 'Notifications from anyone on the fediverse' },
    { value: 'followed_only', label: 'Only people I follow', desc: 'Notifications from accounts you follow' },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="flex items-center gap-2 text-sm font-bold"><Users className="h-4 w-4 text-primary" /> Who can reach you</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Control which notifications reach you, based on who sends them.</p>

      {/* Relationship filter, radio */}
      <div className="mt-3 space-y-2">
        {whoOptions.map((opt) => {
          const selected = pref.who_filter === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setWho(opt.value)}
              disabled={pref.paused}
              className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:opacity-50 ${
                selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-secondary'
              }`}
            >
              <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${selected ? 'border-primary' : 'border-muted-foreground/40'}`}>
                {selected && <span className="h-2 w-2 rounded-full bg-primary" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{opt.label}</span>
                <span className="block text-xs text-muted-foreground">{opt.desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Origin filter, switch */}
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold"><Globe className="h-3.5 w-3.5 text-muted-foreground" /> On-site users only</p>
          <p className="text-xs text-muted-foreground">Only notify me about people registered on SwapPulse. Off includes the whole fediverse.</p>
        </div>
        <Switch checked={pref.on_site_only} onCheckedChange={toggleOnSite} disabled={pref.paused} />
      </div>

      {/* Master pause, switch */}
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold"><BellOff className="h-3.5 w-3.5 text-muted-foreground" /> Pause all notifications</p>
          <p className="text-xs text-muted-foreground">Silence every notification until you turn this off. Overrides the filters above.</p>
        </div>
        <Switch checked={pref.paused} onCheckedChange={togglePaused} />
      </div>

      {saving && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Saving…
        </p>
      )}
      {pref.paused && (
        <p className="mt-2 rounded-lg bg-warning/10 px-3 py-2 text-xs font-medium text-warning">
          All notifications are paused. Turn off the switch above to resume.
        </p>
      )}
    </div>
  );
}