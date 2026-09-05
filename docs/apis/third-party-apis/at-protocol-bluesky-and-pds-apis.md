---
description: >-
  Federation, identity, feed and personal data server interfaces used by
  SwapPulse.
---

# AT Protocol, Bluesky and PDS APIs

SwapPulse uses AT Protocol for portable identity, signed records, social federation and custom feeds. Public discovery queries and authenticated personal data server operations have different trust boundaries.

## Integration map

| Service                     | Status                               | Use                                                      |
| --------------------------- | ------------------------------------ | -------------------------------------------------------- |
| SwapPulse or configured PDS | Active when federation is configured | Sessions, repositories, records, blobs and notifications |
| Bluesky public AppView      | Active                               | Profiles, posts, graph and discovery                     |
| PLC directory               | Active                               | DID document resolution                                  |
| Google DNS over HTTPS       | Active                               | Handle TXT-record verification                           |
| Well-known DID endpoint     | Active fallback                      | Handle verification                                      |
| SwapPulse feed generator    | Active                               | Seven custom feed algorithms                             |

## PDS XRPC operations

The configured `PDS_URL` is used from trusted backend code for:

* creating and refreshing sessions
* creating accounts and app passwords
* creating, updating, deleting, reading and listing repository records
* uploading and retrieving blobs
* reading notifications

App passwords, access JWTs and refresh JWTs are secrets. Do not store them in browser persistence or application logs.

A typical record write uses an NSID from the SwapPulse lexicon set and a repository collection operation:

```json
{
  "repo": "did:plc:example",
  "collection": "org.swappulse.cardReview",
  "record": {
    "$type": "org.swappulse.cardReview",
    "cardId": "swsh3-136",
    "rating": 5,
    "createdAt": "2026-09-05T00:00:00.000Z"
  }
}
```

The exact record must validate against the current lexicon before publication.

## Bluesky public AppView

Base URL: `https://public.api.bsky.app`

Public XRPC calls support:

* handle resolution
* profile lookup
* author feeds
* post and actor search
* follows and followers
* post threads
* batches of posts
* likes and repost lists
* feed-generator search

Public does not mean unlimited. Cache suitable reads, back off on `429` and preserve labels returned by the network.

## DID and handle resolution

PLC DIDs are resolved through `https://plc.directory`. Domain handles are verified through the `_atproto` TXT record using Google DNS over HTTPS. If DNS verification is unavailable, SwapPulse checks:

```
https://<domain>/.well-known/atproto-did
```

Do not accept a handle-to-DID binding unless the expected DID is present in the authoritative response.

## SwapPulse feeds

The feed generator identity is `did:web:feed.swappulse.org`. Current feeds are:

* trade listings
* collection posts
* fresh pulls
* showcase
* journals
* card reviews
* who to follow

The first six are public. Who to follow is personalised and requires an authenticated context.

## Data and safety guidance

* Treat DIDs and AT URIs as stable identifiers. Handles can change.
* Validate every outgoing record against its lexicon.
* Respect content labels, blocks and moderation decisions.
* Minimise local copies of personal social data.
* Make imports and synchronisation idempotent.
* Keep federation failures from corrupting the authoritative local record.
