// verify-contract — admin-only: submits a contract's Solidity source to the
// matching block explorer's verification API (Polygonscan / Etherscan) so the
// source code is publicly verifiable on-chain. For self-contained contracts
// (no imports) it submits via the single-file API; for contracts with
// OpenZeppelin imports it returns a manual-verification link since those need
// standard-json-input.
//
// After submission, polls the explorer's checkverifystatus endpoint for up to
// 30 seconds and returns the final status (verified / pending / failed).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { ethers } from 'npm:ethers@6.13.4';
import { CONTRACT_SOURCES, getExplorerApiBase, getExplorerSiteBase } from '../../shared/contractSources.ts';
import { resolveDeployedAddress } from '../../shared/contractRegistry.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { contract_key, chain, compiler_version } = body;
    if (!contract_key || !chain) {
      return Response.json({ error: 'contract_key and chain are required' }, { status: 400 });
    }

    const meta = CONTRACT_SOURCES[contract_key];
    if (!meta) {
      return Response.json({ error: `No source metadata for contract_key "${contract_key}"` }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const address = await resolveDeployedAddress(svc, contract_key);
    if (!address) {
      return Response.json({ error: `Contract "${contract_key}" is not deployed yet` }, { status: 400 });
    }

    const explorerApiBase = getExplorerApiBase(chain);
    const explorerSite = getExplorerSiteBase(chain, secrets.get('PULSE_EXPLORER_URL') || '');
    const apiKey = secrets.get('ETHERSCAN_API_KEY') || '';

    // For contracts with imports (not auto-verifiable), return a manual link.
    if (!meta.auto_verifiable || !explorerApiBase) {
      const verifyUrl = explorerApiBase
        ? `${explorerSite}/verifyContract?a=${address}`
        : `${explorerSite}/address/${address}`;
      return Response.json({
        status: 'manual_required',
        contract_key,
        chain,
        address,
        message: meta.auto_verifiable
          ? `The ${chain} explorer does not expose a public verification API. Submit the source manually.`
          : `${meta.contract_name} uses OpenZeppelin imports and needs standard-json-input (flattened source). Submit manually via the explorer's "Verify & Publish" page.`,
        manual_verify_url: verifyUrl,
        explorer_url: `${explorerSite}/address/${address}`,
      });
    }

    if (!apiKey) {
      return Response.json({ error: 'ETHERSCAN_API_KEY secret not set' }, { status: 400 });
    }

    // ABI-encode constructor arguments (if any).
    let constructorArgs = '';
    if (meta.constructor_types.length > 0) {
      // polygon_card constructor takes the username contract address.
      if (contract_key === 'polygon_card') {
        const usernameAddr = await resolveDeployedAddress(svc, 'polygon_username');
        if (!usernameAddr) {
          return Response.json({ error: 'Cannot encode constructor args: polygon_username address not found' }, { status: 400 });
        }
        const coder = new ethers.AbiCoder();
        constructorArgs = coder.encode(['address'], [usernameAddr]).slice(2); // strip 0x
      }
    }

    // Submit source for verification.
    const submitBody = new URLSearchParams({
      apikey: apiKey,
      module: 'contract',
      action: 'verifysourcecode',
      sourceCode: meta.source,
      codeformat: 'solidity-single-file',
      contractaddress: address,
      contractname: meta.contract_name,
      compilerversion: compiler_version || meta.compiler_version,
      optimizationUsed: '1',
      runs: String(meta.optimizer_runs),
      constructorArguements: constructorArgs,
      licenseType: String(meta.license_type),
    });

    const submitRes = await fetch(explorerApiBase, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: submitBody.toString(),
    });
    const submitData = await submitRes.json();

    if (submitData.status !== '1') {
      return Response.json({
        status: 'failed',
        contract_key,
        chain,
        address,
        error: submitData.result || 'Verification submission failed',
        explorer_url: `${explorerSite}/address/${address}`,
      });
    }

    const guid = submitData.result;

    // Poll for verification status (up to 30 seconds).
    let verified = false;
    let statusMsg = 'pending';
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const checkBody = new URLSearchParams({
        apikey: apiKey,
        module: 'contract',
        action: 'checkverifystatus',
        guid,
      });
      const checkRes = await fetch(`${explorerApiBase}?${checkBody.toString()}`);
      const checkData = await checkRes.json();
      if (checkData.result === 'Contract source code already verified') {
        verified = true;
        statusMsg = 'already_verified';
        break;
      }
      if (checkData.status === '1' && checkData.result === 'Pass - Verified') {
        verified = true;
        statusMsg = 'verified';
        break;
      }
      if (checkData.message === 'NOTOK' && !String(checkData.result).includes('pending')) {
        return Response.json({
          status: 'failed',
          contract_key,
          chain,
          address,
          guid,
          error: checkData.result || 'Verification failed',
          explorer_url: `${explorerSite}/address/${address}`,
        });
      }
    }

    return Response.json({
      status: verified ? 'verified' : 'pending',
      contract_key,
      chain,
      address,
      guid,
      message: verified ? 'Contract source code verified successfully!' : 'Verification submitted but still pending — check the explorer in a few minutes.',
      explorer_url: `${explorerSite}/address/${address}#code`,
      verified,
    });
  } catch (error: any) {
    console.error('verify-contract error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}