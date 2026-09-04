#!/usr/bin/env bash

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
PROJECT="swappulse-nodelab-1"

for f in "$HERE/.env.local" "$HERE/.env.image"; do
  if [ ! -f "$f" ]; then
    printf 'Missing %s. Run prepare-nodelab.sh first.\n' "$f"
    exit 1
  fi
done

if ! docker inspect -f '{{.State.Running}}' swappulse-nodelab-1-sequencer-1 2>/dev/null | grep -qx true; then
  printf 'Sequencer is not running. Start and verify it before the observer.\n'
  exit 1
fi
if ! curl -fsS --max-time 3 http://127.0.0.1:19950/health >/dev/null 2>&1; then
  printf 'Sequencer container is running but its loopback RPC is not ready. Refusing observer start.\n'
  exit 1
fi

if ss -ltn 2>/dev/null | awk '{print $4}' | grep -Eq '(^|:)19951$'; then
  printf 'Port 19951 is already listening. Refusing duplicate observer start.\n'
  exit 1
fi

printf 'Starting independent full observer with no sequencer/deployer key passed to it.\n'
docker compose -p "$PROJECT" \
  --env-file "$HERE/.env.local" \
  --env-file "$HERE/.env.image" \
  -f "$HERE/docker-compose.yml" \
  up -d observer

docker compose -p "$PROJECT" \
  --env-file "$HERE/.env.local" \
  --env-file "$HERE/.env.image" \
  -f "$HERE/docker-compose.yml" ps observer

printf '\nWaiting for loopback observer RPC on 127.0.0.1:19951...\n'
READY=0
for _ in $(seq 1 30); do
  if curl -fsS --max-time 2 http://127.0.0.1:19951/health >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 2
done
if [ "$READY" -ne 1 ]; then
  printf 'Observer container started but loopback RPC did not become ready.\n'
  printf 'Recent observer logs:\n'
  docker logs --tail 80 swappulse-nodelab-1-observer-1 2>&1 || true
  exit 1
fi
printf 'Observer RPC: ready\n'
