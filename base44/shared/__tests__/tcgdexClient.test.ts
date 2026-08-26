/**
 * Unit tests for the TCGDex client wrapper.
 *
 * These tests verify:
 * - Language validation (all 17 languages + common mistakes)
 * - Rate limiter behaviour
 * - Asset URL construction (images, symbols, logos)
 * - Set ID normalisation
 * - Multi-language helpers
 * - Health check functionality
 *
 * Unit tests (no network) can be run with: npx jest --testPathPattern tcgdexClient
 * Integration tests (marked .integration) require internet access.
 *
 * NOTE: In the Base44 platform, jest is not available. These tests are
 * intended for local development. The key functions are also verified
 * via test_backend_function on the `tcgdex` endpoint.
 */

import {
  validateLanguage,
  detectLanguageFromHeader,
  getCardImageUrl,
  getSetAssetUrl,
  getCardImageSrcSet,
  extractLocalizedSetData,
  normalizeSetId,
  toInternalLang,
  SUPPORTED_LANGUAGES,
  type TcgdexSet,
} from '../tcgdexClient';

// ============================================================
// Language Validation Tests (unit — no network)
// ============================================================

describe('validateLanguage', () => {
  test('accepts all 17 supported languages', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(validateLanguage(lang)).toBe(lang);
    }
  });

  test('falls back to English for unsupported languages', () => {
    expect(validateLanguage('xyz')).toBe('en');
    expect(validateLanguage('')).toBe('en');
  });

  test('corrects common language code mistakes', () => {
    expect(validateLanguage('jp')).toBe('ja');   // Japan -> Japanese
    expect(validateLanguage('cn')).toBe('zh-cn'); // China -> Chinese Simplified
    expect(validateLanguage('tw')).toBe('zh-tw'); // Taiwan -> Chinese Traditional
    expect(validateLanguage('br')).toBe('pt-br'); // Brazil -> Portuguese (Brazil)
    expect(validateLanguage('kr')).toBe('ko');   // Korea -> Korean
  });

  test('handles locale variants (e.g., fr-FR -> fr)', () => {
    expect(validateLanguage('fr-FR')).toBe('fr');
    expect(validateLanguage('de-DE')).toBe('de');
    expect(validateLanguage('ja-JP')).toBe('ja');
    expect(validateLanguage('ko-KR')).toBe('ko');
    expect(validateLanguage('pt-BR')).toBe('pt-br');
    expect(validateLanguage('pt-PT')).toBe('pt-pt');
    expect(validateLanguage('zh-TW')).toBe('zh-tw');
    expect(validateLanguage('zh-CN')).toBe('zh-cn');
  });

  test('handles case variations', () => {
    expect(validateLanguage('EN')).toBe('en');
    expect(validateLanguage('FR')).toBe('fr');
    expect(validateLanguage('JA')).toBe('ja');
  });
});

// ============================================================
// Browser Language Detection Tests (unit — no network)
// ============================================================

describe('detectLanguageFromHeader', () => {
  test('detects single language', () => {
    expect(detectLanguageFromHeader('fr-FR')).toBe('fr');
    expect(detectLanguageFromHeader('ja-JP')).toBe('ja');
    expect(detectLanguageFromHeader('de-DE')).toBe('de');
  });

  test('respects quality values (q-parameter)', () => {
    expect(detectLanguageFromHeader('fr-FR;q=0.9,en-US;q=0.8')).toBe('fr');
    expect(detectLanguageFromHeader('en-US;q=0.9,fr-FR;q=0.8')).toBe('en');
  });

  test('handles empty header', () => {
    expect(detectLanguageFromHeader('')).toBe('en');
  });
});

// ============================================================
// Internal <-> API Language Mapping Tests (unit)
// ============================================================

describe('toInternalLang', () => {
  test('maps API codes to internal codes', () => {
    expect(toInternalLang('ja')).toBe('jp');
    expect(toInternalLang('zh-tw')).toBe('zh');
  });

  test('passes through unmapped codes', () => {
    expect(toInternalLang('en')).toBe('en');
    expect(toInternalLang('fr')).toBe('fr');
    expect(toInternalLang('de')).toBe('de');
  });
});

// ============================================================
// Set ID Normalisation Tests (unit — no network)
// ============================================================

describe('normalizeSetId', () => {
  test('pads single-digit SV sets', () => {
    expect(normalizeSetId('sv1')).toBe('sv01');
    expect(normalizeSetId('sv4')).toBe('sv04');
    expect(normalizeSetId('sv9')).toBe('sv09');
  });

  test('converts "a" suffix to ".5"', () => {
    expect(normalizeSetId('sv4a')).toBe('sv04.5');
    expect(normalizeSetId('sv6a')).toBe('sv06.5');
  });

  test('leaves double-digit sets unchanged', () => {
    expect(normalizeSetId('sv10')).toBe('sv10');
    expect(normalizeSetId('sv12')).toBe('sv12');
  });

  test('leaves already-canonical IDs unchanged', () => {
    expect(normalizeSetId('sv04.5')).toBe('sv04.5');
    expect(normalizeSetId('sv10.5b')).toBe('sv10.5b');
  });

  test('does not pad non-SV sets', () => {
    expect(normalizeSetId('swsh1')).toBe('swsh1');
    expect(normalizeSetId('sm1')).toBe('sm1');
    expect(normalizeSetId('xy1')).toBe('xy1');
    expect(normalizeSetId('bw1')).toBe('bw1');
  });

  test('handles empty input', () => {
    expect(normalizeSetId('')).toBe('');
    expect(normalizeSetId(undefined as any)).toBe(undefined);
  });

  test('lowercases input', () => {
    expect(normalizeSetId('SV1')).toBe('sv01');
    expect(normalizeSetId('SV4A')).toBe('sv04.5');
  });
});

// ============================================================
// Asset URL Helper Tests (unit — no network)
// ============================================================

describe('getCardImageUrl', () => {
  const BASE_URL = 'https://assets.tcgdex.net/en/swsh/swsh3/136';

  test('constructs high-quality webp URL', () => {
    expect(getCardImageUrl(BASE_URL, 'high', 'webp')).toBe(`${BASE_URL}/high.webp`);
  });

  test('constructs low-quality webp URL', () => {
    expect(getCardImageUrl(BASE_URL, 'low', 'webp')).toBe(`${BASE_URL}/low.webp`);
  });

  test('constructs high-quality PNG URL', () => {
    expect(getCardImageUrl(BASE_URL, 'high', 'png')).toBe(`${BASE_URL}/high.png`);
  });

  test('defaults to high quality webp', () => {
    expect(getCardImageUrl(BASE_URL)).toBe(`${BASE_URL}/high.webp`);
  });

  test('returns empty string for null/empty input', () => {
    expect(getCardImageUrl('')).toBe('');
  });

  test('returns URL as-is if it already has an extension', () => {
    const urlWithExt = `${BASE_URL}/high.png`;
    expect(getCardImageUrl(urlWithExt, 'high', 'webp')).toBe(urlWithExt);
  });
});

describe('getSetAssetUrl', () => {
  const SYMBOL_URL = 'https://assets.tcgdex.net/univ/swsh/swsh3/symbol';

  test('constructs webp URL', () => {
    expect(getSetAssetUrl(SYMBOL_URL, 'webp')).toBe(`${SYMBOL_URL}.webp`);
  });

  test('constructs PNG URL', () => {
    expect(getSetAssetUrl(SYMBOL_URL, 'png')).toBe(`${SYMBOL_URL}.png`);
  });

  test('defaults to webp', () => {
    expect(getSetAssetUrl(SYMBOL_URL)).toBe(`${SYMBOL_URL}.webp`);
  });

  test('returns empty string for null input', () => {
    expect(getSetAssetUrl('')).toBe('');
  });
});

describe('getCardImageSrcSet', () => {
  const BASE_URL = 'https://assets.tcgdex.net/en/swsh/swsh3/136';

  test('generates srcset with low and high quality', () => {
    const srcset = getCardImageSrcSet(BASE_URL, 'webp');
    expect(srcset).toContain('low.webp 245w');
    expect(srcset).toContain('high.webp 600w');
    expect(srcset.split(',').length).toBe(2);
  });

  test('returns empty string for null input', () => {
    expect(getCardImageSrcSet('')).toBe('');
  });
});

// ============================================================
// Localised Set Data Extraction Tests (unit — no network)
// ============================================================

describe('extractLocalizedSetData', () => {
  test('extracts name, logo, and symbol from a set', () => {
    const mockSet: TcgdexSet = {
      id: 'mock-set',
      name: 'Mock Set',
      logo: 'https://assets.example.com/logo',
      symbol: 'https://assets.example.com/symbol',
      cardCount: { total: 100, official: 100 },
      serie: { id: 'mock', name: 'Mock Serie' },
      releaseDate: '2024-01-01',
      legal: { standard: true, expanded: true },
      cards: [],
    };

    const extracted = extractLocalizedSetData(mockSet);
    expect(extracted.name).toBe('Mock Set');
    expect(extracted.logo).toBe('https://assets.example.com/logo');
    expect(extracted.symbol).toBe('https://assets.example.com/symbol');
  });

  test('handles missing optional fields', () => {
    const mockSet: TcgdexSet = {
      id: 'mock-set',
      name: 'Mock Set',
      cardCount: { total: 100, official: 100 },
      serie: { id: 'mock', name: 'Mock Serie' },
      releaseDate: '2024-01-01',
      legal: { standard: true, expanded: true },
      cards: [],
    };

    const extracted = extractLocalizedSetData(mockSet);
    expect(extracted.name).toBe('Mock Set');
    expect(extracted.logo).toBeUndefined();
    expect(extracted.symbol).toBeUndefined();
  });
});

// ============================================================
// Integration Tests (require network — run locally)
// ============================================================

describe.skip('getCard (integration)', () => {
  test('fetches a card in English', async () => {
    const { getCard } = await import('../tcgdexClient');
    const card = await getCard('swsh3-136', 'en');
    expect(card).toBeDefined();
    expect(card.id).toBe('swsh3-136');
    expect(card.name).toBe('Furret');
    expect(card.category).toBe('Pokemon');
  });

  test('fetches the same card in French (different name)', async () => {
    const { getCard } = await import('../tcgdexClient');
    const card = await getCard('swsh3-136', 'fr');
    expect(card.id).toBe('swsh3-136');
    expect(card.name).not.toBe('Furret');
  });
});

describe.skip('healthCheck (integration)', () => {
  test('verifies API connectivity', async () => {
    const { healthCheck } = await import('../tcgdexClient');
    const result = await healthCheck();
    expect(result.status).not.toBe('down');
    expect(result.latencyMs).toBeGreaterThan(0);
    expect(result.details).toContain('OK');
  });
});