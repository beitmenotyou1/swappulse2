import { useEffect } from 'react';

// Default site-wide social share image — used when a page doesn't provide
// its own ogImage (e.g. card image, avatar, post image). Ensures every page
// renders a full large-card embed when shared on social platforms.
const DEFAULT_OG_IMAGE = 'https://media.base44.com/images/public/6a63d9d64a4d65d370c70892/1c0d22eac_generated_image.png';

// useSEO — writes per-page <title>, meta description, Open Graph tags,
// canonical link, and optional JSON-LD structured data into the document head.
// Cleans up only the tags it added (tagged with data-seo-managed) on unmount or
// when the metadata changes, so navigating between pages leaves no stale tags.
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
  useEffect(() => {
    const TAG = 'data-seo-managed';
    // Remove any previously-managed tags.
    document.querySelectorAll(`[${TAG}]`).forEach((el) => el.remove());

    const head = document.head;
    const origin = window.location.origin;
    const canonical = canonicalPath ? `${origin}${canonicalPath}` : window.location.href;

    // Title
    const fullTitle = title ? `${title}, SwapPulse` : 'SwapPulse, Pokémon TCG Collector Community';
    document.title = fullTitle;

    const setMeta = (selector, attrs) => {
      // Remove any existing meta tag (static or managed) with the same
      // name or property so page-specific tags override the index.html defaults.
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

    // Description
    if (description) {
      setMeta('name', { name: 'description', content: description });
    }

    // Open Graph
    setMeta('property', { property: 'og:title', content: fullTitle });
    if (description) setMeta('property', { property: 'og:description', content: description });
    setMeta('property', { property: 'og:type', content: 'website' });
    setMeta('property', { property: 'og:url', content: canonical });
    setMeta('property', { property: 'og:site_name', content: 'SwapPulse' });
    if (ogImage) setMeta('property', { property: 'og:image', content: ogImage });

    // Twitter card
    setMeta('name', { name: 'twitter:card', content: ogImage ? 'summary_large_image' : 'summary' });
    setMeta('name', { name: 'twitter:title', content: fullTitle });
    if (description) setMeta('name', { name: 'twitter:description', content: description });
    if (ogImage) setMeta('name', { name: 'twitter:image', content: ogImage });

    // Canonical link — remove any existing canonical (static or managed) first
    head.querySelectorAll('link[rel="canonical"]').forEach((el) => el.remove());
    const link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    link.setAttribute('href', canonical);
    link.setAttribute(TAG, 'true');
    head.appendChild(link);

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
  }, [title, description, canonicalPath, ogImage, standardDocUri, JSON.stringify(jsonLd)]);
}