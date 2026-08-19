import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { translations, LOCALE_TO_TCGDEX, SUPPORTED_LOCALES } from './translations';
import { setCurrentTcgdexLang } from './currentLang';

const I18nContext = createContext({ locale: 'en-GB', t: (k) => k, setLocale: () => {} });

function getInitialLocale() {
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

  // On mount, if authenticated, pick up a previously-saved locale from the user record
  useEffect(() => {
    (async () => {
      try {
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
    const dict = translations[locale] || translations['en-GB'];
    return dict[key] ?? translations['en-GB'][key] ?? key;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, t, setLocale }}>
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