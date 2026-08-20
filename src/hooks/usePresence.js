import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid } from '@/lib/atproto';

// A collector is "online" if their last heartbeat was within this window.
const ONLINE_WINDOW_MS = 5 * 60 * 1000;

// Single source of truth for live presence: emits a heart-beat every 30s and
// maintains the list of currently-online collectors, refreshed on a schedule
// and on real-time Presence events. Mount once at the Layout level.
export function usePresence() {
  const [online, setOnline] = useState([]);

  useEffect(() => {
    let active = true;
    let stopSub = () => {};
    const timers = [];

    (async () => {
      const me = await base44.auth.me().catch(() => null);
      if (!me || !active) return;
      const { did } = await ensureUserDid().catch(() => ({ did: '' }));

      const beat = async () => {
        try {
          const existing = await base44.entities.Presence.filter({ created_by_id: me.id }, '-created_date', 1);
          const payload = {
            last_seen: new Date().toISOString(),
            did,
            handle: me.username || (me.email || '').split('@')[0],
            name: me.display_name || me.full_name || '',
            avatar: me.avatar || '',
          };
          if (existing.length) await base44.entities.Presence.update(existing[0].id, payload);
          else await base44.entities.Presence.create(payload);
        } catch {
          /* ignore transient heartbeat errors */
        }
      };

      const loadOnline = async () => {
        try {
          const cutoff = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString();
          const list = await base44.entities.Presence.filter({ last_seen: { $gte: cutoff } });
          list.sort((a, b) => new Date(b.last_seen) - new Date(a.last_seen));
          if (active) setOnline(list.slice(0, 50));
        } catch {
          /* ignore */
        }
      };

      await beat();
      await loadOnline();
      timers.push(setInterval(beat, 30000));
      timers.push(setInterval(loadOnline, 30000));
      stopSub = base44.entities.Presence.subscribe(() => loadOnline());
    })();

    return () => {
      active = false;
      timers.forEach(clearInterval);
      stopSub();
    };
  }, []);

  return online;
}