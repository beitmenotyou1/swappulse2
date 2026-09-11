# SwapPulse Explore Audit

**Audit date:** 11 September 2026  
**Area:** Explore and discovery surfaces  
**Overall score:** **36/100**  
**Risk:** **High**  
**Release status:** **NOT RELEASE READY**

## Executive summary

SwapPulse Explore is ambitious and already covers far more than a basic card search. The current surface combines card and set discovery, public posts, people and AT Protocol profile lookup, hashtags, profile-based collector discovery, community and web trends, wishlists, network records and recommendations.

The strongest parts are the multilingual card-search backend, the privacy-aware profile discovery resolver, the containment work already applied to raw collection federation, and the defensive web-trend prompt/cache design.

The principal problem is that Explore does not yet have one authoritative discovery policy. Different sections trust different data sources and apply different rules for moderation, visibility, account enforcement, graph authenticity, federation and pagination. That produces several release-blocking inconsistencies.

Three findings are P0 blockers:

1. Public Explore can return moderation-escalated posts, including records whose own moderation metadata recommends hiding them. A live query on 11 September 2026 found **446 public Post records with `moderation_status: escalated`**.
2. `wishlist_only` and `circle_scoped` trade listings are currently eligible to be published to an AT Protocol repository even though AT repositories are public. The Explore network reader does not filter the record's visibility value before returning it.
3. `Follow` and `HashtagFollow` let a signed-in caller own a record while supplying an arbitrary follower DID. Personalised discovery later trusts the supplied DID, allowing cross-user discovery-graph poisoning at the data layer.

No restricted TradeListing records were present in the entity sample queried during this audit, so the trade-listing issue is an architectural and exploitable confidentiality defect rather than evidence that a private listing is leaking right now.

## Scope

The audit covered:

- `/explore` Cards, People and Posts modes
- card text search, multilingual search, set, rarity, type, language and price filters
- recent-set discovery and `/set/:setId` routing
- bulk wishlist actions
- Everybody/Public Posts discovery
- category filtering
- latest posts
- AT Protocol people lookup
- profile-based collector discovery at `/discover/users`
- hashtag pages and hashtag follows
- trending cards
- trending topics, cards, hashtags and keywords
- internet-assisted trend generation
- `From the Network` PDS discovery
- trade-listing visibility and federation
- Who to Follow integration
- Follow and HashtagFollow graph integrity
- moderation and account enforcement
- blocking/muting and user safety controls
- pagination, ranking and scale behaviour
- loading, error and empty states
- mobile/pull-to-refresh behaviour
- accessibility and internationalisation concerns
- regression-test coverage

## Method and constraints

The existing Base44 app was inspected directly through the Base44 project sandbox and entity store. The configured Base44 web-agent README URL was requested first but returned HTTP 403 from the sandbox, so the audit continued against the actual project source, schemas, functions and current entity data. No Explore functionality was changed during this audit.

Protocol assumptions were checked against the official AT Protocol documentation. AT Protocol repositories hold public records, and custom feed skeletons are expected to identify posts by URI and support cursor-based continuation.

Key protocol references:

- https://atproto.com/specs/repository
- https://docs.bsky.app/docs/starter-templates/custom-feeds
- https://docs.bsky.app/docs/tutorials/custom-feeds
- https://docs.bsky.app/docs/advanced-guides/atproto

## Score breakdown

| Area | Score | Notes |
| --- | ---: | --- |
| Privacy and trust boundaries | 3/20 | Restricted trade federation and spoofable discovery graph are release blockers. |
| Moderation and user safety | 4/20 | Escalated posts remain eligible for Explore; no user block/mute feature was found. |
| Search and discovery correctness | 8/20 | Strong multilingual card search, but broken price filtering, capped post-search filters and set routing reduce correctness. |
| Federation and interoperability | 6/15 | Useful PDS/AT work exists, but privacy semantics and network copy do not match protocol reality. |
| UX, accessibility and state | 7/10 | Good basic structure and responsive controls, with several state, guest and accessibility gaps. |
| Performance and scale | 4/10 | Fixed windows, no cursors and scan-based discovery will truncate results as the service grows. |
| Testability and release confidence | 4/5 | Architecture is inspectable, but dedicated Explore regression tests were not found. |
| **Total** | **36/100** | **High Risk** |

## Findings summary

| ID | Severity | Finding |
| --- | --- | --- |
| EX-001 | P0 | Moderation-escalated posts remain eligible for Explore |
| EX-002 | P0 | Restricted trade listings can be published to a public PDS repository |
| EX-003 | P0 | Follow and hashtag-follow graph data can be spoofed across users |
| EX-004 | P1 | User-level block and mute controls are absent |
| EX-005 | P1 | Explore price filtering is functionally broken |
| EX-006 | P1 | Card filters run after a capped result window and create false negatives |
| EX-007 | P1 | `/set/:setId` routes to Explore but the route parameter is ignored |
| EX-008 | P1 | Sidebar Who to Follow calls the wrong feed contract |
| EX-009 | P1 | Trending Cards is not actually community-wide trending |
| EX-010 | P1 | Hashtag discovery bypasses the central moderation/enforcement policy |
| EX-011 | P1 | Explore Posts has no cursor or continuation path |
| EX-012 | P1 | `From the Network` is authenticated-only but shown as ordinary Explore content |
| EX-013 | P1 | People mode is a single-handle lookup, not a real discovery experience |
| EX-014 | P1 | HashtagFollow records publicly expose followed-topic preferences |
| EX-015 | P1 | External/firehose posts are marked as local by Explore |
| EX-016 | P1 | Unsafe Explore posts can contaminate community trend calculations |
| EX-017 | P1 | Web trends have no verifiable provenance and stale state is hidden |
| EX-018 | P1 | Bulk wishlist creation lacks demonstrated idempotency/duplicate protection |
| EX-019 | P1 | Profile discovery silently truncates after a 500-record scan |
| EX-020 | P1 | Dedicated Explore regression tests were not found |
| EX-021 | P1 | Network-feed discovery has no cursor/pagination |
| EX-022 | P2 | Explore URL query state is only read on initial mount |
| EX-023 | P2 | Search/filter state is not fully shareable or browser-history friendly |
| EX-024 | P2 | People-mode pull-to-refresh does nothing |
| EX-025 | P2 | Hashtag discovery is limited to the newest 200 global posts |
| EX-026 | P2 | Hashtag unfollow only cleans up up to five duplicate rows |
| EX-027 | P2 | Trending Topics uses ingestion time instead of original post time |
| EX-028 | P2 | Trending keyword extraction is English-centric |
| EX-029 | P2 | Multiple incompatible definitions of “Trending Cards” coexist |
| EX-030 | P2 | External actor follow failures are not surfaced to the user |
| EX-031 | P2 | People-search input accessibility labelling is incomplete |
| EX-032 | P2 | Profile discovery performs per-result user lookups |
| EX-033 | P2 | Guest network errors are presented as network outages |
| EX-034 | P3 | Network component still advertises collection records that are deliberately contained |
| EX-035 | P3 | Hashtag page back navigation is hard-wired to Home |
| EX-036 | P3 | Explore and related discovery copy has architecture drift |

## Detailed findings

### EX-001 - P0 - Moderation-escalated posts remain eligible for Explore

**Evidence**

`base44/functions/get-explore-feed/entry.ts` queries Posts with only `visibility_scope: 'public'` under the service role. It does not exclude `moderation_status: 'escalated'`, moderation labels whose recommended action is `hide`, or other moderation-ineligible records.

A live entity query on 11 September 2026 returned **446 public Posts with `moderation_status: escalated`**. Many of those rows carry labels such as `scam`, confidence values around 0.85 to 1.0, and `recommended_action: hide`.

The Explore Posts tab and Latest Posts both consume `get-explore-feed`, and `TrendingTopics` also uses the same source.

**Impact**

The public discovery surface can promote content the moderation system itself has already escalated. This is particularly risky because Explore is designed to expose users to accounts they do not already follow.

**Required fix**

Create one authoritative server-side discovery eligibility function covering:

- visibility
- moderation status
- moderation recommended action
- account enforcement state
- viewer block/mute state
- age/content-label policy where applicable

Apply it before ranking or aggregation in every discovery surface. Reconcile existing escalated records and add a release test proving hidden/escalated content cannot enter Explore or trend aggregation.

### EX-002 - P0 - Restricted trade listings can be published to a public PDS repository

**Evidence**

`TradeListing` supports `public`, `wishlist_only` and `circle_scoped` visibility. `TradeBoard.jsx` creates a listing with the selected visibility and then calls `bridgeTradeListing(created)` for every new listing.

`buildTradeListingRecord()` serialises the visibility and circle reference into the AT record, and the bridge publishes it to the user's PDS. AT Protocol repository records are public by design.

`network-feed/entry.ts` reads `org.swappulse.tradeListing` records from the PDS and does not include or enforce the record's visibility before returning Explore items.

The current entity query found zero `wishlist_only` and zero `circle_scoped` TradeListing records, so no active restricted listing leak was observed during this audit.

**Impact**

A future user can reasonably choose a restricted visibility option in the UI while the system publishes the record to a public repository. Once written to an AT repository, the confidentiality promise cannot be restored by hiding the row in Base44.

**Required fix**

Only public trade projections may be federated. Keep restricted listings entirely off-chain/off-PDS and resolve access in Base44. If portable restricted sharing is later required, use an explicit encrypted capability design rather than an ordinary public AT repo record. The network reader must still enforce `visibility === 'public'` defensively.

### EX-003 - P0 - Follow and hashtag-follow graph data can be spoofed across users

**Evidence**

`Follow.jsonc` and `HashtagFollow.jsonc` restrict create/update/delete by `created_by_id`, but their `did` field is caller-supplied rather than derived server-side from the authenticated user.

`get-follow-feed` later trusts records selected by `did: myDid` without verifying that the row's creator corresponds to that DID.

A malicious authenticated client can therefore create a row it owns but set `did` to another user's DID. That lets the attacker inject followed accounts or followed hashtags into the victim's personalised discovery graph.

**Impact**

Cross-user feed manipulation undermines user autonomy, recommendation integrity and the authenticity of the social graph. The same pattern can contaminate any relationship check that trusts these rows by DID alone.

**Required fix**

Move follow and hashtag-follow mutations behind backend functions that always derive the actor DID from the authenticated session. Enforce unique `(actor_did, subject)` keys. On reads, bind graph rows to a trusted user/account identifier and reject legacy mismatches. Add adversarial tests using a valid user attempting to write another user's DID.

### EX-004 - P1 - User-level block and mute controls are absent

No normal user block/mute entity or `Block user` / `Mute user` flow was found in the project source. Existing references to blocking relate to registration enforcement, bot risk or voice-space microphone state rather than social safety.

Explore therefore has no viewer-controlled safety primitive for excluding an unwanted account from people search, public posts, hashtags, trends, recommendations or network discovery.

**Fix:** add first-class block and mute records, server-bound to the authenticated actor, and make the central discovery policy honour them across every local and federated surface.

### EX-005 - P1 - Explore price filtering is functionally broken

Explore applies price filters using `card.pricing.tcgplayer.avg` or `card.pricing.cardmarket.avg`. `search-cards/entry.ts` returns card shapes containing id, name, image, rarity, local ID and set, but no pricing object.

That means a minimum price above zero will generally eliminate otherwise valid results because missing prices are treated as zero. Maximum-price searches can incorrectly admit cards because missing price data is also treated as zero.

**Fix:** return an authoritative price projection from the backend, including currency and freshness, or remove price filtering until it can be fulfilled correctly. Never interpret missing price as zero.

### EX-006 - P1 - Card filters run after a capped result window and create false negatives

Explore requests 36 cards and then applies set, rarity, type and price filters in the browser. Matching cards outside the initial 36 cannot be found. A set-only backend fallback also slices the set to the requested page size rather than returning or paginating the full set.

**Fix:** move all filterable fields into the backend query and return a cursor/total. A filter must operate over the complete candidate set, not a truncated client sample.

### EX-007 - P1 - `/set/:setId` routes to Explore but the route parameter is ignored

`App.jsx` maps `/set/:setId` to the Explore page, and Recent Sets links use `/set/${s.id}`. Explore does not read `useParams()` or initialise its set filter from the path parameter.

**Impact:** clicking a recent set can land the user back on generic Explore without selecting that set.

**Fix:** either create a dedicated Set page or bind `setId` into Explore's canonical filter state and load the set immediately.

### EX-008 - P1 - Sidebar Who to Follow calls the wrong feed contract

`RightSidebar.jsx` invokes `getFeedSkeleton` with `{ limit: 3 }` and then expects `recommendations` and `actorDid`. With no `feed` argument, `getFeedSkeleton` defaults to `trade-listings` and returns a feed skeleton, not recommendation objects.

The recommendation section therefore has no compatible payload to render.

**Fix:** use the actual Who to Follow endpoint/feed selector and define a typed response contract. Add an integration test that proves recommendations render and following removes the selected recommendation.

### EX-009 - P1 - Trending Cards is not actually community-wide trending

`TrendingRail` reads up to 200 Wishlist rows directly. Wishlist RLS is owner-only, so this is effectively the current user's wishlist data, not community-wide popularity.

Trade counts are added only when the card already exists in the wishlist aggregation map. A heavily traded card that is not in the current viewer's wishlist never enters the ranking.

**Fix:** compute anonymised aggregate trend signals server-side using allowed public/aggregate data. Clearly define whether the rail is “Trending”, “Popular with you”, or another personalised measure.

### EX-010 - P1 - Hashtag discovery bypasses the central moderation/enforcement policy

`HashtagPage.jsx` directly lists the latest 200 Post rows and filters `canonical_tags` in the browser. It does not pass results through the server-side moderation/account-enforcement policy used by safer endpoints.

**Fix:** create a server-side hashtag-post resolver that applies the same discovery eligibility policy as Explore before returning records.

### EX-011 - P1 - Explore Posts has no cursor or continuation path

Explore Posts fetches at most 50 rows in one call. Latest Posts fetches 20. `get-explore-feed` has no cursor or skip parameter and the UI exposes no Load More/infinite-scroll continuation.

**Fix:** implement stable cursor pagination based on original/indexed ordering plus a deterministic tie-breaker. Preserve category filters across pages.

### EX-012 - P1 - `From the Network` is authenticated-only but shown as ordinary Explore content

`network-feed` returns 401 for guests, while the Cards Explore page is public and always mounts `NetworkFeedSection`. The section catches all errors and says `Could not reach the network`.

A guest can therefore be told the network is unavailable when the real condition is simply authentication.

**Fix:** make the intended discovery data public if safe, or explicitly show a sign-in CTA and do not classify authentication failure as network downtime.

### EX-013 - P1 - People mode is a single-handle lookup, not a real discovery experience

The People tab only renders `ExternalActorSearch`, which resolves a handle or DID one at a time. SwapPulse separately has `/discover/users` for profile-field discovery, but that functionality is disconnected from the main People Explore experience.

**Fix:** provide one people-discovery surface with handle search, local member search, interests/favourites/location discovery where visibility allows, recommendations, filters and pagination.

### EX-014 - P1 - HashtagFollow records publicly expose followed-topic preferences

`HashtagFollow` has unrestricted read RLS. A user's followed hashtags can reveal interests and behavioural preferences even though those records are primarily needed to personalise that user's own feed.

**Fix:** make raw hashtag-follow records owner-only unless there is an explicit user-facing “public interests” feature. Publish only deliberate aggregate counts when useful.

### EX-015 - P1 - External/firehose posts are marked as local by Explore

`get-explore-feed` maps every Post to `{ ...p, external: false }`. Current Post data includes bridged records with real external DIDs/AT URIs, so the flag is not trustworthy.

**Fix:** derive origin from authoritative ingest/source metadata. Do not infer external/local state from which endpoint happened to return the record.

### EX-016 - P1 - Unsafe Explore posts can contaminate community trend calculations

`TrendingTopics` calls `get-explore-feed`, then aggregates cards, hashtags and keywords from those results. Because EX-001 allows escalated posts into that feed, malicious/spam content can become a trend signal as well as direct feed content.

**Fix:** trend aggregation must consume only moderation-clean, enforcement-clean, deduplicated records after the central discovery policy.

### EX-017 - P1 - Web trends have no verifiable provenance and stale state is hidden

`get-web-trends` has good fixed-prompt, sanitisation and caching controls, but the returned trend objects do not include source URLs/evidence. If the LLM fails, the backend can return stale cached data with `stale: true`, while `TrendingTopics` discards that flag.

**Fix:** store and return source/evidence metadata where licensing permits, expose `refreshed_at`, and visibly label stale/fallback trends. Do not present model-generated trend claims as equivalent to measured platform trends.

### EX-018 - P1 - Bulk wishlist creation lacks demonstrated idempotency/duplicate protection

Explore bulk-adds selected cards using a direct `Wishlist.bulkCreate`. No backend unique constraint or idempotent `(user, card)` mutation was demonstrated in this path.

**Fix:** use a backend mutation that derives the user, deduplicates by card ID and returns created/already-present counts.

### EX-019 - P1 - Profile discovery silently truncates after a 500-record scan

`search-profiles` scans at most 500 recent ProfileConfig rows and performs in-memory exact matching. Collectors outside that window become undiscoverable regardless of relevance.

**Fix:** maintain searchable public projections/indexes for permitted fields and paginate them. Avoid scanning the newest N profiles as a search substitute.

### EX-020 - P1 - Dedicated Explore regression tests were not found

A search for Explore, get-explore-feed, hashtag discovery, network-feed, actor search, search-profiles and Who to Follow tests did not find dedicated source tests. The only match was a generated distribution asset.

**Fix:** add unit and integration coverage for every P0/P1 invariant, including adversarial graph writes, restricted listing federation, moderation eligibility, filters, cursor continuity and guest/auth states.

### EX-021 - P1 - Network-feed discovery has no cursor/pagination

`network-feed` requests a fixed list of records from the shared PDS and slices the result. It does not accept/return the repository cursor from `listRecords`.

**Fix:** propagate collection cursors or implement a stable merged cursor when multiple record types are supported.

### EX-022 - P2 - Explore URL query state is only read on initial mount

Explore initialises `query` from `searchParams.get('q')`, but there is no effect that updates query state if the URL changes while the component remains mounted.

**Fix:** make URL/search state canonical or explicitly synchronise router changes into the component.

### EX-023 - P2 - Search/filter state is not fully shareable or browser-history friendly

Set, rarity, type, price, language, category and mode state live only in React state. Refreshing or sharing the URL loses most of the discovery context.

**Fix:** encode stable discovery state into query parameters and support back/forward navigation without resetting the search.

### EX-024 - P2 - People-mode pull-to-refresh does nothing

Explore's refresh handler has branches for Posts and Cards but no People branch.

**Fix:** either refresh the current people result/discovery feed or disable pull-to-refresh for that mode.

### EX-025 - P2 - Hashtag discovery is limited to the newest 200 global posts

HashtagPage fetches 200 recent posts before filtering by tag. A relevant hashtag record outside that global window is invisible even if it should be one of the newest posts for that hashtag.

**Fix:** query an indexed hashtag projection directly with cursor pagination.

### EX-026 - P2 - Hashtag unfollow only cleans up up to five duplicate rows

The unfollow path fetches at most five matching HashtagFollow records and deletes those. Existing duplicate/corrupt rows beyond five could survive.

**Fix:** enforce uniqueness and make delete idempotent server-side.

### EX-027 - P2 - Trending Topics uses ingestion time instead of original post time

The seven-day trend window checks `created_date`, not `original_created_at`. Imported or backfilled external posts can therefore appear artificially recent.

**Fix:** use authoritative source timestamps with bounded sanity checks, and keep ingestion time only as indexing metadata.

### EX-028 - P2 - Trending keyword extraction is English-centric

The local trend tokeniser uses an English stopword list and `[a-z0-9]` token matching. This conflicts with SwapPulse's multilingual card/search ambitions and can discard or mis-rank non-English discussion.

**Fix:** use Unicode-aware tokenisation and language-aware stopword/stemming rules, or restrict the feature explicitly to supported languages.

### EX-029 - P2 - Multiple incompatible definitions of “Trending Cards” coexist

Explore's `TrendingRail` ranks private wishlist plus trade signals, while the right sidebar ranks CardPricing movers. Both are labelled Trending Cards but represent different concepts.

**Fix:** name and document each ranking clearly, or unify them into one transparent trend model with explainable signal badges.

### EX-030 - P2 - External actor follow failures are not surfaced to the user

`ExternalActorSearch` catches follow errors and only logs them to the console. The UI returns to a non-following state without a clear explanation.

**Fix:** show actionable toast/error feedback and distinguish auth, federation, duplicate and network errors.

### EX-031 - P2 - People-search input accessibility labelling is incomplete

The handle input has a placeholder but no explicit label or `aria-label` in the inspected component.

**Fix:** add a visible or programmatic label, preserve error association with `aria-describedby`, and announce result state changes.

### EX-032 - P2 - Profile discovery performs per-result user lookups

After scanning ProfileConfig rows, `search-profiles` calls `User.get` separately for each page result.

**Fix:** maintain a public profile projection or batch-fetch the relevant user rows to avoid N+1 latency/cost.

### EX-033 - P2 - Guest network errors are presented as network outages

This is the UI consequence of EX-012: authentication, configuration and actual upstream outages collapse into the same generic error.

**Fix:** use typed error codes and user-specific recovery actions.

### EX-034 - P3 - Network component still advertises collection records that are deliberately contained

`NetworkFeedSection` comments and rendering still describe both trade listings and collection entries. The backend intentionally returns no raw collection records for privacy containment.

**Fix:** remove dead collection-network UI/copy until a sanitised public collection projection is actually available.

### EX-035 - P3 - Hashtag page back navigation is hard-wired to Home

The back button links to `/` rather than respecting history or returning to the discovery context that opened the hashtag.

**Fix:** use router history with a safe Explore fallback.

### EX-036 - P3 - Explore and related discovery copy has architecture drift

Examples include `Live from PDS` implying wider network scope even though `network-feed` reads a configured shared bridge repository, comments promising collection records that are now intentionally suppressed, and “Trending Cards” labels for incompatible ranking models.

**Fix:** update product copy after the architecture is consolidated so users can tell what is local, federated, aggregated, personalised and web-derived.

## Feature-by-feature verdict

| Feature | Verdict | Notes |
| --- | --- | --- |
| Card name/identifier search | Good foundation | Multilingual cache/API fallback is strong. Needs full-query filtering and pagination. |
| Set discovery | Broken/incomplete | Recent-set cards link to a route whose `setId` is ignored by Explore. |
| Rarity/type filters | Incomplete | Applied after the first 36 results. |
| Price filters | Broken | Search payload does not contain the pricing fields Explore filters on. |
| Language filtering | Good foundation | One of the stronger Explore features. |
| Bulk wishlist | Useful but weak integrity | Needs idempotent backend mutation. |
| Posts/Everybody | Unsafe | P0 moderation eligibility defect and no pagination. |
| Latest Posts | Unsafe | Inherits the same discovery policy gap. |
| People | Incomplete | Exact handle/DID lookup rather than broad discovery. |
| Local collector discovery | Privacy-aware but disconnected | Strong visibility gating, limited scan scale and not integrated into main People tab. |
| Hashtags | Unsafe/incomplete | Direct raw Post scan, no central moderation enforcement, fixed 200-row window. |
| Hashtag following | Integrity/privacy issue | DID spoofing plus public raw preference records. |
| Follow graph | Integrity issue | Actor DID not server-bound. |
| Trending Cards | Mislabelled/broken ranking | Uses caller wishlist rather than community aggregate. |
| Trending Topics | Useful concept, unsafe input | Inherits unsafe Explore feed and lacks web provenance. |
| From the Network | Valuable concept, high-risk privacy semantics | Restricted trades must never be placed in public repos. No cursor. |
| Who to Follow | Broken | Caller/response contract mismatch. |
| Block/mute safety | Missing | No first-class user block/mute system found. |
| Guest experience | Mixed | Core cards/posts are public; network section misreports auth failure. |
| Accessibility | Mixed | Main page has several labels, but People search and modal/focus paths need work. |
| Mobile | Good foundation | Pull-to-refresh exists, but People refresh is unimplemented. |

## Security and privacy priorities

### Phase 0 - Before release

1. Create and apply one server-side discovery eligibility policy to Posts, hashtags, trends and recommendations.
2. Stop federation of every non-public TradeListing. Audit/tombstone any historical restricted PDS records if any are found.
3. Replace direct Follow and HashtagFollow mutation with authenticated backend operations that bind the actor DID server-side.
4. Reconcile the 446 escalated public Post rows against current moderation decisions before they can be surfaced by discovery.

### Phase 1 - High-priority correctness

1. Repair card price/filter architecture and add paginated server-side filtering.
2. Fix `/set/:setId` navigation.
3. Repair Who to Follow's endpoint contract.
4. Add block/mute primitives and enforce them everywhere in discovery.
5. Replace Trending Cards with an authoritative aggregate or clearly personalised model.
6. Add cursor pagination to public posts, hashtags, network records and profile discovery.
7. Integrate local collector discovery into the People tab.

### Phase 2 - Trust, explainability and UX

1. Expose trend provenance, timestamps and stale state.
2. Make discovery state URL-addressable.
3. Correct external/local origin labelling.
4. Improve typed guest/auth/upstream errors.
5. Improve multilingual trend tokenisation and accessibility labels/focus behaviour.
6. Remove stale/dead discovery copy and network collection rendering.

## Required regression tests

The release suite should include at minimum:

- escalated Post never appears in Explore
- moderation `recommended_action: hide` never enters trend aggregation
- shadow-banned/suspended actor never appears in Explore
- blocked and muted actors never appear to the viewer after the feature is added
- followers-only/mentioned-only Posts never enter public discovery
- `wishlist_only` TradeListing is never bridged to PDS
- `circle_scoped` TradeListing is never bridged to PDS
- network-feed rejects or excludes any non-public trade record defensively
- attacker cannot create Follow using another user's DID
- attacker cannot create HashtagFollow using another user's DID
- duplicate follow/hashtag-follow mutations are idempotent
- card min/max price filter operates on real price data
- rarity/type/set filters find matches beyond the first page
- `/set/:setId` loads the requested set
- Explore Posts cursor has no duplicates or gaps across pages
- hashtag cursor has no duplicates or gaps across pages
- network-feed cursor resumes correctly
- Who to Follow returns and renders recommendations
- guest Network section receives an auth-aware state, not a false outage
- web-trend stale status is visible
- imported old posts do not become new trends because of ingestion time
- non-English keyword trends remain discoverable
- bulk wishlist does not create duplicates
- profile privacy remains enforced in collector discovery

## What is already strong

Several pieces should be preserved rather than rewritten:

- `search-cards` has thoughtful multilingual matching, set aliases and live TCGDex fallback.
- `search-profiles` explicitly enforces per-field public/follower/friend/private visibility even though it uses service-role reads.
- raw CollectionEntry federation has already been privacy-contained, and `network-feed` intentionally refuses to expose those historical records.
- `network-feed` filters enforced DIDs and expired trade listings.
- `get-web-trends` uses a fixed prompt, treats retrieved web content as untrusted, sanitises output, constrains the schema and caches/backoffs to avoid retry storms.
- Explore has a clear Cards/People/Posts structure, useful language controls, bulk selection, loading states and mobile pull-to-refresh support.

## Release decision

**Explore should not be treated as production-ready yet.**

The immediate release gate is not visual polish. It is consolidating the discovery trust boundary so that the same privacy, moderation, enforcement and actor-authenticity rules apply regardless of whether content came from Base44, a firehose import, a shared PDS, a local social graph or an internet-assisted trend model.

Once EX-001, EX-002 and EX-003 are fixed and regression-tested, the remaining P1 work becomes a manageable correctness and product-quality phase rather than a fundamental trust problem.
