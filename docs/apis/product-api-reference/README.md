---
description: The machine-readable SwapPulse API contract and endpoint guidance.
---

# Product API Reference

The SwapPulse OpenAPI 3.1 contract documents 18 supported product endpoints. GitBook renders the operations from the repository's authoritative `openapi.yaml`.

{% hint style="info" %}
If this overview and the specification differ, follow the specification and open a documentation issue.
{% endhint %}

## Endpoint groups

| Group                                       | Operations | Purpose                                     |
| ------------------------------------------- | ---------: | ------------------------------------------- |
| [Catalogue API](catalogue-api.md)           |          4 | Cards, sets and catalogue search            |
| [Enrichment API](enrichment-api.md)         |          4 | Species, market and price enrichment        |
| [Community API](community-api.md)           |          2 | Explore and following feeds                 |
| [Chain Explorer API](chain-explorer-api.md) |          1 | Normalised product-level chain queries      |
| [Identity API](identity-api.md)             |          2 | Age status and chain identity               |
| [Wallet API](wallet-api.md)                 |          5 | Staking, faucet, recovery and chain actions |

## Base URL and transport

The contract declares:

```
https://swappulse.org
```

Application code normally uses the Base44 SDK:

```javascript
import { base44 } from '@/api/base44Client';

const response = await base44.functions.invoke('search-cards', {
  query: 'Pikachu',
  lang: 'en'
});

const result = response?.data ?? response;
```

A direct JSON request follows the operation's `/functions/*` path:

```bash
curl --request POST 'https://swappulse.org/functions/search-cards' \
  --header 'Content-Type: application/json' \
  --data '{"query":"Pikachu","lang":"en"}'
```

Prefer the SDK when Base44 manages the session or deployment route.

## Authentication

Public catalogue and discovery operations do not require a user token. Signed-in product functions use the Base44 application session described by the specification. Relay, verifier, administrative, scheduled, repair and secret-management functions are deliberately excluded.

## Contract resources

* [View openapi.yaml on GitHub](https://github.com/beitmenotyou1/swappulse2/blob/main/openapi.yaml)
* [Authentication and Access](../authentication-and-access.md)
* [OpenAPI Contract](../openapi-contract.md)
* [Backend Function Catalogue](../backend-function-catalogue.md)

## Compatibility

Clients should ignore additive fields they do not recognise. Breaking changes require release notes, an appropriate contract version and a documented migration path.
