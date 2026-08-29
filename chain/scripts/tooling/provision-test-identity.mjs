import fs from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import { Account, RpcProvider, ec, hash } from 'starknet';
import { normalizeHex, requiredEnv, wait } from './common.mjs';

const manifestPath = path.resolve(requiredEnv('SWAPPULSE_DEPLOYMENT_MANIFEST'));
const rawRpcUrl = requiredEnv('SWAPPULSE_RAW_RPC_URL');
const registryAdminAddress = normalizeHex(requiredEnv('SWAPPULSE_REGISTRY_ADMIN_ADDRESS'), 'registry admin address');
const registryAdminPrivateKey = normalizeHex(requiredEnv('SWAPPULSE_REGISTRY_ADMIN_PRIVATE_KEY'), 'registry admin private key');
const userPrivateKey = normalizeHex(requiredEnv('SWAPPULSE_USER_PRIVATE_KEY'), 'user private key');
const identityId = normalizeHex(requiredEnv('SWAPPULSE_IDENTITY_ID'), 'identity id');
const allowDevnetMint = String(process.env.SWAPPULSE_ALLOW_DEVNET_MINT || '').toLowerCase() === 'true';

const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
if (manifest.network !== 'SWAPPULSE_TESTNET') throw new Error('Manifest network must be SWAPPULSE_TESTNET');

const rpc = new URL(rawRpcUrl);
if (!['localhost', '127.0.0.1', '::1'].includes(rpc.hostname)) {
  throw new Error('SWAPPULSE_RAW_RPC_URL must be loopback-only for the private Devnet operator flow');
}
if (rpc.protocol !== 'http:' && rpc.protocol !== 'https:') throw new Error('Unsupported raw RPC protocol');
if (rpc.username || rpc.password) throw new Error('Raw RPC URL must not contain embedded credentials');

const provider = new RpcProvider({ nodeUrl: rpc.toString() });
const chainId = normalizeHex(await provider.getChainId(), 'chain id');
const expectedChainId = normalizeHex(manifest.chain_id, 'manifest chain id');
if (chainId !== expectedChainId) throw new Error(`Chain ID mismatch: expected ${expectedChainId}, got ${chainId}`);

const registryAddress = normalizeHex(manifest.identity_registry_address, 'registry address');
const registryClassHash = normalizeHex(manifest.identity_registry_class_hash, 'registry class hash');
const accountClassHash = normalizeHex(manifest.account_class_hash, 'account class hash');
const expectedRegistryOwner = normalizeHex(manifest.identity_registry_owner, 'registry owner');

const [registryHashAt, accountDeclared, ownerResult] = await Promise.all([
  provider.getClassHashAt(registryAddress),
  provider.isClassDeclared({ classHash: accountClassHash }),
  provider.callContract({ contractAddress: registryAddress, entrypoint: 'owner', calldata: [] }),
]);
if (normalizeHex(registryHashAt, 'registry class hash') !== registryClassHash) {
  throw new Error('IdentityRegistry class hash does not match the deployment manifest');
}
if (!accountDeclared) throw new Error('SwapPulseAccount class is not declared on the configured chain');
const registryOwner = ownerResult?.[0] ? normalizeHex(ownerResult[0], 'registry owner') : '';
if (!registryOwner || registryOwner !== expectedRegistryOwner) {
  throw new Error(`IdentityRegistry owner mismatch: expected ${expectedRegistryOwner}, got ${registryOwner || 'unreadable'}`);
}
if (registryAdminAddress !== registryOwner) {
  throw new Error('SWAPPULSE_REGISTRY_ADMIN_ADDRESS is not the current IdentityRegistry owner');
}

const registryAdmin = new Account({ provider, address: registryAdminAddress, signer: registryAdminPrivateKey });
const userPublicKey = normalizeHex(ec.starkCurve.getStarkKey(userPrivateKey), 'user public key');
const accountAddress = normalizeHex(
  hash.calculateContractAddressFromHash(userPublicKey, accountClassHash, [userPublicKey], 0),
  'user account address',
);
const userAccount = new Account({ provider, address: accountAddress, signer: userPrivateKey });

async function rawRpc(method, params) {
  const response = await fetch(rpc, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`Raw RPC HTTP ${response.status}`);
  const payload = await response.json();
  if (payload?.error) throw new Error(`${method} failed: ${JSON.stringify(payload.error)}`);
  return payload?.result;
}

const transactions = {
  account_deploy: '',
  recovery_config: '',
  identity_register: '',
};

let accountDeployed = false;
try {
  const currentAccountHash = normalizeHex(await provider.getClassHashAt(accountAddress), 'deployed account class hash');
  if (currentAccountHash !== accountClassHash) {
    throw new Error(`Address ${accountAddress} is occupied by unexpected class ${currentAccountHash}`);
  }
  accountDeployed = true;
} catch (error) {
  const message = String(error?.message || error);
  if (!/contract|class hash|not found|uninitialized|20/i.test(message)) throw error;
}

if (!accountDeployed) {
  if (!allowDevnetMint) {
    throw new Error('Smart account is not deployed. Set SWAPPULSE_ALLOW_DEVNET_MINT=true for the private Devnet funding path.');
  }
  await rawRpc('devnet_mint', {
    address: accountAddress,
    amount: String(process.env.SWAPPULSE_TEST_ACCOUNT_FUNDING || '100000000000000000000'),
    unit: 'FRI',
  });
  const deployed = await userAccount.deployAccount({
    classHash: accountClassHash,
    constructorCalldata: [userPublicKey],
    addressSalt: userPublicKey,
    contractAddress: accountAddress,
  });
  await wait(provider, deployed.transaction_hash);
  transactions.account_deploy = deployed.transaction_hash || '';
  const deployedHash = normalizeHex(await provider.getClassHashAt(accountAddress), 'deployed account class hash');
  if (deployedHash !== accountClassHash) throw new Error('SwapPulseAccount deployment class hash verification failed');
}

const desiredRecoveryController = String(manifest.recovery_controller || '').trim();
const desiredRecoveryDelay = Number(manifest.recovery_delay_seconds ?? 172800);
if (!Number.isInteger(desiredRecoveryDelay) || desiredRecoveryDelay < 0 || desiredRecoveryDelay > 2_592_000) {
  throw new Error('Manifest recovery delay is invalid');
}

const [controllerRead, delayRead] = await Promise.all([
  provider.callContract({ contractAddress: accountAddress, entrypoint: 'get_recovery_controller', calldata: [] }),
  provider.callContract({ contractAddress: accountAddress, entrypoint: 'get_recovery_delay', calldata: [] }),
]);
const currentController = normalizeHex(controllerRead?.[0] || '0x0', 'current recovery controller');
const currentDelay = Number(BigInt(delayRead?.[0] || '0x0'));
const desiredController = desiredRecoveryController ? normalizeHex(desiredRecoveryController, 'recovery controller') : '0x0';

const recoveryCalls = [];
if (currentController !== desiredController) {
  recoveryCalls.push({
    contractAddress: accountAddress,
    entrypoint: 'set_recovery_controller',
    calldata: [desiredController],
  });
}
if (currentDelay !== desiredRecoveryDelay) {
  recoveryCalls.push({
    contractAddress: accountAddress,
    entrypoint: 'set_recovery_delay',
    calldata: [String(desiredRecoveryDelay)],
  });
}
if (recoveryCalls.length) {
  const recoveryTx = await userAccount.execute(recoveryCalls);
  await wait(provider, recoveryTx.transaction_hash);
  transactions.recovery_config = recoveryTx.transaction_hash || '';
}

const identityRead = await provider.callContract({
  contractAddress: registryAddress,
  entrypoint: 'get_identity',
  calldata: [identityId],
});
const existingAccount = normalizeHex(identityRead?.[0] || '0x0', 'registered account');
const existingStatus = Number(BigInt(identityRead?.[1] || '0x0'));

if (existingStatus === 0) {
  const reverseRead = await provider.callContract({
    contractAddress: registryAddress,
    entrypoint: 'get_identity_by_account',
    calldata: [accountAddress],
  });
  const reverseIdentity = normalizeHex(reverseRead?.[0] || '0x0', 'reverse identity');
  if (reverseIdentity !== '0x0') {
    throw new Error(`Smart account is already bound to identity ${reverseIdentity}`);
  }

  const registered = await registryAdmin.execute({
    contractAddress: registryAddress,
    entrypoint: 'register_identity',
    calldata: [identityId, accountAddress],
  });
  await wait(provider, registered.transaction_hash);
  transactions.identity_register = registered.transaction_hash || '';
} else if (existingStatus === 1) {
  if (existingAccount !== accountAddress) {
    throw new Error(`Identity ${identityId} is already active with a different account ${existingAccount}`);
  }
} else {
  throw new Error(`Identity ${identityId} is not available for provisioning (status ${existingStatus})`);
}

const [finalIdentity, finalReverse, finalControllerRead, finalDelayRead] = await Promise.all([
  provider.callContract({ contractAddress: registryAddress, entrypoint: 'get_identity', calldata: [identityId] }),
  provider.callContract({ contractAddress: registryAddress, entrypoint: 'get_identity_by_account', calldata: [accountAddress] }),
  provider.callContract({ contractAddress: accountAddress, entrypoint: 'get_recovery_controller', calldata: [] }),
  provider.callContract({ contractAddress: accountAddress, entrypoint: 'get_recovery_delay', calldata: [] }),
]);

const finalAccount = normalizeHex(finalIdentity?.[0] || '0x0', 'final identity account');
const finalStatus = Number(BigInt(finalIdentity?.[1] || '0x0'));
const finalCanonical = normalizeHex(finalIdentity?.[2] || '0x0', 'canonical identity');
const finalReverseIdentity = normalizeHex(finalReverse?.[0] || '0x0', 'reverse identity');
const finalController = normalizeHex(finalControllerRead?.[0] || '0x0', 'recovery controller');
const finalDelay = Number(BigInt(finalDelayRead?.[0] || '0x0'));

if (finalAccount !== accountAddress || finalStatus !== 1 || finalCanonical !== identityId || finalReverseIdentity !== identityId) {
  throw new Error('Final IdentityRegistry verification failed');
}
if (finalController !== desiredController || finalDelay !== desiredRecoveryDelay) {
  throw new Error('Final smart-account recovery configuration verification failed');
}

console.log(JSON.stringify({
  ok: true,
  network: manifest.network,
  chain_id: chainId,
  identity_id: identityId,
  public_key: userPublicKey,
  account_address: accountAddress,
  account_class_hash: accountClassHash,
  identity_registry_address: registryAddress,
  identity_registry_owner: registryOwner,
  recovery_controller: finalController,
  recovery_delay_seconds: finalDelay,
  transactions,
  idempotent: !transactions.account_deploy && !transactions.recovery_config && !transactions.identity_register,
  note: 'Public provisioning result only. User and registry-admin private keys were read from process environment and are never printed or written.',
}, null, 2));
