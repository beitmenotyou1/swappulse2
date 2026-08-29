import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { hash, transaction } from 'starknet';

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

async function post(url, payload, token = '') {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  return { status: response.status, body };
}

const upstreamPort = await freePort();
const relayPort = await freePort();
const upstreamUrl = `http://127.0.0.1:${upstreamPort}`;
const relayUrl = `http://127.0.0.1:${relayPort}/rpc`;
const token = 'a'.repeat(64);
const accountClassHash = '0x12345';
const publicKey = '0x34567';
const accountAddress = `0x${BigInt(hash.calculateContractAddressFromHash(publicKey, accountClassHash, [publicKey], 0)).toString(16)}`;
const recoveryController = '0x0';
const recoveryDelay = 172800;
const seen = [];

const upstream = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  seen.push(payload.method);
  let result = {};
  if (payload.method === 'devnet_mint') result = { unit: 'FRI' };
  else if (payload.method === 'starknet_getClassHashAt') result = accountClassHash;
  else if (payload.method === 'starknet_addDeployAccountTransaction') result = { transaction_hash: '0xaaa', contract_address: accountAddress };
  else if (payload.method === 'starknet_addInvokeTransaction') result = { transaction_hash: '0xbbb' };
  else result = { ignored: true };
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
    PORT: String(relayPort),
    RELAY_TOKEN: token,
    ACCOUNT_CLASS_HASH: accountClassHash,
    RECOVERY_CONTROLLER: recoveryController,
    RECOVERY_DELAY_SECONDS: String(recoveryDelay),
    DEPLOY_MINT_AMOUNT: '5000000000000000',
    RATE_LIMIT_PER_MINUTE: '100',
  },
  stdio: ['ignore', 'ignore', 'ignore'],
});

async function waitForRelay() {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${relayPort}/healthz`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Relay did not become ready');
}

try {
  await waitForRelay();

  const deployTx = {
    type: 'DEPLOY_ACCOUNT', version: '0x3', signature: ['0x1', '0x2'], paymaster_data: [], tip: '0x0', nonce: '0x0',
    class_hash: accountClassHash, constructor_calldata: [publicKey], contract_address_salt: publicKey,
  };
  const allowedDeploy = await post(relayUrl, {
    jsonrpc: '2.0', id: 1, method: 'starknet_addDeployAccountTransaction', params: { deploy_account_transaction: deployTx },
  }, token);
  if (allowedDeploy.status !== 200 || allowedDeploy.body?.result?.transaction_hash !== '0xaaa') throw new Error('Allowed deploy was not forwarded');

  const badClass = await post(relayUrl, {
    jsonrpc: '2.0', id: 2, method: 'starknet_addDeployAccountTransaction',
    params: { deploy_account_transaction: { ...deployTx, class_hash: '0x999' } },
  }, token);
  if (badClass.status !== 403) throw new Error('Wrong account class was not blocked');

  const expectedCalldata = transaction.getExecuteCalldata([
    { contractAddress: accountAddress, entrypoint: 'set_recovery_controller', calldata: [recoveryController] },
    { contractAddress: accountAddress, entrypoint: 'set_recovery_delay', calldata: [String(recoveryDelay)] },
  ], '1');
  const invokeTx = {
    type: 'INVOKE', version: '0x3', signature: ['0x1', '0x2'], paymaster_data: [], tip: '0x0',
    account_deployment_data: [], sender_address: accountAddress, calldata: expectedCalldata,
  };
  const allowedInvoke = await post(relayUrl, {
    jsonrpc: '2.0', id: 3, method: 'starknet_addInvokeTransaction', params: { invoke_transaction: invokeTx },
  }, token);
  if (allowedInvoke.status !== 200 || allowedInvoke.body?.result?.transaction_hash !== '0xbbb') throw new Error('Allowed recovery invoke was not forwarded');

  const badInvoke = await post(relayUrl, {
    jsonrpc: '2.0', id: 4, method: 'starknet_addInvokeTransaction',
    params: { invoke_transaction: { ...invokeTx, calldata: ['0x1'] } },
  }, token);
  if (badInvoke.status !== 403) throw new Error('Arbitrary invoke was not blocked');

  const devnetMethod = await post(relayUrl, { jsonrpc: '2.0', id: 5, method: 'devnet_mint', params: {} }, token);
  if (devnetMethod.status !== 403) throw new Error('devnet_* method was not blocked');

  const noToken = await post(relayUrl, { jsonrpc: '2.0', id: 6, method: 'starknet_addInvokeTransaction', params: { invoke_transaction: invokeTx } });
  if (noToken.status !== 401) throw new Error('Missing bearer token was not blocked');

  const forwardedWrites = seen.filter((method) => method.startsWith('starknet_add'));
  if (forwardedWrites.join(',') !== 'starknet_addDeployAccountTransaction,starknet_addInvokeTransaction') {
    throw new Error(`Unexpected writes reached upstream: ${forwardedWrites.join(',')}`);
  }

  console.log(JSON.stringify({
    ok: true,
    allowed_deploy: true,
    allowed_recovery_invoke: true,
    wrong_class_blocked: true,
    arbitrary_invoke_blocked: true,
    devnet_method_blocked: true,
    missing_token_blocked: true,
    upstream_write_methods: forwardedWrites,
  }, null, 2));
} finally {
  child.kill('SIGTERM');
  upstream.close();
}
