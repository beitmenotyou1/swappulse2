---
description: >-
  Internal and product-facing Base44 function families, access classes and
  contribution rules.
---

# Backend Function Catalogue

SwapPulse backend behaviour is implemented as Base44 backend functions. This document is a practical guide to the main public/product function families rather than a frozen promise that every function name will exist forever.

The authoritative function inventory is the `base44/functions/` directory. The audited repository currently contains 241 function directories, but directory presence does not mean that a function is a supported public API. The OpenAPI contract is the authority for the 18 supported product endpoints.

## Invocation pattern

Frontend code normally uses the preconfigured Base44 SDK client:

```javascript
import { base44 } from '@/api/base44Client';

const response = await base44.functions.invoke('function-name', {
  example: 'value',
});

const data = response?.data || response;
```

Do not call privileged relay/private infrastructure directly from browser code.

## Authentication

Functions fall into several classes:

* public read functions;
* authenticated user functions;
* admin-only functions;
* webhook/system functions;
* scheduled workflow functions.

A frontend button being hidden is not an access-control mechanism. Backend functions must enforce authentication, ownership, role and eligibility themselves.

## 1. Pokémon TCG catalogue

Representative functions:

### `get-cards`

Retrieve card catalogue data with paging/filtering.

### `get-card-detail`

Retrieve a card with richer catalogue/application detail.

### `get-sets`

Retrieve Pokémon TCG set data.

### `search-cards`

Search the card catalogue.

### `tcgdex`

Shared TCGDex integration path used by catalogue workflows/features.

### `sync-tcgdex-catalog`

Synchronises catalogue data into the application layer. This is a trusted/admin/workflow operation, not an arbitrary public mutation endpoint.

### `get-pricing` / `syncPricing`

Read/synchronise the existing TCGDex-backed pricing information.

### `pokewallet-market`

Optional market enrichment for one canonical TCGDex card. The browser supplies only the TCGDex card ID. The backend resolves a conservative TCGDex-to-PokéWallet mapping, uses the server-side `POKEWALLET_API_KEY`, and returns normalised TCGPlayer/CardMarket variant prices. Ambiguous matches are not guessed.

The PokéWallet free tier is protected by persistent response/mapping caches plus a SwapPulse soft budget below the upstream ceiling. Provider limits are 100 requests/hour and 1,000/day; SwapPulse currently reserves headroom by stopping new upstream requests at 80/hour and 800/day. Cached stale data may be served during temporary provider/rate-limit failures rather than breaking the canonical card page.

Pro-only and not-yet-released PokéWallet endpoints are not exposed by SwapPulse on the free tier.

### `pokemon-price-tracker-market`

Optional RAW/graded/recent-history enrichment from PokemonPriceTracker for one canonical TCGDex card. The browser submits only the TCGDex card ID; the Base44 backend resolves catalogue metadata and authenticates upstream using `POKEMON_PRICE_TRACKER_API_KEY`.

The integration intentionally performs one strict `limit=1` query with the card name, set and collector number, requesting basic pricing, the plan-allowed recent history window and graded/eBay data in the same call. Automatic matching requires the collector number and a strong name/set score; weak matches are discarded rather than guessed.

PokemonPriceTracker uses credit-based billing. On the Free plan, a fully enriched card is expected to cost 3 credits (1 base + 1 history + 1 graded/eBay), against 100 credits/day and 60 requests/minute. SwapPulse therefore reserves headroom with an 80-credit/day and 45-call/minute soft budget, persists results for 24 hours, and can use a short stale fallback during temporary provider failures.

Current provider terms restrict Free/API plans to personal/non-commercial/development use and require a qualifying commercial plan for revenue-generating production services. SwapPulse therefore returns `license_plan_required` to ordinary users on Free/API before reading the API key or spending credits. Admin development/evaluation remains available. Public production enablement occurs automatically for Business/Enterprise, or only via the documented explicit permission override.

The endpoint is not a generic proxy and must never be used to redistribute PokemonPriceTracker data as a substitute API/feed.

### `pokemon-enrichment`

Optional PokéAPI species/game enrichment. It uses the TCGDex `dexId` field as the only species join, so it does not guess Pokémon from card names. PokeAPI resources are cached persistently server-side and no API key is required.

### `tcgplayer-market`

Optional direct TCGplayer catalogue/pricing enrichment for one canonical TCGDex Pokémon card. The browser supplies only the TCGDex card ID. The backend uses existing authorised TCGplayer developer credentials to obtain a Bearer token, searches Pokémon category 3, conservatively resolves a matching product, and fetches product market prices.

Required server configuration:

* `TCGPLAYER_PUBLIC_KEY`;
* `TCGPLAYER_PRIVATE_KEY`;
* `TCGPLAYER_APPROVED_USE=true` only when the TCGplayer developer-key approval covers SwapPulse's use;
* optional `TCGPLAYER_SOFT_CALLS_PER_MINUTE` and `TCGPLAYER_SOFT_CALLS_PER_DAY` overrides.

TCGplayer currently says it is no longer granting new API access. SwapPulse therefore supports existing approved developer credentials only. Current public documentation does not provide a fixed numeric API ceiling, but the API Terms prohibit excessive/unreasonable volume and reserve a right to limit use. SwapPulse defaults to its own 30 calls/minute and 1,000 calls/day safety ceilings, caches card mappings for 30 days and pricing for 6 hours, and honours provider `429`/`Retry-After` responses.

The SwapPulse TCGplayer client exposes no store, order, customer, inventory, buylist or seller-price mutation endpoint. When TCGplayer pricing is displayed, the UI identifies TCGplayer as the source, links to the matched TCGplayer product and includes the required provider attribution notice.

Pricing/enrichment data is informational and can be delayed relative to live marketplaces or upstream databases. TCGDex remains the canonical SwapPulse card catalogue and card identifier namespace.

## 2. Collection and card workflows

Collection records are mainly accessed through Base44 entities plus feature functions.

Representative functions include:

* `auto-attest-collection-card`;
* `create-card-attestation`;
* `mint-card`;
* `card-metadata-localized`;
* `extract-collection-import`;
* `capture-portfolio-snapshots`;
* collection-analysis/advisor functions.

The current canonical on-chain card architecture is Cairo/Starknet-based, not the old Polygon mint/bridge path described by earlier docs.

## 3. Social/feed functions

Representative functions:

* `get-follow-feed`;
* `get-explore-feed`;
* `get-author-feed`;
* `network-feed`;
* `get-visible-posts`;
* `resolve-post-by-uri`;
* `notify-interaction`;
* follow/reaction/repost/like synchronisation functions.

Many social reads are backed by Base44 records that are synchronised/bridged with AT Protocol data.

## 4. AT Protocol and federation

Representative functions:

### Identity/auth

* `atproto-auth`;
* `resolve-atproto-actor`;
* `get-profile-by-did`;
* `ensure-local-identity`;
* `provision-identity`;
* `provision-all-identities`.

### PDS/account portability

* `migrate-pds`;
* `migrate-to-swappulse`;
* `update-pds-handle`;
* `manage-app-password`;
* `list-app-passwords`;
* `pds-blob-upload`;
* `pds-blob-stats`.

### Federation/sync

* `atproto-bridge`;
* `firehose-ingest`;
* `sync-from-pds`;
* `get-sync-status`;
* `federation-diagnostics`;
* `verify-federation`;
* `request-appview-crawl`;
* `import-atproto-graph`.

### Lexicons/publication

* `register-lexicons`;
* `publish-standard-document`;
* `publish-standard-publication`;
* other standard-record functions.

PDS/app-password/admin credentials must remain server-side/private.

## 5. Chain identity

### `chain-identity-user`

Returns authenticated-user chain identity/network state for the Wallet/product UI. This is one of the key read models for current eligibility presentation.

### `chain-identity-register`

Provisioning/registration path for a user's chain identity.

### `chain-identity-reconcile`

Reads authoritative public chain state and updates the Base44 mirror.

### `chain-identity-admin`

Admin-only chain identity/network operations. Irreversible V2 operations require strict confirmation/policy and are not ordinary user actions.

### `get-my-chain-identity`

Authenticated helper for current user chain identity where used.

### `chain-verification-test`

Admin test-harness functionality for controlled V2 test attestations/expiry/revocation tests. It is not a production third-party identity-verification provider.

## 6. Age/private verifier functions

Representative functions:

* `age-status`;
* `age-verification-session`;
* `age-verifier-webhook`.

Private identity evidence must remain off-chain.

Webhook handlers must authenticate requests (for example with the configured signing/HMAC secret) before mutating verifier state.

## 7. Chain action drafting/submission

### `chain-action-draft`

Creates a policy-checked transaction/action draft for supported chain actions.

Examples currently include staking lifecycle actions such as:

* `register_validator`;
* `increase_self_stake`;
* `delegate`;
* `request_undelegate`;
* `withdraw`;
* `exit_validator`.

It performs server-side state/eligibility checks and should reject duplicate/invalid lifecycle operations before submission.

### `chain-action-submit`

Submits an approved action through the hardened chain/relay path and updates application records as appropriate.

### `chain-tx-draft` / `chain-tx-submit`

Additional generic/specialised chain transaction paths used by existing features. Do not expand these into arbitrary public RPC write proxies.

## 8. Staking

### `chain-staking-status`

Returns chain-authoritative staking information through the verified public RPC, including the current operator/delegation/unbonding state needed by the Wallet UI.

Confirmed chain state is authoritative over Base44 mirrors.

### Reconciliation

Staking lifecycle records are reconciled through chain event/state reconciliation jobs/functions rather than assuming a submitted transaction succeeded permanently.

## 9. Faucet

### `faucet-claim`

Supports status/claim behaviour for testnet SWPX.

Eligibility, drip amount, identity binding and cooldown are backend-enforced.

The faucet is testnet infrastructure and should not be used as a model for uncontrolled production token minting.

## 10. Bridge

Representative current functions:

* `bridge-record`;
* bridge-related `chain-action-*` handling;
* `outbound-reconcile`;
* scheduled queue/reconciliation where configured.

The current canonical bridge contract is the Cairo `BridgeAdapter` in the SwapPulse V2 architecture.

Older Polygon/PulseChain/LayerZero-oriented functions may still exist in the repository for historical/compatibility reasons; they are not the canonical V2 deployment path and should not be activated merely because their files exist.

## 11. Chain Explorer

### `chain-explorer`

Read-only public chain query function used by `/chain/*`.

Supported UI query concepts include:

* summary/latest blocks;
* latest transaction hashes;
* block lookup;
* transaction/receipt lookup;
* address/class/nonce lookup;
* SwapPulse-indexed public smart-account activity.

The function uses the approved public RPC path and must not expose privileged relay credentials or write-capable Devnet methods.

## 12. Recovery/WebAuthn/security

Representative functions:

* `chain-recovery`;
* `webauthn-reg-options`;
* `webauthn-verify-reg`;
* `webauthn-auth-options`;
* `webauthn-verify-auth`;
* WebAuthn management functions;
* `security-stepup-send` / `security-stepup-verify`;
* `security-factor-management`;
* 2FA setup/verify functions.

Security-sensitive functions must validate the authenticated account and should use step-up/recovery protections appropriate to the action.

## 13. Trades and community

Representative functions include:

* `get-visible-trades`;
* `getTradeInterest`;
* trade notification/advice functions;
* Circle/Meetup functions;
* starter-pack functions;
* challenge/leaderboard functions;
* notification/message functions.

The exact entity/function used depends on the feature. Inspect the current page/component before adding a duplicate endpoint.

## 14. Moderation

Representative functions:

* `moderatePost`;
* `autoModerateComment`;
* `moderation`;
* `moderation-review`;
* `autonomous-moderation`;
* `ai-moderation`;
* toxic/community label functions;
* message/trade report functions.

Moderation functions can handle sensitive content. Avoid logging private report/message contents unnecessarily.

## 15. Notifications/push/email

Representative functions:

* `send-notification`;
* `notify-system-event`;
* `sendPush`;
* `register-push-token`;
* `send-branded-email`;
* `sendEmail`;
* digest/onboarding/activation functions.

Delivery credentials belong in server-side secrets.

## 16. Status/operations

Representative functions:

* `health-check`;
* `status-monitor`;
* `manage-service`;
* `admin-metrics`;
* `subscribe-status`;
* incident functions.

Use the site `/status` page plus infrastructure readiness checks for operations.

## 17. Scheduled workflows

The authoritative workflow definitions are under `base44/workflows/`.

Current categories include TCGDex/pricing sync, PDS/federation/firehose, notifications, moderation, chain reconciliation, Proof of Usership aggregation, portfolio snapshots and digests.

Do not hard-code schedule assumptions in client code.

## 18. Errors

Functions should return a useful HTTP status and a non-secret error/machine code.

Typical statuses:

```
200 success
400 invalid request/state
401 unauthenticated
403 unauthorised/policy blocked
404 not found
409 duplicate/conflict where appropriate
429 rate/cooldown limit where appropriate
500 unexpected backend failure
502/503 upstream/service unavailable where appropriate
```

Frontend code should not depend on parsing secret-bearing server logs.

## 19. Rate limits

Do not rely on old documentation values such as a universal `100 requests/minute` unless the actual current Base44/function configuration proves that limit.

Rate/cooldown policy is feature-specific and may be enforced by Base44, external providers and individual backend functions.

## 20. Adding a backend function

Before creating a new function:

1. search `base44/functions/` for an existing path;
2. define authentication/role requirements;
3. validate input;
4. decide whether service-role access is genuinely required;
5. use existing guarded RPC/relay/external-service helpers;
6. keep secrets server-side;
7. add relevant tests/negative cases;
8. document the function if it becomes a public developer surface.

## 21. Security boundaries

Browser -> Base44 backend -> hardened relay -> Cairo/Starknet is the normal trusted write path for current privileged Web3 operations.

Public Chain Explorer -> Base44 read function -> read-only RPC is the normal public read path.

Do not collapse those into one general-purpose endpoint.

## 22. Related docs

* [documentation home](https://swappulse.gitbook.io/swappulse-docs/)
* [project architecture](../developers/project-architecture.md)
* [developer onboarding guide](../developers/developer-onboarding.md)
* [V2 live architecture](../network-and-web3/v2-live-architecture.md)
* [OpenAPI contract](openapi-contract.md)
* [product API reference](product-api-reference/)
