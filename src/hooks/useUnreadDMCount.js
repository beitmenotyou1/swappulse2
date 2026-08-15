import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

// Unread direct-message count for the Messages nav badge. Subscribes to the
// DirectMessage entity so it updates live as messages arrive and are read.
export function useUnreadDMCount() {
  const { user } = useAuth();
  const did = user?.did;
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!did) { setCount(0); return; }
    let alive = true;
    const refresh = async () => {
      try {
        const items = await base44.entities.DirectMessage.filter({ recipient_did: did, read: false }, '-created_date', 200);
        if (alive) setCount(items.length);
      } catch {
        if (alive) setCount(0);
      }
    };
    refresh();
    let unsub;
    try { unsub = base44.entities.DirectMessage.subscribe(refresh); } catch {}
    return () => { alive = false; if (unsub) unsub(); };
  }, [did]);
  return count;
}