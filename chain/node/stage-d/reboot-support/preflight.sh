#!/usr/bin/env bash

set -euo pipefail

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
# shellcheck source=common.sh
source "$HERE/common.sh" "${1:-$HERE/.env}"
load_public_env

printf '\n=== Stage D reboot-support preflight ===\n'

command -v docker >/dev/null 2>&1 || die "Docker is unavailable"
docker compose version >/dev/null 2>&1 || die "Docker Compose is unavailable"
command -v python3 >/dev/null 2>&1 || die "Python 3 is unavailable"
command -v curl >/dev/null 2>&1 || die "curl is unavailable"
command -v ss >/dev/null 2>&1 || die "ss is unavailable"

for unit in docker.service tailscaled.service; do
  [ "$(systemctl is-enabled "$unit" 2>/dev/null || true)" = enabled ] || \
    die "$unit is not enabled"
  [ "$(systemctl is-active "$unit" 2>/dev/null || true)" = active ] || \
    die "$unit is not active"
  printf '%s boot readiness: PASS\n' "$unit"
done

python3 - "$EXPECTED_CHAIN_ID" <<'PY'
import json
import sys
import urllib.request

expected = sys.argv[1].lower()
for peer in ('http://127.0.0.1:19950', 'http://127.0.0.1:19951'):
    request = urllib.request.Request(
        peer,
        data=json.dumps({
            'jsonrpc': '2.0',
            'id': 1,
            'method': 'starknet_chainId',
            'params': [],
        }).encode(),
        headers={'Content-Type': 'application/json'},
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        result = json.load(response).get('result', '')
    if str(result).lower() != expected:
        raise SystemExit(f'Wrong chain ID from {peer}')
    print(f'{peer} chain ID: PASS')
PY

curl -fsS --max-time 10 http://127.0.0.1:18102/readyz >/dev/null || \
  die "durable cross-host verifier on 18102 is unavailable"
printf 'Durable cross-host verifier 18102: PASS\n'

"${COMPOSE[@]}" config --quiet
printf 'Fallback Compose validation: PASS\n'

CONTAINER_ID="$(managed_container_id)"
if ss -ltn 2>/dev/null | awk '{print $4}' | grep -Eq '(^|:)18101$'; then
  [ -n "$CONTAINER_ID" ] || \
    die "port 18101 is still owned by the legacy host process"
  printf 'Managed fallback already owns 18101: PASS\n'
else
  printf 'Loopback port 18101 is free: PASS\n'
fi

printf '\nSTAGE-D REBOOT-SUPPORT PRECHECK: PASS\n'
printf 'No container was changed.\n'
