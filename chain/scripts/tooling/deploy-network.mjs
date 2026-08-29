import path from 'node:path';
import { chainDir, requiredEnv, normalizeHex, loadArtifacts, providerFor, accountFor, declareClass, wait, writePublicManifest } from './common.mjs';

const rpc = requiredEnv('SWAPPULSE_RPC_URL');
const deployerAddress = requiredEnv('SWAPPULSE_DEPLOYER_ADDRESS');
const deployerPrivateKey = requiredEnv('SWAPPULSE_DEPLOYER_PRIVATE_KEY');
const outputFile = path.resolve(
  process.env.SWAPPULSE_DEPLOYMENT_MANIFEST || path.join(chainDir, 'deployments/swappulse-testnet.json'),
);

const { provider, rpcUrl } = await providerFor(rpc);
const deployer = accountFor(provider, deployerAddress, deployerPrivateKey);
const chainId = normalizeHex(await provider.getChainId(), 'chain id');
const loaded = await loadArtifacts();

console.log(`Deploying SwapPulse Network contracts to ${rpcUrl}`);
console.log(`Deployer: ${deployer.address}`);
console.log('Private key is read from the process environment and is never written to the manifest.');

const registryDeclaration = await declareClass(
  deployer,
  provider,
  loaded.registrySierra,
  loaded.registryCasm,
);
const accountDeclaration = await declareClass(
  deployer,
  provider,
  loaded.accountSierra,
  loaded.accountCasm,
);

let registryAddress = String(process.env.SWAPPULSE_EXISTING_REGISTRY_ADDRESS || '').trim();
let registryDeployTx = '';
if (registryAddress) {
  registryAddress = normalizeHex(registryAddress, 'existing registry address');
  const onChainHash = normalizeHex(await provider.getClassHashAt(registryAddress), 'registry class hash');
  if (onChainHash !== registryDeclaration.class_hash) {
    throw new Error(`Existing registry class hash mismatch: expected ${registryDeclaration.class_hash}, got ${onChainHash}`);
  }
  console.log(`Reusing IdentityRegistry at ${registryAddress}`);
} else {
  const deployed = await deployer.deployContract({
    classHash: registryDeclaration.class_hash,
    constructorCalldata: [deployer.address],
  });
  await wait(provider, deployed.transaction_hash);
  registryAddress = normalizeHex(deployed.contract_address, 'registry address');
  registryDeployTx = deployed.transaction_hash || '';
  console.log(`IdentityRegistry deployed: ${registryAddress}`);
}

const [registryHashAt, accountDeclared, ownerResult] = await Promise.all([
  provider.getClassHashAt(registryAddress),
  provider.isClassDeclared({ classHash: accountDeclaration.class_hash }),
  provider.callContract({ contractAddress: registryAddress, entrypoint: 'owner', calldata: [] }),
]);
if (normalizeHex(registryHashAt) !== registryDeclaration.class_hash) {
  throw new Error('IdentityRegistry class hash verification failed after deployment');
}
if (!accountDeclared) throw new Error('SwapPulseAccount class declaration is not visible on-chain');
const registryOwner = ownerResult?.[0] ? normalizeHex(ownerResult[0], 'registry owner') : '';
if (!registryOwner) throw new Error('Could not read IdentityRegistry owner after deployment');

const recoveryController = String(process.env.SWAPPULSE_RECOVERY_CONTROLLER || '').trim();
const recoveryDelay = Number(process.env.SWAPPULSE_RECOVERY_DELAY_SECONDS || 172800);
if (!Number.isInteger(recoveryDelay) || recoveryDelay < 0 || recoveryDelay > 2_592_000) {
  throw new Error('SWAPPULSE_RECOVERY_DELAY_SECONDS must be an integer from 0 to 2592000');
}

const manifest = {
  schema_version: 1,
  network: 'SWAPPULSE_TESTNET',
  chain_id: chainId,
  rpc_url: rpcUrl,
  account_class_hash: accountDeclaration.class_hash,
  identity_registry_class_hash: registryDeclaration.class_hash,
  identity_registry_address: registryAddress,
  identity_registry_owner: registryOwner,
  recovery_controller: recoveryController ? normalizeHex(recoveryController, 'recovery controller') : '',
  recovery_delay_seconds: recoveryDelay,
  deployment: {
    deployer_address: normalizeHex(deployer.address),
    identity_registry_declare_tx: registryDeclaration.transaction_hash,
    account_declare_tx: accountDeclaration.transaction_hash,
    identity_registry_deploy_tx: registryDeployTx,
  },
  generated_at: new Date().toISOString(),
};

await writePublicManifest(outputFile, manifest);
console.log(`Public deployment manifest written to ${outputFile}`);
console.log(JSON.stringify(manifest, null, 2));
