import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

// Unread notification count for the nav badge. Subscribes to the Notification
// entity so it updates live as records are created/read.
export function useUnreadCount() {
  const { user } = useAuth();
  const did = user?.did;
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!did) { setCount(0); return; }
    let alive = true;
    const refresh = async () => {
      try {
        const items = await base44.entities.Notification.filter({ did, is_read: false }, '-created_date', 200);
        if (alive) setCount(items.length);
      } catch {
        if (alive) setCount(0);
      }
    };
    refresh();
    let unsub;
    try { unsub = base44.entities.Notification.subscribe(refresh); } catch {}
    return () => { alive = false; if (unsub) unsub(); };
  }, [did]);
  return count;
}

// Page-level hook: list, optimistic read, mark-all-read (writes a
// NotificationState checkpoint), and live subscription.
export function useNotifications() {
  const { user } = useAuth();
  const did = user?.did;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!did) { setLoading(false); return; }
    try {
      const list = await base44.entities.Notification.filter({ did }, '-created_date', 50);
      setItems(list);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [did]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!did) return;
    let unsub;
    try { unsub = base44.entities.Notification.subscribe(() => refresh()); } catch {}
    return () => { if (unsub) unsub(); };
  }, [did, refresh]);

  // Polling fallback: refresh every 30s while the page is visible, so the
  // list doesn't appear frozen if the realtime subscription misses a write.
  useEffect(() => {
    if (!did) return;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, 30000);
    return () => clearInterval(interval);
  }, [did, refresh]);

  const unreadCount = items.filter((n) => !n.is_read).length;

  const markRead = useCallback(async (id) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    try {
      await base44.functions.invoke('mark-notifications-read', { notificationId: id });
    } catch {}
  }, []);

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await base44.functions.invoke('mark-notifications-read', { all: true });
      await base44.entities.NotificationState.create({ did, last_read_timestamp: now, dismissed_all: true, updated_at: now });
    } catch {}
  }, [did]);

  return { items, loading, unreadCount, refresh, markRead, markAllRead };
}