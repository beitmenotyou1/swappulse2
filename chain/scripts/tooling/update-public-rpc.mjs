import fs from 'node:fs/promises';
import path from 'node:path';
import {
  chainDir,
  normalizeHex,
  providerFor,
  safeRpcUrl,
  writePublicManifest,
} from './common.mjs';

const manifestPath = path.resolve(
  process.argv[2] ||
    process.env.SWAPPULSE_DEPLOYMENT_MANIFEST ||
    path.join(chainDir, 'deployments/swappulse-testnet.json'),
);
const candidateRpc = safeRpcUrl(process.env.SWAPPULSE_PUBLIC_RPC_URL || process.argv[3] || '');
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

if (manifest.network !== 'SWAPPULSE_TESTNET') {
  throw new Error('Manifest network must be SWAPPULSE_TESTNET');
}

const { provider, rpcUrl } = await providerFor(candidateRpc);
const expectedChainId = normalizeHex(manifest.chain_id, 'manifest chain id');
const actualChainId = normalizeHex(await provider.getChainId(), 'chain id');
if (actualChainId !== expectedChainId) {
  throw new Error(`Chain ID mismatch: expected ${expectedChainId}, got ${actualChainId}`);
}

const registryAddress = normalizeHex(manifest.identity_registry_address, 'registry address');
const expectedRegistryHash = normalizeHex(
  manifest.identity_registry_class_hash,
  'manifest registry class hash',
);
const actualRegistryHash = normalizeHex(
  await provider.getClassHashAt(registryAddress),
  'registry class hash',
);
if (actualRegistryHash !== expectedRegistryHash) {
  throw new Error(
    `Registry class hash mismatch: expected ${expectedRegistryHash}, got ${actualRegistryHash}`,
  );
}

manifest.rpc_url = rpcUrl;
manifest.rpc_url_updated_at = new Date().toISOString();
await writePublicManifest(manifestPath, manifest);

console.log(
  JSON.stringify(
    {
      ok: true,
      manifest: manifestPath,
      rpc_url: rpcUrl,
      chain_id: actualChainId,
      identity_registry_address: registryAddress,
      identity_registry_class_hash: actualRegistryHash,
      updated_at: manifest.rpc_url_updated_at,
    },
    null,
    2,
  ),
);
