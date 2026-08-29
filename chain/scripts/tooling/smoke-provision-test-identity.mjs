import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { ec } from 'starknet';
import { spawnDevnet } from './devnet-process.mjs';

function runNode(script, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd: path.dirname(new URL(import.meta.url).pathname),
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`${script} failed (${code})\n${stderr || stdout}`));
      resolve({ stdout, stderr });
    });
  });
}

const devnet = await spawnDevnet();
const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'swappulse-identity-smoke-'));
try {
  const [admin] = await devnet.getPredeployedAccounts();
  if (!admin) throw new Error('No predeployed devnet admin');

  const manifest = path.join(tmpDir, 'network.json');
  await runNode('./deploy-network.mjs', {
    SWAPPULSE_RPC_URL: devnet.url,
    SWAPPULSE_DEPLOYER_ADDRESS: admin.address,
    SWAPPULSE_DEPLOYER_PRIVATE_KEY: admin.private_key,
    SWAPPULSE_RECOVERY_CONTROLLER: admin.address,
    SWAPPULSE_RECOVERY_DELAY_SECONDS: '172800',
    SWAPPULSE_DEPLOYMENT_MANIFEST: manifest,
  });

  const userPrivateKey = `0x${Buffer.from(ec.starkCurve.utils.randomPrivateKey()).toString('hex')}`;
  const commonEnv = {
    SWAPPULSE_DEPLOYMENT_MANIFEST: manifest,
    SWAPPULSE_RAW_RPC_URL: devnet.url,
    SWAPPULSE_REGISTRY_ADMIN_ADDRESS: admin.address,
    SWAPPULSE_REGISTRY_ADMIN_PRIVATE_KEY: admin.private_key,
    SWAPPULSE_USER_PRIVATE_KEY: userPrivateKey,
    SWAPPULSE_IDENTITY_ID: '0xabc12345',
    SWAPPULSE_ALLOW_DEVNET_MINT: 'true',
  };

  const firstRun = await runNode('./provision-test-identity.mjs', commonEnv);
  const secondRun = await runNode('./provision-test-identity.mjs', commonEnv);
  const first = JSON.parse(firstRun.stdout);
  const second = JSON.parse(secondRun.stdout);

  if (!first.ok || !second.ok) throw new Error('Provisioning did not return ok');
  if (first.schema_version !== 1 || second.schema_version !== 1) throw new Error('Provisioning result schema version mismatch');
  if (first.kind !== 'SWAPPULSE_TEST_IDENTITY_PROVISIONING_RESULT' || second.kind !== 'SWAPPULSE_TEST_IDENTITY_PROVISIONING_RESULT') {
    throw new Error('Provisioning result kind mismatch');
  }
  if (first.identity_id !== second.identity_id || first.account_address !== second.account_address || first.public_key !== second.public_key) {
    throw new Error('Idempotent provisioning returned different public identity data');
  }
  if (second.idempotent !== true) throw new Error('Second provisioning run was not idempotent');

  const combinedOutput = firstRun.stdout + firstRun.stderr + secondRun.stdout + secondRun.stderr;
  if (combinedOutput.includes(userPrivateKey) || combinedOutput.includes(admin.private_key)) {
    throw new Error('Private key appeared in provisioning output');
  }

  console.log(JSON.stringify({
    ok: true,
    schema_version: first.schema_version,
    kind: first.kind,
    identity_id: first.identity_id,
    account_address: first.account_address,
    public_key: first.public_key,
    first_transactions: first.transactions,
    second_transactions: second.transactions,
    second_run_idempotent: second.idempotent,
    private_key_leak: false,
  }, null, 2));
} finally {
  await devnet.stop();
  await fs.rm(tmpDir, { recursive: true, force: true });
}
