// Perceptual hash (pHash) — 8×8 grayscale average hash for card images.
// Compares hashes by Hamming distance. Used by the scanner fast-path to
// identify clear card photos instantly without an LLM call.
//
// Algorithm: fetch image → decode → resize to 8×8 grayscale (box-average) →
// compute mean → each pixel above mean = 1, below = 0 → 64-bit hash → hex.
// Pure computation; no external model. JPEG and PNG decoding via dynamic
// npm imports (graceful fallback if the packages aren't available).

interface DecodedImage {
  width: number;
  height: number;
  data: Uint8Array; // RGBA
}

async function decodeImage(buffer: ArrayBuffer): Promise<DecodedImage | null> {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 4) return null;

  // JPEG: FF D8
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    try {
      const mod: any = await import('npm:jpeg-js@0.4.4');
      const jpeg = mod.default || mod;
      const raw = jpeg.decode(buffer, { useTArray: true });
      if (!raw?.width || !raw?.height) return null;
      return { width: raw.width, height: raw.height, data: raw.data };
    } catch (e) {
      console.error('[phash] JPEG decode failed', e?.message || e);
      return null;
    }
  }

  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    try {
      const mod: any = await import('npm:upng-js@2.1.3');
      const UPNG = mod.default || mod;
      const png = UPNG.decode(buffer);
      if (!png?.width || !png?.height) return null;
      const rgba = UPNG.toRGBA8(png)[0];
      return { width: png.width, height: png.height, data: new Uint8Array(rgba) };
    } catch (e) {
      console.error('[phash] PNG decode failed', e?.message || e);
      return null;
    }
  }

  return null;
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
    const img = await decodeImage(buffer);
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

// Build a PNG URL from a TCGDex image path/URL (for pHash fetching — PNG is
// decodable; WebP is not without a dedicated decoder).
export function buildPngUrl(image: any): string | null {
  if (!image) return null;
  const base = typeof image === 'string' ? image : (image?.base || image?.high || '');
  if (!base) return null;
  const s = String(base);
  if (s.startsWith('http')) {
    if (s.endsWith('.webp')) return s.replace(/\.webp$/, '.png');
    if (/\.(png|jpg|jpeg)$/.test(s)) return s;
    return `${s}/high.png`;
  }
  return `https://assets.tcgdex.net/${s}/high.png`;
}