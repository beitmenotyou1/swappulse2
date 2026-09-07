#!/usr/bin/env bash

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
# shellcheck source=common.sh
source "$HERE/common.sh" "${1:-$HERE/.env}"
load_public_env

ENDPOINT="http://127.0.0.1:$NODELAB_STAGE_D_LITE_PORT"
STATUS_FILE="$(mktemp)"
trap 'rm -f "$STATUS_FILE"' EXIT

printf '\n=== Stage D durable lite container ===\n'
"${COMPOSE[@]}" ps

printf '\n=== Stage D durable lite readiness ===\n'
curl -fsS --max-time 15 "$ENDPOINT/status" > "$STATUS_FILE" || \
  die "status endpoint is unavailable: $ENDPOINT/status"
python3 -m json.tool < "$STATUS_FILE"

python3 - "$STATUS_FILE" "$EXPECTED_CHAIN_ID" <<'PY'
import json
import sys

with open(sys.argv[1], encoding='utf-8') as source:
    status = json.load(source)

expected = sys.argv[2].lower()
checks = {
    'network': status.get('network') == 'SWAPPULSE_NODELAB_1',
    'chain_id': str(status.get('chain_id', '')).lower() == expected,
    'ready': status.get('ready') is True,
    'trust_mode': status.get('trust_mode') == 'multi-peer-agreement',
    'configured_peer_count': status.get('configured_peer_count') == 2,
    'healthy_peer_count': status.get('healthy_peer_count') == 2,
    'peer_agreement': status.get('peer_agreement') is True,
    'pins_verified': status.get('pins_verified') is True,
    'pin_verified_peer_count': status.get('pin_verified_peer_count') == 2,
    'independently_verified': status.get('independently_verified') is True,
    'observer_state_independent': status.get('observer_state_independent') is True,
    'operator_independence_disclosed': status.get('operator_independence') is False,
    'last_error': status.get('last_error') is None,
}

failed = [name for name, passed in checks.items() if not passed]
for name, passed in checks.items():
    print(f'{name}={"PASS" if passed else "FAIL"}')
if failed:
    raise SystemExit('Failed checks: ' + ', '.join(failed))

print('STAGE-D DURABLE LITE STATUS: PASS')
PY
