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
const required = ['account_class_hash', 'identity_registry_class_hash', 'identity_registry_address', 'identity_registry_owner'];
for (const key of required) {
  if (!m[key]) throw new Error(`Manifest is missing ${key}`);
}
const delay = Number(m.recovery_delay_seconds ?? 172800);
if (!Number.isInteger(delay) || delay < 0 || delay > 2592000) throw new Error('Invalid recovery_delay_seconds');
console.log(String(m.account_class_hash));
console.log(String(m.identity_registry_class_hash));
console.log(String(m.identity_registry_address));
console.log(String(m.identity_registry_owner));
console.log(String(m.recovery_controller || '0x0'));
console.log(String(delay));
NODE
)

ACCOUNT_CLASS_HASH="${VALUES[0]:-}"
IDENTITY_REGISTRY_CLASS_HASH="${VALUES[1]:-}"
IDENTITY_REGISTRY_ADDRESS="${VALUES[2]:-}"
IDENTITY_REGISTRY_OWNER="${VALUES[3]:-}"
RECOVERY_CONTROLLER="${VALUES[4]:-0x0}"
RECOVERY_DELAY_SECONDS="${VALUES[5]:-172800}"

if command -v openssl >/dev/null 2>&1; then
  RELAY_TOKEN="$(openssl rand -hex 32)"
else
  RELAY_TOKEN="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
fi

umask 077
cat > "$OUT" <<EOF
RELAY_TOKEN=$RELAY_TOKEN
ACCOUNT_CLASS_HASH=$ACCOUNT_CLASS_HASH
IDENTITY_REGISTRY_CLASS_HASH=$IDENTITY_REGISTRY_CLASS_HASH
IDENTITY_REGISTRY_ADDRESS=$IDENTITY_REGISTRY_ADDRESS
IDENTITY_REGISTRY_OWNER=$IDENTITY_REGISTRY_OWNER
RECOVERY_CONTROLLER=$RECOVERY_CONTROLLER
RECOVERY_DELAY_SECONDS=$RECOVERY_DELAY_SECONDS
DEPLOY_MINT_AMOUNT=5000000000000000
RATE_LIMIT_PER_MINUTE=60
EOF
chmod 600 "$OUT"

echo "Relay environment written to $OUT with mode 0600."
echo "Copy RELAY_TOKEN only into the Base44 server-side secret SWAPPULSE_TX_RELAY_TOKEN, never into browser code or ChainNetworkConfig."
echo "Start the relay with: docker compose --env-file .env --env-file .env.relay --profile provisioning up -d --build tx-relay"
