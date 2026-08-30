import http from 'node:http';
import { spawn } from 'node:child_process';
import { hash, transaction } from 'starknet';

const upstreamPort = 19050;
const relayPort = 18081;
const token = 'test-only-relay-token-0123456789abcdef';
const chainId = '0x534e5f5345504f4c4941';
const classHash = '0x492c4b3e137468b6f6a805970d2c28b44f11bfd9f3cc6bd3187db5d83cb0a1c';
const registryClassHash = '0x23456';
const registryAddress = '0x45678';
const registryOwner = '0x56789';
const publicKey = '0x123456789abcdef';
const recoveryController = '0x0';
const recoveryDelay = 172800;
const expectedAddress = `0x${BigInt(hash.calculateContractAddressFromHash(publicKey, classHash, [publicKey], 0)).toString(16)}`;
const observed = { mint: null, methods: [] };

function startMock() {
  const server = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const payload = JSON.parse(raw || '{}');
    observed.methods.push(payload.method);
    let result = {};
    if (payload.method === 'devnet_mint') {
      observed.mint = payload.params;
      result = { new_balance: '0x1', unit: 'FRI', tx_hash: '0x111' };
    } else if (payload.method === 'starknet_chainId') {
      result = chainId;
    } else if (payload.method === 'starknet_getClass') {
      result = { sierra_program: ['0x1'], contract_class_version: '0.1.0', entry_points_by_type: {}, abi: [] };
    } else if (payload.method === 'starknet_getClassHashAt') {
      const address = Array.isArray(payload.params) ? payload.params[1] : '';
      result = address === registryAddress ? registryClassHash : classHash;
    } else if (payload.method === 'starknet_call') {
      result = [registryOwner];
    } else if (payload.method === 'starknet_addDeployAccountTransaction') {
      result = { transaction_hash: '0x222', contract_address: expectedAddress };
    } else if (payload.method === 'starknet_addInvokeTransaction') {
      result = { transaction_hash: '0x333' };
    } else {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ jsonrpc: '2.0', id: payload.id, error: { code: -32601, message: 'mock method not found' } }));
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ jsonrpc: '2.0', id: payload.id, result }));
  });
  return new Promise((resolve) => server.listen(upstreamPort, '127.0.0.1', () => resolve(server)));
}

async function request(body, authorized = true) {
  const response = await fetch(`http://127.0.0.1:${relayPort}/rpc`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authorized ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function waitForRelay(child) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`relay exited early with ${child.exitCode}`);
    try {
      const response = await fetch(`http://127.0.0.1:${relayPort}/healthz`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('relay did not become ready');
}

const mock = await startMock();
const relay = spawn(process.execPath, ['server.mjs'], {
  cwd: new URL('.', import.meta.url),
  env: {
    ...process.env,
    UPSTREAM_RPC: `http://127.0.0.1:${upstreamPort}`,
    PORT: String(relayPort),
    RELAY_TOKEN: token,
    CHAIN_ID: chainId,
    ACCOUNT_CLASS_HASH: classHash,
    IDENTITY_REGISTRY_CLASS_HASH: registryClassHash,
    IDENTITY_REGISTRY_ADDRESS: registryAddress,
    IDENTITY_REGISTRY_OWNER: registryOwner,
    REGISTRY_ADMIN_ADDRESS: registryOwner,
    REGISTRY_ADMIN_PRIVATE_KEY: '0x1',
    RECOVERY_CONTROLLER: recoveryController,
    RECOVERY_DELAY_SECONDS: String(recoveryDelay),
    DEPLOY_MINT_AMOUNT: '5000000000000000',
    RATE_LIMIT_PER_MINUTE: '100',
  },
  stdio: ['ignore', 'ignore', 'ignore'],
});

try {
  await waitForRelay(relay);

  const unauthorized = await request({ jsonrpc: '2.0', id: 1, method: 'starknet_addDeployAccountTransaction', params: {} }, false);
  if (unauthorized.status !== 401) throw new Error(`expected 401, got ${unauthorized.status}`);

  const forbiddenMethod = await request({ jsonrpc: '2.0', id: 2, method: 'devnet_mint', params: { address: publicKey, amount: 1 } });
  if (forbiddenMethod.status !== 403) throw new Error(`expected devnet_* 403, got ${forbiddenMethod.status}`);

  const deployTx = {
    type: 'DEPLOY_ACCOUNT', version: '0x3', signature: ['0x1', '0x2'], nonce: '0x0',
    class_hash: classHash, contract_address_salt: publicKey, constructor_calldata: [publicKey],
    resource_bounds: {}, tip: '0x0', paymaster_data: [],
    nonce_data_availability_mode: 'L1', fee_data_availability_mode: 'L1',
  };
  const deploy = await request({ jsonrpc: '2.0', id: 3, method: 'starknet_addDeployAccountTransaction', params: { deploy_account_transaction: deployTx } });
  if (deploy.status !== 200 || deploy.body?.result?.transaction_hash !== '0x222') throw new Error('valid deploy was not forwarded');
  if (observed.mint?.address !== expectedAddress) throw new Error('mint recipient was not the deterministic account address');
  if (observed.mint?.amount !== 5000000000000000) throw new Error('mint amount was not fixed');

  const wrongClass = await request({ jsonrpc: '2.0', id: 4, method: 'starknet_addDeployAccountTransaction', params: { deploy_account_transaction: { ...deployTx, class_hash: '0x123' } } });
  if (wrongClass.status !== 403) throw new Error('wrong account class was not rejected');

  const recoveryCalldata = transaction.getExecuteCalldata([
    { contractAddress: expectedAddress, entrypoint: 'set_recovery_controller', calldata: [recoveryController] },
    { contractAddress: expectedAddress, entrypoint: 'set_recovery_delay', calldata: [String(recoveryDelay)] },
  ], '1');
  const invokeTx = {
    type: 'INVOKE', version: '0x3', signature: ['0x3', '0x4'], nonce: '0x0',
    sender_address: expectedAddress, calldata: recoveryCalldata, resource_bounds: {},
    tip: '0x0', paymaster_data: [], account_deployment_data: [],
    nonce_data_availability_mode: 'L1', fee_data_availability_mode: 'L1',
  };
  const invoke = await request({ jsonrpc: '2.0', id: 5, method: 'starknet_addInvokeTransaction', params: { invoke_transaction: invokeTx } });
  if (invoke.status !== 200 || invoke.body?.result?.transaction_hash !== '0x333') throw new Error(`valid recovery invoke was not forwarded: ${JSON.stringify(invoke)}`);

  const wrongCall = await request({ jsonrpc: '2.0', id: 6, method: 'starknet_addInvokeTransaction', params: { invoke_transaction: { ...invokeTx, calldata: ['0x1'] } } });
  if (wrongCall.status !== 403) throw new Error('arbitrary invoke calldata was not rejected');

  console.log(JSON.stringify({
    ok: true,
    unauthorized_blocked: true,
    devnet_methods_blocked: true,
    deterministic_mint_only: true,
    wrong_class_blocked: true,
    recovery_only_invoke: true,
    forwarded_methods: observed.methods,
  }, null, 2));
} finally {
  relay.kill('SIGTERM');
  mock.close();
}
