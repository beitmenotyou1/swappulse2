#!/usr/bin/env bash

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
# shellcheck source=common.sh
source "$HERE/common.sh" "${1:-$HERE/.env}"
load_public_env

printf '\n=== stop only the durable Stage D lite service ===\n'
"${COMPOSE[@]}" stop

curl -fsS --max-time 10 http://127.0.0.1:18101/healthz >/dev/null || \
  die "existing verifier on 18101 is not healthy after stop"

printf 'Existing verifier on 18101: PASS\n'
printf 'Checkpoint data retained at %s/data\n' "$HERE"
printf 'STAGE-D DURABLE LITE STOP: PASS\n'
