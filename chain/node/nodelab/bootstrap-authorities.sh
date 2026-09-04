#!/usr/bin/env bash

# Bootstrap fresh SWAPPULSE_NODELAB_1 deployer/verifier SwapPulse accounts.
# The public Madara devnet fixture is used only to declare the account class and
# fund the two future addresses. No private key is printed or written to public output.

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
CHAIN_ROOT="${1:-${NODELAB_CHAIN_ROOT:-}}"
ENV_LOCAL="$HERE/.env.local"
RESULT="$HERE/authority-bootstrap.json"
CONTAINER="swappulse-nodelab-1-sequencer-1"

if [ -z "$CHAIN_ROOT" ]; then
  printf 'Usage: bash bootstrap-authorities.sh /path/to/clean/chain\n'
  exit 1
fi
if [ ! -f "$CHAIN_ROOT/scripts/tooling/bootstrap-nodelab-authority.mjs" ]; then
  printf 'Missing node-lab bootstrap tooling under %s\n' "$CHAIN_ROOT"
  exit 1
fi
if [ ! -d "$CHAIN_ROOT/scripts/tooling/node_modules/starknet" ]; then
  printf 'Missing chain tooling dependencies. Run npm ci in %s/scripts/tooling first.\n' "$CHAIN_ROOT"
  exit 1
fi
if [ ! -f "$CHAIN_ROOT/target/dev/swappulse_network.starknet_artifacts.json" ]; then
  printf 'Missing Cairo build artifacts. Run the pinned chain test/build first.\n'
  exit 1
fi
if [ ! -f "$ENV_LOCAL" ]; then
  printf 'Missing %s. Run prepare-nodelab.sh first.\n' "$ENV_LOCAL"
  exit 1
fi
if ! docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null | grep -qx true; then
  printf 'Node-lab sequencer is not running.\n'
  exit 1
fi
if ! curl -fsS --max-time 3 http://127.0.0.1:19950/health >/dev/null 2>&1; then
  printf 'Node-lab sequencer RPC is not ready.\n'
  exit 1
fi

if ! grep -q '^NODELAB_VERIFIER_PRIVATE_KEY=' "$ENV_LOCAL"; then
  if ! command -v openssl >/dev/null 2>&1; then
    printf 'openssl is required to generate the fresh verifier key.\n'
    exit 1
  fi
  printf 'NODELAB_VERIFIER_PRIVATE_KEY=0x%s\n' "$(openssl rand -hex 31)" >> "$ENV_LOCAL"
  chmod 0600 "$ENV_LOCAL"
  printf 'Added a fresh node-lab verifier key to .env.local without displaying it.\n'
fi

DEPLOYER_KEY="$(sed -n 's/^NODELAB_DEPLOYER_PRIVATE_KEY=//p' "$ENV_LOCAL" | head -n1)"
VERIFIER_KEY="$(sed -n 's/^NODELAB_VERIFIER_PRIVATE_KEY=//p' "$ENV_LOCAL" | head -n1)"
if ! printf '%s' "$DEPLOYER_KEY" | grep -Eq '^0x[0-9a-fA-F]+$'; then
  printf 'NODELAB_DEPLOYER_PRIVATE_KEY is missing or invalid.\n'
  exit 1
fi
if ! printf '%s' "$VERIFIER_KEY" | grep -Eq '^0x[0-9a-fA-F]+$'; then
  printf 'NODELAB_VERIFIER_PRIVATE_KEY is missing or invalid.\n'
  exit 1
fi

LOGS="$(docker logs "$CONTAINER" 2>&1)"
BOOTSTRAP_ADDRESS="$(printf '%s\n' "$LOGS" | awk '/\(#1\) Address:/ {print $NF; exit}')"
BOOTSTRAP_KEY="$(printf '%s\n' "$LOGS" | awk '/\(#1\) Address:/ {seen=1; next} seen && /Private key:/ {print $NF; exit}')"
unset LOGS

if ! printf '%s' "$BOOTSTRAP_ADDRESS" | grep -Eq '^0x[0-9a-fA-F]+$'; then
  printf 'Could not locate Madara devnet bootstrap account #1 address in sequencer startup logs.\n'
  exit 1
fi
if ! printf '%s' "$BOOTSTRAP_KEY" | grep -Eq '^0x[0-9a-fA-F]+$'; then
  printf 'Could not locate Madara devnet bootstrap account #1 key in sequencer startup logs.\n'
  exit 1
fi

printf 'Bootstrapping fresh node-lab authority accounts. Public fixture key will not be displayed.\n'
NODELAB_BOOTSTRAP_ADDRESS="$BOOTSTRAP_ADDRESS" \
NODELAB_BOOTSTRAP_PRIVATE_KEY="$BOOTSTRAP_KEY" \
NODELAB_DEPLOYER_PRIVATE_KEY="$DEPLOYER_KEY" \
NODELAB_VERIFIER_PRIVATE_KEY="$VERIFIER_KEY" \
NODELAB_AUTHORITY_RESULT_FILE="$RESULT" \
SWAPPULSE_RPC_URL=http://127.0.0.1:19950 \
node "$CHAIN_ROOT/scripts/tooling/bootstrap-nodelab-authority.mjs" || exit 1

unset BOOTSTRAP_KEY DEPLOYER_KEY VERIFIER_KEY

python3 - "$RESULT" "$ENV_LOCAL" <<'PY'
import json, os, sys
result_path, env_path = sys.argv[1:]
with open(result_path, encoding='utf-8') as f:
    result = json.load(f)
if not result.get('ok'):
    raise SystemExit('authority bootstrap result is not ok')
updates = {
    'NODELAB_DEPLOYER_ADDRESS': result['deployer_address'],
    'NODELAB_VERIFIER_ADDRESS': result['verifier_address'],
}
with open(env_path, encoding='utf-8') as f:
    lines = f.read().splitlines()
seen = set()
out = []
for line in lines:
    key = line.split('=', 1)[0] if '=' in line else ''
    if key in updates:
        out.append(f'{key}={updates[key]}')
        seen.add(key)
    else:
        out.append(line)
for key, value in updates.items():
    if key not in seen:
        out.append(f'{key}={value}')
with open(env_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(out) + '\n')
os.chmod(env_path, 0o600)
print('Fresh deployer/verifier addresses recorded in .env.local. Private keys were not displayed.')
print('deployer_address=', result['deployer_address'])
print('verifier_address=', result['verifier_address'])
print('account_class_hash=', result['account_class_hash'])
PY
