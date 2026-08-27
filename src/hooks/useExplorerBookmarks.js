import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const STORAGE_KEY = 'explorer-bookmarks';

// --- Module-level shared state so all hook instances stay in sync ---
let sharedBookmarks = null;
const listeners = new Set();

function saveLocal(bookmarks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(
      bookmarks.map((b) => ({ address: b.address, label: b.label, chain: b.chain, addedAt: b.addedAt })),
    ));
  } catch { /* ignore quota errors */ }
}

function loadLocal() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return [];
}

function setSharedBookmarks(next) {
  sharedBookmarks = next;
  saveLocal(next);
  for (const listener of listeners) {
    listener(next);
  }
}

// Hook for managing bookmarked explorer addresses. Uses a module-level
// shared state so all instances (BookmarkButton, BookmarkPanel) stay in
// sync without a context provider. Reads from browser local storage
// immediately (instant, works for guests), then syncs with the
// ExplorerBookmark entity when the user is authenticated.
export function useExplorerBookmarks() {
  const { user } = useAuth();
  const [bookmarks, setBookmarks] = useState(() => sharedBookmarks || loadLocal());
  const userRef = useRef(user);
  userRef.current = user;

  // Subscribe to shared state changes.
  useEffect(() => {
    const listener = (next) => setBookmarks(next);
    listeners.add(listener);
    // Initialize shared state from localStorage on first mount.
    if (sharedBookmarks === null) {
      sharedBookmarks = loadLocal();
    }
    setBookmarks(sharedBookmarks);
    return () => listeners.delete(listener);
  }, []);

  // Sync from entity when the user becomes available.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const records = await base44.entities.ExplorerBookmark.list('-created_date', 200);
        if (cancelled) return;
        const entityBookmarks = records.map((r) => ({
          address: r.wallet_address,
          label: r.label || '',
          chain: r.chain || 'pulse',
          addedAt: r.created_date,
        }));
        const current = sharedBookmarks || [];
        // Merge: entity bookmarks take priority; keep local-only entries.
        const merged = [...entityBookmarks];
        for (const b of current) {
          if (!merged.find((m) => m.address === b.address && m.chain === b.chain)) {
            merged.push(b);
          }
        }
        setSharedBookmarks(merged);
      } catch { /* non-fatal — local bookmarks still work */ }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const addBookmark = useCallback(async (address, label = '', chain = 'pulse') => {
    const normalized = address.toLowerCase();
    const current = sharedBookmarks || [];
    if (current.find((b) => b.address === normalized && b.chain === chain)) return;
    const next = [...current, { address: normalized, label, chain, addedAt: new Date().toISOString() }];
    setSharedBookmarks(next);

    const u = userRef.current;
    if (u) {
      try {
        await base44.entities.ExplorerBookmark.create({
          did: u.data?.did || '',
          wallet_address: normalized,
          label,
          chain,
        });
      } catch (e) { console.error('Bookmark sync failed:', e); }
    }
  }, []);

  const removeBookmark = useCallback(async (address, chain = 'pulse') => {
    const normalized = address.toLowerCase();
    const current = sharedBookmarks || [];
    const next = current.filter((b) => !(b.address === normalized && b.chain === chain));
    setSharedBookmarks(next);

    const u = userRef.current;
    if (u) {
      try {
        const records = await base44.entities.ExplorerBookmark.filter({ wallet_address: normalized, chain });
        for (const r of records) {
          await base44.entities.ExplorerBookmark.delete(r.id);
        }
      } catch (e) { console.error('Bookmark removal sync failed:', e); }
    }
  }, []);

  const isBookmarked = useCallback((address, chain = 'pulse') => {
    const normalized = (address || '').toLowerCase();
    return bookmarks.some((b) => b.address === normalized && b.chain === chain);
  }, [bookmarks]);

  return { bookmarks, loading: false, addBookmark, removeBookmark, isBookmarked };
}