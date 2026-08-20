import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid } from '@/lib/atproto';
import { emptyConfig } from '@/lib/profileThemes';

// useOwnProfileConfig — loads the current user's ProfileConfig (owner-only
// read via RLS) and exposes a save() that creates or updates the single record
// keyed by the owner's DID. Used by the profile editor and the owner's own
// profile page (which sees every field regardless of visibility).
export function useOwnProfileConfig() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { did } = await ensureUserDid().catch(() => ({ did: '' }));
      const existing = await base44.entities.ProfileConfig.filter({ did }, '-created_date', 1);
      if (existing.length) {
        setConfig({ ...emptyConfig(did), ...existing[0] });
      } else {
        setConfig(emptyConfig(did));
      }
    } catch {
      setConfig(emptyConfig());
    } finally {
      setLoading(false);
    }
  }, []);

  const save = useCallback(async (draft) => {
    setSaving(true);
    try {
      const { did } = await ensureUserDid().catch(() => ({ did: draft?.did || '' }));
      const payload = { ...draft, did };
      const existing = await base44.entities.ProfileConfig.filter({ did }, '-created_date', 1);
      let saved;
      if (existing.length) {
        saved = await base44.entities.ProfileConfig.update(existing[0].id, payload);
      } else {
        saved = await base44.entities.ProfileConfig.create(payload);
      }
      setConfig({ ...emptyConfig(did), ...saved });
      return saved;
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { config, loading, saving, save, reload: load };
}