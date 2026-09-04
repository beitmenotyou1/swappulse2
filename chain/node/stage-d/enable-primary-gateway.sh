#!/usr/bin/env bash

# Opt-in Stage-D change: recreate only the node-lab sequencer with its feeder
# gateway additionally published on the primary host's Tailscale IPv4.
# Live SWAPPULSE_TESTNET services are not part of this Compose project.

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
NODELAB_DIR="${NODELAB_DIR:-$(cd "$HERE/../nodelab" 2>/dev/null && pwd)}"
IP="${NODELAB_STAGE_D_TAILSCALE_IP:-}"
PORT="${NODELAB_STAGE_D_GATEWAY_PORT:-19952}"

if [ "${NODELAB_CONFIRM_STAGE_D_GATEWAY:-}" != "YES" ]; then
  printf 'Refusing Stage-D gateway publication without NODELAB_CONFIRM_STAGE_D_GATEWAY=YES.\n'
  exit 1
fi

if ! NODELAB_STAGE_D_TAILSCALE_IP="$IP" NODELAB_STAGE_D_GATEWAY_PORT="$PORT" \
  bash "$HERE/primary-gateway-preflight.sh"; then
  printf 'Stage-D primary gateway preflight failed.\n'
  exit 1
fi

printf '\n=== enable private Stage-D feeder/gateway ===\n'
NODELAB_STAGE_D_TAILSCALE_IP="$IP" NODELAB_STAGE_D_GATEWAY_PORT="$PORT" \
  docker compose -p swappulse-nodelab-1 \
    --env-file "$NODELAB_DIR/.env.local" \
    --env-file "$NODELAB_DIR/.env.image" \
    -f "$NODELAB_DIR/docker-compose.yml" \
    -f "$HERE/primary-gateway.override.yml" \
    up -d sequencer

printf '\nWaiting for sequencer RPC after controlled recreate...\n'
READY=0
for _ in $(seq 1 60); do
  if curl -fsS --max-time 3 http://127.0.0.1:19950/health >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 2
done
if [ "$READY" -ne 1 ]; then
  printf 'Sequencer RPC did not recover.\n'
  exit 1
fi
printf 'sequencer RPC: healthy\n'

printf 'Checking private gateway listener %s:%s...\n' "$IP" "$PORT"
if python3 - "$IP" "$PORT" <<'PY'
import socket,sys
with socket.create_connection((sys.argv[1],int(sys.argv[2])),timeout=5):
    pass
print('private gateway TCP listener: PASS')
PY
then
  :
else
  printf 'Private gateway listener is not reachable.\n'
  exit 1
fi

printf '\n=== wait for same-host observer to resume agreement ===\n'
for _ in $(seq 1 60); do
  if bash "$NODELAB_DIR/verify-nodelab.sh" >/tmp/swappulse-stage-d-verify.$$ 2>&1; then
    cat /tmp/swappulse-stage-d-verify.$$
    rm -f /tmp/swappulse-stage-d-verify.$$
    break
  fi
  sleep 2
done
if [ -f /tmp/swappulse-stage-d-verify.$$ ]; then
  cat /tmp/swappulse-stage-d-verify.$$
  rm -f /tmp/swappulse-stage-d-verify.$$
  printf 'Two-node node-lab agreement did not recover in time.\n'
  exit 1
fi

printf '\n=== live SWAPPULSE_TESTNET isolation ===\n'
for URL in \
  http://127.0.0.1:18080/healthz \
  http://127.0.0.1:18081/healthz \
  http://127.0.0.1:18100/healthz
do
  printf '%s -> ' "$URL"
  curl -fsS --max-time 5 "$URL" >/dev/null && printf 'healthy\n' || { printf 'FAILED\n'; exit 1; }
done

printf '\nSTAGE-D PRIMARY PRIVATE GATEWAY: PASS\n'
printf 'Remote observer gateway URL: http://%s:%s\n' "$IP" "$PORT"
