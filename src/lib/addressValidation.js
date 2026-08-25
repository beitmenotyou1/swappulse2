// Address format validation for the wallet allowlist.
// Validates that entered sender addresses match the expected format for
// the selected chain, preventing malformed entries that would silently
// block legitimate transfers or allow invalid ones through.

import { getChain } from '@/lib/chainRegistry';

// EVM addresses: 0x + 40 hex chars (20 bytes), case-insensitive
const EVM_REGEX = /^0x[a-fA-F0-9]{40}$/;

// Solana addresses: base58 (no 0, O, I, l), typically 32-44 chars
const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// Bitcoin address formats:
// - Legacy P2PKH: 1... (mainnet), 26-34 chars
// - P2SH: 3... (mainnet), 26-34 chars
// - Bech32 (Native SegWit): bc1... (mainnet), 42-62 chars
const BTC_LEGACY_REGEX = /^1[a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const BTC_P2SH_REGEX = /^3[a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const BTC_BECH32_REGEX = /^bc1[a-z0-9]{39,59}$/;

// Bitcoin Cash: bitcoincash: prefix + base32, or legacy 1... format
const BCH_CASHADDR_REGEX = /^bitcoincash:q[a-z0-9]{39,59}$/;
const BCH_LEGACY_REGEX = /^1[a-km-zA-HJ-NP-Z1-9]{25,34}$/;

// Dogecoin: D... prefix, 26-34 chars (Base58)
const DOGE_REGEX = /^D[a-km-zA-HJ-NP-Z1-9]{25,34}$/;

// Litecoin: L... / M... (P2PKH), or ltc1... (Bech32)
const LTC_P2PKH_REGEX = /^[LM][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const LTC_BECH32_REGEX = /^ltc1[a-z0-9]{39,59}$/;

// Tron: T... prefix, 34 chars (Base58)
const TRON_REGEX = /^T[a-km-zA-HJ-NP-Z1-9]{33}$/;

/**
 * Validates an address against the expected format for a given chain key.
 * Returns { valid: boolean, message?: string }.
 * When chainKey is empty ("All chains"), validates against any known format.
 */
export function validateAddress(address, chainKey) {
  const trimmed = (address || '').trim();
  if (!trimmed) {
    return { valid: false, message: 'Address is required' };
  }

  // "All chains" — try every known format; valid if any matches
  if (!chainKey) {
    const allChecks = [
      { name: 'EVM', test: () => EVM_REGEX.test(trimmed) },
      { name: 'Solana', test: () => BASE58_REGEX.test(trimmed) },
      { name: 'Bitcoin', test: () => isBitcoinAddress(trimmed) },
      { name: 'Dogecoin', test: () => DOGE_REGEX.test(trimmed) },
      { name: 'Litecoin', test: () => LTC_P2PKH_REGEX.test(trimmed) || LTC_BECH32_REGEX.test(trimmed) },
      { name: 'Tron', test: () => TRON_REGEX.test(trimmed) },
    ];
    if (allChecks.some(c => c.test())) {
      return { valid: true };
    }
    return {
      valid: false,
      message: 'Unrecognised address format. Expected an EVM (0x…), Solana, Bitcoin, or Litecoin address.',
    };
  }

  const chain = getChain(chainKey);
  if (!chain) {
    return { valid: false, message: 'Unknown chain selected' };
  }

  const result = validateForChainType(trimmed, chain);
  return result;
}

function validateForChainType(address, chain) {
  switch (chain.type) {
    case 'evm':
      if (!EVM_REGEX.test(address)) {
        return {
          valid: false,
          message: `${chain.name} addresses start with "0x" followed by 40 hex characters (e.g. 0x1a2b…).`,
        };
      }
      return { valid: true };

    case 'solana':
      if (!BASE58_REGEX.test(address)) {
        return {
          valid: false,
          message: 'Solana addresses are 32-44 base58 characters (letters and digits, no 0/O/I/l).',
        };
      }
      return { valid: true };

    case 'bitcoin':
      return validateBitcoinFamily(address, chain.key);

    case 'other':
      // Aptos, Sui, Stellar, Injective, Sei, Starknet, XMTP — permissive
      // validation (non-empty, reasonable length) since formats vary widely
      // and may change. Better to allow than to block a valid address.
      if (address.length < 8 || address.length > 90) {
        return {
          valid: false,
          message: `${chain.name} addresses are typically 8-90 characters. Please check the address.`,
        };
      }
      return { valid: true };

    default:
      return { valid: true };
  }
}

function isBitcoinAddress(address) {
  return BTC_LEGACY_REGEX.test(address) ||
    BTC_P2SH_REGEX.test(address) ||
    BTC_BECH32_REGEX.test(address);
}

function validateBitcoinFamily(address, chainKey) {
  switch (chainKey) {
    case 'bitcoin':
      if (!isBitcoinAddress(address)) {
        return {
          valid: false,
          message: 'Bitcoin addresses start with "1", "3", or "bc1" (e.g. bc1q… or 1A1z…).',
        };
      }
      return { valid: true };

    case 'bitcoin-cash':
      if (!BCH_CASHADDR_REGEX.test(address) && !BCH_LEGACY_REGEX.test(address)) {
        return {
          valid: false,
          message: 'Bitcoin Cash addresses use the "bitcoincash:q…" format or legacy "1…" format.',
        };
      }
      return { valid: true };

    case 'dogecoin':
      if (!DOGE_REGEX.test(address)) {
        return {
          valid: false,
          message: 'Dogecoin addresses start with "D" and are 27-34 characters (e.g. DJgM…).',
        };
      }
      return { valid: true };

    case 'litecoin':
      if (!LTC_P2PKH_REGEX.test(address) && !LTC_BECH32_REGEX.test(address)) {
        return {
          valid: false,
          message: 'Litecoin addresses start with "L", "M", or "ltc1" (e.g. lt1… or Lfm…).',
        };
      }
      return { valid: true };

    default:
      // Generic Bitcoin-family fallback
      if (!isBitcoinAddress(address)) {
        return {
          valid: false,
          message: 'Enter a valid Bitcoin-family address.',
        };
      }
      return { valid: true };
  }
}