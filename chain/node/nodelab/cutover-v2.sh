#!/usr/bin/env bash

# Permanently require replay-protected V2 verification in SWAPPULSE_NODELAB_1.
# This is a test-network-only, irreversible contract-state transition.

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
CHAIN_ROOT="${1:-${NODELAB_CHAIN_ROOT:-}}"
ENV_LOCAL="$HERE/.env.local"
EXERCISE_RESULT="$HERE/v2-exercise.json"
CUTOVER_RESULT="$HERE/v2-cutover.json"
EXPECTED_CHAIN_ID="0x5357415050554c53455f4e4f44454c41425f31"

if [ -z "$CHAIN_ROOT" ]; then
  printf 'Usage: NODELAB_CONFIRM_V2_CUTOVER=YES bash cutover-v2.sh /path/to/clean/chain\n'
  exit 1
fi
if [ "${NODELAB_CONFIRM_V2_CUTOVER:-}" != "YES" ]; then
  printf 'Refusing the one-way node-lab cut-over without NODELAB_CONFIRM_V2_CUTOVER=YES.\n'
  exit 1
fi
if [ ! -f "$CHAIN_ROOT/scripts/tooling/cutover-nodelab-v2.mjs" ]; then
  printf 'Missing cut-over tooling under %s\n' "$CHAIN_ROOT"
  exit 1
fi
if [ ! -d "$CHAIN_ROOT/scripts/tooling/node_modules/starknet" ]; then
  printf 'Missing chain tooling dependencies under %s/scripts/tooling.\n' "$CHAIN_ROOT"
  exit 1
fi
MANIFEST="$CHAIN_ROOT/deployments/swappulse-nodelab-1.json"
if [ ! -f "$MANIFEST" ] || [ ! -f "$ENV_LOCAL" ] || [ ! -f "$EXERCISE_RESULT" ]; then
  printf 'Missing manifest, local node-lab env, or successful pre-cutover exercise evidence.\n'
  exit 1
fi

python3 - "$EXERCISE_RESULT" <<'PY'
import json, sys
with open(sys.argv[1], encoding='utf-8') as f:
    result = json.load(f)
assert result.get('ok') is True, 'pre-cutover exercise is not ok'
assert result.get('network') == 'SWAPPULSE_NODELAB_1', 'wrong pre-cutover network'
assert result.get('verification_v2_required') is False, 'pre-cutover flag is not false'
assert result.get('final_v2_active') is True, 'pre-cutover final V2 state is not active'
assert str(result.get('self_stake', '0')) == '110000000000000000000', 'pre-cutover stake is not 110 SWPX'
print('Pre-cutover evidence: PASS')
PY

if ! bash "$HERE/verify-nodelab.sh"; then
  printf 'Two-node consistency must pass immediately before the one-way cut-over.\n'
  exit 1
fi

ACTUAL_CHAIN_ID="$(curl -fsS http://127.0.0.1:19950 \
  -H 'content-type: application/json' \
  --data-binary '{"jsonrpc":"2.0","id":1,"method":"starknet_chainId","params":[]}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin).get("result", ""))')"
if [ "$(printf '%s' "$ACTUAL_CHAIN_ID" | tr 'A-F' 'a-f')" != "$EXPECTED_CHAIN_ID" ]; then
  printf 'Refusing cut-over on wrong chain: %s\n' "$ACTUAL_CHAIN_ID"
  exit 1
fi

if ! command -v openssl >/dev/null 2>&1; then
  printf 'openssl is required for fresh cut-over attestation ids.\n'
  exit 1
fi
for KEY in NODELAB_CUTOVER_ATTESTATION_1 NODELAB_CUTOVER_ATTESTATION_2; do
  if ! grep -q "^${KEY}=" "$ENV_LOCAL"; then
    printf '%s=0x%s\n' "$KEY" "$(openssl rand -hex 31)" >> "$ENV_LOCAL"
  fi
done
chmod 0600 "$ENV_LOCAL"

printf '\nStarting irreversible SWAPPULSE_NODELAB_1 V2 cut-over.\n'
printf 'The legacy verification writer will be permanently disabled on this node-lab registry.\n'
printf 'Local secret values will not be displayed.\n\n'

SWAPPULSE_DEPLOYMENT_MANIFEST="$MANIFEST" \
SWAPPULSE_RPC_URL=http://127.0.0.1:19950 \
SWAPPULSE_OBSERVER_RPC_URL=http://127.0.0.1:19951 \
NODELAB_V2_EXERCISE_RESULT_FILE="$EXERCISE_RESULT" \
NODELAB_ENV_FILE="$ENV_LOCAL" \
NODELAB_V2_CUTOVER_RESULT_FILE="$CUTOVER_RESULT" \
node "$CHAIN_ROOT/scripts/tooling/cutover-nodelab-v2.mjs"
STATUS=$?

if [ "$STATUS" -ne 0 ]; then
  printf '\nSWAPPULSE_NODELAB_1 V2 CUT-OVER: ATTENTION REQUIRED\n'
  printf 'Do not automatically rerun. The one-way flag may already have committed.\n'
  exit "$STATUS"
fi

printf '\n=== final two-node consistency ===\n'
bash "$HERE/verify-nodelab.sh" || exit 1

printf '\nSWAPPULSE_NODELAB_1 V2 CUT-OVER: PASS\n'
printf 'Public evidence: %s\n' "$CUTOVER_RESULT"
printf 'verification_v2_required is now permanently true for this node-lab registry.\n'
