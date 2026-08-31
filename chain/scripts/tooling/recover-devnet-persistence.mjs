import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hash } from 'starknet';
import {
  accountFor,
  declareClass,
  loadArtifacts,
  normalizeHex,
  providerFor,
  wait,
} from './common.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const chainDir = path.resolve(here, '../..');
const rpcUrl = process.env.SWAPPULSE_RECOVERY_RPC_URL || 'http://127.0.0.1:5050';
const manifestPath = path.resolve(
  process.env.SWAPPULSE_DEPLOYMENT_MANIFEST || path.join(chainDir, 'deployments/swappulse-testnet.json'),
);
const recoverySourceFile = path.resolve(
  process.env.SWAPPULSE_RECOVERY_SOURCE_FILE
    || path.join(chainDir, 'infra/recovery-source/swappulse-restore.dump'),
);
const combinedLoadPath = process.env.SWAPPULSE_COMBINED_LOAD_PATH || '/data/swappulse-combined-replay.dump';
const completeDumpPath = process.env.SWAPPULSE_COMPLETE_DUMP_PATH || '/data/swappulse-testnet-complete.dump';
const hostDataDir = path.resolve(
  process.env.SWAPPULSE_RECOVERY_HOST_DATA_DIR || path.join(chainDir, 'infra/data'),
);
const canonicalDumpHostPath = path.join(hostDataDir, 'swappulse-testnet.dump');

function hostPathForContainerData(containerPath) {
  const normalized = String(containerPath || '').trim();
  if (!normalized.startsWith('/data/')) {
    throw new Error(`Recovery dump path must be under /data inside Devnet: ${normalized}`);
  }
  return path.join(hostDataDir, path.basename(normalized));
}

function transactionForAction(action) {
  const params = action?.params || {};
  return params.invoke_transaction
    || params.declare_transaction
    || params.deploy_account_transaction
    || params.transaction
    || null;
}

function actionNonce(action) {
  const tx = transactionForAction(action);
  return tx?.nonce == null ? null : BigInt(tx.nonce);
}

function actionSender(action) {
  const tx = transactionForAction(action);
  const raw = tx?.sender_address || tx?.contract_address || '';
  return raw ? normalizeHex(raw, 'dump transaction sender') : '';
}

async function rpc(method, params = undefined) {
  const body = { jsonrpc: '2.0', id: crypto.randomUUID(), method };
  if (params !== undefined) body.params = params;
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error) {
    const code = payload?.error?.code ?? response.status;
    const message = payload?.error?.message || `HTTP ${response.status}`;
    throw new Error(`${method} failed (${code}): ${message}`);
  }
  return payload?.result;
}

async function nonceOf(address) {
  const value = await rpc('starknet_getNonce', {
    block_id: 'latest',
    contract_address: address,
  });
  return BigInt(value || '0x0');
}

async function classHashAt(address) {
  return normalizeHex(await rpc('starknet_getClassHashAt', {
    block_id: 'latest',
    contract_address: address,
  }), 'class hash');
}

const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
if (manifest.network !== 'SWAPPULSE_TESTNET') throw new Error('Manifest is not SWAPPULSE_TESTNET');

const expectedOwner = normalizeHex(manifest.identity_registry_owner, 'manifest registry owner');
const expectedVerifier = normalizeHex(manifest.identity_verifier_address, 'manifest identity verifier');
const expectedRegistry = normalizeHex(manifest.identity_registry_address, 'manifest registry address');
const expectedRegistryClass = normalizeHex(manifest.identity_registry_class_hash, 'manifest registry class hash');
const expectedAccountClass = normalizeHex(manifest.account_class_hash, 'manifest account class hash');

// Read and validate the immutable preserved suffix before touching Devnet state.
// Keep this source outside chain/infra/data because Devnet manages that bind-mounted directory.
let preservedActions;
try {
  preservedActions = JSON.parse(await fs.readFile(recoverySourceFile, 'utf8'));
} catch (error) {
  throw new Error(`Could not read immutable recovery source ${recoverySourceFile}: ${error.message}`);
}
if (!Array.isArray(preservedActions)) {
  throw new Error('Immutable recovery source must contain a JSON action array');
}
const preservedOwnerActions = preservedActions.filter((action) => actionSender(action) === expectedOwner);
const preservedOwnerNonces = preservedOwnerActions.map(actionNonce).filter((value) => value !== null);
if (
  preservedOwnerNonces.length !== 2
  || preservedOwnerNonces[0] !== 3n
  || preservedOwnerNonces[1] !== 4n
) {
  throw new Error(
    `Immutable recovery source must contain owner nonces 3,4; got ${preservedOwnerNonces.map(String).join(',')}`,
  );
}
console.log(`Immutable recovery source validated: ${recoverySourceFile}`);
console.log('Preserved owner nonces: 3,4');

const { provider } = await providerFor(rpcUrl);
const loaded = await loadArtifacts();
const actualRegistryClass = normalizeHex(hash.computeSierraContractClassHash(loaded.registrySierra));
const actualAccountClass = normalizeHex(hash.computeSierraContractClassHash(loaded.accountSierra));
if (actualRegistryClass !== expectedRegistryClass) {
  throw new Error(`Recovery IdentityRegistry Sierra hash mismatch: expected ${expectedRegistryClass}, got ${actualRegistryClass}`);
}
if (actualAccountClass !== expectedAccountClass) {
  throw new Error(`Recovery SwapPulseAccount Sierra hash mismatch: expected ${expectedAccountClass}, got ${actualAccountClass}`);
}

const predeployed = await rpc('devnet_getPredeployedAccounts', { with_balance: true });
const owner = Array.isArray(predeployed)
  ? predeployed.find((row) => normalizeHex(row?.address || '0x0') === expectedOwner)
  : null;
if (!owner?.address || !owner?.private_key) {
  throw new Error('Manifest registry owner is not a local Devnet predeployed account');
}
const deployer = accountFor(provider, owner.address, owner.private_key);

console.log(`Recovery owner: ${expectedOwner}`);
console.log('Private key remains in memory and is never printed.');
console.log('Resetting Devnet to pristine predeployed state before reconstructing the missing prefix...');
await rpc('devnet_restart');
let nonce = await nonceOf(expectedOwner);
if (nonce !== 0n) {
  throw new Error(`Recovery requires pristine owner nonce 0 after devnet_restart; found ${nonce}`);
}
console.log(`Starting owner nonce: ${nonce}`);

const registryDeclared = await provider.isClassDeclared({ classHash: expectedRegistryClass });
if (!registryDeclared) {
  if (nonce !== 0n) throw new Error(`IdentityRegistry class is undeclared but owner nonce is ${nonce}, expected 0`);
  console.log('Re-declaring IdentityRegistry class prerequisite...');
  await declareClass(deployer, provider, loaded.registrySierra, loaded.registryCasm);
  nonce = await nonceOf(expectedOwner);
  if (nonce !== 1n) throw new Error(`Owner nonce should be 1 after IdentityRegistry declaration; got ${nonce}`);
}

const accountDeclared = await provider.isClassDeclared({ classHash: expectedAccountClass });
if (!accountDeclared) {
  if (nonce !== 1n) throw new Error(`SwapPulseAccount class is undeclared but owner nonce is ${nonce}, expected 1`);
  console.log('Re-declaring SwapPulseAccount class prerequisite...');
  await declareClass(deployer, provider, loaded.accountSierra, loaded.accountCasm);
  nonce = await nonceOf(expectedOwner);
  if (nonce !== 2n) throw new Error(`Owner nonce should be 2 after SwapPulseAccount declaration; got ${nonce}`);
}

if (nonce === 2n) {
  console.log('Advancing missing owner nonce 2 with a read-only self-call...');
  const bump = await deployer.execute({
    contractAddress: expectedOwner,
    entrypoint: 'supports_interface',
    calldata: ['0x0'],
  });
  await wait(provider, bump.transaction_hash);
  nonce = await nonceOf(expectedOwner);
}
if (nonce !== 3n) {
  throw new Error(`Owner nonce must be exactly 3 before replaying the preserved dump; got ${nonce}`);
}

console.log(`Prerequisites reconstructed. Owner nonce: ${nonce}`);
console.log('Reading nonce 0-2 prefix from Devnet\'s automatic --dump-on block canonical dump...');

const combinedLoadHostPath = hostPathForContainerData(combinedLoadPath);
const completeHostPath = hostPathForContainerData(completeDumpPath);
let prefixActions;
try {
  prefixActions = JSON.parse(await fs.readFile(canonicalDumpHostPath, 'utf8'));
} catch (error) {
  throw new Error(`Could not read automatic canonical prefix dump ${canonicalDumpHostPath}: ${error.message}`);
}
if (!Array.isArray(prefixActions)) {
  throw new Error('Automatic canonical prefix dump must contain a JSON action array');
}

const ownerPrefix = prefixActions.filter((action) => actionSender(action) === expectedOwner);
const prefixNonces = ownerPrefix.map(actionNonce).filter((value) => value !== null);
if (prefixNonces.length !== 3 || prefixNonces.some((value, index) => value !== BigInt(index))) {
  throw new Error(`Reconstructed owner prefix must contain nonces 0,1,2; got ${prefixNonces.map(String).join(',')}`);
}

const combinedActions = [...prefixActions, ...preservedActions];
console.log(`Combined actions prepared in memory: ${combinedActions.length}; owner nonces: 0,1,2,3,4`);

console.log('Resetting Devnet again before proving the combined replay from nonce 0...');
await rpc('devnet_restart');
const resetNonce = await nonceOf(expectedOwner);
if (resetNonce !== 0n) {
  throw new Error(`Owner nonce should be 0 before combined replay; got ${resetNonce}`);
}

// Write the load file only after devnet_restart. This avoids relying on files
// inside Devnet's managed bind mount surviving a restart. Mode 0644 is
// intentional for this temporary replay file so the container's unprivileged
// UID can read a host-created file. It contains signed testnet transactions,
// not private keys or relay credentials.
await fs.writeFile(combinedLoadHostPath, `${JSON.stringify(combinedActions, null, 2)}\n`, { mode: 0o644 });
await fs.chmod(combinedLoadHostPath, 0o644);
console.log(`Combined replay staged after reset: ${combinedLoadPath}`);
console.log(`Loading combined replay: ${combinedLoadPath}`);
await rpc('devnet_load', { path: combinedLoadPath });

const registryClass = await classHashAt(expectedRegistry);
if (registryClass !== expectedRegistryClass) {
  throw new Error(`Recovered registry class mismatch: expected ${expectedRegistryClass}, got ${registryClass}`);
}
const ownerResult = await provider.callContract({
  contractAddress: expectedRegistry,
  entrypoint: 'owner',
  calldata: [],
});
const recoveredOwner = normalizeHex(ownerResult?.[0] || '0x0', 'recovered registry owner');
if (recoveredOwner !== expectedOwner) {
  throw new Error(`Recovered registry owner mismatch: expected ${expectedOwner}, got ${recoveredOwner}`);
}
const verifierResult = await provider.callContract({
  contractAddress: expectedRegistry,
  entrypoint: 'is_verifier',
  calldata: [expectedVerifier],
});
if (BigInt(verifierResult?.[0] || '0x0') !== 1n) {
  throw new Error('Recovered identity verifier is not authorised');
}

const finalNonce = await nonceOf(expectedOwner);
if (finalNonce !== 5n) {
  throw new Error(`Recovered owner nonce should be 5 after replay; got ${finalNonce}`);
}

for (const [label, txHash] of [
  ['registry deployment', manifest.deployment?.identity_registry_deploy_tx],
  ['verifier authorisation', manifest.deployment?.identity_verifier_authorise_tx],
]) {
  if (!txHash) throw new Error(`Manifest is missing ${label} transaction hash`);
  await rpc('starknet_getTransactionByHash', { transaction_hash: txHash });
}

console.log('Recovered registry and original nonce-3/4 transactions verified.');
console.log('The combined replay was proven by loading it from pristine nonce 0.');

// Persist the exact combined replay only after it has been proven loadable. The
// replay file contains signed public testnet transactions, never private keys.
// Mode 0644 keeps it readable by the unprivileged Devnet container after it is
// promoted to the canonical startup dump.
await fs.writeFile(completeHostPath, `${JSON.stringify(combinedActions, null, 2)}\n`, { mode: 0o644 });
await fs.chmod(completeHostPath, 0o644);
const finalActions = JSON.parse(await fs.readFile(completeHostPath, 'utf8'));
const finalOwnerNonces = finalActions
  .filter((action) => actionSender(action) === expectedOwner)
  .map(actionNonce)
  .filter((value) => value !== null);
if (
  finalOwnerNonces.length !== 5
  || finalOwnerNonces.some((value, index) => value !== BigInt(index))
) {
  throw new Error(`Final dump must contain owner nonces 0,1,2,3,4; got ${finalOwnerNonces.map(String).join(',')}`);
}
console.log(`Final self-contained replay written: ${completeDumpPath}`);
console.log('Final self-contained dump verified: owner nonces 0,1,2,3,4');
console.log(JSON.stringify({
  ok: true,
  identity_registry_address: expectedRegistry,
  identity_registry_class_hash: expectedRegistryClass,
  identity_registry_owner: expectedOwner,
  identity_verifier_address: expectedVerifier,
  owner_nonce: `0x${finalNonce.toString(16)}`,
  complete_dump_path: completeDumpPath,
}, null, 2));
