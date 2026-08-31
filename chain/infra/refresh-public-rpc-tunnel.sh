#!/usr/bin/env bash
set -euo pipefail
set +x

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHAIN_ROOT="$(cd "$HERE/.." && pwd)"
ENV_FILE="${SWAPPULSE_ENV_FILE:-$HERE/.env}"
MANIFEST="${SWAPPULSE_DEPLOYMENT_MANIFEST:-$CHAIN_ROOT/deployments/swappulse-testnet.json}"
NODE_BIN="${NODE_BIN:-node}"
CLOUDFLARED_BIN="${CLOUDFLARED_BIN:-cloudflared}"
LOG="${SWAPPULSE_RPC_TUNNEL_LOG:-/tmp/swappulse-rpc-tunnel.log}"
PIDFILE="${SWAPPULSE_RPC_TUNNEL_PIDFILE:-/tmp/swappulse-rpc-tunnel.pid}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Environment file not found: $ENV_FILE" >&2
  exit 1
fi
if ! command -v "$NODE_BIN" >/dev/null 2>&1 && [[ ! -x "$NODE_BIN" ]]; then
  echo "Node.js executable not found: $NODE_BIN" >&2
  exit 1
fi
if ! command -v "$CLOUDFLARED_BIN" >/dev/null 2>&1 && [[ ! -x "$CLOUDFLARED_BIN" ]]; then
  echo "cloudflared executable not found: $CLOUDFLARED_BIN" >&2
  exit 1
fi

GATEWAY_PORT="$(grep '^SWAPPULSE_GATEWAY_PORT=' "$ENV_FILE" | tail -n 1 | cut -d= -f2- || true)"
GATEWAY_PORT="${GATEWAY_PORT:-8080}"
if ! [[ "$GATEWAY_PORT" =~ ^[0-9]+$ ]] || (( GATEWAY_PORT < 1 || GATEWAY_PORT > 65535 )); then
  echo "Invalid SWAPPULSE_GATEWAY_PORT: $GATEWAY_PORT" >&2
  exit 1
fi

curl -fsS "http://127.0.0.1:${GATEWAY_PORT}/healthz" >/dev/null

if [[ -f "$PIDFILE" ]]; then
  old_pid="$(cat "$PIDFILE" 2>/dev/null || true)"
  if [[ "$old_pid" =~ ^[0-9]+$ ]] && kill -0 "$old_pid" 2>/dev/null; then
    kill "$old_pid" || true
    for _ in $(seq 1 20); do
      kill -0 "$old_pid" 2>/dev/null || break
      sleep 0.1
    done
  fi
fi

: > "$LOG"
nohup "$CLOUDFLARED_BIN" tunnel \
  --protocol http2 \
  --url "http://127.0.0.1:${GATEWAY_PORT}" \
  >"$LOG" 2>&1 &
cf_pid=$!
echo "$cf_pid" > "$PIDFILE"

tunnel_base=""
for _ in $(seq 1 30); do
  tunnel_base="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" | head -n 1 || true)"
  [[ -n "$tunnel_base" ]] && break
  kill -0 "$cf_pid" 2>/dev/null || break
  sleep 1
done

if [[ -z "$tunnel_base" ]]; then
  echo "Cloudflare did not generate a Quick Tunnel URL." >&2
  tail -n 40 "$LOG" >&2
  kill "$cf_pid" 2>/dev/null || true
  rm -f "$PIDFILE"
  exit 1
fi

# A Quick Tunnel hostname can be printed before Cloudflare's edge route is
# ready. Wait for an actual JSON-RPC response so HTML 502/1033 pages are never
# written into .env or the public manifest.
rpc_url="${tunnel_base}/rpc"
if ! RPC_URL="$rpc_url" "$NODE_BIN" --input-type=module <<'NODE'
const rpcUrl = process.env.RPC_URL;
const deadline = Date.now() + 60_000;
let lastError = 'no response';
while (Date.now() < deadline) {
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'starknet_chainId', params: [] }),
      redirect: 'error',
    });
    const text = await response.text();
    let payload;
    try { payload = JSON.parse(text); } catch { throw new Error(`non-JSON HTTP ${response.status}`); }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (payload?.error) throw new Error(`RPC error ${payload.error.code ?? 'unknown'}`);
    if (typeof payload?.result === 'string' && payload.result.startsWith('0x')) {
      console.log(`Quick Tunnel JSON-RPC ready: ${rpcUrl}`);
      process.exit(0);
    }
    throw new Error('missing chain id result');
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
  }
  await new Promise((resolve) => setTimeout(resolve, 2000));
}
console.error(`Quick Tunnel did not become JSON-RPC ready: ${lastError}`);
process.exit(1);
NODE
then
  kill "$cf_pid" 2>/dev/null || true
  rm -f "$PIDFILE"
  echo "The new Cloudflare Quick Tunnel never became JSON-RPC ready; existing configuration was not changed." >&2
  tail -n 40 "$LOG" >&2
  exit 1
fi

ENV_FILE="$ENV_FILE" RPC_URL="$rpc_url" "$NODE_BIN" --input-type=module <<'NODE'
import fs from 'node:fs';

const file = process.env.ENV_FILE;
const rpcUrl = process.env.RPC_URL;
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
const output = [];
let replaced = false;

for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.startsWith('SWAPPULSE_PUBLIC_RPC_URL=')) {
    if (!replaced) {
      output.push(`SWAPPULSE_PUBLIC_RPC_URL=${rpcUrl}`);
      replaced = true;
    }
    continue;
  }
  if (/^https:\/\/[a-z0-9-]+\.trycloudflare\.com\/?$/i.test(trimmed)) continue;
  if (line !== '' || output.length > 0) output.push(line);
}
if (!replaced) output.push(`SWAPPULSE_PUBLIC_RPC_URL=${rpcUrl}`);
fs.writeFileSync(file, `${output.join('\n').replace(/\n+$/, '')}\n`, { mode: 0o600 });
NODE
chmod 600 "$ENV_FILE"

if [[ -f "$MANIFEST" ]]; then
  SWAPPULSE_PUBLIC_RPC_URL="$rpc_url" \
    "$NODE_BIN" "$CHAIN_ROOT/scripts/tooling/update-public-rpc.mjs" "$MANIFEST"
  env -u SWAPPULSE_VERIFY_RPC_URL \
    "$NODE_BIN" "$CHAIN_ROOT/scripts/tooling/verify-network.mjs" "$MANIFEST"
else
  echo "Deployment manifest not found yet: $MANIFEST"
  echo "The new public RPC was saved to $ENV_FILE only."
fi

echo
echo "Fresh SwapPulse read-only RPC: $rpc_url"
echo "cloudflared PID: $cf_pid"
echo "PID file: $PIDFILE"
echo "Log: $LOG"
