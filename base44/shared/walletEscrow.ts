// Shared utilities for the SwapPulse wallet & escrow system.
// Provides USDC (ERC-20) contract helpers, fee calculation, balance
// management, and escrow fund locking/releasing on Polygon.
//
// The platform's mint wallet (POLYGON_PRIVATE_KEY) serves as both the
// USDC reserve (for top-up credits and fiat→USDC conversions) and the
// escrow holder (for card purchase escrows). All on-chain transfers
// use ethers.js v6.

import { ethers } from 'npm:ethers@6.13.4';
import { secrets } from 'base44:runtime';

// --- Constants ---

// Native USDC on Polygon PoS (6 decimals)
export const USDC_CONTRACT_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cc03d5c3359';
export const USDC_DECIMALS = 6;

// Platform fee wallet — all 2% fees are collected here as USDC
export const PLATFORM_FEE_WALLET = '0xb2ad3d76dc2a6B283422e1B6c6957a1C5Ea857E3';

// 2% fee rate (in basis points: 200 = 2%)
export const FEE_BPS = 200;
export const FEE_PERCENTAGE = 0.02;

// --- ERC-20 ABI (minimal, for USDC transfers) ---

export const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

// --- Provider & wallet helpers ---

export function getProvider(): ethers.JsonRpcProvider {
  const rpcUrl = secrets.get('POLYGON_RPC_URL');
  if (!rpcUrl) throw new Error('POLYGON_RPC_URL secret not set');
  return new ethers.JsonRpcProvider(rpcUrl);
}

export function getPlatformWallet(): ethers.Wallet {
  const privateKey = secrets.get('POLYGON_PRIVATE_KEY');
  if (!privateKey) throw new Error('POLYGON_PRIVATE_KEY secret not set');
  return new ethers.Wallet(privateKey, getProvider());
}

export function getUsdcContract(signerOrProvider: any): ethers.Contract {
  return new ethers.Contract(USDC_CONTRACT_ADDRESS, ERC20_ABI, signerOrProvider);
}

// --- Fee calculation ---

export function calculateFee(amountWei: bigint): bigint {
  return (amountWei * BigInt(FEE_BPS)) / 10000n;
}

export function calculateFeeCents(amountCents: number): number {
  return Math.floor((amountCents * FEE_BPS) / 10000);
}

// Convert fiat cents to USDC wei using a fixed conversion rate.
// In production this would use a price oracle; for now 1:1 (1 cent = 1 USDC base unit).
// USDC has 6 decimals, fiat cents are already in minor units, so 100 cents = $1 = 1000000 USDC base units.
// Conversion: usdc_wei = fiat_cents * 10^(6-2) = fiat_cents * 10000
export function fiatCentsToUsdcWei(fiatCents: number): bigint {
  return BigInt(fiatCents) * 10000n;
}

export function usdcWeiToFiatCents(usdcWei: bigint): number {
  return Number(usdcWei / 10000n);
}

// --- Balance helpers ---

export async function getOrCreateWalletBalance(base44: any, did: string, walletAddress: string): Promise<any> {
  const existing = await base44.asServiceRole.entities.WalletBalance
    .filter({ did }, '-created_date', 1)
    .catch(() => []);
  if (existing.length) return existing[0];
  return base44.asServiceRole.entities.WalletBalance.create({
    did,
    wallet_address: walletAddress,
    fiat_cents: 0,
    usdc_wei: '0',
    total_topup_cents: 0,
    total_fees_paid_wei: '0',
    last_updated_at: new Date().toISOString(),
  });
}

export async function updateBalance(base44: any, balanceId: string, updates: any): Promise<any> {
  return base44.asServiceRole.entities.WalletBalance.update(balanceId, {
    ...updates,
    last_updated_at: new Date().toISOString(),
  });
}

// Resolve the user's active wallet, preferring MultiChainWallet (which has
// EVM + Solana + Bitcoin addresses) over the legacy CustodialWallet. Returns
// { wallet_address, wallet_record, is_multi_chain } or null if neither exists.
// wallet_address is always the EVM address (shared across all EVM chains).
export async function resolveActiveWallet(base44: any, did: string): Promise<{
  wallet_address: string;
  wallet_record: any;
  is_multi_chain: boolean;
} | null> {
  const multiWallets = await base44.asServiceRole.entities.MultiChainWallet
    .filter({ did, active: true }, '-created_date', 1).catch(() => []);
  if (multiWallets.length) {
    return {
      wallet_address: multiWallets[0].evm_address,
      wallet_record: multiWallets[0],
      is_multi_chain: true,
    };
  }
  const custodialWallets = await base44.asServiceRole.entities.CustodialWallet
    .filter({ did, active: true }, '-created_date', 1).catch(() => []);
  if (custodialWallets.length) {
    return {
      wallet_address: custodialWallets[0].wallet_address,
      wallet_record: custodialWallets[0],
      is_multi_chain: false,
    };
  }
  return null;
}

// --- On-chain USDC transfer ---

export async function transferUsdc(
  fromWallet: ethers.Wallet,
  toAddress: string,
  amountWei: bigint,
): Promise<{ txHash: string }> {
  const contract = getUsdcContract(fromWallet);
  const tx = await contract.transfer(toAddress, amountWei);
  const receipt = await tx.wait();
  if (receipt.status !== 1) throw new Error('USDC transfer failed on-chain');
  return { txHash: tx.hash };
}

// Transfer USDC from the platform reserve to a user's custodial wallet.
// Used for top-up credits and fiat→USDC conversions.
export async function creditUsdcFromReserve(
  toAddress: string,
  amountWei: bigint,
): Promise<{ txHash: string }> {
  const platformWallet = getPlatformWallet();
  return transferUsdc(platformWallet, toAddress, amountWei);
}

// Transfer USDC from a user's custodial wallet to the platform reserve.
// Used for USDC→fiat conversions. Requires the user's decrypted private key.
export async function debitUsdcToReserve(
  userPrivateKey: string,
  amountWei: bigint,
): Promise<{ txHash: string }> {
  const userWallet = new ethers.Wallet(userPrivateKey, getProvider());
  const platformAddress = getPlatformWallet().address;
  return transferUsdc(userWallet, platformAddress, amountWei);
}

// --- Fee collection ---

export async function sweepFeeToPlatformWallet(
  amountWei: bigint,
): Promise<{ txHash: string }> {
  const platformWallet = getPlatformWallet();
  return transferUsdc(platformWallet, PLATFORM_FEE_WALLET, amountWei);
}

// --- Mask helpers (for bank account display) ---

export function maskIban(iban: string): string {
  const clean = iban.replace(/\s/g, '');
  if (clean.length <= 8) return clean;
  return clean.slice(0, 4) + '••••' + clean.slice(-4);
}

export function maskBic(bic: string): string {
  const clean = bic.replace(/\s/g, '');
  if (clean.length <= 4) return clean;
  return clean.slice(0, 4) + '••••';
}

// --- Validation ---

export function validateIban(iban: string): boolean {
  const clean = iban.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/.test(clean)) return false;
  // Mod-97 checksum
  const rearranged = clean.slice(4) + clean.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let remainder: number;
  try {
    remainder = BigInt(numeric) % 97n;
  } catch {
    return false;
  }
  return remainder === 1n;
}

export function validateBic(bic: string): boolean {
  const clean = bic.replace(/\s/g, '').toUpperCase();
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(clean);
}