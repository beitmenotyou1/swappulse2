#!/usr/bin/env bash

# SwapPulse lite-node read-only host preflight.
# This script does not start/stop containers, change firewall rules, modify
# existing chain services, read secret files, or change Git state.

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
ROOT="$(cd "$HERE/../../.." 2>/dev/null && pwd)"
FAIL=0

say() { printf '%s\n' "$*"; }
warn() { printf 'WARN: %s\n' "$*"; }
fail() { printf 'FAIL: %s\n' "$*"; FAIL=1; }

say "=== SwapPulse lite-node mini-server preflight ==="
say "directory: $HERE"
say

if command -v docker >/dev/null 2>&1; then
  say "Docker: $(docker --version 2>/dev/null || true)"
else
  fail "docker is not installed or not on PATH"
fi

if docker compose version >/dev/null 2>&1; then
  say "Compose: $(docker compose version 2>/dev/null || true)"
else
  fail "docker compose is unavailable"
fi

say
say "=== Existing SwapPulse chain containers (read-only check) ==="
docker ps --format '{{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null \
  | grep -E 'infra-(devnet|rpc-gateway|tx-relay)-1|NAME' \
  || warn "expected infra chain container names were not found in docker ps"

say
say "=== Port 18100 ==="
if command -v ss >/dev/null 2>&1; then
  if ss -ltn 2>/dev/null | awk '{print $4}' | grep -Eq '(^|:)18100$'; then
    fail "TCP port 18100 is already listening; do not start the lite node until this is understood"
  else
    say "port 18100 is free"
  fi
else
  warn "ss is unavailable; port availability was not checked"
fi

say
say "=== Host memory / disk ==="
free -h 2>/dev/null || warn "free command unavailable"
df -h "$ROOT" 2>/dev/null || warn "disk usage unavailable"

say
say "=== Node.js benchmark runtime ==="
if command -v node >/dev/null 2>&1; then
  say "Node: $(node --version 2>/dev/null || true)"
else
  warn "Node.js is not installed on the host; Docker lite node can still run, but the benchmark harness requires Node 22"
fi

say
say "=== Git state for node paths only ==="
if git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  NODE_STATUS="$(git -C "$ROOT" status --short -- chain/node 2>/dev/null || true)"
  if [ -n "$NODE_STATUS" ]; then
    warn "chain/node has local changes; review before syncing from origin:"
    printf '%s\n' "$NODE_STATUS"
  else
    say "chain/node has no local worktree changes"
  fi
else
  warn "$ROOT is not a Git worktree"
fi

say
say "=== Public SwapPulse RPC ==="
CHAIN_RESULT="$(curl -fsS --max-time 10 https://rpc.swappulse.org/rpc \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"starknet_chainId","params":[]}' 2>/dev/null || true)"
if printf '%s' "$CHAIN_RESULT" | grep -q '0x534e5f5345504f4c4941'; then
  say "public RPC chain ID matches frozen SWAPPULSE_TESTNET"
else
  fail "public RPC chain ID could not be verified"
  printf '%s\n' "$CHAIN_RESULT"
fi

BLOCK_RESULT="$(curl -fsS --max-time 10 https://rpc.swappulse.org/rpc \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":2,"method":"starknet_blockNumber","params":[]}' 2>/dev/null || true)"
if [ -n "$BLOCK_RESULT" ]; then
  say "public RPC blockNumber response: $BLOCK_RESULT"
else
  fail "public RPC block number could not be read"
fi

say
say "=== Compose validation ==="
if [ -f "$HERE/docker-compose.yml" ]; then
  if docker compose -f "$HERE/docker-compose.yml" config >/dev/null 2>&1; then
    say "lite-node Compose configuration parses successfully"
  else
    fail "lite-node Compose configuration did not parse"
  fi
else
  fail "docker-compose.yml is missing"
fi

say
if [ "$FAIL" -eq 0 ]; then
  say "PRECHECK: PASS"
  say "No existing SwapPulse chain service was modified."
else
  say "PRECHECK: ATTENTION REQUIRED"
  say "Nothing was changed. Resolve the FAIL lines before starting the lite node."
fi
