#!/usr/bin/env bash

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
ENV_FILE="${1:-$HERE/.env.remote}"
FAIL=0
EXPECTED_IMAGE="ghcr.io/madara-alliance/madara@sha256:3c931fa515bbd3760fd5cbc0bcdceb557d3edbd44bec0231cdf52dd6abb475f6"
EXPECTED_CHAIN_HEX="0x5357415050554c53455f4e4f44454c41425f31"

say() { printf '%s\n' "$*"; }
fail() { printf 'FAIL: %s\n' "$*"; FAIL=1; }

if [ ! -f "$ENV_FILE" ]; then
  printf 'Missing %s. Copy .env.example to .env.remote and edit the Tailscale values.\n' "$ENV_FILE"
  exit 1
fi

# shellcheck disable=SC1090
. "$ENV_FILE"

if [ "${MADARA_IMAGE:-}" != "$EXPECTED_IMAGE" ]; then
  fail "MADARA_IMAGE is not the reviewed immutable Stage-A/C digest"
else
  say "Madara image digest: PASS"
fi

python3 - "${NODELAB_SEQUENCER_GATEWAY_URL:-}" "${NODELAB_REMOTE_TAILSCALE_IP:-}" <<'PY'
import ipaddress, sys, urllib.parse
url, remote_ip = sys.argv[1:]
net=ipaddress.ip_network('100.64.0.0/10')
try:
    u=urllib.parse.urlparse(url)
    if u.scheme not in ('http','https') or not u.hostname:
        raise ValueError('invalid gateway URL')
    host=ipaddress.ip_address(u.hostname)
    if host.version != 4 or host not in net:
        raise ValueError('gateway host is not a Tailscale IPv4')
    rip=ipaddress.ip_address(remote_ip)
    if rip.version != 4 or rip not in net:
        raise ValueError('remote bind IP is not a Tailscale IPv4')
except Exception as e:
    raise SystemExit(f'FAIL: {e}')
print('private_transport_addresses=PASS')
PY
if [ "$?" -ne 0 ]; then
  exit 1
fi

if command -v tailscale >/dev/null 2>&1; then
  if tailscale ip -4 2>/dev/null | grep -Fxq "${NODELAB_REMOTE_TAILSCALE_IP:-}"; then
    say "remote Tailscale bind belongs to this host: PASS"
  else
    fail "NODELAB_REMOTE_TAILSCALE_IP is not assigned to this host"
  fi
else
  fail "tailscale command is not installed"
fi

if ! command -v docker >/dev/null 2>&1; then
  fail "docker is not installed"
elif ! docker compose version >/dev/null 2>&1; then
  fail "docker compose is unavailable"
else
  say "Docker Compose: present"
fi

if ! command -v node >/dev/null 2>&1; then
  fail "Node.js is required later for canonical V2 verification"
fi

PORT="${NODELAB_REMOTE_OBSERVER_RPC_PORT:-19961}"
if ss -ltn 2>/dev/null | awk '{print $4}' | grep -Fq "${NODELAB_REMOTE_TAILSCALE_IP}:${PORT}"; then
  fail "remote observer RPC bind ${NODELAB_REMOTE_TAILSCALE_IP}:${PORT} is already listening"
else
  say "remote observer RPC bind is free"
fi

say
say "=== primary private gateway reachability ==="
if python3 - "${NODELAB_SEQUENCER_GATEWAY_URL:-}" <<'PY'
import socket, sys, urllib.parse
u=urllib.parse.urlparse(sys.argv[1])
port=u.port or (443 if u.scheme=='https' else 80)
with socket.create_connection((u.hostname, port), timeout=5):
    pass
print(f'{u.hostname}:{port} -> reachable')
PY
then
  :
else
  fail "cannot reach primary gateway over private transport"
fi

say
say "=== host resources ==="
MEM_KIB="$(awk '/MemAvailable:/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)"
say "MemAvailable_kib=$MEM_KIB"
if [ "$MEM_KIB" -lt 3145728 ]; then
  fail "less than 3 GiB MemAvailable"
fi
df -h /

say
say "=== remote observer privilege separation ==="
if grep -q -- '--private-key' "$HERE/docker-compose.yml"; then
  fail "remote observer Compose unexpectedly contains --private-key"
else
  say "no --private-key argument: PASS"
fi
if grep -q 'NODELAB_SEQUENCER_PRIVATE_KEY\|NODELAB_DEPLOYER\|NODELAB_VERIFIER' "$HERE/docker-compose.yml"; then
  fail "remote observer Compose references privileged authority material"
else
  say "no sequencer/deployer/verifier secret references: PASS"
fi

say
say "=== Compose validation ==="
if docker compose --env-file "$ENV_FILE" -f "$HERE/docker-compose.yml" config >/dev/null; then
  say "Compose: PASS"
else
  fail "Compose validation failed"
fi

say
say "Expected chain-id felt after sync: $EXPECTED_CHAIN_HEX"
say
say "=== result ==="
if [ "$FAIL" -eq 0 ]; then
  say "STAGE-D REMOTE OBSERVER PRECHECK: PASS"
  exit 0
fi
say "STAGE-D REMOTE OBSERVER PRECHECK: FAIL"
exit 1
