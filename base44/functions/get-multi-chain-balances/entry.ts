// get-multi-chain-balances — fetches the native coin balance for every
// chain with a configured RPC secret. EVM chains share one address from
// MultiChainWallet/CustodialWallet; Solana uses its own keypair; Bitcoin
// uses its own. Returns an array of { chain, name, symbol, type, balance,
// address, has_rpc }. Per-chain failures are handled gracefully (balance
// returns '0' with error flag). Uses Promise.allSettled with a per-chain
// 5-second timeout so one slow RPC doesn't block the whole response.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ethers } from 'npm:ethers@6.13.4';
import { secrets } from 'base44:runtime';
import { QUERYABLE_CHAINS, getChainType } from '../../shared/chainConfig.ts';

const PER_CHAIN_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('RPC timeout')), ms)
    ),
  ]);
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const did = user.data?.did || user.did;
    if (!did) return Response.json({ error: 'No DID found' }, { status: 400 });

    // Find the user's wallet — prefer MultiChainWallet, fall back to CustodialWallet
    let evmAddress: string | null = null;
    let solanaAddress: string | null = null;
    let bitcoinAddress: string | null = null;

    const multiWallets = await base44.entities.MultiChainWallet
      .filter({ did, active: true }, '-created_date', 1).catch(() => []);
    if (multiWallets.length) {
      evmAddress = multiWallets[0].evm_address;
      solanaAddress = multiWallets[0].solana_address;
      bitcoinAddress = multiWallets[0].bitcoin_address;
    } else {
      const custodialWallets = await base44.entities.CustodialWallet
        .filter({ did, active: true }, '-created_date', 1).catch(() => []);
      if (custodialWallets.length) {
        evmAddress = custodialWallets[0].wallet_address;
      }
    }

    if (!evmAddress && !solanaAddress && !bitcoinAddress) {
      return Response.json({ balances: [], wallet_addresses: null });
    }

    const walletAddresses = {
      evm: evmAddress,
      solana: solanaAddress,
      bitcoin: bitcoinAddress,
    };

    // Fetch native balance for each queryable chain in parallel
    const balancePromises = QUERYABLE_CHAINS.map(async (chain) => {
      const rpcUrl = chain.rpcSecret ? secrets.get(chain.rpcSecret) : null;
      if (!rpcUrl) {
        return {
          chain: chain.key,
          name: chain.name,
          symbol: chain.symbol,
          type: chain.type,
          balance: '0',
          address: getAddressForChain(chain.type, walletAddresses),
          has_rpc: false,
        };
      }

      try {
        const address = getAddressForChain(chain.type, walletAddresses);
        if (!address) {
          return {
            chain: chain.key,
            name: chain.name,
            symbol: chain.symbol,
            type: chain.type,
            balance: '0',
            address: null,
            has_rpc: true,
            error: 'No address for this chain type',
          };
        }

        let balance = '0';

        if (chain.type === 'evm') {
          const provider = new ethers.JsonRpcProvider(rpcUrl);
          const result = await withTimeout(provider.getBalance(address), PER_CHAIN_TIMEOUT_MS);
          balance = result.toString();
        } else if (chain.type === 'solana') {
          // Dynamic import to avoid loading @solana/web3.js for non-Solana users
          const { Connection } = await import('npm:@solana/web3.js@1.98.4');
          const conn = new Connection(rpcUrl, 'confirmed');
          const lamports = await withTimeout(conn.getBalance(address), PER_CHAIN_TIMEOUT_MS);
          balance = lamports.toString();
        } else if (chain.type === 'bitcoin') {
          // Bitcoin balance lookup requires a UTXO API, not a generic JSON-RPC.
          // Return 0 for now — the address is still shown for copy/QR.
          balance = '0';
        } else {
          // 'other' chain types — not queryable via standard RPC
          balance = '0';
        }

        return {
          chain: chain.key,
          name: chain.name,
          symbol: chain.symbol,
          type: chain.type,
          balance,
          address,
          has_rpc: true,
        };
      } catch (err: any) {
        return {
          chain: chain.key,
          name: chain.name,
          symbol: chain.symbol,
          type: chain.type,
          balance: '0',
          address: getAddressForChain(chain.type, walletAddresses),
          has_rpc: true,
          error: err?.message || 'RPC error',
        };
      }
    });

    const results = await Promise.allSettled(balancePromises);
    const balances = results.map(r =>
      r.status === 'fulfilled' ? r.value : { chain: '', balance: '0', error: 'Unknown error' }
    ).filter(b => b.chain);

    return Response.json({ balances, wallet_addresses: walletAddresses });
  } catch (error: any) {
    console.error('get-multi-chain-balances error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}

function getAddressForChain(type: string, addresses: { evm: string | null; solana: string | null; bitcoin: string | null }): string | null {
  if (type === 'evm') return addresses.evm;
  if (type === 'solana') return addresses.solana;
  if (type === 'bitcoin') return addresses.bitcoin;
  return addresses.evm; // fallback
}