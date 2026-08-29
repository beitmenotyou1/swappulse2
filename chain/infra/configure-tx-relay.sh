#!/usr/bin/env bash
set -euo pipefail
set +x

# Compatibility wrapper. Relay registration now requires the registry-owner
# signer to be resolved and verified locally, so there must be exactly one
# supported environment-generation path.
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -n "${SWAPPULSE_TX_RELAY_ENV_FILE:-}" && -z "${SWAPPULSE_RELAY_ENV_FILE:-}" ]]; then
  export SWAPPULSE_RELAY_ENV_FILE="$SWAPPULSE_TX_RELAY_ENV_FILE"
fi

echo "configure-tx-relay.sh now delegates to setup-relay-env.sh so registry registration uses the hardened host-only signer configuration."
exec "$HERE/setup-relay-env.sh"
