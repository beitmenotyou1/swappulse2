#!/usr/bin/env bash

# Starts only the isolated SwapPulse lite-node Compose project.
# It never stops or recreates the existing chain/infra containers.

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"

if command -v ss >/dev/null 2>&1; then
  if ss -ltn 2>/dev/null | awk '{print $4}' | grep -Eq '(^|:)18100$'; then
    printf 'Port 18100 is already listening. Refusing to start.\n'
    printf 'Inspect it first with: ss -ltnp | grep :18100\n'
    exit 1
  fi
fi

mkdir -p "$HERE/data"

if [ ! -f "$HERE/.env" ]; then
  cp "$HERE/.env.example" "$HERE/.env"
  printf 'Created %s/.env from the safe single-peer defaults.\n' "$HERE"
fi

printf 'Starting isolated Compose project: swappulse-lite-node\n'
docker compose -p swappulse-lite-node --env-file "$HERE/.env" -f "$HERE/docker-compose.yml" up -d --build

printf '\nLite node containers:\n'
docker compose -p swappulse-lite-node --env-file "$HERE/.env" -f "$HERE/docker-compose.yml" ps

printf '\nExisting SwapPulse infra containers remain separate:\n'
docker ps --format '{{.Names}}\t{{.Status}}' | grep -E 'infra-(devnet|rpc-gateway|tx-relay)-1' || true
