#!/usr/bin/env bash

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
PROJECT="swappulse-nodelab-1"

for f in "$HERE/.env.local" "$HERE/.env.image"; do
  if [ ! -f "$f" ]; then
    printf 'Missing %s. Run prepare-nodelab.sh first.\n' "$f"
    exit 1
  fi
done

if ss -ltn 2>/dev/null | awk '{print $4}' | grep -Eq '(^|:)19950$'; then
  printf 'Port 19950 is already listening. Refusing duplicate sequencer start.\n'
  exit 1
fi

printf 'Starting only the isolated SWAPPULSE_NODELAB_1 sequencer.\n'
docker compose -p "$PROJECT" \
  --env-file "$HERE/.env.local" \
  --env-file "$HERE/.env.image" \
  -f "$HERE/docker-compose.yml" \
  up -d sequencer

docker compose -p "$PROJECT" \
  --env-file "$HERE/.env.local" \
  --env-file "$HERE/.env.image" \
  -f "$HERE/docker-compose.yml" ps sequencer

printf '\nWaiting for loopback sequencer RPC on 127.0.0.1:19950...\n'
READY=0
for _ in $(seq 1 30); do
  if curl -fsS --max-time 2 http://127.0.0.1:19950/health >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 2
done
if [ "$READY" -ne 1 ]; then
  printf 'Sequencer container started but loopback RPC did not become ready.\n'
  printf 'Recent sequencer logs:\n'
  docker logs --tail 80 swappulse-nodelab-1-sequencer-1 2>&1 || true
  exit 1
fi
printf 'Sequencer RPC: ready\n'

printf '\nLive SwapPulse services are separate and were not modified:\n'
docker ps --format '{{.Names}}\t{{.Status}}' | \
  grep -E 'infra-(devnet|rpc-gateway|tx-relay)-1|swappulse-lite-node' || true
