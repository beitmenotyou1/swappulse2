import fs from 'node:fs/promises';
import path from 'node:path';
import { Account, CallData, RpcProvider, cairo, ec, hash } from 'starknet';
import { normalizeHex, requiredEnv, wait } from './common.mjs';

const EXPECTED_NETWORK = 'SWAPPULSE_NODELAB_1';
const EXPECTED_CHAIN_ID = '0x5357415050554c53455f4e4f44454c41425f31';
const STRK_ADDRESS = '0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';
const ONE_SWPX = 10n ** 18n;

const manifestPath = path.resolve(requiredEnv('SWAPPULSE_DEPLOYMENT_MANIFEST'));
const exercisePath = path.resolve(requiredEnv('NODELAB_V2_EXERCISE_RESULT_FILE'));
const sequencerRpc = requiredEnv('SWAPPULSE_RPC_URL');
const observerRpc = requiredEnv('SWAPPULSE_OBSERVER_RPC_URL');
const ownerPrivateKey = normalizeHex(requiredEnv('NODELAB_DEPLOYER_PRIVATE_KEY'), 'node-lab deployer key');
const verifierPrivateKey = normalizeHex(requiredEnv('NODELAB_VERIFIER_PRIVATE_KEY'), 'node-lab verifier key');
const userPrivateKey = normalizeHex(requiredEnv('NODELAB_TEST_USER_PRIVATE_KEY'), 'node-lab test user key');
const identityId = normalizeHex(requiredEnv('NODELAB_TEST_IDENTITY_ID'), 'node-lab identity id');
const expiringAttestation = normalizeHex(requiredEnv('NODELAB_CUTOVER_ATTESTATION_1'), 'cut-over attestation 1');
const finalAttestation = normalizeHex(requiredEnv('NODELAB_CUTOVER_ATTESTATION_2'), 'cut-over attestation 2');
if (expiringAttestation === finalAttestation) throw new Error('Cut-over attestation ids must differ');

const [manifestRaw, exerciseRaw] = await Promise.all([
  fs.readFile(manifestPath, 'utf8'),
  fs.readFile(exercisePath, 'utf8'),
]);
const manifest = JSON.parse(manifestRaw);
const exercise = JSON.parse(exerciseRaw);
if (manifest.network !== EXPECTED_NETWORK) throw new Error(`Manifest network must be ${EXPECTED_NETWORK}`);
if (normalizeHex(manifest.chain_id, 'manifest chain id') !== EXPECTED_CHAIN_ID) throw new Error('Node-lab manifest chain id mismatch');
if (!exercise?.ok || exercise.network !== EXPECTED_NETWORK) throw new Error('Pre-cutover V2 exercise evidence is missing or invalid');
if (exercise.verification_v2_required !== false || exercise.final_v2_active !== true) {
  throw new Error('Pre-cutover V2 exercise did not leave the required final state');
}
if (normalizeHex(exercise.identity_id, 'exercise identity id') !== identityId) {
  throw new Error('Configured node-lab identity id does not match V2 exercise evidence');
}

const provider = new RpcProvider({ nodeUrl: sequencerRpc });
const observer = new RpcProvider({ nodeUrl: observerRpc });
const [chainId, observerChainId] = await Promise.all([
  provider.getChainId(),
  observer.getChainId(),
]);
if (normalizeHex(chainId, 'sequencer chain id') !== EXPECTED_CHAIN_ID || normalizeHex(observerChainId, 'observer chain id') !== EXPECTED_CHAIN_ID) {
  throw new Error('Wrong node-lab chain id');
}

const accountClassHash = normalizeHex(manifest.account_class_hash, 'account class hash');
const registry = normalizeHex(manifest.identity_registry_address, 'registry address');
const token = normalizeHex(manifest.native_token_address, 'token address');
const pool = normalizeHex(manifest.staking_pool_address, 'staking pool address');
const ownerAddress = normalizeHex(manifest.identity_registry_owner, 'owner address');
const verifierAddress = normalizeHex(manifest.identity_verifier_address, 'verifier address');
const userAddress = normalizeHex(exercise.user_account_address, 'exercise user address');
const startingStake = BigInt(exercise.self_stake || '0');
if (startingStake <= 0n) throw new Error('Pre-cutover stake evidence is invalid');

function identityFromKey(privateKey, label) {
  const publicKey = normalizeHex(ec.starkCurve.getStarkKey(privateKey), `${label} public key`);
  const address = normalizeHex(hash.calculateContractAddressFromHash(publicKey, accountClassHash, [publicKey], 0), `${label} address`);
  return { publicKey, address };
}

const derivedOwner = identityFromKey(ownerPrivateKey, 'owner');
const derivedVerifier = identityFromKey(verifierPrivateKey, 'verifier');
const derivedUser = identityFromKey(userPrivateKey, 'test user');
if (derivedOwner.address !== ownerAddress) throw new Error('Owner private key does not match manifest owner');
if (derivedVerifier.address !== verifierAddress) throw new Error('Verifier private key does not match manifest verifier');
if (derivedUser.address !== userAddress) throw new Error('Test-user private key does not match pre-cutover exercise account');

const owner = new Account({ provider, address: ownerAddress, signer: ownerPrivateKey });
const verifier = new Account({ provider, address: verifierAddress, signer: verifierPrivateKey });
const user = new Account({ provider, address: userAddress, signer: userPrivateKey });

async function call(p, address, entrypoint, calldata = []) {
  return p.callContract({ contractAddress: address, entrypoint, calldata });
}

function u256(values, label) {
  if (!Array.isArray(values) || values.length < 2) throw new Error(`${label} did not return u256`);
  return BigInt(values[0] || '0') + (BigInt(values[1] || '0') << 128n);
}

async function executeAndWait(account, calls) {
  const tx = await account.execute(calls);
  await wait(provider, tx.transaction_hash);
  return tx.transaction_hash || '';
}

async function latestTimestamp() {
  const response = await fetch(sequencerRpc, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'starknet_getBlockWithTxHashes', params: ['latest'] }),
  });
  if (!response.ok) throw new Error(`Block timestamp RPC HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(`Block timestamp RPC failed: ${JSON.stringify(payload.error)}`);
  const timestamp = Number(payload.result?.timestamp);
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) throw new Error('Could not read latest block timestamp');
  return timestamp;
}

async function waitObserverTo(height) {
  let observerHead = await observer.getBlockNumber();
  for (let attempt = 0; attempt < 90 && observerHead < height; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    observerHead = await observer.getBlockNumber();
  }
  if (observerHead < height) throw new Error(`Observer did not catch up to required height ${height}`);
  return observerHead;
}

const verificationRoot = '0x535750585f4e4f44454c41425f4355544f5645525f5632';
const schemaHash = '0x535750585f4e4f44454c41425f4355544f5645525f534348454d41';

async function expectLegacyRejected(label) {
  try {
    const tx = await verifier.execute({
      contractAddress: registry,
      entrypoint: 'set_verification',
      calldata: [identityId, verificationRoot, schemaHash, '0'],
    });
    await wait(provider, tx.transaction_hash);
  } catch (error) {
    const message = String(error?.message || error);
    if (/VERIFY_V2_REQUIRED/i.test(message)) return true;
    throw new Error(`${label}: legacy write failed for an unexpected reason: ${message}`);
  }
  throw new Error(`${label}: legacy set_verification unexpectedly succeeded after V2 cut-over`);
}

async function expectReplayRejected(attestationId) {
  try {
    const tx = await verifier.execute({
      contractAddress: registry,
      entrypoint: 'set_verification_v2',
      calldata: [identityId, verificationRoot, schemaHash, '1', '2', '0', attestationId],
    });
    await wait(provider, tx.transaction_hash);
  } catch (error) {
    const message = String(error?.message || error);
    if (/ATTESTATION_REPLAY/i.test(message)) return true;
    throw new Error(`V2 replay failed for an unexpected reason: ${message}`);
  }
  throw new Error('Replayed V2 attestation unexpectedly succeeded after cut-over');
}

const transactions = {
  require_v2: '',
  post_cutover_v2_expiring: '',
  post_cutover_stake_mint: '',
  post_cutover_stake_approve: '',
  post_cutover_stake_increase: '',
  post_cutover_v2_final: '',
  require_v2_again: '',
};

const beforeRequired = BigInt((await call(provider, registry, 'verification_v2_required'))?.[0] || '0');
if (beforeRequired !== 0n) {
  throw new Error('V2 requirement is already enabled. Do not rerun the irreversible cut-over harness without reviewing prior cut-over evidence.');
}

const identity = await call(provider, registry, 'get_identity', [identityId]);
if (normalizeHex(identity?.[0] || '0x0', 'identity account') !== userAddress || Number(BigInt(identity?.[1] || '0')) !== 1) {
  throw new Error('Pre-cutover identity binding is not active');
}
if (BigInt((await call(provider, registry, 'is_verified', [identityId]))?.[0] || '0') !== 1n) {
  throw new Error('Pre-cutover identity is not currently V2 verified');
}
let validator = await call(provider, pool, 'get_validator', [userAddress]);
if (Number(BigInt(validator?.[5] || '0')) !== 1 || BigInt(validator?.[2] || '0') !== startingStake) {
  throw new Error('Pre-cutover staking state does not match V2 exercise evidence');
}

// Irreversible owner-only switch. There is intentionally no code path to unset it.
transactions.require_v2 = await executeAndWait(owner, {
  contractAddress: registry,
  entrypoint: 'require_verification_v2',
  calldata: [],
});
if (BigInt((await call(provider, registry, 'verification_v2_required'))?.[0] || '0') !== 1n) {
  throw new Error('V2 requirement did not become true after owner cut-over transaction');
}

const cutoverHeight = await provider.getBlockNumber();
await waitObserverTo(cutoverHeight);
if (BigInt((await call(observer, registry, 'verification_v2_required'))?.[0] || '0') !== 1n) {
  throw new Error('Observer did not reproduce the permanent V2 requirement flag');
}

const legacyRejectedImmediately = await expectLegacyRejected('immediately after cut-over');

// Fresh V2 remains usable after the permanent switch and replay protection remains active.
const expiryAt = (await latestTimestamp()) + 45;
transactions.post_cutover_v2_expiring = await executeAndWait(verifier, {
  contractAddress: registry,
  entrypoint: 'set_verification_v2',
  calldata: [identityId, verificationRoot, schemaHash, '1', '2', String(expiryAt), expiringAttestation],
});
if (BigInt((await call(provider, registry, 'is_verified', [identityId]))?.[0] || '0') !== 1n) {
  throw new Error('Fresh post-cutover V2 assurance is not active');
}
if (BigInt((await call(provider, registry, 'is_attestation_used', [expiringAttestation]))?.[0] || '0') !== 1n) {
  throw new Error('Post-cutover V2 replay id was not consumed');
}
const replayRejected = await expectReplayRejected(expiringAttestation);

// Exercise the already-registered operator path after cut-over by increasing
// self stake instead of attempting a duplicate register_validator call.
const increaseAmount = 5n * ONE_SWPX;
const targetStake = startingStake + increaseAmount;
let currentStake = BigInt((await call(provider, pool, 'get_validator', [userAddress]))?.[2] || '0');
if (currentStake !== startingStake) throw new Error('Unexpected self stake before post-cutover increase');
const userBalance = u256(await call(provider, token, 'balance_of', [userAddress]), 'SWPX balance');
if (userBalance < increaseAmount) {
  transactions.post_cutover_stake_mint = await executeAndWait(owner, {
    contractAddress: token,
    entrypoint: 'mint',
    calldata: CallData.compile([userAddress, cairo.uint256(increaseAmount - userBalance)]),
  });
}
transactions.post_cutover_stake_approve = await executeAndWait(user, {
  contractAddress: token,
  entrypoint: 'approve',
  calldata: CallData.compile([pool, cairo.uint256(increaseAmount)]),
});
transactions.post_cutover_stake_increase = await executeAndWait(user, {
  contractAddress: pool,
  entrypoint: 'increase_self_stake',
  calldata: [increaseAmount.toString()],
});
validator = await call(provider, pool, 'get_validator', [userAddress]);
currentStake = BigInt(validator?.[2] || '0');
if (Number(BigInt(validator?.[5] || '0')) !== 1 || currentStake !== targetStake) {
  throw new Error(`Post-cutover increase_self_stake failed: expected ${targetStake}, got ${currentStake}`);
}

// Prove expiry still changes effective validity without undoing the permanent
// cut-over or application stake.
let expired = false;
for (let attempt = 0; attempt < 50; attempt += 1) {
  if ((await latestTimestamp()) > expiryAt) {
    expired = BigInt((await call(provider, registry, 'is_verified', [identityId]))?.[0] || '0') === 0n;
    if (expired) break;
  }
  await new Promise((resolve) => setTimeout(resolve, 2000));
}
if (!expired) throw new Error('Post-cutover V2 assurance did not expire within the bounded wait');
const expiredVerification = await call(provider, registry, 'get_verification', [identityId]);
const expiredAssurance = await call(provider, registry, 'get_assurance', [identityId]);
if (BigInt(expiredVerification?.[1] || '0') !== 1n || BigInt(expiredVerification?.[5] || '0') !== BigInt(expiryAt)) {
  throw new Error('Post-cutover expiry rewrote the verification audit record unexpectedly');
}
if (normalizeHex(expiredAssurance?.[2] || '0x0', 'expired attestation') !== expiringAttestation) {
  throw new Error('Post-cutover assurance audit id changed after expiry');
}
if (BigInt((await call(provider, registry, 'is_attestation_used', [expiringAttestation]))?.[0] || '0') !== 1n) {
  throw new Error('Expired post-cutover attestation replay id was freed');
}
if (BigInt((await call(provider, registry, 'verification_v2_required'))?.[0] || '0') !== 1n) {
  throw new Error('Permanent V2 requirement was lost after assurance expiry');
}
validator = await call(provider, pool, 'get_validator', [userAddress]);
if (Number(BigInt(validator?.[5] || '0')) !== 1 || BigInt(validator?.[2] || '0') !== targetStake) {
  throw new Error('Application stake did not survive post-cutover verification expiry');
}
const legacyRejectedAfterExpiry = await expectLegacyRejected('after post-cutover expiry');

// Leave the identity in a final active V2 state, then call the one-way switch a
// second time to prove the idempotent owner entrypoint cannot disable it.
transactions.post_cutover_v2_final = await executeAndWait(verifier, {
  contractAddress: registry,
  entrypoint: 'set_verification_v2',
  calldata: [identityId, verificationRoot, schemaHash, '1', '3', '0', finalAttestation],
});
if (BigInt((await call(provider, registry, 'is_verified', [identityId]))?.[0] || '0') !== 1n) {
  throw new Error('Final post-cutover V2 assurance did not reactivate the identity');
}
transactions.require_v2_again = await executeAndWait(owner, {
  contractAddress: registry,
  entrypoint: 'require_verification_v2',
  calldata: [],
});
if (BigInt((await call(provider, registry, 'verification_v2_required'))?.[0] || '0') !== 1n) {
  throw new Error('Repeated require_verification_v2 call changed the permanent state');
}

const finalHead = await provider.getBlockNumber();
const observerHead = await waitObserverTo(finalHead);
const [observerRequired, observerIdentity, observerVerification, observerAssurance, observerValidator] = await Promise.all([
  call(observer, registry, 'verification_v2_required'),
  call(observer, registry, 'get_identity', [identityId]),
  call(observer, registry, 'get_verification', [identityId]),
  call(observer, registry, 'get_assurance', [identityId]),
  call(observer, pool, 'get_validator', [userAddress]),
]);
if (BigInt(observerRequired?.[0] || '0') !== 1n) throw new Error('Observer permanent V2 flag mismatch');
if (normalizeHex(observerIdentity?.[0] || '0x0', 'observer identity account') !== userAddress || Number(BigInt(observerIdentity?.[1] || '0')) !== 1) {
  throw new Error('Observer identity state mismatch after cut-over');
}
if (BigInt(observerVerification?.[1] || '0') !== 1n || normalizeHex(observerAssurance?.[2] || '0x0', 'observer final attestation') !== finalAttestation) {
  throw new Error('Observer final V2 assurance mismatch after cut-over');
}
if (BigInt(observerAssurance?.[0] || '0') !== 1n || BigInt(observerAssurance?.[1] || '0') !== 3n) {
  throw new Error('Observer final assurance type/level mismatch');
}
if (Number(BigInt(observerValidator?.[5] || '0')) !== 1 || BigInt(observerValidator?.[2] || '0') !== targetStake) {
  throw new Error('Observer post-cutover staking state mismatch');
}

const result = {
  schema_version: 1,
  kind: 'SWAPPULSE_NODELAB_V2_CUTOVER',
  ok: true,
  irreversible: true,
  network: EXPECTED_NETWORK,
  chain_id: EXPECTED_CHAIN_ID,
  identity_id: identityId,
  user_account_address: userAddress,
  registry_address: registry,
  verifier_address: verifierAddress,
  verification_v2_required: true,
  legacy_rejected_immediately: legacyRejectedImmediately,
  legacy_rejected_after_expiry: legacyRejectedAfterExpiry,
  replay_rejected_after_cutover: replayRejected,
  post_cutover_expiry_observed: true,
  final_v2_active: true,
  final_verification_type: 1,
  final_verification_level: 3,
  final_attestation_id: finalAttestation,
  validator_status: 1,
  self_stake_before: startingStake.toString(),
  self_stake_after: targetStake.toString(),
  increase_self_stake_amount: increaseAmount.toString(),
  observer_verified_height: observerHead,
  transactions,
  note: 'Permanent node-lab V2 cut-over evidence. No private key is printed or written to this result.',
};

const resultFile = String(process.env.NODELAB_V2_CUTOVER_RESULT_FILE || '').trim();
if (resultFile) {
  const target = path.resolve(resultFile);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o644 });
}
console.log(JSON.stringify(result, null, 2));
