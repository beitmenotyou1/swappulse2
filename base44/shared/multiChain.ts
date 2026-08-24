// Multi-chain support for SwapPulse custodial wallets.
// One EVM keypair serves all EVM chains (Polygon, Ethereum, Arbitrum, Optimism, Base).
// Solana and Bitcoin each get their own keypair derived deterministically from the
// same 24-word mnemonic. All private keys are AES-256-GCM encrypted server-side
// (via walletCrypto.ts encryptWithServerKey) and gated by passkey/PIN.

import { ethers } from 'npm:ethers@6.13.4';
import { secrets } from 'base44:runtime';

// --- Chain definitions ---

export interface ChainConfig {
  key: string;
  name: string;
  chainId: number; // EVM chain ID (0 for non-EVM)
  nativeSymbol: string;
  nativeDecimals: number;
  rpcSecret: string;
  explorerUrl: string;
  usdcAddress?: string;
  type: 'evm' | 'solana' | 'bitcoin';
}

export const SUPPORTED_CHAINS: ChainConfig[] = [
  {
    key: 'polygon', name: 'Polygon', chainId: 137, nativeSymbol: 'POL', nativeDecimals: 18,
    rpcSecret: 'POLYGON_RPC_URL', explorerUrl: 'https://polygonscan.com',
    usdcAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', type: 'evm',
  },
  {
    key: 'ethereum', name: 'Ethereum', chainId: 1, nativeSymbol: 'ETH', nativeDecimals: 18,
    rpcSecret: 'ETHEREUM_RPC_URL', explorerUrl: 'https://etherscan.io',
    usdcAddress: '0xA0b86991c6218b36c1D19d4a2e9Eb0cE3606eB48', type: 'evm',
  },
  {
    key: 'arbitrum', name: 'Arbitrum', chainId: 42161, nativeSymbol: 'ETH', nativeDecimals: 18,
    rpcSecret: 'ARBITRUM_RPC_URL', explorerUrl: 'https://arbiscan.io',
    usdcAddress: '0xaf88d6f728e6841d8c5cdf3a55121a5b3c3a3a5d', type: 'evm',
  },
  {
    key: 'optimism', name: 'Optimism', chainId: 10, nativeSymbol: 'ETH', nativeDecimals: 18,
    rpcSecret: 'OPTIMISM_RPC_URL', explorerUrl: 'https://optimistic.etherscan.io',
    usdcAddress: '0x0b2C639c633876a8f2c5Cdf3a55121a5b3c3a3a5d', type: 'evm',
  },
  {
    key: 'base', name: 'Base', chainId: 8453, nativeSymbol: 'ETH', nativeDecimals: 18,
    rpcSecret: 'BASE_RPC_URL', explorerUrl: 'https://basescan.org',
    usdcAddress: '0x833589fCD6eDb6E08f4c795C7d3a5a5a5a5a5a5a', type: 'evm',
  },
  {
    key: 'solana', name: 'Solana', chainId: 0, nativeSymbol: 'SOL', nativeDecimals: 9,
    rpcSecret: 'SOLANA_RPC_URL', explorerUrl: 'https://solscan.io',
    type: 'solana',
  },
  {
    key: 'bitcoin', name: 'Bitcoin', chainId: 0, nativeSymbol: 'BTC', nativeDecimals: 8,
    rpcSecret: 'BITCOIN_RPC_URL', explorerUrl: 'https://blockchair.com',
    type: 'bitcoin',
  },
];

export const EVM_CHAINS = SUPPORTED_CHAINS.filter((c) => c.type === 'evm');

export function getChainConfig(key: string): ChainConfig | undefined {
  return SUPPORTED_CHAINS.find((c) => c.key === key);
}

// --- EVM helpers ---

export function getEvmProvider(chainKey: string): ethers.JsonRpcProvider {
  const chain = getChainConfig(chainKey);
  if (!chain || chain.type !== 'evm') throw new Error(`Unknown EVM chain: ${chainKey}`);
  const rpcUrl = secrets.get(chain.rpcSecret);
  if (!rpcUrl) throw new Error(`${chain.rpcSecret} secret not set`);
  return new ethers.JsonRpcProvider(rpcUrl);
}

const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];

export async function getEvmBalances(
  chainKey: string,
  address: string,
): Promise<{ native: string; usdc: string }> {
  const chain = getChainConfig(chainKey);
  if (!chain || chain.type !== 'evm') return { native: '0', usdc: '0' };
  try {
    const provider = getEvmProvider(chainKey);
    const native = (await provider.getBalance(address)).toString();
    let usdc = '0';
    if (chain.usdcAddress) {
      const contract = new ethers.Contract(chain.usdcAddress, ERC20_ABI, provider);
      usdc = (await contract.balanceOf(address)).toString();
    }
    return { native, usdc };
  } catch {
    return { native: '0', usdc: '0' };
  }
}

export async function estimateEvmGas(
  chainKey: string,
  from: string,
  to: string,
  data: string,
  value: string = '0',
): Promise<{ gasCost: string; gasPrice: string; gasLimit: string } | null> {
  try {
    const provider = getEvmProvider(chainKey);
    const gasPrice = (await provider.getFeeData()).gasPrice || 0n;
    const gasLimit = await provider.estimateGas({
      from,
      to,
      data: data || '0x',
      value,
    });
    const gasCost = (gasPrice * gasLimit).toString();
    return {
      gasCost: gasCost,
      gasPrice: gasPrice.toString(),
      gasLimit: gasLimit.toString(),
    };
  } catch {
    return null;
  }
}

// --- Solana helpers (dynamic import) ---

export async function getSolanaBalance(address: string): Promise<string> {
  const rpcUrl = secrets.get('SOLANA_RPC_URL');
  if (!rpcUrl) return '0';
  try {
    const { Connection, PublicKey } = await import('npm:@solana/web3.js@1.95.0');
    const conn = new Connection(rpcUrl, 'confirmed');
    const balance = await conn.getBalance(new PublicKey(address));
    return balance.toString();
  } catch {
    return '0';
  }
}

// --- Bitcoin helpers (dynamic import) ---

export async function getBitcoinBalance(address: string): Promise<string> {
  const rpcUrl = secrets.get('BITCOIN_RPC_URL');
  const baseUrl = rpcUrl || 'https://mempool.space/api';
  try {
    const res = await fetch(`${baseUrl}/address/${address}`);
    if (!res.ok) return '0';
    const data: any = await res.json();
    const funded = (data.chain_stats?.funded_txo_sum || 0) + (data.mempool_stats?.funded_txo_sum || 0);
    const spent = (data.chain_stats?.spent_txo_sum || 0) + (data.mempool_stats?.spent_txo_sum || 0);
    return (funded - spent).toString();
  } catch {
    return '0';
  }
}

// --- Key generation ---

export interface MultiChainKeys {
  mnemonic: string;
  evm: { privateKey: string; address: string };
  solana: { seedHex: string; address: string };
  bitcoin: { privKeyHex: string; address: string };
}

export async function generateMultiChainKeys(): Promise<MultiChainKeys> {
  // 24-word mnemonic via ethers
  const entropy = crypto.getRandomValues(new Uint8Array(32));
  const mnemonicInstance = ethers.Mnemonic.fromEntropy(entropy);
  const mnemonic = mnemonicInstance.phrase;

  // EVM key (same for all EVM chains — BIP44 m/44'/60'/0'/0/0)
  const evmWallet = ethers.Wallet.fromPhrase(mnemonic);

  // Solana key: deterministic 32-byte seed from mnemonic
  const solanaSeedBytes = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(mnemonic)),
  );
  const solanaSeedHex = Array.from(solanaSeedBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  let solanaAddress = '';
  try {
    const { Keypair } = await import('npm:@solana/web3.js@1.95.0');
    const kp = Keypair.fromSeed(solanaSeedBytes);
    solanaAddress = kp.publicKey.toBase58();
  } catch {}

  // Bitcoin key: deterministic 32-byte private key from mnemonic
  const btcPrivBytes = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode('bitcoin:' + mnemonic)),
  );
  const btcPrivHex = Array.from(btcPrivBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  let bitcoinAddress = '';
  try {
    const bitcoin = await import('npm:bitcoinjs-lib@6.1.0');
    const ecc = await import('npm:@noble/secp256k1@2.1.0');
    (bitcoin as any).initEccLib(ecc);
    const pubkey = ecc.getPublicKey(btcPrivBytes, true);
    const { address } = (bitcoin as any).payments.p2wpkh({ pubkey: Buffer.from(pubkey) });
    bitcoinAddress = address || '';
  } catch {}

  return {
    mnemonic,
    evm: { privateKey: evmWallet.privateKey, address: evmWallet.address.toLowerCase() },
    solana: { seedHex: solanaSeedHex, address: solanaAddress },
    bitcoin: { privKeyHex: btcPrivHex, address: bitcoinAddress },
  };
}

// --- Address derivation from stored (decrypted) keys ---

export function getEvmAddressFromPrivateKey(privateKey: string): string {
  return new ethers.Wallet(privateKey).address.toLowerCase();
}

export async function getSolanaAddressFromSeed(seedHex: string): Promise<string> {
  try {
    const { Keypair } = await import('npm:@solana/web3.js@1.95.0');
    const seed = new Uint8Array(seedHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
    return Keypair.fromSeed(seed).publicKey.toBase58();
  } catch {
    return '';
  }
}

export async function getBitcoinAddressFromPrivKey(privKeyHex: string): Promise<string> {
  try {
    const bitcoin = await import('npm:bitcoinjs-lib@6.1.0');
    const ecc = await import('npm:@noble/secp256k1@2.1.0');
    (bitcoin as any).initEccLib(ecc);
    const privBytes = new Uint8Array(privKeyHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
    const pubkey = ecc.getPublicKey(privBytes, true);
    const { address } = (bitcoin as any).payments.p2wpkh({ pubkey: Buffer.from(pubkey) });
    return address || '';
  } catch {
    return '';
  }
}

// --- Full balance query across all chains ---

export interface ChainBalance {
  chain: string;
  native: string;
  nativeSymbol: string;
  nativeDecimals: number;
  usdc?: string;
}

export async function getAllChainBalances(
  evmAddress: string,
  solanaAddress?: string,
  bitcoinAddress?: string,
): Promise<ChainBalance[]> {
  const results: ChainBalance[] = [];

  // EVM chains in parallel
  const evmResults = await Promise.all(
    EVM_CHAINS.map(async (chain) => {
      const bal = await getEvmBalances(chain.key, evmAddress);
      return {
        chain: chain.key,
        native: bal.native,
        nativeSymbol: chain.nativeSymbol,
        nativeDecimals: chain.nativeDecimals,
        usdc: bal.usdc,
      } as ChainBalance;
    }),
  );
  results.push(...evmResults);

  // Solana
  if (solanaAddress) {
    const sol = await getSolanaBalance(solanaAddress);
    const chain = getChainConfig('solana')!;
    results.push({
      chain: 'solana',
      native: sol,
      nativeSymbol: chain.nativeSymbol,
      nativeDecimals: chain.nativeDecimals,
    });
  }

  // Bitcoin
  if (bitcoinAddress) {
    const btc = await getBitcoinBalance(bitcoinAddress);
    const chain = getChainConfig('bitcoin')!;
    results.push({
      chain: 'bitcoin',
      native: btc,
      nativeSymbol: chain.nativeSymbol,
      nativeDecimals: chain.nativeDecimals,
    });
  }

  return results;
}

// --- Formatting helpers ---

export function formatNativeBalance(raw: string, decimals: number): string {
  try {
    const value = Number(BigInt(raw || '0')) / Math.pow(10, decimals);
    return value.toLocaleString('en-US', { maximumFractionDigits: 6 });
  } catch {
    return '0';
  }
}