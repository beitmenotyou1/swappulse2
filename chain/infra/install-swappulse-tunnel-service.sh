#!/usr/bin/env bash
set -euo pipefail
set +x

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SWAPPULSE_ENV_FILE:-$HERE/.env}"
CLOUDFLARED_BIN="${CLOUDFLARED_BIN:-$(command -v cloudflared || true)}"
UNIT_NAME="cloudflared-swappulse-testnet.service"
RUN_USER="${SWAPPULSE_TUNNEL_USER:-$(id -un)}"
RUN_GROUP="${SWAPPULSE_TUNNEL_GROUP:-$(id -gn)}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Environment file not found: $ENV_FILE" >&2
  exit 1
fi
if [[ -z "$CLOUDFLARED_BIN" || ! -x "$CLOUDFLARED_BIN" ]]; then
  echo "cloudflared executable not found" >&2
  exit 1
fi

TUNNEL_NAME="$(grep '^SWAPPULSE_CLOUDFLARE_TUNNEL_NAME=' "$ENV_FILE" | tail -n 1 | cut -d= -f2- || true)"
TUNNEL_NAME="${TUNNEL_NAME:-swappulse-testnet}"
CONFIG_FILE="${SWAPPULSE_TUNNEL_CONFIG:-$HOME/.cloudflared/${TUNNEL_NAME}.yml}"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Tunnel config not found: $CONFIG_FILE" >&2
  echo "Run bash ./configure-named-cloudflare-tunnel.sh first." >&2
  exit 1
fi

TUNNEL_ID="$(awk '/^tunnel:[[:space:]]*/ {print $2; exit}' "$CONFIG_FILE")"
CREDENTIALS_FILE="$(awk '/^credentials-file:[[:space:]]*/ {sub(/^credentials-file:[[:space:]]*/, ""); print; exit}' "$CONFIG_FILE")"

if [[ -z "$TUNNEL_ID" ]]; then
  echo "Tunnel ID missing from $CONFIG_FILE" >&2
  exit 1
fi
if [[ -z "$CREDENTIALS_FILE" || ! -f "$CREDENTIALS_FILE" ]]; then
  echo "Tunnel credentials file from config is missing" >&2
  exit 1
fi

# Verify the selected tunnel exists before writing a boot service.
if ! "$CLOUDFLARED_BIN" tunnel info "$TUNNEL_ID" >/dev/null 2>&1; then
  echo "Cloudflare tunnel $TUNNEL_ID is not available to the current login." >&2
  exit 1
fi

unit_tmp="$(mktemp)"
trap 'rm -f "$unit_tmp"' EXIT
cat > "$unit_tmp" <<UNIT
[Unit]
Description=Cloudflare Tunnel for SwapPulse testnet
Documentation=https://developers.cloudflare.com/tunnel/
Wants=network-online.target
After=network-online.target docker.service

[Service]
Type=simple
User=$RUN_USER
Group=$RUN_GROUP
Environment=HOME=$HOME
ExecStart=$CLOUDFLARED_BIN tunnel --config $CONFIG_FILE run $TUNNEL_ID
Restart=on-failure
RestartSec=5s
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
LockPersonality=true

[Install]
WantedBy=multi-user.target
UNIT

sudo install -o root -g root -m 0644 "$unit_tmp" "/etc/systemd/system/$UNIT_NAME"
sudo systemctl daemon-reload
sudo systemctl enable --now "$UNIT_NAME"

echo
sudo systemctl --no-pager --full status "$UNIT_NAME" || true

echo
echo "Dedicated SwapPulse tunnel service installed: $UNIT_NAME"
echo "Config: $CONFIG_FILE"
echo "Tunnel ID: $TUNNEL_ID"
echo "This service runs as $RUN_USER and does not replace the generic cloudflared.service or other named tunnels."
