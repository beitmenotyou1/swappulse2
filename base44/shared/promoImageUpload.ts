// Shared hardened image upload for promotional AT Protocol previews.
// Validates the fetched bytes are a real image, enforces the 1MB thumbnail
// limit, normalizes the mimeType, and uploads to the PDS as a blob. Returns a
// null blob on any validation or upload failure so callers abort rather than
// publishing a visual promotion as plain text.

import { getPdsSessionForUser, clearPdsSession } from './pdsSession.ts';

export interface BlobRef {
  $type: 'blob';
  ref: { $link: string };
  mimeType: string;
  size: number;
}

const MAX_IMAGE_BYTES = 1_000_000; // AT Protocol promo thumbnail limit
const MEDIA_REQUEST_TIMEOUT_MS = 12_000;

async function fetchWithTimeout(input: string | URL, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MEDIA_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Detect the image format from magic bytes. Returns the canonical mimeType
 * (image/png, image/jpeg, image/webp) or null if the bytes don't match a
 * supported format.
 */
function detectImageType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  // Keep promo thumbnails to JPEG/PNG for broad AT client compatibility.
  // Reject other formats here so the caller can use known-good fallback art
  // rather than publishing a preview that some clients may not render.
  return null;
}

/**
 * Normalize a raw content-type header value to a canonical image mimeType.
 * Strips charset/parameters and maps image/jpg → image/jpeg. Returns null if
 * the value is not a supported image type.
 */
function normalizeMimeType(raw: string): string | null {
  if (!raw) return null;
  const base = raw.split(';')[0].trim().toLowerCase();
  if (base === 'image/jpg') return 'image/jpeg';
  // Only JPEG and PNG are accepted for broad preview compatibility.
  if (base === 'image/jpeg' || base === 'image/png') return base;
  return null;
}

/**
 * Fetch an image from `imageUrl`, validate it, and upload it to the PDS as a
 * blob. Returns the blob ref for use as a promo-preview thumbnail, or null on
 * any failure (non-image content, oversize, bad magic bytes, upload error). The
 * caller must abort the post when the blob is null — never publish text-only.
 *
 * Retries once on transient failures and refreshes the PDS session on 401.
 */
export async function uploadPromoImage(
  pdsUrl: string,
  accessJwt: string,
  imageUrl: string,
  cred: { did: string; app_password: string },
): Promise<{ blob: BlobRef | null; accessJwt: string }> {
  let currentJwt = accessJwt;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // Send an explicit Accept header so CDNs return the JPEG/PNG formats
      // used by every current promo-preview path.
      const imgRes = await fetchWithTimeout(imageUrl, {
        headers: { 'Accept': 'image/png, image/jpeg' },
      });
      if (!imgRes.ok) {
        console.error('promoImageUpload: image fetch failed', imgRes.status, imageUrl);
        if (attempt === 0) continue;
        return { blob: null, accessJwt: currentJwt };
      }

      // Reject non-image content-types even on 200 (error pages, redirects to HTML)
      const rawContentType = imgRes.headers.get('content-type') || '';
      if (!rawContentType.toLowerCase().startsWith('image/')) {
        console.error('promoImageUpload: non-image content-type', JSON.stringify(rawContentType), '— aborting');
        return { blob: null, accessJwt: currentJwt };
      }

      const bytes = new Uint8Array(await imgRes.arrayBuffer());

      // Enforce Bluesky's 1MB embed limit
      if (bytes.length > MAX_IMAGE_BYTES) {
        console.error('promoImageUpload: image too large', bytes.length, `bytes (limit ${MAX_IMAGE_BYTES}) — aborting`);
        return { blob: null, accessJwt: currentJwt };
      }

      // Validate magic bytes — reject if not a real PNG/JPEG/WebP
      const detectedType = detectImageType(bytes);
      if (!detectedType) {
        console.error('promoImageUpload: magic bytes do not match PNG/JPEG/WebP — aborting');
        return { blob: null, accessJwt: currentJwt };
      }

      const contentTypeMime = normalizeMimeType(rawContentType);
      // Use the magic-byte-detected type for the upload header (authoritative)
      const uploadMime = detectedType;

      const uploadRes = await fetchWithTimeout(`${pdsUrl}/xrpc/com.atproto.repo.uploadBlob`, {
        method: 'POST',
        headers: {
          'Content-Type': uploadMime,
          'Authorization': `Bearer ${currentJwt}`,
        },
        body: bytes,
      });

      if (!uploadRes.ok) {
        const text = await uploadRes.text();
        console.error('promoImageUpload: uploadBlob failed', uploadRes.status, text.slice(0, 300));
        if (uploadRes.status === 401 && attempt === 0) {
          try {
            clearPdsSession();
            const refreshed = await getPdsSessionForUser(pdsUrl, cred.did, cred.app_password);
            currentJwt = refreshed.session.accessJwt;
            console.log('promoImageUpload: refreshed PDS session after 401, retrying');
            continue;
          } catch (e) {
            console.error('promoImageUpload: session refresh failed', e?.message || e);
            return { blob: null, accessJwt: currentJwt };
          }
        }
        if (attempt === 0) continue;
        return { blob: null, accessJwt: currentJwt };
      }

      const data = await uploadRes.json();
      const blob = data.blob;
      if (!blob?.ref?.$link) {
        console.error('promoImageUpload: no blob cid in uploadBlob response');
        if (attempt === 0) continue;
        return { blob: null, accessJwt: currentJwt };
      }

      // Validate the PDS-returned mimeType matches the supported thumbnail
      // formats. If not, abort and let the caller use its fallback/skip path.
      const pdsMime = normalizeMimeType(blob.mimeType);
      if (!pdsMime) {
        console.error('promoImageUpload: PDS returned unsupported mimeType', JSON.stringify(blob.mimeType), '— aborting');
        return { blob: null, accessJwt: currentJwt };
      }

      // Use the PDS's blob object DIRECTLY. The record must reference exactly
      // what the PDS stored rather than reconstructing CID, mimeType or size.
      return {
        blob: blob,
        accessJwt: currentJwt,
      };
    } catch (e) {
      console.error('promoImageUpload: failed (attempt ' + (attempt + 1) + ')', e?.message || e);
      if (attempt === 1) return { blob: null, accessJwt: currentJwt };
    }
  }
  return { blob: null, accessJwt: currentJwt };
}