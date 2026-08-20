// Shared hardened image upload for promo posts (post-promo + post-help-promo).
// Validates the fetched bytes are a real image, enforces Bluesky's 1MB embed
// limit, normalizes the mimeType, and uploads to the PDS as a blob. Returns a
// null blob on any validation or upload failure so the caller can abort the
// post — never publish a text-only promo.

import { getPdsSessionForUser, clearPdsSession } from './pdsSession.ts';

export interface BlobRef {
  $type: 'blob';
  ref: { $link: string };
  mimeType: string;
  size: number;
}

const MAX_IMAGE_BYTES = 1_000_000; // Bluesky's app.bsky.embed.images limit

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
  // WebP: RIFF....WEBP
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
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
  if (base === 'image/jpeg' || base === 'image/png' || base === 'image/webp') return base;
  return null;
}

/**
 * Fetch an image from `imageUrl`, validate it, and upload it to the PDS as a
 * blob. Returns the blob ref for use in app.bsky.embed.images, or null on any
 * failure (non-image content, oversize, bad magic bytes, upload error). The
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
      const imgRes = await fetch(imageUrl);
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

      const uploadRes = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.uploadBlob`, {
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

      // Normalize mimeType: prefer PDS-returned, fall back to magic-byte, then content-type
      const pdsMime = normalizeMimeType(blob.mimeType);
      const finalMime = pdsMime || detectedType || contentTypeMime || 'image/png';

      return {
        blob: {
          $type: 'blob',
          ref: { $link: blob.ref.$link },
          mimeType: finalMime,
          size: blob.size ?? bytes.length,
        },
        accessJwt: currentJwt,
      };
    } catch (e) {
      console.error('promoImageUpload: failed (attempt ' + (attempt + 1) + ')', e?.message || e);
      if (attempt === 1) return { blob: null, accessJwt: currentJwt };
    }
  }
  return { blob: null, accessJwt: currentJwt };
}