import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Account, RpcProvider, hash } from 'starknet';

const here = path.dirname(fileURLToPath(import.meta.url));
export const chainDir = path.resolve(here, '../..');
export const targetDir = path.join(chainDir, 'target/dev');

export const artifacts = {
  registrySierra: path.join(targetDir, 'swappulse_network_IdentityRegistry.contract_class.json'),
  registryCasm: path.join(targetDir, 'swappulse_network_IdentityRegistry.casm.json'),
  accountSierra: path.join(targetDir, 'swappulse_network_SwapPulseAccount.contract_class.json'),
  accountCasm: path.join(targetDir, 'swappulse_network_SwapPulseAccount.casm.json'),
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

export async function loadArtifacts() {
  const [registrySierra, registryCasm, accountSierra, accountCasm] = await Promise.all([
    readJson(artifacts.registrySierra),
    readJson(artifacts.registryCasm),
    readJson(artifacts.accountSierra),
    readJson(artifacts.accountCasm),
  ]);
  return { registrySierra, registryCasm, accountSierra, accountCasm };
}

export function publicClassHashes(loaded) {
  return {
    identity_registry_class_hash: normalizeHex(hash.computeSierraContractClassHash(loaded.registrySierra)),
    account_class_hash: normalizeHex(hash.computeSierraContractClassHash(loaded.accountSierra)),
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
  const result = await account.declare({ contract, casm });
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
