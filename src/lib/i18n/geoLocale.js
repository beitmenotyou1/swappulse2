// Geo-based locale detection for SwapPulse.
// Maps a visitor's IP-derived country to the closest supported locale so the
// site auto-translates on first visit. A user's explicit language choice (via
// the language switcher, ?lang= URL param, or saved account locale) always
// takes priority over this auto-detection — see I18nProvider.jsx.

import { SUPPORTED_LOCALES } from './translations';

// ISO 3166-1 alpha-2 country code → closest supported SwapPulse locale.
// Countries not listed default to 'en-GB'.
const COUNTRY_TO_LOCALE = {
  // French-speaking
  FR: 'fr-FR', BE: 'fr-FR', LU: 'fr-FR', MC: 'fr-FR', HT: 'fr-FR',
  CI: 'fr-FR', SN: 'fr-FR', ML: 'fr-FR', BF: 'fr-FR', NE: 'fr-FR',
  BJ: 'fr-FR', TG: 'fr-FR', GA: 'fr-FR', CG: 'fr-FR', CD: 'fr-FR',
  MG: 'fr-FR', MU: 'fr-FR', SC: 'fr-FR', KM: 'fr-FR', DJ: 'fr-FR',
  RW: 'fr-FR', BI: 'fr-FR', TD: 'fr-FR', CF: 'fr-FR', GN: 'fr-FR',
  // Spanish-speaking
  ES: 'es-ES', MX: 'es-ES', AR: 'es-ES', CO: 'es-ES', CL: 'es-ES',
  PE: 'es-ES', VE: 'es-ES', UY: 'es-ES', PY: 'es-ES', BO: 'es-ES',
  EC: 'es-ES', GT: 'es-ES', CU: 'es-ES', DO: 'es-ES', HN: 'es-ES',
  SV: 'es-ES', NI: 'es-ES', CR: 'es-ES', PA: 'es-ES', PR: 'es-ES',
  GQ: 'es-ES',
  // German-speaking
  DE: 'de-DE', AT: 'de-DE', LI: 'de-DE', CH: 'de-DE',
  // Italian-speaking
  IT: 'it-IT', SM: 'it-IT', VA: 'it-IT',
  // Portuguese-speaking
  BR: 'pt-BR', PT: 'pt-BR', AO: 'pt-BR', MZ: 'pt-BR', CV: 'pt-BR',
  GW: 'pt-BR', ST: 'pt-BR', TL: 'pt-BR', MO: 'pt-BR',
  // Japanese
  JP: 'ja-JP',
  // Chinese
  CN: 'zh-CN', HK: 'zh-CN', TW: 'zh-CN', SG: 'zh-CN',
  // Korean
  KR: 'ko-KR',
};

/**
 * Returns the closest supported locale for an ISO 3166-1 alpha-2 country code.
 * Falls back to 'en-GB' for countries not in the map.
 */
export function closestLocale(countryCode) {
  if (!countryCode) return null;
  const cc = String(countryCode).toUpperCase();
  const locale = COUNTRY_TO_LOCALE[cc];
  if (locale && SUPPORTED_LOCALES.includes(locale)) return locale;
  return 'en-GB';
}

/**
 * Detects the user's locale from their IP address via free geolocation APIs.
 * Tries ipapi.co first, then ipwho.is as fallback. Returns a supported locale
 * string, or null if both fail. Times out after 3s per provider so the page
 * doesn't hang waiting for detection.
 */
export async function detectLocaleFromGeo() {
  // Primary: ipapi.co (HTTPS, free, no key required)
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch('https://ipapi.co/json/', { signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      const cc = data?.country_code || data?.countryCode;
      if (cc) return closestLocale(cc);
    }
  } catch { /* fall through to fallback */ }

  // Fallback: ipwho.is (HTTPS, free, no key required)
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch('https://ipwho.is/', { signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      const cc = data?.country_code || data?.countryCode;
      if (cc) return closestLocale(cc);
    }
  } catch { /* both providers failed */ }

  return null;
}