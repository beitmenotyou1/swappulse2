// Centralised two-layer gate for every SwapPulse smart-contract deployment.
//
// ── Security: who can deploy SwapPulse contracts ──────────────────────────
// 1. App layer  — only Base44 admin-role users can invoke any deploy-*
//    function. A regular collector or an anonymous caller is rejected with
//    403 before any on-chain action is prepared.
// 2. On-chain layer — the deployer signer is ALWAYS the designated treasury
//    wallet (PULSE_PRIVATE_KEY on PulseChain, POLYGON_PRIVATE_KEY on Polygon).
//    No other wallet — not even an admin's personal MetaMask — can deploy
//    SwapPulse contracts. The treasury is the sole on-chain deployer, so a
//    compromised admin account still cannot deploy arbitrary contracts; only
//    the holder of the treasury key can, and only when an admin requests it.
//
// ── Gasless deployment ─────────────────────────────────────────────────────
// The treasury pays the deployment gas from its own native balance (PLS on
// PulseChain, POL on Polygon). The admin clicking "Deploy" never spends their
// personal gas — deployment is gasless from the admin's perspective. This is
// the same relayer pattern used for PulseChain meta-transactions: the treasury
// is the gas-paying relayer for every on-chain action, contract creation
// included.
//
// Every deploy-* function MUST route through `authorizeDeployment` so the
// policy above is enforced in exactly one place rather than copy-pasted.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ethers } from 'npm:ethers@6.13.4';
import { secrets } from 'base44:runtime';

export type DeployChain = 'pulse' | 'polygon';

export interface DeploymentAuthority {
  base44: any;
  wallet: ethers.Wallet;
  provider: ethers.JsonRpcProvider;
  explorerUrl: string;
  chain: DeployChain;
}

export type AuthorizationResult =
  | { ok: true; authority: DeploymentAuthority }
  | { ok: false; response: Response };

// Verifies the caller is an admin (layer 1) and loads the treasury wallet as
// the only permitted on-chain deployer (layer 2). Also confirms the treasury
// holds native gas so deployment won't stall. Returns the ready-to-use signer
// on success, or a Response the caller can return directly on failure.
export async function authorizeDeployment(
  req: Request,
  chain: DeployChain,
): Promise<AuthorizationResult> {
  // Layer 1 — app-layer admin gate.
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user || user.role !== 'admin') {
    return { ok: false, response: Response.json({ error: 'Admin only' }, { status: 403 }) };
  }

  // Layer 2 — treasury-only on-chain deployer.
  const rpcKey = chain === 'pulse' ? 'PULSE_RPC_URL' : 'POLYGON_RPC_URL';
  const pkKey = chain === 'pulse' ? 'PULSE_PRIVATE_KEY' : 'POLYGON_PRIVATE_KEY';
  const explorerKey = chain === 'pulse' ? 'PULSE_EXPLORER_URL' : 'POLYGON_EXPLORER_URL';

  const rpcUrl = secrets.get(rpcKey);
  const privateKey = secrets.get(pkKey);
  if (!rpcUrl || !privateKey) {
    return {
      ok: false,
      response: Response.json(
        { error: `${rpcKey} and ${pkKey} secrets must be set first` },
        { status: 400 },
      ),
    };
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const explorerUrl = secrets.get(explorerKey) || '';

  // The treasury must hold native gas to pay the deployment gas.
  const balance = await provider.getBalance(wallet.address);
  if (balance === 0n) {
    const native = chain === 'pulse' ? 'PLS' : 'POL';
    return {
      ok: false,
      response: Response.json(
        {
          error: `Treasury wallet ${wallet.address} has no native ${native} for deployment gas. Fund it first${explorerUrl ? ` — ${explorerUrl}/address/${wallet.address}` : ''}.`,
        },
        { status: 400 },
      ),
    };
  }

  return { ok: true, authority: { base44, wallet, provider, explorerUrl, chain } };
}