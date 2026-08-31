# SwapPulse local Starknet relay on Zorin OS

This is the local-development path for running the private SwapPulse Starknet testnet, creating the relay bearer token, and exposing the read-only RPC and transaction relay through temporary HTTPS Cloudflare tunnels.

## Security rules

- Never expose raw Devnet port `5050` to the internet.
- Never commit `.env`, `.env.relay`, `chain/infra/data/` or `chain/infra/secrets/`.
- Never paste `REGISTRY_ADMIN_PRIVATE_KEY` into Base44, GitHub, chat, browser code or logs.
- Only `RELAY_TOKEN` is copied to the Base44 server-side secret `SWAPPULSE_TX_RELAY_TOKEN`.
- `POLYGON_PRIVATE_KEY` is not required for this Starknet identity path.

## 1. Install host tools

The project requires Docker with the Compose plugin, Git, OpenSSL, Node.js 22+, Scarb/Cairo 2.13.1, Starknet Foundry 0.51.2, Universal Sierra Compiler 2.8.0 and `cloudflared`. Devnet 0.8.2 uses USC 2.8.0 internally, so this pin is required for matching `DECLARE` compiled-class hashes.

Check what you already have first:

```bash
git --version
node --version
docker --version
docker compose version
openssl version
cloudflared --version
scarb --version
snforge --version
universal-sierra-compiler --version
```

Use the official Docker, Cloudflare, Scarb and Starknet Foundry installation instructions when a tool is missing. Keep the Cairo/Foundry versions pinned to the values in `chain/README.md` while this testnet milestone is active.

## 2. Clone the Base44-synced GitHub repository

After GitHub two-way sync has been enabled in Base44:

```bash
git clone <YOUR_SWAPPULSE_GIT_URL>
cd <YOUR_SWAPPULSE_REPOSITORY>
npm install
```

## 3. Build and test the Cairo contracts

```bash
cd chain
SCARB_BIN=scarb SNFORGE_BIN=snforge bash scripts/test-chain.sh
```

Do not continue until the suite is green.

## 4. Create the private testnet environment

```bash
cd infra
seed="$(od -An -N4 -tu4 /dev/urandom | tr -d ' ')"
sed "s/CHANGE_ME_TO_A_RANDOM_INTEGER/$seed/" .env.example > .env
chmod 600 .env
```

At this stage `SWAPPULSE_PUBLIC_RPC_URL` still contains the placeholder value. We replace it after starting the read-only RPC tunnel.

## 5. Start Devnet and the read-only RPC gateway

```bash
docker compose up -d --build devnet rpc-gateway
docker compose ps

DEVNET_CID="$(docker compose ps -q devnet)"
DEVNET_UID="$(docker exec "$DEVNET_CID" id -u)"
HOST_GID="$(id -g)"
sudo mkdir -p data
sudo chown -R "$DEVNET_UID:$HOST_GID" data
sudo chmod -R ug+rwX,o-rwx data
docker exec "$DEVNET_CID" sh -c 'touch /data/.write-test && rm /data/.write-test'

GATEWAY_PORT="$(grep '^SWAPPULSE_GATEWAY_PORT=' .env | cut -d= -f2-)"
GATEWAY_PORT="${GATEWAY_PORT:-8080}"
curl -sS --fail-with-body "http://127.0.0.1:${GATEWAY_PORT}/healthz"
```

The ownership step is required because Devnet dumps blockchain state into the bind-mounted `chain/infra/data/` directory after blocks. The command discovers the Devnet container UID dynamically instead of assuming a fixed numeric UID, while retaining access for the host user's primary group. The final `touch` is a safe write test and must succeed before deployment.

The raw Devnet remains on loopback port `5050`. The public-safe gateway uses `SWAPPULSE_GATEWAY_PORT` from `.env`, defaulting to `8080`. If `docker compose ps` shows a different host port, use that port. Do not assume `8080` when another local service already occupies it.

## 6. Create a temporary HTTPS URL for the read-only RPC

Open a second terminal and run:

```bash
cd ~/swappulse2/chain/infra
GATEWAY_PORT="$(grep '^SWAPPULSE_GATEWAY_PORT=' .env | cut -d= -f2-)"
GATEWAY_PORT="${GATEWAY_PORT:-8080}"
cloudflared tunnel --protocol http2 --url "http://127.0.0.1:${GATEWAY_PORT}"
```

`--protocol http2` is preferred here because it avoids QUIC instability seen on some VPN paths.

Copy the generated `https://...trycloudflare.com` URL. In the first terminal, replace the placeholder in `.env`:

```bash
nano .env
```

Set exactly one assignment line:

```text
SWAPPULSE_PUBLIC_RPC_URL=https://YOUR-RPC-TUNNEL.trycloudflare.com
```

Do not add the URL on a separate line by itself. Before deployment, verify only the safe public setting without printing the Devnet seed:

```bash
grep '^SWAPPULSE_PUBLIC_RPC_URL=' .env
```

Keep the RPC tunnel terminal running.

## 7. Install deployment tooling and deploy the contracts

```bash
cd ../scripts/tooling
npm ci
npm audit
cd ../../infra
set -a
source .env
set +a
bash ./deploy-contracts.sh
```

A public deployment manifest is written to `chain/deployments/swappulse-testnet.json`. It must not contain private keys. Contract verification during deployment uses the localhost raw RPC so a temporary Cloudflare outage cannot make a successful on-chain deployment appear to have failed.

Before Base44 activation, the public HTTPS RPC in the manifest must also pass verification. Quick Tunnel URLs can change or expire. If that happens, refresh it without redeploying contracts:

```bash
cd ~/swappulse2/chain/infra
bash ./refresh-public-rpc-tunnel.sh
```

The helper checks the local read-only gateway first, starts a fresh HTTP/2 Quick Tunnel, updates only `SWAPPULSE_PUBLIC_RPC_URL` in `.env`, confirms the new URL has the expected chain ID and deployed registry class hash, updates the existing manifest, then performs the full public verification including owner and verifier authority. The tunnel PID and log remain under `/tmp`, and no private key or bearer token is printed.

## 8. Generate the transaction relay token

```bash
bash ./setup-relay-env.sh
chmod 600 .env.relay
```

The script creates a random 32-byte `RELAY_TOKEN` plus the host-only registry test key in `.env.relay`. It deliberately does not print either secret.

Start the relay:

```bash
docker compose --env-file .env --env-file .env.relay \
  --profile provisioning up -d --build tx-relay
```

Check it locally:

```bash
curl http://127.0.0.1:8081/health
```

## 9. Create a temporary HTTPS URL for the transaction relay

Open another terminal and run:

```bash
cloudflared tunnel --url http://127.0.0.1:8081
```

The generated `https://...trycloudflare.com` address is the value for the Base44 server-side secret:

```text
SWAPPULSE_TX_RELAY_URL
```

Keep this relay tunnel terminal running.

## 10. Copy only the bearer token into Base44

On the Zorin PC, display only the relay token when you are ready to paste it into Base44's secure secret field:

```bash
grep '^RELAY_TOKEN=' .env.relay
```

Copy the value after `RELAY_TOKEN=` into:

```text
SWAPPULSE_TX_RELAY_TOKEN
```

Do not copy any other line from `.env.relay`.

## 11. Verify the relay policy

From the repository root:

```bash
node chain/infra/tx-relay/smoke-policy.mjs
```

Then import `chain/deployments/swappulse-testnet.json` in SwapPulse Admin under **Identity & Federation**, verify the network through the public RPC, and only then test identity provisioning.

## Temporary tunnel warning

Cloudflare quick-tunnel URLs change when `cloudflared` stops. If either URL changes, update the matching Base44/network configuration before testing again. For a persistent testnet, replace quick tunnels with named Cloudflare tunnels and fixed subdomains.
