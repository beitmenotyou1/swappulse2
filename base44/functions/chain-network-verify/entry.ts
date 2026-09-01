import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { hash } from 'npm:starknet@10.0.2';
import { assertSafeHost } from '../../shared/ssrfGuard.ts';

const NETWORK = 'SWAPPULSE_TESTNET';
const RPC_TIMEOUT_MS = 10_000;

function jsonError(message: string, status: number, code?: string): Response {
  return Response.json({ error: message, code: code || undefined }, { status });
}

function normalizeHex(value: unknown, field: string): string {
  const raw = String(value || '').trim().toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(raw)) throw new Error(`${field} must be 0x-prefixed hex`);
  return `0x${BigInt(raw).toString(16)}`;
}

async function safeRpcUrl(rawUrl: string): Promise<string> {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:') throw new Error('RPC URL must use HTTPS');
  if (url.username || url.password) throw new Error('Authenticated RPC URLs are not allowed in ChainNetworkConfig');
  await assertSafeHost(url.hostname);
  return url.toString();
}

async function rpcCall(rpcUrl: string, method: string, params: unknown[]): Promise<any> {
  const attempts = 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        redirect: 'manual',
        headers: {
          'content-type': 'application/json',
          'accept': 'application/json',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method, params }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (payload?.error) {
        const code = payload.error?.code ?? 'unknown';
        throw new Error(`JSON-RPC error ${code}`);
      }
      return payload?.result;
    } catch (error: any) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  const reason = lastError?.name === 'AbortError'
    ? 'timed out'
    : String(lastError?.message || 'request failed').slice(0, 160);
  throw new Error(`RPC ${method} failed after ${attempts} attempts: ${reason}`);
}

export default async function(req: Request): Promise<Response> {
  let stage = 'initialising';
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return jsonError('Unauthorized', 401);
    if (caller.role !== 'admin') return jsonError('Admin only', 403);

    stage = 'loading saved network configuration';
    const svc = base44.asServiceRole;
    const rows = await svc.entities.ChainNetworkConfig
      .filter({ network: NETWORK }, '-updated_date', 1)
      .catch(() => []);
    const config = rows?.[0];
    if (!config) return jsonError('SwapPulse Testnet configuration not found', 404, 'CHAIN_CONFIG_MISSING');

    const rpcRaw = String(config.rpc_url || '').trim();
    const configuredChainId = String(config.chain_id || '').trim();
    const registryAddress = String(config.identity_registry_address || '').trim();
    const configuredRegistryOwner = String(config.identity_registry_owner || '').trim();
    const configuredVerifier = String(config.identity_verifier_address || '').trim();
    const configuredRegistryHash = String(config.identity_registry_class_hash || '').trim();
    const configuredAccountHash = String(config.account_class_hash || '').trim();
    const verificationMode = String(config.identity_verification_mode || 'V1').trim().toUpperCase();
    const supportContracts = [
      { key: 'native_token', label: 'NativeToken', address: String(config.native_token_address || '').trim(), classHash: String(config.native_token_class_hash || '').trim() },
      { key: 'card_nft', label: 'CardNft', address: String(config.card_nft_address || '').trim(), classHash: String(config.card_nft_class_hash || '').trim() },
      { key: 'staking_pool', label: 'StakingPool', address: String(config.staking_pool_address || '').trim(), classHash: String(config.staking_pool_class_hash || '').trim() },
      { key: 'usership', label: 'ProofOfUsership', address: String(config.usership_address || '').trim(), classHash: String(config.usership_class_hash || '').trim() },
      { key: 'bridge_adapter', label: 'BridgeAdapter', address: String(config.bridge_adapter_address || '').trim(), classHash: String(config.bridge_adapter_class_hash || '').trim() },
    ];
    const incompleteSupport = supportContracts.find((item) => Boolean(item.address) !== Boolean(item.classHash));
    if (incompleteSupport) {
      return jsonError(`${incompleteSupport.label} requires both an address and class hash`, 409, 'ECOSYSTEM_CONFIG_INCOMPLETE');
    }
    if (!['V1', 'V2'].includes(verificationMode)) {
      return jsonError('Identity verification mode must be V1 or V2', 409, 'IDENTITY_VERIFICATION_MODE_INVALID');
    }
    if (!rpcRaw || !configuredChainId || !registryAddress || !configuredRegistryOwner || !configuredVerifier || !configuredRegistryHash || !configuredAccountHash) {
      return jsonError('Save the RPC URL, chain ID, registry address/owner, authorised verifier and both class hashes before verification', 409, 'CHAIN_CONFIG_INCOMPLETE');
    }

    let rpcUrl: string;
    try {
      stage = 'validating the public RPC hostname';
      rpcUrl = await safeRpcUrl(rpcRaw);
    } catch (error: any) {
      return jsonError(error?.message || 'Unsafe RPC URL', 400, 'UNSAFE_RPC_URL');
    }

    stage = 'reading RPC specification version';
    const specVersion = await rpcCall(rpcUrl, 'starknet_specVersion', []);
    stage = 'reading RPC chain ID';
    const chainIdRaw = await rpcCall(rpcUrl, 'starknet_chainId', []);
    const chainId = normalizeHex(chainIdRaw, 'RPC chain id');
    const expectedChainId = normalizeHex(configuredChainId, 'configured chain id');
    if (chainId !== expectedChainId) {
      return jsonError('RPC chain ID does not match the saved SwapPulse Testnet configuration', 409, 'CHAIN_ID_MISMATCH');
    }

    stage = 'verifying IdentityRegistry class';
    const expectedRegistryHash = normalizeHex(configuredRegistryHash, 'configured registry class hash');
    const actualRegistryHash = normalizeHex(
      await rpcCall(rpcUrl, 'starknet_getClassHashAt', ['latest', normalizeHex(registryAddress, 'registry address')]),
      'registry class hash',
    );
    if (actualRegistryHash !== expectedRegistryHash) {
      return jsonError('IdentityRegistry class hash does not match the saved configuration', 409, 'REGISTRY_CLASS_HASH_MISMATCH');
    }

    stage = 'verifying IdentityRegistry owner';
    const expectedOwner = normalizeHex(configuredRegistryOwner, 'configured registry owner');
    const ownerResult = await rpcCall(rpcUrl, 'starknet_call', [
      {
        contract_address: normalizeHex(registryAddress, 'registry address'),
        entry_point_selector: hash.getSelectorFromName('owner'),
        calldata: [],
      },
      'latest',
    ]);
    if (!Array.isArray(ownerResult) || !ownerResult[0]) {
      return jsonError('IdentityRegistry owner could not be verified', 409, 'REGISTRY_OWNER_UNREADABLE');
    }
    const actualOwner = normalizeHex(ownerResult[0], 'registry owner');
    if (actualOwner !== expectedOwner) {
      return jsonError('IdentityRegistry owner does not match the saved configuration', 409, 'REGISTRY_OWNER_MISMATCH');
    }

    stage = 'verifying authorised identity verifier';
    const expectedVerifier = normalizeHex(configuredVerifier, 'configured identity verifier');
    if (expectedVerifier === actualOwner) {
      return jsonError('Identity verifier must be separate from the registry owner', 409, 'VERIFIER_ROLE_NOT_SEPARATED');
    }
    const verifierResult = await rpcCall(rpcUrl, 'starknet_call', [
      {
        contract_address: normalizeHex(registryAddress, 'registry address'),
        entry_point_selector: hash.getSelectorFromName('is_verifier'),
        calldata: [expectedVerifier],
      },
      'latest',
    ]);
    if (!Array.isArray(verifierResult) || BigInt(verifierResult[0] || '0x0') !== 1n) {
      return jsonError('Configured identity verifier is not authorised by IdentityRegistry', 409, 'IDENTITY_VERIFIER_NOT_AUTHORISED');
    }

    let verificationV2Required = false;
    if (verificationMode === 'V2') {
      stage = 'verifying IdentityRegistry V2 ABI';
      const v2Result = await rpcCall(rpcUrl, 'starknet_call', [
        {
          contract_address: normalizeHex(registryAddress, 'registry address'),
          entry_point_selector: hash.getSelectorFromName('verification_v2_required'),
          calldata: [],
        },
        'latest',
      ]);
      if (!Array.isArray(v2Result) || v2Result.length < 1) {
        return jsonError('IdentityRegistry V2 assurance ABI could not be verified', 409, 'IDENTITY_VERIFICATION_V2_UNAVAILABLE');
      }
      verificationV2Required = BigInt(v2Result[0] || '0x0') === 1n;
    }

    stage = 'verifying SwapPulseAccount declaration';
    const expectedAccountHash = normalizeHex(configuredAccountHash, 'configured account class hash');
    const accountClass = await rpcCall(rpcUrl, 'starknet_getClass', ['latest', expectedAccountHash]);
    if (!accountClass || typeof accountClass !== 'object') {
      return jsonError('SwapPulseAccount class declaration could not be verified', 409, 'ACCOUNT_CLASS_NOT_DECLARED');
    }

    const verifiedSupport: Record<string, string> = {};
    const canonicalSupport: Record<string, string> = {};
    for (const item of supportContracts) {
      if (!item.address) continue;
      stage = `verifying ${item.label} deployment`; 
      const address = normalizeHex(item.address, `${item.label} address`);
      const expectedHash = normalizeHex(item.classHash, `${item.label} class hash`);
      const actualHash = normalizeHex(
        await rpcCall(rpcUrl, 'starknet_getClassHashAt', ['latest', address]),
        `${item.label} deployed class hash`,
      );
      if (actualHash !== expectedHash) {
        return jsonError(`${item.label} class hash does not match the saved configuration`, 409, `${item.key.toUpperCase()}_CLASS_HASH_MISMATCH`);
      }
      const ownerValues = await rpcCall(rpcUrl, 'starknet_call', [
        {
          contract_address: address,
          entry_point_selector: hash.getSelectorFromName('owner'),
          calldata: [],
        },
        'latest',
      ]);
      if (!Array.isArray(ownerValues) || !ownerValues[0] || normalizeHex(ownerValues[0], `${item.label} owner`) !== actualOwner) {
        return jsonError(`${item.label} owner does not match the IdentityRegistry owner`, 409, `${item.key.toUpperCase()}_OWNER_MISMATCH`);
      }
      canonicalSupport[`${item.key}_address`] = address;
      canonicalSupport[`${item.key}_class_hash`] = actualHash;
      verifiedSupport[`verified_${item.key}_class_hash`] = actualHash;
    }
    const ecosystemReady = supportContracts.every((item) => Boolean(item.address && item.classHash));
    if (ecosystemReady) {
      stage = 'verifying ecosystem contract wiring';
      const readAddress = async (contractAddress: string, entrypoint: string, label: string) => {
        const values = await rpcCall(rpcUrl, 'starknet_call', [
          {
            contract_address: contractAddress,
            entry_point_selector: hash.getSelectorFromName(entrypoint),
            calldata: [],
          },
          'latest',
        ]);
        if (!Array.isArray(values) || !values[0]) throw new Error(`${label} could not be read`);
        return normalizeHex(values[0], label);
      };
      const nativeTokenAddress = canonicalSupport.native_token_address;
      const cardNftAddress = canonicalSupport.card_nft_address;
      const stakingPoolAddress = canonicalSupport.staking_pool_address;
      const usershipAddress = canonicalSupport.usership_address;
      const bridgeAdapterAddress = canonicalSupport.bridge_adapter_address;
      try {
        const [stakingToken, stakingRegistry, stakingUsership, bridgeToken, bridgeCard, cardBridge] = await Promise.all([
          readAddress(stakingPoolAddress, 'stake_token', 'StakingPool stake_token'),
          readAddress(stakingPoolAddress, 'identity_registry', 'StakingPool identity_registry'),
          readAddress(stakingPoolAddress, 'usership', 'StakingPool usership'),
          readAddress(bridgeAdapterAddress, 'bridge_token', 'BridgeAdapter bridge_token'),
          readAddress(bridgeAdapterAddress, 'card_nft', 'BridgeAdapter card_nft'),
          readAddress(cardNftAddress, 'bridge', 'CardNft bridge'),
        ]);
        if (stakingToken !== nativeTokenAddress) return jsonError('StakingPool is wired to a different NativeToken', 409, 'STAKING_TOKEN_MISMATCH');
        if (stakingRegistry !== normalizeHex(registryAddress, 'registry address')) return jsonError('StakingPool is wired to a different IdentityRegistry', 409, 'STAKING_REGISTRY_MISMATCH');
        if (stakingUsership !== usershipAddress) return jsonError('StakingPool is wired to a different ProofOfUsership', 409, 'STAKING_USERSHIP_MISMATCH');
        if (bridgeToken !== nativeTokenAddress) return jsonError('BridgeAdapter is wired to a different NativeToken', 409, 'BRIDGE_TOKEN_MISMATCH');
        if (bridgeCard !== cardNftAddress) return jsonError('BridgeAdapter is wired to a different CardNft', 409, 'BRIDGE_CARD_MISMATCH');
        if (cardBridge !== bridgeAdapterAddress) return jsonError('CardNft is wired to a different BridgeAdapter', 409, 'CARD_BRIDGE_MISMATCH');

        const minterValues = await rpcCall(rpcUrl, 'starknet_call', [
          {
            contract_address: nativeTokenAddress,
            entry_point_selector: hash.getSelectorFromName('is_minter'),
            calldata: [bridgeAdapterAddress],
          },
          'latest',
        ]);
        if (!Array.isArray(minterValues) || BigInt(minterValues[0] || '0x0') !== 1n) {
          return jsonError('BridgeAdapter is not authorised as a NativeToken minter', 409, 'BRIDGE_MINTER_NOT_AUTHORISED');
        }
      } catch (error: any) {
        return jsonError(error?.message || 'Ecosystem contract wiring could not be verified', 409, 'ECOSYSTEM_WIRING_UNREADABLE');
      }
    }

    stage = 'saving verified network pins';
    const now = new Date().toISOString();
    // Every consumer treats the network as ready only when each verified_* pin is
    // byte-identical to its live config field. The pins hold normalised values
    // (lowercased, leading zeros stripped, URL canonicalised), so an admin entry
    // written in any other equivalent form — a class hash padded to 64 digits,
    // uppercase hex, or a bare origin that canonicalises with a trailing slash —
    // would never compare equal and the network would stay permanently "not
    // ready" despite verification reporting CONFIGURED. Persist the canonical
    // form into the config fields too, so equality is meaningful and a genuine
    // later edit by an admin still correctly invalidates the pins.
    await svc.entities.ChainNetworkConfig.update(config.id, {
      status: 'CONFIGURED',
      last_verified_at: now,
      rpc_url: rpcUrl,
      chain_id: chainId,
      identity_registry_address: normalizeHex(registryAddress, 'registry address'),
      identity_registry_class_hash: actualRegistryHash,
      identity_registry_owner: actualOwner,
      identity_verifier_address: expectedVerifier,
      identity_verification_mode: verificationMode,
      account_class_hash: expectedAccountHash,
      ...canonicalSupport,
      verified_chain_id: chainId,
      verified_identity_registry_class_hash: actualRegistryHash,
      verified_identity_registry_owner: actualOwner,
      verified_identity_verifier_address: expectedVerifier,
      verified_identity_verification_mode: verificationMode,
      verified_account_class_hash: expectedAccountHash,
      ...verifiedSupport,
      verified_rpc_url: rpcUrl,
      verified_by: caller.id,
    });

    return Response.json({
      ok: true,
      network: NETWORK,
      status: 'CONFIGURED',
      identity_ready: true,
      ecosystem_ready: ecosystemReady,
      verified_at: now,
      rpc: {
        url: rpcUrl,
        spec_version: String(specVersion || ''),
        chain_id: chainId,
      },
      contracts: {
        identity_registry_address: normalizeHex(registryAddress, 'registry address'),
        identity_registry_class_hash: actualRegistryHash,
        identity_registry_owner: actualOwner,
        identity_verifier_address: expectedVerifier,
        identity_verification_mode: verificationMode,
        verification_v2_required: verificationV2Required,
        account_class_hash: expectedAccountHash,
        native_token_address: canonicalSupport.native_token_address || '',
        native_token_class_hash: canonicalSupport.native_token_class_hash || '',
        card_nft_address: canonicalSupport.card_nft_address || '',
        card_nft_class_hash: canonicalSupport.card_nft_class_hash || '',
        staking_pool_address: canonicalSupport.staking_pool_address || '',
        staking_pool_class_hash: canonicalSupport.staking_pool_class_hash || '',
        usership_address: canonicalSupport.usership_address || '',
        usership_class_hash: canonicalSupport.usership_class_hash || '',
        bridge_adapter_address: canonicalSupport.bridge_adapter_address || '',
        bridge_adapter_class_hash: canonicalSupport.bridge_adapter_class_hash || '',
      },
    });
  } catch (error: any) {
    const detail = String(error?.message || error || 'Unknown verification error').slice(0, 220);
    console.error(`chain-network-verify failed during ${stage}:`, detail);
    return Response.json({
      error: `SwapPulse Testnet verification failed while ${stage}: ${detail}`,
      code: 'CHAIN_NETWORK_VERIFY_FAILED',
      stage,
      detail,
    }, { status: 500 });
  }
}