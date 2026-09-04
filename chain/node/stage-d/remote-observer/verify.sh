#!/usr/bin/env bash

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
CHAIN_ROOT="${1:-}"
CHECKPOINT="${2:-}"
ENV_FILE="${3:-$HERE/.env.remote}"
PROJECT="swappulse-nodelab-1-stage-d-remote"
EXPECTED="0x5357415050554c53455f4e4f44454c41425f31"
FAIL=0

say() { printf '%s\n' "$*"; }
fail() { printf 'FAIL: %s\n' "$*"; FAIL=1; }

if [ -z "$CHAIN_ROOT" ] || [ -z "$CHECKPOINT" ]; then
  printf 'Usage: bash verify.sh /path/to/chain /path/to/stage-d-primary-checkpoint.json [env-file]\n'
  exit 1
fi
if [ ! -f "$ENV_FILE" ] || [ ! -f "$CHECKPOINT" ]; then
  printf 'Missing env/checkpoint file.\n'
  exit 1
fi
MANIFEST="$CHAIN_ROOT/deployments/swappulse-nodelab-1.json"
VERIFY_TOOL="$CHAIN_ROOT/scripts/tooling/verify-network.mjs"
if [ ! -f "$MANIFEST" ] || [ ! -f "$VERIFY_TOOL" ]; then
  printf 'Missing canonical node-lab deployment manifest or verify-network.mjs under %s.\n' "$CHAIN_ROOT"
  exit 1
fi

# shellcheck disable=SC1090
. "$ENV_FILE"
RPC="http://${NODELAB_REMOTE_TAILSCALE_IP}:${NODELAB_REMOTE_OBSERVER_RPC_PORT:-19961}"

say "=== checkpoint + chain identity ==="
python3 - "$CHECKPOINT" "$EXPECTED" <<'PY'
import json,sys
p,expected=sys.argv[1:]
with open(p,encoding='utf-8') as f:
    c=json.load(f)
assert c.get('kind')=='SWAPPULSE_NODELAB_STAGE_D_PRIMARY_CHECKPOINT'
assert c.get('network')=='SWAPPULSE_NODELAB_1'
assert str(c.get('chain_id','')).lower()==expected.lower()
assert isinstance(c.get('block_number'),int) and c['block_number'] > 0
assert isinstance(c.get('block_hash'),str) and c['block_hash'].startswith('0x')
print('checkpoint_schema=PASS')
print('checkpoint_height=',c['block_number'])
print('checkpoint_hash=',c['block_hash'])
PY
if [ "$?" -ne 0 ]; then
  exit 1
fi

say
say "=== remote observer RPC continuity ==="
python3 - "$RPC" "$CHECKPOINT" "$EXPECTED" <<'PY'
import json,sys,time,urllib.request
rpc_url, checkpoint_path, expected=sys.argv[1:]
with open(checkpoint_path,encoding='utf-8') as f:
    checkpoint=json.load(f)

def rpc(method,params=None):
    body=json.dumps({'jsonrpc':'2.0','id':1,'method':method,'params':params or []}).encode()
    req=urllib.request.Request(rpc_url,data=body,headers={'Content-Type':'application/json'},method='POST')
    with urllib.request.urlopen(req,timeout=10) as r:
        out=json.loads(r.read().decode())
    if 'error' in out:
        raise RuntimeError(out['error'])
    return out['result']
chain=rpc('starknet_chainId')
print('remote_chain_id=',chain)
if chain.lower()!=expected.lower():
    raise SystemExit('wrong remote chain id')
target=checkpoint['block_number']
deadline=time.time()+300
head=rpc('starknet_blockNumber')
while head < target and time.time() < deadline:
    print('remote_head=',head,'waiting_for=',target)
    time.sleep(5)
    head=rpc('starknet_blockNumber')
print('remote_head=',head)
if head < target:
    raise SystemExit('remote observer did not reach primary checkpoint height')
block=rpc('starknet_getBlockWithTxHashes',[{'block_number':target}])
actual=block.get('block_hash')
print('remote_checkpoint_hash=',actual)
if actual != checkpoint['block_hash']:
    raise SystemExit('checkpoint block hash mismatch')
print('REMOTE BLOCK/HASH CHECKPOINT: PASS')
PY
if [ "$?" -ne 0 ]; then
  FAIL=1
fi

say
say "=== permanent V2 manifest through remote observer ==="
OUT="$(mktemp)"
if SWAPPULSE_EXPECTED_NETWORK=SWAPPULSE_NODELAB_1 \
   SWAPPULSE_VERIFY_RPC_URL="$RPC" \
   node "$VERIFY_TOOL" "$MANIFEST" >"$OUT" 2>&1; then
  cat "$OUT"
  if ! python3 - "$OUT" <<'PY'
import json,sys
with open(sys.argv[1],encoding='utf-8') as f:
    r=json.load(f)
assert r.get('ok') is True
assert r.get('verification_v2_required') is True
assert r.get('ecosystem_ready') is True
PY
  then
    fail "remote observer did not verify permanent V2 state"
  fi
else
  cat "$OUT"
  fail "verify-network failed through remote observer"
fi
rm -f "$OUT"

say
say "=== remote observer privilege separation ==="
CMD="$(docker inspect "${PROJECT}-observer-1" --format '{{json .Config.Cmd}}' 2>/dev/null || true)"
if printf '%s' "$CMD" | python3 -c 'import json,sys; c=json.load(sys.stdin); assert "--full" in c; assert "--devnet" not in c; assert "--private-key" not in c; print("remote observer mode/key separation: PASS")' 2>/dev/null; then
  :
else
  fail "remote observer command does not prove full/no-key separation"
fi

say
say "=== result ==="
if [ "$FAIL" -eq 0 ]; then
  say "STAGE-D REMOTE OBSERVER VERIFY: PASS"
  say "The second physical host reproduced the primary checkpoint and permanent V2 state without privileged keys."
  exit 0
fi
say "STAGE-D REMOTE OBSERVER VERIFY: FAIL"
exit 1
