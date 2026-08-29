#!/usr/bin/env bash
set -euo pipefail
set +x

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHAIN_ROOT="$(cd "$HERE/.." && pwd)"
RAW_RPC_PORT="${SWAPPULSE_RAW_RPC_PORT:-5050}"
RAW_RPC="http://127.0.0.1:${RAW_RPC_PORT}"
MANIFEST="${SWAPPULSE_DEPLOYMENT_MANIFEST:-$CHAIN_ROOT/deployments/swappulse-testnet.json}"
NODE_BIN="${NODE_BIN:-node}"

if ! command -v "$NODE_BIN" >/dev/null 2>&1 && [[ ! -x "$NODE_BIN" ]]; then
  echo "NODE_BIN does not point to an executable Node.js runtime: $NODE_BIN" >&2
  exit 1
fi
node_major="$("$NODE_BIN" -p "Number(process.versions.node.split('.')[0])")"
if (( node_major < 22 )); then
  echo "Node.js 22+ is required for SwapPulse chain deployment tooling. Set NODE_BIN to a Node 22 executable." >&2
  exit 1
fi

if [[ ! -d "$CHAIN_ROOT/scripts/tooling/node_modules/starknet" ]]; then
  echo "Install chain tooling first: cd chain/scripts/tooling && npm ci" >&2
  exit 1
fi

read -r DEPLOYER_ADDRESS DEPLOYER_PRIVATE_KEY < <(
  RAW_RPC="$RAW_RPC" "$NODE_BIN" --input-type=module <<'NODE'
const response = await fetch(process.env.RAW_RPC, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'devnet_getPredeployedAccounts',
    params: { with_balance: true },
  }),
});
if (!response.ok) throw new Error(`Devnet RPC HTTP ${response.status}`);
const payload = await response.json();
if (payload.error) throw new Error(JSON.stringify(payload.error));
const account = payload.result?.[0];
if (!account?.address || !account?.private_key) throw new Error('No Devnet predeployed account available');
process.stdout.write(`${account.address} ${account.private_key}\n`);
NODE
)

if [[ -z "${DEPLOYER_ADDRESS:-}" || -z "${DEPLOYER_PRIVATE_KEY:-}" ]]; then
  echo "Could not obtain the local Devnet deployment account." >&2
  exit 1
fi

export SWAPPULSE_RPC_URL="$RAW_RPC"
export SWAPPULSE_DEPLOYER_ADDRESS="$DEPLOYER_ADDRESS"
export SWAPPULSE_DEPLOYER_PRIVATE_KEY="$DEPLOYER_PRIVATE_KEY"
export SWAPPULSE_RECOVERY_CONTROLLER="${SWAPPULSE_RECOVERY_CONTROLLER:-$DEPLOYER_ADDRESS}"
export SWAPPULSE_RECOVERY_DELAY_SECONDS="${SWAPPULSE_RECOVERY_DELAY_SECONDS:-172800}"
export SWAPPULSE_DEPLOYMENT_MANIFEST="$MANIFEST"

"$NODE_BIN" "$CHAIN_ROOT/scripts/tooling/deploy-network.mjs"
"$NODE_BIN" "$CHAIN_ROOT/scripts/tooling/verify-network.mjs" "$MANIFEST"

unset SWAPPULSE_DEPLOYER_PRIVATE_KEY DEPLOYER_PRIVATE_KEY

echo
echo "SwapPulse Testnet contracts are deployed and locally verified."
echo "Public manifest: $MANIFEST"
echo "Next: expose ONLY the read-only gateway over HTTPS, then save the manifest fields in Admin → Identity & Federation and use Verify & Activate."
