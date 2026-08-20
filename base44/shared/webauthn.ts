// webauthn — server-side WebAuthn/U2F registration and authentication verification.
// Implements the subset of the WebAuthn spec needed for security-key second factor:
// challenge generation, attestation parsing (credential ID + public key extraction),
// and assertion verification (signature check against stored public key).
//
// Used by webauthn-register, webauthn-verify, and verify-login-code.

// --- base64url helpers ---

export function base64urlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64urlDecode(str: string): Uint8Array {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// --- Challenge generation ---

export function generateChallenge(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64urlEncode(bytes);
}

// --- Minimal CBOR decoder for attestation/COSE key parsing ---
// Handles only the types needed for WebAuthn: unsigned/negative ints, byte
// strings, text strings, arrays, and maps. This is NOT a general-purpose CBOR
// library — it covers the specific structures in attestation objects.

function cborDecode(bytes: Uint8Array): { value: any; offset: number } {
  return cborRead(bytes, 0);
}

function cborRead(bytes: Uint8Array, offset: number): { value: any; offset: number } {
  const first = bytes[offset++];
  const majorType = first >> 5;
  const info = first & 0x1f;

  // Read additional info for lengths > 23
  let val = info;
  if (info < 24) {
    val = info;
  } else if (info === 24) {
    val = bytes[offset++];
  } else if (info === 25) {
    val = (bytes[offset++] << 8) | bytes[offset++];
  } else if (info === 26) {
    val = (bytes[offset++] * 0x1000000) + (bytes[offset++] << 16) + (bytes[offset++] << 8) + bytes[offset++];
  } else if (info === 27) {
    // 64-bit — we only need the low 32 bits for our use case
    offset += 4;
    val = (bytes[offset++] << 24) | (bytes[offset++] << 16) | (bytes[offset++] << 8) | bytes[offset++];
  }

  switch (majorType) {
    case 0: // unsigned integer
      return { value: val, offset };
    case 1: // negative integer
      return { value: -1 - val, offset };
    case 2: { // byte string
      const data = bytes.slice(offset, offset + val);
      return { value: data, offset: offset + val };
    }
    case 3: { // text string
      const str = new TextDecoder().decode(bytes.slice(offset, offset + val));
      return { value: str, offset: offset + val };
    }
    case 4: { // array
      const arr: any[] = [];
      for (let i = 0; i < val; i++) {
        const r = cborRead(bytes, offset);
        arr.push(r.value);
        offset = r.offset;
      }
      return { value: arr, offset };
    }
    case 5: { // map
      const map: Record<number, any> = {};
      for (let i = 0; i < val; i++) {
        const k = cborRead(bytes, offset);
        offset = k.offset;
        const v = cborRead(bytes, offset);
        offset = v.offset;
        map[k.value] = v.value;
      }
      return { value: map, offset };
    }
    default:
      throw new Error(`Unsupported CBOR major type: ${majorType}`);
  }
}

// --- COSE key → JWK conversion ---

function coseKeyToJwk(coseKey: Record<number, any>): { jwk: any; alg: number } {
  const kty = coseKey[1]; // 2 = EC2, 3 = RSA
  const alg = coseKey[3]; // -7 = ES256, -257 = RS256

  if (kty === 2) {
    // EC2
    const crv = coseKey[-1]; // 1 = P-256
    const x = coseKey[-2] as Uint8Array;
    const y = coseKey[-3] as Uint8Array;
    return {
      jwk: {
        kty: 'EC',
        crv: crv === 1 ? 'P-256' : `P-${crv}`,
        x: base64urlEncode(x),
        y: base64urlEncode(y),
        ext: true,
      },
      alg: alg || -7,
    };
  } else if (kty === 3) {
    // RSA
    const n = coseKey[-1] as Uint8Array;
    const e = coseKey[-2] as Uint8Array;
    return {
      jwk: {
        kty: 'RSA',
        n: base64urlEncode(n),
        e: base64urlEncode(e),
        ext: true,
      },
      alg: alg || -257,
    };
  }
  throw new Error(`Unsupported COSE key type: ${kty}`);
}

// --- Attestation parsing (registration) ---

export interface ParsedAttestation {
  credentialId: string;
  publicKeyJwk: any;
  algorithm: number;
  counter: number;
}

export function parseAttestation(attestationObjectB64: string): ParsedAttestation {
  const attBytes = base64urlDecode(attestationObjectB64);
  const decoded = cborDecode(attBytes);
  const attObj = decoded.value as Record<string, any>;
  const authData = attObj.authData as Uint8Array;

  if (!authData || authData.length < 37) {
    throw new Error('Invalid authenticator data');
  }

  // authData layout: rpIdHash (32) + flags (1) + signCount (4) + [attestedCredentialData]
  const flags = authData[32];
  const attFlag = (flags & 0x40) !== 0; // AT flag — attested credential data present
  if (!attFlag) {
    throw new Error('Attested credential data not present');
  }

  const counter = (authData[33] << 24) | (authData[34] << 16) | (authData[35] << 8) | authData[36];

  // Attested credential data: aaguid (16) + credIdLen (2) + credId + COSE key
  let offset = 37;
  const aaguid = authData.slice(offset, offset + 16);
  offset += 16;
  const credIdLen = (authData[offset] << 8) | authData[offset + 1];
  offset += 2;
  const credId = authData.slice(offset, offset + credIdLen);
  offset += credIdLen;

  // COSE public key follows
  const coseBytes = authData.slice(offset);
  const coseResult = cborDecode(coseBytes);
  const { jwk, alg } = coseKeyToJwk(coseResult.value);

  return {
    credentialId: base64urlEncode(credId),
    publicKeyJwk: jwk,
    algorithm: alg,
    counter,
  };
}

// --- Assertion verification (authentication) ---

export interface AssertionResult {
  verified: boolean;
  counter: number;
  error?: string;
}

export async function verifyAssertion(
  authenticatorDataB64: string,
  clientDataJSONB64: string,
  signatureB64: string,
  publicKeyJwk: any,
  expectedChallenge: string,
  expectedOrigin: string,
  expectedRpId: string,
  storedCounter: number,
): Promise<AssertionResult> {
  try {
    // 1. Parse and verify clientDataJSON
    const clientDataBytes = base64urlDecode(clientDataJSONB64);
    const clientData = JSON.parse(new TextDecoder().decode(clientDataBytes));

    if (clientData.type !== 'webauthn.get') {
      return { verified: false, counter: 0, error: 'Invalid client data type' };
    }

    // Verify challenge matches expected (base64url comparison)
    const sentChallenge = clientData.challenge;
    if (sentChallenge !== expectedChallenge) {
      return { verified: false, counter: 0, error: 'Challenge mismatch' };
    }

    // Verify origin
    if (clientData.origin !== expectedOrigin) {
      return { verified: false, counter: 0, error: 'Origin mismatch' };
    }

    // 2. Parse authenticator data
    const authData = base64urlDecode(authenticatorDataB64);
    if (authData.length < 37) {
      return { verified: false, counter: 0, error: 'Invalid authenticator data' };
    }

    // Verify rpIdHash matches expected RP ID
    const rpIdHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(expectedRpId));
    const expectedRpIdHash = new Uint8Array(rpIdHash);
    let rpIdMatch = true;
    for (let i = 0; i < 32; i++) {
      if (authData[i] !== expectedRpIdHash[i]) rpIdMatch = false;
    }
    if (!rpIdMatch) {
      return { verified: false, counter: 0, error: 'RP ID mismatch' };
    }

    // Check user-present (UP) flag
    const flags = authData[32];
    if ((flags & 0x01) === 0) {
      return { verified: false, counter: 0, error: 'User not present' };
    }

    const newCounter = (authData[33] << 24) | (authData[34] << 16) | (authData[35] << 8) | authData[36];

    // 3. Verify signature over (authenticatorData || SHA-256(clientDataJSON))
    const clientDataHash = await crypto.subtle.digest('SHA-256', clientDataBytes);
    const signedData = new Uint8Array(authData.length + 32);
    signedData.set(authData, 0);
    signedData.set(new Uint8Array(clientDataHash), authData.length);

    const key = await crypto.subtle.importKey(
      'jwk',
      publicKeyJwk,
      publicKeyJwk.kty === 'EC'
        ? { name: 'ECDSA', namedCurve: publicKeyJwk.crv }
        : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    const signature = base64urlDecode(signatureB64);
    const valid = await crypto.subtle.verify(
      key.algorithm,
      key,
      signature,
      signedData,
    );

    if (!valid) {
      return { verified: false, counter: 0, error: 'Signature verification failed' };
    }

    // 4. Clone detection — counter should increase (or be 0 if authenticator doesn't support it)
    if (storedCounter > 0 && newCounter !== 0 && newCounter <= storedCounter) {
      return { verified: false, counter: 0, error: 'Counter regression — possible clone' };
    }

    return { verified: true, counter: newCounter };
  } catch (e: any) {
    return { verified: false, counter: 0, error: e?.message || 'Verification error' };
  }
}

// --- RP ID and origin configuration ---

export function getRpId(): string {
  // In production this should be the site domain. The verify-login-code and
  // webauthn functions pass the expected origin from the request, and the RP ID
  // is derived from it. For localhost development, the RP ID is 'localhost'.
  return 'localhost';
}

export function getAllowedOrigins(): string[] {
  return [
    'https://swappulse.org',
    'https://www.swappulse.org',
    'http://localhost:3000',
    'http://localhost:5173',
  ];
}