import { useEffect } from 'react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { SUPPORTED_LOCALES } from '@/lib/i18n/translations';

// Default site-wide social share image — used when a page doesn't provide
// its own ogImage (e.g. card image, avatar, post image). Ensures every page
// renders a full large-card embed when shared on social platforms.
const DEFAULT_OG_IMAGE = 'https://media.base44.com/images/public/6a63d9d64a4d65d370c70892/1c0d22eac_generated_image.png';

// BCP-47 locale → Facebook og:locale format (underscore, not hyphen).
const LOCALE_TO_OG = {
  'en-GB': 'en_GB', 'es-ES': 'es_ES', 'fr-FR': 'fr_FR', 'de-DE': 'de_DE',
  'it-IT': 'it_IT', 'pt-BR': 'pt_BR', 'ja-JP': 'ja_JP', 'zh-CN': 'zh_CN', 'ko-KR': 'ko_KR',
};

// Add or remove the ?lang=LOCALE query param on a canonical URL, returning the
// full URL string. Used to build hreflang alternates — the app localises via
// ?lang= (see I18nProvider), so each language variant lives at the same path
// with a different ?lang= value.
function withLang(urlStr, lang) {
  try {
    const u = new URL(urlStr);
    if (lang) u.searchParams.set('lang', lang);
    else u.searchParams.delete('lang');
    return u.toString();
  } catch {
    return urlStr;
  }
}

// useSEO — writes per-page <title>, meta description, Open Graph tags (including
// og:locale + og:locale:alternate for all 9 supported languages), Twitter card,
// canonical link, hreflang alternates (one per supported locale + x-default),
// and optional JSON-LD structured data into the document head. Cleans up only
// the tags it added (tagged with data-seo-managed) on unmount or when the
// metadata changes, so navigating between pages leaves no stale tags.
//
// The active locale (from useI18n) drives og:locale and the hreflang set, so
// search engines and social platforms see the correct language for every page
// and discover all 9 language variants.
//
// Usage:
//   useSEO({ title, description, canonicalPath, jsonLd, ogImage })
export default function useSEO({
  title,
  description = '',
  canonicalPath = '',
  jsonLd = null,
  ogImage = DEFAULT_OG_IMAGE,
  standardDocUri = '',
} = {}) {
  const { locale } = useI18n();
  const currentLocale = locale || 'en-GB';

  useEffect(() => {
    const TAG = 'data-seo-managed';
    // Remove any previously-managed tags.
    document.querySelectorAll(`[${TAG}]`).forEach((el) => el.remove());

    const head = document.head;
    const origin = window.location.origin;
    const canonical = canonicalPath ? `${origin}${canonicalPath}` : window.location.href;

    // Title
    const fullTitle = title ? `${title}, SwapPulse` : 'SwapPulse, Free & Open-Source Pokémon TCG Collector Network';
    document.title = fullTitle;

    // setMeta — for unique keys: removes any existing meta (static or managed)
    // with the same name/property so page-specific tags override index.html
    // defaults, then appends a managed tag.
    const setMeta = (attrs) => {
      const key = attrs.name ? 'name' : 'property';
      if (key && attrs[key]) {
        head.querySelectorAll(`meta[${key}="${attrs[key]}"]`).forEach((el) => el.remove());
      }
      const el = document.createElement('meta');
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      el.setAttribute(TAG, 'true');
      head.appendChild(el);
      return el;
    };

    // appendMeta — for multi-value keys (e.g. og:locale:alternate) where many
    // tags share the same property. Does not remove existing tags; the
    // start-of-effect cleanup already cleared the previous run's managed tags.
    const appendMeta = (attrs) => {
      const el = document.createElement('meta');
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      el.setAttribute(TAG, 'true');
      head.appendChild(el);
      return el;
    };

    // Description
    if (description) {
      setMeta({ name: 'description', content: description });
    }

    // Open Graph
    setMeta({ property: 'og:title', content: fullTitle });
    if (description) setMeta({ property: 'og:description', content: description });
    setMeta({ property: 'og:type', content: 'website' });
    setMeta({ property: 'og:url', content: canonical });
    setMeta({ property: 'og:site_name', content: 'SwapPulse' });
    setMeta({ property: 'og:locale', content: LOCALE_TO_OG[currentLocale] || 'en_GB' });
    for (const loc of SUPPORTED_LOCALES) {
      if (loc === currentLocale) continue;
      appendMeta({ property: 'og:locale:alternate', content: LOCALE_TO_OG[loc] || loc.replace('-', '_') });
    }
    if (ogImage) setMeta({ property: 'og:image', content: ogImage });

    // Twitter card
    setMeta({ name: 'twitter:card', content: ogImage ? 'summary_large_image' : 'summary' });
    setMeta({ name: 'twitter:title', content: fullTitle });
    if (description) setMeta({ name: 'twitter:description', content: description });
    if (ogImage) setMeta({ name: 'twitter:image', content: ogImage });

    // Canonical link — remove any existing canonical (static or managed) first
    head.querySelectorAll('link[rel="canonical"]').forEach((el) => el.remove());
    const link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    link.setAttribute('href', canonical);
    link.setAttribute(TAG, 'true');
    head.appendChild(link);

    // hreflang alternates — one <link rel="alternate" hreflang="LOCALE"> per
    // supported locale (pointing at the same URL with ?lang=LOCALE) plus an
    // x-default pointing at the lang-less canonical. Declares to search
    // engines that every page exists in all 9 supported languages.
    head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
    const xDefault = document.createElement('link');
    xDefault.setAttribute('rel', 'alternate');
    xDefault.setAttribute('hreflang', 'x-default');
    xDefault.setAttribute('href', withLang(canonical, null));
    xDefault.setAttribute(TAG, 'true');
    head.appendChild(xDefault);
    for (const loc of SUPPORTED_LOCALES) {
      const alt = document.createElement('link');
      alt.setAttribute('rel', 'alternate');
      alt.setAttribute('hreflang', loc);
      alt.setAttribute('href', withLang(canonical, loc));
      alt.setAttribute(TAG, 'true');
      head.appendChild(alt);
    }

    // Standard.site document verification link — confirms the page at this
    // URL owns the referenced site.standard.document record. External
    // verifiers (pckt, docs.surf, Standard Search) check for this tag.
    head.querySelectorAll('link[rel="site.standard.document"]').forEach((el) => el.remove());
    if (standardDocUri) {
      const stdLink = document.createElement('link');
      stdLink.setAttribute('rel', 'site.standard.document');
      stdLink.setAttribute('href', standardDocUri);
      stdLink.setAttribute(TAG, 'true');
      head.appendChild(stdLink);
    }

    // JSON-LD structured data
    if (jsonLd) {
      const script = document.createElement('script');
      script.setAttribute('type', 'application/ld+json');
      script.setAttribute(TAG, 'true');
      script.textContent = JSON.stringify(jsonLd);
      head.appendChild(script);
    }

    return () => {
      document.querySelectorAll(`[${TAG}]`).forEach((el) => el.remove());
    };
  }, [title, description, canonicalPath, ogImage, standardDocUri, currentLocale, JSON.stringify(jsonLd)]);
}