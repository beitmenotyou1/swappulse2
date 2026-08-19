// SwapPulse i18n — core UI strings translated into every TCGDex-supported language.
// Locales map to TCGDex language codes for catalogue data; ar/hi/ru fall back to en
// (not TCGDex languages) but the UI still renders English for them.
//
// Each language's translations live in its own file under ./translations/<lang>.js
// for easier maintenance. This file re-exports them as a single dictionary.

import en from './translations/en';
import fr from './translations/fr';
import es from './translations/es';
import de from './translations/de';
import it from './translations/it';
import pt from './translations/pt';
import ja from './translations/ja';
import zh from './translations/zh';
import ko from './translations/ko';

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
