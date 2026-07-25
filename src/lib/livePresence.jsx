import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useRealtimeEvent } from '@/hooks/useRealtimeEvent';

// §Alpha 1.4 Live Presence — holds the current set of live users (voice
// spaces + external streams) indexed by DID, refreshed on realtime events.
// Components read it via useLivePresence(); LiveAvatar renders the red ring.
const LivePresenceContext = createContext({ liveByDid: new Map(), refresh: () => {} });

export function LivePresenceProvider({ children }) {
  const [liveByDid, setLiveByDid] = useState(new Map());

  const refresh = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('getLiveUsers', {});
      const list = res?.data?.live || [];
      const map = new Map();
      for (const u of list) {
        if (u.did) map.set(u.did, u);
      }
      setLiveByDid(map);
    } catch {
      /* non-fatal — degrade to no live indicators */
    }
  }, []);

  useEffect(() => {
    refresh();
    const unsub = base44.entities.VoiceSpace.subscribe(refresh);
    return unsub;
  }, [refresh]);
  useRealtimeEvent('space.started', refresh);
  useRealtimeEvent('space.ended', refresh);

  return (
    <LivePresenceContext.Provider value={{ liveByDid, refresh }}>
      {children}
    </LivePresenceContext.Provider>
  );
}

export const useLivePresence = () => useContext(LivePresenceContext);