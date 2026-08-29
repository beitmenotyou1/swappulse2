#!/usr/bin/env bash
set -euo pipefail
set +x

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHAIN_ROOT="$(cd "$HERE/.." && pwd)"
NODE_BIN="${NODE_BIN:-node}"
RAW_RPC_PORT="${SWAPPULSE_RAW_RPC_PORT:-5050}"
RAW_RPC="http://127.0.0.1:${RAW_RPC_PORT}"
MANIFEST="${SWAPPULSE_DEPLOYMENT_MANIFEST:-$CHAIN_ROOT/deployments/swappulse-testnet.json}"
USER_KEY_FILE="${SWAPPULSE_USER_KEY_FILE:-$HERE/secrets/test-identity.key}"
IDENTITY_ID="${SWAPPULSE_IDENTITY_ID:-}"

if [[ -z "$IDENTITY_ID" ]]; then
  echo "Set SWAPPULSE_IDENTITY_ID to the opaque identity id returned by Base44 Prepare Test Identity." >&2
  exit 1
fi
if [[ ! -f "$USER_KEY_FILE" ]]; then
  echo "Signer file not found: $USER_KEY_FILE" >&2
  echo "Create one with the Node 22 create-test-signer.mjs helper first." >&2
  exit 1
fi
if [[ ! -f "$MANIFEST" ]]; then
  echo "Deployment manifest not found: $MANIFEST" >&2
  exit 1
fi
if ! command -v "$NODE_BIN" >/dev/null 2>&1 && [[ ! -x "$NODE_BIN" ]]; then
  echo "NODE_BIN does not point to an executable Node.js runtime: $NODE_BIN" >&2
  exit 1
fi
node_major="$("$NODE_BIN" -p "Number(process.versions.node.split('.')[0])")"
if (( node_major < 22 )); then
  echo "Node.js 22+ is required. Set NODE_BIN to a Node 22 executable." >&2
  exit 1
fi

file_mode="$(stat -c '%a' "$USER_KEY_FILE" 2>/dev/null || stat -f '%Lp' "$USER_KEY_FILE")"
if [[ "$file_mode" != "600" ]]; then
  echo "Signer file must have mode 0600; current mode is $file_mode" >&2
  exit 1
fi

read -r REGISTRY_ADMIN_ADDRESS REGISTRY_ADMIN_PRIVATE_KEY < <(
  RAW_RPC="$RAW_RPC" "$NODE_BIN" --input-type=module <<'NODE'
const response = await fetch(process.env.RAW_RPC, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'devnet_getPredeployedAccounts', params: { with_balance: true } }),
});
if (!response.ok) throw new Error(`Devnet RPC HTTP ${response.status}`);
const payload = await response.json();
if (payload.error) throw new Error(JSON.stringify(payload.error));
const account = payload.result?.[0];
if (!account?.address || !account?.private_key) throw new Error('No Devnet predeployed registry admin available');
process.stdout.write(`${account.address} ${account.private_key}\n`);
NODE
)

USER_PRIVATE_KEY="$(tr -d '[:space:]' < "$USER_KEY_FILE")"
if [[ -z "$USER_PRIVATE_KEY" ]]; then
  echo "Signer file is empty" >&2
  exit 1
fi

export SWAPPULSE_DEPLOYMENT_MANIFEST="$MANIFEST"
export SWAPPULSE_RAW_RPC_URL="$RAW_RPC"
export SWAPPULSE_REGISTRY_ADMIN_ADDRESS="$REGISTRY_ADMIN_ADDRESS"
export SWAPPULSE_REGISTRY_ADMIN_PRIVATE_KEY="$REGISTRY_ADMIN_PRIVATE_KEY"
export SWAPPULSE_USER_PRIVATE_KEY="$USER_PRIVATE_KEY"
export SWAPPULSE_IDENTITY_ID="$IDENTITY_ID"
export SWAPPULSE_ALLOW_DEVNET_MINT=true

"$NODE_BIN" "$CHAIN_ROOT/scripts/tooling/provision-test-identity.mjs"

unset SWAPPULSE_REGISTRY_ADMIN_PRIVATE_KEY SWAPPULSE_USER_PRIVATE_KEY REGISTRY_ADMIN_PRIVATE_KEY USER_PRIVATE_KEY

echo
echo "Provisioning complete. Copy only the public account address and transaction hashes into Base44 Record Deployment, then run Reconcile From Chain."
