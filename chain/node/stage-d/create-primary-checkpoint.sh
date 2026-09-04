#!/usr/bin/env bash

# Create public Stage-D block/hash evidence from the primary node-lab sequencer.
# No private key or authority material is read.

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
RPC="${NODELAB_STAGE_D_PRIMARY_RPC:-http://127.0.0.1:19950}"
EXPECTED="0x5357415050554c53455f4e4f44454c41425f31"
OUT="${1:-$HERE/stage-d-primary-checkpoint.json}"

python3 - "$RPC" "$EXPECTED" "$OUT" <<'PY'
import datetime, json, sys, urllib.request
rpc_url, expected, out_path = sys.argv[1:]

def rpc(method, params=None):
    body=json.dumps({'jsonrpc':'2.0','id':1,'method':method,'params':params or []}).encode()
    req=urllib.request.Request(rpc_url,data=body,headers={'Content-Type':'application/json'},method='POST')
    with urllib.request.urlopen(req, timeout=10) as r:
        result=json.loads(r.read().decode())
    if 'error' in result:
        raise RuntimeError(result['error'])
    return result['result']

chain_id=rpc('starknet_chainId')
if chain_id.lower()!=expected.lower():
    raise SystemExit(f'wrong chain id: {chain_id}')
height=rpc('starknet_blockNumber')
if height < 1:
    raise SystemExit('no confirmed block')
block=rpc('starknet_getBlockWithTxHashes',[{'block_number':height}])
block_hash=block.get('block_hash')
if not block_hash:
    raise SystemExit('confirmed block has no hash')
obj={
    'schema_version':1,
    'kind':'SWAPPULSE_NODELAB_STAGE_D_PRIMARY_CHECKPOINT',
    'network':'SWAPPULSE_NODELAB_1',
    'chain_id':chain_id,
    'block_number':height,
    'block_hash':block_hash,
    'created_at':datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z'),
    'note':'Public block/hash checkpoint only. No private key or PII.'
}
with open(out_path,'w',encoding='utf-8') as f:
    json.dump(obj,f,indent=2)
    f.write('\n')
print(json.dumps(obj,indent=2))
print(f'checkpoint={out_path}')
PY
