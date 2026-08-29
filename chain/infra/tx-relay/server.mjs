import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { hash, transaction } from 'starknet';

const upstream = new URL(process.env.UPSTREAM_RPC || 'http://devnet:5050');
const port = Number(process.env.PORT || 8081);
const relayToken = String(process.env.RELAY_TOKEN || '');
const accountClassHash = normalizeHex(process.env.ACCOUNT_CLASS_HASH || '', 'ACCOUNT_CLASS_HASH');
const recoveryController = normalizeZeroableHex(process.env.RECOVERY_CONTROLLER || '0x0', 'RECOVERY_CONTROLLER');
const recoveryDelaySeconds = Number(process.env.RECOVERY_DELAY_SECONDS || 172800);
const deployMintAmount = Number(process.env.DEPLOY_MINT_AMOUNT || 5_000_000_000_000_000);
const maxBodyBytes = 128 * 1024;
const maxUpstreamBytes = 2 * 1024 * 1024;
const timeoutMs = 10_000;
const rateLimitPerMinute = Math.max(5, Math.min(600, Number(process.env.RATE_LIMIT_PER_MINUTE || 60)));

if (relayToken.length < 32) throw new Error('RELAY_TOKEN must be at least 32 characters');
if (!Number.isInteger(recoveryDelaySeconds) || recoveryDelaySeconds < 0 || recoveryDelaySeconds > 2_592_000) {
  throw new Error('RECOVERY_DELAY_SECONDS must be an integer from 0 to 2592000');
}
if (!Number.isSafeInteger(deployMintAmount) || deployMintAmount <= 0) {
  throw new Error('DEPLOY_MINT_AMOUNT must be a positive safe integer');
}

const windows = new Map();

function normalizeHex(value, field = 'felt') {
  const raw = String(value || '').trim().toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(raw)) throw new Error(`${field} must be 0x-prefixed hex`);
  return `0x${BigInt(raw).toString(16)}`;
}

function normalizeZeroableHex(value, field = 'felt') {
  const raw = String(value || '').trim().toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(raw)) throw new Error(`${field} must be 0x-prefixed hex`);
  const n = BigInt(raw);
  if (n < 0n) throw new Error(`${field} must not be negative`);
  return `0x${n.toString(16)}`;
}

function normalizeArray(values, field) {
  if (!Array.isArray(values)) throw new Error(`${field} must be an array`);
  return values.map((v, i) => normalizeZeroableHex(v, `${field}[${i}]`));
}

function sameFelts(a, b) {
  if (a.length !== b.length) return false;
  return a.every((value, i) => normalizeZeroableHex(value) === normalizeZeroableHex(b[i]));
}

function clientIp(req) {
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf) return cf;
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff) return xff.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function withinRateLimit(ip) {
  const minute = Math.floor(Date.now() / 60_000);
  const current = windows.get(ip);
  if (!current || current.minute !== minute) {
    windows.set(ip, { minute, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= rateLimitPerMinute;
}

function tokenMatches(header) {
  const raw = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = Buffer.from(raw);
  const b = Buffer.from(relayToken);
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBodyBytes) throw new Error('BODY_TOO_LARGE');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function rpc(method, params) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(upstream, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method, params }),
      redirect: 'error',
      signal: controller.signal,
    });
    const text = await response.text();
    if (Buffer.byteLength(text) > maxUpstreamBytes) throw new Error('UPSTREAM_RESPONSE_TOO_LARGE');
    let payload;
    try { payload = JSON.parse(text); } catch { throw new Error('UPSTREAM_INVALID_JSON'); }
    if (!response.ok) throw new Error(`UPSTREAM_HTTP_${response.status}`);
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

function extractTransaction(payload, field) {
  const params = payload?.params;
  if (Array.isArray(params)) return params[0];
  if (params && typeof params === 'object') return params[field];
  return null;
}

function validateCommonV3(tx, expectedType) {
  if (!tx || typeof tx !== 'object' || Array.isArray(tx)) throw new Error('TRANSACTION_REQUIRED');
  if (tx.type && String(tx.type) !== expectedType) throw new Error('WRONG_TRANSACTION_TYPE');
  if (normalizeHex(tx.version, 'version') !== '0x3') throw new Error('ONLY_V3_TRANSACTIONS_ALLOWED');
  const signature = normalizeArray(tx.signature, 'signature');
  if (signature.length !== 2) throw new Error('STARK_SIGNATURE_MUST_HAVE_TWO_FELTS');
  if (tx.paymaster_data && normalizeArray(tx.paymaster_data, 'paymaster_data').length !== 0) {
    throw new Error('PAYMASTER_DATA_NOT_ALLOWED');
  }
  if (BigInt(normalizeZeroableHex(tx.tip ?? '0x0', 'tip')) !== 0n) throw new Error('NONZERO_TIP_NOT_ALLOWED');
}

async function validateDeploy(tx) {
  validateCommonV3(tx, 'DEPLOY_ACCOUNT');
  if (normalizeZeroableHex(tx.nonce ?? '0x0', 'nonce') !== '0x0') throw new Error('DEPLOY_NONCE_MUST_BE_ZERO');
  if (normalizeHex(tx.class_hash, 'class_hash') !== accountClassHash) throw new Error('ACCOUNT_CLASS_NOT_ALLOWED');
  const constructor = normalizeArray(tx.constructor_calldata, 'constructor_calldata');
  if (constructor.length !== 1 || constructor[0] === '0x0') throw new Error('CONSTRUCTOR_MUST_CONTAIN_ONE_PUBLIC_KEY');
  const publicKey = constructor[0];
  if (normalizeHex(tx.contract_address_salt, 'contract_address_salt') !== publicKey) {
    throw new Error('ADDRESS_SALT_MUST_EQUAL_PUBLIC_KEY');
  }
  const accountAddress = normalizeHex(
    hash.calculateContractAddressFromHash(publicKey, accountClassHash, [publicKey], 0),
    'account address',
  );

  // This privileged Devnet helper is never exposed as a client-selectable faucet.
  // It can mint only a fixed amount to the exact counterfactual account implied by
  // the approved class hash + public-key constructor/salt.
  const minted = await rpc('devnet_mint', {
    address: accountAddress,
    amount: deployMintAmount,
    unit: 'FRI',
  });
  if (minted?.error) throw new Error(`DEVNET_MINT_FAILED_${minted.error.code ?? 'UNKNOWN'}`);
  return { accountAddress, publicKey };
}

async function validateRecoveryInvoke(tx) {
  validateCommonV3(tx, 'INVOKE');
  const sender = normalizeHex(tx.sender_address, 'sender_address');
  if (tx.account_deployment_data && normalizeArray(tx.account_deployment_data, 'account_deployment_data').length !== 0) {
    throw new Error('ACCOUNT_DEPLOYMENT_DATA_NOT_ALLOWED');
  }

  const classResult = await rpc('starknet_getClassHashAt', ['latest', sender]);
  if (classResult?.error) throw new Error('SENDER_ACCOUNT_NOT_DEPLOYED');
  if (normalizeHex(classResult?.result, 'sender class hash') !== accountClassHash) {
    throw new Error('SENDER_ACCOUNT_CLASS_NOT_ALLOWED');
  }

  const expected = transaction.getExecuteCalldata([
    {
      contractAddress: sender,
      entrypoint: 'set_recovery_controller',
      calldata: [recoveryController],
    },
    {
      contractAddress: sender,
      entrypoint: 'set_recovery_delay',
      calldata: [String(recoveryDelaySeconds)],
    },
  ], '1');
  const actual = normalizeArray(tx.calldata, 'calldata');
  if (!sameFelts(actual, expected)) throw new Error('ONLY_RECOVERY_CONFIGURATION_INVOKE_ALLOWED');
  return { sender };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/healthz') {
    return json(res, 200, { ok: true, purpose: 'swappulse-testnet-provisioning-relay' });
  }
  if (req.method !== 'POST' || req.url !== '/rpc') return json(res, 404, { error: 'Not found' });
  if (!tokenMatches(req.headers.authorization)) return json(res, 401, { error: 'Unauthorized' });

  const ip = clientIp(req);
  if (!withinRateLimit(ip)) return json(res, 429, { error: 'Rate limit exceeded' });

  try {
    const payload = JSON.parse(await readBody(req));
    if (Array.isArray(payload)) return json(res, 400, { error: 'JSON-RPC batch requests are disabled' });
    if (!payload || payload.jsonrpc !== '2.0' || typeof payload.method !== 'string') {
      return json(res, 400, { error: 'Invalid JSON-RPC request' });
    }

    let policy = {};
    if (payload.method === 'starknet_addDeployAccountTransaction') {
      const tx = extractTransaction(payload, 'deploy_account_transaction');
      policy = await validateDeploy(tx);
    } else if (payload.method === 'starknet_addInvokeTransaction') {
      const tx = extractTransaction(payload, 'invoke_transaction');
      policy = await validateRecoveryInvoke(tx);
    } else {
      return json(res, 403, {
        jsonrpc: '2.0',
        id: payload.id ?? null,
        error: { code: -32601, message: 'Method not exposed by SwapPulse provisioning relay' },
      });
    }

    const upstreamPayload = await rpc(payload.method, payload.params);
    if (upstreamPayload?.error) {
      return json(res, 200, { ...upstreamPayload, id: payload.id ?? upstreamPayload.id ?? null });
    }
    console.log(`${payload.method} accepted ${ip} ${JSON.stringify(policy)}`);
    return json(res, 200, { ...upstreamPayload, id: payload.id ?? upstreamPayload.id ?? null });
  } catch (error) {
    const code = String(error?.message || 'TX_RELAY_ERROR').replace(/[^A-Z0-9_:-]/gi, '_').slice(0, 120);
    const status = code === 'BODY_TOO_LARGE' ? 413 : code.includes('NOT_ALLOWED') || code.includes('MUST_') || code.includes('ONLY_') || code.includes('WRONG_') ? 403 : 400;
    console.warn(`Provisioning relay rejected request from ${clientIp(req)}: ${code}`);
    return json(res, status, { error: 'Provisioning transaction rejected', code });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`SwapPulse provisioning transaction relay listening on :${port}`);
  console.log('Allowed write methods: starknet_addDeployAccountTransaction, starknet_addInvokeTransaction');
});
