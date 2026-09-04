import http from 'node:http';
import { readFile, mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_MANIFEST = resolve(here, '../config/swappulse-testnet.json');
const manifestPath = process.env.SWAPPULSE_NODE_MANIFEST || DEFAULT_MANIFEST;
const port = clampInt(process.env.PORT, 18100, 1, 65535);
const bindAddress = String(process.env.BIND_ADDRESS || '0.0.0.0').trim();
if (!bindAddress || /[\s/]/.test(bindAddress)) throw new Error('INVALID_BIND_ADDRESS');
const pollMs = clampInt(process.env.POLL_INTERVAL_MS, 15_000, 5_000, 300_000);
const pinPollMs = clampInt(process.env.PIN_CHECK_INTERVAL_MS, 300_000, 30_000, 3_600_000);
const timeoutMs = clampInt(process.env.RPC_TIMEOUT_MS, 5_000, 1_000, 30_000);
const rpcRateLimit = clampInt(process.env.RPC_RATE_LIMIT_PER_MINUTE, 120, 10, 5_000);
const checkpointPath = process.env.CHECKPOINT_PATH || '/data/checkpoint.json';

function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function normalizeHex(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(raw)) throw new Error('INVALID_HEX');
  return `0x${BigInt(raw).toString(16)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function safePeerUrl(value) {
  const url = new URL(String(value || '').trim());
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('RPC_PEER_PROTOCOL_NOT_ALLOWED');
  if (url.username || url.password) throw new Error('RPC_PEER_CREDENTIALS_NOT_ALLOWED');
  if (url.protocol === 'http:') {
    const host = url.hostname.toLowerCase();
    if (!['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error('HTTP_RPC_PEER_MUST_BE_LOCAL');
  }
  return url.toString();
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const expectedChainId = normalizeHex(manifest.chain_id);
const operatorIndependence = manifest?.trust?.peer_operator_independence === true;
const observerStateIndependent = manifest?.trust?.observer_state_independent === true;
const contractPins = Object.entries(manifest?.expected?.contracts || {}).map(([name, value]) => ({
  name,
  address: normalizeHex(value.address),
  classHash: normalizeHex(value.class_hash),
}));

const envPeers = String(process.env.SWAPPULSE_RPC_PEERS || '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);
const peerInputs = envPeers.length ? envPeers : (manifest.rpc_peers || []);
const peers = [...new Set(peerInputs.map(safePeerUrl))];
if (!peers.length) throw new Error('At least one RPC peer is required');

const allowedRpcMethods = new Set([
  'starknet_specVersion',
  'starknet_chainId',
  'starknet_blockNumber',
  'starknet_getBlockWithTxHashes',
  'starknet_getTransactionByHash',
  'starknet_getTransactionReceipt',
  'starknet_getTransactionStatus',
  'starknet_getClassHashAt',
  'starknet_getClass',
  'starknet_getClassAt',
  'starknet_getNonce',
  'starknet_call',
  'starknet_estimateFee',
]);

const peerState = new Map();
const rateWindows = new Map();
let lastPinCheckAt = 0;
let pollBusy = false;
let status = {
  schema_version: 1,
  role: 'lite',
  node_version: '0.1.0',
  network: manifest.network,
  chain_id: expectedChainId,
  ready: false,
  peer_agreement: false,
  trust_mode: peers.length > 1 ? 'multi-peer-pending' : 'single-peer-degraded',
  configured_peer_count: peers.length,
  healthy_peer_count: 0,
  common_height: null,
  common_block_hash: null,
  agreement_count: 0,
  required_agreement: peers.length > 1 ? Math.floor(peers.length / 2) + 1 : 1,
  pins_verified: false,
  pin_verified_peer_count: 0,
  independently_verified: false,
  observer_state_independent: observerStateIndependent,
  operator_independence: operatorIndependence,
  last_poll_at: null,
  last_error: null,
  peers: [],
};

async function rpc(peer, method, params = []) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const response = await fetch(peer, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method, params }),
      redirect: 'error',
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const payload = JSON.parse(text);
    if (payload?.error) throw new Error(`RPC_${payload.error.code ?? 'ERROR'}_${payload.error.message || ''}`);
    return { result: payload?.result, latencyMs: Math.round((performance.now() - started) * 10) / 10 };
  } finally {
    clearTimeout(timer);
  }
}

async function readPeerHead(peer) {
  const [chain, block] = await Promise.all([
    rpc(peer, 'starknet_chainId', []),
    rpc(peer, 'starknet_blockNumber', []),
  ]);
  const chainId = normalizeHex(chain.result);
  const blockNumber = Number(block.result);
  if (!Number.isSafeInteger(blockNumber) || blockNumber < 0) throw new Error('INVALID_BLOCK_NUMBER');
  return {
    peer,
    healthy: true,
    chain_id: chainId,
    chain_ok: chainId === expectedChainId,
    block_number: blockNumber,
    latency_ms: Math.max(chain.latencyMs, block.latencyMs),
    checked_at: nowIso(),
  };
}

async function verifyPinsForPeer(peer) {
  const results = [];
  for (const pin of contractPins) {
    try {
      const response = await rpc(peer, 'starknet_getClassHashAt', ['latest', pin.address]);
      const actual = normalizeHex(response.result);
      results.push({ name: pin.name, ok: actual === pin.classHash, expected: pin.classHash, actual });
    } catch (error) {
      results.push({ name: pin.name, ok: false, expected: pin.classHash, actual: '', error: String(error?.message || error) });
    }
  }
  return {
    ok: results.length === contractPins.length && results.every((r) => r.ok),
    checked_at: nowIso(),
    contracts: results,
  };
}

async function blockAt(peer, blockNumber) {
  const response = await rpc(peer, 'starknet_getBlockWithTxHashes', [{ block_number: blockNumber }]);
  const block = response.result || {};
  return {
    block_number: Number(block.block_number),
    block_hash: normalizeHex(block.block_hash),
    parent_hash: normalizeHex(block.parent_hash || '0x0'),
    timestamp: Number(block.timestamp || 0),
  };
}

function agreementRequired(count) {
  if (count <= 1) return 1;
  return Math.floor(count / 2) + 1;
}

async function persistCheckpoint(next) {
  if (next.common_height == null || !next.common_block_hash) return;
  try {
    await mkdir(dirname(checkpointPath), { recursive: true });
    const temp = `${checkpointPath}.tmp`;
    const payload = {
      schema_version: 1,
      network: next.network,
      chain_id: next.chain_id,
      common_height: next.common_height,
      common_block_hash: next.common_block_hash,
      peer_agreement: next.peer_agreement,
      independently_verified: next.independently_verified,
      observer_state_independent: next.observer_state_independent,
      operator_independence: next.operator_independence,
      observed_at: next.last_poll_at,
    };
    await writeFile(temp, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o644 });
    await rename(temp, checkpointPath);
  } catch (error) {
    console.warn(`checkpoint write failed: ${error?.message || error}`);
  }
}

async function poll() {
  if (pollBusy) return;
  pollBusy = true;
  try {
    const heads = await Promise.all(peers.map(async (peer) => {
      try {
        const head = await readPeerHead(peer);
        const previous = peerState.get(peer) || {};
        const merged = { ...previous, ...head, error: null };
        peerState.set(peer, merged);
        return merged;
      } catch (error) {
        const failed = {
          ...(peerState.get(peer) || {}),
          peer,
          healthy: false,
          chain_ok: false,
          checked_at: nowIso(),
          error: String(error?.message || error),
        };
        peerState.set(peer, failed);
        return failed;
      }
    }));

    const shouldCheckPins = Date.now() - lastPinCheckAt >= pinPollMs;
    if (shouldCheckPins) {
      await Promise.all(heads.filter((p) => p.healthy && p.chain_ok).map(async (p) => {
        p.pins = await verifyPinsForPeer(p.peer);
        peerState.set(p.peer, p);
      }));
      lastPinCheckAt = Date.now();
    }

    const healthy = [...peerState.values()].filter((p) => p.healthy && p.chain_ok);
    const commonHeight = healthy.length ? Math.min(...healthy.map((p) => p.block_number)) : null;
    const blocks = commonHeight == null ? [] : await Promise.all(healthy.map(async (p) => {
      try {
        const block = await blockAt(p.peer, commonHeight);
        p.common_block = block;
        peerState.set(p.peer, p);
        return { peer: p.peer, ok: true, ...block };
      } catch (error) {
        return { peer: p.peer, ok: false, error: String(error?.message || error) };
      }
    }));

    const groups = new Map();
    for (const block of blocks.filter((b) => b.ok)) {
      const list = groups.get(block.block_hash) || [];
      list.push(block);
      groups.set(block.block_hash, list);
    }
    const winning = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)[0] || [null, []];
    const [commonHash, agreeing] = winning;
    const required = agreementRequired(peers.length);
    const peerAgreement = peers.length > 1 && agreeing.length >= required;
    const pinsVerifiedPeers = healthy.filter((p) => p.pins?.ok);
    const pinsVerified = pinsVerifiedPeers.length > 0;
    const pinQuorumVerified = pinsVerifiedPeers.length >= (peers.length > 1 ? required : 1);
    const independent = peerAgreement && pinQuorumVerified;
    const ready = healthy.length > 0 && pinQuorumVerified && (peers.length < 2 || peerAgreement);
    const lastError = healthy.length === 0
      ? 'NO_HEALTHY_PINNED_PEER'
      : peers.length > 1 && !peerAgreement
        ? 'INSUFFICIENT_PEER_AGREEMENT'
        : !pinQuorumVerified
          ? 'INSUFFICIENT_PIN_QUORUM'
          : null;

    const next = {
      schema_version: 1,
      role: 'lite',
      node_version: '0.1.0',
      network: manifest.network,
      chain_id: expectedChainId,
      ready,
      peer_agreement: peerAgreement,
      trust_mode: peers.length < 2
        ? 'single-peer-degraded'
        : peerAgreement
          ? 'multi-peer-agreement'
          : 'multi-peer-disagreement',
      configured_peer_count: peers.length,
      healthy_peer_count: healthy.length,
      common_height: commonHeight,
      common_block_hash: commonHash,
      agreement_count: agreeing.length,
      required_agreement: required,
      pins_verified: pinsVerified,
      pin_verified_peer_count: pinsVerifiedPeers.length,
      independently_verified: independent,
      observer_state_independent: observerStateIndependent,
      operator_independence: operatorIndependence,
      last_poll_at: nowIso(),
      last_error: lastError,
      peers: [...peerState.values()].map((p) => ({
        peer: p.peer,
        healthy: Boolean(p.healthy),
        chain_ok: Boolean(p.chain_ok),
        block_number: p.block_number ?? null,
        latency_ms: p.latency_ms ?? null,
        pins_ok: Boolean(p.pins?.ok),
        common_block_hash: p.common_block?.block_hash || null,
        checked_at: p.checked_at || null,
        error: p.error || null,
      })),
    };
    status = next;
    await persistCheckpoint(next);
  } catch (error) {
    status = { ...status, ready: false, last_poll_at: nowIso(), last_error: String(error?.message || error) };
  } finally {
    pollBusy = false;
  }
}

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff) return xff.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function rateAllowed(ip) {
  const minute = Math.floor(Date.now() / 60_000);
  const row = rateWindows.get(ip);
  if (!row || row.minute !== minute) {
    rateWindows.set(ip, { minute, count: 1 });
    return true;
  }
  row.count += 1;
  return row.count <= rpcRateLimit;
}

function json(res, code, payload, cache = 'no-store') {
  const body = JSON.stringify(payload);
  res.writeHead(code, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body),
    'cache-control': cache,
    'x-content-type-options': 'nosniff',
  });
  res.end(body);
}

async function readJsonBody(req, max = 64 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > max) throw new Error('BODY_TOO_LARGE');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function bestPeer() {
  return [...peerState.values()]
    .filter((p) => p.healthy && p.chain_ok && p.pins?.ok)
    .sort((a, b) => (a.latency_ms ?? 999999) - (b.latency_ms ?? 999999))[0]?.peer || null;
}

async function proxyRead(payload) {
  if (Array.isArray(payload)) throw new Error('BATCH_DISABLED');
  if (!payload || payload.jsonrpc !== '2.0' || typeof payload.method !== 'string') throw new Error('INVALID_JSON_RPC');
  if (!allowedRpcMethods.has(payload.method)) throw new Error('METHOD_NOT_ALLOWED');
  const peer = bestPeer();
  if (!peer) throw new Error('NO_VERIFIED_PEER');
  const response = await rpc(peer, payload.method, Array.isArray(payload.params) ? payload.params : payload.params ?? []);
  return { jsonrpc: '2.0', id: payload.id ?? null, result: response.result, x_swappulse_peer: peer };
}

function metrics() {
  const lines = [
    '# HELP swappulse_lite_ready Whether at least one pinned RPC peer is healthy.',
    '# TYPE swappulse_lite_ready gauge',
    `swappulse_lite_ready ${status.ready ? 1 : 0}`,
    '# HELP swappulse_lite_peer_agreement Whether multiple configured peers agree at the common height.',
    '# TYPE swappulse_lite_peer_agreement gauge',
    `swappulse_lite_peer_agreement ${status.peer_agreement ? 1 : 0}`,
    '# HELP swappulse_lite_independently_verified Multi-peer agreement plus pinned-contract verification.',
    '# TYPE swappulse_lite_independently_verified gauge',
    `swappulse_lite_independently_verified ${status.independently_verified ? 1 : 0}`,
    '# HELP swappulse_lite_healthy_peers Number of healthy peers on the expected chain.',
    '# TYPE swappulse_lite_healthy_peers gauge',
    `swappulse_lite_healthy_peers ${status.healthy_peer_count}`,
    '# HELP swappulse_lite_pin_verified_peers Number of healthy peers matching all configured contract pins.',
    '# TYPE swappulse_lite_pin_verified_peers gauge',
    `swappulse_lite_pin_verified_peers ${status.pin_verified_peer_count ?? 0}`,
    '# HELP swappulse_lite_common_height Common comparison block height.',
    '# TYPE swappulse_lite_common_height gauge',
    `swappulse_lite_common_height ${status.common_height ?? -1}`,
  ];
  return `${lines.join('\n')}\n`;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/healthz') return json(res, 200, { ok: true, role: 'lite' });
    if (req.method === 'GET' && req.url === '/readyz') return json(res, status.ready ? 200 : 503, status);
    if (req.method === 'GET' && req.url === '/status') return json(res, 200, status, 'public, max-age=5');
    if (req.method === 'GET' && req.url === '/metrics') {
      const body = metrics();
      res.writeHead(200, { 'content-type': 'text/plain; version=0.0.4', 'content-length': Buffer.byteLength(body), 'cache-control': 'no-store' });
      return res.end(body);
    }
    if (req.method === 'POST' && (req.url === '/rpc' || req.url === '/')) {
      const ip = clientIp(req);
      if (!rateAllowed(ip)) return json(res, 429, { error: 'Rate limit exceeded' });
      try {
        const payload = await readJsonBody(req);
        const proxied = await proxyRead(payload);
        return json(res, 200, proxied);
      } catch (error) {
        const code = String(error?.message || 'RPC_PROXY_ERROR');
        const http = code === 'METHOD_NOT_ALLOWED' ? 403 : code === 'BODY_TOO_LARGE' ? 413 : code === 'NO_VERIFIED_PEER' ? 503 : 400;
        return json(res, http, { jsonrpc: '2.0', id: null, error: { code: -32600, message: code } });
      }
    }
    return json(res, 404, { error: 'Not found' });
  } catch (error) {
    return json(res, 500, { error: 'Lite node request failed', code: String(error?.message || 'INTERNAL_ERROR') });
  }
});

await poll();
setInterval(() => void poll(), pollMs).unref();
server.listen(port, bindAddress, () => {
  console.log(`SwapPulse lite node listening on ${bindAddress}:${port}`);
  console.log(`network=${manifest.network} peers=${peers.length} trust=${status.trust_mode}`);
});
