#!/usr/bin/env bash

# Deliberately stop only the SWAPPULSE_NODELAB_1 sequencer, prove the
# two-peer lite verifier fails closed while the observer remains available,
# then restore the sequencer from its preserved database and require automatic
# return to multi-peer agreement.
#
# This script does not stop the observer, the live SWAPPULSE_TESTNET services,
# or the existing lite node on 127.0.0.1:18100.

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
CHAIN_ROOT="${1:-${NODELAB_CHAIN_ROOT:-}}"
PROJECT="swappulse-nodelab-1"
LITE="http://127.0.0.1:${NODELAB_LITE_PORT:-18101}"
SEQ="http://127.0.0.1:${NODELAB_SEQUENCER_RPC_PORT:-19950}"
OBS="http://127.0.0.1:${NODELAB_OBSERVER_RPC_PORT:-19951}"
FAIL=0

say() { printf '%s\n' "$*"; }
fail() { printf 'FAIL: %s\n' "$*"; FAIL=1; }

if [ "${NODELAB_CONFIRM_SEQUENCER_FAULT:-}" != "YES" ]; then
  printf 'Refusing deliberate sequencer fault without NODELAB_CONFIRM_SEQUENCER_FAULT=YES.\n'
  exit 1
fi
if [ -z "$CHAIN_ROOT" ]; then
  printf 'Usage: NODELAB_CONFIRM_SEQUENCER_FAULT=YES bash test-lite-sequencer-fault.sh /path/to/clean/chain\n'
  exit 1
fi
for FILE in "$HERE/.env.local" "$HERE/.env.image" "$HERE/start-sequencer.sh" "$HERE/verify-lite-agreement.sh"; do
  if [ ! -f "$FILE" ]; then
    printf 'Missing required file: %s\n' "$FILE"
    exit 1
  fi
done

rpc_result() {
  URL="$1"
  METHOD="$2"
  curl -fsS --max-time 10 "$URL" \
    -H 'content-type: application/json' \
    --data-binary "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"$METHOD\",\"params\":[]}" 2>/dev/null \
    | python3 -c 'import json,sys; print(json.load(sys.stdin).get("result", ""))' 2>/dev/null
}

say "=== pre-fault agreement gate ==="
if ! bash "$HERE/verify-lite-agreement.sh" "$CHAIN_ROOT"; then
  printf 'Pre-fault multi-peer agreement is not healthy. Refusing fault injection.\n'
  exit 1
fi

PRE_SEQ_HEAD="$(rpc_result "$SEQ" starknet_blockNumber || true)"
PRE_OBS_HEAD="$(rpc_result "$OBS" starknet_blockNumber || true)"
if ! printf '%s' "$PRE_SEQ_HEAD" | grep -Eq '^[0-9]+$'; then
  printf 'Could not read sequencer head before fault injection.\n'
  exit 1
fi
if ! printf '%s' "$PRE_OBS_HEAD" | grep -Eq '^[0-9]+$'; then
  printf 'Could not read observer head before fault injection.\n'
  exit 1
fi
say "pre_fault_sequencer_head=$PRE_SEQ_HEAD"
say "pre_fault_observer_head=$PRE_OBS_HEAD"

say
say "=== stop ONLY the node-lab sequencer ==="
if ! docker compose -p "$PROJECT" \
  --env-file "$HERE/.env.local" \
  --env-file "$HERE/.env.image" \
  -f "$HERE/docker-compose.yml" \
  stop sequencer; then
  printf 'Sequencer stop failed. Aborting fault injection.\n'
  exit 1
fi

say
say "=== prove sequencer is unavailable while observer/live services survive ==="
if curl -fsS --max-time 3 "$SEQ/health" >/dev/null 2>&1; then
  fail "sequencer RPC still responds after deliberate stop"
else
  say "sequencer RPC: unavailable as intended"
fi
if curl -fsS --max-time 5 "$OBS/health" >/dev/null 2>&1; then
  say "observer RPC: healthy"
else
  fail "observer RPC was affected by sequencer stop"
fi
for URL in \
  http://127.0.0.1:18080/healthz \
  http://127.0.0.1:18081/healthz \
  http://127.0.0.1:18100/healthz
do
  if curl -fsS --max-time 5 "$URL" >/dev/null 2>&1; then
    say "$URL -> healthy"
  else
    fail "$URL was affected by sequencer stop"
  fi
done

say
say "=== wait for lite verifier to fail closed ==="
DEGRADED=0
STATUS=""
for _ in $(seq 1 20); do
  STATUS="$(curl -fsS --max-time 5 "$LITE/status" 2>/dev/null || true)"
  if printf '%s' "$STATUS" | python3 -c '
import json,sys
try:
    s=json.load(sys.stdin)
except Exception:
    raise SystemExit(1)
ok=(
    s.get("ready") is False and
    s.get("peer_agreement") is False and
    s.get("trust_mode")=="multi-peer-disagreement" and
    s.get("configured_peer_count")==2 and
    s.get("healthy_peer_count")==1 and
    s.get("required_agreement")==2 and
    s.get("pin_verified_peer_count") < 2 and
    s.get("pins_verified") is False and
    s.get("independently_verified") is False
)
raise SystemExit(0 if ok else 1)
' 2>/dev/null; then
    DEGRADED=1
    break
  fi
  sleep 2
done
if [ "$DEGRADED" -ne 1 ]; then
  fail "lite verifier did not enter fail-closed two-peer disagreement state"
fi
printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || printf '%s\n' "$STATUS"

say
say "=== readyz must fail ==="
TMP="$(mktemp)"
READY_HTTP="$(curl -sS --max-time 10 -o "$TMP" -w '%{http_code}' "$LITE/readyz" 2>/dev/null || true)"
printf 'HTTP %s\n' "$READY_HTTP"
cat "$TMP" 2>/dev/null || true
printf '\n'
[ "$READY_HTTP" = "503" ] || fail "readyz did not return HTTP 503 during sequencer loss"
rm -f "$TMP"

say
say "=== read RPC must fail closed instead of trusting observer alone ==="
TMP="$(mktemp)"
RPC_HTTP="$(curl -sS --max-time 10 -o "$TMP" -w '%{http_code}' "$LITE/rpc" \
  -H 'content-type: application/json' \
  --data-binary '{"jsonrpc":"2.0","id":3,"method":"starknet_chainId","params":[]}' 2>/dev/null || true)"
printf 'HTTP %s\n' "$RPC_HTTP"
cat "$TMP" 2>/dev/null || true
printf '\n'
[ "$RPC_HTTP" = "503" ] || fail "lite read RPC did not return HTTP 503 during sequencer loss"
grep -q 'NO_VERIFIED_PEER' "$TMP" 2>/dev/null || fail "lite read RPC did not report NO_VERIFIED_PEER"
rm -f "$TMP"

say
say "=== restore sequencer from preserved database ==="
if bash "$HERE/start-sequencer.sh"; then
  say "sequencer restart command: PASS"
else
  fail "sequencer did not restart cleanly"
fi

say
say "=== wait for observer catch-up and lite agreement recovery ==="
RECOVERED=0
STATUS=""
for _ in $(seq 1 60); do
  STATUS="$(curl -fsS --max-time 5 "$LITE/status" 2>/dev/null || true)"
  if printf '%s' "$STATUS" | python3 -c '
import json,sys
try:
    s=json.load(sys.stdin)
except Exception:
    raise SystemExit(1)
ok=(
    s.get("ready") is True and
    s.get("peer_agreement") is True and
    s.get("trust_mode")=="multi-peer-agreement" and
    s.get("healthy_peer_count")==2 and
    s.get("agreement_count")==2 and
    s.get("pin_verified_peer_count")==2 and
    s.get("pins_verified") is True and
    s.get("independently_verified") is True
)
raise SystemExit(0 if ok else 1)
' 2>/dev/null; then
    RECOVERED=1
    break
  fi
  sleep 2
done
if [ "$RECOVERED" -ne 1 ]; then
  fail "lite verifier did not automatically recover multi-peer agreement"
fi
printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || printf '%s\n' "$STATUS"

POST_SEQ_HEAD="$(rpc_result "$SEQ" starknet_blockNumber || true)"
POST_OBS_HEAD="$(rpc_result "$OBS" starknet_blockNumber || true)"
if printf '%s' "$POST_SEQ_HEAD" | grep -Eq '^[0-9]+$'; then
  say "post_restore_sequencer_head=$POST_SEQ_HEAD"
  if [ "$POST_SEQ_HEAD" -lt "$PRE_SEQ_HEAD" ]; then
    fail "restored sequencer head is below its pre-fault confirmed head"
  fi
else
  fail "could not read sequencer head after restoration"
fi
if printf '%s' "$POST_OBS_HEAD" | grep -Eq '^[0-9]+$'; then
  say "post_restore_observer_head=$POST_OBS_HEAD"
  if [ "$POST_OBS_HEAD" -lt "$PRE_OBS_HEAD" ]; then
    fail "observer head is below its pre-fault confirmed head after sequencer restoration"
  fi
else
  fail "could not read observer head after restoration"
fi

say
say "=== final full agreement verification ==="
if ! bash "$HERE/verify-lite-agreement.sh" "$CHAIN_ROOT"; then
  fail "final lite agreement verification failed after sequencer restoration"
fi

say
say "=== result ==="
if [ "$FAIL" -eq 0 ]; then
  say "LITE SEQUENCER FAULT/RECOVERY: PASS"
  say "Sequencer loss forced readiness/read-RPC failure while the observer survived; sequencer restoration recovered two-peer agreement automatically."
  exit 0
fi
say "LITE SEQUENCER FAULT/RECOVERY: ATTENTION REQUIRED"
say "The script attempted sequencer restoration before returning this failure. Inspect current sequencer/observer/lite state before another fault run."
exit 1
