#!/usr/bin/env bash

# Read-only Stage-D preflight for publishing the node-lab feeder/gateway only
# on the primary host's Tailscale IPv4. This script does not recreate or restart
# any container.

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
NODELAB_DIR="${NODELAB_DIR:-$(cd "$HERE/../nodelab" 2>/dev/null && pwd)}"
IP="${NODELAB_STAGE_D_TAILSCALE_IP:-}"
PORT="${NODELAB_STAGE_D_GATEWAY_PORT:-19952}"
FAIL=0

say() { printf '%s\n' "$*"; }
fail() { printf 'FAIL: %s\n' "$*"; FAIL=1; }

if [ -z "$IP" ]; then
  printf 'Set NODELAB_STAGE_D_TAILSCALE_IP to the primary host Tailscale IPv4.\n'
  exit 1
fi

python3 - "$IP" <<'PY'
import ipaddress, sys
ip = ipaddress.ip_address(sys.argv[1])
net = ipaddress.ip_network('100.64.0.0/10')
if ip.version != 4 or ip not in net:
    raise SystemExit('FAIL: Stage-D gateway bind must be a Tailscale IPv4 in 100.64.0.0/10')
print('tailscale_bind_ip=PASS')
PY
if [ "$?" -ne 0 ]; then
  exit 1
fi

if ! command -v tailscale >/dev/null 2>&1; then
  fail "tailscale command is not installed"
else
  TS_IPS="$(tailscale ip -4 2>/dev/null || true)"
  if printf '%s\n' "$TS_IPS" | grep -Fxq "$IP"; then
    say "primary Tailscale IP belongs to this host: PASS"
  else
    fail "requested Tailscale IP is not assigned to this host"
  fi
fi

if ! printf '%s' "$PORT" | grep -Eq '^[0-9]+$' || [ "$PORT" -lt 1024 ] || [ "$PORT" -gt 65535 ]; then
  fail "invalid NODELAB_STAGE_D_GATEWAY_PORT"
fi

if ss -ltn 2>/dev/null | awk '{print $4}' | grep -Fq "${IP}:${PORT}"; then
  fail "${IP}:${PORT} is already listening"
else
  say "${IP}:${PORT} is free"
fi

for FILE in "$NODELAB_DIR/.env.local" "$NODELAB_DIR/.env.image" "$NODELAB_DIR/docker-compose.yml" "$HERE/primary-gateway.override.yml"; do
  if [ ! -f "$FILE" ]; then
    fail "missing required file: $FILE"
  fi
done

say
say "=== node-lab health before any Stage-D change ==="
for URL in \
  http://127.0.0.1:19950/health \
  http://127.0.0.1:19951/health \
  http://127.0.0.1:18101/healthz \
  http://127.0.0.1:18080/healthz \
  http://127.0.0.1:18081/healthz \
  http://127.0.0.1:18100/healthz
do
  if curl -fsS --max-time 5 "$URL" >/dev/null 2>&1; then
    say "$URL -> healthy"
  else
    fail "$URL is not healthy/reachable"
  fi
done

say
say "=== Compose override validation ==="
if NODELAB_STAGE_D_TAILSCALE_IP="$IP" NODELAB_STAGE_D_GATEWAY_PORT="$PORT" \
  docker compose -p swappulse-nodelab-1 \
    --env-file "$NODELAB_DIR/.env.local" \
    --env-file "$NODELAB_DIR/.env.image" \
    -f "$NODELAB_DIR/docker-compose.yml" \
    -f "$HERE/primary-gateway.override.yml" \
    config >/dev/null; then
  say "Compose Stage-D gateway override: PASS"
else
  fail "Compose Stage-D gateway override did not parse"
fi

say
say "=== result ==="
if [ "$FAIL" -eq 0 ]; then
  say "STAGE-D PRIMARY GATEWAY PRECHECK: PASS"
  say "No container was changed."
  exit 0
fi
say "STAGE-D PRIMARY GATEWAY PRECHECK: FAIL"
exit 1
