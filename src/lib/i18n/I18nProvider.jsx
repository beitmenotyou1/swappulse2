import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { translations, LOCALE_TO_TCGDEX, SUPPORTED_LOCALES } from './translations';
import { setCurrentTcgdexLang } from './currentLang';
import { detectLocaleFromGeo } from './geoLocale';

const I18nContext = createContext({ locale: 'en-GB', t: (k) => k, setLocale: () => {} });

function getInitialLocale() {
  // A ?lang=LOCALE query param (set by promo post links) takes priority so
  // the site loads in the same language as the post the user clicked.
  try {
    if (typeof window !== 'undefined' && window.location?.search) {
      const params = new URLSearchParams(window.location.search);
      const langParam = params.get('lang');
      if (langParam && SUPPORTED_LOCALES.includes(langParam)) {
        try { localStorage.setItem('swappulse-locale', langParam); } catch {}
        return langParam;
      }
    }
  } catch {}
  try {
    const stored = localStorage.getItem('swappulse-locale');
    if (stored && SUPPORTED_LOCALES.includes(stored)) return stored;
  } catch {}
  if (typeof navigator !== 'undefined' && navigator.language) {
    const nav = navigator.language;
    if (SUPPORTED_LOCALES.includes(nav)) return nav;
    const two = nav.slice(0, 2).toLowerCase();
    const match = SUPPORTED_LOCALES.find((l) => l.slice(0, 2).toLowerCase() === two);
    if (match) return match;
  }
  return 'en-GB';
}

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(getInitialLocale);
  // Per-language overrides loaded from TranslationOverride records (AI-generated
  // or manual translations that fill gaps in the static dictionary). Structure:
  // { en: { key: value }, fr: { key: value }, ... }
  const [overrides, setOverrides] = useState({});

  // On mount, fetch all TranslationOverride records with non-empty values and
  // build a per-language map. The list() method caps at 5000 records, so we
  // fetch help translations (help.* keys) separately via a regex filter to
  // ensure they are all loaded even when total overrides exceed 5000.
  useEffect(() => {
    (async () => {
      try {
        const [recentRecords, helpRecords] = await Promise.all([
          base44.entities.TranslationOverride.list('-created_date', 5000),
          base44.entities.TranslationOverride.filter(
            { translation_key: { $regex: '^help\\.' } },
            '-created_date', 5000
          ),
        ]);
        const map = {};
        const process = (records) => {
          for (const r of records) {
            if (!r.value || !r.translation_key) continue;
            if (!map[r.language]) map[r.language] = {};
            map[r.language][r.translation_key] = r.value;
          }
        };
        process(recentRecords);
        process(helpRecords);
        setOverrides(map);
      } catch {}
    })();
  }, []);

  const setLocale = useCallback((newLocale) => {
    if (!SUPPORTED_LOCALES.includes(newLocale)) return;
    setLocaleState(newLocale);
    try { localStorage.setItem('swappulse-locale', newLocale); } catch {}
    setCurrentTcgdexLang(LOCALE_TO_TCGDEX[newLocale] || 'en');
    // Persist to the user's account so it survives sessions/devices and is
    // readable by backend functions (localized system emails).
    base44.auth.updateMe({ locale: newLocale }).catch(() => {});
  }, []);

  // Sync module-level TCGDex lang whenever locale changes
  useEffect(() => {
    setCurrentTcgdexLang(LOCALE_TO_TCGDEX[locale] || 'en');
  }, [locale]);

  // Keep <html lang> in sync with the active locale so search engines and
  // screen readers announce content in the correct language. The static
  // index.html default is "en"; this updates it to the user's locale for
  // every page (SEO + accessibility).
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  // On mount, resolve the locale if the user hasn't made an explicit choice.
  // Priority: ?lang= URL param > localStorage (previous explicit or auto choice) >
  // saved account locale (if authenticated) > IP-based geo detection > browser
  // language (already set by getInitialLocale as the synchronous fallback).
  //
  // Geo detection runs only when no explicit choice exists (no URL param, no
  // localStorage, no account locale). Once it sets a locale it saves to
  // localStorage so the detected locale becomes the sticky preference on
  // subsequent visits — until the user manually picks a different language via
  // the language switcher, which overwrites localStorage and their account.
  useEffect(() => {
    (async () => {
      try {
        // ?lang= URL param is an explicit choice — don't override
        if (typeof window !== 'undefined' && window.location?.search) {
          const params = new URLSearchParams(window.location.search);
          if (params.get('lang')) return;
        }
        // localStorage has a locale — respect it (explicit choice or previous
        // auto-detection result that has become the sticky preference)
        const stored = localStorage.getItem('swappulse-locale');
        if (stored && SUPPORTED_LOCALES.includes(stored)) return;
        // If authenticated, try the saved account locale first
        const authed = await base44.auth.isAuthenticated();
        if (authed) {
          const me = await base44.auth.me();
          const saved = me?.locale;
          if (saved && SUPPORTED_LOCALES.includes(saved) && saved !== locale) {
            setLocaleState(saved);
            try { localStorage.setItem('swappulse-locale', saved); } catch {}
            return;
          }
        }
        // No explicit choice — auto-detect from IP location
        const detected = await detectLocaleFromGeo();
        if (detected && SUPPORTED_LOCALES.includes(detected)) {
          if (detected !== locale) {
            setLocaleState(detected);
            setCurrentTcgdexLang(LOCALE_TO_TCGDEX[detected] || 'en');
          }
          // Save even when the detected locale matches the current one, so
          // detection doesn't re-run on every visit for users in en-GB regions.
          try { localStorage.setItem('swappulse-locale', detected); } catch {}
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const t = useCallback((key, params) => {
    const lang = LOCALE_TO_TCGDEX[locale] || 'en';
    const langOverrides = overrides[lang] || {};
    const dict = translations[locale] || translations['en-GB'];
    // Override (AI/manual) > static dict > English fallback > key
    // Use || (not ??) so empty strings in the static dict fall through to the
    // English fallback instead of rendering as blank space.
    let result = langOverrides[key] || dict[key] || translations['en-GB'][key] || key;
    if (import.meta.env.DEV && result === key) {
      console.warn('[i18n] missing key:', key, 'locale:', locale);
    }
    // Interpolate {placeholder} params into the resolved string.
    if (params && typeof result === 'string') {
      result = result.replace(/\{(\w+)\}/g, (_, name) =>
        (params[name] !== undefined && params[name] !== null) ? String(params[name]) : `{${name}}`
      );
    }
    return result;
  }, [locale, overrides]);

  const value = useMemo(() => ({ locale, t, setLocale }), [locale, t, setLocale]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

export function useT() {
  return useContext(I18nContext).t;
}