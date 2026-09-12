# SwapPulse Pack Opening Full Feature Audit

**Audit date:** 12 September 2026  
**Scope:** Pack-opening creation/composer, card attachment/search/collection/scanner, images/video, provenance/evidence, dedicated Pack Openings page, Home/Fresh Pulls/card-detail feeds, reactions/replies/social interactions, moderation/enforcement, notifications, cross-posting, AT Protocol federation/feed generators, Pack Parties/Pull of the Week/Challenges integrations, Proof of Usership, privacy/data rights, deletion/export, analytics, UI/UX, accessibility, localisation and release testing  
**Overall score:** **17/100**  
**Risk:** **Critical / High Risk**  
**Release status:** **NOT RELEASE READY**  
**Status:** **Source/schema/data audit complete; exact-release build/lint/typecheck/E2E verification unavailable**

| Priority | Area | Finding | Required action |
| --- | --- | --- | --- |
| 🔴 P0 | PO-001 - Authoritative Pack Opening/Post fields remain client-writable | **Inherited from PF-001.** A Pack Opening is stored as a normal `Post`. Authenticated clients can directly create/update their own Post while supplying security-sensitive fields including `did`, author display identity, `post_type`, card metadata, engagement counters, AT URI/CID, `bridged` and federation state. An alternate client can therefore forge the apparent author/provenance of a pack pull, manufacture counters or rewrite federation metadata. | Move Pack Opening/Post mutation behind backend operations. Derive actor identity from auth, validate card/event fields server-side, initialise counters internally and make federation/provenance fields service-role-only. Preserve this inherited P0 until direct entity tamper tests fail closed. |
| 🔴 P0 | PO-002 - Pack-opening authors can clear or rewrite moderation state | **Inherited from PF-002.** Post owners can update `moderation_labels`, `moderation_status`, `moderation_notes`, `moderated_by` and `moderated_at` on their own pack-opening Post. A user can therefore undo the result of `moderatePost` while keeping the post discoverable. | Make every moderation field moderator/service-role-only and expose a safe allowlisted user-edit operation for ordinary post fields. Add a negative test proving the author cannot dismiss or clear an escalation. |
| 🔴 P0 | PO-003 - Replies to non-public pack openings can become public | **Inherited from PF-003.** `createReply()` creates the reply Post without inheriting the pack-opening parent/root `visibility_scope`; the Post default is `public`. A reply inside a `followers` or `mentioned` pack-opening thread can therefore become a public local record and potentially federate. | Create replies through a backend endpoint that loads parent/root and derives a child visibility no broader than the thread. Test public/followers/mentioned pack-opening threads including nested replies. |
| 🔴 P0 | PO-004 - Legacy Fresh Pulls feeds can expose non-public pack openings | **Inherited from PF-004.** `base44/functions/feeds/entry.ts` reads `pack_opening` Posts with service role for `fresh-pulls`, `shiny-hunters` and `collection-posts` without requiring `visibility_scope: public` or applying `canViewPostServer`. Any authenticated caller can invoke this endpoint and receive URIs for followers/mentioned pack-opening records if such records exist. | Retire the legacy feed endpoint or route every Post-producing branch through one server visibility policy. Public custom feeds must explicitly query public Posts only. Add synthetic non-public regression records. |
| 🔴 P0 | PO-005 - Moderation is not consistently enforced in Pack Opening discovery | **Inherited from PF-005.** `/packs` directly queries Post by `post_type`; `getFeedSkeleton` filters visibility/enforcement but not Post moderation; `get-visible-posts` also lacks moderation filtering; Card Detail loads raw Posts. Escalated/hide-recommended pack openings can therefore remain discoverable through multiple paths. The current audit-visible Pack Opening dataset is empty, so this is source-proven rather than a live pack-opening exposure. | Introduce one mandatory `isFeedEligiblePost` policy covering visibility, moderation status/action, account enforcement, blocks and supported labels. Use it for `/packs`, Home/realtime, card social tabs and every feed-generator endpoint. |
| 🔴 P0 | PO-006 - Mention-only pack-opening previews leak to bell-enabled followers | Compose calls `dispatchBellNotifications` for every pack-opening Post regardless of `visibility_scope`. For a `mentioned` Post, the function sends `preview` to all bell-enabled followers of the author even though most of those followers are not authorised viewers of the Post. | The backend must load the authoritative source Post and compute each recipient through the same visibility policy before including any preview. Never dispatch content solely from caller-supplied category/preview data. Add a mentioned-only privacy regression test. |
| 🔴 P0 | PO-007 - Cross-post dispatcher can read and externally disclose another user's pack-opening metadata | **Same trust-boundary class previously preserved as P0 for Trade/Binder cross-posting.** `crossPostDispatcher` loads arbitrary `contentId` with service role but does not verify the loaded Post belongs to the caller before resolving `card_name`, rarity and set. A caller who knows another Post ID can push that metadata through their own external Discord/Telegram configuration, including from a non-public Post. | Verify `sourcePost.created_by_id === caller.id` or authoritative caller DID before any service-role content read or template expansion. Also validate `contentType` against the source object and visibility before external delivery. |
| 🔴 P0 | PO-008 - Moderation does not gate irreversible external dissemination | Compose launches `moderatePost` fire-and-forget, then immediately awaits AT Protocol publication and later dispatches bell/cross-post notifications. A newly created pack opening can therefore reach a public PDS or third-party destination before moderation has completed, even if moderation later escalates it. | For content that requires platform moderation, run the authoritative eligibility/moderation gate before public federation, external cross-post or follower push. Use a durable publish state such as pending-review -> eligible -> published and reconcile takedowns. |
| 🔴 P0 | PO-009 - Public Pack Opening publication inherits the federation-consent bypass | The canonical `publishLocalPost()` path checks public scope, ownership and linked PDS identity, but it does not enforce the user's federation/Do Not Sell/Share opt-out. Public pack-opening Posts can therefore still be written to the user's PDS through the normal composer despite the unresolved consent boundary identified in the AT Protocol audit. | Enforce federation consent fail-closed inside the canonical PDS write boundary for create/update/retry, not only in selected callers. Add tests before/after opt-out and during queued retries. Preserve this inherited P0 until verified fixed. |
| 🔴 P0 | PO-010 - Account deletion does not actually erase public pack-opening PDS records | Local `delete-account` removes Post rows, but its AT step only emits a tombstone label for the account. It does not enumerate/delete the user's `app.bsky.feed.post` pack-opening records or prove PDS account deletion. Public pull posts can therefore remain network-visible after SwapPulse account deletion. | Define explicit PDS account/record deletion semantics, delete or disconnect public records before losing local linkage, revoke credentials and verify the post-condition. Preserve required public-retention exceptions only under a documented policy. |
| 🔴 P0 | PO-011 - Pack Opening cannot currently serve as trustworthy Pull of the Week evidence | **Inherited from PW-005.** Pull of the Week needs proof that a nominated card was actually pulled by that collector in the eligible week. The Pack Opening feature is only a client-writable Post subtype with caller-selected card metadata and no authoritative opening/evidence model. Binding nominations to the current Post type alone would not fix contest provenance. | Before using Pack Opening as contest evidence, create an authenticated backend event/evidence model with canonical card identity, owner, timestamp and immutable source/evidence reference. Keep PW-005 release-blocking until the contest validates that evidence server-side. |
| 🟠 P1 | PO-012 - A Pack Opening is not an authoritative opening event | There is no separate PackOpening/event record or backend state. The product equates `Post.post_type = pack_opening` with an actual physical pack opening, but that value is self-declared social metadata rather than evidence. | Separate the opening event/evidence from the presentation Post, or introduce a backend-owned verified/self-reported event projection. Clearly distinguish `self_reported`, `scan_supported` and any future stronger verification levels. |
| 🟠 P1 | PO-013 - Direct API callers can create a pack opening without any card | Post requires only `content`; `card_id` is optional at the entity boundary. Compose normally labels a post as `pack_opening` only when an attached card exists, but an authenticated caller can bypass Compose and create `post_type: pack_opening` with no card at all. | Enforce pack-opening invariants server-side: canonical card is required for the pack-opening subtype/event and caller-controlled direct entity writes must not bypass them. |
| 🟠 P1 | PO-014 - Pack identity/card evidence can be rewritten after creation | The owner can update `post_type`, `card_id`, card name/image/rarity/set and other fields after the pull has accumulated reactions, notifications or external publication. There is no immutable evidence snapshot or revision history. | Freeze trust-sensitive opening/card fields after creation, or make corrections explicit backend revisions with audit history and federation reconciliation. |
| 🟠 P1 | PO-015 - Attached card metadata is not server-canonical | The Post stores caller-supplied `card_id`, `card_name`, image, rarity and set. The backend creation boundary does not resolve these fields from TCGDex, so mismatched/fabricated metadata can be presented as a pull. | Resolve canonical card metadata server-side from a supported TCGDex identifier and reject unknown IDs. Treat name/image/rarity/set as derived display data. |
| 🟠 P1 | PO-016 - Card Search and Collection attachment prove selection, not that a card was pulled | A user can attach any catalogue card or any card already in their collection and label the Post a Pack Opening. Neither picker establishes that the card came from the newly opened pack. | Keep these as convenience selectors but label the opening as self-reported unless stronger opening evidence is supplied. Do not use picker choice alone for rewards, contests or provenance. |
| 🟠 P1 | PO-017 - Scanner-assisted attachment identifies a card but does not preserve opening evidence | `post_attachment` scanning uses a private image to identify a catalogue card, then returns only the selected card to Compose. The scan photo/session is not cryptographically or structurally referenced by the resulting Post/opening, so it cannot prove which evidence supported the claim later. | If scan-supported evidence is needed, create an immutable privacy-safe evidence reference/hash tied to the authenticated opening. Do not expose the private scan publicly by default. |
| 🟠 P1 | PO-018 - Scanner private files have logical expiry but no discovered deletion job | CardScanSession sets `expires_at` to 24 hours and stores private `file_uris`, but no CardScanSession expiry cleanup/file deletion workflow was found. Session expiry only prevents later confirmation; it does not demonstrate that uploaded private card photos are erased. | Add a scheduled cleanup that deletes expired scan sessions and underlying private files, with retry/metrics. Document retention and test that expired post-attachment photos are actually inaccessible/deleted. |
| 🟠 P1 | PO-019 - Video-only Pack Opening composition silently becomes a text post | Compose stamps `post_type: attachedCard ? postType : 'text'`. A user can select Pack Opening and upload a reveal video, but without attaching a card the resulting Post becomes `text`, so it disappears from Pack Openings/Fresh Pulls despite using the pack-opening video UI. | Either require a card before Pack Opening can submit, or allow a backend-defined video-only opening model. Show validation before upload/post rather than silently changing type. |
| 🟠 P1 | PO-020 - The feature has no real pack/product/opening model | The Post records a featured card but not the sealed product/booster identity, canonical set/product ID, pack quantity, opening timestamp distinct from post time, source method or opening status. | Define the minimum PackOpening event fields needed for product semantics, keeping private purchase/location data off public federation unless explicitly chosen. |
| 🟠 P1 | PO-021 - Pack Opening writes lack a server-owned idempotent mutation boundary | Creation is a direct Post entity write from the browser. There is no pack-opening-specific idempotency key or backend duplicate control, so retries/multiple tabs/alternate clients can create duplicate opening claims. | Add an authenticated `create-pack-opening` operation with idempotency, backend validation and durable publication state. |
| 🟠 P1 | PO-022 - Direct Post writes bypass the normal bot-risk control | Compose calls `ensureBotAllowed('post', ...)`, but the Post entity remains directly creatable by authenticated users. An alternate client can therefore mass-create pack-opening Posts without the normal Compose bot guard. | Put pack-opening/post creation behind the authoritative backend abuse/rate boundary. Keep client checks only for UX. |
| 🟠 P1 | PO-023 - Direct Post mutation permits arbitrary viewer-requested media URLs | Because owners can edit `embed_images`, `embed_video`, `card_image` and related fields directly, a malicious pack-opening Post can point viewers at arbitrary external hosts. Rendering those resources can disclose ordinary request metadata to the chosen host. | Make media references backend-owned after validated upload/allowlisting or proxy remote media through a privacy-preserving fetch layer. |
| 🟠 P1 | PO-024 - Card Detail can miss valid pack openings before it even filters | `CardSocialTabs` fetches only the newest 20 Posts for a card and then filters them into pack openings versus other posts. If 20 newer non-pack posts exist, older pack openings are absent even though the Pack Openings tab says it shows recent pulls for that card. | Query the desired `post_type` server-side with cursor pagination and the common visibility/moderation policy. |
| 🟠 P1 | PO-025 - Realtime visible-post validation does not include moderation/enforcement eligibility | `src/lib/realtime.js` revalidates new Posts with `get-visible-posts`, but that endpoint only applies viewer visibility. It does not remove escalated/hide-recommended posts or enforced accounts, so realtime `feed.new_pull` can still surface unsafe content. | Make realtime invalidation resolve through the same full `isFeedEligiblePost` policy as every other feed. |
| 🟠 P1 | PO-026 - Real AT Protocol publication drops machine-readable Pack Opening semantics | `publishLocalPost()` writes an ordinary `app.bsky.feed.post` containing text/tags/embed but does not encode `post_type: pack_opening` or a structured opening/card record. Pack-opening identity exists only in the local Base44 row. | Choose an interoperable representation: keep the standard social post, and if Pack Opening semantics must round-trip, publish a versioned custom record that strong-references the post/card evidence, or define a documented tagging/indexing contract. |
| 🟠 P1 | PO-027 - Inbound Bluesky posts are always mapped as `post_type: text` | `mapPostFields()` sets every inbound `app.bsky.feed.post` to `post_type: 'text'`. A SwapPulse Pack Opening published to a real PDS therefore cannot be recognised as a Pack Opening when consumed from another repository/instance. | Add a standards-compatible companion record/index signal and ingest it, rather than trying to infer physical-pull semantics from arbitrary text. |
| 🟠 P1 | PO-028 - `org.swappulse.packOpening` is declared but not implemented | `NSID.PACK_OPENING = 'org.swappulse.packOpening'` exists in the client constants, but no Lexicon, entity mapping, firehose mapper, serializer or publication path was found for that NSID. | Either implement and publish a versioned PackOpening Lexicon end-to-end or remove the dead NSID and document standard-post-only semantics. |
| 🟠 P1 | PO-029 - Cross-instance Fresh Pulls claims do not match the actual data model | `getFeedSkeleton` comments say local and firehose-ingested remote pack openings are merged automatically. But remote standard posts map to `text`, and there is no implemented `org.swappulse.packOpening` ingest path. Cross-instance Pack Opening discovery is therefore not actually represented as claimed. | Build a real indexing contract for Pack Opening events/posts and update comments/help until remote classification is verified end-to-end. |
| 🟠 P1 | PO-030 - Feed generator can return synthetic URIs that do not identify real PDS records | For a local pack opening without `at_uri`, `getFeedSkeleton` returns a synthetic `at://did:web:feed.swappulse.org/app.bsky.feed.post/{localId}`. AT feed generators are expected to return post URIs that an AppView can hydrate; this fallback has no matching repository record. | Only return genuinely published/hydratable AT post URIs to external feed clients. Keep local-only Posts in local UI feeds rather than fabricating repository identity. |
| 🟠 P1 | PO-031 - Native Pack Opening reveal videos are not federated | `publishLocalPost()` never uploads `embed_video`. With a card attached it publishes an external card-page embed; the native reveal video remains local to SwapPulse even though the UI implies the Post is published to Bluesky. | Implement supported AT video publication through the current AT media/video model or clearly disclose that the reveal video is SwapPulse-only. Test the final hydrated external post. |
| 🟠 P1 | PO-032 - Image attachment wins over other Pack Opening media during AT publication | `buildEmbed()` returns an image embed as soon as uploaded images exist. It then never reaches the card external/video fallback. A local opening with images plus reveal video/card context therefore loses part of its presentation during federation. | Define a deterministic interoperable media strategy, such as record-with-media/external companion content where supported, and show the user what will actually federate. |
| 🟠 P1 | PO-033 - Legacy moderation helper checks the wrong field for hide recommendations | `feeds.isModerationClean()` looks for `moderation_labels[].severity === 'hide'`, while Post moderation severity values are `inform`, `warn`, `escalate`; hide is represented as a recommended action. Non-escalated hide recommendations can therefore pass the legacy check. | Centralise moderation eligibility and test against the actual ModerationLabel/Post label schema, including recommended_action=hide. |
| 🟠 P1 | PO-034 - Weekly digest counts pack openings outside the public eligible set | `weekly-feed-digest` service-role lists Posts and counts all recent `post_type: pack_opening` without checking visibility, moderation or account enforcement. A private/mentioned/escalated pull can affect the public weekly activity count even when its content should not be represented publicly. | Count only records eligible for the public digest through the common feed policy. Add privacy tests with one non-public opening to prevent aggregate leakage. |
| 🟠 P1 | PO-035 - Bell dispatcher accepts caller-supplied category/preview without proving a source Pack Opening exists | An authenticated author can invoke `dispatchBellNotifications` as themselves with `category: pack_opening` and arbitrary preview text; the function does not require/load a Post ID. This enables follower push spam unrelated to an actual opening. | Require an authoritative source record ID, load it server-side, verify ownership/type/eligibility and derive preview/URL from the record. Add rate limits. |
| 🟠 P1 | PO-036 - FollowPreference can self-assert another collector's DID for push targeting | FollowPreference create/update is owner-bound by `created_by_id`, but its `did` field is caller-writable. Bell dispatch uses `pref.did` to look up a User push subscription. A malicious account can create a bell preference carrying a victim DID so the victim receives unsolicited pack-opening pushes when the chosen author posts. | Derive follower DID from the authenticated owner in a backend preference mutation and make `did` immutable. Do not use an unverified record field to select push recipients. |
| 🟠 P1 | PO-037 - Pack-opening bell delivery bypasses the central notification preference/quiet-hours pipeline | `dispatchBellNotifications` sends Web Push directly from FollowPreference records. It does not route through the central Notification/NotificationPreference/quiet-hours policy, so platform-wide delivery controls are inconsistent. | Route bell events through the single notification dispatcher and recipient policy stack. Keep FollowPreference as one input, not a parallel delivery system. |
| 🟠 P1 | PO-038 - Pack-opening notification deep links point to a non-existent route | `deepLinkRoutes.ts` maps both `pack_opening` and `pack_pull` to `/pack-openings`, while the actual React route is `/packs`. Notifications using the central deep-link map navigate to a route that is not registered. | Change the canonical deep link to `/packs` or a stable post detail route and add route-contract tests. |
| 🟠 P1 | PO-039 - Individual Post deletion can lose the ability to clean up the public PDS copy | `delete-post` deletes the local Post first and leaves PDS deletion to a later client-side best-effort call. If that second step fails or the client closes, the public AT record can remain while the local URI/ownership linkage is gone. | Make public deletion backend-orchestrated: delete/confirm the PDS record first or retain a durable tombstone/outbox until remote deletion succeeds, then remove local content. |
| 🟠 P1 | PO-040 - Moderator force-delete has the same public-PDS lifecycle gap | `enforcement.force_delete` removes local Posts but only emits an account tombstone label. It does not prove the abusive pack-opening records themselves were deleted from the user's PDS. | Add durable PDS record/account takedown/reconciliation to enforcement and verify post-conditions before considering force-delete complete. |
| 🟠 P1 | PO-041 - Repository export cannot preserve local Pack Opening semantics | `export-repo` includes Post, but Pack Opening is a local Post subtype that the actual public `app.bsky.feed.post` record does not carry. The JSON “CAR-like” export also is not a real repository CAR. Porting the AT post therefore does not port the same Pack Opening classification. | Align portability with the real interoperable schema. If a custom PackOpening record is introduced, export/import that canonical record and use standards-compliant repository export for AT data. |
| 🟠 P1 | PO-042 - Pack Parties have no relationship to Pack Opening posts/pulls | **Preserved from PP-018/PP-019.** Post has no party reference and Pack Parties has no party-pull entity. A Pack Opening cannot be proven as occurring inside a party, and there is no party feed of those pulls. | Add an authenticated strong party reference or dedicated PackPartyPull/OpenEvent relation with membership/visibility checks before presenting party-linked openings. |
| 🟠 P1 | PO-043 - “Pack opening contests” in Challenges are not based on Pack Opening events | Challenges markets pack-opening contests, but challenge submission validation is based on CollectionEntry contribution IDs rather than an authoritative Pack Opening Post/event. A collection record is not evidence of when/how a card was pulled. | Define challenge metrics against the correct authoritative event/evidence model and validate ownership, time window and challenge scope server-side. |
| 🟠 P1 | PO-044 - Proof of Usership advertises Pack Opening activity but no PACK_OPENING ledger producer exists | PointsLedger/UsershipScore and Help explicitly list `PACK_OPENING`, and `usership-aggregate` accepts it, but source search found no `PointsLedger.create/bulkCreate` path awarding PACK_OPENING entries. The audit-visible ledger also contains 0 PACK_OPENING rows. | Implement a backend award path only after Pack Opening provenance/anti-abuse is trustworthy, or remove the claim from Help/schema until implemented. |
| 🟠 P1 | PO-045 - Current Pack Opening Posts are unsafe as a future Proof-of-Usership source | The on-chain usership aggregator treats PointsLedger as “verified platform activity”. The current opening source is a directly mutable/self-reported Post subtype. Awarding points from it would let users manufacture activity that changes a secured on-chain usership score/stake weighting. | Never mint usership points directly from client-controlled Post state. Award from a backend-validated event with uniqueness/anti-replay/evidence rules and immutable reference IDs. Add fraud/fuzz tests before enabling. |
| 🟠 P1 | PO-046 - Cross-post `contentType` is not validated against the source Post | A caller can supply `contentType: pack_opening` for an arbitrary Post ID; the dispatcher does not require `sourcePost.post_type === 'pack_opening'`. This allows misuse of pack templates/automation and weakens audit semantics. | Verify source entity type/status/owner server-side before selecting the template and delivery workflow. |
| 🟠 P1 | PO-047 - Automated external Pack Opening cross-posts link to the site root, not the opening | Compose calls `dispatchCrossPost` with `window.location.origin + '/'`. The pack-opening template promises “See it on SwapPulse”, but the link lands on Home rather than the source Post/card/opening. | Cross-post only after a stable post detail URL is available and pass that server-derived canonical URL. |
| 🟡 P2 | PO-048 - Dedicated Pack Openings discovery is capped at 50 records | `/packs` queries only the newest 50 pack-opening Posts and has no cursor/load-more path. | Add cursor pagination through an authoritative server discovery endpoint. |
| 🟡 P2 | PO-049 - Documented set/rarity filters do not exist on the Pack Openings page | Help/GitBook say users can filter Pack Openings by set or rarity. `/packs` has no filter controls at all. | Implement server-backed set/rarity filters or remove the documentation claim until available. |
| 🟡 P2 | PO-050 - “Trending pulls” are not implemented on the Pack Openings page | Help describes discovering trending pulls, but `/packs` is newest-first only and has no trend/rank model. | Add a clearly defined, abuse-resistant ranking algorithm or change the copy to “latest pulls”. |
| 🟡 P2 | PO-051 - The “Live pulls” page is not live | `/packs` loads once on mount and does not subscribe to `feed.new_pull`, poll, expose refresh or use PullToRefresh. New openings require page reload. | Add safe realtime invalidation/refetch or a visible refresh control and change “Live” wording until verified. |
| 🟡 P2 | PO-052 - Pack Openings load failures masquerade as an empty community | The page catches errors and sets `posts=[]`, producing “No pack openings yet” for backend/network failures. | Keep a separate error state with retry and preserve the last successful content where appropriate. |
| 🟡 P2 | PO-053 - Empty-state guidance has no direct action | The empty page tells users to share a pull from Compose but does not offer a button/link that opens Home/Compose in Pack Opening mode. | Add an accessible CTA into the creation flow, preserving sign-in requirements. |
| 🟡 P2 | PO-054 - Public Fresh Pulls feed only considers the newest 200 source rows | `getFeedSkeleton` fetches at most 200 matching pack-opening Posts, then applies numeric cursor slicing. Once the cursor reaches that bounded set, older eligible records cannot be paged. | Use stable source cursor pagination rather than fixed prefetch+offset. |
| 🟡 P2 | PO-055 - Card Detail Pack Openings tab has no pagination | Even after fixing the pre-filter cap, the tab has no load-more/cursor experience for popular cards. | Add deterministic pagination and keep Posts/Trades/Pack Openings independently pageable. |
| 🟡 P2 | PO-056 - Native video composer strings are English-only | `VideoComposer` hard-codes “Video uploaded”, “Upload failed”, “Video attached”, “Alt text”, “Remove video” and “Upload pack-opening video”. | Move all video composer strings to the nine-locale i18n resources and add translation-completeness tests. |
| 🟡 P2 | PO-057 - Native reveal video accessibility is incomplete | The player has play/mute buttons and an aria label, but no caption/subtitle track workflow, transcript, seek/progress controls or explicit reduced-motion/autoplay-loop policy. Video alt text defaults to generic “Pack opening video” if omitted. | Add caption/transcript support where practical, require/encourage meaningful text alternatives, expose standard controls/keyboard behaviour and honour accessibility motion settings. |
| 🟡 P2 | PO-058 - Scanner dialog lacks complete keyboard focus management | The scanner modal has `role=dialog` and `aria-modal`, but no focus trap, initial/restored focus handling or explicit Escape-key listener is visible in the component. | Use the shared accessible Dialog/focus primitives and test keyboard-only and screen-reader flows. |
| 🟡 P2 | PO-059 - Pack-specific reaction labels are not localised | `ReactionBar` hard-codes “Insane Pull”, “Jealous”, “Better Luck” and “Wow” rather than using i18n keys. | Localise reaction names/tooltips and provide explicit accessible labels rather than relying on emoji/title only. |
| 🟡 P2 | PO-060 - Pack cross-post template calls set display name a `setCode` | The template variable is `{setCode}`, but the dispatcher supplies `p.set_name`. This produces inconsistent terminology and can mislead integrations expecting a code. | Rename the template variable to `setName` or populate a validated canonical set code. |
| 🟡 P2 | PO-061 - Pack-opening analytics helper is dead | `trackPackOpened(setId, pullCount, rarePulls)` and `EVENTS.PACK_OPENED` exist, but no source call was found in the Pack Opening creation path. Product analytics therefore do not represent actual openings. | Invoke a privacy-minimised event from the authoritative backend-success path, not from a pre-validation client click, or remove the unused helper. |
| 🟡 P2 | PO-062 - Pack Opening lacks dedicated operational/audit metrics | No structured pack-opening lifecycle metrics were found for create validation, evidence level, moderation gate, PDS publication, notification delivery, cross-post result, deletion or PoU award. | Add privacy-minimised structured events and dashboards for the authoritative lifecycle so failures/divergence can be reconciled. |
| 🟢 P3 | PO-063 - Pack Opening terminology is inconsistent across the product | The same concept is called “Pack Opening”, “Pack Pull”, “Fresh Pulls” and `pack_pull`/`pack_opening` in UI, feeds, notifications and code. This increases documentation and integration drift. | Define user-facing and machine-facing vocabulary and use it consistently, retaining aliases only where compatibility requires them. |

## Executive summary

Pack Opening currently works primarily as a **social Post subtype**, not as a trustworthy record that a physical pack was opened. The normal composer can attach a catalogue/collection/scanned card, text, images and a reveal video, and it can publish a public social post. However, the trust boundary remains the generic `Post` entity, whose security-sensitive author/card/moderation/federation fields are still client-writable.

The most serious privacy and safety failures are inherited from Posts/Feeds and exercised directly by Pack Opening: legacy Fresh Pulls feeds can read non-public posts with service role, replies can widen the visibility of a non-public opening, Pack Opening discovery does not consistently enforce moderation, mentioned-only post previews are pushed to unauthorised followers, and cross-posting can resolve another user's Post by arbitrary ID. Moderation also runs asynchronously after the local write while AT publication proceeds, so an escalated opening can already have escaped to public/external systems.

Federation is only partial. The real PDS record is a standard `app.bsky.feed.post`, which is a reasonable social-post foundation, but the publication code does not preserve machine-readable Pack Opening semantics. The inbound mapper classifies every remote standard post as `text`, and the declared `org.swappulse.packOpening` constant has no Lexicon or ingest/publication implementation. As a result, another SwapPulse instance cannot reliably reconstruct Fresh Pulls from the actual federated record.

The native reveal-video experience is local-only in the current AT publication path. The PDS publisher supports image uploads and an external card-page embed but does not publish `embed_video`, so a collector can see “published to Bluesky” while the reveal video itself stays on SwapPulse.

Pack Opening also does not currently support the trust-sensitive integrations described elsewhere. Pack Parties has no party-pull relation; Pull of the Week cannot use a current Pack Opening as verified evidence; Challenge “pack opening contests” are based on CollectionEntry evidence; and Proof of Usership accepts `PACK_OPENING` in its aggregation vocabulary but there is no connected backend producer creating those ledger entries. Enabling that award directly from the current mutable Post subtype would be unsafe.

The audit-visible dataset contained **0 Post records with `post_type: pack_opening`**, **0 PointsLedger rows with `action: PACK_OPENING`**, and **0 CardScanSession rows with `purpose: post_attachment`** in this session. Those are audit-visible observations only, not claims that every environment is empty. They do mean there is no visible current pack-opening history blocking a clean architecture migration.

The required Base44 web-agent README returned **HTTP 403 Forbidden** from inside the Base44 sandbox. The command sandbox again exposed an empty `/workspace` with no `package.json`, so exact-release build, lint, typecheck and E2E verification could not be rerun. No functional application code or user data was changed during this audit.

## Current feature reality

| Capability | Current state | Verdict |
| --- | --- | --- |
| Create a Pack Opening post | Present | Browser-created generic Post subtype |
| Attach catalogue card | Present | Card identity convenience, not pull proof |
| Attach collection card | Present | Ownership/collection context, not opening proof |
| Scan card for attachment | Present | Private image identification, not durable opening evidence |
| Image attachments | Present | Local/social media support |
| Native reveal video | Present locally | Not preserved in AT publication |
| Opening/product provenance | Not implemented | No authoritative PackOpening event/evidence model |
| Canonical card validation at write boundary | Not implemented | Caller-controlled metadata |
| Dedicated `/packs` feed | Present | 50-record cap, no filters/realtime, moderation gaps |
| Fresh Pulls feed generator | Partial | Public/enforcement filtering, but moderation and interoperability gaps |
| Card Detail Pack Openings tab | Present | Pre-filter truncation and no pagination |
| Reactions/comments/reposts | Present | Inherits Post trust/visibility/counter issues |
| Bell notifications | Present | Visibility, recipient-policy and deep-link defects |
| Automated cross-posting | Present | Source ownership/type checks incomplete |
| AT standard post publication | Present | Ownership/public-scope checks are good; pack semantics/video lost |
| `org.swappulse.packOpening` Lexicon | Not implemented | Constant only |
| Remote Pack Opening classification | Broken | Inbound standard posts become `text` |
| Pack Party integration | Not implemented | No party pull relation |
| Pull of the Week evidence | Unsafe/not integrated | Current opening is self-reported/mutable |
| Challenge opening evidence | Not implemented | Uses CollectionEntry instead |
| Proof of Usership PACK_OPENING award | Not wired | Aggregator vocabulary exists, producer absent |
| Personal data export | Present | Post and CardScanSession included |
| Local account deletion | Present | Local rows cleaned |
| Public PDS erasure | Incomplete | Tombstone/best-effort lifecycle only |
| Main Pack page localisation | Good | Main four page strings translated |
| Video/reaction localisation | Partial | Hard-coded English remains |
| Dedicated Pack Opening tests | Not found | Exact release sandbox unavailable |

## Score breakdown

| Area | Score | Notes |
| --- | ---: | --- |
| Core Pack Opening functionality | 5/15 | Social pull post works, but video-only type and discovery gaps remain. |
| Provenance / integrity | 1/20 | Opening/card claim is client-controlled and not an authoritative event. |
| Privacy / visibility / moderation | 1/15 | Multiple inherited P0s affect pack-opening reads, replies, push and dissemination. |
| Federation / interoperability | 2/15 | Standard post publication exists; Pack Opening semantics and video do not round-trip. |
| Social integrations / notifications | 2/10 | Reactions/cross-post/bells exist but contain trust/deep-link/policy defects. |
| Rewards / challenges / ecosystem links | 1/10 | Party, contest, challenge and usership evidence are incomplete or unsafe. |
| Data lifecycle / deletion / portability | 2/5 | Local export/deletion exists; PDS deletion and scan-file cleanup remain incomplete. |
| UI/UX / accessibility / localisation | 3/7 | Usable basic UI and good main-page translation, but promised filters/live UX and media accessibility are incomplete. |
| Testing / operations | 0/3 | No dedicated regression suite found; exact-release gates unavailable. |
| **Total** | **17/100** | **Critical / NOT RELEASE READY** |

## Verified strengths to preserve

- Post create RLS still requires an authenticated owner via `created_by_id`, even though trusted fields need stronger server ownership.
- The canonical AT post publisher verifies public visibility, local Post ownership, linked PDS identity and DID match before writing.
- Federation delivery attempts, status, URI/CID and safe error state are persisted after the canonical publisher succeeds/fails.
- Non-public Posts are rejected by the canonical AT publisher rather than intentionally copied into public repositories.
- `getFeedSkeleton` explicitly restricts Pack Opening feeds to `visibility_scope: public` and excludes enforced user IDs; this is a good base once moderation is added.
- Card scanning uses private uploads, short-lived signed URLs, rate limits, catalogue revalidation and an LLM prompt that treats image text/QR/URLs as untrusted.
- `post_attachment` scanning does not silently add the card to the user's collection or blockchain state.
- Image uploads have basic client file-type/size guards and reject SVG in the shared image guard.
- Native video upload restricts client MIME types and size to 50 MB.
- Pack-opening Posts can be reported as generic `post` content through the existing PostCard report flow.
- `export-my-data` includes both Post and CardScanSession records.
- Account deletion includes local Posts and CardScanSession records.
- The main `/packs` page title/subtitle/empty-state strings are translated across all currently supported locales.
- Pack cards link to the canonical card detail route when a card ID exists.
- The audit-visible dataset currently contains no Pack Opening Posts, PACK_OPENING ledger rows or post-attachment scan sessions, reducing migration risk if the architecture is corrected now.

## Recommended target architecture

### 1. Separate the opening event from the social post

Use a backend-owned `PackOpening` event with a random immutable ID and fields such as:

- authenticated owner user ID / DID
- canonical set/product identifier where known
- opened_at / created_at controlled or bounded by the backend
- featured card IDs / optional full pull list
- evidence level (`self_reported`, `scan_supported`, future stronger verified levels)
- privacy/audience state
- immutable source/evidence references/hashes where justified
- linked presentation Post ID / AT strongRef when public
- moderation/eligibility state
- reward/contest eligibility state separated from display copy

Do not place private scan photos, purchase data, addresses or other sensitive information on-chain or in public AT records.

### 2. Make creation one backend transaction

`create-pack-opening` should:

- derive actor identity from auth
- validate canonical TCGDex card/set IDs
- enforce rate/idempotency/duplicate rules
- validate visibility and mentioned/follower targets
- create the opening and presentation Post
- run the required moderation/eligibility gate
- enqueue optional federation, bell and cross-post deliveries only after eligibility
- persist delivery/audit state for retry/reconciliation

### 3. Treat evidence honestly

A scanner can support card identification, but it should not be marketed as proof of pack origin unless the evidence model can actually establish that fact. Keep evidence levels explicit so self-reported posts remain fun social content without silently becoming financial/reputation/security evidence.

### 4. Fix Pack Opening federation deliberately

AT Protocol standard `app.bsky.feed.post` is suitable for the public social message. If SwapPulse needs Pack Opening semantics to interoperate, publish a versioned custom `org.swappulse.packOpening` record in the author's repository that strong-references the public social Post and canonical card/opening metadata. Repository DID is authoritative authorship. Do not trust redundant author fields over repository provenance.

Feed generators should return only real hydratable post URIs. The public Fresh Pulls index should be built from canonical indexed PackOpening records or another documented, verifiable signal rather than a local-only `post_type` column.

### 5. Make every outward disclosure visibility-aware

One server policy must control:

- `/packs`
- Home/realtime
- card-detail tabs
- feed generator results
- bell push previews
- weekly digest counts
- external cross-posts
- replies/quotes

Visibility, moderation, enforcement and blocks must be evaluated before data leaves the service boundary.

### 6. Gate contests/rewards on verified backend events

Do not award Proof-of-Usership points or treat a Pack Opening as contest/challenge proof from client-controlled Post fields. Use a backend-authoritative event ID with uniqueness/replay protection and the evidence level required by the consumer.

### 7. Complete lifecycle and privacy handling

Add durable PDS deletion/update reconciliation, expired scanner-file cleanup, explicit retention documentation, stable export/import semantics and auditable moderation/reward decisions.

## Required release tests

Before release, prove at minimum that:

- Direct Post API clients cannot forge a different DID/author, engagement counters, moderation state or federation metadata.
- A Pack Opening cannot be created without a canonical card when that is the product rule.
- Changing a Pack Opening's card/evidence after creation is rejected or produces an explicit audited revision.
- Bot/rate/idempotency controls cannot be bypassed by direct entity writes.
- A followers/mentioned Pack Opening is never returned by public Fresh Pulls/collection feeds.
- A reply to followers/mentioned Pack Opening never becomes broader/public.
- Escalated/hide-recommended Pack Openings do not appear on `/packs`, Home/realtime, Card Detail or external feed generators.
- A mentioned-only Pack Opening preview is delivered only to authorised mentioned recipients.
- CrossPostDispatcher cannot resolve another user's Pack Opening by ID.
- Moderation/eligibility completes before PDS publication, bell push or third-party cross-post when required.
- Federation opt-out blocks initial publication and retry.
- A published Pack Opening round-trips to another SwapPulse instance with its intended machine-readable semantics.
- Remote ordinary Bluesky posts are not falsely classified as physical pack openings.
- Feed generator results always contain hydratable real AT post URIs.
- Native reveal video federation behaviour matches what the UI promises.
- Card Detail pagination returns Pack Openings even after more than 20 newer non-pack Posts.
- `/packs` pagination works beyond 50 and Fresh Pulls beyond 200 records.
- Weekly digest ignores non-public/moderated/enforced Pack Openings.
- Bell preferences cannot claim another user's DID or push subscription.
- Pack notification deep links resolve to a registered route/post detail.
- Individual delete, account delete and force-delete reconcile the real public PDS record according to policy.
- Expired/cancelled scan sessions delete underlying private files.
- Pack Party pull association validates party membership/visibility.
- Pull of the Week validates authoritative opening evidence and time window.
- Challenge pull metrics use the intended opening event, not unrelated collection ownership.
- PACK_OPENING usership points can be produced only once from eligible backend-validated events and cannot be replayed/forged.
- All supported locales cover video/reaction/Pack Opening UI strings.
- Scanner/video dialogs and controls pass keyboard/screen-reader tests.
- Dedicated unit/integration/adversarial tests pass.
- Build, lint, typecheck and E2E gates pass against the exact release commit.

## AT Protocol references checked

- AT Protocol Lexicons: https://atproto.com/guides/lexicon
- Lexicon specification: https://atproto.com/specs/lexicon
- AT Protocol reads/writes: https://atproto.com/guides/reads-and-writes
- Writing repository records: https://atproto.com/guides/writing-data
- AT custom feeds: https://atproto.com/guides/feeds
- AT URI scheme / record addressing: https://atproto.com/specs/at-uri-scheme

## Release decision

**Do not release Pack Opening as a trustworthy provenance/reward/contest feature while PO-001 through PO-011 remain unresolved.**

The safest remediation order is:

**server-owned PackOpening event -> lock down Post/moderation fields -> unify visibility/moderation/enforcement policy -> fix notification/cross-post privacy -> moderation-before-external-publication -> federation consent -> interoperable PackOpening semantics + real feed URIs/video behaviour -> scanner-file retention -> contest/party/challenge integrations -> Proof-of-Usership award path -> pagination/live UX/localisation/accessibility -> dedicated adversarial tests -> rerun this audit.**
