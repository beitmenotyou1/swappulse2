#!/usr/bin/env bash

# Prepare SWAPPULSE_NODELAB_1 local-only configuration.
# Generates fresh lab-only keys without printing them. Never copies live keys.

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
ENV_LOCAL="$HERE/.env.local"
ENV_IMAGE="$HERE/.env.image"
IMAGE="${NODELAB_MADARA_IMAGE:-ghcr.io/madara-alliance/madara@sha256:3c931fa515bbd3760fd5cbc0bcdceb557d3edbd44bec0231cdf52dd6abb475f6}"

if ! command -v openssl >/dev/null 2>&1; then
  printf 'openssl is required to generate lab-only keys.\n'
  exit 1
fi

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  printf 'Pulling reviewed immutable Madara image...\n'
  docker pull "$IMAGE" || exit 1
fi

printf 'MADARA_IMAGE=%s\n' "$IMAGE" > "$ENV_IMAGE"
chmod 0644 "$ENV_IMAGE"

if [ -e "$ENV_LOCAL" ]; then
  printf '%s already exists. Refusing to overwrite lab secrets.\n' "$ENV_LOCAL"
else
  SEQUENCER_KEY="0x$(openssl rand -hex 31)"
  DEPLOYER_KEY="0x$(openssl rand -hex 31)"

  cat > "$ENV_LOCAL" <<EOF
NODELAB_CHAIN_ID=SWAPPULSE_NODELAB_1
NODELAB_CHAIN_NAME=SwapPulse_NodeLab_1
NODELAB_BLOCK_TIME=2s
NODELAB_DEVNET_CONTRACTS=5
NODELAB_SEQUENCER_RPC_PORT=19950
NODELAB_OBSERVER_RPC_PORT=19951
NODELAB_SEQUENCER_MEMORY_LIMIT=2g
NODELAB_OBSERVER_MEMORY_LIMIT=2g
NODELAB_SEQUENCER_CPU_LIMIT=2.0
NODELAB_OBSERVER_CPU_LIMIT=2.0
NODELAB_PIDS_LIMIT=512
NODELAB_STOP_GRACE_PERIOD=330s
NODELAB_SEQUENCER_PRIVATE_KEY=$SEQUENCER_KEY
NODELAB_DEPLOYER_PRIVATE_KEY=$DEPLOYER_KEY
EOF
  chmod 0600 "$ENV_LOCAL"
  unset SEQUENCER_KEY DEPLOYER_KEY
fi

printf 'Prepared SWAPPULSE_NODELAB_1.\n'
printf 'Image pin: %s\n' "$IMAGE"
printf 'Secrets file: %s (mode 0600, values not displayed)\n' "$ENV_LOCAL"
printf 'Expected chain-id felt: 0x5357415050554c53455f4e4f44454c41425f31\n'
