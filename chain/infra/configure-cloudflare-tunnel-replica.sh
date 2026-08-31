#!/usr/bin/env bash
set -euo pipefail
set +x

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SWAPPULSE_ENV_FILE:-$HERE/.env}"
CF_DIR="${SWAPPULSE_CLOUDFLARED_DIR:-$HOME/.cloudflared}"
CLOUDFLARED_BIN="${CLOUDFLARED_BIN:-$(command -v cloudflared || true)}"
TUNNEL_ID="${1:-${SWAPPULSE_CLOUDFLARE_TUNNEL_ID:-}}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Environment file not found: $ENV_FILE" >&2
  exit 1
fi
if [[ -z "$CLOUDFLARED_BIN" || ! -x "$CLOUDFLARED_BIN" ]]; then
  echo "cloudflared executable not found" >&2
  exit 1
fi
if [[ ! "$TUNNEL_ID" =~ ^[0-9a-fA-F-]{36}$ ]]; then
  echo "Usage: bash ./configure-cloudflare-tunnel-replica.sh <existing-tunnel-uuid>" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

TUNNEL_NAME="${SWAPPULSE_CLOUDFLARE_TUNNEL_NAME:-swappulse-testnet}"
RPC_HOSTNAME="${SWAPPULSE_RPC_HOSTNAME:-rpc.swappulse.org}"
RELAY_HOSTNAME="${SWAPPULSE_TX_RELAY_HOSTNAME:-relay.swappulse.org}"
GATEWAY_PORT="${SWAPPULSE_GATEWAY_PORT:-8080}"
RELAY_PORT="${SWAPPULSE_TX_RELAY_PORT:-8081}"

for value in "$RPC_HOSTNAME" "$RELAY_HOSTNAME"; do
  if [[ -z "$value" || "$value" != *.* ]]; then
    echo "Invalid fixed SwapPulse hostname in $ENV_FILE" >&2
    exit 1
  fi
done
if [[ ! "$GATEWAY_PORT" =~ ^[0-9]+$ || ! "$RELAY_PORT" =~ ^[0-9]+$ ]]; then
  echo "Gateway and relay ports must be numeric." >&2
  exit 1
fi

mkdir -p "$CF_DIR"
chmod 700 "$CF_DIR"
CREDENTIALS_FILE="$CF_DIR/${TUNNEL_ID}.json"
if [[ ! -f "$CREDENTIALS_FILE" ]]; then
  echo "Tunnel-scoped credential is missing: $CREDENTIALS_FILE" >&2
  echo "Copy only ${TUNNEL_ID}.json from the current SwapPulse host over the private Tailscale path." >&2
  echo "Do not copy cert.pem to this runtime host." >&2
  exit 1
fi
chmod 600 "$CREDENTIALS_FILE"

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

cat <<EOF
SwapPulse tunnel replica configured without an account-wide Cloudflare certificate.
Tunnel ID: $TUNNEL_ID
Config: $CONFIG_FILE
RPC: https://${RPC_HOSTNAME}/rpc
Relay: https://${RELAY_HOSTNAME}

Start the replica for verification with:
  cloudflared tunnel --config '$CONFIG_FILE' run '$TUNNEL_ID'

After verification, install the dedicated boot service with:
  bash '$HERE/install-swappulse-tunnel-service.sh'
EOF
