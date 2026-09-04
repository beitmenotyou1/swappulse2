import path from 'node:path';
import { CallData, byteArray, cairo, hash } from 'starknet';
import {
  chainDir,
  requiredEnv,
  normalizeHex,
  loadArtifacts,
  providerFor,
  accountFor,
  declareClass,
  wait,
  writePublicManifest,
  safeRpcUrl,
} from './common.mjs';

const rpc = requiredEnv('SWAPPULSE_RPC_URL');
const networkName = String(process.env.SWAPPULSE_NETWORK_NAME || 'SWAPPULSE_TESTNET').trim();
if (!/^[A-Z0-9_]{3,64}$/.test(networkName)) throw new Error('SWAPPULSE_NETWORK_NAME must be an uppercase network identifier');
const deployerAddress = requiredEnv('SWAPPULSE_DEPLOYER_ADDRESS');
const deployerPrivateKey = requiredEnv('SWAPPULSE_DEPLOYER_PRIVATE_KEY');
const verifierAddress = normalizeHex(requiredEnv('SWAPPULSE_VERIFIER_ADDRESS'), 'verifier address');
const explicitUdcAddressRaw = String(process.env.SWAPPULSE_UDC_ADDRESS || '').trim();
const explicitUdcAddress = explicitUdcAddressRaw
  ? normalizeHex(explicitUdcAddressRaw, 'explicit UDC address')
  : '';
const explicitUdcEntrypoint = String(process.env.SWAPPULSE_UDC_ENTRYPOINT || 'deployContract').trim();
if (explicitUdcAddress && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(explicitUdcEntrypoint)) {
  throw new Error('SWAPPULSE_UDC_ENTRYPOINT is invalid');
}
const outputFile = path.resolve(
  process.env.SWAPPULSE_DEPLOYMENT_MANIFEST || path.join(chainDir, 'deployments/swappulse-testnet.json'),
);

function bigintEnv(name, fallback, { min = 0n, max = null } = {}) {
  const raw = String(process.env[name] ?? fallback).trim();
  let value;
  try {
    value = BigInt(raw);
  } catch {
    throw new Error(`${name} must be an integer`);
  }
  if (value < min) throw new Error(`${name} must be at least ${min}`);
  if (max != null && value > max) throw new Error(`${name} must not exceed ${max}`);
  return value;
}

function numberEnv(name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  }
  return value;
}

const ONE_SWPX = 10n ** 18n;
const tokenName = String(process.env.SWAPPULSE_TOKEN_NAME || (networkName === 'SWAPPULSE_TESTNET' ? 'SwapPulse Testnet' : 'SwapPulse NodeLab')).trim();
const tokenSymbol = String(process.env.SWAPPULSE_TOKEN_SYMBOL || 'SWPX').trim().toUpperCase();
if (!tokenName) throw new Error('SWAPPULSE_TOKEN_NAME must not be empty');
if (tokenSymbol !== 'SWPX') throw new Error('SWAPPULSE_TOKEN_SYMBOL must be SWPX');
const tokenMaxSupply = bigintEnv('SWAPPULSE_TOKEN_MAX_SUPPLY', 1_000_000_000n * ONE_SWPX, { min: 1n });
const treasuryTargetBalance = bigintEnv('SWAPPULSE_TREASURY_TARGET_BALANCE', 1_000_000n * ONE_SWPX, { min: 0n, max: tokenMaxSupply });
const reputationWeightBps = numberEnv('SWAPPULSE_REPUTATION_WEIGHT_BPS', 1000, { min: 0, max: 2000 });
const minSelfStake = bigintEnv('SWAPPULSE_MIN_SELF_STAKE', 100n * ONE_SWPX, { min: 1n, max: (1n << 128n) - 1n });
const unbondingPeriod = numberEnv('SWAPPULSE_UNBONDING_PERIOD_SECONDS', 86400, { min: 0, max: Number.MAX_SAFE_INTEGER });
const recoveryDelay = numberEnv('SWAPPULSE_RECOVERY_DELAY_SECONDS', 172800, { min: 0, max: 2_592_000 });
const recoveryControllerRaw = String(process.env.SWAPPULSE_RECOVERY_CONTROLLER || '').trim();

const { provider, rpcUrl } = await providerFor(rpc);
const publicRpcUrl = process.env.SWAPPULSE_PUBLIC_RPC_URL
  ? safeRpcUrl(process.env.SWAPPULSE_PUBLIC_RPC_URL)
  : rpcUrl;
const deployer = accountFor(provider, deployerAddress, deployerPrivateKey);
const chainId = normalizeHex(await provider.getChainId(), 'chain id');
const loaded = await loadArtifacts();

console.log(`Deploying SwapPulse Network V2-capable contracts to ${rpcUrl}`);
console.log(`Deployer: ${deployer.address}`);
console.log('Private keys are read only from the process environment and are never written to the manifest.');

const declarationSpecs = [
  ['registry', loaded.registrySierra, loaded.registryCasm],
  ['account', loaded.accountSierra, loaded.accountCasm],
  ['nativeToken', loaded.nativeTokenSierra, loaded.nativeTokenCasm],
  ['cardNft', loaded.cardNftSierra, loaded.cardNftCasm],
  ['usership', loaded.usershipSierra, loaded.usershipCasm],
  ['stakingPool', loaded.stakingPoolSierra, loaded.stakingPoolCasm],
  ['bridgeAdapter', loaded.bridgeAdapterSierra, loaded.bridgeAdapterCasm],
];
const declarations = {};
for (const [key, sierra, casm] of declarationSpecs) {
  declarations[key] = await declareClass(deployer, provider, sierra, casm);
}

async function classHashAtOrZero(address) {
  try {
    return normalizeHex(await provider.getClassHashAt(address), 'deployed class hash');
  } catch (error) {
    const message = String(error?.message || error);
    if (/(contract[^\n]*not found|contract address[^\n]*(not found|unavailable)|uninitialized contract)/i.test(message)) {
      return '0x0';
    }
    throw error;
  }
}

async function deployOrReuse({ label, envName, declaration, constructorCalldata }) {
  const existingRaw = String(process.env[envName] || '').trim();
  if (existingRaw) {
    const address = normalizeHex(existingRaw, `${label} existing address`);
    const actualHash = normalizeHex(await provider.getClassHashAt(address), `${label} class hash`);
    if (actualHash !== declaration.class_hash) {
      throw new Error(`${label} existing class hash mismatch: expected ${declaration.class_hash}, got ${actualHash}`);
    }
    console.log(`Reusing ${label} at ${address}`);
    return { address, transaction_hash: '', reused: true };
  }

  if (explicitUdcAddress) {
    // Madara devnet currently deploys the legacy OpenZeppelin UDC at a different
    // address/entrypoint from starknet.js 10's default UDC. Use an explicit,
    // deterministic non-unique UDC deployment for node-lab compatibility.
    // With unique=0 the contract address is calculated with deployer_address=0.
    const salt = declaration.class_hash;
    const calldata = Array.from(constructorCalldata || [], (value) => String(value));
    const address = normalizeHex(
      hash.calculateContractAddressFromHash(
        salt,
        declaration.class_hash,
        calldata,
        0,
      ),
      `${label} deterministic address`,
    );
    const before = await classHashAtOrZero(address);
    if (before !== '0x0') {
      if (before !== declaration.class_hash) {
        throw new Error(`${label} deterministic address ${address} is occupied by unexpected class ${before}`);
      }
      console.log(`Reusing ${label} at deterministic UDC address ${address}`);
      return { address, transaction_hash: '', reused: true };
    }

    const udcClassHash = await classHashAtOrZero(explicitUdcAddress);
    if (udcClassHash === '0x0') {
      throw new Error(`Configured UDC ${explicitUdcAddress} is not deployed`);
    }
    const deployed = await deployer.execute({
      contractAddress: explicitUdcAddress,
      entrypoint: explicitUdcEntrypoint,
      calldata: [
        declaration.class_hash,
        salt,
        '0x0',
        String(calldata.length),
        ...calldata,
      ],
    });
    await wait(provider, deployed.transaction_hash);
    const actualHash = await classHashAtOrZero(address);
    if (actualHash !== declaration.class_hash) {
      throw new Error(`${label} class hash verification failed after explicit UDC deployment`);
    }
    console.log(`${label} deployed via explicit UDC: ${address}`);
    return { address, transaction_hash: deployed.transaction_hash || '', reused: false };
  }

  const deployed = await deployer.deployContract({
    classHash: declaration.class_hash,
    constructorCalldata,
  });
  await wait(provider, deployed.transaction_hash);
  const address = normalizeHex(deployed.contract_address, `${label} address`);
  const actualHash = normalizeHex(await provider.getClassHashAt(address), `${label} class hash`);
  if (actualHash !== declaration.class_hash) throw new Error(`${label} class hash verification failed after deployment`);
  console.log(`${label} deployed: ${address}`);
  return { address, transaction_hash: deployed.transaction_hash || '', reused: false };
}

const registry = await deployOrReuse({
  label: 'IdentityRegistry',
  envName: 'SWAPPULSE_EXISTING_REGISTRY_ADDRESS',
  declaration: declarations.registry,
  constructorCalldata: [deployer.address],
});

const ownerResult = await provider.callContract({ contractAddress: registry.address, entrypoint: 'owner', calldata: [] });
const registryOwner = ownerResult?.[0] ? normalizeHex(ownerResult[0], 'registry owner') : '';
if (!registryOwner) throw new Error('Could not read IdentityRegistry owner after deployment');
if (normalizeHex(deployer.address, 'deployer address') !== registryOwner) {
  throw new Error('SWAPPULSE_DEPLOYER_ADDRESS must be the IdentityRegistry owner');
}
if (verifierAddress === registryOwner) throw new Error('SWAPPULSE_VERIFIER_ADDRESS must be separate from the IdentityRegistry owner');

let verifierAuthoriseTx = '';
const verifierState = await provider.callContract({
  contractAddress: registry.address,
  entrypoint: 'is_verifier',
  calldata: [verifierAddress],
});
if (BigInt(verifierState?.[0] || '0x0') !== 1n) {
  const authorised = await deployer.execute({
    contractAddress: registry.address,
    entrypoint: 'set_verifier',
    calldata: [verifierAddress, '0x1'],
  });
  await wait(provider, authorised.transaction_hash);
  verifierAuthoriseTx = authorised.transaction_hash || '';
}
const verifiedVerifierState = await provider.callContract({
  contractAddress: registry.address,
  entrypoint: 'is_verifier',
  calldata: [verifierAddress],
});
if (BigInt(verifiedVerifierState?.[0] || '0x0') !== 1n) throw new Error('Identity verifier authorisation is not visible on-chain');

const nativeToken = await deployOrReuse({
  label: 'NativeToken',
  envName: 'SWAPPULSE_EXISTING_NATIVE_TOKEN_ADDRESS',
  declaration: declarations.nativeToken,
  constructorCalldata: CallData.compile([
    deployer.address,
    byteArray.byteArrayFromString(tokenName),
    byteArray.byteArrayFromString(tokenSymbol),
    cairo.uint256(tokenMaxSupply),
  ]),
});

const cardNft = await deployOrReuse({
  label: 'CardNft',
  envName: 'SWAPPULSE_EXISTING_CARD_NFT_ADDRESS',
  declaration: declarations.cardNft,
  constructorCalldata: [deployer.address],
});

const usership = await deployOrReuse({
  label: 'ProofOfUsership',
  envName: 'SWAPPULSE_EXISTING_USERSHIP_ADDRESS',
  declaration: declarations.usership,
  constructorCalldata: [deployer.address, String(reputationWeightBps)],
});

const stakingPool = await deployOrReuse({
  label: 'StakingPool',
  envName: 'SWAPPULSE_EXISTING_STAKING_POOL_ADDRESS',
  declaration: declarations.stakingPool,
  constructorCalldata: [
    deployer.address,
    nativeToken.address,
    registry.address,
    usership.address,
    minSelfStake.toString(),
    String(unbondingPeriod),
  ],
});

const bridgeAdapter = await deployOrReuse({
  label: 'BridgeAdapter',
  envName: 'SWAPPULSE_EXISTING_BRIDGE_ADAPTER_ADDRESS',
  declaration: declarations.bridgeAdapter,
  constructorCalldata: [deployer.address, nativeToken.address, cardNft.address],
});

let bridgeMinterTx = '';
const bridgeMinterState = await provider.callContract({
  contractAddress: nativeToken.address,
  entrypoint: 'is_minter',
  calldata: [bridgeAdapter.address],
});
if (BigInt(bridgeMinterState?.[0] || '0x0') !== 1n) {
  const tx = await deployer.execute({
    contractAddress: nativeToken.address,
    entrypoint: 'set_minter',
    calldata: [bridgeAdapter.address, '0x1'],
  });
  await wait(provider, tx.transaction_hash);
  bridgeMinterTx = tx.transaction_hash || '';
}

let cardBridgeTx = '';
const cardBridgeState = await provider.callContract({
  contractAddress: cardNft.address,
  entrypoint: 'bridge',
  calldata: [],
});
const configuredCardBridge = normalizeHex(cardBridgeState?.[0] || '0x0', 'CardNft bridge');
if (configuredCardBridge !== bridgeAdapter.address) {
  const tx = await deployer.execute({
    contractAddress: cardNft.address,
    entrypoint: 'set_bridge',
    calldata: [bridgeAdapter.address],
  });
  await wait(provider, tx.transaction_hash);
  cardBridgeTx = tx.transaction_hash || '';
}

function u256FromResult(result, label) {
  if (!Array.isArray(result) || result.length < 2) throw new Error(`${label} did not return u256`);
  return BigInt(result[0] || '0') + (BigInt(result[1] || '0') << 128n);
}

let treasuryMintTx = '';
if (treasuryTargetBalance > 0n) {
  const balance = u256FromResult(await provider.callContract({
    contractAddress: nativeToken.address,
    entrypoint: 'balance_of',
    calldata: [deployer.address],
  }), 'NativeToken.balance_of');
  if (balance < treasuryTargetBalance) {
    const topUp = treasuryTargetBalance - balance;
    const tx = await deployer.execute({
      contractAddress: nativeToken.address,
      entrypoint: 'mint',
      calldata: CallData.compile([deployer.address, cairo.uint256(topUp)]),
    });
    await wait(provider, tx.transaction_hash);
    treasuryMintTx = tx.transaction_hash || '';
  }
}

const recoveryController = recoveryControllerRaw
  ? normalizeHex(recoveryControllerRaw, 'recovery controller')
  : normalizeHex(deployer.address, 'default recovery controller');

const manifest = {
  schema_version: 2,
  network: networkName,
  chain_id: chainId,
  rpc_url: publicRpcUrl,
  account_class_hash: declarations.account.class_hash,
  identity_registry_class_hash: declarations.registry.class_hash,
  identity_registry_address: registry.address,
  identity_registry_owner: registryOwner,
  identity_verifier_address: verifierAddress,
  identity_verification_mode: 'V2',
  recovery_controller: recoveryController,
  recovery_delay_seconds: recoveryDelay,
  native_token_address: nativeToken.address,
  native_token_class_hash: declarations.nativeToken.class_hash,
  native_token_symbol: tokenSymbol,
  card_nft_address: cardNft.address,
  card_nft_class_hash: declarations.cardNft.class_hash,
  usership_address: usership.address,
  usership_class_hash: declarations.usership.class_hash,
  staking_pool_address: stakingPool.address,
  staking_pool_class_hash: declarations.stakingPool.class_hash,
  bridge_adapter_address: bridgeAdapter.address,
  bridge_adapter_class_hash: declarations.bridgeAdapter.class_hash,
  staking: {
    min_self_stake: minSelfStake.toString(),
    unbonding_period_seconds: unbondingPeriod,
    reputation_weight_bps: reputationWeightBps,
  },
  token: {
    name: tokenName,
    symbol: tokenSymbol,
    max_supply: tokenMaxSupply.toString(),
    treasury_target_balance: treasuryTargetBalance.toString(),
  },
  bridge: {
    external_chains_enabled: false,
  },
  deployment: {
    deployer_address: normalizeHex(deployer.address),
    identity_registry_declare_tx: declarations.registry.transaction_hash,
    account_declare_tx: declarations.account.transaction_hash,
    native_token_declare_tx: declarations.nativeToken.transaction_hash,
    card_nft_declare_tx: declarations.cardNft.transaction_hash,
    usership_declare_tx: declarations.usership.transaction_hash,
    staking_pool_declare_tx: declarations.stakingPool.transaction_hash,
    bridge_adapter_declare_tx: declarations.bridgeAdapter.transaction_hash,
    identity_registry_deploy_tx: registry.transaction_hash,
    native_token_deploy_tx: nativeToken.transaction_hash,
    card_nft_deploy_tx: cardNft.transaction_hash,
    usership_deploy_tx: usership.transaction_hash,
    staking_pool_deploy_tx: stakingPool.transaction_hash,
    bridge_adapter_deploy_tx: bridgeAdapter.transaction_hash,
    identity_verifier_authorise_tx: verifierAuthoriseTx,
    bridge_token_minter_authorise_tx: bridgeMinterTx,
    card_nft_bridge_configure_tx: cardBridgeTx,
    treasury_mint_tx: treasuryMintTx,
  },
  generated_at: new Date().toISOString(),
};

await writePublicManifest(outputFile, manifest);
console.log(`Public schema-v2 deployment manifest written to ${outputFile}`);
console.log(JSON.stringify(manifest, null, 2));
