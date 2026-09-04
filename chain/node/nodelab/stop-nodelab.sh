#!/usr/bin/env bash

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
PROJECT="swappulse-nodelab-1"

for f in "$HERE/.env.local" "$HERE/.env.image"; do
  if [ ! -f "$f" ]; then
    printf 'Missing %s. Refusing to guess Compose configuration.\n' "$f"
    exit 1
  fi
done

printf 'Stopping only SWAPPULSE_NODELAB_1 containers. Named volumes are preserved.\n'
docker compose -p "$PROJECT" \
  --env-file "$HERE/.env.local" \
  --env-file "$HERE/.env.image" \
  -f "$HERE/docker-compose.yml" \
  down

printf '\nPreserved node-lab volumes:\n'
docker volume ls | grep -E 'swappulse-nodelab-1_(sequencer|observer)-data' || true

printf '\nLive SwapPulse services remain separate:\n'
docker ps --format '{{.Names}}\t{{.Status}}' | \
  grep -E 'infra-(devnet|rpc-gateway|tx-relay)-1|swappulse-lite-node' || true
