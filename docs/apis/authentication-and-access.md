---
description: >-
  Authentication models, access boundaries, security rules and error handling
  for SwapPulse APIs.
---

# Authentication and Access

SwapPulse uses different access models for public reads, signed-in product actions and private service-to-service traffic. Choose the narrowest model that supports your integration.

## Access models

| Surface                        | Authentication                             | Intended caller                         |
| ------------------------------ | ------------------------------------------ | --------------------------------------- |
| Public product reads           | None, unless the endpoint states otherwise | Web, mobile and server clients          |
| Signed-in product functions    | Base44 user session                        | SwapPulse clients acting for a user     |
| Public RPC gateway             | None, read-only methods only               | Wallets, explorers and monitoring tools |
| Transaction relay              | Bearer token, minimum 32 characters        | Trusted SwapPulse backend services only |
| Age-verifier webhook           | HMAC SHA-256 signature                     | Approved verifier only                  |
| Base44 service-role operations | Platform-managed service credentials       | Trusted backend code only               |

{% hint style="danger" %}
Never place service-role credentials, relay tokens, provider API keys or webhook secrets in browser or mobile application code.
{% endhint %}

## Calling a product function

The supported application transport is the Base44 SDK:

```javascript
import { base44 } from '@/api/base44Client';

const response = await base44.functions.invoke('get-card-detail', {
  cardId: 'swsh3-136',
  lang: 'en'
});

const card = response?.data ?? response;
```

For endpoints that require a signed-in user, initialise the SDK through the normal SwapPulse session flow before invoking the function. Do not manufacture or forward another user's session.

## Direct HTTP requests

The OpenAPI contract documents the public product interface under `/functions/*`. A direct request uses JSON:

```bash
curl --request POST 'https://swappulse.org/functions/get-card-detail' \
  --header 'Content-Type: application/json' \
  --data '{"cardId":"swsh3-136","lang":"en"}'
```

Some Base44 deployments route function traffic through platform-managed URLs. For production integrations, prefer the SDK or the server URL published in the current OpenAPI document.

## Private bearer authentication

The relay requires:

```http
Authorization: Bearer <relay-token>
```

Tokens are compared in constant time and must contain at least 32 characters. Store them in the backend secret manager, rotate them after suspected exposure and never log them.

## Signed webhooks

The age-verifier webhook expects the raw request body to be signed with HMAC SHA-256 and supplied in `x-swappulse-verifier-signature`. The shared secret must contain at least 32 characters. The receiver rejects oversized or unapproved payload fields.

## Errors, limits and retries

* Treat `400` as an invalid request and correct the payload before retrying.
* Treat `401` and `403` as an authentication or permission failure.
* Treat `404` as an unknown resource or unavailable route.
* Treat `409` as a state conflict. Read the latest state before retrying.
* Treat `429` as rate limiting and use exponential backoff with jitter.
* Retry transient `5xx` failures only when the operation is safe or idempotent.
* Preserve provider and request correlation IDs in server logs, but redact credentials and personal data.

## Versioning

The OpenAPI document is the contract of record for product endpoints. Additive response fields may appear without a breaking version change, so clients should ignore fields they do not recognise. Breaking changes require a documented migration path.
