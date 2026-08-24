// useCryptoEnabled — reads the crypto_enabled flag from the user's SettingsConfig.
// Uses a module-level cache so multiple components on the same page don't each
// make a separate API call. The cache is invalidated when the toggle changes.

import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

let _cachedEnabled = null; // null = unknown, true/false = cached value
let _fetchPromise = null;  // deduplicates concurrent fetches

export function clearCryptoEnabledCache() {
  _cachedEnabled = null;
  _fetchPromise = null;
}

export function useCryptoEnabled() {
  const { user } = useAuth();
  const [cryptoEnabled, setCryptoEnabled] = useState(_cachedEnabled ?? true);
  const [loading, setLoading] = useState(_cachedEnabled === null);

  useEffect(() => {
    if (!user?.did) {
      setCryptoEnabled(true);
      setLoading(false);
      return;
    }
    if (_cachedEnabled !== null) {
      setCryptoEnabled(_cachedEnabled);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        if (!_fetchPromise) {
          _fetchPromise = base44.entities.SettingsConfig.filter({ did: user.did }, '-updated_date', 1)
            .then((list) => !list.length || list[0].config?.crypto?.enabled !== false)
            .catch(() => true);
        }
        const enabled = await _fetchPromise;
        _cachedEnabled = enabled;
        if (!cancelled) {
          setCryptoEnabled(enabled);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setCryptoEnabled(true);
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [user?.did]);

  return { cryptoEnabled, loading };
}