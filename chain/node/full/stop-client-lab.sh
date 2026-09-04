#!/usr/bin/env bash

# Stops only the isolated Madara Stage-A Compose project.
# The named volume is preserved for restart/recovery testing.

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
PROJECT="${SWAPPULSE_FULL_LAB_PROJECT:-swappulse-full-lab}"

if [ ! -f "$HERE/.env" ] || [ ! -f "$HERE/.env.image" ]; then
  printf 'Missing .env or .env.image. Refusing to guess Compose configuration.\n'
  exit 1
fi

printf 'Stopping only Compose project %s (volume preserved).\n' "$PROJECT"
docker compose -p "$PROJECT" \
  --env-file "$HERE/.env" \
  --env-file "$HERE/.env.image" \
  -f "$HERE/docker-compose.client-lab.yml" \
  down

printf '\nExisting SwapPulse services:\n'
docker ps --format '{{.Names}}\t{{.Status}}' \
  | grep -E 'infra-(devnet|rpc-gateway|tx-relay)-1|swappulse-lite-node' \
  || true
