import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { spawnDevnet } from './devnet-process.mjs';

function runNode(script, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
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
      if (code !== 0) return reject(new Error(`${script} failed (${code})\n${stdout}\n${stderr}`));
      resolve({ stdout, stderr });
    });
  });
}

const devnet = await spawnDevnet();
const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'swappulse-network-smoke-'));
const manifest = path.join(tmpDir, 'deployment.json');
try {
  const [admin] = await devnet.getPredeployedAccounts();
  if (!admin) throw new Error('No predeployed devnet admin');

  const deployment = await runNode('./deploy-network.mjs', [], {
    SWAPPULSE_RPC_URL: devnet.url,
    SWAPPULSE_DEPLOYER_ADDRESS: admin.address,
    SWAPPULSE_DEPLOYER_PRIVATE_KEY: admin.private_key,
    SWAPPULSE_DEPLOYMENT_MANIFEST: manifest,
    SWAPPULSE_RECOVERY_CONTROLLER: admin.address,
    SWAPPULSE_RECOVERY_DELAY_SECONDS: '172800',
  });
  const verification = await runNode('./verify-network.mjs', [manifest], {});
  const publicManifest = JSON.parse(await fs.readFile(manifest, 'utf8'));

  if (publicManifest.deployment?.deployer_private_key) {
    throw new Error('Public deployment manifest unexpectedly contains a private key');
  }

  console.log(JSON.stringify({
    ok: true,
    deployment_manifest: publicManifest,
    verify_output: JSON.parse(verification.stdout),
    deploy_log_contains_private_key: deployment.stdout.includes(admin.private_key),
  }, null, 2));
} finally {
  await devnet.stop();
  await fs.rm(tmpDir, { recursive: true, force: true });
}
