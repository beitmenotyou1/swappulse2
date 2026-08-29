#!/usr/bin/env bash
set -euo pipefail
set +x

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHAIN_ROOT="$(cd "$HERE/.." && pwd)"
MANIFEST="${SWAPPULSE_DEPLOYMENT_MANIFEST:-$CHAIN_ROOT/deployments/swappulse-testnet.json}"
OUT="${SWAPPULSE_RELAY_ENV_FILE:-$HERE/.env.relay}"
NODE_BIN="${NODE_BIN:-node}"

if [[ ! -f "$MANIFEST" ]]; then
  echo "Deployment manifest not found: $MANIFEST" >&2
  exit 1
fi
if ! command -v "$NODE_BIN" >/dev/null 2>&1 && [[ ! -x "$NODE_BIN" ]]; then
  echo "NODE_BIN does not point to an executable Node.js runtime: $NODE_BIN" >&2
  exit 1
fi

readarray -t VALUES < <(
  MANIFEST="$MANIFEST" "$NODE_BIN" --input-type=module <<'NODE'
import fs from 'node:fs';
const m = JSON.parse(fs.readFileSync(process.env.MANIFEST, 'utf8'));
const required = ['chain_id', 'account_class_hash', 'identity_registry_class_hash', 'identity_registry_address', 'identity_registry_owner'];
for (const key of required) {
  if (!m[key]) throw new Error(`Manifest is missing ${key}`);
}
const delay = Number(m.recovery_delay_seconds ?? 172800);
if (!Number.isInteger(delay) || delay < 0 || delay > 2592000) throw new Error('Invalid recovery_delay_seconds');
console.log(String(m.chain_id));
console.log(String(m.account_class_hash));
console.log(String(m.identity_registry_class_hash));
console.log(String(m.identity_registry_address));
console.log(String(m.identity_registry_owner));
console.log(String(m.recovery_controller || '0x0'));
console.log(String(delay));
NODE
)

CHAIN_ID="${VALUES[0]:-}"
ACCOUNT_CLASS_HASH="${VALUES[1]:-}"
IDENTITY_REGISTRY_CLASS_HASH="${VALUES[2]:-}"
IDENTITY_REGISTRY_ADDRESS="${VALUES[3]:-}"
IDENTITY_REGISTRY_OWNER="${VALUES[4]:-}"
RECOVERY_CONTROLLER="${VALUES[5]:-0x0}"
RECOVERY_DELAY_SECONDS="${VALUES[6]:-172800}"
RAW_RPC_PORT="${SWAPPULSE_RAW_RPC_PORT:-5050}"
RAW_RPC="http://127.0.0.1:${RAW_RPC_PORT}"

read -r REGISTRY_ADMIN_ADDRESS REGISTRY_ADMIN_PRIVATE_KEY < <(
  RAW_RPC="$RAW_RPC" EXPECTED_OWNER="$IDENTITY_REGISTRY_OWNER" "$NODE_BIN" --input-type=module <<'NODE'
const response = await fetch(process.env.RAW_RPC, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'devnet_getPredeployedAccounts',
    params: { with_balance: true },
  }),
});
if (!response.ok) throw new Error(`Devnet RPC HTTP ${response.status}`);
const payload = await response.json();
if (payload.error) throw new Error(JSON.stringify(payload.error));
const expected = BigInt(process.env.EXPECTED_OWNER).toString(16);
const account = (payload.result || []).find((row) => BigInt(row.address).toString(16) === expected);
if (!account?.address || !account?.private_key) {
  throw new Error('IdentityRegistry owner is not one of the local Devnet predeployed accounts');
}
process.stdout.write(`${account.address} ${account.private_key}\n`);
NODE
)

if [[ -z "${REGISTRY_ADMIN_ADDRESS:-}" || -z "${REGISTRY_ADMIN_PRIVATE_KEY:-}" ]]; then
  echo "Could not resolve the local IdentityRegistry owner key." >&2
  exit 1
fi

if command -v openssl >/dev/null 2>&1; then
  RELAY_TOKEN="$(openssl rand -hex 32)"
else
  RELAY_TOKEN="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
fi

umask 077
cat > "$OUT" <<EOF
RELAY_TOKEN=$RELAY_TOKEN
CHAIN_ID=$CHAIN_ID
ACCOUNT_CLASS_HASH=$ACCOUNT_CLASS_HASH
IDENTITY_REGISTRY_CLASS_HASH=$IDENTITY_REGISTRY_CLASS_HASH
IDENTITY_REGISTRY_ADDRESS=$IDENTITY_REGISTRY_ADDRESS
IDENTITY_REGISTRY_OWNER=$IDENTITY_REGISTRY_OWNER
REGISTRY_ADMIN_ADDRESS=$REGISTRY_ADMIN_ADDRESS
REGISTRY_ADMIN_PRIVATE_KEY=$REGISTRY_ADMIN_PRIVATE_KEY
RECOVERY_CONTROLLER=$RECOVERY_CONTROLLER
RECOVERY_DELAY_SECONDS=$RECOVERY_DELAY_SECONDS
DEPLOY_MINT_AMOUNT=5000000000000000
RATE_LIMIT_PER_MINUTE=60
EOF
chmod 600 "$OUT"

echo "Relay environment written to $OUT with mode 0600."
echo "The registry-owner private key is stored only in $OUT and is never printed."
echo "Copy RELAY_TOKEN only into the Base44 server-side secret SWAPPULSE_TX_RELAY_TOKEN, never into browser code or ChainNetworkConfig."
echo "Start the relay with: docker compose --env-file .env --env-file .env.relay --profile provisioning up -d --build tx-relay"
