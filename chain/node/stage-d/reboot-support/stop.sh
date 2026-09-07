#!/usr/bin/env bash

set -euo pipefail

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
# shellcheck source=common.sh
source "$HERE/common.sh" "${1:-$HERE/.env}"
load_public_env

printf '\n=== stop only the managed 18101 fallback ===\n'
"${COMPOSE[@]}" stop

curl -fsS --max-time 10 http://127.0.0.1:18102/readyz >/dev/null || \
  die "cross-host verifier on 18102 is unavailable after stop"

printf 'Fallback checkpoint retained at %s/data\n' "$HERE"
printf 'Cross-host verifier 18102: PASS\n'
printf 'STAGE-D REBOOT FALLBACK STOP: PASS\n'
