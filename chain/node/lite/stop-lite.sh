#!/usr/bin/env bash

# Stops only the isolated SwapPulse lite-node Compose project.
# It does not stop, remove or recreate the existing chain/infra services.

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
ENV_FILE="$HERE/.env"

if [ ! -f "$ENV_FILE" ]; then
  ENV_FILE="$HERE/.env.example"
fi

printf 'Stopping isolated Compose project: swappulse-lite-node\n'
docker compose -p swappulse-lite-node --env-file "$ENV_FILE" -f "$HERE/docker-compose.yml" stop

printf '\nLite node project status:\n'
docker compose -p swappulse-lite-node --env-file "$ENV_FILE" -f "$HERE/docker-compose.yml" ps

printf '\nExisting SwapPulse infra containers remain separate:\n'
docker ps --format '{{.Names}}\t{{.Status}}' | grep -E 'infra-(devnet|rpc-gateway|tx-relay)-1' || true
