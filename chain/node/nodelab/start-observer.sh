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
