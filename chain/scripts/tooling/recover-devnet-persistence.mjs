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
const restorePath = process.env.SWAPPULSE_RECOVERY_DUMP_PATH || '/data/swappulse-restore.dump';
const completeDumpPath = process.env.SWAPPULSE_COMPLETE_DUMP_PATH || '/data/swappulse-testnet-complete.dump';

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

let nonce = await nonceOf(expectedOwner);
if (nonce > 3n) {
  throw new Error(`Recovery expects owner nonce <= 3 before dump replay; found ${nonce}`);
}

console.log(`Recovery owner: ${expectedOwner}`);
console.log(`Starting owner nonce: ${nonce}`);
console.log('Private key remains in memory and is never printed.');

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
console.log(`Loading preserved dump: ${restorePath}`);
await rpc('devnet_load', { path: restorePath });

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
console.log(`Writing self-contained recovery dump: ${completeDumpPath}`);
await rpc('devnet_dump', { path: completeDumpPath });
console.log(JSON.stringify({
  ok: true,
  identity_registry_address: expectedRegistry,
  identity_registry_class_hash: expectedRegistryClass,
  identity_registry_owner: expectedOwner,
  identity_verifier_address: expectedVerifier,
  owner_nonce: `0x${finalNonce.toString(16)}`,
  complete_dump_path: completeDumpPath,
}, null, 2));
