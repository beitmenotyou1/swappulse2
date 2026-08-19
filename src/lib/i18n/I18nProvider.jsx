import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { translations, LOCALE_TO_TCGDEX, SUPPORTED_LOCALES } from './translations';
import { setCurrentTcgdexLang } from './currentLang';

const I18nContext = createContext({ locale: 'en-GB', t: (k) => k, setLocale: () => {}, overrides: {} });

// Map TCGDex language codes to locale codes for TranslationOverride merging
const TCGDEX_TO_LOCALES = {
  en: ['en-GB', 'en-US'],
  fr: ['fr-FR'],
  de: ['de-DE'],
  it: ['it-IT'],
  es: ['es-ES'],
  pt: ['pt-BR'],
  jp: ['ja-JP'],
  zh: ['zh-CN'],
  ko: ['ko-KR'],
};

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
  const [overrides, setOverrides] = useState({});

  // Load TranslationOverride records once on mount and build a map of
  // locale → { key → value }. Only records with a non-empty value are loaded.
  // The merge order in t() is: static translations.js (human) > overrides (AI) > English.
  useEffect(() => {
    (async () => {
      try {
        const records = await base44.entities.TranslationOverride.list('-created_date', 5000);
        if (!records || records.length === 0) return;
        const map = {};
        for (const rec of records) {
          if (!rec.value) continue;
          const locales = TCGDEX_TO_LOCALES[rec.language] || [];
          for (const loc of locales) {
            if (!map[loc]) map[loc] = {};
            map[loc][rec.translation_key] = rec.value;
          }
        }
        setOverrides(map);
      } catch (e) {
        // Silent fail — overrides are a progressive enhancement
        console.error('I18nProvider: failed to load TranslationOverride', e?.message || e);
      }
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

  // On mount, if authenticated, pick up a previously-saved locale from the user record.
  // Skip this if a ?lang= URL param is present — that represents an explicit choice from
  // a promo post link and must not be overridden by the user's saved account locale.
  useEffect(() => {
    (async () => {
      try {
        if (typeof window !== 'undefined' && window.location?.search) {
          const params = new URLSearchParams(window.location.search);
          if (params.get('lang')) return; // URL param wins, don't override
        }
        const authed = await base44.auth.isAuthenticated();
        if (!authed) return;
        const me = await base44.auth.me();
        const saved = me?.locale;
        if (saved && SUPPORTED_LOCALES.includes(saved) && saved !== locale) {
          setLocaleState(saved);
          try { localStorage.setItem('swappulse-locale', saved); } catch {}
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const t = useCallback((key) => {
    const staticDict = translations[locale] || translations['en-GB'];
    const enDict = translations['en-GB'];
    const overrideDict = overrides[locale];
    // Human translation (static) wins, then AI override, then English, then key
    return staticDict[key] ?? overrideDict?.[key] ?? enDict[key] ?? key;
  }, [locale, overrides]);

  return (
    <I18nContext.Provider value={{ locale, t, setLocale, overrides }}>
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