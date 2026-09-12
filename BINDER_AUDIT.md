# SwapPulse Binder Audit

**Audit date:** 12 September 2026  
**Area:** First-class Binders, Collection showcase binder, Binder access control, discovery, federation, standard.site, cross-posting, achievements, profile surfaces and data lifecycle  
**Overall score:** **27/100**  
**Risk:** **High**  
**Release status:** **NOT RELEASE READY**

## Executive summary

SwapPulse has two Binder concepts today: a first-class multi-page `Binder` entity with themes, visibility, public detail pages, AT Protocol publication, standard.site integration and recommendations, plus the older Collection showcase binder driven by `CollectionEntry.showcased`, `binder_index` and attempted User-level `binder_public` / `binder_grid_size` settings. The first-class implementation has a useful visual foundation and the federation privacy policy correctly recognises that only explicitly public Binders may enter an AT Protocol repository.

The dedicated Binder audit nevertheless found multiple release-blocking privacy and trust-boundary failures. The most serious is `getBinder`: it runs as service role, treats mutable `binder.did` as an ownership signal and uses that DID to select private CollectionEntry rows. `Binder.create` does not bind `data.did` to the authenticated user's DID, and the inbound Binder mapper also trusts a record-body `authorDid` instead of the repository DID. A malicious local or federated Binder can therefore be made to resolve another collector's private CollectionEntry records if matching entry IDs are supplied.

Followers-only privacy is also not authoritative. `getBinder` grants access when a matching `Follow` row exists, while the `Follow` schema allows an authenticated caller to create a row without binding `data.did` to the authenticated DID. An attacker can therefore manufacture the relationship that the Binder resolver trusts. Separately, the public `get-activity` endpoint service-role reads Binders by DID without filtering visibility, exposing the existence, title, ID and timestamp of private/followers-only Binders to guests.

Publication lifecycle is another release blocker. Creating any new Binder calls `dispatchCrossPost('binder', ...)` regardless of visibility, so a private or followers-only Binder can publish its title and URL to a configured external destination. The cross-post backend also service-role fetches an arbitrary caller-supplied Binder ID without proving the Binder belongs to the caller. Privacy downgrades are asynchronous: the local Binder becomes private/followers immediately while PDS and standard.site deletion happen in the background. The five-minute outbound reconciler provides eventual repair for the `org.swappulse.binder` PDS record, but standard.site cleanup does not have the same automatic guarantee. Normal Binder deletion, account deletion and moderator force deletion also remove local rows without a reliable remote-delete-first lifecycle.

Binder trust signals are currently forgeable. Owners can directly update `like_count`; Binder Curator checks only `pages.length >= 5` and `like_count >= 10`, not that pages are populated or that engagement came from distinct users. A granted `binder_curator` achievement qualifies the account for the Discord `Contributor` role. This turns a cosmetic counter weakness into a reputation/role-integrity failure.

Current audit-session entity queries returned no Binder records visible to the audit session. This is not treated as proof that production has zero Binders; it means the audit cannot claim a current exposure count. One StandardRecommend test-like row was visible, unrelated to a live Binder. The findings below therefore distinguish code-confirmed exploitability from live-data evidence.

## Scope

This audit covered:

- first-class Binder directory and public detail pages
- My Binders and Discover views
- Binder creation and editing
- page/slot model, captions, cover image and themes
- CollectionEntry slot selection and physical-card representation
- public, followers and private visibility
- owner and follower access checks
- public likes and view counters
- standard.site recommendation integration
- AT Protocol Binder publication, update, ingestion and deletion
- standard.site document publication and deletion
- cross-posting to external destinations
- public activity/profile surfaces
- profile Shared Collections and theme-specific Binder surfaces
- search/discovery and SEO/sitemap integration
- Binder Curator achievement and Discord role integration
- data export, repository export, account deletion and moderator deletion
- admin privacy audit/remediation tooling
- legacy Collection showcase binder, ordering, grid size and public/private toggle
- moderation/reporting and enforcement interactions
- pagination, concurrency, error handling, accessibility, localisation and regression coverage

## Method and constraints

The existing Base44 app was inspected directly through its project file/entity APIs. The project-mandated web-agent README URL was requested from the Base44 sandbox first but returned HTTP 403, so the audit continued against the actual application source, schemas, backend functions, workflows and audit-visible entity data.

The Base44 command sandbox currently exposes `/workspace` without the application `package.json`; a release build therefore could not be executed from this audit environment. This is an audit-environment limitation, not evidence that the application build itself fails.

No Binder functionality was changed during this audit. The only project change is this audit report.

## Score breakdown

| Area | Score | Notes |
| --- | ---: | --- |
| Access control and privacy | 2/20 | Service-role slot resolution trusts mutable DID, followers-only access trusts a spoofable Follow graph, and public activity leaks non-public Binder metadata. |
| Federation and publication lifecycle | 4/20 | Central publication policy is strong, but cross-post/privacy downgrade/delete lifecycle can leave private or deleted Binder metadata public. |
| Trust, engagement and achievement integrity | 3/15 | Likes are not authoritative and Binder Curator can be self-manipulated into a contributor credential/role. |
| Core Binder authoring and viewing | 8/15 | Multi-page editing/viewing works conceptually, but fixed collection windows, weak slot validation and stale publication state limit correctness. |
| Discovery and social integration | 4/10 | Sitemap/public profile paths exist, but guest directory, likes, recommendations, search and author navigation are incomplete or broken. |
| Data rights, moderation and enforcement | 2/10 | Local export exists, but remote deletion, moderation/reporting and enforcement visibility are incomplete. |
| UX, accessibility and release confidence | 4/10 | Good basic layout, but duplicate Binder models, misleading help, incomplete localisation and no dedicated Binder tests remain. |
| **Total** | **27/100** | **High Risk** |

## Findings

| Priority | Area | Finding | Required action |
| --- | --- | --- | --- |
| 🔴 P0 | Binder/Collection isolation | `getBinder` runs as service role and considers `binder.did === user.did` an owner signal. It then selects private CollectionEntry rows with `{ did: binder.did }`. `Binder.create` does not bind `data.did` to the authenticated DID, so an authenticated Binder creator can persist another collector's DID and supplied/known CollectionEntry IDs, then make the resolver return that collector's private card details. The inbound Binder mapper also accepts record-body `authorDid`, so the same trust flaw can be reached by an ingested public Binder from another repo. | Derive Binder ownership exclusively from immutable `created_by_id` for local records and from the authoritative repository DID for federated records. Never use caller-controlled `binder.did` as a CollectionEntry authorisation selector. Resolve only the exact slot IDs after proving every one belongs to `binder.created_by_id`. Reject the save/ingest if any slot is foreign. Add local and remote adversarial tests. |
| 🔴 P0 | Followers-only access | `getBinder` authorises followers-only Binders by finding a `Follow` row `{ did: viewerDid, subject_did: binder.did }`, but the Follow entity's create rule binds only `created_by_id`, not `data.did`. An authenticated user can manufacture a Follow row whose follower DID is whatever the client supplies, satisfying the Binder privacy check without an authoritative follow relationship. | Make Follow creation/update server authoritative: derive follower DID from authenticated identity, validate the subject, prevent caller-supplied identity fields, deduplicate the pair and verify against the user's actual AT relationship where required. Binder followers-only access must consume that authoritative relation only. |
| 🔴 P0 | Public activity privacy | `get-activity` is intentionally unauthenticated and uses service role to query `Binder.filter({ did })` without `visibility: 'public'`. It then returns Binder ID, title, creation time and `/binder/:id` path for private and followers-only Binders to any guest. | Apply the same publication/access policy to every service-role activity source. Guests may receive only `visibility:'public'` Binders; authenticated owners/followers need a separately authorised path. Add guest tests proving private/followers Binder IDs and titles never appear. |
| 🔴 P0 | Cross-post source authorisation | `crossPostDispatcher` accepts caller-supplied `contentType:'binder'` and `contentId`, then service-role calls `Binder.get(contentId)` without proving the source Binder belongs to the caller or is intentionally shareable. A signed-in user who obtains another Binder ID can make private Binder metadata flow into the attacker's own configured external destination. | Authorise the source record before any service-role metadata read. For Binder cross-posting, require `created_by_id === caller.id` and `visibility === 'public'`. Never use knowledge of an entity ID as authority. Add private/foreign Binder negative tests. |
| 🔴 P0 | Non-public cross-post leakage | New Binder creation always calls `dispatchCrossPost('binder', created.id, ...)`, even when visibility is `private` or `followers`. If the owner has Binder cross-posting enabled, a privacy-labelled Binder can immediately publish its title and URL to Bluesky, Discord or Telegram. | Gate cross-post dispatch on authoritative public visibility server-side, not only in the client. Never publish followers/private Binder metadata externally. Make privacy state part of the cross-post source authorisation test. |
| 🔴 P0 | Privacy downgrade lifecycle | Editing a public Binder to followers/private updates the local record first and navigates away while PDS and standard.site deletions run asynchronously. PDS deletion failures can remain exposed until the five-minute outbound reconciler repairs them; standard.site deletion has no equivalent automatic owner-side reconciliation guarantee and can remain public until administrative remediation. The UI presents the Binder as private before public copies are proven gone. | Move visibility changes into a backend state machine. For public→non-public, enter `privacy_update_pending`, delete every public copy first, verify PDS/standard.site removal, then commit the new local visibility. Persist retry state and surface failures. Privacy must fail closed. |
| 🔴 P0 | Binder Curator credential integrity | Binder Curator qualifies when the engine sees at least five `pages` and `like_count >= 10`. It does not verify that five pages contain cards, and Binder owners can directly update their own `like_count`. Binder proof lookup is also DID-based. A user can therefore self-manipulate the evidence for a silver achievement; `binder_curator` is one of the achievements that grants the Discord `Contributor` role. | Make engagement event-based and server-maintained with one reaction/recommendation per authenticated user. Count populated pages by validated slot contents, bind proof input to immutable ownership, require public publication if the achievement says “published”, and recalculate/revoke forged credentials. Do not grant external roles from mutable client counters. |
| 🔴 P0 | Binder deletion and erasure | BinderDetail deletes the local Binder row without deleting the `org.swappulse.binder` PDS record; `getBinder` omits `standard_doc_uri`, so its attempted standard.site cleanup normally cannot run. Account deletion and moderator force-delete also bulk-delete local Binder rows without a delete-remote-first Binder lifecycle. Once the local source is gone, normal outbound reconciliation cannot reliably discover the orphaned public record. | Implement one authoritative Binder deletion service used by user delete, account erasure and enforcement. Delete/verify the PDS Binder and standard.site document before retiring the local row, persist tombstones/retry state, and retain enough identifiers to reconcile failures. Test idempotent repeat deletion and partial remote failure. |
| 🟠 P1 | Slot portability / public metadata | `collection_entry_uri` is defined by the Binder lexicon as an `at://` URI, but BinderEdit stores Base44 CollectionEntry IDs. Public `org.swappulse.binder` records therefore contain implementation-specific private-record identifiers instead of portable references and may fail lexicon validation on strict implementations. | Split the model into a private local `collection_entry_id` and a public portable card projection/reference. Never publish private CollectionEntry identifiers. Validate the outbound record against the registered Binder lexicon before writing to a PDS. |
| 🟠 P1 | Federated author attribution | `firehoseMappers.ts` maps Binder `did` from `val.authorDid || repoDid`. A remote record can therefore claim another DID in its body even though the repository DID is the authoritative author. Besides feeding BIN-001, this corrupts author display, follower checks and ownership-related analytics. | Ignore record-body author identity for ownership. Set Binder DID from the repo DID supplied by ingestion; preserve any claimed `authorDid` only as untrusted metadata if needed for diagnostics. |
| 🟠 P1 | Slot resolution scale | `getBinder` loads at most 500 CollectionEntry rows for the selected owner and then resolves slots from that arbitrary window. Valid Binder slots can render empty once the owner's collection grows beyond 500 rows. | After validating the Binder owner, collect the non-empty slot IDs and fetch exactly those owner-bound CollectionEntry records. Reject missing/foreign references explicitly instead of scanning the newest 500. |
| 🟠 P1 | Editor collection scale | BinderEdit loads only the latest 500 CollectionEntry rows. Older owned cards cannot be selected in the SlotPicker, so the editor becomes incomplete for larger collections. | Replace bulk loading with an owner-scoped search/cursor endpoint supporting card name, set, rarity, condition, variant and CollectionEntry ID. |
| 🟠 P1 | Binder directory scale | `/binders` calls `Binder.list(..., 200)` with no cursor. My Binders and Discover silently omit records beyond that fixed window and sorting is limited to creation date. | Add stable cursor pagination and server-side filters/sorts. Owner and public discovery counts should come from complete aggregates, not fixed client windows. |
| 🟠 P1 | Guest Binder directory | `/binders` is a public route, but its load uses `Promise.all([ensureUserDid(), Binder.list(...)])`. `ensureUserDid()` throws for guests, causing the public Binder list result to be discarded and the page to settle as empty. | Separate guest public discovery from authenticated “My Binders”. Load public Binders without identity initialisation; initialise the owner tab only after authentication. Add unauthenticated route tests. |
| 🟠 P1 | Public likes | BinderDetail optimistically increments `like_count` and directly calls `Binder.update`. Binder update RLS is owner/admin only, so an ordinary visitor cannot persist the like; the UI suppresses the error and still shows the optimistic increment until refresh. | Replace direct counter mutation with an authenticated Like/Reaction service that records one event per user and updates/derives the aggregate atomically. Roll back UI on failure. |
| 🟠 P1 | Engagement counter integrity | `like_count`, `view_count` and `recommend_count` live directly on Binder. Owners can update Binder fields, so like/view values are not trustworthy evidence even apart from the broken public Like button. `view_count` has no audited authoritative increment path. | Make social counters backend-derived from immutable/idempotent event rows or protected aggregate functions. Prevent Binder owners from directly writing trust-relevant counters. |
| 🟠 P1 | Recommendation UI contract | BinderDetail renders `RecommendButton` only when `binder.standard_doc_uri` exists and passes `binder.did` / `binder.recommend_count`, but `getBinder` omits `standard_doc_uri`, `standard_pub_uri`, `recommend_count` and Binder DID from the returned binder object. The first-class recommendation path is therefore effectively disconnected. | Define a typed, visibility-aware Binder read model containing only the publication/recommend metadata needed by the viewer, or resolve recommendation state through a dedicated endpoint. |
| 🟠 P1 | Recommendation target binding | `toggle-standard-recommend` trusts client-supplied `documentUri`, `entityType`, `entityId` and `authorDid`. It service-role fetches the target Binder by ID and increments/decrements `recommend_count` without proving the supplied document URI belongs to that Binder or that the author DID is correct. This allows counter corruption and notification misrouting. | Load the authoritative Binder by `entityId`, require it to be public, require `standard_doc_uri === documentUri`, derive author DID from the Binder and use an idempotent `(recommenderDid, documentUri)` event. Reject mismatches. |
| 🟠 P1 | Standard.site edit drift | Creating a public Binder with a description may publish a standard.site document, but a subsequent public→public Binder edit updates the canonical Binder record only. Title, description, theme/cover metadata and text in the standard.site document can become permanently stale. | Add an authoritative update path for the associated standard.site document or delete/recreate it transactionally when public Binder content changes. Track and reconcile its CID/URI state. |
| 🟠 P1 | Multi-system save consistency | Binder create/update, PDS bridge, cross-post, standard.site publication and local metadata updates are separate asynchronous operations. Most failures are swallowed/logged, while navigation proceeds. A single save can therefore leave local, PDS, standard.site and external-network representations disagreeing. | Move Binder publication orchestration server-side with persisted per-destination state, idempotency keys, retry semantics and a user-visible sync status. Do not represent “saved/published” as one boolean when destinations differ. |
| 🟠 P1 | Publication status UX | A Binder may be locally `public` even when `bridgeBinder` or standard.site publication failed. The current UI does not surface federation failure/pending state, so authors cannot tell whether “public” means only public on SwapPulse or successfully published externally. | Show explicit local visibility and federation states such as local-public, PDS-pending, PDS-published and standard-document-published/failed. Provide retry from an authorised backend action. |
| 🟠 P1 | Cover-image privacy | Binder cover is a free-text URL. `cardImageUrl` passes arbitrary HTTP(S)-looking image URLs through, and BinderDetail renders the URL directly in visitors' browsers. A public Binder author can therefore use a third-party image endpoint as a tracking pixel to receive visitor network/request metadata. | Restrict Binder covers to trusted/uploaded media or proxy/cache remote images through a controlled image service with host/type/size validation. Apply a restrictive production `img-src` policy. |
| 🟠 P1 | Moderation/reporting | BinderDetail has no Report action, `ContentReport.content_type` does not include Binder, and community labels support only post/profile/trade_listing. Harmful, scam or abusive public Binder titles/descriptions/captions lack a first-class reporting/moderation path. | Add Binder to the report/moderation model, authorise evidence submission, support hide/remove decisions, and ensure every public Binder discovery/detail surface consumes moderation state. |
| 🟠 P1 | Enforcement consistency | Public Binder directory/detail access does not visibly apply the account-enforcement state that `getFeedSkeleton` uses when generating feed content. A suspended/shadow-banned collector's Binder can remain directly discoverable unless separately deleted. | Centralise public-content eligibility so Binder directory, detail, activity, feed, sitemap, profile and federation all apply the same AccountStatus/moderation rules. |
| 🟠 P1 | Owner list identity | Binders derives “mine” with `b.did === myDid` rather than immutable `created_by_id`. Because DID is a mutable data field and can also be rewritten by federation/reconciliation, legitimate owner records can disappear from My Binders or spoofed records can be misclassified. | Use authenticated owner ID for local ownership queries and reserve DID for public identity display/federation only. |
| 🟠 P1 | Public search coverage | Global Search searches cards, profiles and posts but not Binders. A public Binder can be indexed by the sitemap yet is not discoverable through SwapPulse's main search experience. | Add a public Binder search endpoint over moderated, visibility-approved fields with cursor pagination and ranking. Do not search service-role private/followers records. |
| 🟠 P1 | Profile Binder consistency | Binder-related profile surfaces use different models and caps: SharedCollectionsTab queries up to 50 public first-class Binders, a theme renderer queries up to 20 Binders, and another profile “Binder” renderer displays CollectionEntry rows directly. These can disagree about what a user's Binder is. | Consolidate profile Binder rendering on the first-class Binder public read model and paginate it. If the legacy showcase remains, label it as a distinct feature instead of “Binder”. |
| 🟠 P1 | Legacy showcase privacy truth | The Collection showcase Binder maintains `binder_public` and `binder_grid_size` with `auth.updateMe`, but those fields are absent from the inspected User schema. Persistence errors are swallowed after optimistic local state changes, so the UI can show “Public” or a grid size that was never stored. | Remove the legacy privacy toggle or define authoritative schema/server mutations with returned state and rollback on failure. Do not display persisted privacy state until the server confirms it. |
| 🟠 P1 | Legacy “Public Binder” semantics | The legacy Collection showcase is built directly from owner-only CollectionEntry rows. There is no audited sanitised public Binder read model tied to `binder_public`, so the toggle does not establish a coherent public sharing contract and must not be implemented by opening raw CollectionEntry reads. | Either retire the legacy public toggle or publish a dedicated sanitised showcase projection containing only deliberate card-facing fields. Keep raw CollectionEntry private. |
| 🟠 P1 | Repository export semantics | `export-repo` includes all owner Binders, including private/followers Binders, under `org.swappulse.binder`, invents `at://` URIs for unbridged records and caps each entity at 1,000 while calling the output AT-compatible/CAR-like. This blurs a private account archive with the public AT repository model. | Separate “private account export” from “actual PDS repository export”, paginate to completion and preserve Binder visibility/local-only status explicitly. Do not fabricate public-repo semantics for private records. |
| 🟠 P1 | Binder mutation API | First-class Binder create/edit occurs directly through the entity SDK. There is no authoritative Binder mutation service that validates owner identity, slot ownership, visibility transitions, counter fields and publication state as one trust boundary. | Introduce server-side create/update/delete procedures. Derive author fields, validate all slots, reject counter writes, enforce visibility transition rules and orchestrate publication from those procedures. |
| 🟠 P1 | Save idempotency / duplicate publication | Binder create has no client/server idempotency key. A retry after an ambiguous successful create can produce duplicate local Binders and duplicate cross-post/standard.site publication work. | Assign a client mutation ID and enforce uniqueness server-side. Publication side effects must use deterministic/idempotent operation keys. |
| 🟠 P1 | Dedicated Binder regression coverage | Source searches found no Binder/getBinder-focused unit, integration or adversarial tests. Critical privacy boundaries are therefore not protected against regression. | Add automated coverage for every P0/P1 invariant, including foreign slots, forged Follow, guest activity, non-public cross-post, privacy downgrade, remote deletion, counter forgery, federated author spoofing and >500/>200 scale. |
| 🟡 P2 | Slot physical-copy clarity | SlotPicker searches primarily by card name and the rendered Binder focuses on artwork/name. Multiple copies of the same card with different condition/variant can be difficult to distinguish when selecting or viewing a showcase. | Show set, condition, variant and an owner-only physical-copy identifier in the picker; decide which of those fields are deliberately public on the Binder. |
| 🟡 P2 | Custom theme | `custom` is offered as a Binder theme but has no controls for defining a custom palette/background. It behaves as another fixed preset rather than a user-defined theme. | Either add validated custom theme controls or rename/remove the option so the UI matches the feature. |
| 🟡 P2 | Drag/reorder documentation | Binder help describes dragging cards within and across pages, but the first-class Binder editor uses click-to-pick slots and has no drag/drop reorder. Drag/drop exists only in the separate legacy Collection showcase. | Implement accessible first-class reorder controls or update help text to the actual interaction. Do not conflate the two Binder models. |
| 🟡 P2 | Cover workflow | First-class Binder cover requires pasting a URL. There is no media picker/upload, crop/preview validation or clear trusted-host guidance. | Use the normal image-upload/media pipeline with preview, dimensions/type limits and an explicit remove/reset action. |
| 🟡 P2 | Author navigation | BinderDetail links the author header to `/profile`, which is the current authenticated user's profile route, instead of the Binder author's public `/profile/:did`. | Link to the returned author's DID/handle public profile and handle missing/deactivated authors safely. |
| 🟡 P2 | SEO metadata | BinderDetail's SEO title reads `data?.binder?.name`, but the Binder object uses `title`, so the detail page falls back to the generic “Pokémon TCG Binder”. `standard_doc_uri` is also omitted from `getBinder`, preventing the intended standard document metadata from reaching `useSEO`. | Use `binder.title` and provide only the safe public publication metadata required for canonical/standard document relations. Add SEO route tests. |
| 🟡 P2 | Page navigation | BinderDetail exposes previous/next arrows only. There is no direct page picker, URL-addressable page, keyboard shortcut or swipe affordance for up to ten pages. | Add accessible page navigation with labelled controls, current-page announcement and optional URL state so a shared Binder can open at a specific page. |
| 🟡 P2 | Card detail visibility | `getBinder` returns condition and variant for resolved slots, but BinderDetail does not surface them. Authors may expect a specific physical variant/condition to be communicated while viewers only see art/name/caption. | Decide the public Binder card projection explicitly and display condition/variant when intended, with privacy controls if those fields are considered owner-only. |
| 🟡 P2 | Empty publication | A first-class Binder can be made public with empty pages/slots. That is allowed by schema and publication policy, creating low-quality/discoverable records and contributing to the Binder Curator population-count flaw. | Define publication minimums separately from draft minimums, e.g. at least one populated slot, and enforce them server-side. Achievement requirements should be stricter. |
| 🟡 P2 | Draft/publish model | Visibility doubles as both privacy setting and publication state; there is no explicit draft workflow. Editing a public Binder changes live content immediately and publication side effects race afterwards. | Add draft/published lifecycle or a review-and-publish action so authors can assemble pages privately and publish one coherent version. |
| 🟡 P2 | Concurrent editing | Binder updates replace the whole nested `pages` array with no revision/version precondition. Two tabs/devices editing the same Binder can silently overwrite each other's page changes. | Add `version`/ETag-style optimistic concurrency and surface conflicts instead of last-write-wins page replacement. |
| 🟡 P2 | Unsaved changes | BinderEdit has no dirty-state navigation warning or draft autosave. A long multi-page layout can be lost by navigation/back/reload before Save. | Track dirty state and prompt on navigation, or implement local/server draft autosave with clear status. |
| 🟡 P2 | Legacy reorder durability | The Collection showcase Binder applies drag reorder optimistically and deliberately ignores persistence errors, so order can revert on the next visit without warning. | Return authoritative bulk-update state, roll back/mark unsaved on failure and provide retry feedback. |
| 🟡 P2 | Localisation consistency | Core first-class page headings are translated, but BinderCard/BinderGrid and several Binder-adjacent strings remain hard-coded in English. | Move all Binder labels, empty states, page/slot copy, visibility text and accessibility labels into the existing i18n catalogue. |
| 🟡 P2 | Social sharing UX | Public Binder pages rely on copied URLs/cross-post automation; BinderDetail has no explicit Share control using SwapPulse's common ShareDialog/device share flow. | Add an intentional public-share action that respects visibility and never offers private/followers Binder URLs as public shares. |
| 🟡 P2 | View analytics | `view_count` is returned and exposed in schema but the audited Binder path never increments it, defines unique-view semantics or protects it from owner mutation. | Either implement privacy-aware server-side view events/aggregates or remove the counter until it has defined semantics. |
| 🟡 P2 | Public directory controls | Discover is a simple newest-first list with no search, theme filter, author filter or sort by engagement/recent activity. | Add server-side discovery controls after engagement/moderation integrity is fixed. Do not rank by current mutable like_count. |
| 🟡 P2 | Standard document publisher source validation | `publish-standard-document` accepts client-supplied Binder title/path/description/text rather than loading the source Binder and proving public visibility/ownership. This does not let a user write another person's PDS, but it allows the standard document to drift or misrepresent the local Binder. | For Binder publishing, accept only Binder ID; load the owner/public Binder server-side and build the standard document from authoritative fields. |
| 🟡 P2 | Standard recommend list scale | `deleteRecommendRecord` lists only 100 recommend records from the user's PDS and does not paginate. A user with more recommendations may be unable to un-recommend an older Binder/document through this helper. | Paginate PDS recommend records to the matching document or use deterministic rkeys/indexed local references. |
| 🟢 P3 | Schema/lexicon terminology drift | Binder source, lexicon and UI use `collection_entry_uri` even though the value is currently a local Base44 ID; comments describe simulated/AT semantics inconsistently. | Rename fields/comments as part of the slot-model migration and document the boundary between local private references and public portable card data. |
| 🟢 P3 | Two Binder architectures | “Binder” refers both to the first-class multi-page entity and to the Collection showcase grid, each with different settings, sharing rules and reorder behaviour. | Consolidate the models or give the showcase a distinct product name and migration path. |
| 🟢 P3 | Audit build verification | The Base44 command sandbox did not expose the app package root (`/workspace/package.json` was absent), so build/lint/typecheck/browser suites could not be rerun in this audit session. | Run release gates from the canonical checkout/CI commit during remediation retest and attach the results to this audit. |

## Feature-by-feature verdict

| Feature | Verdict | Notes |
| --- | --- | --- |
| First-class Binder creation | Unsafe | Useful editor, but author/slot ownership is not server-authoritative and side effects are asynchronous. |
| Binder editing | Needs redesign around publication state | Local edits work; visibility and external publication transitions are not transactional. |
| Pages and six-card slots | Good UI foundation | Ten-page/six-slot model is clear, but exact owner-bound slot validation and scale need fixing. |
| Slot picker | Incomplete at scale | Fixed 500-entry window and limited physical-copy context. |
| Themes | Mostly cosmetic | Fixed themes work; “custom” is not actually custom. |
| Cover image | Unsafe external-source model | Arbitrary remote URLs can track visitors; upload/proxy flow is preferable. |
| Public visibility | Conceptually sound, implementation fragmented | Direct Binder RLS/public policy is good, but activity/cross-post/deletion paths bypass the intended boundary. |
| Followers visibility | Release blocker | Authorisation depends on a spoofable Follow graph. |
| Private visibility | Release blocker | Private metadata can leak through activity and owner's configured cross-posting. |
| Binder detail card resolution | Release blocker | Service-role collection resolver trusts mutable DID and is capped at 500 rows. |
| Public likes | Broken | Visitor updates are blocked by RLS while UI pretends success; counter is not trustworthy. |
| Recommendations | Disconnected and weakly bound | UI read model omits required fields and backend does not bind document/entity/author together. |
| View count | Not implemented authoritatively | Schema/read field exists without a trustworthy event path. |
| Binder deletion | Release blocker | Local deletion can orphan public PDS/standard.site copies. |
| Public→private downgrade | Release blocker | Local privacy is committed before all public copies are verified removed. |
| PDS federation | Strong central gate, weak record model | Only public Binders are eligible, but slots are non-portable local IDs and inbound author identity is trusted from the body. |
| standard.site publishing | Useful interoperability concept | Safe image-fetch allowlist exists; update/delete/source binding is incomplete. |
| Cross-posting | Release blocker | Non-public and foreign Binder metadata can reach external destinations. |
| Public Binder feed/sitemap | Mixed | Sitemap filters public correctly; showcase feed has fixed windows and should avoid fallback URIs for unbridged records. |
| Public activity | Release blocker | Service-role activity exposes non-public Binder metadata. |
| Profile Binder surfaces | Inconsistent | Multiple models and caps produce different Binder experiences. |
| Global search | Missing Binder support | Public Binders are not searchable in the main Search page. |
| Binder Curator achievement | Release blocker | Mutable engagement/page-count proof can grant a credential and Discord Contributor role. |
| Data export | Partial foundation | User-data export includes Binder, but repo-style export conflates private/local records with public AT semantics. |
| Account erasure | Release blocker | Local Binder deletion is not a verified remote deletion workflow. |
| Moderation/reporting | Missing | No Binder content type/report action/label path. |
| Legacy Collection showcase Binder | Architecture debt | Drag/drop works visually, but privacy/settings persistence and relationship to first-class Binder are unclear. |
| Accessibility/mobile | Basic controls present | Needs better page navigation, reorder semantics, localisation and interaction parity. |
| Regression tests | Insufficient | No dedicated automated Binder privacy/integrity suite found. |

## Verified strengths to preserve

The audit also confirmed important controls that should remain:

- Binder entity RLS directly permits public read or owner/admin read; followers/private are not simply opened through the entity read rule.
- `getBinder` has explicit visibility branches before slot rendering. The identity/relationship inputs are flawed, but the intended deny-by-default structure is useful.
- `federationPolicy.ts` publishes/ingests Binder records only when `visibility === 'public'`.
- `atproto-bridge` independently rechecks publication eligibility for create/update and verifies ownership plus PDS repository identity for updates/deletes.
- The scheduled outbound reconciler runs every five minutes and removes a previously bridged Binder from the PDS when it is no longer publication-eligible.
- Admin privacy tooling explicitly audits non-public bridged Binders and standard.site documents and can remediate privacy copies with an explicit confirmation phrase.
- `seo-sitemap` service-role reads Binders with an explicit `visibility:'public'` filter.
- SharedCollectionsTab explicitly requests public Binders for profile sharing.
- standard.site remote cover-image fetching uses an HTTPS host allowlist and rejects redirects, reducing SSRF risk.
- First-class Binder schema constrains page count to 1–10 and six slots per page, providing a clear shape to validate server-side.
- Public Binder standard.site publication in the normal UI is attempted only for public Binders with a description.
- Generic `bridge-record` now derives the canonical collection server-side and checks source ownership, so the dedicated audit did not reproduce the earlier suspicion that omitting a client collection argument alone breaks Binder updates.
- The central privacy architecture correctly keeps raw CollectionEntry records out of public federation; that principle must not be weakened to make public Binders work.

## Remediation order

### Phase 0 — release blockers

1. Replace direct Binder create/update/delete with authoritative backend mutations.
2. Bind Binder author to authenticated `created_by_id`/DID and bind every slot to that owner's CollectionEntry.
3. Make federated Binder authorship derive from repository DID, never record-body `authorDid`.
4. Fix Follow identity binding, then re-test followers-only Binder access.
5. Filter the public activity endpoint so non-public Binders never leak metadata.
6. Require source ownership + public visibility in Binder cross-post dispatch and stop cross-posting non-public Binders.
7. Implement fail-closed public→private/followers transitions covering PDS and standard.site copies.
8. Implement verified remote-delete-first Binder deletion for normal delete, account erasure and moderator deletion.
9. Replace mutable Binder engagement counters with server-maintained event aggregates and repair Binder Curator proof before granting/reconciling achievements or Discord roles.

### Phase 1 — authoritative Binder model

1. Replace `collection_entry_uri` local-ID federation with a private local slot reference plus sanitised portable public card projection.
2. Resolve exact slot IDs rather than scanning 500 CollectionEntry rows.
3. Add collection search/cursors to the editor and Binder cursors to directories/profile surfaces.
4. Separate local visibility from PDS/standard.site publication state and expose reconciliation status.
5. Bind StandardRecommend to the authoritative Binder/document/author relationship.
6. Update standard.site documents on public edits and reconcile them like canonical Binder records.
7. Add idempotency and optimistic concurrency/versioning to Binder mutations.

### Phase 2 — product consolidation and safety

1. Consolidate or rename the legacy Collection showcase Binder.
2. Remove/replace `binder_public` and `binder_grid_size` optimistic settings unless they are given an authoritative schema.
3. Add Binder reporting, moderation and enforcement filtering across every public surface.
4. Route cover media through trusted uploads/proxying.
5. Add public Binder search and reliable public Share controls.
6. Repair author navigation, SEO metadata, recommendation UI and view analytics.

### Phase 3 — UX and scale

1. Add direct page selection, keyboard/swipe support and screen-reader page announcements.
2. Add true custom theme controls or remove the misleading option.
3. Reconcile help text with actual first-class Binder interactions.
4. Add unsaved-change protection/drafts and conflict handling.
5. Complete Binder localisation and improve SlotPicker physical-copy context.
6. Add discovery filters/sorts only after engagement counters are trustworthy.

## Required regression tests

Release should be blocked until automated tests cover at least:

- local user creates Binder with another user's DID
- local user supplies another user's CollectionEntry ID in a slot
- federated attacker record claims victim `authorDid` and supplies victim-like slot IDs
- authenticated attacker forges Follow fields and attempts followers-only Binder access
- unauthenticated `get-activity` request for a DID with private/followers Binders
- private Binder creation with Binder cross-post configuration enabled
- authenticated user invokes crossPostDispatcher with another user's Binder ID
- public→followers/private transition with PDS deletion failure
- public→followers/private transition with standard.site deletion failure
- five-minute reconciler recovery of a non-public bridged Binder
- normal Binder deletion with PDS/standard.site success and each partial-failure combination
- account deletion and moderator force-delete with public Binder copies
- owner attempts to set `like_count`, `view_count` and `recommend_count` directly
- duplicate Like/recommend from the same user
- Binder Curator with five empty pages and forged likes
- Binder Curator with fewer than five genuinely populated pages
- Discord role sync after forged/revoked Binder Curator
- recommendation request where `documentUri` belongs to a different Binder than `entityId`
- recommendation notification with spoofed `authorDid`
- owner collection over 500 entries with a Binder slot referencing an older entry
- owner with over 500 entries using SlotPicker search
- more than 200 public Binders with directory pagination
- unauthenticated `/binders` discovery
- public Binder edit propagates to canonical PDS and standard.site document
- strict Binder lexicon validation of outbound slot records
- arbitrary external Binder cover tracking URL rejected/proxied
- suspended/shadow-banned author Binder excluded from all intended public surfaces
- Binder report/moderation lifecycle
- duplicate/retried Binder create with same idempotency key
- concurrent page edits with version conflict
- legacy showcase privacy-setting persistence failure
- Binder search only returns moderated public records

## Release gate

Binders should remain **NOT RELEASE READY** until every P0 is fixed and adversarially tested. The minimum safe release boundary is:

- immutable, authenticated Binder ownership
- owner-bound slot references
- authoritative follower relationship checks
- no non-public metadata in public activity/cross-post/search/profile surfaces
- fail-closed visibility transitions and deletion across local/PDS/standard.site state
- non-forgeable engagement/achievement evidence
- working guest/public discovery without weakening CollectionEntry privacy
- complete P0/P1 regression evidence from the canonical release checkout

After Phase 0, rerun this dedicated Binder audit before enabling real Binder publication, achievement issuance or external cross-posting at scale.
