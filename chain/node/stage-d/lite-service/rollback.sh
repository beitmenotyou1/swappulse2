#!/usr/bin/env bash

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
# shellcheck source=common.sh
source "$HERE/common.sh" "${1:-$HERE/.env}"
load_public_env

printf '\n=== rollback Stage D durable lite candidate ===\n'
printf 'This removes only the 18102 candidate container. Data is preserved.\n'
"${COMPOSE[@]}" down --remove-orphans

if ss -ltn 2>/dev/null | awk '{print $4}' | grep -Eq '(^|:)18102$'; then
  die "port 18102 is still listening after rollback"
fi

curl -fsS --max-time 10 http://127.0.0.1:18101/healthz >/dev/null || \
  die "existing verifier on 18101 is unavailable"

FALLBACK_CHAIN="$(curl -fsS --max-time 10 http://127.0.0.1:19951 \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"starknet_chainId","params":[]}' \
  2>/dev/null || true)"
printf '%s' "$FALLBACK_CHAIN" | grep -qi "$EXPECTED_CHAIN_ID" || \
  die "same-host fallback observer on 19951 is unavailable or on the wrong chain"

printf 'Candidate listener removed: PASS\n'
printf 'Existing verifier on 18101: PASS\n'
printf 'Same-host observer on 19951: PASS\n'
printf 'Checkpoint data retained at %s/data\n' "$HERE"
printf 'STAGE-D DURABLE LITE ROLLBACK: PASS\n'
