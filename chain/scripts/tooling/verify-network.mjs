import fs from 'node:fs/promises';
import path from 'node:path';
import { chainDir, normalizeHex, providerFor } from './common.mjs';

const manifestPath = path.resolve(
  process.argv[2] || process.env.SWAPPULSE_DEPLOYMENT_MANIFEST || path.join(chainDir, 'deployments/swappulse-testnet.json'),
);
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
if (manifest.network !== 'SWAPPULSE_TESTNET') throw new Error('Manifest network must be SWAPPULSE_TESTNET');

const { provider, rpcUrl } = await providerFor(manifest.rpc_url);
const actualChainId = normalizeHex(await provider.getChainId(), 'chain id');
const expectedChainId = normalizeHex(manifest.chain_id, 'manifest chain id');
if (actualChainId !== expectedChainId) {
  throw new Error(`Chain ID mismatch: expected ${expectedChainId}, got ${actualChainId}`);
}

const registryAddress = normalizeHex(manifest.identity_registry_address, 'registry address');
const expectedRegistryHash = normalizeHex(manifest.identity_registry_class_hash, 'registry class hash');
const expectedAccountHash = normalizeHex(manifest.account_class_hash, 'account class hash');
const registryHash = normalizeHex(await provider.getClassHashAt(registryAddress), 'registry class hash');
if (registryHash !== expectedRegistryHash) {
  throw new Error(`Registry class hash mismatch: expected ${expectedRegistryHash}, got ${registryHash}`);
}
if (!(await provider.isClassDeclared({ classHash: expectedAccountHash }))) {
  throw new Error(`SwapPulseAccount class ${expectedAccountHash} is not declared`);
}

const ownerResult = await provider.callContract({
  contractAddress: registryAddress,
  entrypoint: 'owner',
  calldata: [],
});
const owner = ownerResult?.[0] ? normalizeHex(ownerResult[0], 'registry owner') : '';
if (!owner) throw new Error('Could not read IdentityRegistry owner');
const expectedOwner = manifest.identity_registry_owner
  ? normalizeHex(manifest.identity_registry_owner, 'manifest registry owner')
  : '';
if (expectedOwner && owner !== expectedOwner) {
  throw new Error(`IdentityRegistry owner mismatch: expected ${expectedOwner}, got ${owner}`);
}

console.log(JSON.stringify({
  ok: true,
  rpc_url: rpcUrl,
  chain_id: actualChainId,
  identity_registry_address: registryAddress,
  identity_registry_class_hash: registryHash,
  account_class_hash: expectedAccountHash,
  identity_registry_owner: owner,
  verified_at: new Date().toISOString(),
}, null, 2));
