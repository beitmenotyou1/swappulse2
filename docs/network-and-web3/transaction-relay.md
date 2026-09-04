---
description: >-
  Host the policy-enforcing SwapPulse transaction relay without exposing
  privileged keys.
---

# Transaction relay

The SwapPulse transaction relay is the protected **write path** into the current testnet. It is a server-side policy boundary, not a general-purpose Starknet RPC proxy. Base44 backend functions call it only after authenticating the user, checking private policy and constructing or validating the permitted chain action.

Live endpoint:

```
https://relay.swappulse.org
```

{% hint style="danger" %}
Never call the privileged relay directly from browser code. The bearer token, registry-owner signer and verifier signer must remain on the host and in Base44 server-side secrets.
{% endhint %}

## How it operates

1. A user approves an action in the SwapPulse UI when user consent is required.
2. The Base44 backend authenticates the session, checks eligibility and rebuilds the intended calldata.
3. For user-controlled actions, Base44 verifies the user's Stark signature against the exact server-side intent.
4. Base44 adds the relay bearer token on the server and sends the narrow request.
5. The relay verifies its chain, contract and authority pins before accepting work.
6. The relay validates the endpoint-specific policy, account binding, transaction version, call count, contract and entrypoint.
7. Only then does it submit to the private upstream RPC and wait for the transaction result where required.
8. Base44 reconciles the result from the separate public read-only RPC. A relay response alone is not treated as final chain truth.

This separation prevents a public browser from gaining registry, verifier, recovery or unrestricted submission authority.

## Relay surfaces

The repository default maps the relay to `127.0.0.1:8081`. The current reference host uses `127.0.0.1:18081`. Both remain loopback-only and are published through a separate HTTPS hostname.

| Endpoint                                                          | Authentication                                                 | Purpose                                                                                       |
| ----------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `GET /healthz`                                                    | None                                                           | Process liveness only. It does not prove that chain pins are correct                          |
| `GET /readyz`                                                     | Bearer token                                                   | Verifies chain ID, classes, registry owner, authorised verifier, V2 flag and ecosystem wiring |
| `POST /rpc`                                                       | Bearer token                                                   | Accepts only approved V3 deploy-account and invoke transaction shapes                         |
| `POST /register`                                                  | Bearer token                                                   | Binds an opaque identity to its deterministic approved smart account                          |
| `POST /verification-attest`                                       | Bearer token                                                   | Writes an approved V2 verification assertion through the separate verifier signer             |
| `POST /verification-revoke`                                       | Bearer token                                                   | Revokes the current on-chain verification                                                     |
| `POST /mint-card`                                                 | Bearer token                                                   | Owner-authorised Card NFT mint after Base44 verification policy succeeds                      |
| `POST /submit-usership`                                           | Bearer token                                                   | Submits an epoch-bound Proof-of-Usership score                                                |
| `POST /faucet-drip`                                               | Bearer token                                                   | Sends a fixed testnet amount to the canonically bound smart account                           |
| `POST /recovery-propose`, `/recovery-execute`, `/recovery-cancel` | Bearer token                                                   | Runs the configured delayed recovery lifecycle                                                |
| `POST /require-v2`                                                | Bearer token plus irreversible confirmation and on-chain proof | Performs or idempotently confirms the permanent V2-only policy switch                         |

These endpoints are an internal integration contract. They are not a public API for arbitrary clients.

## Allowed user-signed contract actions

When `/rpc` receives a V3 account invoke, every decoded call must target a pinned contract and approved entrypoint:

| Contract         | Permitted entrypoints                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| SWPX NativeToken | `approve`                                                                                                   |
| StakingPool      | `register_validator`, `increase_self_stake`, `delegate`, `request_undelegate`, `withdraw`, `exit_validator` |
| BridgeAdapter    | `bridge_out_token`, `bridge_out_card`                                                                       |
| CardNft          | `transfer`, `burn`                                                                                          |

The relay rejects unknown contracts, privileged entrypoints, more than four calls, oversized calldata, non-V3 transactions, unexpected paymaster/proof data and non-zero tips.

Some ABI fields retain the historical word `validator`. In the current product these represent community operators and application staking, not decentralised consensus validators.

## Defence-in-depth controls

| Control            | Behaviour                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| Bearer token       | Minimum 32 characters and compared using constant-time logic                                                 |
| Default rate limit | 60 requests per client IP per minute                                                                         |
| Request body       | 128 KiB maximum                                                                                              |
| Upstream response  | 2 MiB maximum                                                                                                |
| Upstream timeout   | 10 seconds                                                                                                   |
| Readiness cache    | 30 seconds after a full pin check                                                                            |
| Account deployment | Approved `SwapPulseAccount` class, one non-zero public key and salt equal to that key                        |
| Registration       | Deterministic address, class, registry owner, recovery controller/delay and forward/reverse mappings checked |
| V2 verification    | Separate authorised verifier, typed assurance data and non-zero replay-protected attestation ID              |
| Faucet             | Fixed host-configured amount, registry binding and defence-in-depth 24-hour recipient cooldown               |
| Filesystem         | Read-only container, small temporary filesystem, all capabilities dropped and `no-new-privileges`            |

The owner and verifier must be different accounts. In V2 mode the relay refuses to start without every required support-contract address and class hash.

## Host the relay

{% stepper %}
{% step %}
### Prepare the verified chain host

The private node, public read gateway and V2 deployment manifest must already be healthy. Obtain the current repository and install the pinned JavaScript tooling:

```bash
git clone https://github.com/beitmenotyou1/swappulse2.git
cd swappulse2/chain/scripts/tooling
npm ci

cd ../../infra/tx-relay
npm ci --ignore-scripts
```

Node.js 22 or newer is required.
{% endstep %}

{% step %}
### Verify the public deployment manifest

```bash
cd ../../scripts/tooling
node verify-network.mjs ../../deployments/swappulse-testnet.json
```

Do not generate relay credentials for an unverified or stale manifest. The result must report `ok: true` and the expected V2 ecosystem pins.
{% endstep %}

{% step %}
### Generate the private relay environment

```bash
cd ../../infra
bash ./setup-relay-env.sh
stat -c '%a %n' .env.relay
```

Expected mode: `600`.

The script verifies the public manifest, resolves the matching owner and verifier test accounts only through the loopback Devnet API, and writes `.env.relay` without printing private keys or the bearer token. It preserves an existing valid token unless rotation is explicitly requested.
{% endstep %}

{% step %}
### Start the provisioning profile

```bash
docker compose --env-file .env --env-file .env.relay \
  --profile provisioning up -d --build tx-relay

docker compose --env-file .env --env-file .env.relay \
  --profile provisioning ps
```

The service is separate from the always-available read gateway and starts only through the `provisioning` profile.
{% endstep %}

{% step %}
### Verify health and chain readiness locally

Set the actual local port for your host:

```bash
RELAY_PORT=8081

curl -fsS "http://127.0.0.1:${RELAY_PORT}/healthz"

RELAY_TOKEN="$(sed -n 's/^RELAY_TOKEN=//p' .env.relay | head -n1)"
curl -fsS "http://127.0.0.1:${RELAY_PORT}/readyz" \
  -H "Authorization: Bearer ${RELAY_TOKEN}" \
  | python3 -m json.tool
unset RELAY_TOKEN
```

Use `RELAY_PORT=18081` on the reference host. A ready V2 relay reports `ok: true`, `identity_verification_mode: v2`, `verification_v2_required: true` and `ecosystem_ready: true`.
{% endstep %}

{% step %}
### Run the policy regression suite

```bash
cd tx-relay
node smoke-policy.mjs
```

The suite must prove that the intended operations pass while wrong classes, arbitrary invokes, unauthenticated requests, replay attempts and `devnet_*` access are rejected.
{% endstep %}

{% step %}
### Publish through a separate HTTPS hostname

Configure the reverse proxy or named tunnel:

```
https://relay.swappulse.org -> http://127.0.0.1:8081
```

Use `18081` when configured on the host. Do not reuse the public RPC hostname, expose the raw node, or place the bearer token in the proxy URL.
{% endstep %}

{% step %}
### Configure Base44 server-side secrets

Set:

```
SWAPPULSE_TX_RELAY_URL=https://relay.swappulse.org
SWAPPULSE_TX_RELAY_TOKEN=<the host RELAY_TOKEN>
```

These belong only in Base44 runtime secrets. They must not appear in `ChainNetworkConfig`, frontend environment variables, browser storage, documentation examples or support screenshots.
{% endstep %}
{% endstepper %}

## Health versus readiness

`/healthz` answers only: "Is the relay process responding?"

`/readyz` proves substantially more:

* upstream chain ID matches;
* approved account class exists;
* registry address, class and owner match;
* configured verifier is authorised and separate from the owner;
* the V2 registry ABI is available;
* permanent V2 mode is reported;
* token, staking, usership, card and bridge classes match;
* the contracts point to each other correctly;
* the bridge holds the required minting authority.

Use authenticated readiness for deployments, monitoring and incident recovery. Do not treat a public liveness response as permission to send writes.

## Token rotation

Rotate deliberately and as one coordinated operation:

1. stop or drain Base44 write jobs;
2. set `SWAPPULSE_ROTATE_RELAY_TOKEN=1` only for the regeneration command;
3. generate the new `.env.relay`;
4. update the Base44 server-side secret through its protected settings;
5. recreate the relay container;
6. verify local and public `/readyz` with the new token;
7. run `smoke-policy.mjs` and a controlled end-to-end action;
8. remove the temporary rotation variable.

Never paste the token into chat, a Git issue, a frontend field or a command that prints shell tracing.

## Backup and recovery

Do not back up `.env.relay` into source control or a public/general-purpose archive. Back up the chain state and public deployment manifest through the protected host backup process. Relay configuration should be regenerated from the verified manifest and the authorised local chain accounts.

If the relay is suspected of compromise:

1. stop the relay or remove its public tunnel route;
2. leave the read-only RPC available if it remains trustworthy;
3. inspect submitted transactions and host access logs;
4. rotate the bearer token and any exposed signing authority under the applicable recovery procedure;
5. regenerate and verify every pin;
6. rerun the relay policy suite;
7. restore Base44 writes only after reconciliation confirms expected chain state.

## Common responses

| HTTP status          | Meaning                                           | Operator action                                                |
| -------------------- | ------------------------------------------------- | -------------------------------------------------------------- |
| `401`                | Missing or incorrect bearer token                 | Check the Base44 server secret. Never weaken authentication    |
| `403`                | RPC method, contract or entrypoint is not allowed | Use the supported backend flow or treat the request as hostile |
| `409`                | Registration is already being processed           | Wait for reconciliation before retrying                        |
| `413`                | Request body exceeds the limit                    | Reduce the payload. Do not raise the limit casually            |
| `429`                | Client exceeded the rate limit                    | Check retry behaviour and possible abuse                       |
| `503` from `/readyz` | Chain or contract pins cannot be proven           | Stop writes and resolve the reported machine-readable code     |

## Hosting guidelines

* Keep `.env` and `.env.relay` mode `0600` and git-ignored.
* Keep raw node RPC and local relay ports on `127.0.0.1`.
* Use different public hostnames for reads and writes.
* Allow only the Base44 backend to possess the relay token.
* Reconcile every material result through the independent public RPC.
* Fail closed when identity verification expires, is revoked or disagrees with Base44's current private assertion.
* Preserve machine-readable error codes without logging secrets or PII.
* Run the policy suite after code, configuration, image, manifest, proxy or contract changes.

## Related pages

* [Read-only RPC gateway](rpc-gateway.md)
* [Full node and full observer](full-node.md)
* [Lite node](lite-node.md)
* [Infrastructure Operations](infrastructure-operations.md)
* [SwapPulse V2 Live Architecture](v2-live-architecture.md)
