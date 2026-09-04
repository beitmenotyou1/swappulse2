#!/usr/bin/env bash

# Exercise genuine SWAPPULSE_NODELAB_1 V2 identity/assurance + staking state.
# This deliberately does NOT invoke require_verification_v2().

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
CHAIN_ROOT="${1:-${NODELAB_CHAIN_ROOT:-}}"
ENV_LOCAL="$HERE/.env.local"
RESULT="$HERE/v2-exercise.json"
EXPECTED_CHAIN_ID="0x5357415050554c53455f4e4f44454c41425f31"

if [ -z "$CHAIN_ROOT" ]; then
  printf 'Usage: bash exercise-v2.sh /path/to/clean/chain\n'
  exit 1
fi
if [ ! -f "$CHAIN_ROOT/scripts/tooling/exercise-nodelab-v2.mjs" ]; then
  printf 'Missing V2 exercise tooling under %s\n' "$CHAIN_ROOT"
  exit 1
fi
if [ ! -d "$CHAIN_ROOT/scripts/tooling/node_modules/starknet" ]; then
  printf 'Missing chain tooling dependencies under %s/scripts/tooling.\n' "$CHAIN_ROOT"
  exit 1
fi
MANIFEST="$CHAIN_ROOT/deployments/swappulse-nodelab-1.json"
if [ ! -f "$MANIFEST" ]; then
  printf 'Missing node-lab deployment manifest: %s\n' "$MANIFEST"
  exit 1
fi
if [ ! -f "$ENV_LOCAL" ]; then
  printf 'Missing node-lab .env.local.\n'
  exit 1
fi
if ! bash "$HERE/verify-nodelab.sh"; then
  printf 'Two-node consistency must pass before the V2 exercise.\n'
  exit 1
fi

ACTUAL_CHAIN_ID="$(curl -fsS http://127.0.0.1:19950 \
  -H 'content-type: application/json' \
  --data-binary '{"jsonrpc":"2.0","id":1,"method":"starknet_chainId","params":[]}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin).get("result", ""))')"
if [ "$(printf '%s' "$ACTUAL_CHAIN_ID" | tr 'A-F' 'a-f')" != "$EXPECTED_CHAIN_ID" ]; then
  printf 'Refusing V2 exercise on wrong chain: %s\n' "$ACTUAL_CHAIN_ID"
  exit 1
fi

append_random_if_missing() {
  KEY="$1"
  if ! grep -q "^${KEY}=" "$ENV_LOCAL"; then
    printf '%s=0x%s\n' "$KEY" "$(openssl rand -hex 31)" >> "$ENV_LOCAL"
  fi
}

if ! command -v openssl >/dev/null 2>&1; then
  printf 'openssl is required for fresh node-lab test values.\n'
  exit 1
fi
append_random_if_missing NODELAB_TEST_USER_PRIVATE_KEY
append_random_if_missing NODELAB_TEST_IDENTITY_ID
append_random_if_missing NODELAB_TEST_ATTESTATION_1
append_random_if_missing NODELAB_TEST_ATTESTATION_2
append_random_if_missing NODELAB_TEST_ATTESTATION_3
append_random_if_missing NODELAB_TEST_ATTESTATION_4
chmod 0600 "$ENV_LOCAL"

read_env() {
  sed -n "s/^$1=//p" "$ENV_LOCAL" | head -n1
}

DEPLOYER_KEY="$(read_env NODELAB_DEPLOYER_PRIVATE_KEY)"
VERIFIER_KEY="$(read_env NODELAB_VERIFIER_PRIVATE_KEY)"
USER_KEY="$(read_env NODELAB_TEST_USER_PRIVATE_KEY)"
IDENTITY_ID="$(read_env NODELAB_TEST_IDENTITY_ID)"
ATTESTATION_1="$(read_env NODELAB_TEST_ATTESTATION_1)"
ATTESTATION_2="$(read_env NODELAB_TEST_ATTESTATION_2)"
ATTESTATION_3="$(read_env NODELAB_TEST_ATTESTATION_3)"
ATTESTATION_4="$(read_env NODELAB_TEST_ATTESTATION_4)"

for VALUE in "$DEPLOYER_KEY" "$VERIFIER_KEY" "$USER_KEY" "$IDENTITY_ID" \
  "$ATTESTATION_1" "$ATTESTATION_2" "$ATTESTATION_3" "$ATTESTATION_4"; do
  if ! printf '%s' "$VALUE" | grep -Eq '^0x[0-9a-fA-F]+$'; then
    printf 'A required node-lab private/test value is missing or invalid.\n'
    exit 1
  fi
done

printf 'Running bounded genuine V2 identity/assurance/staking exercise.\n'
printf 'Private keys remain in .env.local and will not be displayed.\n'
printf 'The irreversible V2 requirement switch remains disabled by this script.\n'

SWAPPULSE_DEPLOYMENT_MANIFEST="$MANIFEST" \
SWAPPULSE_RPC_URL=http://127.0.0.1:19950 \
SWAPPULSE_OBSERVER_RPC_URL=http://127.0.0.1:19951 \
NODELAB_DEPLOYER_PRIVATE_KEY="$DEPLOYER_KEY" \
NODELAB_VERIFIER_PRIVATE_KEY="$VERIFIER_KEY" \
NODELAB_TEST_USER_PRIVATE_KEY="$USER_KEY" \
NODELAB_TEST_IDENTITY_ID="$IDENTITY_ID" \
NODELAB_TEST_ATTESTATION_1="$ATTESTATION_1" \
NODELAB_TEST_ATTESTATION_2="$ATTESTATION_2" \
NODELAB_TEST_ATTESTATION_3="$ATTESTATION_3" \
NODELAB_TEST_ATTESTATION_4="$ATTESTATION_4" \
NODELAB_V2_RESULT_FILE="$RESULT" \
node "$CHAIN_ROOT/scripts/tooling/exercise-nodelab-v2.mjs"
STATUS=$?

unset DEPLOYER_KEY VERIFIER_KEY USER_KEY IDENTITY_ID \
  ATTESTATION_1 ATTESTATION_2 ATTESTATION_3 ATTESTATION_4

if [ "$STATUS" -ne 0 ]; then
  printf 'SWAPPULSE_NODELAB_1 V2 EXERCISE: FAIL\n'
  exit "$STATUS"
fi

printf '\n=== re-check two-node block consistency ===\n'
bash "$HERE/verify-nodelab.sh" || exit 1

printf '\nSWAPPULSE_NODELAB_1 V2 EXERCISE: PASS\n'
printf 'Public evidence: %s\n' "$RESULT"
printf 'require_verification_v2() has NOT been invoked.\n'
