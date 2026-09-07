#!/usr/bin/env bash

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
ENV_FILE="${1:-$HERE/.env}"
PROJECT="swappulse-nodelab-1-stage-d-fallback"
EXPECTED_CHAIN_ID="0x5357415050554c53455f4e4f44454c41425f31"

die() {
  printf 'STOP: %s\n' "$*" >&2
  exit 1
}

load_public_env() {
  [ -f "$ENV_FILE" ] || die "missing environment file: $ENV_FILE"

  while IFS='=' read -r key value; do
    key="${key%$'\r'}"
    value="${value%$'\r'}"

    case "$key" in
      ''|'#'*) continue ;;
      NODELAB_STAGE_D_FALLBACK_PORT|NODELAB_STAGE_D_FALLBACK_PEERS|POLL_INTERVAL_MS|PIN_CHECK_INTERVAL_MS|RPC_TIMEOUT_MS|RPC_RATE_LIMIT_PER_MINUTE)
        printf -v "$key" '%s' "$value"
        ;;
      *) die "unsupported key in $ENV_FILE: $key" ;;
    esac
  done < "$ENV_FILE"

  : "${NODELAB_STAGE_D_FALLBACK_PORT:=18101}"
  : "${NODELAB_STAGE_D_FALLBACK_PEERS:=}"
  : "${POLL_INTERVAL_MS:=5000}"
  : "${PIN_CHECK_INTERVAL_MS:=30000}"
  : "${RPC_TIMEOUT_MS:=5000}"
  : "${RPC_RATE_LIMIT_PER_MINUTE:=120}"

  [ "$NODELAB_STAGE_D_FALLBACK_PORT" = 18101 ] || \
    die "fallback service must remain on loopback port 18101"
  [ "$NODELAB_STAGE_D_FALLBACK_PEERS" = \
    "http://127.0.0.1:19950,http://127.0.0.1:19951" ] || \
    die "fallback peers must be the local sequencer and same-host observer"

  export NODELAB_STAGE_D_FALLBACK_PORT NODELAB_STAGE_D_FALLBACK_PEERS
  export POLL_INTERVAL_MS PIN_CHECK_INTERVAL_MS RPC_TIMEOUT_MS
  export RPC_RATE_LIMIT_PER_MINUTE

  COMPOSE=(
    docker compose
    -p "$PROJECT"
    --env-file "$ENV_FILE"
    -f "$HERE/docker-compose.yml"
  )
}

managed_container_id() {
  "${COMPOSE[@]}" ps -q fallback 2>/dev/null | head -n 1
}
