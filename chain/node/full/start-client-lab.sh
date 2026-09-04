#!/usr/bin/env bash

# Starts only the isolated Madara Stage-A client lab.
# Existing SwapPulse Devnet/RPC/relay/lite containers are not stopped or recreated.

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
PROJECT="${SWAPPULSE_FULL_LAB_PROJECT:-swappulse-full-lab}"

if command -v ss >/dev/null 2>&1; then
  if ss -ltn 2>/dev/null | awk '{print $4}' | grep -Eq '(^|:)19944$'; then
    printf 'Port 19944 is already listening. Refusing to start.\n'
    printf 'Inspect it first with: ss -ltnp | grep :19944\n'
    exit 1
  fi
fi

if [ ! -f "$HERE/.env" ]; then
  cp "$HERE/.env.example" "$HERE/.env"
  chmod 0600 "$HERE/.env"
  printf 'Created %s/.env from the public Sepolia defaults.\n' "$HERE"
fi

if [ ! -f "$HERE/.env.image" ]; then
  printf '.env.image is missing. Run prepare-madara-image.sh first.\n'
  exit 1
fi

printf 'Starting isolated Compose project: %s\n' "$PROJECT"
docker compose -p "$PROJECT" \
  --env-file "$HERE/.env" \
  --env-file "$HERE/.env.image" \
  -f "$HERE/docker-compose.client-lab.yml" \
  up -d

printf '\nMadara lab container:\n'
docker compose -p "$PROJECT" \
  --env-file "$HERE/.env" \
  --env-file "$HERE/.env.image" \
  -f "$HERE/docker-compose.client-lab.yml" ps

printf '\nExisting SwapPulse services remain separate:\n'
docker ps --format '{{.Names}}\t{{.Status}}' \
  | grep -E 'infra-(devnet|rpc-gateway|tx-relay)-1|swappulse-lite-node|swappulse-full-lab' \
  || true
