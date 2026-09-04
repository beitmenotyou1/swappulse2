#!/usr/bin/env bash

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
ENV_FILE="${1:-$HERE/.env.remote}"
PROJECT="swappulse-nodelab-1-stage-d-remote"

if [ ! -f "$ENV_FILE" ]; then
  printf 'Missing %s. Refusing to guess remote observer configuration.\n' "$ENV_FILE"
  exit 1
fi

printf 'Stopping only the Stage-D remote observer. Named volume is preserved.\n'
docker compose -p "$PROJECT" \
  --env-file "$ENV_FILE" \
  -f "$HERE/docker-compose.yml" \
  down

printf '\nPreserved Stage-D observer volume:\n'
docker volume ls | grep 'swappulse-nodelab-1-stage-d-remote_remote-observer-data' || true
