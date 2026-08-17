// Module-level current TCGDex language, readable by non-React code (tcgdex.js).
// Set by I18nProvider whenever the user's locale changes.
let currentTcgdexLang = 'en';

export function getCurrentTcgdexLang() {
  return currentTcgdexLang;
}

export function setCurrentTcgdexLang(lang) {
  currentTcgdexLang = lang || 'en';
}