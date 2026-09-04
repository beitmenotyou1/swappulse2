---
description: Move the SwapPulse chain services to an always-on mini PC without redeploying.
---

# Mini PC Migration

This procedure migrates the existing `SWAPPULSE_TESTNET` runtime without redeploying contracts or changing the public hostnames.

Public endpoints remain:

* `https://rpc.swappulse.org/rpc`
* `https://relay.swappulse.org`

The existing Devnet dump, Devnet seed and Cloudflare tunnel identity are preserved. Raw Devnet port `5050` remains loopback-only.

## Security model

* Transfer only over the private Tailscale/SSH path. Do not open public SSH.
* Never copy `cert.pem` to the mini PC. It is an account-wide Cloudflare management credential.
* Copy only the `swappulse-testnet` tunnel-scoped `<UUID>.json` credential to the mini PC.
* Do not commit `.env`, `.env.relay`, the Devnet dump or Cloudflare credentials.
* Do not copy `.env.relay`; regenerate it on the mini PC after the migrated chain is verified.
* Do not expose port `5050` publicly.
* Keep Starknet Devnet pinned to `shardlabs/starknet-devnet-rs:0.8.2`. Devnet dump/load compatibility is not guaranteed across versions.

## Phase 1: mini-PC runtime preflight

The runtime host needs Docker/Compose, Git, Node.js 22+, OpenSSL and `cloudflared`. Scarb, Starknet Foundry and Universal Sierra Compiler are not required merely to run the already-deployed testnet; keep those development tools on a development machine unless contract development will also happen on the mini PC.

On the mini PC:

```bash
hostname
uname -a
git --version
docker --version
docker compose version
node --version
openssl version
cloudflared --version
tailscale status
```

Do not continue until Docker works without exposing its daemon publicly and Node is 22 or newer.

Check that the copied Zorin port assignments will not collide with an existing mini-PC service:

```bash
sudo ss -ltnp | grep -E ':(5050|18080|8081)\\b' || echo 'SwapPulse candidate ports are currently free'
```

The migrated `.env` currently decides the actual host ports. If a collision exists, change only the corresponding loopback host-port variable after the transfer (`SWAPPULSE_RAW_RPC_PORT`, `SWAPPULSE_GATEWAY_PORT`, or `SWAPPULSE_TX_RELAY_PORT`); never bind raw Devnet to a public interface. For example, if another mini-PC service already owns `8081`, use `SWAPPULSE_TX_RELAY_PORT=18081`. The Cloudflare ingress helper reads that value, so the public URL remains `https://relay.swappulse.org`.

Clone or update the existing repository using the host's already-authorised GitHub method. If GitHub authentication is not configured on the mini PC, do **not** enter an account password: copy the already-synchronised repository from Zorin over Tailscale instead.

Preferred when mini-PC GitHub auth already works:

```bash
cd ~
if [ -d swappulse2/.git ]; then
  cd swappulse2
  git pull --ff-only
else
  git clone https://github.com/beitmenotyou1/swappulse2.git
  cd swappulse2
fi
```

Fallback when GitHub authentication is unavailable on the mini PC. First make the Zorin checkout current by running Git on Zorin, where its existing credentials remain local:

```bash
ssh michael@100.104.37.96 \
  'cd ~/swappulse2 && git pull --ff-only && git log -1 --oneline'
```

Then copy the repository itself over the private Tailscale SSH path while excluding runtime secrets, live Devnet data and generated dependencies. This preserves the `.git` history without copying the live chain snapshot prematurely:

```bash
ssh michael@100.104.37.96 \
  "cd /home/michael && tar --exclude='*/node_modules' \
    --exclude='swappulse2/chain/infra/.env' \
    --exclude='swappulse2/chain/infra/.env.relay' \
    --exclude='swappulse2/chain/infra/data' \
    -czf - swappulse2" \
  | tar -xzf - -C "$HOME"

cd ~/swappulse2
git status --short
git log -1 --oneline
```

This fallback does not transfer GitHub tokens, SSH keys or credential stores. GitHub authentication can be configured separately later if the runtime host needs to pull updates directly.

Install the runtime Node tooling:

```bash
cd ~/swappulse2/chain/scripts/tooling
npm ci
cd ~/swappulse2/chain/infra/tx-relay
npm ci --ignore-scripts
```

## Phase 2: quiesce the Zorin writer and take the migration snapshot

On Zorin, stop every path that can write to the chain before copying the dump:

```bash
cd ~/swappulse2/chain/infra

docker compose --env-file .env --env-file .env.relay \
  --profile provisioning stop tx-relay

docker compose stop rpc-gateway devnet
```

Confirm the containers are stopped and the dump exists:

```bash
docker compose --env-file .env --env-file .env.relay \
  --profile provisioning ps -a

stat data/swappulse-testnet.dump
sha256sum data/swappulse-testnet.dump
```

Record the SHA-256 output locally. Do not paste private environment files into chat.

For continuity while the mini PC is being prepared, restart **read-only** Zorin services only. Leave `tx-relay` stopped so the copied chain state cannot diverge through normal SwapPulse writes:

```bash
docker compose up -d devnet rpc-gateway
```

The existing Zorin Cloudflare connector may remain running during this read-only overlap.

## Phase 3: transfer the minimum required runtime state over Tailscale

On Zorin, determine the tunnel UUID from the existing config:

```bash
TUNNEL_ID="$(awk '/^tunnel:[[:space:]]*/ {print $2; exit}' ~/.cloudflared/swappulse-testnet.yml)"
printf 'Tunnel ID: %s\n' "$TUNNEL_ID"
test -f "$HOME/.cloudflared/${TUNNEL_ID}.json"
```

Set the mini PC SSH account and private Tailscale hostname. `mini-server` assumes Tailscale MagicDNS is enabled; otherwise use the mini PC's Tailscale IP/hostname.

```bash
read -rp 'Mini PC SSH username: ' MINI_USER
MINI_HOST=mini-server
ssh "$MINI_USER@$MINI_HOST" 'hostname; tailscale ip -4'
```

Prepare private staging directories on the mini PC:

```bash
ssh "$MINI_USER@$MINI_HOST" \
  'mkdir -p ~/swappulse-migration ~/.cloudflared && chmod 700 ~/swappulse-migration ~/.cloudflared'
```

Copy only the required state:

```bash
scp ~/swappulse2/chain/infra/.env \
  "$MINI_USER@$MINI_HOST:~/swappulse-migration/swappulse.env"

scp ~/swappulse2/chain/infra/data/swappulse-testnet.dump \
  "$MINI_USER@$MINI_HOST:~/swappulse-migration/swappulse-testnet.dump"

scp ~/swappulse2/chain/deployments/swappulse-testnet.json \
  "$MINI_USER@$MINI_HOST:~/swappulse-migration/swappulse-testnet.json"

scp "$HOME/.cloudflared/${TUNNEL_ID}.json" \
  "$MINI_USER@$MINI_HOST:~/swappulse-migration/${TUNNEL_ID}.json"
```

Do **not** copy `~/.cloudflared/cert.pem` and do **not** copy `.env.relay`.

## Phase 4: install the snapshot on the mini PC

On the mini PC:

```bash
cd ~/swappulse2/chain/infra

cp ~/swappulse-migration/swappulse.env .env
chmod 600 .env

mkdir -p data
cp ~/swappulse-migration/swappulse-testnet.dump data/swappulse-testnet.dump

mkdir -p ../deployments
cp ~/swappulse-migration/swappulse-testnet.json ../deployments/swappulse-testnet.json

TUNNEL_CREDENTIAL="$(find "$HOME/swappulse-migration" -maxdepth 1 -type f \
  -regextype posix-extended \
  -regex '.*/[0-9a-fA-F-]{36}\\.json' \
  -print -quit)"
if [[ -z "$TUNNEL_CREDENTIAL" ]]; then
  echo 'Could not identify the copied Cloudflare tunnel credential UUID.' >&2
  exit 1
fi
TUNNEL_ID="$(basename "$TUNNEL_CREDENTIAL" .json)"
cp "$TUNNEL_CREDENTIAL" "$HOME/.cloudflared/${TUNNEL_ID}.json"
chmod 600 "$HOME/.cloudflared/${TUNNEL_ID}.json"
```

Verify the dump checksum matches the Zorin checksum recorded in Phase 2:

```bash
sha256sum ~/swappulse2/chain/infra/data/swappulse-testnet.dump
```

Prepare bind-mount ownership for the pinned Devnet image without assuming a UID/GID. Use Docker itself for the ownership change so this also works over non-interactive SSH without a `sudo` password prompt:

```bash
cd ~/swappulse2/chain/infra
DEVNET_UID="$(docker run --rm --entrypoint sh shardlabs/starknet-devnet-rs:0.8.2 -c 'id -u')"
DEVNET_GID="$(docker run --rm --entrypoint sh shardlabs/starknet-devnet-rs:0.8.2 -c 'id -g')"
docker run --rm --user 0:0 \
  -v "$PWD/data:/hostdata" \
  --entrypoint sh \
  shardlabs/starknet-devnet-rs:0.8.2 \
  -c "chown -R $DEVNET_UID:$DEVNET_GID /hostdata && chmod -R u+rwX,go-rwx /hostdata"
```

## Phase 5: restore and prove the exact existing chain locally

Start only Devnet and the read-only gateway first:

```bash
cd ~/swappulse2/chain/infra
docker compose up -d --build devnet rpc-gateway
docker compose ps
```

The pinned Devnet starts with `--dump-path /data/swappulse-testnet.dump`, which loads the preserved state on startup.

Check the raw localhost chain ID:

```bash
curl -sS --fail-with-body \
  -X POST http://127.0.0.1:5050 \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"starknet_chainId","params":[]}'
```

Then use the existing deployment verifier against the **mini PC's local Devnet**:

```bash
cd ~/swappulse2/chain/scripts/tooling
SWAPPULSE_VERIFY_RPC_URL=http://127.0.0.1:5050 \
  node verify-network.mjs ../../deployments/swappulse-testnet.json
```

Do not continue unless this returns `ok: true` with the existing IdentityRegistry address, class hash, owner, verifier and account class hash.

### If startup did not replay the dump

Devnet 0.8.2 documents `--dump-path <PATH>` as the startup-load flag and also supports explicit `devnet_load`. If verification reports `Contract not found`, do not redeploy. Preserve the copied migration snapshot and explicitly load that frozen file into the already-running Devnet:

```bash
cd ~/swappulse2/chain/infra

cp ~/swappulse-migration/swappulse-testnet.dump data/swappulse-restore.dump
DEVNET_UID="$(docker exec infra-devnet-1 id -u)"
DEVNET_GID="$(docker exec infra-devnet-1 id -g)"
docker run --rm --user 0:0 \
  -v "$PWD/data:/hostdata" \
  --entrypoint sh \
  shardlabs/starknet-devnet-rs:0.8.2 \
  -c "chown $DEVNET_UID:$DEVNET_GID /hostdata/swappulse-restore.dump && chmod 600 /hostdata/swappulse-restore.dump"

curl -sS --fail-with-body \
  -X POST http://127.0.0.1:5050 \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"devnet_load","params":{"path":"/data/swappulse-restore.dump"}}'
```

Immediately rerun `verify-network.mjs` against `http://127.0.0.1:5050`. If `devnet_load` itself errors with `Invalid transaction nonce`, the preserved dump is a partial replay log whose prerequisite transactions were omitted. Do not deploy replacement contracts. Keep the immutable partial dump outside `chain/infra/data` (for example `/home/michael/swappulse-restore.dump`) and run `chain/scripts/tooling/recover-devnet-persistence.mjs` on the original Zorin host with `SWAPPULSE_RECOVERY_SOURCE_FILE` pointing to that immutable host file. The recovery tool reconstructs the missing nonce prefix, reads that prefix from Devnet's existing `--dump-on block --dump-path /data/swappulse-testnet.dump` output, stages a combined nonce 0-4 replay only after resetting Devnet, verifies the original registry and transaction hashes, and writes a new self-contained replay file. Restart Zorin from that repaired dump before migrating it to the mini PC.

## Phase 6: regenerate relay credentials on the mini PC

The public RPC still points at the read-only Zorin copy during this transition, so it should match the same preserved state. Generate a fresh relay environment on the mini PC; this derives the same registry-owner/verifier accounts from the migrated Devnet seed but rotates the bearer token.

```bash
cd ~/swappulse2/chain/infra
bash ./setup-relay-env.sh
stat -c '%a %n' .env.relay
```

Expected mode: `600`.

Start and verify the relay locally:

```bash
docker compose --env-file .env --env-file .env.relay \
  --profile provisioning up -d --build --force-recreate tx-relay

curl -sS --fail-with-body http://127.0.0.1:8081/healthz

RELAY_TOKEN="$(sed -n 's/^RELAY_TOKEN=//p' .env.relay)"
curl -sS --fail-with-body \
  -H "Authorization: Bearer $RELAY_TOKEN" \
  http://127.0.0.1:8081/readyz
unset RELAY_TOKEN
```

Run the relay policy suite on the mini PC:

```bash
cd ~/swappulse2/chain/infra/tx-relay
node smoke-policy.mjs
```

It must finish with `Relay policy smoke checks passed.`

## Phase 7: add the mini PC as a replica of the existing named Cloudflare Tunnel

Do not run `cloudflared tunnel login` on the mini PC and do not copy `cert.pem`.

Configure a tunnel replica using the copied tunnel-scoped credential:

```bash
cd ~/swappulse2/chain/infra
bash ./configure-cloudflare-tunnel-replica.sh "$TUNNEL_ID"
```

Start the mini connector in the foreground for the cutover test:

```bash
cloudflared tunnel \
  --config "$HOME/.cloudflared/swappulse-testnet.yml" \
  run "$TUNNEL_ID"
```

Cloudflare supports running the same locally-managed tunnel on additional hosts using the same tunnel credential. Each process becomes a separate connector/replica.

## Phase 8: cut traffic over to the mini PC

Once the mini connector reports registered connections, stop the Zorin `swappulse-testnet` Cloudflare connector. Do not stop unrelated Cloudflare tunnels.

If Zorin is still using the foreground command, press `Ctrl+C` only in that terminal. If the dedicated SwapPulse service was installed on Zorin:

```bash
sudo systemctl disable --now cloudflared-swappulse-testnet.service
```

With the Zorin SwapPulse connector stopped, verify the public endpoints are now served exclusively by the mini PC:

```bash
curl -sS --fail-with-body \
  -X POST https://rpc.swappulse.org/rpc \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"starknet_chainId","params":[]}'

curl -sS --fail-with-body https://relay.swappulse.org/healthz

RELAY_TOKEN="$(sed -n 's/^RELAY_TOKEN=//p' ~/swappulse2/chain/infra/.env.relay)"
curl -sS --fail-with-body \
  -H "Authorization: Bearer $RELAY_TOKEN" \
  https://relay.swappulse.org/readyz
unset RELAY_TOKEN
```

Verify the public manifest again from the mini PC:

```bash
cd ~/swappulse2/chain/scripts/tooling
node verify-network.mjs ../../deployments/swappulse-testnet.json
```

## Phase 9: make the mini PC the permanent connector

Install the dedicated SwapPulse tunnel unit. It does not replace or modify any generic/other Cloudflare tunnel service:

```bash
cd ~/swappulse2/chain/infra
bash ./install-swappulse-tunnel-service.sh
systemctl is-enabled cloudflared-swappulse-testnet.service
systemctl is-active cloudflared-swappulse-testnet.service
```

After the systemd service is active, stop the temporary foreground mini-PC `cloudflared tunnel ... run ...` process and repeat the public RPC and relay health checks.

Docker already uses `restart: unless-stopped` for Devnet, RPC gateway and the created relay container, so they return when Docker starts after a reboot.

## Phase 10: Base44 activation and Zorin retirement

Only after the mini PC passes local verification, public verification, relay readiness and the policy smoke test:

1. Set Base44 server-side secret `SWAPPULSE_TX_RELAY_URL` to `https://relay.swappulse.org`.
2. Set Base44 server-side secret `SWAPPULSE_TX_RELAY_TOKEN` to the **new mini-PC** `RELAY_TOKEN`. Never paste it into chat or a frontend field.
3. Import the public `chain/deployments/swappulse-testnet.json` in **Admin → Identity & Federation** and run **Verify & Activate**.
4. Run the first Base44 → relay → Cairo registration only after Base44 reports the relay and network verified.

After cutover is verified, stop the old Zorin chain runtime:

```bash
cd ~/swappulse2/chain/infra
docker compose --env-file .env --env-file .env.relay \
  --profile provisioning stop tx-relay rpc-gateway devnet
```

Keep the Zorin migration snapshot only as a short-lived rollback copy until the mini PC has survived a restart and passed the same checks. Then remove the old live relay credential and tunnel-scoped credential from Zorin so it is no longer an authorised SwapPulse runtime host.
