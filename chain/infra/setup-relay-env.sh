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
node_major="$("$NODE_BIN" -p "Number(process.versions.node.split('.')[0])")"
if (( node_major < 22 )); then
  echo "Node.js 22+ is required for SwapPulse chain tooling. Set NODE_BIN to a Node 22 executable." >&2
  exit 1
fi
if [[ ! -d "$CHAIN_ROOT/scripts/tooling/node_modules/starknet" ]]; then
  echo "Install chain tooling first: cd chain/scripts/tooling && npm ci" >&2
  exit 1
fi

# Relay credentials must never be created for an unverified/stale public
# manifest. Explicitly remove any local verification override so this check
# always exercises the HTTPS RPC that Base44 will actually use.
env -u SWAPPULSE_VERIFY_RPC_URL \
  "$NODE_BIN" "$CHAIN_ROOT/scripts/tooling/verify-network.mjs" "$MANIFEST" >/dev/null

echo "Public SwapPulse manifest verified before relay credential generation."

readarray -t VALUES < <(
  MANIFEST="$MANIFEST" "$NODE_BIN" --input-type=module <<'NODE'
import fs from 'node:fs';
const m = JSON.parse(fs.readFileSync(process.env.MANIFEST, 'utf8'));
const required = [
  'chain_id', 'account_class_hash', 'identity_registry_class_hash',
  'identity_registry_address', 'identity_registry_owner', 'identity_verifier_address',
  'identity_verification_mode',
  'native_token_address', 'native_token_class_hash',
  'card_nft_address', 'card_nft_class_hash',
  'staking_pool_address', 'staking_pool_class_hash',
  'usership_address', 'usership_class_hash',
  'bridge_adapter_address', 'bridge_adapter_class_hash',
];
for (const key of required) {
  if (!m[key]) throw new Error(`Manifest is missing ${key}`);
}
if (Number(m.schema_version) !== 2) throw new Error('Relay V2 setup requires deployment manifest schema_version 2');
if (String(m.identity_verification_mode).toUpperCase() !== 'V2') throw new Error('Relay V2 setup requires identity_verification_mode V2');
const delay = Number(m.recovery_delay_seconds ?? 172800);
if (!Number.isInteger(delay) || delay < 0 || delay > 2592000) throw new Error('Invalid recovery_delay_seconds');
console.log(String(m.chain_id));
console.log(String(m.account_class_hash));
console.log(String(m.identity_registry_class_hash));
console.log(String(m.identity_registry_address));
console.log(String(m.identity_registry_owner));
console.log(String(m.identity_verifier_address));
console.log(String(m.identity_verification_mode).toLowerCase());
console.log(String(m.native_token_address));
console.log(String(m.native_token_class_hash));
console.log(String(m.card_nft_address));
console.log(String(m.card_nft_class_hash));
console.log(String(m.staking_pool_address));
console.log(String(m.staking_pool_class_hash));
console.log(String(m.usership_address));
console.log(String(m.usership_class_hash));
console.log(String(m.bridge_adapter_address));
console.log(String(m.bridge_adapter_class_hash));
console.log(String(m.recovery_controller || '0x0'));
console.log(String(delay));
NODE
)

CHAIN_ID="${VALUES[0]:-}"
ACCOUNT_CLASS_HASH="${VALUES[1]:-}"
IDENTITY_REGISTRY_CLASS_HASH="${VALUES[2]:-}"
IDENTITY_REGISTRY_ADDRESS="${VALUES[3]:-}"
IDENTITY_REGISTRY_OWNER="${VALUES[4]:-}"
IDENTITY_VERIFIER_ADDRESS="${VALUES[5]:-}"
IDENTITY_VERIFICATION_MODE="${VALUES[6]:-v2}"
NATIVE_TOKEN_ADDRESS="${VALUES[7]:-}"
NATIVE_TOKEN_CLASS_HASH="${VALUES[8]:-}"
CARD_NFT_ADDRESS="${VALUES[9]:-}"
CARD_NFT_CLASS_HASH="${VALUES[10]:-}"
STAKING_POOL_ADDRESS="${VALUES[11]:-}"
STAKING_POOL_CLASS_HASH="${VALUES[12]:-}"
USERSHIP_ADDRESS="${VALUES[13]:-}"
USERSHIP_CLASS_HASH="${VALUES[14]:-}"
BRIDGE_ADAPTER_ADDRESS="${VALUES[15]:-}"
BRIDGE_ADAPTER_CLASS_HASH="${VALUES[16]:-}"
RECOVERY_CONTROLLER="${VALUES[17]:-0x0}"
RECOVERY_DELAY_SECONDS="${VALUES[18]:-172800}"
RAW_RPC_PORT="${SWAPPULSE_RAW_RPC_PORT:-5050}"
RAW_RPC="http://127.0.0.1:${RAW_RPC_PORT}"

read -r REGISTRY_ADMIN_ADDRESS REGISTRY_ADMIN_PRIVATE_KEY IDENTITY_VERIFIER_RESOLVED IDENTITY_VERIFIER_PRIVATE_KEY < <(
  RAW_RPC="$RAW_RPC" EXPECTED_OWNER="$IDENTITY_REGISTRY_OWNER" EXPECTED_VERIFIER="$IDENTITY_VERIFIER_ADDRESS" "$NODE_BIN" --input-type=module <<'NODE'
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
const expectedOwner = BigInt(process.env.EXPECTED_OWNER).toString(16);
const expectedVerifier = BigInt(process.env.EXPECTED_VERIFIER).toString(16);
const accounts = payload.result || [];
const owner = accounts.find((row) => BigInt(row.address).toString(16) === expectedOwner);
const verifier = accounts.find((row) => BigInt(row.address).toString(16) === expectedVerifier);
if (!owner?.address || !owner?.private_key) {
  throw new Error('IdentityRegistry owner is not one of the local Devnet predeployed accounts');
}
if (!verifier?.address || !verifier?.private_key) {
  throw new Error('Identity verifier is not one of the local Devnet predeployed accounts');
}
if (BigInt(owner.address) === BigInt(verifier.address)) {
  throw new Error('Identity verifier must be separate from the IdentityRegistry owner');
}
process.stdout.write(`${owner.address} ${owner.private_key} ${verifier.address} ${verifier.private_key}\n`);
NODE
)

if [[ -z "${REGISTRY_ADMIN_ADDRESS:-}" || -z "${REGISTRY_ADMIN_PRIVATE_KEY:-}" || -z "${IDENTITY_VERIFIER_RESOLVED:-}" || -z "${IDENTITY_VERIFIER_PRIVATE_KEY:-}" ]]; then
  echo "Could not resolve the local registry owner/verifier keys." >&2
  exit 1
fi

RELAY_TOKEN=""
TOKEN_ACTION="generated"
if [[ -f "$OUT" && "${SWAPPULSE_ROTATE_RELAY_TOKEN:-0}" != "1" ]]; then
  existing_mode="$(stat -c '%a' "$OUT" 2>/dev/null || true)"
  if [[ ! "$existing_mode" =~ ^[0-7]{3,4}$ ]]; then
    echo "Could not verify permissions on existing relay environment: $OUT" >&2
    exit 1
  fi
  mode_dec=$((8#$existing_mode))
  if (( (mode_dec & 077) != 0 )); then
    echo "Existing relay environment is accessible by group/other users: $OUT (mode $existing_mode)." >&2
    echo "Fix it with chmod 600 before regenerating the V2 relay environment." >&2
    exit 1
  fi
  RELAY_TOKEN="$(awk -F= '$1 == "RELAY_TOKEN" { sub(/^[^=]*=/, ""); print; exit }' "$OUT")"
  if (( ${#RELAY_TOKEN} < 32 || ${#RELAY_TOKEN} > 256 )) || [[ "$RELAY_TOKEN" =~ [[:space:]] ]]; then
    echo "Existing RELAY_TOKEN is missing or invalid. Refusing a silent token rotation." >&2
    echo "Set SWAPPULSE_ROTATE_RELAY_TOKEN=1 only when you intend to update the Base44 server-side secret too." >&2
    exit 1
  fi
  TOKEN_ACTION="preserved"
else
  if command -v openssl >/dev/null 2>&1; then
    RELAY_TOKEN="$(openssl rand -hex 32)"
  else
    RELAY_TOKEN="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
  fi
fi

umask 077
cat > "$OUT" <<EOF
RELAY_TOKEN=$RELAY_TOKEN
CHAIN_ID=$CHAIN_ID
ACCOUNT_CLASS_HASH=$ACCOUNT_CLASS_HASH
IDENTITY_REGISTRY_CLASS_HASH=$IDENTITY_REGISTRY_CLASS_HASH
IDENTITY_REGISTRY_ADDRESS=$IDENTITY_REGISTRY_ADDRESS
IDENTITY_REGISTRY_OWNER=$IDENTITY_REGISTRY_OWNER
IDENTITY_VERIFIER_ADDRESS=$IDENTITY_VERIFIER_RESOLVED
IDENTITY_VERIFIER_PRIVATE_KEY=$IDENTITY_VERIFIER_PRIVATE_KEY
IDENTITY_VERIFICATION_MODE=$IDENTITY_VERIFICATION_MODE
NATIVE_TOKEN_ADDRESS=$NATIVE_TOKEN_ADDRESS
NATIVE_TOKEN_CLASS_HASH=$NATIVE_TOKEN_CLASS_HASH
CARD_NFT_ADDRESS=$CARD_NFT_ADDRESS
CARD_NFT_CLASS_HASH=$CARD_NFT_CLASS_HASH
STAKING_POOL_ADDRESS=$STAKING_POOL_ADDRESS
STAKING_POOL_CLASS_HASH=$STAKING_POOL_CLASS_HASH
USERSHIP_ADDRESS=$USERSHIP_ADDRESS
USERSHIP_CLASS_HASH=$USERSHIP_CLASS_HASH
BRIDGE_ADAPTER_ADDRESS=$BRIDGE_ADAPTER_ADDRESS
BRIDGE_ADAPTER_CLASS_HASH=$BRIDGE_ADAPTER_CLASS_HASH
REGISTRY_ADMIN_ADDRESS=$REGISTRY_ADMIN_ADDRESS
REGISTRY_ADMIN_PRIVATE_KEY=$REGISTRY_ADMIN_PRIVATE_KEY
RECOVERY_CONTROLLER=$RECOVERY_CONTROLLER
RECOVERY_DELAY_SECONDS=$RECOVERY_DELAY_SECONDS
DEPLOY_MINT_AMOUNT=5000000000000000
RATE_LIMIT_PER_MINUTE=60
EOF
chmod 600 "$OUT"

echo "Relay environment written to $OUT with mode 0600; bearer token $TOKEN_ACTION."
echo "The registry-owner and identity-verifier private keys are stored only in $OUT and are never printed."
if [[ "$TOKEN_ACTION" == "generated" ]]; then
  echo "A new RELAY_TOKEN was generated. Copy it only into the Base44 server-side secret SWAPPULSE_TX_RELAY_TOKEN, never into browser code or ChainNetworkConfig."
else
  echo "The existing RELAY_TOKEN was preserved, so the matching Base44 server-side secret does not need to change."
fi
echo "Start the relay with: docker compose --env-file .env --env-file .env.relay --profile provisioning up -d --build tx-relay"
