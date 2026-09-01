#!/usr/bin/env bash
set -euo pipefail
set +x

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHAIN_ROOT="$(cd "$HERE/.." && pwd)"
ENV_FILE="${SWAPPULSE_INFRA_ENV_FILE:-$HERE/.env}"
MANIFEST="${SWAPPULSE_DEPLOYMENT_MANIFEST:-$CHAIN_ROOT/deployments/swappulse-testnet.json}"
RELAY_ENV="${SWAPPULSE_RELAY_ENV_FILE:-$HERE/.env.relay}"
NODE_BIN="${NODE_BIN:-node}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Host environment not found: $ENV_FILE" >&2
  echo "Create chain/infra/.env from .env.example before V2 activation." >&2
  exit 1
fi

# Load host-only operational values such as the Devnet seed and public hostnames.
# Nothing from this file is printed by this script.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

PUBLIC_RPC_URL="${SWAPPULSE_PUBLIC_RPC_URL:-}"
RELAY_HOSTNAME="${SWAPPULSE_TX_RELAY_HOSTNAME:-relay.swappulse.org}"
PUBLIC_RELAY_URL="${SWAPPULSE_TX_RELAY_PUBLIC_URL:-https://${RELAY_HOSTNAME}}"
RAW_RPC_PORT="${SWAPPULSE_RAW_RPC_PORT:-5050}"
GATEWAY_PORT="${SWAPPULSE_GATEWAY_PORT:-8080}"
RELAY_PORT="${SWAPPULSE_TX_RELAY_PORT:-8081}"

if [[ -z "$PUBLIC_RPC_URL" || "$PUBLIC_RPC_URL" != https://* ]]; then
  echo "SWAPPULSE_PUBLIC_RPC_URL must be the public read-only HTTPS RPC URL." >&2
  exit 1
fi
if [[ "$PUBLIC_RELAY_URL" != https://* ]]; then
  echo "The public relay URL must use HTTPS: $PUBLIC_RELAY_URL" >&2
  exit 1
fi

for cmd in curl docker awk stat sha256sum; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Required command is missing: $cmd" >&2
    exit 1
  fi
done
if ! command -v "$NODE_BIN" >/dev/null 2>&1 && [[ ! -x "$NODE_BIN" ]]; then
  echo "NODE_BIN does not point to an executable Node.js runtime: $NODE_BIN" >&2
  exit 1
fi
node_major="$("$NODE_BIN" -p "Number(process.versions.node.split('.')[0])")"
if (( node_major < 22 )); then
  echo "Node.js 22+ is required for SwapPulse V2 activation." >&2
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is required." >&2
  exit 1
fi

cd "$HERE"

echo "[1/8] Starting the private Devnet and read-only gateway..."
docker compose up -d --build devnet rpc-gateway

echo "[2/8] Confirming the raw RPC is loopback-only and the public RPC is reachable..."
raw_binding="$(docker compose port devnet 5050 2>/dev/null || true)"
if [[ "$raw_binding" != 127.0.0.1:* && "$raw_binding" != localhost:* ]]; then
  echo "Raw Devnet RPC is not bound only to loopback: ${raw_binding:-unknown}" >&2
  exit 1
fi
public_chain_response="$(curl -fsS --connect-timeout 10 --max-time 20 \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"starknet_chainId","params":[]}' \
  "$PUBLIC_RPC_URL")"
PUBLIC_CHAIN_RESPONSE="$public_chain_response" "$NODE_BIN" --input-type=module <<'NODE'
const payload = JSON.parse(process.env.PUBLIC_CHAIN_RESPONSE || '{}');
if (payload.error || !payload.result) throw new Error('Public RPC did not return starknet_chainId');
NODE

# The local gateway itself must reject privileged Devnet methods. This proves
# the policy independently of any Cloudflare/WAF rule on the public hostname.
local_privileged_http="$(curl -sS -o /tmp/swappulse-v2-local-privileged-check.$$ -w '%{http_code}' --connect-timeout 5 --max-time 10 \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":2,"method":"devnet_getPredeployedAccounts","params":{}}' \
  "http://127.0.0.1:${GATEWAY_PORT}/" || true)"
rm -f /tmp/swappulse-v2-local-privileged-check.$$
if [[ "$local_privileged_http" != "403" ]]; then
  echo "Local read-only gateway did not return HTTP 403 for a devnet_* request (got ${local_privileged_http:-unknown})." >&2
  exit 1
fi

# The same privileged method must also be rejected on the public path. A WAF
# may be the rejecting layer, so any successful HTTP 200 response is a failure.
public_privileged_http="$(curl -sS -o /tmp/swappulse-v2-public-privileged-check.$$ -w '%{http_code}' --connect-timeout 10 --max-time 20 \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":3,"method":"devnet_getPredeployedAccounts","params":{}}' \
  "$PUBLIC_RPC_URL" || true)"
rm -f /tmp/swappulse-v2-public-privileged-check.$$
if [[ "$public_privileged_http" == "200" || "$public_privileged_http" == "000" ]]; then
  echo "Public RPC did not safely reject a privileged devnet_* request (HTTP ${public_privileged_http:-unknown}). Refusing V2 activation." >&2
  exit 1
fi

echo "[3/8] Running the pinned Cairo/Foundry suite and relay policy security checks..."
(
  cd "$CHAIN_ROOT"
  SCARB_BIN="${SCARB_BIN:-scarb}" SNFORGE_BIN="${SNFORGE_BIN:-snforge}" \
    bash scripts/test-chain.sh
)
"$NODE_BIN" "$HERE/tx-relay/smoke-policy.mjs"

echo "[4/8] Deploying the V2 contract suite and verifying it against loopback Devnet..."
SWAPPULSE_DEPLOYMENT_MANIFEST="$MANIFEST" \
SWAPPULSE_PUBLIC_RPC_URL="$PUBLIC_RPC_URL" \
  "$HERE/deploy-contracts.sh"

if [[ ! -f "$MANIFEST" ]]; then
  echo "Deployment completed without producing the canonical manifest: $MANIFEST" >&2
  exit 1
fi

echo "[5/8] Independently verifying the canonical manifest through the public HTTPS RPC..."
env -u SWAPPULSE_VERIFY_RPC_URL \
  SWAPPULSE_DEPLOYMENT_MANIFEST="$MANIFEST" \
  "$NODE_BIN" "$CHAIN_ROOT/scripts/tooling/verify-network.mjs" "$MANIFEST" >/dev/null

echo "[6/8] Generating the V2 relay environment without silently rotating its bearer token..."
SWAPPULSE_DEPLOYMENT_MANIFEST="$MANIFEST" \
SWAPPULSE_RELAY_ENV_FILE="$RELAY_ENV" \
  "$HERE/setup-relay-env.sh"

relay_mode="$(stat -c '%a' "$RELAY_ENV" 2>/dev/null || true)"
if [[ ! "$relay_mode" =~ ^[0-7]{3,4}$ ]]; then
  echo "Could not verify relay environment permissions." >&2
  exit 1
fi
relay_mode_dec=$((8#$relay_mode))
if (( (relay_mode_dec & 077) != 0 )); then
  echo "Relay environment must not be accessible by group/other users: $RELAY_ENV (mode $relay_mode)" >&2
  exit 1
fi
RELAY_TOKEN="$(awk -F= '$1 == "RELAY_TOKEN" { sub(/^[^=]*=/, ""); print; exit }' "$RELAY_ENV")"
if (( ${#RELAY_TOKEN} < 32 || ${#RELAY_TOKEN} > 256 )) || [[ "$RELAY_TOKEN" =~ [[:space:]] ]]; then
  echo "Relay environment does not contain a valid strong bearer token." >&2
  exit 1
fi

authenticated_ready() {
  local url="$1"
  local retries="$2"
  # Feed the Authorization header through curl's stdin config so the bearer
  # token is not exposed in the curl process command line.
  printf 'header = "Authorization: Bearer %s"\n' "$RELAY_TOKEN" | \
    curl -fsS --retry "$retries" --retry-delay 1 --retry-connrefused \
      --connect-timeout 10 --max-time 20 --config - "$url"
}

echo "[7/8] Rebuilding the transaction relay in V2 mode and checking local readiness..."
docker compose --env-file "$ENV_FILE" --env-file "$RELAY_ENV" \
  --profile provisioning up -d --build tx-relay

local_ready="$(authenticated_ready "http://127.0.0.1:${RELAY_PORT}/readyz" 8)"
RELAY_READY_RESPONSE="$local_ready" "$NODE_BIN" --input-type=module <<'NODE'
const payload = JSON.parse(process.env.RELAY_READY_RESPONSE || '{}');
if (payload.ok !== true) throw new Error('Local relay readiness did not return ok=true');
if (String(payload.identity_verification_mode || '').toLowerCase() !== 'v2') {
  throw new Error('Local relay is not running in V2 identity-verification mode');
}
if (payload.ecosystem_ready !== true) throw new Error('Local relay V2 ecosystem is not ready');
NODE

echo "[8/8] Checking the same authenticated V2 readiness path through the public relay hostname..."
public_ready="$(authenticated_ready "${PUBLIC_RELAY_URL%/}/readyz" 4)"
RELAY_READY_RESPONSE="$public_ready" "$NODE_BIN" --input-type=module <<'NODE'
const payload = JSON.parse(process.env.RELAY_READY_RESPONSE || '{}');
if (payload.ok !== true) throw new Error('Public relay readiness did not return ok=true');
if (String(payload.identity_verification_mode || '').toLowerCase() !== 'v2') {
  throw new Error('Public relay is not running in V2 identity-verification mode');
}
if (payload.ecosystem_ready !== true) throw new Error('Public relay V2 ecosystem is not ready');
NODE

manifest_sha256="$(sha256sum "$MANIFEST" | awk '{print $1}')"
unset RELAY_TOKEN local_ready public_ready public_chain_response

echo
echo "SwapPulse host-side V2 activation passed all checks."
echo "Canonical manifest: $MANIFEST"
echo "Manifest SHA-256: $manifest_sha256"
echo "Public RPC: $PUBLIC_RPC_URL"
echo "Public relay: $PUBLIC_RELAY_URL"
echo "No private key or bearer token was printed."
echo "Next trust boundary: import this public manifest into Base44, then run its independent Verify & Activate check before provisioning the first identity."
