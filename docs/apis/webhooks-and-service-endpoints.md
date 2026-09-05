---
description: >-
  Public service endpoints and private webhook contracts that sit outside the
  product OpenAPI specification.
---

# Webhooks and Service Endpoints

These endpoints support federation, syndication, search discovery and compliance workflows. They are intentionally separate from the public product OpenAPI contract.

## Endpoint matrix

| Endpoint                   | Access                                  | Purpose                                                    |
| -------------------------- | --------------------------------------- | ---------------------------------------------------------- |
| `describeFeedGenerator`    | Public                                  | Describes the SwapPulse AT Protocol feed generator         |
| `getFeedSkeleton`          | Public, except personalised suggestions | Returns AT Protocol feed skeletons                         |
| `podcast-rss-feed`         | Public                                  | Returns RSS 2.0 with iTunes metadata for a creator         |
| `seo-sitemap`              | Public                                  | Returns the XML sitemap                                    |
| `seo-robots`               | Public                                  | Returns the robots policy                                  |
| `health-check`             | Operational                             | Reports service configuration and dependency status        |
| `age-verification-session` | Signed-in user                          | Creates an opaque subject reference for age verification   |
| `age-verifier-webhook`     | Private, HMAC signed                    | Receives age-status attestations from an approved verifier |

## Feed generator

`getFeedSkeleton` accepts `feed`, `limit`, `cursor`, and optional `set` and `labels` values. `limit` must be between 1 and 100.

Public feeds include:

* `trade-listings`
* `collection-posts`
* `fresh-pulls`
* `showcase`
* `journals`
* `card-reviews`

`whoto-follow` is personalised and requires authentication.

```http
GET /functions/getFeedSkeleton?feed=at%3A%2F%2Fdid%3Aweb%3Afeed.swappulse.org%2Fapp.bsky.feed.generator%2Ffresh-pulls&limit=25
```

## Podcast RSS

Request a feed with either a DID or handle:

```http
GET /functions/podcast-rss-feed?handle=example.bsky.social
```

The response is RSS 2.0 XML with iTunes-compatible metadata and a five-minute cache policy.

## Search discovery

`seo-sitemap` returns XML and may be cached for one hour. `seo-robots` returns plain text and may also be cached for one hour. Consumers should respect the response content type and cache headers.

## Operational health

`health-check` is an operational diagnostic, not a stable public data contract. It can report checks for the application platform, database, Pokémon providers, PDS, email, web push, podcast syndication and configured payment services. Do not use it as the sole basis for critical automation.

## Age-verification session

The signed-in session endpoint returns an opaque 48-character hexadecimal `subject_ref`. It is a correlation value, not a date of birth or identity document reference.

## Age-verifier webhook

The receiver:

* requires `x-swappulse-verifier-signature`, computed as HMAC SHA-256 over the raw body
* limits the body to 16 KiB
* accepts only `event_id`, `subject_ref`, `status`, `age_band`, `verified_at`, `expires_at` and `occurred_at`
* rejects dates of birth, document images, photographs and evidence payloads
* handles duplicate events idempotently and rejects stale state transitions

Keep the signing secret in backend secret storage. Never include a real secret in examples, logs or support tickets.
