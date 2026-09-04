#!/usr/bin/env bash

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
ENV_FILE="${1:-$HERE/.env.remote}"
PROJECT="swappulse-nodelab-1-stage-d-remote"

if [ ! -f "$ENV_FILE" ]; then
  printf 'Missing %s.\n' "$ENV_FILE"
  exit 1
fi

# shellcheck disable=SC1090
. "$ENV_FILE"

if ! bash "$HERE/preflight.sh" "$ENV_FILE"; then
  printf 'Remote preflight failed. Refusing start.\n'
  exit 1
fi

printf 'Starting Stage-D remote full observer only.\n'
docker compose -p "$PROJECT" \
  --env-file "$ENV_FILE" \
  -f "$HERE/docker-compose.yml" \
  up -d observer

docker compose -p "$PROJECT" \
  --env-file "$ENV_FILE" \
  -f "$HERE/docker-compose.yml" \
  ps observer

RPC="http://${NODELAB_REMOTE_TAILSCALE_IP}:${NODELAB_REMOTE_OBSERVER_RPC_PORT:-19961}"
printf '\nWaiting for remote observer RPC on %s...\n' "$RPC"
READY=0
for _ in $(seq 1 60); do
  if curl -fsS --max-time 3 "$RPC/health" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 2
done
if [ "$READY" -ne 1 ]; then
  printf 'Remote observer container started but RPC did not become ready.\n'
  docker logs --tail 120 "${PROJECT}-observer-1" 2>&1 || true
  exit 1
fi
printf 'Remote observer RPC: ready\n'

CHAIN_ID="$(curl -fsS --max-time 10 "$RPC" \
  -H 'content-type: application/json' \
  --data-binary '{"jsonrpc":"2.0","id":1,"method":"starknet_chainId","params":[]}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin).get("result", ""))' 2>/dev/null || true)"
EXPECTED="0x5357415050554c53455f4e4f44454c41425f31"
if [ "$(printf '%s' "$CHAIN_ID" | tr 'A-F' 'a-f')" != "$EXPECTED" ]; then
  printf 'Remote observer returned wrong chain id: %s\n' "$CHAIN_ID"
  exit 1
fi
printf 'Remote observer chain ID: PASS\n'
