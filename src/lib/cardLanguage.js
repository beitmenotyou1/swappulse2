// Card data language override — separate from the UI locale.
// Lets a user view Pokémon TCG card data (names, descriptions, set names) in
// any of the 17 TCGDex-supported languages, independent of the interface
// language. Persisted in localStorage and synced to the user's account.
//
// Supported languages (17): https://tcgdex.dev/errors/language-invalid
// en, fr, de, it, es, pt, jp, zh, ko, pt-br, pt-pt, nl, pl, ru, zh-cn, id, th

import { base44 } from '@/api/base44Client';
import { getCurrentTcgdexLang, setCurrentTcgdexLang } from '@/lib/i18n/currentLang';

export const CARD_LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'fr', label: 'French', native: 'Français' },
  { code: 'de', label: 'German', native: 'Deutsch' },
  { code: 'it', label: 'Italian', native: 'Italiano' },
  { code: 'es', label: 'Spanish', native: 'Español' },
  { code: 'pt', label: 'Portuguese', native: 'Português' },
  { code: 'pt-br', label: 'Portuguese (Brazil)', native: 'Português (Brasil)' },
  { code: 'pt-pt', label: 'Portuguese (Portugal)', native: 'Português (Portugal)' },
  { code: 'nl', label: 'Dutch', native: 'Nederlands' },
  { code: 'pl', label: 'Polish', native: 'Polski' },
  { code: 'ru', label: 'Russian', native: 'Русский' },
  { code: 'jp', label: 'Japanese', native: '日本語' },
  { code: 'ko', label: 'Korean', native: '한국어' },
  { code: 'zh', label: 'Chinese (Traditional)', native: '繁體中文' },
  { code: 'zh-cn', label: 'Chinese (Simplified)', native: '简体中文' },
  { code: 'id', label: 'Indonesian', native: 'Bahasa Indonesia' },
  { code: 'th', label: 'Thai', native: 'ภาษาไทย' },
];

const STORAGE_KEY = 'sp_card_lang';
const listeners = new Set();

function getStored() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function setStored(lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {}
}

/**
 * Returns the user's explicit card language override, or null if none is set
 * (meaning the auto-detected UI locale mapping should be used).
 */
export function getCardLanguageOverride() {
  const stored = getStored();
  if (stored && CARD_LANGUAGES.some((l) => l.code === stored)) return stored;
  return null;
}

/**
 * Get the current card data language. Returns the override if set, otherwise
 * falls back to the auto-detected TCGDex language from the UI locale.
 */
export function getCardLanguage() {
  const stored = getStored();
  if (stored && CARD_LANGUAGES.some((l) => l.code === stored)) return stored;
  return getCurrentTcgdexLang() || 'en';
}

/**
 * Override the card data language. Pass null to clear the override and revert
 * to the auto-detected language from the UI locale.
 */
export function setCardLanguage(lang) {
  if (lang === null) {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  } else if (CARD_LANGUAGES.some((l) => l.code === lang)) {
    setStored(lang);
  } else {
    return;
  }
  const effective = getCardLanguage();
  setCurrentTcgdexLang(effective);
  listeners.forEach((fn) => fn(effective));
  // Persist to user account so it survives sessions/devices.
  base44.auth.updateMe({ card_language: lang }).catch(() => {});
}

/**
 * Subscribe to card language changes. Returns an unsubscribe function.
 */
export function subscribeCardLanguage(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Get the native label for a language code.
 */
export function getLanguageLabel(code) {
  const lang = CARD_LANGUAGES.find((l) => l.code === code);
  return lang ? lang.native : code;
}