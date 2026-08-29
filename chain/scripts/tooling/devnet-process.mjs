import net from 'node:net';
import { spawn } from 'node:child_process';

const DEFAULT_DEVNET_BIN = process.env.STARKNET_DEVNET_BIN || 'starknet-devnet';

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close((error) => {
        if (error) reject(error);
        else if (!port) reject(new Error('Could not allocate a devnet port'));
        else resolve(port);
      });
    });
  });
}

export async function rpc(url, method, params = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`Devnet RPC HTTP ${response.status}`);
  const payload = await response.json();
  if (payload?.error) throw new Error(`Devnet RPC ${method} failed: ${JSON.stringify(payload.error)}`);
  return payload?.result;
}

async function waitUntilAlive(url, child) {
  const deadline = Date.now() + 30_000;
  let lastError = null;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`starknet-devnet exited before becoming ready (code ${child.exitCode})`);
    }
    try {
      await rpc(url, 'starknet_chainId', []);
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error(`starknet-devnet did not become ready: ${lastError?.message || 'timeout'}`);
}

export async function spawnDevnet() {
  const port = await getFreePort();
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(DEFAULT_DEVNET_BIN, [
    '--host', '127.0.0.1',
    '--port', String(port),
    '--seed', '0',
    '--chain-id', 'SWAPPULSE_TESTNET',
  ], {
    stdio: ['ignore', 'ignore', 'ignore'],
  });

  child.once('error', (error) => {
    console.error(`Could not start starknet-devnet: ${error.message}`);
  });

  await waitUntilAlive(url, child);

  return {
    url,
    async getPredeployedAccounts() {
      return rpc(url, 'devnet_getPredeployedAccounts', { with_balance: true });
    },
    async mint(address, amount, unit = 'FRI') {
      return rpc(url, 'devnet_mint', {
        address,
        amount: amount.toString(),
        unit,
      });
    },
    async stop() {
      if (child.exitCode !== null) return;
      child.kill('SIGTERM');
      await Promise.race([
        new Promise((resolve) => child.once('exit', resolve)),
        new Promise((resolve) => setTimeout(resolve, 3_000)),
      ]);
      if (child.exitCode === null) child.kill('SIGKILL');
    },
  };
}
