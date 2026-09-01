import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Account, RpcProvider, hash } from 'starknet';

const here = path.dirname(fileURLToPath(import.meta.url));
export const chainDir = path.resolve(here, '../..');
export const targetDir = path.join(chainDir, 'target/dev');

export const artifacts = {
  manifest: path.join(targetDir, 'swappulse_network.starknet_artifacts.json'),
  registrySierra: path.join(targetDir, 'swappulse_network_IdentityRegistry.contract_class.json'),
  registryCasm: path.join(targetDir, 'swappulse_network_IdentityRegistry.compiled_contract_class.json'),
  accountSierra: path.join(targetDir, 'swappulse_network_SwapPulseAccount.contract_class.json'),
  accountCasm: path.join(targetDir, 'swappulse_network_SwapPulseAccount.compiled_contract_class.json'),
};

const contractKeys = {
  IdentityRegistry: 'registry',
  SwapPulseAccount: 'account',
  NativeToken: 'nativeToken',
  CardNft: 'cardNft',
  ProofOfUsership: 'usership',
  StakingPool: 'stakingPool',
  BridgeAdapter: 'bridgeAdapter',
};

export function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

export function normalizeHex(value, label = 'hex value') {
  const raw = String(value || '').trim().toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(raw)) throw new Error(`${label} must be 0x-prefixed hex`);
  return `0x${BigInt(raw).toString(16)}`;
}

export function safeRpcUrl(raw) {
  const url = new URL(raw);
  if (url.username || url.password) throw new Error('RPC URL must not contain embedded credentials');
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new Error('Persistent RPC URL must use HTTPS (HTTP is allowed only for localhost/devnet)');
  }
  return url.toString();
}

export async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function firstExisting(paths) {
  for (const candidate of paths) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next compatibility name.
    }
  }
  return '';
}

export async function loadArtifacts() {
  const manifest = await readJson(artifacts.manifest);
  if (!Array.isArray(manifest?.contracts)) throw new Error('Scarb Starknet artifact manifest is invalid');

  const loaded = {};
  for (const [contractName, key] of Object.entries(contractKeys)) {
    const entry = manifest.contracts.find((row) => row?.contract_name === contractName);
    if (!entry?.artifacts?.sierra) throw new Error(`Missing Sierra artifact for ${contractName}`);
    const sierraPath = path.join(targetDir, entry.artifacts.sierra);
    const pinnedCasmPath = path.join(targetDir, `swappulse_network_${contractName}.casm.json`);
    let casmPath = '';
    if (process.env.SWAPPULSE_PINNED_CASM === '1') {
      casmPath = await firstExisting([pinnedCasmPath]);
    } else {
      casmPath = await firstExisting([
        entry?.artifacts?.casm ? path.join(targetDir, entry.artifacts.casm) : '',
        path.join(targetDir, `swappulse_network_${contractName}.compiled_contract_class.json`),
        pinnedCasmPath,
      ].filter(Boolean));
    }
    if (!casmPath) {
      throw new Error(`Missing CASM artifact for ${contractName}. Run scarb build with casm = true before deployment.`);
    }
    loaded[`${key}Sierra`] = await readJson(sierraPath);
    loaded[`${key}Casm`] = await readJson(casmPath);
  }
  return loaded;
}

export function publicClassHashes(loaded) {
  return {
    identity_registry_class_hash: normalizeHex(hash.computeSierraContractClassHash(loaded.registrySierra)),
    account_class_hash: normalizeHex(hash.computeSierraContractClassHash(loaded.accountSierra)),
    native_token_class_hash: normalizeHex(hash.computeSierraContractClassHash(loaded.nativeTokenSierra)),
    card_nft_class_hash: normalizeHex(hash.computeSierraContractClassHash(loaded.cardNftSierra)),
    usership_class_hash: normalizeHex(hash.computeSierraContractClassHash(loaded.usershipSierra)),
    staking_pool_class_hash: normalizeHex(hash.computeSierraContractClassHash(loaded.stakingPoolSierra)),
    bridge_adapter_class_hash: normalizeHex(hash.computeSierraContractClassHash(loaded.bridgeAdapterSierra)),
  };
}

export async function providerFor(rawUrl) {
  const rpcUrl = safeRpcUrl(rawUrl);
  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  await provider.getChainId();
  return { provider, rpcUrl };
}

export function accountFor(provider, address, privateKey) {
  return new Account({
    provider,
    address: normalizeHex(address, 'deployer address'),
    signer: normalizeHex(privateKey, 'deployer private key'),
  });
}

export async function wait(provider, txHash) {
  if (!txHash) return null;
  return provider.waitForTransaction(txHash);
}

export async function declareClass(account, provider, contract, casm) {
  const classHash = normalizeHex(hash.computeSierraContractClassHash(contract));
  if (await provider.isClassDeclared({ classHash })) {
    return { class_hash: classHash, transaction_hash: '', already_declared: true };
  }

  const starknetVersion = await provider.channel.getStarknetVersion();
  const compiledClassHash = normalizeHex(hash.computeCompiledClassHash(casm, starknetVersion));
  console.log(
    `Declaring class ${classHash} on Starknet ${starknetVersion} with compiled class hash ${compiledClassHash}`,
  );

  let result;
  try {
    result = await account.declare({ contract, casm, compiledClassHash });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const mismatch = message.match(/Mismatch compiled class hash[^\n]*/i)?.[0];
    throw new Error(
      `Class declaration failed for ${classHash} using compiled class hash ${compiledClassHash}: ${mismatch || message.split('\n')[0]}`,
    );
  }

  await wait(provider, result.transaction_hash);
  return {
    class_hash: normalizeHex(result.class_hash || classHash),
    transaction_hash: result.transaction_hash || '',
    already_declared: false,
  };
}

export async function writePublicManifest(file, manifest) {
  const cleaned = JSON.parse(JSON.stringify(manifest));
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(cleaned, null, 2)}\n`, { mode: 0o644 });
}
