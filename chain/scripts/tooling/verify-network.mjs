import fs from 'node:fs/promises';
import path from 'node:path';
import { chainDir, normalizeHex, providerFor } from './common.mjs';

const manifestPath = path.resolve(
  process.argv[2] || process.env.SWAPPULSE_DEPLOYMENT_MANIFEST || path.join(chainDir, 'deployments/swappulse-testnet.json'),
);
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
if (manifest.network !== 'SWAPPULSE_TESTNET') throw new Error('Manifest network must be SWAPPULSE_TESTNET');
if (![1, 2].includes(Number(manifest.schema_version))) throw new Error('Unsupported deployment manifest schema_version');

const verificationRpc = String(process.env.SWAPPULSE_VERIFY_RPC_URL || manifest.rpc_url).trim();
const { provider, rpcUrl } = await providerFor(verificationRpc);
const actualChainId = normalizeHex(await provider.getChainId(), 'chain id');
const expectedChainId = normalizeHex(manifest.chain_id, 'manifest chain id');
if (actualChainId !== expectedChainId) {
  throw new Error(`Chain ID mismatch: expected ${expectedChainId}, got ${actualChainId}`);
}

async function call(address, entrypoint, calldata = []) {
  return provider.callContract({ contractAddress: address, entrypoint, calldata });
}

async function addressResult(address, entrypoint, calldata = [], label = entrypoint) {
  const values = await call(address, entrypoint, calldata);
  if (!values?.[0]) throw new Error(`Could not read ${label}`);
  return normalizeHex(values[0], label);
}

async function scalarResult(address, entrypoint, calldata = [], label = entrypoint) {
  const values = await call(address, entrypoint, calldata);
  if (!Array.isArray(values) || values.length < 1) throw new Error(`Could not read ${label}`);
  return BigInt(values[0] || '0');
}

async function verifyClass(address, expectedHash, label) {
  const normalizedAddress = normalizeHex(address, `${label} address`);
  const normalizedExpected = normalizeHex(expectedHash, `${label} class hash`);
  const actual = normalizeHex(await provider.getClassHashAt(normalizedAddress), `${label} on-chain class hash`);
  if (actual !== normalizedExpected) {
    throw new Error(`${label} class hash mismatch: expected ${normalizedExpected}, got ${actual}`);
  }
  return { address: normalizedAddress, class_hash: actual };
}

async function verifyOwner(contract, expectedOwner, label) {
  const owner = await addressResult(contract, 'owner', [], `${label} owner`);
  if (owner !== expectedOwner) throw new Error(`${label} owner mismatch: expected ${expectedOwner}, got ${owner}`);
  return owner;
}

const registry = await verifyClass(
  manifest.identity_registry_address,
  manifest.identity_registry_class_hash,
  'IdentityRegistry',
);
const expectedAccountHash = normalizeHex(manifest.account_class_hash, 'account class hash');
if (!(await provider.isClassDeclared({ classHash: expectedAccountHash }))) {
  throw new Error(`SwapPulseAccount class ${expectedAccountHash} is not declared`);
}

const owner = await addressResult(registry.address, 'owner', [], 'IdentityRegistry owner');
const expectedOwner = manifest.identity_registry_owner
  ? normalizeHex(manifest.identity_registry_owner, 'manifest registry owner')
  : owner;
if (owner !== expectedOwner) {
  throw new Error(`IdentityRegistry owner mismatch: expected ${expectedOwner}, got ${owner}`);
}

const verifier = normalizeHex(manifest.identity_verifier_address, 'manifest identity verifier');
if (verifier === owner) throw new Error('Identity verifier must be separate from the IdentityRegistry owner');
const verifierEnabled = await scalarResult(registry.address, 'is_verifier', [verifier], 'IdentityRegistry verifier state');
if (verifierEnabled !== 1n) throw new Error(`Identity verifier ${verifier} is not authorised by IdentityRegistry`);

let verificationV2Required = null;
if (Number(manifest.schema_version) >= 2 || String(manifest.identity_verification_mode || '').toUpperCase() === 'V2') {
  const mode = String(manifest.identity_verification_mode || '').toUpperCase();
  if (mode !== 'V2') throw new Error('Schema-v2 manifest must set identity_verification_mode to V2');
  verificationV2Required = (await scalarResult(
    registry.address,
    'verification_v2_required',
    [],
    'IdentityRegistry verification_v2_required',
  )) === 1n;
  // Probe the additive V2 ABI without mutating state.
  await call(registry.address, 'get_assurance', ['0x1']);
}

const output = {
  ok: true,
  verification_rpc_url: rpcUrl,
  manifest_rpc_url: manifest.rpc_url,
  chain_id: actualChainId,
  identity_registry_address: registry.address,
  identity_registry_class_hash: registry.class_hash,
  account_class_hash: expectedAccountHash,
  identity_registry_owner: owner,
  identity_verifier_address: verifier,
  identity_verification_mode: String(manifest.identity_verification_mode || 'V1').toUpperCase(),
  verification_v2_required: verificationV2Required,
  ecosystem_ready: false,
};

if (Number(manifest.schema_version) >= 2) {
  const requiredSupport = [
    'native_token_address',
    'native_token_class_hash',
    'card_nft_address',
    'card_nft_class_hash',
    'usership_address',
    'usership_class_hash',
    'staking_pool_address',
    'staking_pool_class_hash',
    'bridge_adapter_address',
    'bridge_adapter_class_hash',
  ];
  for (const key of requiredSupport) {
    if (!manifest[key]) throw new Error(`Schema-v2 manifest is missing ${key}`);
  }
  if (String(manifest.native_token_symbol || '').toUpperCase() !== 'SWPX') {
    throw new Error('Schema-v2 manifest native_token_symbol must be SWPX');
  }

  const nativeToken = await verifyClass(manifest.native_token_address, manifest.native_token_class_hash, 'NativeToken');
  const cardNft = await verifyClass(manifest.card_nft_address, manifest.card_nft_class_hash, 'CardNft');
  const usership = await verifyClass(manifest.usership_address, manifest.usership_class_hash, 'ProofOfUsership');
  const stakingPool = await verifyClass(manifest.staking_pool_address, manifest.staking_pool_class_hash, 'StakingPool');
  const bridgeAdapter = await verifyClass(manifest.bridge_adapter_address, manifest.bridge_adapter_class_hash, 'BridgeAdapter');

  await Promise.all([
    verifyOwner(nativeToken.address, owner, 'NativeToken'),
    verifyOwner(cardNft.address, owner, 'CardNft'),
    verifyOwner(usership.address, owner, 'ProofOfUsership'),
    verifyOwner(stakingPool.address, owner, 'StakingPool'),
    verifyOwner(bridgeAdapter.address, owner, 'BridgeAdapter'),
  ]);

  const [stakingToken, stakingRegistry, stakingUsership, bridgeToken, bridgeCard, cardBridge] = await Promise.all([
    addressResult(stakingPool.address, 'stake_token', [], 'StakingPool stake_token'),
    addressResult(stakingPool.address, 'identity_registry', [], 'StakingPool identity_registry'),
    addressResult(stakingPool.address, 'usership', [], 'StakingPool usership'),
    addressResult(bridgeAdapter.address, 'bridge_token', [], 'BridgeAdapter bridge_token'),
    addressResult(bridgeAdapter.address, 'card_nft', [], 'BridgeAdapter card_nft'),
    addressResult(cardNft.address, 'bridge', [], 'CardNft bridge'),
  ]);
  if (stakingToken !== nativeToken.address) throw new Error('StakingPool stake token is not the manifest NativeToken');
  if (stakingRegistry !== registry.address) throw new Error('StakingPool identity registry is not the manifest IdentityRegistry');
  if (stakingUsership !== usership.address) throw new Error('StakingPool usership contract is not the manifest ProofOfUsership');
  if (bridgeToken !== nativeToken.address) throw new Error('BridgeAdapter token is not the manifest NativeToken');
  if (bridgeCard !== cardNft.address) throw new Error('BridgeAdapter CardNft is not the manifest CardNft');
  if (cardBridge !== bridgeAdapter.address) throw new Error('CardNft bridge is not the manifest BridgeAdapter');

  const bridgeIsMinter = await scalarResult(nativeToken.address, 'is_minter', [bridgeAdapter.address], 'NativeToken bridge minter state');
  if (bridgeIsMinter !== 1n) throw new Error('BridgeAdapter is not an authorised NativeToken minter');

  if (manifest.staking?.min_self_stake != null) {
    const actual = await scalarResult(stakingPool.address, 'min_self_stake', [], 'StakingPool min_self_stake');
    if (actual !== BigInt(manifest.staking.min_self_stake)) throw new Error('StakingPool min_self_stake does not match manifest');
  }
  if (manifest.staking?.unbonding_period_seconds != null) {
    const actual = await scalarResult(stakingPool.address, 'unbonding_period', [], 'StakingPool unbonding_period');
    if (actual !== BigInt(manifest.staking.unbonding_period_seconds)) throw new Error('StakingPool unbonding period does not match manifest');
  }
  if (manifest.staking?.reputation_weight_bps != null) {
    const actual = await scalarResult(usership.address, 'reputation_weight_bps', [], 'ProofOfUsership reputation_weight_bps');
    if (actual !== BigInt(manifest.staking.reputation_weight_bps)) throw new Error('ProofOfUsership reputation weight does not match manifest');
  }

  if (manifest.bridge?.external_chains_enabled === false) {
    for (const chain of [1, 2, 3]) {
      const enabled = await scalarResult(bridgeAdapter.address, 'is_chain_enabled', [String(chain)], `BridgeAdapter chain ${chain}`);
      if (enabled !== 0n) throw new Error(`BridgeAdapter destination chain ${chain} is enabled before external bridge verification`);
    }
  }

  Object.assign(output, {
    native_token_address: nativeToken.address,
    native_token_class_hash: nativeToken.class_hash,
    card_nft_address: cardNft.address,
    card_nft_class_hash: cardNft.class_hash,
    usership_address: usership.address,
    usership_class_hash: usership.class_hash,
    staking_pool_address: stakingPool.address,
    staking_pool_class_hash: stakingPool.class_hash,
    bridge_adapter_address: bridgeAdapter.address,
    bridge_adapter_class_hash: bridgeAdapter.class_hash,
    ecosystem_ready: true,
  });
}

output.verified_at = new Date().toISOString();
console.log(JSON.stringify(output, null, 2));
