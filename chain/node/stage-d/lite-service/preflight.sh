#!/usr/bin/env bash

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
# shellcheck source=common.sh
source "$HERE/common.sh" "${1:-$HERE/.env}"
load_public_env

printf '\n=== Stage D durable lite preflight ===\n'

command -v docker >/dev/null 2>&1 || die "Docker is unavailable"
docker compose version >/dev/null 2>&1 || die "Docker Compose is unavailable"
command -v python3 >/dev/null 2>&1 || die "Python 3 is unavailable"
command -v tailscale >/dev/null 2>&1 || die "Tailscale is unavailable"

REMOTE_IP="$(python3 - "$NODELAB_STAGE_D_LITE_PEERS" <<'PY'
import ipaddress
import sys
from urllib.parse import urlsplit

peers = [item.strip() for item in sys.argv[1].split(',') if item.strip()]
if len(peers) != 2:
    raise SystemExit('Exactly two Stage D peers are required')

local = 'http://127.0.0.1:19950'
normalised = [item.rstrip('/') for item in peers]
if normalised.count(local) != 1:
    raise SystemExit('The local sequencer peer must be http://127.0.0.1:19950')

remote = next(item for item in peers if item.rstrip('/') != local)
parsed = urlsplit(remote)
if parsed.scheme != 'http' or parsed.username or parsed.password:
    raise SystemExit('The remote observer must use credential-free HTTP over Tailscale')
if parsed.port != 19961:
    raise SystemExit('The remote observer must use port 19961')

address = ipaddress.ip_address(parsed.hostname or '')
if address not in ipaddress.ip_network('100.64.0.0/10'):
    raise SystemExit('The remote observer must use a literal Tailscale IPv4')

print(address)
PY
)" || die "invalid Stage D peer configuration"

printf 'remote observer: %s\n' "$REMOTE_IP"

ROUTE="$(ip route get "$REMOTE_IP" 2>/dev/null || true)"
printf 'route: %s\n' "${ROUTE:-NOT FOUND}"
printf '%s\n' "$ROUTE" | grep -q 'dev tailscale0' || \
  die "remote observer route does not use tailscale0"

tailscale ping --timeout=5s -c 1 "$REMOTE_IP" >/dev/null 2>&1 || \
  die "remote observer host is unreachable through Tailscale"
printf 'Tailscale route and peer reachability: PASS\n'

python3 - "$NODELAB_STAGE_D_LITE_PEERS" "$EXPECTED_CHAIN_ID" <<'PY'
import json
import sys
import urllib.request

peers = [item.strip() for item in sys.argv[1].split(',') if item.strip()]
expected = sys.argv[2].lower()

for peer in [*peers, 'http://127.0.0.1:19951']:
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
        payload = json.load(response)
    if str(payload.get('result', '')).lower() != expected:
        raise SystemExit(f'Wrong chain ID from {peer}')
    print(f'{peer} chain ID: PASS')
PY

curl -fsS --max-time 10 http://127.0.0.1:18101/healthz >/dev/null || \
  die "existing lite verifier on 18101 is unavailable"
printf 'Same-host observer and existing verifier retained: PASS\n'

CONTAINER_ID="$(managed_container_id)"
if ss -ltn 2>/dev/null | awk '{print $4}' | grep -Eq '(^|:)18102$'; then
  [ -n "$CONTAINER_ID" ] || die "port 18102 is owned by an unmanaged process"
  printf 'Managed service already owns 18102: PASS\n'
else
  printf 'Loopback port 18102 is free: PASS\n'
fi

"${COMPOSE[@]}" config --quiet
printf 'Compose validation: PASS\n'

printf '\nSTAGE-D DURABLE LITE PREFLIGHT: PASS\n'
printf 'No container was changed.\n'
