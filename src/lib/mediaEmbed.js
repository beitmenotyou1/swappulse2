// Video platform detection and URL extraction utilities.
// Shared between the composer (to classify URLs) and the renderer (to build
// iframe embed URLs). Pure client-side — no backend calls.

// Platform detection rules. Each entry matches a URL pattern and produces an
// embeddable iframe URL. `platform` is stored on the embed_video field.
const VIDEO_PLATFORMS = [
  {
    platform: 'youtube',
    patterns: [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/,
    ],
    embed: (id) => `https://www.youtube.com/embed/${id}`,
    thumbnail: (id) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
  },
  {
    platform: 'tiktok',
    patterns: [
      /tiktok\.com\/@[\w.-]+\/video\/(\d+)/,
      /vm\.tiktok\.com\/([A-Za-z0-9]+)/,
    ],
    embed: (id) => `https://www.tiktok.com/embed/v2/${id}`,
  },
  {
    platform: 'vimeo',
    patterns: [
      /vimeo\.com\/(\d+)/,
      /player\.vimeo\.com\/video\/(\d+)/,
    ],
    embed: (id) => `https://player.vimeo.com/video/${id}`,
  },
  {
    platform: 'twitch',
    patterns: [
      /twitch\.tv\/videos\/(\d+)/,
      /clips\.twitch\.tv\/([A-Za-z0-9_-]+)/,
    ],
    embed: (id, url) => {
      if (/clips\.twitch\.tv/.test(url)) return `https://clips.twitch.tv/embed?clip=${id}&parent=${window.location.hostname}`;
      return `https://player.twitch.tv/?video=${id}&parent=${window.location.hostname}`;
    },
  },
  {
    platform: 'dailymotion',
    patterns: [
      /dailymotion\.com\/video\/([A-Za-z0-9]+)/,
      /dai\.ly\/([A-Za-z0-9]+)/,
    ],
    embed: (id) => `https://www.dailymotion.com/embed/video/${id}`,
  },
  {
    platform: 'spotify',
    patterns: [
      /open\.spotify\.com\/(track|episode|show)\/([A-Za-z0-9]+)/,
    ],
    embed: (id, url) => {
      const type = /open\.spotify\.com\/(track|episode|show)\//.exec(url)?.[1] || 'track';
      return `https://open.spotify.com/embed/${type}/${id}`;
    },
  },
];

// Classify a URL as an embeddable video. Returns { platform, embedUrl, thumbnail? }
// or null if the URL is not a recognised video platform.
export function detectVideoPlatform(url) {
  if (!url || typeof url !== 'string') return null;
  for (const p of VIDEO_PLATFORMS) {
    for (const pattern of p.patterns) {
      const match = pattern.exec(url);
      if (match) {
        const id = match[1];
        return {
          platform: p.platform,
          embedUrl: p.embed(id, url),
          thumbnail: p.thumbnail ? p.thumbnail(id) : '',
        };
      }
    }
  }
  return null;
}

export function isEmbeddableVideo(url) {
  return detectVideoPlatform(url) !== null;
}

// Extract all http(s) URLs from a text string. Used by the composer to detect
// links in the post body that should become embed_external preview cards.
const URL_REGEX = /https?:\/\/[^\s<>"']+/g;

export function extractUrls(text) {
  if (!text) return [];
  const matches = text.match(URL_REGEX) || [];
  // Dedupe and strip trailing punctuation
  return Array.from(new Set(matches.map((u) => u.replace(/[.,;:!?)]+$/, ''))));
}

// Given a post's content, find the first URL that is NOT an embeddable video.
// This is the URL that should become an embed_external preview card.
export function findPreviewableUrl(text, videoUrl) {
  const urls = extractUrls(text);
  for (const u of urls) {
    if (videoUrl && u === videoUrl) continue;
    if (isEmbeddableVideo(u)) continue;
    return u;
  }
  return null;
}

// Normalise embed_images entries to { url, alt } objects. Handles legacy
// string-only entries (from older Bluesky backfill) and new object entries.
export function normaliseImages(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === 'string') return { url: item, alt: '' };
      if (item && typeof item === 'object' && item.url) return { url: item.url, alt: item.alt || '' };
      return null;
    })
    .filter(Boolean);
}