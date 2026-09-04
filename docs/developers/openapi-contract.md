---
description: OpenAPI Contract documentation for SwapPulse.
---

# SwapPulse OpenAPI contract

The repository root `openapi.yaml` is the machine-readable contract for SwapPulse's supported **public and authenticated product API**.

It uses OpenAPI 3.1.0 for compatibility with ReadMe's currently supported OpenAPI range and describes the Base44 backend-function HTTP surface exposed through the SwapPulse application domain.

## What is documented

The current contract covers the primary product-facing function families:

* canonical TCGDex card browsing, detail, sets and search;
* PokeAPI Pokémon species/game enrichment;
* PokéWallet market enrichment;
* PokemonPriceTracker graded/recent-market enrichment;
* dormant/approval-gated direct TCGplayer enrichment;
* Explore and followed social feeds;
* the read-only SwapPulse Chain Explorer;
* age/verification status;
* chain identity preparation/status;
* chain-authoritative staking status;
* testnet SWPX faucet status/claim;
* delayed smart-account recovery;
* chain-action drafting and signed submission.

## What is deliberately excluded

`openapi.yaml` is not an inventory of every Base44 function.

Do **not** add these to the public/product contract merely because a function exists:

* the authenticated transaction relay or its bearer token;
* the private age-verifier webhook and HMAC secret;
* provider API credentials or token-minting internals;
* admin-only V2 cut-over controls;
* synthetic verification test harnesses;
* scheduled sync/reconciliation workflows;
* internal data-repair/backfill operations;
* functions whose purpose is privileged administration rather than a supported client API.

If an internal operation later becomes a supported external API, it must receive its own security/privacy review before being added.

## Base44 transport

Base44 functions are called from the frontend with the SDK:

```js
const response = await base44.functions.invoke('get-card-detail', {
  cardId: 'swsh3-136',
  lang: 'en',
});
```

Base44 also exposes deployed functions as HTTP endpoints under:

```
https://<app-domain>/functions/<function-name>
```

For SwapPulse the OpenAPI server is:

```
https://swappulse.org
```

and an operation such as `get-card-detail` is represented as:

```
POST /functions/get-card-detail
```

The repository-root file is authoritative. The `prebuild` script copies it into Vite's `public/` directory during a normal build, so deployed builds can expose the same contract at:

```
https://swappulse.org/openapi.yaml
```

Do not hand-edit a second public copy. Change the root `openapi.yaml` and let the build copy it.

The SDK remains the preferred first-party browser transport because it carries the current Base44 authentication context automatically.

## Specification extensions

SwapPulse uses `x-` extensions rather than trying to force project-specific concepts into unrelated standard fields.

Common extensions include:

| Extension                         | Purpose                                                           |
| --------------------------------- | ----------------------------------------------------------------- |
| `x-base44-function-name`          | Exact Base44 backend function name                                |
| `x-base44-sdk-call`               | First-party SDK invocation example                                |
| `x-swappulse-visibility`          | Public, authenticated, conditional or dormant surface             |
| `x-swappulse-data-classification` | Privacy/sensitivity class                                         |
| `x-swappulse-canonical-source`    | Authoritative source such as TCGDex                               |
| `x-swappulse-upstream`            | Optional external enrichment provider                             |
| `x-swappulse-provider-role`       | Why that provider is used                                         |
| `x-swappulse-cache-policy`        | Provider/application caching rule                                 |
| `x-swappulse-rate-policy`         | Provider and SwapPulse quota ceilings                             |
| `x-swappulse-fail-soft`           | Whether upstream failure must preserve the canonical product page |
| `x-swappulse-authority`           | Chain/source-of-truth authority                                   |
| `x-swappulse-write-capability`    | Whether the operation can mutate chain/application state          |

Extensions are documentation metadata. They must not be used as the only enforcement mechanism for authentication, permissions, RLS, rate limiting or chain policy. Enforcement stays in backend code.

## Authentication

Operations that require a signed-in SwapPulse user declare `Base44Session` under `components.securitySchemes`.

The Base44 SDK handles the authentication context for normal first-party clients. Never put service-role credentials, provider keys, relay tokens or verifier secrets into generated clients or Swagger examples.

Some operations intentionally allow both anonymous and authenticated access. For example, the followed-feed function returns an explicit empty unauthenticated response to guests.

## Canonical-source policy

The OpenAPI contract follows the same source-of-truth model as the application:

```
TCGDex                   canonical Pokémon TCG cards/sets
PokeAPI                  species/game enrichment only
PokéWallet               TCGPlayer/CardMarket cross-check
PokemonPriceTracker      RAW/graded/recent-history enrichment
TCGplayer                optional direct market cross-check when approved
Starknet public RPC      chain-authoritative public state
Base44                   application orchestration/private user mapping
```

An optional provider response must never silently replace the canonical TCGDex card identity.

## Updating the contract

When changing a product-facing backend function:

1. change the implementation;
2. update tests/security checks appropriate to that function;
3. update [backend function guide](https://swappulse.gitbook.io/swappulse-docs/developers/backend-function-guide) if behaviour materially changed;
4. update `openapi.yaml` request/response/security semantics;
5. update any relevant `x-swappulse-*` provider/privacy/cache metadata;
6. run an OpenAPI validator/Swagger Editor check;
7. include the API-contract change in the release notes.

A breaking contract change should be treated as a release-impacting change under [change protocol](https://swappulse.gitbook.io/swappulse-docs/project-maintenance/change-protocol) and [release process](https://swappulse.gitbook.io/swappulse-docs/project-maintenance/releasing).

## Compatibility guidance

The contract currently uses OpenAPI 3.1.0, which is the newest OpenAPI version ReadMe currently supports. Keep the root contract at 3.1.0 unless the documentation platform is deliberately changed or ReadMe adds support for a newer specification version.

Do not remove SwapPulse `x-base44-*`, `x-swappulse-*` or future `x-readme` extensions merely to satisfy a validator unless that validator is known to reject valid OpenAPI specification extensions. ReadMe supports OpenAPI 3.1 and custom extensions.

## Licensing

The OpenAPI description is SwapPulse project documentation and is covered by the repository's MPL-2.0 licence to the extent SwapPulse has the right to license its contents.

References to TCGDex, PokeAPI, PokéWallet, PokemonPriceTracker, TCGplayer, Impact, Base44, Pokémon or other third parties do not relicense their software, data, services, trademarks or content. See [third-party notices](https://swappulse.gitbook.io/swappulse-docs/project-maintenance/third-party-notices).
