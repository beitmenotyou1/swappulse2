#!/usr/bin/env bash
set -euo pipefail
set +x

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHAIN_ROOT="$(cd "$HERE/.." && pwd)"
RAW_RPC_PORT="${SWAPPULSE_RAW_RPC_PORT:-5050}"
RAW_RPC="http://127.0.0.1:${RAW_RPC_PORT}"
MANIFEST="${SWAPPULSE_DEPLOYMENT_MANIFEST:-$CHAIN_ROOT/deployments/swappulse-testnet.json}"
NODE_BIN="${NODE_BIN:-node}"
USC_BIN="${USC_BIN:-universal-sierra-compiler}"
EXPECTED_USC_VERSION="2.8.0"
PUBLIC_RPC_URL="${SWAPPULSE_PUBLIC_RPC_URL:-}"

if [[ -z "$PUBLIC_RPC_URL" ]]; then
  echo "Set SWAPPULSE_PUBLIC_RPC_URL to the public read-only HTTPS gateway before deploying contracts." >&2
  exit 1
fi

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

# Devnet persists state after each block. A read-only bind mount can allow the
# node to start normally but make a successful transaction fail while dumping
# state, which is especially confusing during contract deployment.
if command -v docker >/dev/null 2>&1; then
  devnet_cid="$(cd "$HERE" && docker compose ps -q devnet 2>/dev/null || true)"
  if [[ -n "$devnet_cid" ]]; then
    if ! docker exec "$devnet_cid" sh -c \
      'test -w /data && { test ! -e /data/swappulse-testnet.dump || test -w /data/swappulse-testnet.dump; }' \
      >/dev/null 2>&1; then
      echo "Devnet cannot write /data/swappulse-testnet.dump." >&2
      echo "Repair chain/infra/data ownership for the Devnet container before deploying." >&2
      echo "See chain/infra/ZORIN_LOCAL_RELAY.md step 5." >&2
      exit 1
    fi
  fi
fi

if ! command -v "$USC_BIN" >/dev/null 2>&1 && [[ ! -x "$USC_BIN" ]]; then
  echo "Universal Sierra Compiler is required for Devnet-compatible declaration artifacts: $USC_BIN" >&2
  exit 1
fi
usc_version="$("$USC_BIN" --version | awk '{print $2}')"
# Devnet 0.8.2 is built with universal-sierra-compiler 2.8.0 (Cairo 2.17.0).
# The DECLARE transaction carries a compiled class hash, so using a different
# USC release can make Devnet compile the same Sierra to a different CASM hash
# and reject it with "Mismatch compiled class hash".
if [[ "$usc_version" != "$EXPECTED_USC_VERSION" ]]; then
  echo "Universal Sierra Compiler $EXPECTED_USC_VERSION is required, found ${usc_version:-unknown}." >&2
  echo "Set USC_BIN to the pinned compiler binary before deploying." >&2
  exit 1
fi

REGISTRY_SIERRA="$CHAIN_ROOT/target/dev/swappulse_network_IdentityRegistry.contract_class.json"
REGISTRY_CASM="$CHAIN_ROOT/target/dev/swappulse_network_IdentityRegistry.casm.json"
ACCOUNT_SIERRA="$CHAIN_ROOT/target/dev/swappulse_network_SwapPulseAccount.contract_class.json"
ACCOUNT_CASM="$CHAIN_ROOT/target/dev/swappulse_network_SwapPulseAccount.casm.json"

for sierra in "$REGISTRY_SIERRA" "$ACCOUNT_SIERRA"; do
  if [[ ! -f "$sierra" ]]; then
    echo "Missing Sierra artifact: $sierra" >&2
    echo "Build/test the Cairo contracts first: cd chain && SCARB_BIN=scarb SNFORGE_BIN=snforge bash scripts/test-chain.sh" >&2
    exit 1
  fi
done

echo "Regenerating deployment CASM with universal-sierra-compiler $usc_version..."
"$USC_BIN" compile-contract --sierra-path "$REGISTRY_SIERRA" --output-path "$REGISTRY_CASM"
"$USC_BIN" compile-contract --sierra-path "$ACCOUNT_SIERRA" --output-path "$ACCOUNT_CASM"

read -r DEPLOYER_ADDRESS DEPLOYER_PRIVATE_KEY VERIFIER_ADDRESS < <(
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
const deployer = payload.result?.[0];
const verifier = payload.result?.[1];
if (!deployer?.address || !deployer?.private_key) throw new Error('No Devnet deployment account available');
if (!verifier?.address || !verifier?.private_key) throw new Error('No separate Devnet verifier account available');
if (BigInt(deployer.address) === BigInt(verifier.address)) throw new Error('Devnet deployer and verifier must be separate accounts');
process.stdout.write(`${deployer.address} ${deployer.private_key} ${verifier.address}\n`);
NODE
)

if [[ -z "${DEPLOYER_ADDRESS:-}" || -z "${DEPLOYER_PRIVATE_KEY:-}" || -z "${VERIFIER_ADDRESS:-}" ]]; then
  echo "Could not obtain separate local Devnet deployment and verifier accounts." >&2
  exit 1
fi

export SWAPPULSE_RPC_URL="$RAW_RPC"
export SWAPPULSE_PUBLIC_RPC_URL="$PUBLIC_RPC_URL"
export SWAPPULSE_DEPLOYER_ADDRESS="$DEPLOYER_ADDRESS"
export SWAPPULSE_DEPLOYER_PRIVATE_KEY="$DEPLOYER_PRIVATE_KEY"
export SWAPPULSE_VERIFIER_ADDRESS="${SWAPPULSE_VERIFIER_ADDRESS:-$VERIFIER_ADDRESS}"
export SWAPPULSE_RECOVERY_CONTROLLER="${SWAPPULSE_RECOVERY_CONTROLLER:-$DEPLOYER_ADDRESS}"
export SWAPPULSE_RECOVERY_DELAY_SECONDS="${SWAPPULSE_RECOVERY_DELAY_SECONDS:-172800}"
export SWAPPULSE_DEPLOYMENT_MANIFEST="$MANIFEST"

"$NODE_BIN" "$CHAIN_ROOT/scripts/tooling/deploy-network.mjs"
SWAPPULSE_VERIFY_RPC_URL="$RAW_RPC" \
  "$NODE_BIN" "$CHAIN_ROOT/scripts/tooling/verify-network.mjs" "$MANIFEST"

unset SWAPPULSE_DEPLOYER_PRIVATE_KEY DEPLOYER_PRIVATE_KEY

echo
echo "SwapPulse Testnet contracts are deployed and locally verified."
echo "Public manifest: $MANIFEST"
echo "The manifest contains the public read-only HTTPS RPC, never the localhost raw RPC."
echo "Before Base44 activation, verify the manifest again without SWAPPULSE_VERIFY_RPC_URL so the public HTTPS gateway is tested too."
