import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const readInitialTheme = () => {
  try {
    const t = localStorage.getItem('swappulse-theme');
    if (t === 'light' || t === 'dark') return t;
  } catch {}
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'dark';
};

export const DEFAULT_SETTINGS = {
  locale: { interface: 'en-GB', timezone: 'Europe/London', dateFormat: 'DD/MM/YYYY', timeFormat: '24h' },
  language: {
    preferredContent: ['en-GB'],
    autoTranslate: false,
    translationProvider: 'libre-local',
    targetLanguage: 'en-GB',
    fluent: ['en-GB'],
    hidden: [],
  },
  security: { mfaEnabled: false, sessionTimeout: 86400 },
  privacy: {
    collectionVisibility: 'showcase',
    tradeVisibility: 'public',
    locationPrecision: 'approximate',
    valueHidden: false,
    dataSaver: false,
  },
  notifications: {
    channels: ['push', 'in-app'],
    quietHours: { start: '22:00', end: '08:00' },
    eventTypes: { trade_match: true, price_alert: true, mention: true, reaction: false, voice_live: true },
  },
  accessibility: { theme: 'dark', reduceMotion: false, highContrast: false, fontSize: 'medium' },
  crypto: { enabled: true, display_currency: 'USDC' },
  wallet: { default_wallet: 'custodial', receive_strict_mode: true },
  challenges: {
    leaderboardOptIn: false,
    leaderboardCategories: [],
    challengeVisibility: 'friends-only',
  },
};

// The nine SwapPulse-supported languages, aligned to TCGDex languages.
// These are the only options offered in language selectors across the site.
export const LANGUAGES = [
  { code: 'en-GB', name: 'English' },
  { code: 'es-ES', name: 'Español' },
  { code: 'fr-FR', name: 'Français' },
  { code: 'de-DE', name: 'Deutsch' },
  { code: 'it-IT', name: 'Italiano' },
  { code: 'pt-BR', name: 'Português' },
  { code: 'ja-JP', name: '日本語' },
  { code: 'zh-CN', name: '中文' },
  { code: 'ko-KR', name: '한국어' },
];

function deepMerge(a, b) {
  if (Array.isArray(b)) return b;
  if (b && typeof b === 'object') {
    const out = { ...(a && typeof a === 'object' ? a : {}) };
    for (const k of Object.keys(b)) out[k] = deepMerge(out[k], b[k]);
    return out;
  }
  return b;
}

// Pushes accessibility + theme settings to <html>. Called from the settings
// page on change (immediate feedback) and from the app shell on load
// (cross-page persistence after reload).
export function applyAccessibility(a = {}) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('reduce-motion', !!a.reduceMotion);
  root.classList.toggle('hc', !!a.highContrast);
  const sizes = { small: '15px', medium: '16px', large: '18px', xl: '20px' };
  root.style.fontSize = sizes[a.fontSize] || '16px';
  const wantDark = a.theme === 'system'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : a.theme !== 'light';
  root.classList.toggle('dark', wantDark);
  try { localStorage.setItem('swappulse-theme', wantDark ? 'dark' : 'light'); } catch {}
  window.dispatchEvent(new Event('swappulse-theme-change'));
}

export function useSettings() {
  const { user } = useAuth();
  const did = user?.did;
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS, accessibility: { ...DEFAULT_SETTINGS.accessibility, theme: readInitialTheme() } });
  const [recordId, setRecordId] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!did) { setLoading(false); return; }
    try {
      const list = await base44.entities.SettingsConfig.filter({ did }, '-updated_date', 1);
      if (list.length) {
        setSettings({ ...DEFAULT_SETTINGS, ...(list[0].config || {}) });
        setRecordId(list[0].id);
      } else {
        const rec = await base44.entities.SettingsConfig.create({
          did,
          config: { ...DEFAULT_SETTINGS, accessibility: { ...DEFAULT_SETTINGS.accessibility, theme: readInitialTheme() } },
          updated_at: new Date().toISOString(),
        });
        setRecordId(rec.id);
      }
    } catch {
      // keep defaults
    } finally {
      setLoading(false);
    }
  }, [did]);

  useEffect(() => { load(); }, [load]);

  const update = useCallback((patch) => {
    setSettings((prev) => {
      const next = deepMerge(prev, patch);
      const persist = async () => {
        try {
          if (recordId) {
            await base44.entities.SettingsConfig.update(recordId, { config: next, updated_at: new Date().toISOString() });
          } else {
            const rec = await base44.entities.SettingsConfig.create({ did, config: next, updated_at: new Date().toISOString() });
            setRecordId(rec.id);
          }
        } catch (e) {
          console.error('settings persist failed', e?.message || e);
        }
      };
      persist();
      return next;
    });
  }, [recordId, did]);

  return { settings, update, loading };
}

// Mounted in the app shell: applies the user's accessibility/theme on load.
export function useApplyAccessibility() {
  const { settings, loading } = useSettings();
  useEffect(() => {
    if (loading) return;
    applyAccessibility(settings.accessibility);
  }, [settings.accessibility, loading]);
}