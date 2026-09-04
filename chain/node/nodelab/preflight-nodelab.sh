#!/usr/bin/env bash

# Read-only preflight for SWAPPULSE_NODELAB_1.
# Does not start/stop containers and does not print local secret values.

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
FAIL=0

say() { printf '%s\n' "$*"; }
fail() { printf 'FAIL: %s\n' "$*"; FAIL=1; }

say '=== SWAPPULSE_NODELAB_1 preflight ==='

for f in "$HERE/.env.local" "$HERE/.env.image"; do
  if [ ! -f "$f" ]; then
    fail "missing $f; run prepare-nodelab.sh first"
  fi
done

if [ -f "$HERE/.env.local" ]; then
  MODE="$(stat -c '%a' "$HERE/.env.local" 2>/dev/null || true)"
  [ "$MODE" = '600' ] || fail ".env.local permissions are $MODE, expected 600"
fi

IMAGE="$(sed -n 's/^MADARA_IMAGE=//p' "$HERE/.env.image" 2>/dev/null | head -n1)"
if [ -z "$IMAGE" ]; then
  fail 'immutable MADARA_IMAGE pin missing'
elif ! printf '%s' "$IMAGE" | grep -Eq '^ghcr\.io/madara-alliance/madara@sha256:[0-9a-f]{64}$'; then
  fail 'MADARA_IMAGE is not an immutable ghcr.io digest'
elif ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  fail 'pinned Madara image is not present locally'
else
  say "Madara image pin: present (${IMAGE#*@})"
fi

say
say '=== required Madara CLI surface ==='
if [ -n "$IMAGE" ] && docker image inspect "$IMAGE" >/dev/null 2>&1; then
  HELP="$(docker run --rm "$IMAGE" --help 2>&1 || true)"
  for flag in --devnet --full --base-path --chain-config-override --gateway --rpc-external --rpc-port --private-key --no-l1-sync; do
    if printf '%s\n' "$HELP" | grep -Fq -- "$flag"; then
      say "$flag: present"
    else
      fail "$flag missing from pinned image CLI"
    fi
  done
fi

say
say '=== ports ==='
for port in 19950 19951; do
  if ss -ltn 2>/dev/null | awk '{print $4}' | grep -Eq "(^|:)$port$"; then
    fail "port $port is already listening"
  else
    say "port $port: free"
  fi
done

say
say '=== host resources ==='
awk '/^MemAvailable:/ {print "MemAvailable_kib=" $2}' /proc/meminfo
MEM_KIB="$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)"
if [ -n "$MEM_KIB" ] && [ "$MEM_KIB" -lt 4194304 ]; then
  fail 'less than 4 GiB MemAvailable for two-node guarded lab'
fi
df -h /

say
say '=== live SwapPulse isolation checks ==='
for entry in \
  'rpc-gateway http://127.0.0.1:18080/healthz' \
  'tx-relay http://127.0.0.1:18081/healthz' \
  'lite-node http://127.0.0.1:18100/healthz'
do
  name="${entry%% *}"
  url="${entry#* }"
  if curl -fsS --max-time 5 "$url" >/dev/null 2>&1; then
    say "$name: healthy"
  else
    fail "$name health check failed"
  fi
done

say
say '=== persistence / loopback wiring ==='
BASE_PATH_COUNT="$(grep -c -- '^      - --base-path$' "$HERE/docker-compose.yml" 2>/dev/null || true)"
if [ "$BASE_PATH_COUNT" = '2' ] && [ "$(grep -c -- '^      - /var/lib/madara$' "$HERE/docker-compose.yml" 2>/dev/null || true)" = '2' ]; then
  say 'Madara base paths: persistent volume path wired for both nodes'
else
  fail 'both nodes must explicitly use --base-path /var/lib/madara'
fi
if grep -Fq 'internal: true' "$HERE/docker-compose.yml" 2>/dev/null; then
  fail 'node-lab bridge must not be internal:true because host loopback RPC publication would be isolated'
else
  say 'Docker network: host-loopback-capable bridge'
fi
for mapping in '127.0.0.1:${NODELAB_SEQUENCER_RPC_PORT:-19950}:9944' '127.0.0.1:${NODELAB_OBSERVER_RPC_PORT:-19951}:9944'; do
  if grep -Fq "$mapping" "$HERE/docker-compose.yml" 2>/dev/null; then
    say "loopback mapping present: $mapping"
  else
    fail "missing loopback RPC mapping: $mapping"
  fi
done

say
say '=== Compose validation ==='
if [ -f "$HERE/.env.local" ] && [ -f "$HERE/.env.image" ]; then
  if docker compose -p swappulse-nodelab-1 \
    --env-file "$HERE/.env.local" \
    --env-file "$HERE/.env.image" \
    -f "$HERE/docker-compose.yml" config >/dev/null; then
    say 'Compose: PASS'
  else
    fail 'Compose configuration did not parse'
  fi
fi

say
say 'Expected chain-id felt: 0x5357415050554c53455f4e4f44454c41425f31'

if [ "$FAIL" -eq 0 ]; then
  say 'PRECHECK: PASS'
else
  say 'PRECHECK: FAIL'
  exit 1
fi
