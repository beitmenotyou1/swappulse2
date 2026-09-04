#!/usr/bin/env bash

# Read-only verifier for the isolated Madara Stage-A client lab.
# It does not modify the live SwapPulse chain or submit transactions.

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
RPC="http://127.0.0.1:${SWAPPULSE_FULL_LAB_RPC_PORT:-19944}/rpc/v0_10_2/"
CONTAINER="swappulse-full-lab-madara-full-lab-1"
FAIL=0

say() { printf '%s\n' "$*"; }
fail() { printf 'FAIL: %s\n' "$*"; FAIL=1; }

rpc() {
  local method="$1"
  local params="${2:-[]}" 
  curl -fsS --max-time 10 "$RPC" \
    -H 'content-type: application/json' \
    --data "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"$method\",\"params\":$params}"
}

say "=== Madara Stage-A verification ==="

STATE="$(docker inspect -f '{{.State.Status}}' "$CONTAINER" 2>/dev/null || true)"
if [ "$STATE" = "running" ]; then
  say "container: running"
else
  fail "Madara container is not running (state=${STATE:-missing})"
fi

say
say "=== RPC chain ID ==="
CHAIN="$(rpc starknet_chainId 2>/dev/null || true)"
if [ -n "$CHAIN" ]; then
  printf '%s\n' "$CHAIN" | python3 -m json.tool 2>/dev/null || printf '%s\n' "$CHAIN"
  if printf '%s' "$CHAIN" | grep -qi '0x534e5f5345504f4c4941'; then
    say "chain ID reports SN_SEPOLIA"
  else
    fail "RPC did not report the expected Starknet Sepolia chain ID"
  fi
else
  fail "starknet_chainId did not respond"
fi

say
say "=== Sync state ==="
SYNC="$(rpc starknet_syncing 2>/dev/null || true)"
if [ -n "$SYNC" ]; then
  printf '%s\n' "$SYNC" | python3 -m json.tool 2>/dev/null || printf '%s\n' "$SYNC"
else
  fail "starknet_syncing did not respond"
fi

say
say "=== Block progress ==="
BLOCK="$(rpc starknet_blockNumber 2>/dev/null || true)"
if [ -n "$BLOCK" ]; then
  printf '%s\n' "$BLOCK" | python3 -m json.tool 2>/dev/null || printf '%s\n' "$BLOCK"
else
  # A brand-new full node may not yet have persisted its first block. Keep this
  # visible but do not hide the distinction between RPC-alive and sync-progress.
  say "blockNumber not available yet (initial sync may still be at pre-genesis)"
fi

say
say "=== Container resource limits ==="
docker inspect "$CONTAINER" --format \
  'Memory={{.HostConfig.Memory}} NanoCpus={{.HostConfig.NanoCpus}} PidsLimit={{.HostConfig.PidsLimit}} Restart={{.HostConfig.RestartPolicy.Name}}' \
  2>/dev/null || fail "could not inspect container resource limits"

say
say "=== Live SwapPulse services remain healthy ==="
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

say
if [ "$FAIL" -eq 0 ]; then
  say "VERIFY: PASS"
else
  say "VERIFY: ATTENTION REQUIRED"
fi
