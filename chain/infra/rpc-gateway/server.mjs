import http from 'node:http';

const upstream = new URL(process.env.UPSTREAM_RPC || 'http://devnet:5050');
const port = Number(process.env.PORT || 8080);
const maxBodyBytes = 64 * 1024;
const maxUpstreamBytes = 4 * 1024 * 1024;
const timeoutMs = 8_000;
const rateLimitPerMinute = Math.max(30, Math.min(10_000, Number(process.env.RATE_LIMIT_PER_MINUTE || 180)));

const allowedMethods = new Set([
  'starknet_specVersion',
  'starknet_chainId',
  'starknet_getClassHashAt',
  'starknet_getClass',
  'starknet_call',
]);

const windows = new Map();

function clientIp(req) {
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf) return cf;
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff) return xff.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function withinRateLimit(ip) {
  const now = Date.now();
  const minute = Math.floor(now / 60_000);
  const current = windows.get(ip);
  if (!current || current.minute !== minute) {
    windows.set(ip, { minute, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= rateLimitPerMinute;
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

async function proxyRpc(payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(upstream, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'error',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`UPSTREAM_HTTP_${response.status}`);
    const text = await response.text();
    if (Buffer.byteLength(text) > maxUpstreamBytes) throw new Error('UPSTREAM_RESPONSE_TOO_LARGE');
    return text;
  } finally {
    clearTimeout(timer);
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/healthz') {
    return json(res, 200, { ok: true });
  }

  if (req.method !== 'POST' || (req.url !== '/' && req.url !== '/rpc')) {
    return json(res, 404, { error: 'Not found' });
  }

  const ip = clientIp(req);
  if (!withinRateLimit(ip)) {
    return json(res, 429, { error: 'Rate limit exceeded' });
  }

  try {
    const raw = await readBody(req);
    const payload = JSON.parse(raw);

    if (Array.isArray(payload)) {
      return json(res, 400, { error: 'JSON-RPC batch requests are disabled' });
    }
    if (!payload || payload.jsonrpc !== '2.0' || typeof payload.method !== 'string') {
      return json(res, 400, { error: 'Invalid JSON-RPC request' });
    }
    if (!allowedMethods.has(payload.method)) {
      console.warn(`Denied RPC method ${payload.method} from ${ip}`);
      return json(res, 403, {
        jsonrpc: '2.0',
        id: payload.id ?? null,
        error: { code: -32601, message: 'Method not exposed by SwapPulse read-only RPC' },
      });
    }

    const upstreamBody = await proxyRpc(payload);
    res.writeHead(200, {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(upstreamBody),
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
    res.end(upstreamBody);
    console.log(`${payload.method} 200 ${ip}`);
  } catch (error) {
    const code = error?.message || 'RPC_GATEWAY_ERROR';
    const status = code === 'BODY_TOO_LARGE' ? 413 : 502;
    console.error(`RPC gateway error: ${code}`);
    return json(res, status, { error: 'RPC gateway request failed' });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`SwapPulse read-only RPC gateway listening on :${port}`);
  console.log(`Allowed methods: ${[...allowedMethods].join(', ')}`);
});
