// Helpers for the global image lightbox. The `Image` component serves Wix Media
// URLs resized to their container (a /v1/ transform segment); the lightbox
// shows the full-size original by stripping that transform. Other URLs pass
// through unchanged.

const WIX_MEDIA_HOSTS = ['media.base44.com', 'static.wixstatic.com'];
const FALLBACK_IMAGE_URL =
  'https://static.wixstatic.com/media/12d367_4f26ccd17f8f4e3a8958306ea08c2332~mv2.png';

// Returns the largest available version of an image URL: for Wix Media URLs,
// strips the /v1/ transform segment to resolve the original upload; for all
// other URLs, returns the input unchanged.
export function getFullSizeSrc(src) {
  if (!src || typeof src !== 'string') return src;
  try {
    const url = new URL(src);
    if (!WIX_MEDIA_HOSTS.includes(url.hostname)) return src;
    const v1 = url.pathname.indexOf('/v1/');
    if (v1 === -1) return src;
    return `${url.origin}${url.pathname.slice(0, v1)}`;
  } catch {
    return src;
  }
}

// Should a given <img> element open the lightbox when clicked? Excludes:
// - images inside a [data-no-lightbox] container (story viewer, the lightbox
//   itself, other full-screen viewers)
// -the Image component's blurred placeholder (aria-hidden) and fallback imgs
// - images that are navigation affordances (inside <a>/<button>/[role=button])
// - tiny images (avatars, icons)
export function isLightboxable(img) {
  if (!img) return false;
  if (img.closest('[data-no-lightbox]')) return false;
  if (img.getAttribute('aria-hidden') === 'true') return false;
  if (
    img.hasAttribute('data-empty-image') ||
    img.hasAttribute('data-error-image') ||
    img.hasAttribute('data-no-lightbox')
  ) {
    return false;
  }
  if (img.closest('a, button, [role="button"]')) return false;
  const src = img.currentSrc || img.src;
  if (!src || src.startsWith('data:') || src === FALLBACK_IMAGE_URL) return false;
  const rect = img.getBoundingClientRect();
  if (rect.width < 50 && rect.height < 50) return false;
  return true;
}

// Collect every lightboxable <img> within a container into {src, alt} entries
// in DOM order. Used to build the navigable gallery for a [data-lightbox] group.
export function collectGallery(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll('img'))
    .filter(isLightboxable)
    .map((img) => ({
      src: getFullSizeSrc(img.currentSrc || img.src),
      alt: img.alt || '',
    }));
}