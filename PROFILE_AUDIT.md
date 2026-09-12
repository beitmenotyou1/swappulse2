# SwapPulse Profile Full Feature Audit

**Audit date:** 12 September 2026  
**Scope:** Own and public collector profiles, DID/handle resolution, local and AT Protocol profile merge, avatar/header/bio editing, profile customisation, themes, tab/section ordering, per-field privacy, profile discovery, posts and pinned posts, collections/binders, trades, reputation/trust, journals, podcasts/live history, follows/bells/friends, starter packs, pinned feeds, boards, activity, achievements, on-chain owner view, reporting/moderation, data export/deletion, federation/PDS sync, SEO/deep links, accessibility, localisation, mobile UX and release validation.  
**Validation:** Source, schema and audit-visible data inspection completed through Base44 MCP. The required Base44 web-agent README could not be fetched from the sandbox because the endpoint returned HTTP 403. Exact-release `npm run build`, `npm run lint` and `npm run typecheck` could not run because the Base44 command sandbox mounted an empty `/workspace` without `package.json`.  
**Status:** **NOT RELEASE READY**. Profile identity, privacy, trust and data-rights boundaries contain unresolved P0 issues.

## Executive summary

SwapPulse has a much richer profile system than a conventional social profile. It combines a local Base44 account, AT Protocol identity and Bluesky merge, profile customisation, profile-specific privacy controls, public content, collection/trading views, reputation, podcasts, starter packs, follows, friendships, activity, achievements and an owner-only Web3 identity surface.

The strongest parts are the direction of travel: `User.did` is backend-managed, public profile merging returns a deliberately selected field set, `get-profile-config` tries to enforce per-field visibility, profile posts use the shared server visibility resolver, dangerous external URL schemes are rejected, the OnChain tab refuses to expose owner data to visitors, and the newer profile tab navigation has unusually good keyboard semantics.

However, the profile layer is not trustworthy enough to ship as an identity surface yet. The most serious flaw is that `ProfileConfig.did` is caller-controlled while the record is only bound to `created_by_id`. The public profile backend then service-role reads the newest config by target DID. A modified client can therefore create an enhanced profile row labelled with another collector's DID and potentially control the victim profile's enhanced bio, contact fields, social links, theme and layout. Friendship rows are similarly caller-controlled and can be forged into two accepted directions, allowing friends-only profile fields to be unlocked without a genuine relationship.

The public Activity tab is another release blocker. `get-activity` bypasses entity RLS with the service role and reads trade listings, journals and binders without re-applying their visibility rules, so private/follower/circle-scoped activity can be summarised on a public profile. Profile data-rights controls also need consolidation: the profile Privacy tab claims to delete all SwapPulse data while deleting only a short legacy list, and even the canonical account-deletion function omits `ProfileConfig`, which may contain location, contact email and social links.

Profile trust signals inherit existing trade/social provenance problems. Raw `Reputation` rows can be client-created with caller-selected rated DID, rater DID and rating, and Follow rows can be attributed to arbitrary follower DIDs. Those records feed public profile ratings, counts and relationship badges, so the profile cannot currently be treated as an authoritative reputation or social-graph view.

Audit-visible data currently contains **2 ProfileConfig records**, **0 Friendship records** and **0 Reputation records**. That lowers migration complexity, but does not reduce the severity of the executable trust-boundary findings.

## Overall score

**14/100 - Critical / High Risk**

| Area | Score | Summary |
| --- | ---: | --- |
| Identity and profile ownership | 1/15 | Base User DID is protected, but enhanced ProfileConfig ownership is not bound to its DID. |
| Privacy and audience enforcement | 2/15 | Per-field filtering exists, but Friendship forgery and Activity service-role reads bypass the intended boundary. |
| Social graph and trust | 1/15 | Follow and reputation provenance remain forgeable. |
| Profile feature correctness | 3/15 | Theme/layout, visitor tabs, boards, feeds and several contextual actions are wired inconsistently. |
| AT Protocol portability | 3/15 | Base profile sync is substantial, but enhanced profile state is local-only and deletion/reconciliation is incomplete. |
| Data rights and retention | 1/10 | Two competing export/delete paths disagree and enhanced profile data is omitted. |
| UI/UX, accessibility and localisation | 3/10 | Profile tab navigation is strong, but custom modals, hard-coded copy and context errors remain. |

## Findings

| Priority | Area | Finding | Required action |
| --- | --- | --- | --- |
| 🔴 P0 | PR-001 - Enhanced profile ownership | `ProfileConfig.did` is client-writable and create/update RLS only proves ownership of the row through `created_by_id`. `get-profile-config` then service-role selects the newest row by the requested target DID. A malicious authenticated client can create a ProfileConfig carrying another collector's DID and influence that collector's enhanced profile data and layout. | Replace direct ProfileConfig writes with a backend `upsert-profile-config` operation that derives user ID and DID from the authenticated account, rejects mismatches, enforces exactly one config per user/DID and migrates/quarantines duplicate or mismatched rows. Never service-role trust a target DID stored by the browser. |
| 🔴 P0 | PR-002 - Friends-only privacy | `Friendship` lets the creator supply `did`, `friend_did`, `status` and `initiated_by`. An attacker can fabricate both sides of an accepted friendship. `get-profile-config` service-role checks for two accepted rows and will then expose fields marked `friends`, so friends-only location/contact/profile data can be unlocked without genuine acceptance. | Move friendship request, acceptance, decline and removal into backend state transitions. Derive the actor DID from auth, create the counterpart state server-side, require the actual recipient to accept and make accepted state impossible to client-write directly. Recalculate relationship privacy from authoritative friendship state only. |
| 🔴 P0 | PR-003 - Public Activity privacy leak | `get-activity` is public and reads through the service role. It fetches `TradeListing`, `Journal` and `Binder` rows by DID without re-applying their visibility rules. This bypasses `wishlist_only`/`circle_scoped` trade visibility and follower/private journal/binder visibility, allowing non-public activity to be summarised on a public profile. | Build the Activity stream from one audience-aware projection. Reuse each source type's authoritative visibility resolver before emitting an item, include moderation/enforcement checks, and add guest/follower/friend/circle/private regression tests. Never use service-role reads as an implicit public feed. |
| 🔴 P0 | PR-004 - Profile Privacy delete control | `DataPrivacy.jsx` tells the user that "ALL" SwapPulse data will be deleted, but it only deletes seven legacy entity types. It leaves ProfileConfig, binders, journals, follows, friendships, voice spaces, podcasts, settings and many other records, then reports success. | Remove the client-side legacy deletion implementation. Route the profile Privacy action exclusively through one canonical backend deletion workflow with a server-generated completion report, retry state and honest partial-failure messaging. Do not display "all data deleted" unless all required local and federated phases are verified. |
| 🔴 P0 | PR-005 - Enhanced profile erasure | The canonical `delete-account` cleanup list does not include `ProfileConfig`. Enhanced profile data can therefore survive full account deletion, including location, contact email, social links, interests and milestone data. | Add ProfileConfig to the canonical account-erasure and export inventories, delete by both immutable user ID and canonical DID, test orphan rows after hard-delete/anonymisation and run a one-time orphan cleanup for already-deleted accounts. |
| 🔴 P0 | PR-006 - Federated profile erasure | Account deletion emits a best-effort tombstone label for `at://{did}` but does not prove deletion of the actual `app.bsky.actor.profile` record or profile avatar/header blobs from the user's PDS. Local deletion can therefore leave a public federated profile and media behind. | Implement explicit PDS record/media deletion or repository lifecycle handling appropriate to the user's custody model, persist deletion delivery state, retry failures and verify remote state. Explain unavoidable third-party cache retention separately from records SwapPulse still controls. |
| 🔴 P0 | PR-007 - Reputation shown on profiles is forgeable | The existing `Reputation` model permits client creation with caller-supplied rated DID, rater DID, trade reference and rating. `get-portable-reputation` merges those rows directly into public profile reputation. This preserves the P0 provenance issue already recorded in the Trade Board audit. | Only create feedback through the authoritative completed-trade backend. Derive rater, target and trade from an accepted TradeAgreement, reject self/unrelated/duplicate ratings and mark legacy unverified ratings separately until migrated. |
| 🔴 P0 | PR-008 - Follow graph identity is forgeable | `Follow` creation is bound only to `created_by_id`; stored follower `did` is caller-controlled. Profile follower/following counts, "Follows you" state, Following lists and downstream recommendation/trust features can therefore contain edges attributed to another DID. This matches the existing P0 in the Who to Follow audit. | Route follow/unfollow through one backend graph authority that derives follower DID from auth, validates the target, prevents self/duplicate edges, applies enforcement policy and reconciles the AT record before treating the edge as authoritative. |
| 🟠 P1 | PR-009 - Selected profile theme is ignored | Both `Profile.jsx` and `UserProfile.jsx` pass `theme="default"` into `ImmersiveProfile`, so saved `ProfileConfig.theme` is ignored for owners and visitors. | Pass the viewer-filtered config theme into ImmersiveProfile and add tests for every supported theme on owner and visitor routes. |
| 🟠 P1 | PR-010 - Theme picker is missing | `ProfileConfig.theme` and ten theme definitions exist, but `LayoutThemeTab` contains no control that updates `draft.theme`; source search found no profile editor theme setter. The advertised theme feature is effectively unreachable. | Add an accessible theme picker with preview, persist the chosen theme through the authoritative config endpoint and test reload/public rendering. Remove any theme options that are not supported end to end. |
| 🟠 P1 | PR-011 - Layout editor hard-codes default theme | `LayoutThemeTab` calls `getThemeConfig('default')` regardless of the saved theme, so tab visibility controls are based on the default tab model even if another theme is selected later. | Drive layout editing from the draft's actual theme and migrate invalid hidden/order keys when the theme changes. |
| 🟠 P1 | PR-012 - Section ordering is not actually editable | ProfileConfig stores `section_order` and the schema describes ordered profile tabs, but the editor only drag-reorders content blocks. Tabs can be hidden but not reordered. | Add keyboard-accessible drag/reorder or explicit move controls for profile sections, persist one validated order and preview the resulting navigation. |
| 🟠 P1 | PR-013 - Visitor tab policy is dead code | `UserProfile.jsx` computes a narrower visitor tab set and privacy-aware order, but never passes it to ImmersiveProfile. ImmersiveProfile independently creates the full default-theme tab set. | Establish one tab-authorisation source of truth. Pass a server-approved/owner-configured visitor tab model into the renderer and delete the duplicate unused calculation. |
| 🟠 P1 | PR-014 - Visitor Journals tab exposes owner actions | Because the unintended full tab set can expose `Journals`, `JournalsTab` has no `isOwner` guard and always renders New/Edit/Delete controls. A visitor can be shown content-authoring actions while looking at someone else's profile, creating their own journal in the wrong context. | Split owner journal management from public journal viewing. Visitor profile tabs must render read-only target-scoped content; authoring/edit/delete controls must require owner context both in UI and backend. |
| 🟠 P1 | PR-015 - Following tab is global, not profile-scoped | `FollowingTab` calls `Follow.list(..., 200)` without a DID filter while Follow is open-read. It can display the newest global follow edges rather than the profile owner's following list. | Load following through the canonical graph service for the requested subject DID, with cursor pagination and viewer privacy/block policy. Never call global Follow.list for a personal tab. |
| 🟠 P1 | PR-016 - Visitor Past Streams has owner controls | `PodcastsTab` renders `PastStreamsSection` for owners and visitors. PastStreamsSection always shows Delete and Save as Podcast actions. RLS may stop deleting someone else's stream, but a visitor can enter a workflow that republishes their own podcast from another user's stream metadata. | Pass explicit owner/read-only context. Only the stream owner may see conversion/deletion controls; visitors should see eligible published recordings only. |
| 🟠 P1 | PR-017 - Boards are not scoped to the profile | `BoardsTab` queries `BookmarkBoard.filter({})`, not the target DID. A collector sees whichever boards their own RLS permits regardless of whose profile is open. | Filter by target DID and visibility through a viewer-aware board endpoint. Keep owner controls separate from visitor cards. |
| 🟠 P1 | PR-018 - Public-board contract contradicts RLS | BookmarkBoard's description says public boards are readable by everyone, but its actual read RLS is owner/admin only. Public boards therefore cannot reliably appear on another collector's profile. | Align the schema and product contract: either support public read with explicit `visibility: public` RLS or remove public/profile-sharing claims. Add private/public cross-account tests. |
| 🟠 P1 | PR-019 - Pinned feeds cannot be shown to visitors | `ProfilePinnedFeeds` attempts to read another collector's pinned FeedSubscription rows by DID, but FeedSubscription read RLS is owner-only. The component therefore cannot fulfil its stated profile showcase role for ordinary visitors. | Create a separate public/profile showcase projection or a privacy-controlled pinned-feed list. Do not weaken the user's private subscription RLS just to make the profile component work. |
| 🟠 P1 | PR-020 - Guest handle profile links fail | `/u/:handle` is a public route, but `HandleProfile` calls `resolveUser`, and `resolveUser` requires authentication. Logged-out visitors can therefore fail to resolve a documented public profile URL. | Provide a guest-safe handle-to-DID resolver using only public identity data, with rate limits and canonical AT resolution. Keep private Base44 User fields out of the response. |
| 🟠 P1 | PR-021 - Local handle resolution is capped and ambiguous | `resolveUser` scans at most 500 users and matches handle input against bsky/custom handle, email local-part, full name stripped of spaces and even full email. Large installations can miss users and authenticated callers can probe identity aliases that should not define public handles. | Resolve by canonical unique handle/DID indexes, not table scans or email/name aliases. Remove email matching from public identity resolution and add uniqueness/conflict handling. |
| 🟠 P1 | PR-022 - Pinned post ownership is not server-validated | Pinning directly writes `User.pinned_post_id`. The UI limits the button to an authored post, but there is no authoritative backend operation proving that the pinned post belongs to the profile owner. A modified client can point the profile at another visible public post. | Add `set-pinned-post` backend validation: derive owner from auth, resolve the post, require matching author DID/user ID and allowed visibility/moderation state, and clear stale pins automatically. |
| 🟠 P1 | PR-023 - Pinned post moderation eligibility is incomplete | PinnedPost uses `get-visible-posts`, which enforces audience visibility, but the profile pin model has no persisted moderation/enforcement eligibility guarantee and can remain until fetch-time filtering or deletion. | Make pin eligibility part of the server pin operation and clear or suppress pins immediately when the post becomes moderated, deleted or author-enforced. |
| 🟠 P1 | PR-024 - Enhanced bio is effectively dead in the default experience | ProfileConfig defines `bio`, the editor clamps it, and alternate themes can render it, but PersonalInfoTab has no bio input and the default SwapPulse landing does not render the enhanced bio. | Decide whether enhanced bio is distinct from AT profile description. If yes, expose and render it consistently; if not, remove the duplicate field and use the canonical 256-character profile description. |
| 🟠 P1 | PR-025 - Enhanced profile data is not portable | `sync-profile-records` syncs the Base User display name, avatar, description and header into `app.bsky.actor.profile`. ProfileConfig interests, favourites, milestones, contact/social data, theme/layout and privacy settings remain Base44-only even though the profile UI presents them as part of the collector identity. | Document which fields are local-only versus portable. If portability is a requirement, define a versioned non-sensitive AT record for enhanced public profile metadata, respecting visibility and never publishing private/follower-only fields. |
| 🟠 P1 | PR-026 - Profile documentation overstates sync | Help says profile changes sync to the user's PDS, but custom ProfileConfig changes do not. | Update Help/Privacy copy to distinguish the standard AT profile from SwapPulse-only enhancements, or implement the missing portable record. |
| 🟠 P1 | PR-027 - Owner profile counts are truncated | Owner Profile loads at most 100 CollectionEntry rows, 20 TradeListings and 50 Reputation rows, then presents counts/averages derived from those arrays. Active collectors can see understated collection/trade totals and partial rating averages. | Fetch server-side aggregate counts/statistics or paginate fully. Never derive profile totals from presentation-page caps. |
| 🟠 P1 | PR-028 - Public follower/post counts cap at 500 local rows | `get-merged-profile` local fallback reads at most 500 posts, followers and follows then uses those lengths as counts. Accounts above the cap can plateau at 500 when AppView data is unavailable/stale. | Use count/aggregate APIs or cursor through the complete graph. Return source/freshness metadata so stale remote and local counts are distinguishable. |
| 🟠 P1 | PR-029 - Owner and visitor reputation use different sources | The owner profile averages direct local Reputation rows, while visitor reputation uses `get-portable-reputation` and can include federated rows. The same collector can see different rating totals depending on who opens the profile. | Create one authoritative reputation projection used by owner, visitor, badges and trade surfaces. Include verification provenance and pagination consistently. |
| 🟠 P1 | PR-030 - Guest reputation silently disappears | Public profiles work for guests, but `get-portable-reputation` requires authentication. ReputationSummary catches the 401 and renders nothing, so a public reputation section behaves differently for signed-out visitors without explanation. | Either make a privacy-safe public reputation endpoint or explicitly make reputation member-only and reflect that in the UI/help. Do not turn authentication failure into an empty reputation state. |
| 🟠 P1 | PR-031 - Portable reputation is not truly network-wide | `get-portable-reputation` lists at most 100 tradingFeedback records from one shared PDS repository and scans them for the target DID. This is the existing Trade Board P1: cross-PDS/instance reputation can be missed. | Resolve records from authoritative participant repositories or an indexed AppView with cursor pagination and provenance validation. |
| 🟠 P1 | PR-032 - Follow federation can diverge locally and remotely | `createBridgedFollow` commits the local Follow first and publishes to PDS fire-and-forget; unfollow deletes local state before remote deletion. Profile relationship badges/counts can disagree with AT Protocol state with no durable retry record. | Make follow/unfollow a backend transactional/outbox workflow with pending/failed sync state, idempotency and reconciliation. |
| 🟠 P1 | PR-033 - Profile collection blocks are intentionally empty | About-section `binder`/`collections` blocks use `NetworkFeedSection(type="collections")`, while `network-feed` now deliberately returns an empty privacy-contained result for collections. Those configurable profile blocks cannot display collection content. | Replace these blocks with an explicit public Binder/showcase projection. Do not re-enable raw CollectionEntry federation as a shortcut. |
| 🟠 P1 | PR-034 - Alternate themes would expose broken visitor collection tabs | Binder/Portfolio/Photos theme renderers directly query CollectionEntry by target DID, but CollectionEntry is owner-only. If theme selection is fixed, these visitor tabs will fail or appear empty for other collectors. | Design a public collection/showcase contract separate from private CollectionEntry and make all themes consume that same projection. |
| 🟠 P1 | PR-035 - Facebook Friends theme cannot show a real public friend list | FriendsTab queries Friendship by target DID, but Friendship RLS only exposes rows owned by the viewer or where the viewer is `friend_did`. Visitors cannot obtain the target's full accepted friend list, so the Facebook-style Friends tab is structurally incompatible with current privacy. | Decide whether friendships are private, mutual-count-only or publicly listable. Implement an explicit viewer-safe friends projection rather than relying on raw Friendship RLS. |
| 🟠 P1 | PR-036 - ProfileConfig allows duplicate records | The schema says one config per collector, but no uniqueness is enforced. `useOwnProfileConfig` and `get-profile-config` select the newest row, so races/duplicate creates can make settings nondeterministic even without an attack. | Enforce one server-owned config keyed by immutable user ID/DID and migrate duplicates deterministically. |
| 🟠 P1 | PR-037 - Profile discovery inherits spoofed ProfileConfig | `search-profiles` service-role scans ProfileConfig and trusts each row's stored DID. PR-001 can therefore poison location/interests/favourite-Pokémon/favourite-set discovery for another collector. | Build search indexes from canonical owner-bound profile projections only and re-index after repairing ProfileConfig ownership. |
| 🟠 P1 | PR-038 - Legacy profile export is not owner-scoped | DataPrivacy export calls `.list()` for each legacy entity with no owner filter. For entities with public/open read, the downloaded "my data" file can contain other collectors' records; for private entities it depends on RLS side effects. | Remove the client exporter and use the canonical service endpoint, which must explicitly filter every entity by immutable owner/user identifiers. |
| 🟠 P1 | PR-039 - Canonical export omits enhanced profile/friendship data | `export-my-data` does not include ProfileConfig or Friendship, so location/contact/social/profile layout/privacy settings and friendship records are absent from the official portability archive. | Add all profile/social relationship records to the canonical export inventory and document intentionally excluded platform/security secrets. |
| 🟠 P1 | PR-040 - Legacy profile export is incomplete and capped | The Profile Privacy export covers only seven entity types and at most 500 rows each, while claiming a complete JSON copy. | Delete the duplicate exporter or label it narrowly. The canonical backend export should paginate until complete, produce a manifest/counts and surface partial failures. |
| 🟠 P1 | PR-041 - Friendship erasure uses the wrong linked field | `delete-account` configures Friendship cleanup with `extra: ['subject_did']`, but Friendship uses `friend_did`. Relationship rows created by another user that point at the deleted user's DID can survive. | Change cleanup to `friend_did`, add both participant directions to erasure tests and clean existing orphaned friendship rows. |
| 🟠 P1 | PR-042 - Profile media replacement has no retention cleanup | Replacing avatar/header uploads a new file and updates the User record, but no deletion/reclamation path is visible for the previous Base44 upload or old PDS blob reference. | Add managed media lifecycle with replacement tombstones, asynchronous cleanup and retention rules. Never delete a blob still referenced by an active PDS record. |
| 🟠 P1 | PR-043 - Report evidence can be orphaned | Profile reporting uploads evidence before the report is necessarily submitted; removed/cancelled evidence has no demonstrated cleanup path. | Stage evidence privately with TTL, bind it to a submitted report atomically and garbage-collect abandoned uploads. |
| 🟠 P1 | PR-044 - Profile editor modals bypass shared dialog accessibility | EditProfileModal and ProfileEditorModal are bespoke fixed overlays rather than shared Dialog/Sheet primitives, so focus trapping, Escape behaviour, labelling and focus restoration are not guaranteed consistently. | Migrate profile editor overlays to the shared accessible modal primitives and regression-test keyboard/screen-reader flows. |
| 🟠 P1 | PR-045 - Visitor profile has owner-only OnChain tab | ImmersiveProfile appends OnChain to every local profile. OnChainTab correctly refuses visitor access, but visitors still get a dead navigation destination explaining it is owner-only. | Keep private account tools out of public profile navigation. Render OnChain only for the owner unless a deliberately public proof view is designed. |
| 🟠 P1 | PR-046 - Public Web3 proof design is absent | The profile currently has only an owner-only wallet/identity dashboard. There is no separate privacy-preserving public proof surface for optional wallet-linked verification/attestations, despite the broader self-sovereign identity architecture. | If public verification is desired, expose only minimal on-chain verification/proof state through a dedicated public DTO, never private wallet/account metadata. Keep opt-in controls explicit. |
| 🟠 P1 | PR-047 - Profile Privacy controls are split across incompatible systems | ProfileConfig field visibility, Settings/Data Rights, legacy DataPrivacy deletion/export, User profile editing and AT federation consent live in separate flows with different semantics. | Consolidate into one profile privacy model: identity/profile audience, collection/trade visibility, federation, presence, export and deletion, with consistent backend enforcement and clear consequences. |
| 🟠 P1 | PR-048 - Trade privacy controls overpromise | ContactLinksTab offers visibility settings for `trade_values` and `trade_partners`, but TradeHistoryTab currently only uses `trade_dates`; the other two controls do not visibly govern corresponding data in that tab. | Either implement those fields end to end in the trade projection or remove/rename the controls until there is data to protect. Add tests proving every privacy setting changes actual output. |
| 🟠 P1 | PR-049 - Profile trust presentation lacks verification provenance | Reputation stars, Trusted Trader badges, self-authored milestones and achievements can appear near each other without a consistent visual distinction between self-reported, local legacy, federated and cryptographically/proof-verified signals. | Define profile trust semantics and badges: self-reported milestone, verified trade feedback, achievement proof and on-chain attestation must be visually and programmatically distinct with inspectable provenance. |
| 🟠 P1 | PR-050 - Self-authored milestones can resemble verified accomplishments | Milestones include types such as first trade, set completion and grading and use achievement-like icons/glows, but they are user-authored profile content, not verified proofs. | Label milestones as self-reported profile history and link verified achievements/attestations separately. Do not use trust language or verified styling for unverified claims. |
| 🟠 P1 | PR-051 - Profile Help does not match implemented controls | Help says Edit Profile sets display name, avatar, bio and location and that users can choose whether collection stats are public. In practice location is in Customize, enhanced bio is not editable in PersonalInfoTab, and no matching collection-stats privacy toggle was found. | Rewrite Help from the actual UI contract after remediation and add documentation tests/checklists for renamed or moved profile controls. |
| 🟠 P1 | PR-052 - Profile theme Help/product claims are ahead of the UI | The codebase contains ten visual themes and platform-emulating layouts, but the current editor cannot choose them and pages ignore the saved theme. | Hide unfinished theme marketing/help until theme selection, visitor rendering and privacy-safe data sources are complete. |
| 🟠 P1 | PR-053 - Cross-profile Hub creation actions are misleading | EngagementHub always renders Compose, Create Binder, Go Live and Start Circle actions even when it is shown while visiting another collector. These actions act as the viewer, not the profile owner. | Render creation shortcuts only in owner context or clearly separate them as global viewer actions outside the target profile content. |
| 🟠 P1 | PR-054 - Public profile failures can look like empty data | Several profile components swallow fetch errors and render empty states, including podcasts, theme data and relationship surfaces. Visitors cannot distinguish privacy, service outage, unsupported feature and genuinely empty content. | Standardise loading/empty/private/error states with retry and source labels. Do not convert transport/auth errors into "No X yet". |
| 🟠 P1 | PR-055 - Profile federation sync is asynchronous without user-visible state | EditProfile saves locally first and treats PDS sync as best-effort. The backend tracks pending/failure state, but the main profile UI does not clearly expose when local and AT profiles diverge. | Show profile sync status and retry guidance on owner profile/settings, reconcile automatically and never imply federation success until confirmed. |
| 🟠 P1 | PR-056 - Public activity is not moderation/enforcement unified | Beyond audience leakage, Activity merges records without one common moderation/enforcement eligibility policy. A hidden/suspended user's content types can differ in whether they remain visible in the activity summary. | Apply the same enforcement, moderation and block policy used by canonical discovery before emitting any activity item. |
| 🟡 P2 | PR-057 - Default header can omit a usable handle | ThemeHeader shows `profile.bsky_handle` only. Local users without a linked Bluesky handle may have a username but no visible @handle even though ProfileHandle already implements a fallback chain. | Reuse ProfileHandle or one canonical handle formatter everywhere. |
| 🟡 P2 | PR-058 - ProfileHandle is dead duplicate code | ProfileHandle contains verification/fallback logic but has no usages. Header rendering duplicates only part of its behaviour. | Consolidate handle rendering into one component and remove dead alternatives. |
| 🟡 P2 | PR-059 - Profile metrics are not navigable | Followers/following/posts are rendered as static text rather than links or interactive counts. | Make counts navigate to authorised graph/content views or clearly present them as non-interactive metrics. |
| 🟡 P2 | PR-060 - Profile back navigation always goes Home | UserProfile's Back link is hard-coded to `/`, losing context when a collector was opened from Search, Who to Follow, a Circle, a trade or a feed. | Use history-aware navigation with a safe Home fallback and preserve originating filters/scroll where practical. |
| 🟡 P2 | PR-061 - Profile editor copy is largely hard-coded English | ProfileEditorModal, Personal/Contact/Journey/Layout editor surfaces and many tab renderer empty states use hard-coded English rather than the i18n catalogue. | Move profile copy into translation keys and test long strings across all supported locales. |
| 🟡 P2 | PR-062 - Platform-theme copy is largely hard-coded English | Alternate theme tabs and headings contain fixed English labels, making the profile experience inconsistent in non-English locales. | Localise theme-specific tabs, stats, empty states and accessibility labels. |
| 🟡 P2 | PR-063 - Owner tab calculations are unused | Profile.jsx builds `baseTabs`, `tabs`, `tab`, `portfolioValue` and `binderCards` state/calculations that do not drive the rendered ImmersiveProfile. | Remove dead state or wire it into one profile view model to reduce drift and regression risk. |
| 🟡 P2 | PR-064 - Visitor tab calculations are duplicated and unused | UserProfile separately calculates visitor tabs/order/hidden state that ImmersiveProfile ignores. | Delete the duplicate model after centralising tab policy. |
| 🟡 P2 | PR-065 - Default profile collection naming is inconsistent | The system alternates among Binder, Collection, Collections and Shared Collections for different tabs/blocks, while the underlying public data is actually public binders rather than raw CollectionEntry. | Define user-facing terminology around private collection vs public showcases and use it consistently. |
| 🟡 P2 | PR-066 - ProfileConfig bio limits disagree | ProfileConfig permits 1000 characters, ProfileEditorModal clamps `bio` to 256 and the standard User description is also 256. | Choose one semantic field and limit, validate it in the backend and mirror the same constraint in UI/schema/docs. |
| 🟡 P2 | PR-067 - Social-link platform field is not used for icon selection | ContactLinks stores `platform`, label and URL, but ProfileInfoRow detects brand from URL and largely ignores the structured platform field. | Canonicalise supported social-link providers server-side and use validated provider + URL data consistently. |
| 🟡 P2 | PR-068 - Contact links lack save-time URL validation | Website/social URL inputs accept arbitrary text; unsafe schemes are rejected at render/click time rather than at profile-save validation. | Validate and normalise allowed HTTP(S) URLs in the authoritative profile config endpoint and report errors before save. |
| 🟡 P2 | PR-069 - Milestone editor can create incomplete draft rows | New milestones begin with an empty required title and can remain in the draft until save, relying on later schema failure rather than inline validation. | Validate milestone title/type/date before submission, show per-row errors and prevent malformed config saves. |
| 🟡 P2 | PR-070 - Profile posts pagination can stop early on errors | usePaginatedPosts converts member fetch failures into empty batches and then may set `hasMore=false`, making a transient failure look like end-of-history. | Preserve error state separately from pagination exhaustion and offer retry. |
| 🟡 P2 | PR-071 - External profile posts cap at one 50-item batch | External Bluesky author feed loading is intentionally capped at 50 with no cursor continuation. | Implement cursor pagination for external author feeds or disclose the recent-history limit. |
| 🟡 P2 | PR-072 - Boards quick-create uses inconsistent DID source | BoardsTab writes `did: user?.data?.did || ''`, while the rest of the app generally uses `user.did`/ensureUserDid. This can create empty or inconsistent ownership metadata. | Route board creation through a backend owner-binding operation and derive the canonical DID there. |
| 🟡 P2 | PR-073 - Public board help contradicts deployed RLS | Help says public bookmark boards are visible on profiles, but BookmarkBoard currently has owner/admin read only. | Align Help after fixing PR-018 or remove the unsupported public-profile claim. |
| 🟡 P2 | PR-074 - Feed showcase wording contradicts subscription privacy | ProfilePinnedFeeds describes pinned subscriptions as a public profile showcase, while the underlying FeedSubscription is private owner data. | Create explicit opt-in showcase data rather than implicitly repurposing private subscriptions. |
| 🟡 P2 | PR-075 - Public profile SEO has limited structured identity data | UserProfile supplies title/description/canonical URL but no rich Person/ProfilePage JSON-LD using the resolved display name, handle, avatar and sameAs links. | Add privacy-safe `ProfilePage`/`Person` structured data for public local/external profiles, using only fields visible to the current public audience. |
| 🟡 P2 | PR-076 - Dynamic profile not-found/error states are sparse | Handle/DID resolution failures mostly redirect or show a generic not-found screen without distinguishing malformed DID, unknown handle, temporary federation failure or private/unavailable account. | Add stable public error states with retry for network failures and canonical search/home links for unknown identities. |
| 🟡 P2 | PR-077 - Image previews use object URLs without lifecycle cleanup | Profile editor preview URLs created with `URL.createObjectURL` are not visibly revoked when files change or the modal closes. | Revoke object URLs on replacement/unmount to avoid browser-memory leaks during repeated edits. |
| 🟡 P2 | PR-078 - Profile images have no crop/focal-point workflow | Avatar/header uploads accept generic image dimensions and rely on object-cover, so important content can be cropped differently across themes. | Add avatar/header crop previews or focal-point metadata and validate output sizes. |
| 🟡 P2 | PR-079 - Profile tab URLs are not deep-linkable | Active profile tab lives only in component state. Reload/share cannot open a specific section such as reputation, podcasts or achievements. | Encode stable tab state in route/query parameters and validate authorised tabs on entry. |
| 🟡 P2 | PR-080 - Profile customisation has no preview-before-publish mode | Layout changes save as a whole config but there is no dedicated visitor preview showing how privacy and theme choices appear to public/follower/friend audiences. | Add preview-as Public/Follower/Friend with the exact server-filtered projection before saving. |
| 🟡 P2 | PR-081 - Privacy selectors do not explain AT-public consequences | Profile field visibility controls imply local audience privacy but do not explain which standard AT profile fields or already-federated records are public outside SwapPulse. | Add field-level portability/publicity cues and prevent users from assuming Base44-only audience controls can retract AT-public data. |
| 🟡 P2 | PR-082 - Relationship privacy lacks block semantics | Profile visibility logic recognises public, follower, friend and private but has no explicit user-block relationship in the inspected profile path. | Define blocking as a first-class deny that overrides follows/friendships and apply it before profile field, activity and interaction decisions. |
| 🟡 P2 | PR-083 - Profile report reason taxonomy is generic | Profile reporting shares the same generic content-report reasons as posts/trades and has no profile-specific options such as doxxing or deceptive identity details. | Add carefully scoped profile-report reasons and moderation routing without collecting unnecessary sensitive evidence. |
| 🟡 P2 | PR-084 - Profile data has multiple freshness models | Local User, AppView identity, local ProfileConfig, PDS profile and local counts can update on different schedules without visible timestamps. | Return source/fetched/synced timestamps in the owner diagnostics and use one deterministic merge policy per field. |
| 🟡 P2 | PR-085 - Public profile starter packs are capped at 10 | ProfileStarterPacks silently shows only the newest 10 authored packs with no continuation. | Add pagination or a View all authored starter packs link/filter. |
| 🟡 P2 | PR-086 - Public podcast profile is capped at 100 episodes | PodcastsTab loads the newest 100 episodes without pagination. | Add cursor pagination and preserve player state across pages. |
| 🟡 P2 | PR-087 - Trade history is capped at 100 listings | TradeHistoryTab stops at 100 and uses the slice for total/completed/active/cancelled summary. | Use server aggregates plus paginated rows. |
| 🟡 P2 | PR-088 - Achievement theme tabs cap at 50 | Alternate theme achievement/reward tabs load at most 50 and do not expose proof state/version information. | Paginate if necessary and render only supported/granted credentials with proof-state links. |
| 🟡 P2 | PR-089 - Profile action density can become excessive | Visitor header actions can include labels, follow, bell, writing subscribe, message, moderation label and report controls alongside badges and live state. On narrow screens this can become visually dense. | Prioritise Follow/Message, move secondary actions into an accessible overflow menu and test at 320-430 px widths. |
| 🟡 P2 | PR-090 - Native confirm dialogs remain in profile flows | Journal deletion, pin replacement and other profile-connected actions still use browser `confirm()`. | Replace with shared accessible AlertDialog/undo patterns. |
| 🟢 P3 | PR-091 - Theme terminology is confusing | The code comments refer to a merged "11-theme" picker while ProfileConfig currently enumerates ten themes, and some themes emulate unrelated social platforms. | Normalise the supported theme catalogue, remove stale comments and use user-facing names that describe appearance rather than implementation history. |
| 🟢 P3 | PR-092 - Profile code has substantial dead/parallel paths | Profile.jsx/UserProfile.jsx/ImmersiveProfile/profileThemes contain overlapping tab, theme and layout models that have diverged. | Refactor around one typed ProfileViewModel and one renderer contract after security fixes, then delete dead calculations/components. |

## Feature reality by area

| Feature | Current reality | Audit judgement |
| --- | --- | --- |
| Own profile | Loads local+AT identity, posts, collection/trades/reputation/journals, live state and custom config | Broad but contains dead calculations and truncated stats |
| Public member profile | Public DID route, merged AT/local header, follow/message/report and multiple content tabs | Functional foundation, but tab/privacy projection is inconsistent |
| External Bluesky profile | AppView merge and author-feed support | Useful, but external posts stop at 50 and local handle route is guest-broken |
| Enhanced profile fields | Interests, favourites, location, links, contact, milestones, field visibility | Security boundary broken until config ownership and Friendship are authoritative |
| Themes | Ten definitions exist | Not currently usable: no picker and pages hard-code default |
| Layout customisation | Block order + hide tabs | Block reorder works conceptually; tab reorder/theme-specific controls incomplete |
| Posts | Server-visible profile feed + pinned post | Stronger visibility boundary; pin ownership should move server-side |
| Collection | Owner private CollectionEntry; visitor public binders/showcases | Public collection contract is fragmented and alternate theme tabs break |
| Trades | Direct entity RLS plus profile trade history | Needs authoritative trade projection and complete privacy-field semantics |
| Reputation | Local + attempted PDS portability | Release-blocked by forged provenance and inconsistent public/owner sources |
| Follows | AT bridge + bell preferences | Graph DID provenance and local/remote reconciliation are unsafe |
| Friends | Two-record mutual model | Release-blocked by direct client state forgery |
| Journals | Owner management component | Wrongly reachable in visitor context and source visibility must stay audience-aware |
| Podcasts/live history | Episodes and past streams | Visitor management controls must be removed |
| Starter Packs | Authored packs shown by DID | Mostly coherent, limited to 10 |
| Pinned feeds | Intended profile showcase | Cannot work cross-user with current owner-only FeedSubscription RLS |
| Boards | Intended public/private curation | Profile targeting and public-read contract are broken |
| Activity | Public merged timeline | P0 privacy bypass due service-role source reads |
| Achievements | Public credential cards in theme tabs | Should expose provenance/version more clearly |
| Web3 identity | Owner-only OnChain tab | Privacy-safe default, but public navigation should not include owner tool |
| Reporting | Dedicated profile report action | Good baseline, needs evidence lifecycle cleanup |
| Data export/deletion | Legacy profile UI plus canonical backend endpoints | Conflicting implementations; enhanced profile data omitted |

## Verified strengths to preserve

1. `User.did` is explicitly backend-managed, which is the correct pattern for a canonical AT identity field.
2. `get-merged-profile` returns a selected public profile DTO rather than dumping the full User record or secrets.
3. Standard profile sync uses per-user PDS identity/session resolution and protects admin backfill behind an admin check.
4. `get-profile-config` was designed with a sensible public/follower/friend/private field model and strips unauthorised personal fields when its relationship inputs are trustworthy.
5. Profile posts and pinned-post lookup use `get-visible-posts`, avoiding direct service-role publication of non-visible posts.
6. SharedCollectionsTab explicitly asks for public binders rather than raw private CollectionEntry rows.
7. `network-feed` now privacy-contains raw CollectionEntry federation instead of re-exposing historical PDS copies.
8. External profile URLs and social links use the common safe HTTP(S) link policy and confirmation flow.
9. Avatar/header upload guards reject SVG and bound ordinary image uploads.
10. OnChainTab avoids querying another collector's chain identity details and gives visitors only an owner-only message.
11. ProfileTabNav has good ARIA tab/menu semantics, roving tabindex, keyboard navigation and 44px minimum primary targets.
12. ReportProfileButton provides a direct moderation path for impersonation/abuse reports.
13. Profile editing preserves the migration-reverted lockout, reducing accidental overwrite of a restored Bluesky profile.
14. Public ProfileConfig search attempts to re-apply field visibility rather than exposing owner-only entity rows directly.
15. No private Web3 keys, seed phrases, identity documents or sensitive personal data are placed on-chain by the profile code inspected.

## Target profile architecture

### 1. One canonical profile identity record

Use the Base44 User ID as the immutable local owner key and the backend-managed DID as the canonical federated identity. Browser code must never decide which DID a ProfileConfig, Follow, Friendship, reputation or trust record belongs to.

### 2. Backend-owned ProfileConfig

Expose operations such as:

- `get-my-profile-config`
- `update-my-profile-config`
- `get-public-profile-view`
- `preview-profile-as`

The server derives the caller's user ID/DID, validates field limits/URLs, enforces one config row, applies visibility and returns a typed projection.

### 3. One public profile projection

`get-public-profile-view(targetDid, viewer)` should resolve:

- canonical local/AT identity
- account/enforcement eligibility
- viewer relationship
- visible personal fields
- allowed tabs/sections
- public/relationship-visible posts
- public binders/showcases
- permitted trade summary
- verified reputation/achievements
- public live/podcast state
- optional public verification proofs

Components should not independently service-role/direct-query sensitive source entities and then invent their own privacy rules.

### 4. Authoritative relationship graph

Follow and Friendship operations must derive actor DID from auth. Friendship should be a backend state machine with a request ID and participant-specific acceptance. Blocks must override follow/friend audience grants.

### 5. Verified trust only

Profile trust should use completed TradeAgreement evidence, participant-bound feedback, versioned Achievement proofs and privacy-safe on-chain attestations. Self-authored milestones remain profile storytelling and must be labelled as such.

### 6. Explicit public collection model

Keep raw CollectionEntry private/local as intended. Public profile collection content should come from explicit public binders/showcases or a dedicated opt-in projection. Themes must never query private CollectionEntry for another collector.

### 7. Honest data-rights lifecycle

One backend export and one backend erasure workflow should cover ProfileConfig, relationships, media, local content, PDS records and sync state. The UI should show per-phase completion/failures and distinguish deletion from unavoidable third-party caches.

### 8. Profile portability contract

Standard `app.bsky.actor.profile` should remain the portable name/avatar/bio/header identity. If SwapPulse wants portable interests/favourites/milestones, define a separate versioned public-only lexicon. Local privacy settings and private contact fields must never be published accidentally.

## Required release tests

- an authenticated user cannot create/update ProfileConfig for another DID
- duplicate ProfileConfig rows cannot be created for one owner
- a forged ProfileConfig cannot poison profile discovery
- Friendship status/DID cannot be forged by a browser client
- friends-only fields require real reciprocal accepted friendship
- blocks override follower/friend access
- guest/public Activity never includes private/follower/circle/wishlist-only content
- Activity applies moderation and account enforcement consistently
- public profile posts never broaden Post visibility
- a user cannot pin another author's post
- deleted/moderated pinned posts disappear and stale pins are cleared
- selected theme persists and renders for owner and visitor
- all theme tabs use viewer-safe data sources
- visitor tabs never show owner create/edit/delete controls
- Following shows only the requested collector's graph
- Boards show only authorised target boards
- pinned feeds appear only when the owner explicitly opts to showcase them
- `/u/:handle` resolves for guests without exposing email aliases
- follower/following/post counts stay accurate above 500
- owner and visitor reputation return the same verified source set
- forged Reputation/TradingFeedback cannot influence profile trust
- local follow cannot diverge permanently from PDS state without visible/retryable sync
- profile export contains ProfileConfig and relationships and only the caller's data
- profile/account delete removes ProfileConfig and all relationship directions
- deletion verifies controlled PDS actor/profile records and media lifecycle
- avatar/header replacement does not leak abandoned uploads indefinitely
- public/follower/friend/private field settings are tested for every personal field
- trade detail privacy controls each change actual returned data
- public Web3 views, if added, expose only non-sensitive verification proof state
- profile editor and report dialogs pass keyboard/focus/screen-reader tests
- 320/360/375/390/430 px layouts keep primary actions usable
- all supported locales render profile headers, tabs and editors without clipping
- build, lint, typecheck and profile E2E/security regression pass on the exact release checkout

## Recommended remediation order

1. Fix ProfileConfig ownership binding and migrate duplicate/mismatched rows.
2. Replace direct Friendship and Follow mutations with backend relationship services.
3. Repair `get-activity` audience/moderation enforcement immediately.
4. Remove the legacy DataPrivacy delete/export paths and fix canonical export/deletion to include ProfileConfig and friendship directions.
5. Move Reputation/TradingFeedback to authoritative completed-trade provenance.
6. Connect one profile tab/theme/view model and remove duplicate dead tab calculations.
7. Implement the theme picker and make all themes use privacy-safe projections.
8. Separate owner management tabs from visitor read-only tabs, especially Journals, Past Streams, Boards and OnChain.
9. Define public collection/showcase semantics and repair boards/pinned-feed visibility contracts.
10. Make handle resolution guest-safe and canonical, then clean up counts/pagination/failure states.
11. Add profile sync/reconciliation status and complete PDS deletion/media lifecycle.
12. Finish localisation/accessibility/SEO and run the exact-release regression suite.

## Release decision

SwapPulse Profile should **not** be treated as release-ready or as an authoritative identity/reputation surface until the P0 findings are fixed. The most urgent work is not visual polish. It is binding enhanced profile rows and relationship/trust records to authenticated identities, preventing public Activity from bypassing source visibility, and making export/deletion truthful and complete.

No functional application code or user data was changed during this audit. Only this audit report was added to the project.
