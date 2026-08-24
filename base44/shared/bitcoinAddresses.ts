// bitcoinAddresses — derives addresses for Bitcoin and all Bitcoin-derived
// chains (Bitcoin Cash, Dogecoin, Litecoin) from a single secp256k1 private
// key. Bitcoin uses P2WPKH (bech32); the others use P2PKH with chain-specific
// version bytes. Bitcoin Cash uses the CashAddr encoding format.

import { getPublicKey } from 'npm:@noble/secp256k1@2.3.0';

// ── bech32 / CashAddr encoding (shared algorithm, different HRP + separator) ──

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function bech32Polymod(values: number[]): number {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const b = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) {
      if ((b >> i) & 1) chk ^= GEN[i];
    }
  }
  return chk;
}

function bech32HrpExpand(hrp: string): number[] {
  const ret: number[] = [];
  for (const c of hrp) ret.push(c.charCodeAt(0) >> 5);
  ret.push(0);
  for (const c of hrp) ret.push(c.charCodeAt(0) & 31);
  return ret;
}

function bech32Checksum(hrp: string, data: number[]): string {
  const values = [...bech32HrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0];
  const polymod = bech32Polymod(values) ^ 1;
  let ret = '';
  for (let i = 0; i < 6; i++) {
    ret += CHARSET[(polymod >> (5 * (5 - i))) & 31];
  }
  return ret;
}

function convertBits(data: Uint8Array, fromBits: number, toBits: number): number[] {
  let acc = 0, bits = 0;
  const ret: number[] = [];
  const maxv = (1 << toBits) - 1;
  for (const value of data) {
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      ret.push((acc >> bits) & maxv);
    }
  }
  if (bits > 0) {
    ret.push((acc << (toBits - bits)) & maxv);
  }
  return ret;
}

// ── base58check encoding (for Dogecoin, Litecoin P2PKH) ──

const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(data: Uint8Array): string {
  let result = '';
  const digits: number[] = [];
  for (const byte of data) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  for (const byte of data) {
    if (byte === 0) result += '1';
    else break;
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    result += B58_ALPHABET[digits[i]];
  }
  return result;
}

async function doubleSha256(data: Uint8Array): Promise<Uint8Array> {
  const h1 = await crypto.subtle.digest('SHA-256', data);
  const h2 = await crypto.subtle.digest('SHA-256', h1);
  return new Uint8Array(h2);
}

async function base58CheckEncode(version: number, payload: Uint8Array): Promise<string> {
  const data = new Uint8Array(1 + payload.length + 4);
  data[0] = version;
  data.set(payload, 1);
  const checksum = await doubleSha256(data.slice(0, 1 + payload.length));
  data.set(checksum.slice(0, 4), 1 + payload.length);
  return base58Encode(data);
}

// ── hash160 = RIPEMD160(SHA256(pubkey)) ──
// RIPEMD160 is not in Web Crypto; use a compact pure-JS implementation.

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data));
}

// Minimal RIPEMD-160 implementation
function ripemd160(msg: Uint8Array): Uint8Array {
  // RIPEMD-160 constants
  const ROL = (x: number, n: number) => ((x << n) | (x >>> (32 - n))) >>> 0;
  const F = (x: number, y: number, z: number) => (x ^ y ^ z) >>> 0;
  const G = (x: number, y: number, z: number) => ((x & y) | (~x & z)) >>> 0;
  const H = (x: number, y: number, z: number) => ((x | ~y) ^ z) >>> 0;
  const I = (x: number, y: number, z: number) => ((x & z) | (y & ~z)) >>> 0;
  const J = (x: number, y: number, z: number) => (x ^ (y | ~z)) >>> 0;

  const rl = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,7,4,13,1,10,6,15,3,12,0,9,5,2,14,11,8,3,10,14,4,9,15,8,1,2,7,0,6,13,11,5,12,1,9,11,10,0,8,12,4,13,3,2,15,6,7,8,9,15,5,0,14,9,2,7,11,4,1,12,10,3,8,13,6,2,15,7,4,0,5,10,9,14,3,12,13,1,8,6,4,11,2,5,14,0,3,9,7,6,10,1,15,8,13];
  const rr = [5,14,7,0,9,2,11,4,13,6,15,8,1,10,3,12,6,11,3,7,0,13,5,10,14,15,8,12,4,9,1,2,15,5,14,10,4,7,0,3,9,11,13,6,8,12,2,1,0,15,13,8,10,3,7,4,9,6,2,11,13,14,1,7,4,10,8,13,15,12,9,0,3,5,6,11,2,14,9,1,8,10,7,0,13,4,5,14,3,12,11,6,9,15,2,5,8,14,11,12,4,9,1,7,0,15,10,13,6,3,12,2,9,5,10,15,4,7,1,8,11];
  const sl = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,7,4,13,1,10,6,15,3,12,0,9,5,2,14,11,8,3,10,14,4,9,15,8,1,2,7,0,6,13,11,5,12,1,9,11,10,0,8,12,4,13,3,2,15,6,7,8,9,15,5,0,14,9,2,7,11,4,1,12,10,3,8,13,6,2,15,7,4,0,5,10,9,14,3,12,13,1,8,6,4,11,2,5,14,0,3,9,7,6,10,1,15,8,13];
  const sr = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,5,14,7,0,9,2,11,4,13,6,15,8,1,10,3,12,6,11,3,7,0,13,5,10,14,15,8,12,4,9,1,2,15,5,14,8,12,11,4,9,1,7,0,3,12,2,9,5,14,1,7,4,10,8,13,15,12,9,0,3,5,6,11,2,14,9,1,8,10,7,0,13,4,5,14,3,12,11,6,9,15,2,5,8,14,11,12,4,9,1,7,0,15,10,13,6,3,12,2,9,5,10,15,4,7,1,8,11];
  const Kl = [0x00000000,0x5A827999,0x6ED9EBA1,0x8F1BBCDC,0xA953FD4E];
  const Kr = [0x50A28BE6,0x5C4DD124,0x6D703EF3,0x7A6D76E9,0x00000000];

  // Pad message
  const msgLen = msg.length;
  const padded = new Uint8Array(msgLen + 1 + 8 + 64);
  padded.set(msg);
  padded[msgLen] = 0x80;
  const bitLen = BigInt(msgLen) * 8n;
  const dv = new DataView(padded.buffer);
  dv.setUint32(msgLen + 1, Number(bitLen & 0xffffffffn), true);
  dv.setUint32(msgLen + 5, Number((bitLen >> 32n) & 0xffffffffn), true);
  const totalLen = msgLen + 1 + 8;
  const blocks = Math.ceil(totalLen / 64) * 64;

  let h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;

  for (let off = 0; off < blocks; off += 64) {
    const x: number[] = [];
    for (let j = 0; j < 16; j++) {
      x.push(dv.getUint32(off + j * 4, true));
    }
    let al = h0, bl = h1, cl = h2, dl = h3, el = h4;
    let ar = h0, br = h1, cr = h2, dr = h3, er = h4;

    for (let j = 0; j < 80; j++) {
      let t: number;
      if (j < 16) t = F(bl, cl, dl);
      else if (j < 32) t = G(bl, cl, dl);
      else if (j < 48) t = H(bl, cl, dl);
      else if (j < 64) t = I(bl, cl, dl);
      else t = J(bl, cl, dl);
      t = (t + x[rl[j]] + al + Kl[Math.floor(j / 16)]) >>> 0;
      t = ROL(t, sl[j]);
      al = el; el = dl; dl = cl; cl = bl; bl = t;

      if (j < 16) t = F(br, cr, dr);
      else if (j < 32) t = G(br, cr, dr);
      else if (j < 48) t = H(br, cr, dr);
      else if (j < 64) t = I(br, cr, dr);
      else t = J(br, cr, dr);
      t = (t + x[rr[j]] + ar + Kr[Math.floor(j / 16)]) >>> 0;
      t = ROL(t, sr[j]);
      ar = er; er = dr; dr = cr; cr = br; br = t;
    }

    const tmp = (h1 + cl + dr) >>> 0;
    h1 = (h2 + dl + er) >>> 0;
    h2 = (h3 + el + ar) >>> 0;
    h3 = (h4 + al + br) >>> 0;
    h4 = (h0 + bl + cr) >>> 0;
    h0 = tmp;
  }

  const out = new Uint8Array(20);
  const ov = new DataView(out.buffer);
  ov.setUint32(0, h0, true);
  ov.setUint32(4, h1, true);
  ov.setUint32(8, h2, true);
  ov.setUint32(12, h3, true);
  ov.setUint32(16, h4, true);
  return out;
}

async function hash160(pubkey: Uint8Array): Promise<Uint8Array> {
  const sha = await sha256(pubkey);
  return ripemd160(sha);
}

// ── Public API ──

export interface BitcoinDerivedAddresses {
  bitcoin: string;        // P2WPKH bech32 (bc1q...)
  bitcoinCash: string;     // CashAddr (bitcoincash:q...)
  dogecoin: string;         // P2PKH base58 (D...)
  litecoin: string;         // P2PKH base58 (L...)
}

// Derives all Bitcoin-family addresses from a 32-byte secp256k1 private key.
export async function deriveBitcoinAddresses(privKeyHex: string): Promise<BitcoinDerivedAddresses> {
  const privKey = new Uint8Array(
    privKeyHex.match(/.{2}/g)!.map((b) => parseInt(b, 16))
  );
  // Compressed public key (33 bytes)
  const pubKey = getPublicKey(privKey, true);
  const h160 = await hash160(pubKey);

  // Bitcoin P2WPKH (bech32, HRP "bc")
  const witData = [0x00, ...convertBits(h160, 8, 5)];
  const btcChecksum = bech32Checksum('bc', witData);
  const bitcoin = 'bc1' + witData.slice(1).map((d) => CHARSET[d]).join('') + btcChecksum;

  // Bitcoin Cash CashAddr (HRP "bitcoincash", version byte 0x00 for P2PKH)
  const bchPayload = new Uint8Array(21);
  bchPayload[0] = 0x00;
  bchPayload.set(h160, 1);
  const bchData = convertBits(bchPayload, 8, 5);
  const bchChecksum = bech32Checksum('bitcoincash', bchData);
  const bitcoinCash = 'bitcoincash:' + bchData.map((d) => CHARSET[d]).join('') + bchChecksum;

  // Dogecoin P2PKH (version byte 0x1e)
  const dogecoin = await base58CheckEncode(0x1e, h160);

  // Litecoin P2PKH (version byte 0x30)
  const litecoin = await base58CheckEncode(0x30, h160);

  return { bitcoin, bitcoinCash, dogecoin, litecoin };
}