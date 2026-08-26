// transfer-pulse-admin — one-off admin function that hands ownership of the
// deployed PulseToken (PULSE) on Polygon from the deployer wallet to a new
// owner address. Performs two actions:
//   1. setAdmin(new_admin)  — transfers the contract admin role
//   2. transfer(new_admin, deployerBalance) — optionally sends the deployer's
//      entire token balance to the new owner (so they hold the supply too)
//
// Called once after deploy-pulse-token. The token address is resolved from the
// ContractRegistry (populated by deploy-pulse-token), falling back to the
// PULSE_TOKEN_CONTRACT secret if set.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ethers } from 'npm:ethers@6.13.4';
import { secrets } from 'base44:runtime';
import { PULSE_TOKEN_ABI } from '../../shared/pulseTokenArtifacts.ts';

// secrets is still used for POLYGON_PRIVATE_KEY / POLYGON_RPC_URL below.

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { new_admin, transfer_supply } = body;
    if (!new_admin || !ethers.isAddress(new_admin)) {
      return Response.json({ error: 'A valid new_admin address is required' }, { status: 400 });
    }

    // Resolve the PulseToken address from the ContractRegistry (populated by
    // deploy-pulse-token on successful deployment).
    const records = await base44.asServiceRole.entities.ContractRegistry
      .filter({ contract_key: 'polygon_token' }).catch(() => []);
    const tokenAddress = records?.[0]?.address || '';
    if (!tokenAddress) {
      return Response.json({ error: 'PulseToken not deployed yet. Run deploy-pulse-token first.' }, { status: 400 });
    }

    const privateKey = secrets.get('POLYGON_PRIVATE_KEY');
    const rpcUrl = secrets.get('POLYGON_RPC_URL');
    if (!privateKey || !rpcUrl) {
      return Response.json({ error: 'POLYGON_PRIVATE_KEY and POLYGON_RPC_URL secrets must be set' }, { status: 400 });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const token = new ethers.Contract(tokenAddress, PULSE_TOKEN_ABI, wallet);

    // Guard: the deployer wallet must be the current admin to call setAdmin.
    const currentAdmin = await token.admin();
    if (currentAdmin.toLowerCase() !== wallet.address.toLowerCase()) {
      return Response.json({
        error: `Deployer wallet ${wallet.address} is not the current admin (current: ${currentAdmin}). Admin role may have already been transferred.`,
      }, { status: 400 });
    }

    const results: any = { tokenAddress, previousAdmin: currentAdmin };

    // 1. Transfer the admin role to the new owner.
    const adminTx = await token.setAdmin(new_admin);
    await adminTx.wait();
    results.setAdminTx = adminTx.hash;

    // 2. Optionally transfer the deployer's entire token balance to the new owner.
    if (transfer_supply) {
      const deployerBalance = await token.balanceOf(wallet.address);
      if (deployerBalance > 0n) {
        const transferTx = await token.transfer(new_admin, deployerBalance);
        await transferTx.wait();
        results.transferTx = transferTx.hash;
        results.transferredWei = deployerBalance.toString();
      }
    }

    return Response.json({
      status: 'transferred',
      newAdmin: new_admin,
      ...results,
    });
  } catch (error: any) {
    console.error('transfer-pulse-admin error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}