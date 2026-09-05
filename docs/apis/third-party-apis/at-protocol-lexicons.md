---
description: The complete current SwapPulse AT Protocol record namespace.
---

# AT Protocol Lexicons

SwapPulse defines 30 namespaced AT Protocol record types. They allow collector data to be validated, signed, federated and moved between compatible personal data servers.

## Current record types

| NSID                                | Record               |
| ----------------------------------- | -------------------- |
| `org.swappulse.binder`              | Binder               |
| `org.swappulse.bookmarkBoard`       | Bookmark Board       |
| `org.swappulse.cardReview`          | Card Review          |
| `org.swappulse.challenge`           | Challenge            |
| `org.swappulse.challengeEntry`      | Challenge Entry      |
| `org.swappulse.circle`              | Circle               |
| `org.swappulse.collectionEntry`     | Collection Entry     |
| `org.swappulse.communityLabel`      | Community Label      |
| `org.swappulse.communityLabeler`    | Community Labeler    |
| `org.swappulse.conversation`        | Conversation         |
| `org.swappulse.directMessage`       | Direct Message       |
| `org.swappulse.feedSubscription`    | Feed Subscription    |
| `org.swappulse.journal`             | Journal              |
| `org.swappulse.labelerSubscription` | Labeler Subscription |
| `org.swappulse.meetup`              | Meetup               |
| `org.swappulse.meetupRsvp`          | Meetup RSVP          |
| `org.swappulse.packParty`           | Pack Party           |
| `org.swappulse.podcastEpisode`      | Podcast Episode      |
| `org.swappulse.pullNomination`      | Pull Nomination      |
| `org.swappulse.reaction`            | Reaction             |
| `org.swappulse.spaceSignal`         | Space Signal         |
| `org.swappulse.starterPack`         | Starter Pack         |
| `org.swappulse.story`               | Story                |
| `org.swappulse.tradeChain`          | Trade Chain          |
| `org.swappulse.tradeDispute`        | Trade Dispute        |
| `org.swappulse.tradeListing`        | Trade Listing        |
| `org.swappulse.tradingFeedback`     | Trading Feedback     |
| `org.swappulse.voiceSpace`          | Voice Space          |
| `org.swappulse.vouch`               | Vouch                |
| `org.swappulse.wishlist`            | Wishlist             |

## How to use a lexicon

An AT Protocol record includes the matching NSID in its `$type` field:

```json
{
  "$type": "org.swappulse.collectionEntry",
  "cardId": "swsh3-136",
  "quantity": 1,
  "createdAt": "2026-09-05T00:00:00.000Z"
}
```

Validate the complete record against the current JSON lexicon before writing it to a repository. Do not treat this summary table as a substitute for field-level schemas.

## Compatibility rules

* Add optional fields in a backward-compatible way where possible.
* Do not silently change the meaning or type of an existing field.
* Use a new NSID or a documented migration for breaking record changes.
* Preserve unknown fields when a client can safely round-trip them.
* Validate references, timestamps and identifiers before publication.
* Apply authentication, visibility and moderation rules outside schema validation where required.

The JSON files in the repository's `lexicons/` directory are the machine-readable source of truth.
