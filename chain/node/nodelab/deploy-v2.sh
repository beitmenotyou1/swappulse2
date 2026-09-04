#!/usr/bin/env bash

# Deploy the audited SwapPulse Cairo V2 suite into SWAPPULSE_NODELAB_1.
# Requires a clean, already-tested chain workspace and fresh authority accounts
# created by bootstrap-authorities.sh. Never touches live SWAPPULSE_TESTNET.

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
CHAIN_ROOT="${1:-${NODELAB_CHAIN_ROOT:-}}"
ENV_LOCAL="$HERE/.env.local"
MANIFEST_REL="deployments/swappulse-nodelab-1.json"
EXPECTED_CHAIN_ID="0x5357415050554c53455f4e4f44454c41425f31"
LEGACY_UDC_ADDRESS="0x041a78e741e5af2fec34b695679bc6891742439f7afb8484ecd7766661ad02bf"

if [ -z "$CHAIN_ROOT" ]; then
  printf 'Usage: bash deploy-v2.sh /path/to/clean/chain\n'
  exit 1
fi
if [ ! -f "$CHAIN_ROOT/scripts/tooling/deploy-network.mjs" ] || [ ! -f "$CHAIN_ROOT/scripts/tooling/verify-network.mjs" ]; then
  printf 'Clean chain workspace is missing deployment tooling.\n'
  exit 1
fi
if [ ! -d "$CHAIN_ROOT/scripts/tooling/node_modules/starknet" ]; then
  printf 'Missing tooling dependencies under %s/scripts/tooling.\n' "$CHAIN_ROOT"
  exit 1
fi
if [ ! -f "$CHAIN_ROOT/target/dev/swappulse_network.starknet_artifacts.json" ]; then
  printf 'Missing tested Cairo artifacts in the clean chain workspace.\n'
  exit 1
fi
if [ ! -f "$ENV_LOCAL" ]; then
  printf 'Missing node-lab .env.local.\n'
  exit 1
fi

DEPLOYER_ADDRESS="$(sed -n 's/^NODELAB_DEPLOYER_ADDRESS=//p' "$ENV_LOCAL" | head -n1)"
DEPLOYER_KEY="$(sed -n 's/^NODELAB_DEPLOYER_PRIVATE_KEY=//p' "$ENV_LOCAL" | head -n1)"
VERIFIER_ADDRESS="$(sed -n 's/^NODELAB_VERIFIER_ADDRESS=//p' "$ENV_LOCAL" | head -n1)"
if ! printf '%s' "$DEPLOYER_ADDRESS" | grep -Eq '^0x[0-9a-fA-F]+$'; then
  printf 'Fresh node-lab deployer address is missing. Run bootstrap-authorities.sh first.\n'
  exit 1
fi
if ! printf '%s' "$DEPLOYER_KEY" | grep -Eq '^0x[0-9a-fA-F]+$'; then
  printf 'Fresh node-lab deployer private key is missing.\n'
  exit 1
fi
if ! printf '%s' "$VERIFIER_ADDRESS" | grep -Eq '^0x[0-9a-fA-F]+$'; then
  printf 'Fresh node-lab verifier address is missing. Run bootstrap-authorities.sh first.\n'
  exit 1
fi

if ! bash "$HERE/verify-nodelab.sh"; then
  printf 'Two-node node-lab consistency must pass before contract deployment.\n'
  exit 1
fi

ACTUAL_CHAIN_ID="$(curl -fsS http://127.0.0.1:19950 \
  -H 'content-type: application/json' \
  --data-binary '{"jsonrpc":"2.0","id":1,"method":"starknet_chainId","params":[]}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin).get("result", ""))')"
if [ "$(printf '%s' "$ACTUAL_CHAIN_ID" | tr 'A-F' 'a-f')" != "$EXPECTED_CHAIN_ID" ]; then
  printf 'Refusing V2 deployment: sequencer chain ID is %s, expected %s\n' "$ACTUAL_CHAIN_ID" "$EXPECTED_CHAIN_ID"
  exit 1
fi

printf '\n=== verify Madara legacy UDC on both nodes ===\n'
for rpc in http://127.0.0.1:19950 http://127.0.0.1:19951; do
  UDC_HASH="$(curl -fsS "$rpc" \
    -H 'content-type: application/json' \
    --data-binary "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"starknet_getClassHashAt\",\"params\":[\"latest\",\"$LEGACY_UDC_ADDRESS\"]}" \
    | python3 -c 'import json,sys; p=json.load(sys.stdin); print(p.get("result", ""))')"
  if ! printf '%s' "$UDC_HASH" | grep -Eq '^0x[0-9a-fA-F]+$'; then
    printf 'Legacy Madara UDC is not readable through %s.\n' "$rpc"
    exit 1
  fi
  printf '%s UDC class hash: %s\n' "$rpc" "$UDC_HASH"
done

MANIFEST="$CHAIN_ROOT/$MANIFEST_REL"
mkdir -p "$(dirname "$MANIFEST")"

printf 'Deploying SwapPulse V2 suite to SWAPPULSE_NODELAB_1 using fresh lab authority.\n'
printf 'Manifest target: %s\n' "$MANIFEST"
printf 'Private keys are not printed or written to the manifest.\n'

SWAPPULSE_NETWORK_NAME=SWAPPULSE_NODELAB_1 \
SWAPPULSE_RPC_URL=http://127.0.0.1:19950 \
SWAPPULSE_PUBLIC_RPC_URL=http://127.0.0.1:19950 \
SWAPPULSE_DEPLOYER_ADDRESS="$DEPLOYER_ADDRESS" \
SWAPPULSE_DEPLOYER_PRIVATE_KEY="$DEPLOYER_KEY" \
SWAPPULSE_VERIFIER_ADDRESS="$VERIFIER_ADDRESS" \
SWAPPULSE_RECOVERY_CONTROLLER="$DEPLOYER_ADDRESS" \
SWAPPULSE_RECOVERY_DELAY_SECONDS=172800 \
SWAPPULSE_DEPLOYMENT_MANIFEST="$MANIFEST" \
SWAPPULSE_TOKEN_NAME='SwapPulse NodeLab 1' \
SWAPPULSE_TOKEN_SYMBOL=SWPX \
SWAPPULSE_UDC_ADDRESS="$LEGACY_UDC_ADDRESS" \
SWAPPULSE_UDC_ENTRYPOINT=deployContract \
node "$CHAIN_ROOT/scripts/tooling/deploy-network.mjs" || exit 1

unset DEPLOYER_KEY

printf '\n=== verify manifest through sequencer ===\n'
SWAPPULSE_EXPECTED_NETWORK=SWAPPULSE_NODELAB_1 \
SWAPPULSE_VERIFY_RPC_URL=http://127.0.0.1:19950 \
node "$CHAIN_ROOT/scripts/tooling/verify-network.mjs" "$MANIFEST" || exit 1

printf '\n=== wait for observer and verify same manifest independently ===\n'
OBSERVER_OK=0
for attempt in $(seq 1 60); do
  if SWAPPULSE_EXPECTED_NETWORK=SWAPPULSE_NODELAB_1 \
     SWAPPULSE_VERIFY_RPC_URL=http://127.0.0.1:19951 \
     node "$CHAIN_ROOT/scripts/tooling/verify-network.mjs" "$MANIFEST" >/tmp/swappulse-nodelab-observer-verify.log 2>&1; then
    OBSERVER_OK=1
    cat /tmp/swappulse-nodelab-observer-verify.log
    rm -f /tmp/swappulse-nodelab-observer-verify.log
    break
  fi
  sleep 2
done
if [ "$OBSERVER_OK" -ne 1 ]; then
  cat /tmp/swappulse-nodelab-observer-verify.log 2>/dev/null || true
  rm -f /tmp/swappulse-nodelab-observer-verify.log
  printf 'Observer did not independently verify the V2 manifest within the bounded wait.\n'
  exit 1
fi

printf '\nSWAPPULSE_NODELAB_1 V2 DEPLOYMENT: PASS\n'
printf 'Manifest: %s\n' "$MANIFEST"
printf 'The one-way require_verification_v2() switch has NOT been invoked by this deployment wrapper.\n'
