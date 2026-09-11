# SwapPulse Posts and Feeds Audit

**Audit date:** 11 September 2026  
**Scope:** Post creation, replies, quotes, likes, reposts, reactions, deletion, visibility, moderation, Home/For You, Explore/Everybody, profile feeds, custom feeds, feed subscriptions/pinning, AT Protocol feed-generator interoperability, PDS publication/retry state, pagination, realtime refresh, abuse controls, privacy, performance and automated test coverage.  
**Status:** **NOT RELEASE READY.** Five unresolved P0 findings remain.  
**Audit score:** **43/100 - High Risk / Needs Remediation**

> The score is a release-readiness indicator, not a claim that 43% of the code is correct. Posts and feeds sit on privacy, identity, moderation and federation trust boundaries, so unresolved P0/P1 issues carry disproportionate weight.

## Findings

| Priority | Area | Finding | Required action |
| --- | --- | --- | --- |
| 🔴 P0 | PF-001 - Authoritative Post fields | `Post` can still be created and updated directly by an authenticated client, while the schema permits client-supplied `did`, author identity fields, engagement counters, moderation fields, AT URI/CID, `bridged` and federation state. The normal Compose flow is safer, but the entity boundary itself does not make these fields server-owned. This permits local author spoofing, counter forgery and federation-provenance forgery through alternate clients/API calls. | Make post mutation backend-only for security-sensitive fields. Derive author DID/name/handle/avatar from the authenticated caller, initialise counters server-side, and make moderation plus federation metadata immutable to ordinary users. Add negative tests using direct entity/API writes. |
| 🔴 P0 | PF-002 - Moderation-state ownership | A Post owner is allowed by entity RLS to update their own record, including `moderation_labels`, `moderation_status`, `moderation_notes`, `moderated_by` and `moderated_at`. A user can therefore alter or clear the state written by `moderatePost`. | Move all moderation fields behind moderator/service-role-only mutation. Ordinary post edits must use an allowlist that excludes moderation state. Add tests proving a post author cannot dismiss, relabel or clear an escalation. |
| 🔴 P0 | PF-003 - Reply visibility inheritance | `createReply()` creates a new `Post` without explicitly inheriting the parent/root `visibility_scope`. Because the Post schema defaults to `public`, a reply to a `followers` or `mentioned` post can become a public local record. The function also federates based on parent state rather than deriving a no-broader child visibility policy. No non-public posts existed in the current dataset at audit time, so this is code-proven but not reproduced against live user content. | Create replies only through a backend endpoint that loads the authoritative parent/root, derives child visibility that is never broader than the thread, and refuses public federation for a non-public thread. Test `public`, `followers` and `mentioned` roots including nested replies. |
| 🔴 P0 | PF-004 - Legacy feed privacy bypass | `base44/functions/feeds/entry.ts` uses service-role Post reads for `fresh-pulls`, `shiny-hunters` and `collection-posts` without requiring `visibility_scope: public` and without calling the shared server visibility helper. An authenticated caller can therefore receive feed entries for non-public posts when such posts exist. The current dataset contained no `followers`/`mentioned` posts, so there was no live record to expose during this audit. | Remove or retire the legacy feed path, or make every Post-producing branch use the same central visibility policy as `get-visible-posts`. Public/custom feeds should query `visibility_scope: public` explicitly. Add regression tests with synthetic non-public records. |
| 🔴 P0 | PF-005 - Moderation not enforced in public discovery | `get-explore-feed` returns any `visibility_scope: public` Post and does not filter `moderation_status`, hide recommendations or enforced users. `getFeedSkeleton` also omits Post-level moderation filtering in its post feeds. A live entity query on 11 September 2026 found **446 public Post records with `moderation_status: escalated`**, many carrying `recommended_action: hide`. This proves moderation state is not consistently converted into feed eligibility. | Introduce one mandatory server-side `isFeedEligiblePost` policy covering visibility, moderation status/action, account enforcement, blocks and other required safety state. Apply it to Explore, Home, custom feeds, hashtag feeds and profile feeds. Reconcile existing escalated records and add feed-level tests. |
| 🟠 P1 | PF-006 - Reply policy enforced only in the browser | `createReply()` checks `reply_policy` on the client. Direct Post entity writes can bypass it. The `mentioned` check also searches parent text for a handle/DID instead of using an authoritative mention allowlist. | Enforce reply policy in the backend using the authoritative parent record, caller DID and follow/mention state. Keep client checks only for immediate UX feedback. |
| 🟠 P1 | PF-007 - Like/repost counters are non-atomic and forgeable | Likes and reposts are created client-side, then Post counters are updated from stale values such as `(ref.likes || 0) + 1`. There is no demonstrated unique `(actor, post)` invariant or atomic counter transaction. Concurrent actions can lose updates or duplicates can inflate counts, and PF-001 lets owners alter counters directly. | Add idempotent backend interaction endpoints, unique actor/subject keys and atomic count updates, or derive counts from authoritative interaction records. Reject duplicates and race-test concurrent like/repost operations. |
| 🟠 P1 | PF-008 - Reactions create competing federated records | `ReactionBar` bridges the same local Reaction both as `org.swappulse.reaction` and, for bridged posts, as `app.bsky.feed.like`. Both async callbacks can overwrite the same `at_uri`/`cid`. Deleting the reaction can then delete only whichever URI won the race, leaving the other PDS record orphaned. Every SwapPulse emoji reaction also becomes a Bluesky like regardless of its semantic type. | Separate custom reaction and Bluesky-like federation state into distinct records/fields, or choose one explicit interoperability mapping. Deletion must tombstone every remote record created for the action. |
| 🟠 P1 | PF-009 - Local delete can diverge from PDS delete | `deletePost()` and `deleteReply()` delete locally first, then fire a PDS deletion asynchronously and swallow failure. A user can see a post disappear from SwapPulse while it remains in their PDS/Bluesky feed. | Orchestrate deletion server-side with an outbox/state machine. Record remote deletion state, retry failures, and show the user when federation deletion is pending or failed. Do not present local deletion as globally complete until reconciliation succeeds. |
| 🟠 P1 | PF-010 - Failed federation is not surfaced in normal post UI | Current data includes a user-authored public Post (`6aa1f66dd6173a60906fe06d`) with `federation_status: failed`, `federation_attempts: 8` and `AT_PUBLICATION_FAILED`, while the local post remains present. Source search found no normal Posts/Feeds UI that surfaces `federation_status` or offers a user retry/diagnostic path. | Show local-only/pending/failed/published state on the author's post management UI. Provide a safe retry action or admin reconciliation path and explain that a failed item is not visible on the wider AT Protocol network. |
| 🟠 P1 | PF-011 - Feed marketplace URIs do not match the implemented generator | `src/pages/Feeds.jsx` advertises six hard-coded feeds under `did:plc:swappulse` (`holo-pulls`, `trusted-traders`, `set-completions`, `budget-cards`, `vintage-wotc`, `japanese-exclusive`). `getFeedSkeleton` uses `did:web:feed.swappulse.org` and recognises a different set (`trade-listings`, `collection-posts`, `fresh-pulls`, `showcase`, `journals`, `card-reviews`, `whoto-follow`). | Publish one canonical generator DID and feed registry, then drive the marketplace, `describeFeedGenerator`, tests and documentation from that registry. Remove seed URIs that are not actually published. |
| 🟠 P1 | PF-012 - Feed skeleton returns non-post record URIs | `getFeedSkeleton` returns binder, journal, card-review and actor-profile URIs in the `post` field for several feeds. Standard AT Protocol/Bluesky feed skeletons are hydrated as post entries, so non-`app.bsky.feed.post` records are not interoperable as ordinary custom-feed items. | Feed-generator skeletons exposed to standard clients must return real `app.bsky.feed.post` URIs. Wrap SwapPulse-native objects in public post records that link/embed the native object, or keep native-object feeds inside SwapPulse rather than claiming standard feed-generator compatibility. |
| 🟠 P1 | PF-013 - Generator fabricates unresolvable fallback post URIs | When a local item has no real PDS `at_uri`, `getFeedSkeleton` fabricates addresses such as `at://did:web:feed.swappulse.org/app.bsky.feed.post/<local-id>`. There is no guarantee that a matching repository record exists, so an AppView may be unable to hydrate the item. | Expose only successfully published post URIs to external feed clients. Keep pending/local-only items in SwapPulse-native feeds until the PDS returns a real URI/CID. |
| 🟠 P1 | PF-014 - Unknown feed URI silently becomes trade-listings | `parseFeedParam()` falls back to `trade-listings` for an unsupported or malformed feed identifier. A client requesting a nonexistent feed can receive unrelated trade content instead of an error. | Validate the complete feed URI/record key and return an AT Protocol-compatible invalid-request response for unknown feeds. Do not silently substitute another algorithm. |
| 🟠 P1 | PF-015 - Custom-feed pagination is unstable and capped | `getFeedSkeleton` uses a numeric offset cursor against mutable newest-first datasets and fetches at most 200 source rows in several branches. New records inserted between requests can cause duplicates/skips and older records become unreachable. AT Protocol treats cursors as opaque and recommends item-unique cursors for reliable pagination. | Use a stable opaque cursor based on immutable ordering keys such as timestamp plus URI/CID, and paginate beyond the first 200 records. Add insertion-between-pages regression tests. |
| 🟠 P1 | PF-016 - Follow feed silently ignores external follows beyond 20 | `get-follow-feed` resolves up to 200 follows but fetches external author feeds only for `externalDids.slice(0, 20)`. Users following more than 20 external accounts silently lose some followed content. | Implement cursor-aware/batched external retrieval for the full follow set, with bounded concurrency and caching rather than truncating the graph. |
| 🟠 P1 | PF-017 - Followed hashtag federation is capped at 10 tags | The follow feed loads up to 100 hashtag subscriptions but calls external search for only `followedTags.slice(0, 10)`. Remaining followed tags never contribute network posts. | Paginate/batch tag retrieval or document and enforce a clear subscription limit in the product. Never silently ignore saved subscriptions. |
| 🟠 P1 | PF-018 - Home/For You has no continuation cursor | Home requests one `get-follow-feed` batch and the backend returns `sorted.slice(0, limit)` without a cursor. Older followed posts cannot be fetched through this path. | Add stable cursor pagination end to end, including Home infinite/load-more behaviour and external-source continuation state. |
| 🟠 P1 | PF-019 - Follow feed performs N+1 member resolution | `get-follow-feed` performs a separate service-role User query for every followed DID, up to 200, before fetching external authors. This creates avoidable backend fan-out and latency. | Resolve member DIDs in one bounded query/index or maintain a DID-to-member index/cache. Add latency and query-count telemetry for large follow graphs. |
| 🟠 P1 | PF-020 - External followed/tag posts bypass consistent local enforcement | External AppView items merged by `get-follow-feed` are not passed through the same local account/post enforcement and moderation eligibility policy used for local rows. | Apply one viewer-aware feed eligibility stage after local and external merge, including blocked/muted/enforced accounts and supported label policies. Preserve protocol moderation metadata when mapping external posts. |
| 🟠 P1 | PF-021 - Multiple feed engines have policy drift | The project contains overlapping `feeds`, `getFeedSkeleton`, `get-follow-feed`, `get-explore-feed`, `network-feed` and other feed paths with different visibility, moderation, cursor and enforcement rules. PF-004 and PF-005 are concrete consequences of this duplication. | Consolidate shared rules into one feed-policy library and a small number of explicit feed services. Deprecate legacy routes and make visibility/moderation/enforcement/cursor behaviour testable once. |
| 🟠 P1 | PF-022 - Feed subscriptions do not shape Home as promised | `FeedSubscription` says pinned feeds appear as Home tabs, and the Feeds page says pinning shapes the home timeline. `Home.jsx` uses a static tab list and does not read `FeedSubscription`. | Either implement pinned-feed Home tabs/sections or change the product copy and entity contract. Add an integration test from Subscribe → Pin → Home. |
| 🟠 P1 | PF-023 - Feed subscription uses the wrong DID property | `FeedCard` writes `did: user.data?.did || ''`, while other current code treats `user.did` as authoritative. This can create a subscription with an empty DID. | Create subscriptions through a backend function that derives DID from the authenticated user. Reject empty/mismatched DID and validate `feed_uri`. |
| 🟠 P1 | PF-024 - Feed subscription PDS state drifts on pin/unsubscribe | Subscription creation invokes `bridge-record`, but pinning only updates the local entity and unsubscribe only deletes the local entity. The portable PDS record can therefore retain an old `pinned` value or remain after the user unsubscribes. | Use a single backend/PDS synchronisation flow for create, update/pin and delete. Persist reconciliation state and retry failures. |
| 🟠 P1 | PF-025 - Feed subscription uniqueness is not enforced | The entity description says one record per `(did, feed_uri)`, but the schema/RLS does not enforce that invariant and the client creates records directly. Duplicate subscriptions can produce incorrect state/counts. | Enforce an idempotency/unique key in the backend and make subscribe/unsubscribe idempotent. |
| 🟠 P1 | PF-026 - Profile pinned feeds conflict with entity privacy | `ProfilePinnedFeeds` queries another collector's `FeedSubscription` records by DID, but entity read RLS permits only the record owner. Public profile visitors therefore cannot reliably see the feeds the profile component claims to display. | Decide whether pinned-feed disclosure is public. If yes, expose a minimal public projection through a backend resolver. Do not weaken access to all subscription records just to make the profile widget work. |
| 🟡 P2 | PF-027 - Pin state UI resets incorrectly | `FeedCard` initialises local `pinned` state to `false` instead of `subscribed?.pinned`. A previously pinned subscription can render as unpinned after reload. | Initialise from persisted subscription state and resynchronise when the `subscribed` prop changes. |
| 🟡 P2 | PF-028 - Network feed section is placed in guest Explore but requires authentication | Public Explore renders `NetworkFeedSection`, while the `network-feed` backend is authentication-gated. Guests can therefore encounter an avoidable feed error inside a public discovery page. | Either make the intended network preview guest-safe with public-only data or hide/replace it for signed-out visitors. |
| 🟡 P2 | PF-029 - Feed preview is disconnected from marketplace selection | `FeedPreview` previews a fixed feed path while the marketplace lists different seed algorithms. Filters can make the panel look like a preview of the selected feed even when it is not. | Bind preview requests to the actual selected/pinned feed URI and show the source algorithm explicitly. |
| 🟡 P2 | PF-030 - Full reply threads are truncated | `PostReplyThread` loads at most 100 records per root/reply/parent query and renders recursion only to depth six. Large/deep discussions can appear incomplete without a continuation mechanism. | Add cursor pagination for thread descendants and a clear continuation UI for deep branches. |
| 🟡 P2 | PF-031 - Visible-post pagination scans at most 500 rows | `get-visible-posts` computes pages by scanning at most 500 rows and slicing after visibility filtering. With enough inaccessible rows or a large offset, older visible posts can be missed or `has_more` can become misleading. | Replace skip/scan pagination with a stable cursor and query strategy that advances through source rows until the requested visible page is filled or the dataset ends. |
| 🟡 P2 | PF-032 - External followed posts lose rich embeds and labels | The AppView mapping in `get-follow-feed` keeps text, author and counts but drops images, video/external embeds, facets/links, labels, quote context and other rich post information. | Preserve the supported `PostView` fields required by the renderer, or route external items through a common normaliser used elsewhere in the app. |
| 🟡 P2 | PF-033 - Generator chronology can differ from displayed chronology | Several generator paths sort/query by local `created_date`, while imported Bluesky posts have `original_created_at` and other feeds deliberately re-sort using the original timestamp. Imported old posts can therefore rank differently across feeds. | Define one canonical feed timestamp function and use it consistently for sorting and cursor construction. |
| 🟡 P2 | PF-034 - Post length contracts are inconsistent | The Post entity allows 500 characters, normal compose/reply UI uses 300, and some federation code slices at different limits. Alternate/direct writes can therefore create local content whose federated representation differs. | Define one explicit local/federated text policy, validate it server-side, and show truncation only when it is an intentional cross-network conversion. |
| 🟡 P2 | PF-035 - Post deletion cleanup is incomplete and capped | `delete-post` cleans up only the first 500 Likes and Reposts. It does not comprehensively reconcile reactions, replies, quotes, notifications or all remote interaction records. | Define cascade/tombstone policy per related entity, process cleanup in bounded batches, and run a reconciliation job for orphan references. |
| 🟡 P2 | PF-036 - Dedicated Posts/Feeds regression tests were not found | The current app sandbox did not expose dedicated post/feed test files covering visibility, moderation eligibility, feed pagination, PDS retries or interaction races. These are high-risk behaviours currently spread across client and backend code. | Add unit/integration tests for every P0/P1 invariant plus protocol-contract tests for `describeFeedGenerator` and `getFeedSkeleton`. Make them release gates. |
| 🟢 P3 | PF-037 - Feeds marketplace is static | Feeds discovery is a hard-coded seed array even though backend search/discovery functions exist. It can drift from the actual deployed feed catalogue. | Source the marketplace from the canonical published feed registry/AppView, with a small explicit fallback only when discovery is unavailable. |
| 🟢 P3 | PF-038 - Subscriber counts are not clearly authoritative | Seed feed cards display `feed.subscriberCount || 0`, but the static seed objects do not carry an authoritative count and current `FeedSubscription` data is empty. Users may see zero rather than an explicit unavailable state. | Return counts from the authoritative feed/subscription service or label them unavailable instead of implying a measured zero. |
| 🟢 P3 | PF-039 - Home documentation has drifted from implementation | Current Home code states the feed is strictly followed accounts/hashtags, while older help text describes broader recommendations improving through interaction. | Update help copy to the actual feed contract, or implement the recommendation behaviour deliberately. |
| 🟢 P3 | PF-040 - Legacy feed naming and comments are misleading | `feeds/entry.ts` describes itself as a simulated replaceable AT Protocol service while a separate `getFeedSkeleton` implementation now exists. This increases maintenance ambiguity. | Mark the legacy function deprecated, document the authoritative feed architecture and remove it after migration/tests. |

## Current production-data evidence

The audit used non-destructive entity queries only. No posts, follows, subscriptions or moderation state were created or changed.

- **446 public Post records** matched `moderation_status: escalated` on 11 September 2026. Many of those records contain moderation labels whose recommended action is `hide`. This is evidence of an active feed-eligibility gap, not a judgement that every individual post is malicious.
- **0 current Post records** matched `visibility_scope` of `followers` or `mentioned` in the queried dataset. PF-003 and PF-004 are therefore architecture/code findings rather than a demonstrated leak of current user content.
- **0 FeedSubscription records** were returned in the current dataset. Subscription/pinning findings are therefore implementation-contract defects rather than evidence that a current user's saved feeds have already diverged.
- A recent user-authored public Post, ID `6aa1f66dd6173a60906fe06d`, is locally present with `federation_status: failed`, `federation_attempts: 8` and `AT_PUBLICATION_FAILED`. This demonstrates that local success and AT Protocol publication success can diverge in production data.

## Verified strengths

- `get-visible-posts` now accepts a restricted filter set and applies server-side viewer visibility instead of trusting arbitrary client queries.
- `filterVisiblePostsServer` is a solid foundation for `public`, `followers` and `mentioned` read policy when callers actually use it.
- `get-follow-feed` correctly uses the shared visibility helper for local member posts and followed-hashtag local posts.
- Normal public Compose publication has moved to the newer server/PDS publication path and records explicit federation states rather than pretending a generated URI is proof of publication.
- Non-public posts are intentionally local-only because AT Protocol repositories are public, which is the correct privacy principle.
- Reply threading keeps parent/root strong references and attempts to resolve the true external thread root before federation.
- The app stores `original_created_at` and several main UI paths use it to avoid showing imported old Bluesky posts as newly created.
- The Post model supports image alt text, card alt text, language, quote references and structured visibility/reply policy fields.
- `delete-post` verifies caller ownership by DID/creator ID before using service-role deletion, avoiding a simple arbitrary-delete endpoint.
- The newer feed-generator code excludes enforced user IDs in several branches and already has a clear central place where feed policy can be consolidated.

## AT Protocol interoperability notes

AT Protocol feed generators return a feed skeleton that standard clients hydrate into post views. The official Bluesky documentation describes feeds as paginated lists of posts and shows generator URIs in the `at://<did>/app.bsky.feed.generator/<rkey>` form. Standard examples return `post` values pointing to `app.bsky.feed.post` records and use cursors for continuation.

Useful references:

- https://docs.bsky.app/docs/tutorials/viewing-feeds
- https://github.com/bluesky-social/feed-generator
- https://github.com/bluesky-social/bsky-docs

This is why PF-012/PF-013 treat native binder/journal/review/profile records and fabricated unpublished post URIs as interoperability defects rather than merely a naming preference.

## Score breakdown

| Area | Score | Notes |
| --- | ---: | --- |
| Privacy and access control | 7/20 | New viewer-aware reads are good, but reply inheritance and legacy feed leakage remain release blockers. |
| Identity and integrity | 6/15 | Direct Post field ownership still lets alternate clients forge identity/counters/moderation/federation state. |
| Moderation and abuse resistance | 5/15 | 446 escalated public records remain feed-eligible in key discovery paths. |
| Feed correctness and pagination | 7/15 | Follow graph truncation, no Home cursor and multiple divergent feed engines. |
| AT Protocol federation/interoperability | 7/15 | Publication state exists, but feed skeleton types, seed URIs, reactions and deletion reconciliation remain inconsistent. |
| Reliability and performance | 6/10 | N+1 follow resolution, caps and best-effort asynchronous federation create silent divergence. |
| UX, transparency and maintainability | 5/10 | Good feed/post components exist, but failed federation, pinned-feed promises and legacy/new architecture drift are not clear to users. |
| **Total** | **43/100** | **High Risk - not release ready.** |

## Recommended remediation order

1. Lock down Post creation/update field ownership. Author identity, counters, moderation and federation metadata must become server-owned.
2. Make moderation state immutable to post authors and introduce one mandatory `isFeedEligiblePost` policy.
3. Fix reply creation so visibility and reply-policy enforcement are derived server-side from the authoritative parent/root.
4. Retire or harden `feeds/entry.ts` so no service-role feed path can return non-public content.
5. Reconcile the 446 currently escalated public posts and prevent escalated/hide-recommended items entering Explore/Home/custom feeds.
6. Add federation status UX and a reliable publication/deletion reconciliation/outbox flow.
7. Replace feed seed constants with one canonical feed registry and make the generator return only real `app.bsky.feed.post` URIs to standard clients.
8. Replace offset/capped feed pagination with stable opaque cursors, then add continuation to Home, threads and visible-post queries.
9. Make likes/reposts/reactions backend-idempotent and atomic, with separate remote IDs for different protocol records.
10. Make FeedSubscription backend-owned and synchronise create/pin/unpin/delete to the PDS; then actually connect pinned feeds to Home.
11. Apply local moderation/enforcement policy after external AppView content is merged, while preserving labels/embeds.
12. Add a comprehensive Posts/Feeds regression suite and make P0/P1 cases release gates.

## Required regression tests

### Privacy and visibility

- Public post is visible to guests.
- Followers-only post is visible only to the author and qualifying followers.
- Mentioned-only post is visible only to the author and `mentioned_dids`.
- Reply to followers-only root cannot become public.
- Reply to mentioned-only root cannot become public.
- Nested reply visibility never widens beyond the root/parent.
- Legacy/custom feed endpoints never emit non-public post IDs/URIs.

### Moderation

- Author cannot edit or clear moderation labels/status.
- `escalated` posts are excluded from Explore/Home/public custom feeds.
- `recommended_action: hide` is excluded according to policy even if review status differs.
- Suspended/enforced accounts are excluded consistently from local and external merges.

### Interactions

- Duplicate like/repost is idempotently rejected.
- Concurrent likes/reposts do not lose or over-count increments.
- Removing a reaction deletes every remote record created for it.
- Delete-post cascades/reconciles all configured interaction references in batches.

### Federation

- Public post transitions `pending → published` only after a real PDS URI/CID exists.
- Publication failure becomes visible and retryable without creating duplicate records.
- Non-public posts never publish to a public PDS.
- Remote deletion failure remains visible and retries until reconciled.
- `getFeedSkeleton` never returns a fabricated or non-post URI in a standard post slot.
- Unsupported feed URI returns an error, not another feed.

### Feeds and pagination

- More than 20 external follows all remain represented across pages.
- More than 10 followed hashtags do not silently disappear.
- Inserting new content between page requests does not duplicate/skip items.
- Home can continue beyond the first batch.
- Thread view can continue beyond 100 replies/depth six.
- Pinned FeedSubscription appears on Home after reload and survives PDS reconciliation.

## Audit limitations

- The Base44 web-agent README endpoint returned HTTP 403 when fetched directly from the sandbox during this audit. The existing connected Base44 MCP tools were used and no application code was changed beyond writing this audit document.
- Live `feed.swappulse.org` XRPC reachability could not be independently verified with the available web fetch path, so this report does not claim the external generator host is offline. The contract-level generator defects are based on the implemented source and official AT Protocol feed semantics.
- No destructive proof-of-concept records were created in production. Findings involving non-public Posts and FeedSubscriptions were verified from code/schema paths and current counts, not by injecting test user data.
- The sandbox did not expose a normal checked-out package/test runner, so a dedicated Posts/Feeds automated suite could not be executed from this interface. Source and entity-state inspection were completed instead.

## Release gate

Posts and Feeds should not be considered production-complete until **PF-001 through PF-005 are resolved and regression-tested**, and the federation/custom-feed P1 items that affect user-visible correctness have been retested against the public AT Protocol/AppView path.
