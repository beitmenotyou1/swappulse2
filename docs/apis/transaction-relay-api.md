---
description: >-
  Host and operate the policy-enforcing SwapPulse transaction relay, including
  allowlists, V2 rules, privileged signer boundaries and failure handling.
---

# Transaction Relay API and Policy

The SwapPulse transaction relay is the protected **write boundary** for the current testnet. It is not a public general-purpose Starknet RPC proxy.

Live endpoint:

```
https://relay.swappulse.org
```

{% hint style="danger" %}
Never expose the relay bearer token, registry-owner private key, verifier private key or trusted signing logic to browser code.
{% endhint %}

## Trust boundary

A typical user-controlled write follows this path:

1. the authenticated user chooses an action;
2. Base44 validates private eligibility and current network state;
3. Base44 constructs the canonical action intent server-side;
4. the user explicitly signs where user approval is required;
5. Base44 verifies the signature and exact transaction shape;
6. Base44 adds the relay bearer token server-side;
7. the relay checks chain/class/authority pins and endpoint policy;
8. the relay submits only the approved write;
9. Base44 reconciles the result through the separate public RPC.

A relay response alone is not treated as final chain truth.

## Relay surfaces

| Endpoint                    | Authentication                                                     | Purpose                                                                          |
| --------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `GET /healthz`              | None                                                               | Process liveness only                                                            |
| `GET /readyz`               | Bearer token                                                       | Proves chain ID, V2 mode, classes, registry owner, verifier and ecosystem wiring |
| `POST /rpc`                 | Bearer token                                                       | Narrow user-signed V3 deploy/invoke allowlist                                    |
| `POST /register`            | Bearer token                                                       | Bind an opaque identity to the approved smart account                            |
| `POST /verification-attest` | Bearer token                                                       | Submit approved V2 assurance through the authorised verifier                     |
| `POST /verification-revoke` | Bearer token                                                       | Revoke current on-chain verification                                             |
| `POST /mint-card`           | Bearer token                                                       | Protected card mint path                                                         |
| `POST /submit-usership`     | Bearer token                                                       | Submit approved epoch-bound usership result                                      |
| `POST /faucet-drip`         | Bearer token                                                       | Fixed testnet faucet action with identity/cooldown controls                      |
| `POST /recovery-propose`    | Bearer token                                                       | Start delayed account recovery                                                   |
| `POST /recovery-execute`    | Bearer token                                                       | Complete recovery after the delay                                                |
| `POST /recovery-cancel`     | Bearer token                                                       | Cancel pending recovery where policy allows                                      |
| `POST /require-v2`          | Bearer token + exact irreversible confirmation on first activation | Activate or idempotently confirm permanent V2-only mode                          |

These endpoints are an internal integration contract, not an unrestricted third-party API.

## User-signed invoke allowlist

For `/rpc`, decoded calls are restricted to pinned contracts and approved entrypoints.

| Contract         | Permitted user-controlled entrypoints                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| SWPX NativeToken | `approve`                                                                                                   |
| StakingPool      | `register_validator`, `increase_self_stake`, `delegate`, `request_undelegate`, `withdraw`, `exit_validator` |
| BridgeAdapter    | `bridge_out_token`, `bridge_out_card`                                                                       |
| CardNft          | `transfer`, `burn`                                                                                          |

The relay rejects unknown contracts, privileged entrypoints, unsupported transaction versions, oversized calldata, unexpected paymaster/proof data, non-zero tips and excessive call counts.

## Permanent V2 relay policy

The relay is currently pinned to V2 mode and requires:

```
identity_verification_mode = v2
verification_v2_required = true
ecosystem_ready = true
```

For verification actions it enforces:

* the V2 entrypoint/data shape;
* approved verifier authority;
* assurance type/level policy where applicable;
* non-zero replay/attestation identifier;
* replay protection;
* matching registry and class pins.

Legacy V1 verification writes are not an accepted fallback after permanent cut-over.

## `/require-v2` policy

The permanent cut-over path is deliberately read-first.

### If the flag is false

The request must satisfy the irreversible activation policy, including the exact confirmation and required proof/state checks.

### If the flag is already true

The relay returns an idempotent success without submitting another transaction:

```json
{
  "ok": true,
  "transaction_hash": "",
  "idempotent": true,
  "verification_v2_required": true
}
```

This behaviour prevents uncertain network responses or later proof expiry from causing a blind duplicate irreversible write.

Read Permanent V2 Verification Policy.

## Defence-in-depth controls

Current controls include:

| Control               | Behaviour                                                                        |
| --------------------- | -------------------------------------------------------------------------------- |
| Bearer token          | Minimum-length protected secret, constant-time comparison                        |
| Request body          | Bounded size                                                                     |
| Upstream response     | Bounded size                                                                     |
| Upstream timeout      | Finite timeout                                                                   |
| Rate limiting         | Per-client request limiting                                                      |
| Readiness cache       | Short-lived cache after full pin verification                                    |
| Deploy-account policy | Approved class, non-zero public key, deterministic salt/key relationship         |
| Registration policy   | Deterministic address and registry/account mapping checks                        |
| Verification policy   | Separate verifier, V2 assurance and replay protection                            |
| Faucet policy         | Fixed amount, identity binding and recipient cooldown                            |
| Container hardening   | Read-only filesystem where configured, dropped capabilities, `no-new-privileges` |

The exact operational defaults are versioned in the repository and should be reviewed before changing host policy.

## Health versus readiness

`/healthz` only proves that the process responds.

`/readyz` proves materially more, including:

* expected chain ID;
* approved account class;
* IdentityRegistry address/class/owner;
* authorised verifier and owner/verifier separation;
* permanent V2 state;
* token, staking, card, usership and bridge class pins;
* required contract wiring;
* ecosystem readiness.

If `/readyz` fails, stop protected writes until the reported pin/policy failure is resolved.

## Hosting

The local relay must remain loopback-bound and be published only through the intended HTTPS boundary.

Reference host local port:

```
127.0.0.1:18081
```

Typical workflow:

```bash
git clone https://github.com/beitmenotyou1/swappulse2.git
cd swappulse2/chain/scripts/tooling
npm ci

node verify-network.mjs ../../deployments/swappulse-testnet.json

cd ../../infra
bash ./setup-relay-env.sh
stat -c '%a %n' .env.relay
```

Expected secret-file mode:

```
600
```

Start the provisioning profile:

```bash
docker compose --env-file .env --env-file .env.relay \
  --profile provisioning up -d --build tx-relay
```

Verify local readiness without printing the secret:

```bash
RELAY_PORT=18081
RELAY_TOKEN="$(sed -n 's/^RELAY_TOKEN=//p' .env.relay | head -n1)"

curl -fsS "http://127.0.0.1:${RELAY_PORT}/readyz" \
  -H "Authorization: Bearer ${RELAY_TOKEN}" \
  | python3 -m json.tool

unset RELAY_TOKEN
```

## Base44 server-side configuration

Base44 uses backend-only secrets:

```
SWAPPULSE_TX_RELAY_URL=https://relay.swappulse.org
SWAPPULSE_TX_RELAY_TOKEN=<protected host token>
```

Do not place these in frontend code, browser storage, public entities, screenshots or public configuration manifests.

## Policy regression suite

Run:

```bash
cd chain/infra/tx-relay
node smoke-policy.mjs
```

The suite verifies both allowed behaviour and rejected behaviour, including:

* approved deployment/invoke paths;
* wrong-class rejection;
* arbitrary-invoke rejection;
* Devnet administration rejection;
* missing-token rejection;
* registration idempotency;
* recovery binding;
* V2 assurance enforcement;
* replay controls;
* irreversible cut-over confirmation/proof policy;
* idempotent V2 retry after proof expiry;
* readiness reflecting permanent V2.

## Error handling

Common policy responses include:

| HTTP status          | Meaning                                | Response                                                      |
| -------------------- | -------------------------------------- | ------------------------------------------------------------- |
| `401`                | Missing/incorrect bearer token         | Fix protected Base44/host secret; never weaken authentication |
| `403`                | Method/contract/entrypoint not allowed | Use supported flow or treat as hostile/misconfigured request  |
| `409`                | Conflicting/duplicate lifecycle action | Reconcile chain state before retrying                         |
| `413`                | Payload too large                      | Reduce payload; do not casually raise limits                  |
| `429`                | Rate limit exceeded                    | Check retry loop/abuse                                        |
| `503` from `/readyz` | Pins or ecosystem cannot be proven     | Stop writes and resolve the reported failure                  |

## Token rotation

Rotate the relay token as a coordinated operation:

1. stop/drain Base44 write jobs;
2. regenerate the token through the protected host workflow;
3. update the Base44 server secret;
4. recreate/reload the relay;
5. verify authenticated local and public readiness;
6. run the policy suite;
7. perform a controlled end-to-end action;
8. remove any temporary rotation flag.

Never paste the bearer token into chat, Git issues, frontend fields or shell tracing output.

## Incident response

If compromise is suspected:

1. stop the relay or remove its public tunnel route;
2. keep read-only RPC available only if it remains trustworthy;
3. inspect submitted transactions and host access logs;
4. rotate exposed bearer/signing authority under the applicable recovery procedure;
5. verify every public deployment/authority pin;
6. rerun the relay policy suite;
7. reconcile chain state;
8. restore writes only after expected state is independently confirmed.

## Related pages

* Permanent V2 Verification Policy
* Verifier Logic and Assurance
* Chain State and Reconciliation
* Cairo Contracts Reference
* Read-only RPC Gateway
* Infrastructure Operations
