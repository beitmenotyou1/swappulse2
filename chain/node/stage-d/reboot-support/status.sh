#!/usr/bin/env bash

set -euo pipefail

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
# shellcheck source=common.sh
source "$HERE/common.sh" "${1:-$HERE/.env}"
load_public_env

STATUS_FILE="$(mktemp)"
INSPECT_FILE="$(mktemp)"
trap 'rm -f "$STATUS_FILE" "$INSPECT_FILE"' EXIT

printf '\n=== Stage D fallback container ===\n'
"${COMPOSE[@]}" ps

CONTAINER_ID="$(managed_container_id)"
[ -n "$CONTAINER_ID" ] || die "fallback container is absent"

docker inspect "$CONTAINER_ID" > "$INSPECT_FILE"
python3 - "$INSPECT_FILE" <<'PY'
import json
import sys

with open(sys.argv[1], encoding='utf-8') as source:
    container = json.load(source)[0]
host = container['HostConfig']
config = container['Config']
environment = dict(
    item.split('=', 1)
    for item in config.get('Env', [])
    if '=' in item
)

checks = {
    'running': container['State']['Running'] is True,
    'healthy': container['State'].get('Health', {}).get('Status') == 'healthy',
    'restart_policy': host['RestartPolicy']['Name'] == 'unless-stopped',
    'network_mode': host['NetworkMode'] == 'host',
    'read_only': host['ReadonlyRootfs'] is True,
    'cap_drop': 'ALL' in (host.get('CapDrop') or []),
    'no_new_privileges': any(
        item.startswith('no-new-privileges')
        for item in (host.get('SecurityOpt') or [])
    ),
    'bind': environment.get('BIND_ADDRESS') == '127.0.0.1',
    'port': environment.get('PORT') == '18101',
    'peer_set': environment.get('SWAPPULSE_RPC_PEERS')
        == 'http://127.0.0.1:19950,http://127.0.0.1:19951',
    'tailscale_http_disabled':
        environment.get('SWAPPULSE_ALLOW_TAILSCALE_HTTP') == '0',
}

failed = [name for name, passed in checks.items() if not passed]
for name, passed in checks.items():
    print(f'fallback_{name}={"PASS" if passed else "FAIL"}')
if failed:
    raise SystemExit('Failed fallback checks: ' + ', '.join(failed))
PY

LISTENERS="$(
  ss -ltnH 2>/dev/null |
    awk '$4 ~ /:18101$/ {print $4}' |
    sort -u
)"
[ "$LISTENERS" = "127.0.0.1:18101" ] || \
  die "fallback listener is not restricted to 127.0.0.1:18101"
printf 'fallback_loopback_listener=PASS\n'

curl -fsS --max-time 15 \
  "http://127.0.0.1:$NODELAB_STAGE_D_FALLBACK_PORT/status" \
  > "$STATUS_FILE" || die "fallback status endpoint is unavailable"
python3 -m json.tool < "$STATUS_FILE"

python3 - "$STATUS_FILE" "$EXPECTED_CHAIN_ID" <<'PY'
import json
import sys

with open(sys.argv[1], encoding='utf-8') as source:
    status = json.load(source)

checks = {
    'chain_id': str(status.get('chain_id', '')).lower() == sys.argv[2].lower(),
    'ready': status.get('ready') is True,
    'trust_mode': status.get('trust_mode') == 'multi-peer-agreement',
    'configured_peer_count': status.get('configured_peer_count') == 2,
    'healthy_peer_count': status.get('healthy_peer_count') == 2,
    'peer_agreement': status.get('peer_agreement') is True,
    'pins_verified': status.get('pins_verified') is True,
    'pin_verified_peer_count': status.get('pin_verified_peer_count') == 2,
    'independently_verified': status.get('independently_verified') is True,
    'observer_state_independent':
        status.get('observer_state_independent') is True,
    'operator_independence_disclosed':
        status.get('operator_independence') is False,
    'last_error': status.get('last_error') is None,
}

failed = [name for name, passed in checks.items() if not passed]
for name, passed in checks.items():
    print(f'{name}={"PASS" if passed else "FAIL"}')
if failed:
    raise SystemExit('Failed checks: ' + ', '.join(failed))

print('STAGE-D REBOOT FALLBACK STATUS: PASS')
PY

for container in \
  swappulse-nodelab-1-sequencer-1 \
  swappulse-nodelab-1-observer-1 \
  swappulse-nodelab-1-stage-d-lite-lite-1
do
  [ "$(docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null)" = \
    true ] || die "$container is not running"
  [ "$(docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' "$container")" = \
    unless-stopped ] || die "$container is not reboot-managed"
  printf '%s reboot management: PASS\n' "$container"
done

curl -fsS --max-time 10 http://127.0.0.1:18102/readyz >/dev/null || \
  die "cross-host verifier on 18102 is unavailable"
printf 'Cross-host verifier 18102 retained: PASS\n'

printf '\nSTAGE-D PRIMARY REBOOT READINESS: PASS\n'
