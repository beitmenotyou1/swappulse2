#!/usr/bin/env bash

# Start an isolated host-process lite verifier for SWAPPULSE_NODELAB_1.
# It listens only on 127.0.0.1:18101 and does not stop/reconfigure the live
# containerised lite node on 127.0.0.1:18100.

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
CHAIN_ROOT="${1:-${NODELAB_CHAIN_ROOT:-}}"
DATA_DIR="$HERE/lite-agreement-data"
PID_FILE="$DATA_DIR/lite.pid"
LOG_FILE="$DATA_DIR/lite.log"
ENDPOINT="http://127.0.0.1:${NODELAB_LITE_PORT:-18101}"
EXPECTED_CHAIN_ID="0x5357415050554c53455f4e4f44454c41425f31"

if [ -z "$CHAIN_ROOT" ]; then
  printf 'Usage: bash start-lite-agreement.sh /path/to/clean/chain\n'
  exit 1
fi
SERVER="$CHAIN_ROOT/node/lite/server.mjs"
MANIFEST="$CHAIN_ROOT/node/config/swappulse-nodelab-1.json"
if [ ! -f "$SERVER" ] || [ ! -f "$MANIFEST" ]; then
  printf 'Missing lite server or SWAPPULSE_NODELAB_1 manifest under %s/node.\n' "$CHAIN_ROOT"
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  printf 'Node.js is required.\n'
  exit 1
fi

mkdir -p "$DATA_DIR"

if [ -f "$PID_FILE" ]; then
  PID="$(sed -n '1p' "$PID_FILE" 2>/dev/null || true)"
  if printf '%s' "$PID" | grep -Eq '^[0-9]+$' && kill -0 "$PID" 2>/dev/null; then
    printf 'Node-lab lite verifier is already running as PID %s.\n' "$PID"
    exit 1
  fi
  rm -f "$PID_FILE"
fi

PORT="${NODELAB_LITE_PORT:-18101}"
if ss -ltn 2>/dev/null | awk '{print $4}' | grep -Eq "(^|:)${PORT}$"; then
  printf 'Port %s is already listening. Refusing to start.\n' "$PORT"
  exit 1
fi

printf '=== pre-start node-lab peer checks ===\n'
for RPC in http://127.0.0.1:19950 http://127.0.0.1:19951; do
  CHAIN_ID="$(curl -fsS --max-time 10 "$RPC" \
    -H 'content-type: application/json' \
    --data-binary '{"jsonrpc":"2.0","id":1,"method":"starknet_chainId","params":[]}' \
    | python3 -c 'import json,sys; print(json.load(sys.stdin).get("result", ""))' 2>/dev/null || true)"
  if [ "$(printf '%s' "$CHAIN_ID" | tr 'A-F' 'a-f')" != "$EXPECTED_CHAIN_ID" ]; then
    printf 'Peer %s returned wrong/unreadable chain id: %s\n' "$RPC" "$CHAIN_ID"
    exit 1
  fi
  printf '%s -> chain id PASS\n' "$RPC"
done

printf '\n=== live legacy SwapPulse isolation check ===\n'
for URL in \
  http://127.0.0.1:18080/healthz \
  http://127.0.0.1:18081/healthz \
  http://127.0.0.1:18100/healthz
do
  printf '%s -> ' "$URL"
  if curl -fsS --max-time 10 "$URL" >/dev/null; then
    printf 'healthy\n'
  else
    printf 'FAILED\n'
    exit 1
  fi
done

printf '\nStarting isolated SWAPPULSE_NODELAB_1 lite agreement verifier on %s.\n' "$ENDPOINT"
printf 'Peers: sequencer 19950 + independently synchronising observer 19951.\n'
printf 'This is multi-source state agreement, not independent-operator consensus.\n'

nohup env \
  BIND_ADDRESS=127.0.0.1 \
  PORT="$PORT" \
  SWAPPULSE_NODE_MANIFEST="$MANIFEST" \
  SWAPPULSE_RPC_PEERS=http://127.0.0.1:19950,http://127.0.0.1:19951 \
  POLL_INTERVAL_MS=5000 \
  PIN_CHECK_INTERVAL_MS=30000 \
  RPC_TIMEOUT_MS=5000 \
  RPC_RATE_LIMIT_PER_MINUTE=120 \
  CHECKPOINT_PATH="$DATA_DIR/checkpoint.json" \
  node "$SERVER" >"$LOG_FILE" 2>&1 &
PID=$!
printf '%s\n%s\n' "$PID" "$SERVER" > "$PID_FILE"

READY=0
for ATTEMPT in $(seq 1 30); do
  if ! kill -0 "$PID" 2>/dev/null; then
    printf 'Lite verifier exited before becoming ready.\n'
    tail -80 "$LOG_FILE" 2>/dev/null || true
    rm -f "$PID_FILE"
    exit 1
  fi
  STATUS="$(curl -fsS --max-time 5 "$ENDPOINT/status" 2>/dev/null || true)"
  if printf '%s' "$STATUS" | python3 -c '
import json,sys
try:
    s=json.load(sys.stdin)
    ok=(s.get("ready") is True and s.get("trust_mode")=="multi-peer-agreement" and s.get("healthy_peer_count")==2 and s.get("peer_agreement") is True and s.get("pins_verified") is True)
    raise SystemExit(0 if ok else 1)
except Exception:
    raise SystemExit(1)
' 2>/dev/null; then
    READY=1
    break
  fi
  sleep 2
done

if [ "$READY" -ne 1 ]; then
  printf 'Lite verifier did not reach multi-peer agreement within the readiness window.\n'
  curl -sS "$ENDPOINT/status" 2>/dev/null | python3 -m json.tool 2>/dev/null || true
  tail -80 "$LOG_FILE" 2>/dev/null || true
  exit 1
fi

printf 'Node-lab lite verifier ready. PID=%s\n' "$PID"
printf 'Status endpoint: %s/status\n' "$ENDPOINT"
printf 'Log: %s\n' "$LOG_FILE"
