// Perceptual hash (pHash) — 8×8 grayscale average hash for card images.
// Compares hashes by Hamming distance. Used by the scanner fast-path to
// identify clear card photos instantly without an LLM call.
//
// Algorithm: fetch image → decode JPEG → resize to 8×8 grayscale (box-average)
// → compute mean → each pixel above mean = 1, below = 0 → 64-bit hash → hex.
// JPEG decoding via jpeg-js. TCGDex images are requested as JPEG (scan images
// are already JPEG).

import jpeg from 'npm:jpeg-js@0.4.4';

interface DecodedImage {
  width: number;
  height: number;
  data: Uint8Array; // RGBA
}

function decodeImage(buffer: ArrayBuffer): DecodedImage | null {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 2) return null;
  // JPEG: FF D8
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  try {
    const raw = jpeg.decode(buffer, { useTArray: true });
    if (!raw?.width || !raw?.height) return null;
    return { width: raw.width, height: raw.height, data: raw.data };
  } catch (e) {
    console.error('[phash] JPEG decode failed', e?.message || e);
    return null;
  }
}

function toGrayscaleAndResize(img: DecodedImage): Float32Array {
  const { width: srcW, height: srcH, data } = img;
  const out = new Float32Array(64);
  const xStep = srcW / 8;
  const yStep = srcH / 8;
  for (let oy = 0; oy < 8; oy++) {
    for (let ox = 0; ox < 8; ox++) {
      let sum = 0, count = 0;
      const xStart = Math.floor(ox * xStep);
      const xEnd = Math.max(xStart + 1, Math.floor((ox + 1) * xStep));
      const yStart = Math.floor(oy * yStep);
      const yEnd = Math.max(yStart + 1, Math.floor((oy + 1) * yStep));
      for (let y = yStart; y < yEnd && y < srcH; y++) {
        for (let x = xStart; x < xEnd && x < srcW; x++) {
          const idx = (y * srcW + x) * 4;
          sum += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          count++;
        }
      }
      out[oy * 8 + ox] = count > 0 ? sum / count : 0;
    }
  }
  return out;
}

function hashFromPixels(pixels: Float32Array): string {
  let sum = 0;
  for (let i = 0; i < 64; i++) sum += pixels[i];
  const mean = sum / 64;
  let hash = 0n;
  for (let i = 0; i < 64; i++) {
    if (pixels[i] > mean) hash |= (1n << BigInt(i));
  }
  return hash.toString(16).padStart(16, '0');
}

export async function computePHashFromUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { redirect: 'error' });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const img = decodeImage(buffer);
    if (!img) return null;
    const pixels = toGrayscaleAndResize(img);
    return hashFromPixels(pixels);
  } catch (e) {
    console.error('[phash] compute failed for', url, e?.message || e);
    return null;
  }
}

export function hammingDistance(a: string, b: string): number {
  if (!a || !b || a.length !== 16 || b.length !== 16) return 64;
  try {
    const aInt = BigInt('0x' + a);
    const bInt = BigInt('0x' + b);
    let xor = aInt ^ bInt;
    let count = 0;
    while (xor > 0n) {
      count += Number(xor & 1n);
      xor >>= 1n;
    }
    return count;
  } catch {
    return 64;
  }
}

// Build a JPEG URL from a TCGDex image path/URL (for pHash fetching — JPEG is
// decodable via jpeg-js; WebP is not without a dedicated decoder).
export function buildJpgUrl(image: any): string | null {
  if (!image) return null;
  const base = typeof image === 'string' ? image : (image?.base || image?.high || '');
  if (!base) return null;
  const s = String(base);
  if (s.startsWith('http')) {
    if (/\.(webp|png)$/i.test(s)) return s.replace(/\.(webp|png)$/i, '.jpg');
    if (/\.jpe?g$/i.test(s)) return s;
    return `${s}/high.jpg`;
  }
  return `https://assets.tcgdex.net/${s}/high.jpg`;
}