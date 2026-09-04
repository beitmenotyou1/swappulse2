#!/usr/bin/env bash

# Read-only preflight for the Madara Stage-A full-node client lab.
# It does not start/stop containers, modify the live SwapPulse chain, change
# firewall rules, or read secret files.

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
FAIL=0

say() { printf '%s\n' "$*"; }
warn() { printf 'WARN: %s\n' "$*"; }
fail() { printf 'FAIL: %s\n' "$*"; FAIL=1; }

say "=== SwapPulse Madara Stage-A mini-server preflight ==="
say "directory: $HERE"
say

if command -v docker >/dev/null 2>&1; then
  say "Docker: $(docker --version 2>/dev/null || true)"
else
  fail "docker is unavailable"
fi

if docker compose version >/dev/null 2>&1; then
  say "Compose: $(docker compose version 2>/dev/null || true)"
else
  fail "docker compose is unavailable"
fi

say
say "=== Existing live SwapPulse containers (read-only) ==="
docker ps --format '{{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null \
  | grep -E 'infra-(devnet|rpc-gateway|tx-relay)-1|swappulse-lite-node' \
  || warn "expected live/lite containers were not found"

say
say "=== Port 19944 ==="
if command -v ss >/dev/null 2>&1; then
  if ss -ltn 2>/dev/null | awk '{print $4}' | grep -Eq '(^|:)19944$'; then
    fail "TCP port 19944 is already listening"
  else
    say "port 19944 is free"
  fi
else
  warn "ss unavailable; port was not checked"
fi

say
say "=== Host memory / disk ==="
free -h 2>/dev/null || warn "free command unavailable"
df -h / 2>/dev/null || warn "disk usage unavailable"

say
say "=== Active swap behaviour snapshot ==="
if command -v vmstat >/dev/null 2>&1; then
  vmstat 1 3
else
  warn "vmstat unavailable"
fi

say
say "=== Ethereum Sepolia L1 endpoint ==="
L1="https://ethereum-sepolia-rpc.publicnode.com"
if [ -f "$HERE/.env" ]; then
  FOUND="$(grep '^MADARA_L1_ENDPOINT=' "$HERE/.env" 2>/dev/null | head -n1 | cut -d= -f2-)"
  if [ -n "$FOUND" ]; then L1="$FOUND"; fi
fi
if printf '%s' "$L1" | grep -Eq '^https://'; then
  RESPONSE="$(curl -fsS --max-time 10 "$L1" -H 'content-type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' 2>/dev/null || true)"
  if printf '%s' "$RESPONSE" | grep -qi '0xaa36a7'; then
    say "Ethereum endpoint reports Sepolia chain ID 0xaa36a7"
  else
    fail "Ethereum endpoint did not verify as Sepolia"
    printf '%s\n' "$RESPONSE"
  fi
else
  fail "MADARA_L1_ENDPOINT must use HTTPS"
fi

say
say "=== Immutable Madara image ==="
if [ -f "$HERE/.env.image" ]; then
  PIN="$(grep '^MADARA_IMAGE=' "$HERE/.env.image" 2>/dev/null | head -n1 | cut -d= -f2-)"
  if printf '%s' "$PIN" | grep -Eq '^ghcr\.io/madara-alliance/madara@sha256:[0-9a-f]{64}$'; then
    say "Madara image digest is pinned"
  else
    fail ".env.image does not contain a valid immutable Madara digest"
  fi
else
  fail ".env.image is missing; run prepare-madara-image.sh first"
fi

say
say "=== Compose validation ==="
if [ -f "$HERE/.env" ] && [ -f "$HERE/.env.image" ]; then
  if docker compose -p swappulse-full-lab --env-file "$HERE/.env" --env-file "$HERE/.env.image" -f "$HERE/docker-compose.client-lab.yml" config >/dev/null 2>&1; then
    say "Madara client-lab Compose configuration parses successfully"
  else
    fail "Madara client-lab Compose configuration did not parse"
  fi
else
  fail ".env and .env.image are required before Compose validation"
fi

say
if [ "$FAIL" -eq 0 ]; then
  say "PRECHECK: PASS"
  say "No live SwapPulse chain service was modified."
else
  say "PRECHECK: ATTENTION REQUIRED"
  say "Nothing was changed. Resolve FAIL lines before starting Madara."
fi
