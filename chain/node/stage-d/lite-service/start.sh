#!/usr/bin/env bash

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
ENV_FILE="${1:-$HERE/.env}"

bash "$HERE/preflight.sh" "$ENV_FILE"

# shellcheck source=common.sh
source "$HERE/common.sh" "$ENV_FILE"
load_public_env

printf '\n=== start reboot-managed Stage D lite service ===\n'
mkdir -p "$HERE/data"
"${COMPOSE[@]}" up -d --build

printf 'Waiting for two-peer agreement on 127.0.0.1:18102...\n'
for attempt in $(seq 1 60); do
  if curl -fsS --max-time 5 \
      "http://127.0.0.1:$NODELAB_STAGE_D_LITE_PORT/readyz" \
      >/dev/null 2>&1; then
    bash "$HERE/status.sh" "$ENV_FILE"
    printf '\nSTAGE-D DURABLE LITE START: PASS\n'
    exit 0
  fi
  sleep 2
done

"${COMPOSE[@]}" logs --tail=80 lite || true
die "service did not reach two-peer agreement within 120 seconds"
