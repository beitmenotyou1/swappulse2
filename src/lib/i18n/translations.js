// SwapPulse i18n — locale registry and re-exports.
//
// Each language's strings live in its own file under ./locales/ for
// maintainability. This file maps UI locales to TCGDex language codes and
// assembles the `translations` dictionary consumed by I18nProvider.
//
// Locales map to TCGDex language codes for catalogue data; ar/hi/ru fall back
// to en (not TCGDex languages) but the UI still renders English for them.

import en from './locales/en';
import fr from './locales/fr';
import es from './locales/es';
import de from './locales/de';
import it from './locales/it';
import pt from './locales/pt';
import ja from './locales/ja';
import zh from './locales/zh';
import ko from './locales/ko';

export const SUPPORTED_LOCALES = [
  'en-GB', 'en-US', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR',
  'ja-JP', 'zh-CN', 'ko-KR', 'ar-SA', 'hi-IN', 'ru-RU',
];

export const LOCALE_TO_TCGDEX = {
  'en-GB': 'en', 'en-US': 'en', 'es-ES': 'es', 'fr-FR': 'fr', 'de-DE': 'de',
  'it-IT': 'it', 'pt-BR': 'pt', 'ja-JP': 'jp', 'zh-CN': 'zh', 'ko-KR': 'ko',
  'ar-SA': 'en', 'hi-IN': 'en', 'ru-RU': 'en',
};

export const translations = {
  'en-GB': en, 'en-US': en,
  'fr-FR': fr, 'es-ES': es, 'de-DE': de, 'it-IT': it, 'pt-BR': pt,
  'ja-JP': ja, 'zh-CN': zh, 'ko-KR': ko,
  // ar-SA, hi-IN, ru-RU fall back to en (not TCGDex languages)
  'ar-SA': en, 'hi-IN': en, 'ru-RU': en,
};