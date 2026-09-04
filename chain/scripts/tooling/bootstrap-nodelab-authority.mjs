import { Account, CallData, cairo, ec, hash } from 'starknet';
import {
  loadArtifacts,
  normalizeHex,
  providerFor,
  declareClass,
  wait,
  requiredEnv,
} from './common.mjs';

const rpc = requiredEnv('SWAPPULSE_RPC_URL');
const expectedChainId = normalizeHex(
  process.env.NODELAB_EXPECTED_CHAIN_ID || '0x5357415050554c53455f4e4f44454c41425f31',
  'expected node-lab chain id',
);
const bootstrapAddress = normalizeHex(requiredEnv('NODELAB_BOOTSTRAP_ADDRESS'), 'bootstrap address');
const bootstrapPrivateKey = normalizeHex(requiredEnv('NODELAB_BOOTSTRAP_PRIVATE_KEY'), 'bootstrap private key');
const deployerPrivateKey = normalizeHex(requiredEnv('NODELAB_DEPLOYER_PRIVATE_KEY'), 'node-lab deployer private key');
const verifierPrivateKey = normalizeHex(requiredEnv('NODELAB_VERIFIER_PRIVATE_KEY'), 'node-lab verifier private key');
const fundingFri = BigInt(process.env.NODELAB_AUTHORITY_FUNDING_FRI || '100000000000000000000');
if (fundingFri <= 0n) throw new Error('NODELAB_AUTHORITY_FUNDING_FRI must be positive');

const STRK_ADDRESS = '0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';

const { provider, rpcUrl } = await providerFor(rpc);
const actualChainId = normalizeHex(await provider.getChainId(), 'node-lab chain id');
if (actualChainId !== expectedChainId) {
  throw new Error(`Refusing bootstrap on wrong chain: expected ${expectedChainId}, got ${actualChainId}`);
}

const loaded = await loadArtifacts();
const bootstrap = new Account({
  provider,
  address: bootstrapAddress,
  signer: bootstrapPrivateKey,
});

// The public Madara devnet account is used only as a one-time bootstrap authority
// to declare SwapPulseAccount and fund the future addresses. It is never the
// owner or verifier in the resulting SwapPulse deployment.
const accountDeclaration = await declareClass(
  bootstrap,
  provider,
  loaded.accountSierra,
  loaded.accountCasm,
);

function accountIdentity(privateKey, label) {
  const publicKey = normalizeHex(ec.starkCurve.getStarkKey(privateKey), `${label} public key`);
  const address = normalizeHex(
    hash.calculateContractAddressFromHash(
      publicKey,
      accountDeclaration.class_hash,
      [publicKey],
      0,
    ),
    `${label} address`,
  );
  return { privateKey, publicKey, address };
}

async function classHashAtOrZero(address) {
  try {
    return normalizeHex(await provider.getClassHashAt(address), 'deployed account class hash');
  } catch (error) {
    const message = String(error?.message || error);
    if (/(contract[^\n]*not found|contract address[^\n]*(not found|unavailable)|uninitialized contract)/i.test(message)) {
      return '0x0';
    }
    throw error;
  }
}

async function fundFutureAddress(address) {
  const tx = await bootstrap.execute({
    contractAddress: STRK_ADDRESS,
    entrypoint: 'transfer',
    calldata: CallData.compile([address, cairo.uint256(fundingFri)]),
  });
  await wait(provider, tx.transaction_hash);
  return tx.transaction_hash || '';
}

async function deployFreshAccount(identity, label) {
  const existing = await classHashAtOrZero(identity.address);
  if (existing !== '0x0') {
    if (existing !== accountDeclaration.class_hash) {
      throw new Error(`${label} address is occupied by unexpected class ${existing}`);
    }
    return { ...identity, funding_tx: '', deploy_tx: '', reused: true };
  }

  const fundingTx = await fundFutureAddress(identity.address);
  const account = new Account({ provider, address: identity.address, signer: identity.privateKey });
  const deployed = await account.deployAccount({
    classHash: accountDeclaration.class_hash,
    constructorCalldata: [identity.publicKey],
    addressSalt: identity.publicKey,
    contractAddress: identity.address,
  });
  await wait(provider, deployed.transaction_hash);

  const deployedHash = await classHashAtOrZero(identity.address);
  if (deployedHash !== accountDeclaration.class_hash) {
    throw new Error(`${label} SwapPulseAccount class hash verification failed`);
  }

  return {
    ...identity,
    funding_tx: fundingTx,
    deploy_tx: deployed.transaction_hash || '',
    reused: false,
  };
}

const deployerIdentity = accountIdentity(deployerPrivateKey, 'deployer');
const verifierIdentity = accountIdentity(verifierPrivateKey, 'verifier');
if (deployerIdentity.address === verifierIdentity.address) {
  throw new Error('Fresh node-lab deployer and verifier addresses must differ');
}
if (deployerIdentity.address === bootstrapAddress || verifierIdentity.address === bootstrapAddress) {
  throw new Error('Fresh node-lab authority must not reuse the public bootstrap address');
}

const deployer = await deployFreshAccount(deployerIdentity, 'deployer');
const verifier = await deployFreshAccount(verifierIdentity, 'verifier');

console.log(JSON.stringify({
  schema_version: 1,
  kind: 'SWAPPULSE_NODELAB_AUTHORITY_BOOTSTRAP',
  ok: true,
  rpc_url: rpcUrl,
  chain_id: actualChainId,
  account_class_hash: accountDeclaration.class_hash,
  deployer_address: deployer.address,
  deployer_public_key: deployer.publicKey,
  verifier_address: verifier.address,
  verifier_public_key: verifier.publicKey,
  transactions: {
    account_declare: accountDeclaration.transaction_hash || '',
    deployer_funding: deployer.funding_tx,
    deployer_deploy: deployer.deploy_tx,
    verifier_funding: verifier.funding_tx,
    verifier_deploy: verifier.deploy_tx,
  },
  note: 'No private key is printed or written. The public Madara devnet fixture is used only for one-time funding/declaration bootstrap.',
}, null, 2));
