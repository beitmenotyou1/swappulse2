#!/usr/bin/env bash

# Read-only live verification for the isolated SwapPulse lite node.
# This script does not mutate chain state or stop/start any container.

ENDPOINT="${SWAPPULSE_LITE_ENDPOINT:-http://127.0.0.1:18100}"
FAIL=0

say() { printf '%s\n' "$*"; }
fail() { printf 'FAIL: %s\n' "$*"; FAIL=1; }

say "=== health ==="
HEALTH="$(curl -fsS --max-time 10 "$ENDPOINT/healthz" 2>/dev/null || true)"
printf '%s\n' "$HEALTH"
printf '%s' "$HEALTH" | grep -q '"ok":true' || fail "healthz did not report ok=true"

say
say "=== status ==="
STATUS="$(curl -fsS --max-time 15 "$ENDPOINT/status" 2>/dev/null || true)"
printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || printf '%s\n' "$STATUS"
printf '%s' "$STATUS" | grep -q '"ready":true' || fail "lite node is not ready"
printf '%s' "$STATUS" | grep -q '"pins_verified":true' || fail "frozen V2 contract pins were not verified"
printf '%s' "$STATUS" | grep -q '"trust_mode":"single-peer-degraded"' || fail "expected current single-peer-degraded trust mode"
printf '%s' "$STATUS" | grep -q '"independently_verified":false' || fail "single-peer mode must not claim independent verification"

say
say "=== chain id through local read-only RPC ==="
CHAIN="$(curl -fsS --max-time 10 "$ENDPOINT/rpc" \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"starknet_chainId","params":[]}' 2>/dev/null || true)"
printf '%s\n' "$CHAIN" | python3 -m json.tool 2>/dev/null || printf '%s\n' "$CHAIN"
printf '%s' "$CHAIN" | grep -q '0x534e5f5345504f4c4941' || fail "local lite RPC returned the wrong chain id"

say
say "=== write-method denial ==="
TMP="$(mktemp)"
HTTP="$(curl -sS --max-time 10 -o "$TMP" -w '%{http_code}' "$ENDPOINT/rpc" \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":2,"method":"starknet_addInvokeTransaction","params":[]}' 2>/dev/null || true)"
printf 'HTTP %s\n' "$HTTP"
cat "$TMP"
printf '\n'
if [ "$HTTP" != "403" ]; then fail "write RPC was not rejected with HTTP 403"; fi
grep -q 'METHOD_NOT_ALLOWED' "$TMP" || fail "write rejection did not report METHOD_NOT_ALLOWED"
rm -f "$TMP"

say
say "=== result ==="
if [ "$FAIL" -eq 0 ]; then
  say "VERIFY: PASS"
  say "Frozen V2 pins verified; local RPC is read-only; single-peer mode does not claim independent verification."
else
  say "VERIFY: FAIL"
fi
