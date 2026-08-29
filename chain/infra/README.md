# SwapPulse persistent private testnet

This package turns the Milestone 1 contracts into a long-lived **development testnet**, without pretending that Starknet Devnet is the future sovereign SwapPulse L3.

## Security model

There are two RPC surfaces:

- **Raw Devnet RPC**: bound to `127.0.0.1:5050` by default. It supports deployment and privileged `devnet_*` methods. Never expose this port to the internet.
- **Read-only RPC gateway**: bound to `127.0.0.1:8080` by default. Put the public HTTPS hostname/tunnel in front of this port. It exposes only the Starknet read methods currently required by Base44.

Allowed public methods are:

- `starknet_specVersion`
- `starknet_chainId`
- `starknet_getClassHashAt`
- `starknet_getClass`
- `starknet_call`

JSON-RPC batches and every `devnet_*` method are denied. The gateway also applies a request body cap, upstream response cap, timeout and per-IP rate limit.

## Persistent state

Devnet is pinned to `shardlabs/starknet-devnet-rs:0.8.2` and uses:

- custom chain ID `SWAPPULSE_TESTNET`
- block generation on each transaction
- `--dump-on block`
- persistent dump file `/data/swappulse-testnet.dump`

`./data` is bind-mounted into the container so contract/state history survives container restarts. Keep the same Devnet version, seed and predeployment configuration when loading an existing dump. Devnet prints its deterministic predeployed private keys during startup, so the Compose service deliberately uses Docker's `none` logging driver and the raw RPC remains loopback-only.

The persistence path was exercised end-to-end on 29 August 2026: the compiled SwapPulse classes were declared, `IdentityRegistry` was deployed, state was dumped, Devnet was stopped/restarted from that dump, and `verify-network.mjs` still verified the same registry class hash and owner after restart.

This persistence mechanism is appropriate for the current contract/UX milestone. It is **not** a substitute for the future sequencer/prover/DA/validator architecture.

## 1. Prepare the host

Requirements:

- Docker + Docker Compose
- Node.js 22 for the deployment tooling
- the built Cairo/CASM artifacts described in `../README.md`

Create the local environment file:

```bash
cd chain/infra
seed="$(od -An -N4 -tu4 /dev/urandom | tr -d ' ')"
sed "s/CHANGE_ME_TO_A_RANDOM_INTEGER/$seed/" .env.example > .env
```

The seed controls Devnet's deterministic test accounts. It is not a production wallet secret, but treat it as private operational configuration because anyone who knows it can derive the predeployed test-account keys.

## 2. Start the private node

```bash
docker compose up -d --build
```

Check the read-only gateway locally:

```bash
curl -s http://127.0.0.1:8080/healthz
curl -s http://127.0.0.1:8080/ \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"starknet_chainId","params":[]}'
```

Confirm a privileged Devnet method is blocked by the gateway:

```bash
curl -i http://127.0.0.1:8080/ \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"devnet_getPredeployedAccounts","params":{}}'
```

That request must return HTTP `403`.

## 3. Deploy the verified Milestone 1 contracts

Install the separate Node 22 chain tooling first:

```bash
cd ../scripts/tooling
npm ci
npm audit
cd ../../infra
```

Then run:

```bash
chmod +x deploy-contracts.sh
./deploy-contracts.sh
```

The script obtains the first Devnet deployment account through the **loopback-only raw RPC**, passes its private key only through the deployment process environment, and never writes or prints the private key. It produces the public manifest at:

```text
chain/deployments/swappulse-testnet.json
```

The manifest contains the chain ID, declared class hashes, `IdentityRegistry` address/owner, recovery policy and deployment transaction hashes.

## 4. Publish only the read-only gateway over HTTPS

Use your HTTPS reverse proxy or tunnel to publish:

```text
http://127.0.0.1:8080
```

Do **not** publish `127.0.0.1:5050`.

The resulting public URL must be normal unauthenticated HTTPS because Base44's reconciler deliberately refuses embedded RPC credentials and performs SSRF checks. Security comes from the gateway's strict read-method allowlist, not from exposing Devnet's administrative API.

Example intended shape:

```text
https://rpc-testnet.example.org  ->  127.0.0.1:8080
```

Before using the URL in Base44, verify it externally with `starknet_chainId` and confirm `devnet_*` is still rejected.

## 5. Activate in SwapPulse

Open:

**Admin → Identity & Federation → SwapPulse Network — Identity Testnet**

Copy these public values from `deployments/swappulse-testnet.json`:

- `chain_id`
- `account_class_hash`
- `identity_registry_class_hash`
- `identity_registry_address`
- `identity_registry_owner`
- `recovery_controller`
- `recovery_delay_seconds`

Set `rpc_url` to the public HTTPS read-only gateway.

Use:

**Save Configuration Draft → Verify & Activate**

Base44 independently verifies the RPC chain ID, registry address/class/owner and account class declaration before setting the network to `CONFIGURED`.

## Backups and upgrades

Back up `chain/infra/data/swappulse-testnet.dump` along with the public deployment manifest. Stop the container cleanly before a manual snapshot when practical.

Do not upgrade the Devnet image in-place against the only copy of the state dump. Devnet dump compatibility is not guaranteed across versions. Copy the dump first and test any version upgrade separately.

For the eventual sovereign SwapPulse Network, replace this development node with the selected L3/appchain sequencer, proof and DA architecture rather than carrying Devnet into production.
