#!/usr/bin/env bash

# Verify SWAPPULSE_NODELAB_1 lite multi-peer agreement plus permanent V2 state.

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
CHAIN_ROOT="${1:-${NODELAB_CHAIN_ROOT:-}}"
ENDPOINT="http://127.0.0.1:${NODELAB_LITE_PORT:-18101}"
EXPECTED_CHAIN_ID="0x5357415050554c53455f4e4f44454c41425f31"
FAIL=0

say() { printf '%s\n' "$*"; }
fail() { printf 'FAIL: %s\n' "$*"; FAIL=1; }

if [ -z "$CHAIN_ROOT" ]; then
  printf 'Usage: bash verify-lite-agreement.sh /path/to/clean/chain\n'
  exit 1
fi
MANIFEST="$CHAIN_ROOT/deployments/swappulse-nodelab-1.json"
VERIFY_TOOL="$CHAIN_ROOT/scripts/tooling/verify-network.mjs"
if [ ! -f "$MANIFEST" ] || [ ! -f "$VERIFY_TOOL" ]; then
  printf 'Missing deployment manifest or verify-network tooling under %s.\n' "$CHAIN_ROOT"
  exit 1
fi

say "=== node-lab lite health ==="
HEALTH="$(curl -fsS --max-time 10 "$ENDPOINT/healthz" 2>/dev/null || true)"
printf '%s\n' "$HEALTH"
printf '%s' "$HEALTH" | grep -q '"ok":true' || fail "healthz did not report ok=true"

say
say "=== node-lab lite status ==="
STATUS="$(curl -fsS --max-time 15 "$ENDPOINT/status" 2>/dev/null || true)"
printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || printf '%s\n' "$STATUS"

STATUS_FILE="$(mktemp)"
printf '%s' "$STATUS" > "$STATUS_FILE"
if ! python3 - "$STATUS_FILE" "$EXPECTED_CHAIN_ID" <<'PY'
import json, sys
status_file, expected = sys.argv[1], sys.argv[2].lower()
try:
    with open(status_file, encoding='utf-8') as f:
        s = json.load(f)
except Exception:
    raise SystemExit(1)
checks = [
    s.get('network') == 'SWAPPULSE_NODELAB_1',
    str(s.get('chain_id', '')).lower() == expected,
    s.get('ready') is True,
    s.get('trust_mode') == 'multi-peer-agreement',
    s.get('configured_peer_count') == 2,
    s.get('healthy_peer_count') == 2,
    s.get('peer_agreement') is True,
    s.get('agreement_count') == 2,
    s.get('required_agreement') == 2,
    s.get('pins_verified') is True,
    s.get('pin_verified_peer_count') == 2,
    s.get('observer_state_independent') is True,
    s.get('operator_independence') is False,
]
peers = s.get('peers') or []
checks.append(len(peers) == 2)
checks.extend(bool(p.get('healthy')) and bool(p.get('chain_ok')) and bool(p.get('pins_ok')) for p in peers)
hashes = {p.get('common_block_hash') for p in peers if p.get('common_block_hash')}
checks.append(len(hashes) == 1)
raise SystemExit(0 if all(checks) else 1)
PY
then
  fail "lite status did not prove two healthy pinned peers in multi-peer agreement"
fi
rm -f "$STATUS_FILE"

say
say "=== chain id through lite read-only RPC ==="
CHAIN="$(curl -fsS --max-time 10 "$ENDPOINT/rpc" \
  -H 'content-type: application/json' \
  --data-binary '{"jsonrpc":"2.0","id":1,"method":"starknet_chainId","params":[]}' 2>/dev/null || true)"
printf '%s\n' "$CHAIN" | python3 -m json.tool 2>/dev/null || printf '%s\n' "$CHAIN"
printf '%s' "$CHAIN" | grep -qi "$EXPECTED_CHAIN_ID" || fail "lite RPC returned the wrong chain id"

say
say "=== write method remains denied ==="
TMP="$(mktemp)"
HTTP="$(curl -sS --max-time 10 -o "$TMP" -w '%{http_code}' "$ENDPOINT/rpc" \
  -H 'content-type: application/json' \
  --data-binary '{"jsonrpc":"2.0","id":2,"method":"starknet_addInvokeTransaction","params":[]}' 2>/dev/null || true)"
printf 'HTTP %s\n' "$HTTP"
cat "$TMP"
printf '\n'
[ "$HTTP" = "403" ] || fail "write RPC was not rejected with HTTP 403"
grep -q 'METHOD_NOT_ALLOWED' "$TMP" || fail "write rejection did not report METHOD_NOT_ALLOWED"
rm -f "$TMP"

say
say "=== permanent V2 state through sequencer and observer ==="
for RPC in http://127.0.0.1:19950 http://127.0.0.1:19951; do
  OUT="$(mktemp)"
  if SWAPPULSE_EXPECTED_NETWORK=SWAPPULSE_NODELAB_1 \
     SWAPPULSE_VERIFY_RPC_URL="$RPC" \
     node "$VERIFY_TOOL" "$MANIFEST" >"$OUT" 2>&1; then
    printf '%s\n' "--- $RPC ---"
    cat "$OUT"
    if ! python3 - "$OUT" <<'PY'
import json, sys
with open(sys.argv[1], encoding='utf-8') as f:
    r=json.load(f)
assert r.get('ok') is True
assert r.get('verification_v2_required') is True
assert r.get('ecosystem_ready') is True
PY
    then
      fail "$RPC did not independently verify permanent V2 state"
    fi
  else
    printf '%s\n' "--- $RPC verification failed ---"
    cat "$OUT"
    fail "$RPC verify-network failed"
  fi
  rm -f "$OUT"
done

say
say "=== physical/operator trust boundary ==="
say "Both peers use separate Madara databases and independent sync state on this host."
say "They are NOT independent physical operators and this is NOT permissionless consensus."

say
say "=== result ==="
if [ "$FAIL" -eq 0 ]; then
  say "VERIFY LITE AGREEMENT: PASS"
  say "Two pinned state sources agree, permanent V2 state is reproduced by both full nodes, and the lite RPC remains read-only."
  exit 0
fi
say "VERIFY LITE AGREEMENT: FAIL"
exit 1
