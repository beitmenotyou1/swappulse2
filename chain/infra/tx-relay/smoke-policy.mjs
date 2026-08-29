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
const relayBaseUrl = `http://127.0.0.1:${relayPort}`;
const relayUrl = `${relayBaseUrl}/rpc`;
const registerUrl = `${relayBaseUrl}/register`;
const token = 'a'.repeat(64);
const accountClassHash = '0x12345';
const registryClassHash = '0x23456';
const registryAddress = '0x45678';
const registryOwner = '0x56789';
const identityId = '0x6789a';
const publicKey = '0x34567';
const accountAddress = `0x${BigInt(hash.calculateContractAddressFromHash(publicKey, accountClassHash, [publicKey], 0)).toString(16)}`;
const recoveryController = '0x0';
const recoveryDelay = 172800;
const seen = [];
const ownerSelector = hash.getSelectorFromName('owner');
const getIdentitySelector = hash.getSelectorFromName('get_identity');
const reverseSelector = hash.getSelectorFromName('get_identity_by_account');
const recoveryControllerSelector = hash.getSelectorFromName('get_recovery_controller');
const recoveryDelaySelector = hash.getSelectorFromName('get_recovery_delay');
let mockIdentityStatus = 1;
let mockReverseIdentity = identityId;
let mockRecoveryController = recoveryController;
let mockRecoveryDelay = recoveryDelay;
let registrationMode = false;
let ownerKeyRequested = false;

const upstream = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  seen.push(payload.method);
  let result = {};
  if (payload.method === 'devnet_mint') result = { unit: 'FRI' };
  else if (payload.method === 'starknet_getClassHashAt') {
    const address = Array.isArray(payload.params) ? payload.params[1] : '';
    result = address === registryAddress ? registryClassHash : accountClassHash;
  }
  else if (payload.method === 'starknet_call') {
    const call = Array.isArray(payload.params) ? payload.params[0] : {};
    const selector = call?.entry_point_selector;
    if (selector === ownerSelector) result = [registryOwner];
    else if (selector === getIdentitySelector) result = mockIdentityStatus === 0
      ? ['0x0', '0x0', '0x0', '0x0', '0x0']
      : [accountAddress, '0x1', identityId, '0x1', '0x0'];
    else if (selector === reverseSelector) result = [mockReverseIdentity];
    else if (selector === recoveryControllerSelector) result = [mockRecoveryController];
    else if (selector === recoveryDelaySelector) result = [`0x${BigInt(mockRecoveryDelay).toString(16)}`];
    else result = ['0x0'];
  }
  else if (payload.method === 'devnet_getPredeployedAccounts') {
    ownerKeyRequested = true;
    result = [{ address: registryOwner, private_key: '0x1' }];
  }
  else if (payload.method === 'starknet_specVersion') result = '0.9.0';
  else if (payload.method === 'starknet_chainId') result = '0x534e5f5345504f4c4941';
  else if (payload.method === 'starknet_getNonce') result = '0x0';
  else if (payload.method === 'starknet_estimateFee') result = [{
    l1_gas_consumed: '0x1', l1_gas_price: '0x1',
    l1_data_gas_consumed: '0x1', l1_data_gas_price: '0x1',
    l2_gas_consumed: '0x1', l2_gas_price: '0x1',
    overall_fee: '0x3', unit: 'FRI',
  }];
  else if (payload.method === 'starknet_addDeployAccountTransaction') result = { transaction_hash: '0xaaa', contract_address: accountAddress };
  else if (payload.method === 'starknet_addInvokeTransaction') {
    if (registrationMode) {
      mockIdentityStatus = 1;
      mockReverseIdentity = identityId;
      result = { transaction_hash: '0xccc' };
    } else result = { transaction_hash: '0xbbb' };
  }
  else if (payload.method === 'starknet_getTransactionReceipt') result = {
    type: 'INVOKE', transaction_hash: '0xccc', actual_fee: { amount: '0x1', unit: 'FRI' },
    execution_status: 'SUCCEEDED', finality_status: 'ACCEPTED_ON_L2', events: [], messages_sent: [],
  };
  else if (payload.method === 'starknet_getTransactionStatus') result = { finality_status: 'ACCEPTED_ON_L2', execution_status: 'SUCCEEDED' };
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
    IDENTITY_REGISTRY_CLASS_HASH: registryClassHash,
    IDENTITY_REGISTRY_ADDRESS: registryAddress,
    IDENTITY_REGISTRY_OWNER: registryOwner,
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
  ], '1').map((value) => `0x${BigInt(value).toString(16)}`);
  const invokeTx = {
    type: 'INVOKE', version: '0x3', signature: ['0x1', '0x2'], paymaster_data: [], tip: '0x0',
    account_deployment_data: [], sender_address: accountAddress, calldata: expectedCalldata,
  };
  const allowedInvoke = await post(relayUrl, {
    jsonrpc: '2.0', id: 3, method: 'starknet_addInvokeTransaction', params: { invoke_transaction: invokeTx },
  }, token);
  if (allowedInvoke.status !== 200 || allowedInvoke.body?.result?.transaction_hash !== '0xbbb') {
    console.error('ALLOWED_INVOKE_DEBUG', JSON.stringify(allowedInvoke));
    throw new Error('Allowed recovery invoke was not forwarded');
  }

  const badInvoke = await post(relayUrl, {
    jsonrpc: '2.0', id: 4, method: 'starknet_addInvokeTransaction',
    params: { invoke_transaction: { ...invokeTx, calldata: ['0x1'] } },
  }, token);
  if (badInvoke.status !== 403) throw new Error('Arbitrary invoke was not blocked');

  const devnetMethod = await post(relayUrl, { jsonrpc: '2.0', id: 5, method: 'devnet_mint', params: {} }, token);
  if (devnetMethod.status !== 403) throw new Error('devnet_* method was not blocked');

  const noToken = await post(relayUrl, { jsonrpc: '2.0', id: 6, method: 'starknet_addInvokeTransaction', params: { invoke_transaction: invokeTx } });
  if (noToken.status !== 401) throw new Error('Missing bearer token was not blocked');

  const idempotentRegistration = await post(registerUrl, {
    identity_id: identityId,
    public_key: publicKey,
    account_address: accountAddress,
  }, token);
  if (idempotentRegistration.status !== 200 || idempotentRegistration.body?.ok !== true || idempotentRegistration.body?.idempotent !== true) {
    throw new Error(`Idempotent registration was not accepted: ${JSON.stringify(idempotentRegistration)}`);
  }

  mockIdentityStatus = 0;
  mockReverseIdentity = '0x0';
  mockRecoveryDelay = 0;
  ownerKeyRequested = false;
  const wrongRecoveryRegistration = await post(registerUrl, {
    identity_id: identityId,
    public_key: publicKey,
    account_address: accountAddress,
  }, token);
  if (wrongRecoveryRegistration.status !== 403 || wrongRecoveryRegistration.body?.code !== 'REGISTRATION_RECOVERY_DELAY_MISMATCH') {
    throw new Error(`Wrong recovery registration was not blocked: ${JSON.stringify(wrongRecoveryRegistration)}`);
  }
  if (ownerKeyRequested) throw new Error('Registry owner key was requested before recovery policy validation completed');

  mockRecoveryDelay = recoveryDelay;
  registrationMode = true;
  ownerKeyRequested = false;
  const freshRegistration = await post(registerUrl, {
    identity_id: identityId,
    public_key: publicKey,
    account_address: accountAddress,
  }, token);
  registrationMode = false;
  if (freshRegistration.status !== 200 || freshRegistration.body?.ok !== true || freshRegistration.body?.idempotent !== false || freshRegistration.body?.transaction_hash !== '0xccc') {
    throw new Error(`Fresh owner registration did not complete: ${JSON.stringify(freshRegistration)}`);
  }
  if (!ownerKeyRequested) throw new Error('Fresh registration never requested the host-local registry owner key');

  const repeatRegistration = await post(registerUrl, {
    identity_id: identityId,
    public_key: publicKey,
    account_address: accountAddress,
  }, token);
  if (repeatRegistration.status !== 200 || repeatRegistration.body?.idempotent !== true) {
    throw new Error(`Fresh registration was not idempotent on retry: ${JSON.stringify(repeatRegistration)}`);
  }

  mockIdentityStatus = 1;
  mockReverseIdentity = identityId;
  const badRegistration = await post(registerUrl, {
    identity_id: identityId,
    public_key: publicKey,
    account_address: '0x999',
  }, token);
  if (badRegistration.status !== 403) throw new Error('Mismatched registration account was not blocked');

  const forwardedWrites = seen.filter((method) => method.startsWith('starknet_add'));
  const expectedWrites = [
    'starknet_addDeployAccountTransaction',
    'starknet_addInvokeTransaction',
    'starknet_addInvokeTransaction',
  ];
  if (forwardedWrites.join(',') !== expectedWrites.join(',')) {
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
    idempotent_registration: true,
    wrong_recovery_registration_blocked: true,
    owner_key_not_requested_before_policy_pass: true,
    fresh_owner_registration: true,
    fresh_registration_retry_idempotent: true,
    mismatched_registration_blocked: true,
    upstream_write_methods: forwardedWrites,
  }, null, 2));
} finally {
  child.kill('SIGTERM');
  upstream.close();
}
