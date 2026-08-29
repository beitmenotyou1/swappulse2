import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
    server.on('error', reject);
  });
}

async function post(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  return { status: response.status, body };
}

const upstreamPort = await freePort();
const gatewayPort = await freePort();
const upstreamUrl = `http://127.0.0.1:${upstreamPort}`;
const gatewayUrl = `http://127.0.0.1:${gatewayPort}/rpc`;
const seen = [];

const upstream = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  seen.push(payload.method);
  let result = null;
  if (payload.method === 'starknet_chainId') result = '0x534e5f5345504f4c4941';
  else if (payload.method === 'starknet_getNonce') result = '0x0';
  else if (payload.method === 'starknet_estimateFee') result = [{ overall_fee: '0x1', unit: 'FRI' }];
  else result = { method: payload.method };
  const body = JSON.stringify({ jsonrpc: '2.0', id: payload.id ?? 1, result });
  res.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
  res.end(body);
});
await new Promise((resolve) => upstream.listen(upstreamPort, '127.0.0.1', resolve));

const child = spawn(process.execPath, ['server.mjs'], {
  cwd: new URL('.', import.meta.url).pathname,
  env: {
    ...process.env,
    UPSTREAM_RPC: upstreamUrl,
    PORT: String(gatewayPort),
    RATE_LIMIT_PER_MINUTE: '100',
  },
  stdio: ['ignore', 'ignore', 'ignore'],
});

async function waitForGateway() {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${gatewayPort}/healthz`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Read-only RPC gateway did not become ready');
}

try {
  await waitForGateway();

  const chainId = await post(gatewayUrl, { jsonrpc: '2.0', id: 1, method: 'starknet_chainId', params: [] });
  if (chainId.status !== 200 || chainId.body?.result !== '0x534e5f5345504f4c4941') throw new Error('starknet_chainId was not forwarded');

  const nonce = await post(gatewayUrl, { jsonrpc: '2.0', id: 2, method: 'starknet_getNonce', params: ['latest', '0x123'] });
  if (nonce.status !== 200 || nonce.body?.result !== '0x0') throw new Error('starknet_getNonce was not forwarded');

  const fee = await post(gatewayUrl, { jsonrpc: '2.0', id: 3, method: 'starknet_estimateFee', params: { request: [], simulation_flags: [], block_id: 'latest' } });
  if (fee.status !== 200 || !Array.isArray(fee.body?.result)) throw new Error('starknet_estimateFee was not forwarded');

  const write = await post(gatewayUrl, { jsonrpc: '2.0', id: 4, method: 'starknet_addInvokeTransaction', params: {} });
  if (write.status !== 403) throw new Error('Write RPC method was not blocked');

  const devnet = await post(gatewayUrl, { jsonrpc: '2.0', id: 5, method: 'devnet_mint', params: {} });
  if (devnet.status !== 403) throw new Error('devnet_* RPC method was not blocked');

  const batch = await post(gatewayUrl, [
    { jsonrpc: '2.0', id: 6, method: 'starknet_chainId', params: [] },
    { jsonrpc: '2.0', id: 7, method: 'starknet_chainId', params: [] },
  ]);
  if (batch.status !== 400) throw new Error('JSON-RPC batch request was not blocked');

  if (seen.includes('starknet_addInvokeTransaction') || seen.some((method) => String(method).startsWith('devnet_'))) {
    throw new Error(`Blocked methods reached upstream: ${seen.join(',')}`);
  }

  console.log(JSON.stringify({
    ok: true,
    chain_id_read_allowed: true,
    nonce_read_allowed: true,
    fee_estimation_allowed: true,
    write_rpc_blocked: true,
    devnet_methods_blocked: true,
    batches_blocked: true,
    upstream_methods: seen,
  }, null, 2));
} finally {
  child.kill('SIGTERM');
  await new Promise((resolve) => child.once('exit', resolve));
  await new Promise((resolve) => upstream.close(resolve));
}
