# SwapPulse persistent private testnet

This package turns the Milestone 1 contracts into a long-lived **development testnet**, without pretending that Starknet Devnet is the future sovereign SwapPulse L3.

## Security model

There are three deliberately separate chain surfaces:

- **Raw Devnet RPC**: bound to `127.0.0.1:5050` by default. It supports deployment and privileged `devnet_*` methods. Never expose this port to the internet.
- **Read-only RPC gateway**: bound to `127.0.0.1:8080` by default. Put a public HTTPS hostname/tunnel in front of this port. It is unauthenticated but exposes only the read/simulation methods required for network verification, transaction drafting and chain reconciliation.
- **Provisioning transaction relay**: bound to `127.0.0.1:8081` and enabled only with the Compose `provisioning` profile after contracts are deployed. Publish it through a separate HTTPS hostname. It requires a strong bearer token and is called only by authenticated Base44 backend functions, never directly by browser JavaScript.

The read-only gateway allows only:

- `starknet_specVersion`
- `starknet_chainId`
- `starknet_blockNumber`
- `starknet_getBlockWithTxHashes`
- `starknet_getTransactionByHash`
- `starknet_getClassHashAt`
- `starknet_getClass`
- `starknet_call`
- `starknet_getNonce`
- `starknet_estimateFee`
- `starknet_getTransactionReceipt`
- `starknet_getTransactionStatus`

The block/transaction read methods above are the minimal public data surface required by the multilingual `/chain/` explorer. They remain read-only and the gateway still denies JSON-RPC batches, every `devnet_*` method and all transaction-submission methods.

JSON-RPC batches and every `devnet_*` method are denied on the public read gateway.

The provisioning relay accepts only the exact write operations needed for testnet identity setup:

- V3 `starknet_addDeployAccountTransaction` for the verified `SwapPulseAccount` class, with constructor public key and address salt bound to the user's reserved public key.
- V3 `starknet_addInvokeTransaction` where calldata is exactly the approved account-self recovery-controller and recovery-delay configuration.
- `POST /register` for one owner-only `IdentityRegistry.register_identity(identityId, accountAddress)` operation after the relay independently verifies registry class/owner, account class, deterministic public-key address, recovery policy and existing identity/reverse mappings.

The relay's privileged Devnet mint helper is not exposed as a faucet. It can mint only a fixed testnet amount to the exact counterfactual account implied by the approved class hash and public key. During host bootstrap, `setup-relay-env.sh` resolves the registry-owner test key from the loopback-only Devnet API, verifies its address matches the deployed registry owner, and stores it only in mode-`0600` `.env.relay`. Registration uses that preloaded host-only signer only after all registration policy checks pass; the key is never returned to Base44.

The relay bearer token and HTTPS URL are Base44 **server-side secrets** (`SWAPPULSE_TX_RELAY_TOKEN` and `SWAPPULSE_TX_RELAY_URL`). They must never appear in `ChainNetworkConfig`, frontend code or browser storage.

## Persistent state

Devnet is pinned to `shardlabs/starknet-devnet-rs:0.8.2` and uses:

- Devnet CLI chain ID `TESTNET` (required by this pinned Devnet version)
- SwapPulse's deployment manifest/network label remains `SWAPPULSE_TESTNET`
- the Devnet default of block generation on each transaction
- `--dump-on block` (the valid per-block persistence event for pinned Devnet `0.8.2`)
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

## 3. Publish the read-only gateway over HTTPS

Use your HTTPS reverse proxy or tunnel to publish:

```text
http://127.0.0.1:8080
```

Do **not** publish `127.0.0.1:5050`.

The resulting read RPC must be normal unauthenticated HTTPS because Base44's verifier/reconciler deliberately refuses embedded RPC credentials and performs SSRF checks. Security comes from the gateway's strict read-method allowlist, not from exposing Devnet's administrative API.

Example intended shape:

```text
https://rpc-testnet.example.org  ->  127.0.0.1:8080
```

Before deployment, verify the URL externally with `starknet_chainId` and confirm `devnet_*` is still rejected. Put this exact HTTPS URL in `SWAPPULSE_PUBLIC_RPC_URL` inside the host's private `.env`.

## 4. Activate the verified V2 contract suite on the chain host

Install the separate Node 22 chain tooling first:

```bash
cd ../scripts/tooling
npm ci
npm audit
cd ../../infra
```

For the normal V2 cut-over, use the fail-closed host wrapper:

```bash
chmod +x activate-v2-host.sh
./activate-v2-host.sh
```

Before any deployment it requires the pinned Scarb/Cairo and Starknet Foundry versions, runs the full contract test suite and relay policy smoke checks, confirms the raw Devnet RPC is loopback-only, proves the local read-only gateway returns `403` for `devnet_*`, and confirms the same privileged method is rejected on the public path. It then deploys all seven V2 components, verifies the canonical manifest both locally and through the public HTTPS RPC, regenerates the relay environment, starts the relay in V2 mode, and checks authenticated `/readyz` locally and through the public relay hostname.

Existing relay bearer tokens are preserved by default so a V2 environment refresh does not silently invalidate the Base44 server secret. Set `SWAPPULSE_ROTATE_RELAY_TOKEN=1` only for an intentional credential rotation where the Base44 server-side secret will also be updated.

For deployment-only troubleshooting, `./deploy-contracts.sh` remains available. It requires `SWAPPULSE_PUBLIC_RPC_URL`, obtains the Devnet deployment account through the **loopback-only raw RPC**, passes its private key only through the deployment process environment, and never writes or prints the private key.

A successful deployment produces the public manifest at:

```text
chain/deployments/swappulse-testnet.json
```

The schema-v2 manifest contains the chain ID, public read-only HTTPS RPC, declared class hashes, V2 contract addresses, `IdentityRegistry` owner/verifier, recovery policy and deployment transaction hashes. It never contains the raw localhost RPC, a bearer token or a private key.

## 5. Activate in SwapPulse

Open:

**Admin → Identity & Federation → SwapPulse Network — Identity Testnet**

The preferred path is **Import deployment manifest** and paste the entire public `deployments/swappulse-testnet.json`. The importer rejects secret-like fields, requires the correct manifest schema/network and HTTPS RPC, and saves only an unverified draft.

You can still enter the public fields manually if necessary. In either case use:

**Verify & Activate**

Base44 independently verifies the RPC chain ID, registry address/class/owner and account class declaration before setting the network to `CONFIGURED`.

## 6. Start the provisioning relay for self-service test identities

If you used `activate-v2-host.sh`, the relay has already been regenerated, started and checked in V2 mode. The commands below are the manual recovery/troubleshooting path.

After the deployment manifest exists, generate the relay's local environment from that verified public manifest:

```bash
cd chain/infra
chmod +x setup-relay-env.sh
./setup-relay-env.sh
```

This creates git-ignored `.env.relay` with mode `0600`. On first setup it generates a strong bearer token. On later V2 environment refreshes it preserves the existing valid bearer token unless `SWAPPULSE_ROTATE_RELAY_TOKEN=1` is explicitly set. The file also contains the exact account/contract pins and the matching Devnet owner/verifier test keys resolved through loopback. Private keys and bearer tokens are never printed.

Start only the relay profile:

```bash
docker compose --env-file .env --env-file .env.relay \
  --profile provisioning up -d --build tx-relay
```

Publish `127.0.0.1:8081` through a **separate** HTTPS hostname/tunnel, for example:

```text
https://tx-testnet.example.org  ->  127.0.0.1:8081
```

Do not expose the relay token to the browser. Configure the HTTPS relay URL and `.env.relay`'s `RELAY_TOKEN` as Base44 runtime secrets:

```text
SWAPPULSE_TX_RELAY_URL
SWAPPULSE_TX_RELAY_TOKEN
```

The Base44 `chain-tx-submit` function authenticates the user, rechecks 18+ testnet eligibility, record ownership, current network verification pins and the transaction/account binding before adding the relay bearer token server-side. The host relay repeats the transaction/registration policy checks before touching the raw node.

The relay policy smoke test is:

```bash
node chain/infra/tx-relay/smoke-policy.mjs
```

It must confirm that approved deploy/recovery operations pass while wrong account classes, arbitrary invokes, `devnet_*` calls and missing bearer tokens are blocked. Registration is idempotent when the correct binding already exists, and the smoke test verifies that registration never fetches the owner key from Devnet at request time, it uses only the host-preloaded signer.

## 7. Adult self-service browser testnet identity

For an eligible 18+ account, Settings now supports the testnet-only flow:

1. Create a device test signer. The Stark private key is AES-GCM encrypted in IndexedDB with a non-extractable WebCrypto key; Base44 receives only the public Stark key.
2. Reserve the one permanent testnet identity (`PENDING`).
3. Choose **Secure My Testnet Identity**. Base44 returns five-minute, HMAC-bound V3 transaction drafts and signing hashes.
4. The browser decrypts the test signer only in memory, signs the exact draft hash locally, zeroes the raw private-key bytes afterwards and sends the signature/transaction to Base44.
5. Base44 verifies the draft token and exact transaction shape, then forwards the signed deploy/recovery transaction to the bearer-protected host relay.
6. Base44 independently reads the public RPC to confirm account class and recovery policy, then requests the narrow host-side owner registration.
7. The chain reconciler reads the public registry/account state. Only that read-back can promote the private mirror from `DEPLOYED` to `REGISTERED` and show **Identity secured**.

This browser vault is deliberately **testnet-grade**. The decrypting WebCrypto key and ciphertext share the same web origin, so an active same-origin XSS could potentially invoke signing. It is not the future production/passkey custody design, and self-declared adults still have all value-bearing/Proof-of-Use eligibility disabled.

The manual public provisioning JSON workflow remains available as an operator/debugging fallback.

## 8. Provision the first admin-only test identity (manual fallback)

Generate a temporary test signer locally. The private key is stored under the git-ignored `chain/infra/secrets/` directory with mode `0600`; only the public key is printed:

```bash
mkdir -p secrets
chmod 700 secrets
cd ../scripts/tooling
SWAPPULSE_USER_KEY_FILE="../../infra/secrets/test-identity.key" node create-test-signer.mjs
```

Copy **only** the printed `public_key` into SwapPulse Admin and use **Prepare Test Identity** for the target user. Copy the returned opaque `chain_identity_id`, then on the host run:

```bash
cd ../../infra
chmod +x provision-test-identity.sh
SWAPPULSE_IDENTITY_ID=0x... \
SWAPPULSE_USER_KEY_FILE="$PWD/secrets/test-identity.key" \
./provision-test-identity.sh
```

The host wrapper reads the local registry-admin test key from the loopback-only Devnet RPC and the user test signer from the mode-`0600` file. Those keys exist only in the provisioning process environment. The script deploys the `SwapPulseAccount` if needed, configures recovery, registers the opaque identity and prints only public metadata.

The provisioning code is idempotent. Its automated smoke test runs it twice: the first run deploys/configures/registers, the second submits no transactions, and the test fails if either private key appears in output.

Back in SwapPulse Admin, paste the script's complete public JSON into **Import public provisioning result**. The backend verifies the result format, reserved signer public key, deterministically derived account address, chain ID, class hash, registry address/owner and recovery policy before recording `DEPLOYED`. The manual recording section remains a debugging fallback but is subject to the same reserved-key address derivation check.

Then run **Reconcile From Chain**. Only successful chain read-back may promote the private mirror to `REGISTERED` and show **Identity secured**.

## Backups and upgrades

Back up `chain/infra/data/swappulse-testnet.dump` along with the public deployment manifest. Stop the container cleanly before a manual snapshot when practical.

Do not upgrade the Devnet image in-place against the only copy of the state dump. Devnet dump compatibility is not guaranteed across versions. Copy the dump first and test any version upgrade separately.

For the eventual sovereign SwapPulse Network, replace this development node with the selected L3/appchain sequencer, proof and DA architecture rather than carrying Devnet into production.
