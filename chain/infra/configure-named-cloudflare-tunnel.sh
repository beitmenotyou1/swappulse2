#!/usr/bin/env bash
set -euo pipefail
set +x

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SWAPPULSE_ENV_FILE:-$HERE/.env}"
CLOUDFLARED_BIN="${CLOUDFLARED_BIN:-cloudflared}"
CF_DIR="${SWAPPULSE_CLOUDFLARED_DIR:-$HOME/.cloudflared}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Environment file not found: $ENV_FILE" >&2
  exit 1
fi
if ! command -v "$CLOUDFLARED_BIN" >/dev/null 2>&1 && [[ ! -x "$CLOUDFLARED_BIN" ]]; then
  echo "cloudflared executable not found: $CLOUDFLARED_BIN" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

TUNNEL_NAME="${SWAPPULSE_CLOUDFLARE_TUNNEL_NAME:-swappulse-testnet}"
RPC_HOSTNAME="${SWAPPULSE_RPC_HOSTNAME:-}"
RELAY_HOSTNAME="${SWAPPULSE_TX_RELAY_HOSTNAME:-}"
GATEWAY_PORT="${SWAPPULSE_GATEWAY_PORT:-8080}"
RELAY_PORT="${SWAPPULSE_TX_RELAY_PORT:-8081}"

for pair in \
  "SWAPPULSE_RPC_HOSTNAME:$RPC_HOSTNAME" \
  "SWAPPULSE_TX_RELAY_HOSTNAME:$RELAY_HOSTNAME"; do
  key="${pair%%:*}"
  value="${pair#*:}"
  if [[ -z "$value" || "$value" == *CHANGE_ME* || "$value" != *.* ]]; then
    echo "Set $key to a fixed hostname in $ENV_FILE before continuing." >&2
    exit 1
  fi
done

if [[ ! "$GATEWAY_PORT" =~ ^[0-9]+$ || ! "$RELAY_PORT" =~ ^[0-9]+$ ]]; then
  echo "Gateway and relay ports must be numeric." >&2
  exit 1
fi

curl -fsS "http://127.0.0.1:${GATEWAY_PORT}/healthz" >/dev/null
curl -fsS "http://127.0.0.1:${RELAY_PORT}/healthz" >/dev/null

mkdir -p "$CF_DIR"
if [[ ! -f "$CF_DIR/cert.pem" ]]; then
  echo "Cloudflare account certificate not found at $CF_DIR/cert.pem." >&2
  echo "Run: cloudflared tunnel login" >&2
  echo "Complete the browser login, then run this helper again." >&2
  exit 1
fi

find_tunnel_id() {
  "$CLOUDFLARED_BIN" tunnel list --output json 2>/dev/null | \
    TUNNEL_NAME="$TUNNEL_NAME" node --input-type=module -e '
      import fs from "node:fs";
      const wanted = process.env.TUNNEL_NAME;
      const text = fs.readFileSync(0, "utf8").trim();
      const rows = text ? JSON.parse(text) : [];
      const row = Array.isArray(rows) ? rows.find((item) => item?.name === wanted) : null;
      if (row?.id) process.stdout.write(String(row.id));
    '
}

TUNNEL_ID="$(find_tunnel_id || true)"
if [[ -z "$TUNNEL_ID" ]]; then
  echo "Creating named Cloudflare Tunnel: $TUNNEL_NAME"
  "$CLOUDFLARED_BIN" tunnel create "$TUNNEL_NAME" >/dev/null
  TUNNEL_ID="$(find_tunnel_id || true)"
fi

if [[ -z "$TUNNEL_ID" ]]; then
  echo "Could not resolve tunnel ID for $TUNNEL_NAME." >&2
  exit 1
fi

CREDENTIALS_FILE="$CF_DIR/${TUNNEL_ID}.json"
if [[ ! -f "$CREDENTIALS_FILE" ]]; then
  echo "Tunnel credentials file not found: $CREDENTIALS_FILE" >&2
  exit 1
fi

CONFIG_FILE="$CF_DIR/${TUNNEL_NAME}.yml"
umask 077
cat > "$CONFIG_FILE" <<EOF
tunnel: ${TUNNEL_ID}
credentials-file: ${CREDENTIALS_FILE}
protocol: http2
ingress:
  - hostname: ${RPC_HOSTNAME}
    service: http://127.0.0.1:${GATEWAY_PORT}
  - hostname: ${RELAY_HOSTNAME}
    service: http://127.0.0.1:${RELAY_PORT}
  - service: http_status:404
EOF
chmod 600 "$CONFIG_FILE"

"$CLOUDFLARED_BIN" tunnel --config "$CONFIG_FILE" ingress validate >/dev/null

# `route dns` is safe to repeat for an existing route only when cloudflared
# accepts the current record. Surface conflicts instead of deleting DNS.
"$CLOUDFLARED_BIN" tunnel route dns "$TUNNEL_ID" "$RPC_HOSTNAME"
"$CLOUDFLARED_BIN" tunnel route dns "$TUNNEL_ID" "$RELAY_HOSTNAME"

RPC_URL="https://${RPC_HOSTNAME}/rpc"
ENV_FILE="$ENV_FILE" RPC_URL="$RPC_URL" node --input-type=module <<'NODE'
import fs from 'node:fs';
const file = process.env.ENV_FILE;
const rpcUrl = process.env.RPC_URL;
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
const out = [];
let replaced = false;
for (const line of lines) {
  if (line.startsWith('SWAPPULSE_PUBLIC_RPC_URL=')) {
    if (!replaced) out.push(`SWAPPULSE_PUBLIC_RPC_URL=${rpcUrl}`);
    replaced = true;
  } else {
    out.push(line);
  }
}
if (!replaced) out.push(`SWAPPULSE_PUBLIC_RPC_URL=${rpcUrl}`);
fs.writeFileSync(file, `${out.join('\n').replace(/\n+$/, '')}\n`, { mode: 0o600 });
NODE
chmod 600 "$ENV_FILE"

echo
echo "Named Cloudflare Tunnel configured."
echo "Tunnel name: $TUNNEL_NAME"
echo "Tunnel ID: $TUNNEL_ID"
echo "Config: $CONFIG_FILE"
echo "Read-only RPC: $RPC_URL"
echo "Transaction relay: https://${RELAY_HOSTNAME}"
echo
echo "Run it in the foreground for the first verification:"
echo "  cloudflared tunnel --config '$CONFIG_FILE' run '$TUNNEL_ID'"
