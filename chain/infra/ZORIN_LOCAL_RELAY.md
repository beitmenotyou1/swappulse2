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

## 6. Create the persistent Cloudflare Tunnel

Use a named Cloudflare Tunnel for the persistent SwapPulse testnet. One tunnel publishes two fixed hostnames: the read-only RPC gateway and the authenticated transaction relay. Raw Devnet port `5050` is never routed.

First authenticate `cloudflared` once if this host does not already have `~/.cloudflared/cert.pem`:

```bash
cloudflared tunnel login
```

Complete the browser login and select the Cloudflare zone that will hold the SwapPulse hostnames.

Set the fixed SwapPulse hostnames in `.env`:

```text
SWAPPULSE_RPC_HOSTNAME=rpc.swappulse.org
SWAPPULSE_TX_RELAY_HOSTNAME=relay.swappulse.org
SWAPPULSE_CLOUDFLARE_TUNNEL_NAME=swappulse-testnet
```

Then configure or reuse the named tunnel:

```bash
cd ~/swappulse2/chain/infra
bash ./configure-named-cloudflare-tunnel.sh
```

The helper verifies both local services first, creates/reuses the named tunnel, writes a mode-0600 ingress configuration under `~/.cloudflared/`, creates the two DNS routes and updates `SWAPPULSE_PUBLIC_RPC_URL` to the stable RPC `/rpc` endpoint. The ingress config contains only:

- the RPC hostname → `127.0.0.1:${SWAPPULSE_GATEWAY_PORT:-8080}`
- the relay hostname → `127.0.0.1:${SWAPPULSE_TX_RELAY_PORT:-8081}`
- a final catch-all `http_status:404`

For the first verification run the printed `cloudflared tunnel --config ... run ...` command in a separate terminal and keep it running.

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

Before Base44 activation, the public HTTPS RPC in the manifest must also pass verification. If the manifest still contains an old Quick Tunnel URL after migrating to the named tunnel, adopt the stable URL without redeploying contracts:

```bash
cd ~/swappulse2/chain/scripts/tooling
set -a
source ../../infra/.env
set +a
node update-public-rpc.mjs ../../deployments/swappulse-testnet.json
node verify-network.mjs ../../deployments/swappulse-testnet.json
```

`update-public-rpc.mjs` verifies the stable RPC chain ID and deployed registry class hash before modifying the manifest. The following `verify-network.mjs` performs the full public verification, including owner and verifier authority.

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
curl -sS --fail-with-body http://127.0.0.1:8081/healthz
```

## 9. Use the fixed transaction relay hostname

The named tunnel from step 6 already publishes the transaction relay. Its stable HTTPS address is:

```text
https://<SWAPPULSE_TX_RELAY_HOSTNAME>
```

That fixed URL is the value for the Base44 server-side secret:

```text
SWAPPULSE_TX_RELAY_URL
```

The relay still requires its bearer token on protected endpoints, so publishing the hostname does not expose privileged transaction execution by itself.

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

The relay image installs its own dependencies inside Docker. The host-side smoke test needs the same locked dependency set locally before Node can import `starknet`:

```bash
cd ~/swappulse2/chain/infra/tx-relay
npm ci --ignore-scripts
node smoke-policy.mjs
```

The test uses a local mock upstream and does not use `.env.relay`, print the relay bearer token or contact the public RPC. It must finish with `Relay policy smoke checks passed.` before the relay is exposed publicly.

Then import `chain/deployments/swappulse-testnet.json` in SwapPulse Admin under **Identity & Federation**, verify the network through the public RPC, and only then test identity provisioning.

## Quick Tunnel fallback

`refresh-public-rpc-tunnel.sh` remains available only as a temporary diagnostic/development fallback. `trycloudflare.com` URLs are not the persistent SwapPulse testnet architecture. Use the named tunnel and fixed hostnames for Base44 activation and continuing Web3 identity work.
