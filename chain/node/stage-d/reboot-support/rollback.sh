#!/usr/bin/env bash

set -euo pipefail

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
# shellcheck source=common.sh
source "$HERE/common.sh" "${1:-$HERE/.env}"
load_public_env

printf '\n=== remove only the managed 18101 fallback ===\n'
"${COMPOSE[@]}" down --remove-orphans

if ss -ltn 2>/dev/null | awk '{print $4}' | grep -Eq '(^|:)18101$'; then
  die "port 18101 is still listening after fallback removal"
fi

curl -fsS --max-time 10 http://127.0.0.1:18102/readyz >/dev/null || \
  die "cross-host verifier on 18102 is unavailable after rollback"

printf 'Managed fallback removed: PASS\n'
printf 'Fallback checkpoint retained at %s/data\n' "$HERE"
printf 'Cross-host verifier 18102: PASS\n'
printf 'STAGE-D REBOOT FALLBACK ROLLBACK: PASS\n'
