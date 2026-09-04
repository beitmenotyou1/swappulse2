import fs from 'node:fs/promises';
import path from 'node:path';
import { Account, CallData, RpcProvider, cairo, ec, hash } from 'starknet';
import { normalizeHex, requiredEnv, wait } from './common.mjs';

const EXPECTED_NETWORK = 'SWAPPULSE_NODELAB_1';
const EXPECTED_CHAIN_ID = '0x5357415050554c53455f4e4f44454c41425f31';
const STRK_ADDRESS = '0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';
const ONE_SWPX = 10n ** 18n;

const manifestPath = path.resolve(requiredEnv('SWAPPULSE_DEPLOYMENT_MANIFEST'));
const sequencerRpc = requiredEnv('SWAPPULSE_RPC_URL');
const observerRpc = requiredEnv('SWAPPULSE_OBSERVER_RPC_URL');
const ownerPrivateKey = normalizeHex(requiredEnv('NODELAB_DEPLOYER_PRIVATE_KEY'), 'node-lab deployer key');
const verifierPrivateKey = normalizeHex(requiredEnv('NODELAB_VERIFIER_PRIVATE_KEY'), 'node-lab verifier key');
const userPrivateKey = normalizeHex(requiredEnv('NODELAB_TEST_USER_PRIVATE_KEY'), 'node-lab test user key');
const identityId = normalizeHex(requiredEnv('NODELAB_TEST_IDENTITY_ID'), 'node-lab identity id');
const attestations = [1, 2, 3, 4].map((i) => normalizeHex(requiredEnv(`NODELAB_TEST_ATTESTATION_${i}`), `attestation ${i}`));
if (new Set(attestations).size !== attestations.length) throw new Error('Node-lab attestation ids must be unique');

const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
if (manifest.network !== EXPECTED_NETWORK) throw new Error(`Manifest network must be ${EXPECTED_NETWORK}`);
if (normalizeHex(manifest.chain_id, 'manifest chain id') !== EXPECTED_CHAIN_ID) throw new Error('Node-lab manifest chain id mismatch');

const provider = new RpcProvider({ nodeUrl: sequencerRpc });
const observer = new RpcProvider({ nodeUrl: observerRpc });
const chainId = normalizeHex(await provider.getChainId(), 'sequencer chain id');
const observerChainId = normalizeHex(await observer.getChainId(), 'observer chain id');
if (chainId !== EXPECTED_CHAIN_ID || observerChainId !== EXPECTED_CHAIN_ID) throw new Error('Wrong node-lab chain id');

const accountClassHash = normalizeHex(manifest.account_class_hash, 'account class hash');
const registry = normalizeHex(manifest.identity_registry_address, 'registry address');
const token = normalizeHex(manifest.native_token_address, 'token address');
const pool = normalizeHex(manifest.staking_pool_address, 'staking pool address');
const ownerAddress = normalizeHex(manifest.identity_registry_owner, 'owner address');
const verifierAddress = normalizeHex(manifest.identity_verifier_address, 'verifier address');
const minStake = BigInt(manifest.staking?.min_self_stake || '0');
if (minStake <= 0n) throw new Error('Manifest min_self_stake is invalid');

function identityFromKey(privateKey, label) {
  const publicKey = normalizeHex(ec.starkCurve.getStarkKey(privateKey), `${label} public key`);
  const address = normalizeHex(hash.calculateContractAddressFromHash(publicKey, accountClassHash, [publicKey], 0), `${label} address`);
  return { publicKey, address };
}

const derivedOwner = identityFromKey(ownerPrivateKey, 'owner');
const derivedVerifier = identityFromKey(verifierPrivateKey, 'verifier');
const user = identityFromKey(userPrivateKey, 'test user');
if (derivedOwner.address !== ownerAddress) throw new Error('Node-lab owner private key does not match manifest owner');
if (derivedVerifier.address !== verifierAddress) throw new Error('Node-lab verifier private key does not match manifest verifier');
if (user.address === ownerAddress || user.address === verifierAddress) throw new Error('Test user must be separate from node-lab authorities');

const owner = new Account({ provider, address: ownerAddress, signer: ownerPrivateKey });
const verifier = new Account({ provider, address: verifierAddress, signer: verifierPrivateKey });
const userAccount = new Account({ provider, address: user.address, signer: userPrivateKey });

async function call(p, address, entrypoint, calldata = []) {
  return p.callContract({ contractAddress: address, entrypoint, calldata });
}

function u256(values, label) {
  if (!Array.isArray(values) || values.length < 2) throw new Error(`${label} did not return u256`);
  return BigInt(values[0] || '0') + (BigInt(values[1] || '0') << 128n);
}

async function classHashAtOrZero(p, address) {
  try {
    return normalizeHex(await p.getClassHashAt(address), 'class hash');
  } catch (error) {
    const message = String(error?.message || error);
    if (/(contract[^\n]*not found|contract address[^\n]*(not found|unavailable)|uninitialized contract)/i.test(message)) return '0x0';
    throw error;
  }
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

const transactions = {
  user_fee_funding: '',
  user_account_deploy: '',
  recovery_config: '',
  identity_register: '',
  verification_initial: '',
  stake_token_mint: '',
  stake_approve: '',
  validator_register: '',
  self_stake_increase_approve: '',
  self_stake_increase: '',
  verification_expiring: '',
  verification_reactivate_after_expiry: '',
  verification_revoke: '',
  verification_final_reactivate: '',
};

const v2RequiredBefore = BigInt((await call(provider, registry, 'verification_v2_required'))?.[0] || '0');
if (v2RequiredBefore !== 0n) throw new Error('V2 cut-over is already enabled; pre-cutover exercise must not run');

// Deploy a genuinely separate SwapPulseAccount for the test identity. Fee funding
// comes from the fresh node-lab owner account, never from a live/production key.
let userClass = await classHashAtOrZero(provider, user.address);
if (userClass === '0x0') {
  const feeTarget = 5n * ONE_SWPX;
  const feeBalance = u256(await call(provider, STRK_ADDRESS, 'balance_of', [user.address]), 'STRK balance');
  if (feeBalance < feeTarget) {
    transactions.user_fee_funding = await executeAndWait(owner, {
      contractAddress: STRK_ADDRESS,
      entrypoint: 'transfer',
      calldata: CallData.compile([user.address, cairo.uint256(feeTarget - feeBalance)]),
    });
  }
  const deployed = await userAccount.deployAccount({
    classHash: accountClassHash,
    constructorCalldata: [user.publicKey],
    addressSalt: user.publicKey,
    contractAddress: user.address,
  });
  await wait(provider, deployed.transaction_hash);
  transactions.user_account_deploy = deployed.transaction_hash || '';
  userClass = await classHashAtOrZero(provider, user.address);
}
if (userClass !== accountClassHash) throw new Error(`Test user address has unexpected class ${userClass}`);

const recoveryController = normalizeHex(manifest.recovery_controller, 'recovery controller');
const recoveryDelay = BigInt(manifest.recovery_delay_seconds ?? 172800);
const currentController = normalizeHex((await call(provider, user.address, 'get_recovery_controller'))?.[0] || '0x0', 'current recovery controller');
const currentDelay = BigInt((await call(provider, user.address, 'get_recovery_delay'))?.[0] || '0');
const recoveryCalls = [];
if (currentController !== recoveryController) recoveryCalls.push({ contractAddress: user.address, entrypoint: 'set_recovery_controller', calldata: [recoveryController] });
if (currentDelay !== recoveryDelay) recoveryCalls.push({ contractAddress: user.address, entrypoint: 'set_recovery_delay', calldata: [recoveryDelay.toString()] });
if (recoveryCalls.length) transactions.recovery_config = await executeAndWait(userAccount, recoveryCalls);

const identityBefore = await call(provider, registry, 'get_identity', [identityId]);
const identityStatus = Number(BigInt(identityBefore?.[1] || '0'));
if (identityStatus === 0) {
  transactions.identity_register = await executeAndWait(owner, {
    contractAddress: registry,
    entrypoint: 'register_identity',
    calldata: [identityId, user.address],
  });
} else {
  const bound = normalizeHex(identityBefore?.[0] || '0x0', 'existing identity account');
  if (identityStatus !== 1 || bound !== user.address) throw new Error('Test identity already exists with incompatible state');
}

const verificationRoot = '0x535750585f4e4f44454c41425f56325f434f4d4d49544d454e54';
const schemaHash = '0x535750585f4e4f44454c41425f56325f534348454d41';

async function setV2(attestationId, expiresAt, label) {
  const tx = await executeAndWait(verifier, {
    contractAddress: registry,
    entrypoint: 'set_verification_v2',
    calldata: [identityId, verificationRoot, schemaHash, '1', '2', String(expiresAt), attestationId],
  });
  transactions[label] = tx;
}

const existingAssurance = await call(provider, registry, 'get_assurance', [identityId]);
const existingAttestation = normalizeHex(existingAssurance?.[2] || '0x0', 'existing attestation');
if (existingAttestation === '0x0') {
  await setV2(attestations[0], 0, 'verification_initial');
}

let assurance = await call(provider, registry, 'get_assurance', [identityId]);
let verification = await call(provider, registry, 'get_verification', [identityId]);
let isVerified = BigInt((await call(provider, registry, 'is_verified', [identityId]))?.[0] || '0');
if (isVerified !== 1n || BigInt(verification?.[1] || '0') !== 1n || BigInt(assurance?.[0] || '0') !== 1n || BigInt(assurance?.[1] || '0') !== 2n) {
  throw new Error('Initial V2 verification/assurance state is invalid');
}
const activeAttestation = normalizeHex(assurance?.[2] || '0x0', 'active attestation');
if (BigInt((await call(provider, registry, 'is_attestation_used', [activeAttestation]))?.[0] || '0') !== 1n) {
  throw new Error('Initial V2 attestation replay id is not marked used');
}

// A replay must fail before mutating state.
let replayRejected = false;
try {
  await verifier.execute({
    contractAddress: registry,
    entrypoint: 'set_verification_v2',
    calldata: [identityId, verificationRoot, schemaHash, '1', '2', '0', activeAttestation],
  });
} catch (error) {
  replayRejected = /ATTESTATION_REPLAY/i.test(String(error?.message || error));
}
if (!replayRejected) throw new Error('Replayed V2 attestation was not rejected with ATTESTATION_REPLAY');

// Prove the application staking path with the verified identity. Keep a little
// SWPX liquid and exercise increase_self_stake as well as initial registration.
const increaseAmount = 10n * ONE_SWPX;
const desiredStake = minStake + increaseAmount;
let validator = await call(provider, pool, 'get_validator', [user.address]);
let validatorStatus = Number(BigInt(validator?.[5] || '0'));
let selfStake = BigInt(validator?.[2] || '0');
if (validatorStatus === 0) {
  const userBalance = u256(await call(provider, token, 'balance_of', [user.address]), 'SWPX balance');
  const mintTarget = desiredStake + 10n * ONE_SWPX;
  if (userBalance < mintTarget) {
    transactions.stake_token_mint = await executeAndWait(owner, {
      contractAddress: token,
      entrypoint: 'mint',
      calldata: CallData.compile([user.address, cairo.uint256(mintTarget - userBalance)]),
    });
  }
  transactions.stake_approve = await executeAndWait(userAccount, {
    contractAddress: token,
    entrypoint: 'approve',
    calldata: CallData.compile([pool, cairo.uint256(minStake)]),
  });
  transactions.validator_register = await executeAndWait(userAccount, {
    contractAddress: pool,
    entrypoint: 'register_validator',
    calldata: [identityId, minStake.toString(), '500'],
  });
  validator = await call(provider, pool, 'get_validator', [user.address]);
  validatorStatus = Number(BigInt(validator?.[5] || '0'));
  selfStake = BigInt(validator?.[2] || '0');
}
if (validatorStatus !== 1 || normalizeHex(validator?.[1] || '0x0', 'validator identity') !== identityId) {
  throw new Error('Validator registration did not bind the verified identity');
}
if (selfStake < desiredStake) {
  const delta = desiredStake - selfStake;
  transactions.self_stake_increase_approve = await executeAndWait(userAccount, {
    contractAddress: token,
    entrypoint: 'approve',
    calldata: CallData.compile([pool, cairo.uint256(delta)]),
  });
  transactions.self_stake_increase = await executeAndWait(userAccount, {
    contractAddress: pool,
    entrypoint: 'increase_self_stake',
    calldata: [delta.toString()],
  });
  validator = await call(provider, pool, 'get_validator', [user.address]);
  selfStake = BigInt(validator?.[2] || '0');
}
if (selfStake !== desiredStake) throw new Error(`Unexpected self stake: expected ${desiredStake}, got ${selfStake}`);

// Runtime expiry proof. A second V2 attestation is deliberately short-lived.
const expiryAt = (await latestTimestamp()) + 45;
await setV2(attestations[1], expiryAt, 'verification_expiring');
if (BigInt((await call(provider, registry, 'is_verified', [identityId]))?.[0] || '0') !== 1n) {
  throw new Error('Fresh expiring V2 verification is not active');
}
let expired = false;
for (let attempt = 0; attempt < 45; attempt += 1) {
  if ((await latestTimestamp()) > expiryAt) {
    expired = BigInt((await call(provider, registry, 'is_verified', [identityId]))?.[0] || '0') === 0n;
    if (expired) break;
  }
  await new Promise((resolve) => setTimeout(resolve, 2000));
}
if (!expired) throw new Error('V2 verification did not expire within the bounded node-lab wait');
verification = await call(provider, registry, 'get_verification', [identityId]);
assurance = await call(provider, registry, 'get_assurance', [identityId]);
if (BigInt(verification?.[1] || '0') !== 1n || BigInt(verification?.[5] || '0') !== BigInt(expiryAt)) {
  throw new Error('Expiry incorrectly rewrote the V2 audit record');
}
if (normalizeHex(assurance?.[2] || '0x0', 'expired assurance attestation') !== attestations[1]) {
  throw new Error('Expired assurance audit id changed unexpectedly');
}
validator = await call(provider, pool, 'get_validator', [user.address]);
if (Number(BigInt(validator?.[5] || '0')) !== 1 || BigInt(validator?.[2] || '0') !== desiredStake) {
  throw new Error('Stake did not survive verification expiry');
}

// Reactivate, prove explicit revocation, then leave one final valid V2 assurance
// in place for the later one-way cut-over test.
await setV2(attestations[2], 0, 'verification_reactivate_after_expiry');
transactions.verification_revoke = await executeAndWait(verifier, {
  contractAddress: registry,
  entrypoint: 'revoke_verification',
  calldata: [identityId],
});
if (BigInt((await call(provider, registry, 'is_verified', [identityId]))?.[0] || '0') !== 0n) {
  throw new Error('Revoked V2 verification remained valid');
}
verification = await call(provider, registry, 'get_verification', [identityId]);
if (BigInt(verification?.[1] || '0') !== 2n || BigInt(verification?.[6] || '0') === 0n) {
  throw new Error('Revocation audit state is invalid');
}
await setV2(attestations[3], 0, 'verification_final_reactivate');
if (BigInt((await call(provider, registry, 'is_verified', [identityId]))?.[0] || '0') !== 1n) {
  throw new Error('Final V2 reactivation failed');
}

const v2RequiredAfter = BigInt((await call(provider, registry, 'verification_v2_required'))?.[0] || '0');
if (v2RequiredAfter !== 0n) throw new Error('Exercise unexpectedly enabled the irreversible V2 cut-over');

// Wait for the observer to reproduce the final sequencer state, then independently
// read the identity and staking records from the observer.
const finalSequencerHead = await provider.getBlockNumber();
let observerHead = await observer.getBlockNumber();
for (let attempt = 0; attempt < 60 && observerHead < finalSequencerHead; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  observerHead = await observer.getBlockNumber();
}
if (observerHead < finalSequencerHead) throw new Error('Observer did not catch up to final V2 exercise height');
const observerIdentity = await call(observer, registry, 'get_identity', [identityId]);
const observerVerification = await call(observer, registry, 'get_verification', [identityId]);
const observerAssurance = await call(observer, registry, 'get_assurance', [identityId]);
const observerValidator = await call(observer, pool, 'get_validator', [user.address]);
if (normalizeHex(observerIdentity?.[0] || '0x0', 'observer identity account') !== user.address || Number(BigInt(observerIdentity?.[1] || '0')) !== 1) {
  throw new Error('Observer identity state mismatch');
}
if (BigInt(observerVerification?.[1] || '0') !== 1n || normalizeHex(observerAssurance?.[2] || '0x0', 'observer attestation') !== attestations[3]) {
  throw new Error('Observer final V2 assurance state mismatch');
}
if (Number(BigInt(observerValidator?.[5] || '0')) !== 1 || BigInt(observerValidator?.[2] || '0') !== desiredStake) {
  throw new Error('Observer staking state mismatch');
}

const result = {
  schema_version: 1,
  kind: 'SWAPPULSE_NODELAB_V2_EXERCISE',
  ok: true,
  network: EXPECTED_NETWORK,
  chain_id: chainId,
  identity_id: identityId,
  user_account_address: user.address,
  user_public_key: user.publicKey,
  registry_address: registry,
  verifier_address: verifierAddress,
  staking_pool_address: pool,
  replay_rejected: replayRejected,
  expiry_observed: true,
  revocation_observed: true,
  final_v2_active: true,
  verification_v2_required: false,
  validator_status: 1,
  self_stake: desiredStake.toString(),
  final_attestation_id: attestations[3],
  observer_verified_height: observerHead,
  transactions,
  note: 'Public node-lab evidence only. Private keys remain in local .env.local and are never printed or written to this result.',
};

const resultFile = String(process.env.NODELAB_V2_RESULT_FILE || '').trim();
if (resultFile) {
  const target = path.resolve(resultFile);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o644 });
}
console.log(JSON.stringify(result, null, 2));
