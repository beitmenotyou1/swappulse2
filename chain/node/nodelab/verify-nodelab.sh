#!/usr/bin/env bash

# Read-only verification for SWAPPULSE_NODELAB_1.
# Compares the sequencer and independent observer at a common confirmed height.

EXPECTED_CHAIN_ID="0x5357415050554c53455f4e4f44454c41425f31"
SEQ="http://127.0.0.1:${NODELAB_SEQUENCER_RPC_PORT:-19950}"
OBS="http://127.0.0.1:${NODELAB_OBSERVER_RPC_PORT:-19951}"
FAIL=0

python3 - "$SEQ" "$OBS" "$EXPECTED_CHAIN_ID" <<'PY'
import json, sys, time, urllib.request

seq, obs, expected = sys.argv[1:]

def rpc(url, method, params=None, timeout=5):
    body = json.dumps({"jsonrpc":"2.0","id":1,"method":method,"params":params or []}).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type":"application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        out = json.loads(r.read().decode())
    if "error" in out:
        raise RuntimeError(f"{method}: {out['error']}")
    return out["result"]

print("=== SWAPPULSE_NODELAB_1 RPC verification ===")
seq_chain = rpc(seq, "starknet_chainId")
obs_chain = rpc(obs, "starknet_chainId")
print("sequencer_chain_id=", seq_chain)
print("observer_chain_id=", obs_chain)
if seq_chain.lower() != expected.lower() or obs_chain.lower() != expected.lower():
    raise SystemExit("FAIL: chain ID mismatch")

seq_head = rpc(seq, "starknet_blockNumber")
obs_head = rpc(obs, "starknet_blockNumber")
print("sequencer_head=", seq_head)
print("observer_head=", obs_head)

# Give a newly started observer a bounded opportunity to obtain confirmed state.
deadline = time.time() + 120
while obs_head < 1 and time.time() < deadline:
    time.sleep(2)
    obs_head = rpc(obs, "starknet_blockNumber")
    seq_head = rpc(seq, "starknet_blockNumber")

if obs_head < 1:
    raise SystemExit("FAIL: observer did not reach a confirmed block")

common = min(seq_head, obs_head)
seq_block = rpc(seq, "starknet_getBlockWithTxHashes", [{"block_number": common}])
obs_block = rpc(obs, "starknet_getBlockWithTxHashes", [{"block_number": common}])
seq_hash = seq_block.get("block_hash")
obs_hash = obs_block.get("block_hash")
print("common_height=", common)
print("sequencer_hash=", seq_hash)
print("observer_hash=", obs_hash)
if not seq_hash or seq_hash != obs_hash:
    raise SystemExit("FAIL: common-height block hash mismatch")

print("NODELAB CONSISTENCY: PASS")
PY
STATUS=$?
if [ "$STATUS" -ne 0 ]; then
  FAIL=1
fi

printf '\n=== observer privilege separation ===\n'
if docker inspect swappulse-nodelab-1-observer-1 --format '{{json .Config.Cmd}}' 2>/dev/null | \
  python3 -c 'import json,sys; c=json.load(sys.stdin); assert "--full" in c; assert "--devnet" not in c; assert "--private-key" not in c; print("observer mode/key separation: PASS")'; then
  :
else
  printf 'observer mode/key separation: FAIL\n'
  FAIL=1
fi

printf '\n=== live SwapPulse isolation ===\n'
for entry in \
  'rpc-gateway http://127.0.0.1:18080/healthz' \
  'tx-relay http://127.0.0.1:18081/healthz' \
  'lite-node http://127.0.0.1:18100/healthz'
do
  name="${entry%% *}"
  url="${entry#* }"
  if curl -fsS --max-time 5 "$url" >/dev/null 2>&1; then
    printf '%s: healthy\n' "$name"
  else
    printf '%s: FAILED\n' "$name"
    FAIL=1
  fi
done

if [ "$FAIL" -eq 0 ]; then
  printf '\nVERIFY NODELAB: PASS\n'
else
  printf '\nVERIFY NODELAB: ATTENTION REQUIRED\n'
  exit 1
fi
