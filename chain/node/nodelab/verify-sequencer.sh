#!/usr/bin/env bash

EXPECTED_CHAIN_ID="0x5357415050554c53455f4e4f44454c41425f31"
RPC="http://127.0.0.1:${NODELAB_SEQUENCER_RPC_PORT:-19950}"
CONTAINER="swappulse-nodelab-1-sequencer-1"
FAIL=0

say() { printf '%s\n' "$*"; }
fail() { printf 'FAIL: %s\n' "$*"; FAIL=1; }

say '=== SWAPPULSE_NODELAB_1 sequencer verification ==='

STATE="$(docker inspect -f '{{.State.Status}}' "$CONTAINER" 2>/dev/null || true)"
if [ "$STATE" = 'running' ]; then
  say 'container: running'
else
  fail "sequencer container state=${STATE:-missing}"
fi

python3 - "$RPC" "$EXPECTED_CHAIN_ID" <<'PY'
import json, sys, time, urllib.request
rpc, expected = sys.argv[1:]

def call(method, params=None):
    body = json.dumps({"jsonrpc":"2.0","id":1,"method":method,"params":params or []}).encode()
    req = urllib.request.Request(rpc, data=body, headers={"Content-Type":"application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=5) as r:
        out = json.loads(r.read().decode())
    if "error" in out:
        raise RuntimeError(out["error"])
    return out["result"]

chain = call("starknet_chainId")
print("chain_id=", chain)
if chain.lower() != expected.lower():
    raise SystemExit("FAIL: unexpected chain ID")

head = call("starknet_blockNumber")
deadline = time.time() + 60
while head < 1 and time.time() < deadline:
    time.sleep(2)
    head = call("starknet_blockNumber")
print("confirmed_head=", head)
if head < 1:
    raise SystemExit("FAIL: sequencer did not produce a confirmed block")

block = call("starknet_getBlockWithTxHashes", [{"block_number": head}])
print("head_block_hash=", block.get("block_hash"))
print("SEQUENCER RPC: PASS")
PY
if [ "$?" -ne 0 ]; then
  FAIL=1
fi

say
say '=== live SwapPulse isolation ==='
for entry in \
  'rpc-gateway http://127.0.0.1:18080/healthz' \
  'tx-relay http://127.0.0.1:18081/healthz' \
  'lite-node http://127.0.0.1:18100/healthz'
do
  name="${entry%% *}"
  url="${entry#* }"
  if curl -fsS --max-time 5 "$url" >/dev/null 2>&1; then
    say "$name: healthy"
  else
    fail "$name health check failed"
  fi
done

if [ "$FAIL" -eq 0 ]; then
  say
  say 'VERIFY SEQUENCER: PASS'
else
  say
  say 'VERIFY SEQUENCER: ATTENTION REQUIRED'
  exit 1
fi
