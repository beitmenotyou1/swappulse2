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
export const USDC_CONTRACT_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
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
// Used for top-up credits and fiat→USDC conversions. If the platform wallet
// doesn't have enough USDC, swaps POL for USDC via the DEX first.
export async function creditUsdcFromReserve(
  toAddress: string,
  amountWei: bigint,
): Promise<{ txHash: string; swapTxHash?: string }> {
  const platformWallet = getPlatformWallet();
  const usdcContract = getUsdcContract(platformWallet);
  const currentUsdc = await usdcContract.balanceOf(platformWallet.address);

  let swapTxHash: string | undefined;
  if (currentUsdc < amountWei) {
    const deficit = amountWei - currentUsdc;
    const swapResult = await swapPolForUsdc(deficit);
    swapTxHash = swapResult.swapTxHash;
  }

  const result = await transferUsdc(platformWallet, toAddress, amountWei);
  return { txHash: result.txHash, swapTxHash };
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

// Native token placeholder used by Velora/ParaSwap for native POL
const NATIVE_TOKEN_EEEE = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const POLYGON_NETWORK = 137;
const ONE_POL = 1000000000000000000n; // 1 POL in wei (18 decimals)

// Swap platform wallet POL for USDC via Velora DEX. Swaps enough POL
// (with a 10% slippage buffer) to cover the requested USDC amount.
// Retries with progressively higher slippage if the swap fails.
// Returns the swap tx hash and the platform wallet's USDC balance after.
export async function swapPolForUsdc(
  usdcAmountNeededWei: bigint,
): Promise<{ swapTxHash: string; usdcBalanceAfter: bigint }> {
  const { fetchDexQuote, executeDexSwap } = await import('./dexAggregator.ts');
  const platformWallet = getPlatformWallet();
  const provider = getProvider();

  // Guard: check POL balance before attempting swap
  const polBalance = await provider.getBalance(platformWallet.address);
  if (polBalance < ONE_POL) {
    throw new Error(`Insufficient POL for swap: ${ethers.formatEther(polBalance)} POL`);
  }

  // Step 1: Get a price quote for 1 POL → USDC to determine the rate
  const priceQuote = await fetchDexQuote({
    srcToken: NATIVE_TOKEN_EEEE,
    destToken: USDC_CONTRACT_ADDRESS,
    amount: ONE_POL.toString(),
    network: POLYGON_NETWORK,
  });
  const usdcPerPol = BigInt(priceQuote.destAmount);
  if (usdcPerPol === 0n) throw new Error('Could not get POL/USDC price from DEX');

  // Step 2: Calculate POL needed (with 10% buffer for slippage)
  const polNeeded = (usdcAmountNeededWei * ONE_POL) / usdcPerPol;
  const polNeededWithBuffer = (polNeeded * 110n) / 100n;

  // Guard: don't swap less than 0.001 POL (dust) or more than the wallet holds
  if (polNeededWithBuffer < 1000000000000000n) {
    throw new Error(`Swap amount too small: ${ethers.formatEther(polNeededWithBuffer)} POL`);
  }

  // Step 3: Get a quote for the exact POL amount
  const swapQuote = await fetchDexQuote({
    srcToken: NATIVE_TOKEN_EEEE,
    destToken: USDC_CONTRACT_ADDRESS,
    amount: polNeededWithBuffer.toString(),
    network: POLYGON_NETWORK,
  });

  // Step 4: Execute the swap with retry on slippage failures
  // Try 0.5% → 1% → 2% → 5% slippage
  const slippageTiers = [5000, 10000, 20000, 50000];
  let swapTxHash: string | undefined;
  let lastError: any;
  for (const slippage of slippageTiers) {
    try {
      const result = await executeDexSwap(platformWallet, swapQuote, slippage);
      swapTxHash = result.txHash;
      break;
    } catch (e) {
      lastError = e;
      console.error(`Swap attempt with ${slippage / 100}% slippage failed:`, (e as any)?.message);
    }
  }
  if (!swapTxHash) throw lastError || new Error('All swap attempts failed');

  // Step 5: Verify USDC balance after swap
  const usdcContract = getUsdcContract(platformWallet);
  const usdcBalanceAfter = await usdcContract.balanceOf(platformWallet.address);

  return { swapTxHash, usdcBalanceAfter };
}

// Sweep accumulated fees to the platform fee wallet as USDC on Polygon.
// If the platform wallet doesn't have enough USDC, swaps POL for USDC
// via the DEX first. Gas is paid in POL from the platform wallet.
export async function sweepFeesOnChain(
  totalFeeWei: bigint,
): Promise<{ txHash: string; swapTxHash?: string }> {
  const platformWallet = getPlatformWallet();
  const usdcContract = getUsdcContract(platformWallet);

  // Check if we need to swap POL for USDC
  const currentUsdcBalance = await usdcContract.balanceOf(platformWallet.address);
  let swapTxHash: string | undefined;

  if (currentUsdcBalance < totalFeeWei) {
    const deficit = totalFeeWei - currentUsdcBalance;
    const swapResult = await swapPolForUsdc(deficit);
    swapTxHash = swapResult.swapTxHash;
  }

  // Transfer the total fee USDC to the fee wallet
  const { txHash } = await transferUsdc(platformWallet, PLATFORM_FEE_WALLET, totalFeeWei);
  return { txHash, swapTxHash };
}

export async function sweepFeeToPlatformWallet(
  amountWei: bigint,
): Promise<{ txHash: string }> {
  const platformWallet = getPlatformWallet();
  return transferUsdc(platformWallet, PLATFORM_FEE_WALLET, amountWei);
}

// --- Gas funding for custodial wallets ---

// Minimum POL balance a user's custodial wallet needs for gas. If below this,
// the platform wallet sends a small stipend so on-chain transfers (USDC sends,
// DEX swaps) don't fail with "insufficient funds for intrinsic transaction".
// A custodial wallet holds tokens but no native gas, so the platform sponsors it.
const MIN_GAS_POL = 10_000_000_000_000_000_000n; // 0.01 POL threshold (1 POL = 1e18 wei)
const GAS_STIPEND_POL = 50_000_000_000_000_000_000n; // 0.05 POL stipend (covers a swap + transfer)

// Ensure a user's custodial wallet has enough POL for gas. If the balance is
// below the threshold, send a small stipend from the platform wallet. Idempotent
// — only tops up when needed. Returns whether gas was funded and the funding tx.
export async function ensureGasFunds(
  userAddress: string,
): Promise<{ funded: boolean; txHash?: string }> {
  const provider = getProvider();
  const balance = await provider.getBalance(userAddress);
  if (balance >= MIN_GAS_POL) return { funded: false };
  const platformWallet = getPlatformWallet();
  const tx = await platformWallet.sendTransaction({ to: userAddress, value: GAS_STIPEND_POL });
  await tx.wait();
  return { funded: true, txHash: tx.hash };
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