#!/usr/bin/env bash

set -euo pipefail

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
ENV_FILE="${1:-$HERE/.env}"

bash "$HERE/preflight.sh" "$ENV_FILE"

# shellcheck source=common.sh
source "$HERE/common.sh" "$ENV_FILE"
load_public_env

printf '\n=== start reboot-managed same-host fallback ===\n'
mkdir -p "$HERE/data"
"${COMPOSE[@]}" up -d --build

printf 'Waiting for same-host agreement on 127.0.0.1:18101...\n'
for attempt in $(seq 1 60); do
  CONTAINER_ID="$(managed_container_id)"
  HEALTH=""
  if [ -n "$CONTAINER_ID" ]; then
    HEALTH="$(
      docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' \
        "$CONTAINER_ID" 2>/dev/null || true
    )"
  fi

  if [ "$HEALTH" = healthy ] && \
     curl -fsS --max-time 5 \
      "http://127.0.0.1:$NODELAB_STAGE_D_FALLBACK_PORT/readyz" \
      >/dev/null 2>&1; then
    bash "$HERE/status.sh" "$ENV_FILE"
    printf '\nSTAGE-D REBOOT FALLBACK START: PASS\n'
    exit 0
  fi
  sleep 2
done

"${COMPOSE[@]}" logs --tail=80 fallback || true
die "fallback did not reach same-host agreement within 120 seconds"
