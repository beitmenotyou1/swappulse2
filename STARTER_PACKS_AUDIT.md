# SwapPulse Starter Packs Full Feature Audit

**Audit date:** 12 September 2026  
**Scope:** Native Starter Pack creation and authoring, inclusion requests/consent, auto-accept, member search, feed search, Circle selection, public directory/detail/profile surfaces, site-wide newcomer pack, Follow All/bulk apply, notifications, permissions/RLS, moderation and abuse controls, AT Protocol publication, official Bluesky Starter Pack migration/import, deletion/export, privacy, SEO, accessibility/localisation and release verification  
**Overall score:** **12/100**  
**Risk:** **High Risk / Needs Remediation**  
**Release status:** **NOT RELEASE READY**  
**Status:** **In progress - exact release build/test verification unavailable**

| Priority | Area | Finding | Required action |
| --- | --- | --- | --- |
| 🔴 P0 | SP-001 - Starter Pack member consent can be bypassed | `StarterPack.member_dids` is directly writable by the pack owner on create and update. The normal request/accept workflow is therefore optional and a modified client can add any DID straight to the public member list. | Make `member_dids` backend-managed. Derive confirmed members only from an authoritative accepted/auto-accepted membership state. |
| 🔴 P0 | SP-002 - Pack authorship and profile attribution can be spoofed | `StarterPack.did`, `author_name`, `author_handle` and `author_avatar` are owner-writable. Profile packs are queried by `did`, while the bridge accepts source ownership by `created_by_id` and serialises the row DID as `authorDid`. A creator can therefore claim another collector's identity locally and in conflicting custom-record metadata. | Derive all authorship fields server-side from the authenticated identity and use repository provenance as federation authority. |
| 🔴 P0 | SP-003 - Any pack owner can self-designate a site-wide welcome pack | `is_site_wide` is an ordinary owner-updatable field. A normal creator can bypass the admin-only setter and mark their own pack as the Home newcomer pack. | Make site-wide selection admin/backend-only in a separate immutable configuration record. |
| 🔴 P0 | SP-004 - Detail-page Follow All is broken | `StarterPackDetail.followAll()` writes `target_did` instead of required Follow `subject_did`, sets `did` to the target, and swallows each failure. The advertised action can silently follow nobody. | Replace it with one authoritative bulk-follow backend command and add an end-to-end test. |
| 🔴 P0 | SP-005 - Starter Pack bulk join bypasses private Circle rules | Inherited from `CIRCLE_AUDIT.md` CR-003: `follow-starter-pack` service-role appends the caller DID directly to referenced Circles without applying private/invite/approval rules. | Route every join through the authoritative Circle membership service with visibility, invite/approval, ban and capacity checks. |
| 🔴 P0 | SP-006 - Publication bypasses federation opt-out | Inherited from the AT/API audits: immediate `bridge-record` publication does not enforce Do Not Sell or Share at the canonical PDS boundary. The composer invokes it after create. | Enforce outward-federation consent inside every canonical create/update/retry publication path. |
| 🔴 P0 | SP-007 - Account erasure omits Starter Pack data and inclusion references | `delete-account` omits `StarterPack`, `StarterPackRequest` and imported `BlueskyList` rows and does not remove the departing DID from other authors' `member_dids`. | Add authored-pack, request, imported-record, membership-reference and PDS erasure/tombstone handling. |
| 🔴 P0 | SP-008 - Live AT/PDS dependency is unhealthy | Live `AtprotoAccountHealth` on 12 September 2026 shows all three monitored identities with credential/profile/handle/repository health false. Starter Pack publication/import is therefore not production-proven. | Keep federation claims blocked until health is restored and real create/update/delete/import round trips pass. |
| 🟠 P1 | SP-009 - Composer reads identity from the wrong user shape | `StarterPackComposer` uses only `user.data?.did`, `user.data?.bsky_handle` and `user.data?.avatar_url`, while current User fields and audit-visible User rows expose canonical values at top level and AuthContext stores `auth.me()` directly. This can create DID-less packs and break author/request/profile logic. | Use one canonical user-identity accessor, reject creation without a verified DID and test the real auth object shape. |
| 🟠 P1 | SP-010 - Five-pack author limit is browser-only | The five-pack limit is checked only in the composer before a direct entity create. Direct/concurrent writes can exceed it. | Enforce the limit atomically in a backend create command. |
| 🟠 P1 | SP-011 - Requester can directly rewrite request status | `StarterPackRequest.update` permits requester and target DIDs, so the author can alter status/responded_at outside the target response command. | Make status backend-only; give authors a separate cancel command and targets accept/deny authority only. |
| 🟠 P1 | SP-012 - External Bluesky actors cannot complete native consent | Member search includes wider AT actors, but the request/accept flow is local Base44 state. External actors without SwapPulse accounts cannot respond. | Restrict native inclusion to local accounts or design an interoperable consent mechanism. |
| 🟠 P1 | SP-013 - Confirmed members cannot withdraw themselves | Accepted/auto-accepted collectors have no leave/self-removal command. | Add target-authorised withdrawal that updates public/federated membership promptly. |
| 🟠 P1 | SP-014 - Request target display metadata is caller-supplied | `add-starter-pack-member` stores target name/handle/avatar supplied by the author rather than resolving them from the target DID. | Resolve display identity server-side and use DID as authority. |
| 🟠 P1 | SP-015 - Full packs can mark requests accepted without adding the member | Acceptance appends then `.slice(0,100)`. At capacity, status can become accepted while the target is truncated out. | Enforce capacity before transition or use atomic membership records with a hard limit. |
| 🟠 P1 | SP-016 - Concurrent acceptances can lose members | The response function read-modify-writes the full `member_dids` array, so simultaneous accepts can overwrite each other. | Use atomic membership records/set-add operations and concurrency tests. |
| 🟠 P1 | SP-017 - No block/mute enforcement | Inclusion requests, pack membership, search and bulk follow do not consult a user block/mute authority. | Integrate the platform-wide block/mute service in both directions. |
| 🟠 P1 | SP-018 - Starter Pack actions bypass bot/rate protection | Creation is a direct entity write and request/apply functions do not use `botGuard`, despite follow limits already existing. | Backend-mediate create/update/request/apply and apply rate/bot policy. |
| 🟠 P1 | SP-019 - Enforcement state is not checked | Suspended/shadow-banned users are not blocked from core Starter Pack create/request/respond/apply paths. | Apply AccountStatus checks to every write/action and public discovery projection. |
| 🟠 P1 | SP-020 - Bulk follow creates local-only graph edges | `follow-starter-pack` directly creates local Follow rows and does not bridge `app.bsky.graph.follow` or use the shared follow service. | Use the single authoritative follow service with durable PDS sync/retries. |
| 🟠 P1 | SP-021 - Bulk apply success counts can be false | Follow/Circle mutation errors are caught but `followed`/`joined` counters are still incremented. | Return per-item results and count only confirmed mutations. |
| 🟠 P1 | SP-022 - Bulk Circle join creates inconsistent membership state | Inherited CR-041: the pack path edits only `member_dids`/`member_count`, omitting member profiles, CircleExit cleanup and normal lifecycle effects. | Delete the duplicate membership implementation and call the common join transaction. |
| 🟠 P1 | SP-023 - Public packs can expose non-public Circle references | Inherited CR-031: the picker can include author-readable private/member-only Circles and publication has no public-reference validator. | Permit only public/discoverable Circle references in public packs. |
| 🟠 P1 | SP-024 - Circle deletion leaves pack references orphaned | Inherited CR-036: deleting a Circle does not reconcile `StarterPack.circle_ids`. | Add dependency-aware cleanup and federation refresh. |
| 🟠 P1 | SP-025 - Member-request failures are hidden | Composer catches each `add-starter-pack-member` error and still reports the pack published. | Return a batch result and show failed targets explicitly. |
| 🟠 P1 | SP-026 - Federation publish failure is hidden | Composer fire-and-forgets `bridge-record`, swallows errors and still announces publication. | Persist explicit federation state/outbox and show failed/pending publication. |
| 🟠 P1 | SP-027 - Native member limit conflicts with custom lexicon | App/entity/UI allow 100 members while `org.swappulse.starterPack` caps `memberDids` at 50. | Choose one limit and enforce it across schema, backend, UI, docs and lexicon. |
| 🟠 P1 | SP-028 - Local IDs make important pack content non-portable | Circle, featured Binder and featured Journal references are Base44-local IDs yet are serialised into the custom federated record. | Federate stable AT/global references and keep local IDs local-only. |
| 🟠 P1 | SP-029 - Official Bluesky Starter Pack mapper is incompatible with current lexicon | Current `app.bsky.graph.starterpack` requires a `list` AT URI and optional feeds, but `mapBskyStarterPackFields` reads `val.listItems`. | Resolve the required list, hydrate list items and preserve official feed refs. |
| 🟠 P1 | SP-030 - Bluesky starter-pack backfill does not paginate starter packs | `backfill-lists` applies a cursor to normal lists only; starter-pack fetching always takes the first page and completion is driven by the list cursor. | Keep independent cursors/completeness for each collection. |
| 🟠 P1 | SP-031 - Imported Bluesky Starter Packs are not surfaced | Official packs are stored as `BlueskyList`, but no Starter Pack UI reads `BlueskyList`. Migration can report success while users cannot use the imported packs. | Add an imported-pack surface or stop claiming they are a usable migrated feature. |
| 🟠 P1 | SP-032 - Official Bluesky feed recommendations are discarded on import | `mapBskyStarterPackFields` does not preserve the official record's `feeds` array. | Preserve/render official feed refs according to the current schema. |
| 🟠 P1 | SP-033 - Native feed display names do not round-trip | Local `feed_names` is not part of the native custom lexicon/import path, so federated packs can lose labels. | Resolve metadata from URI or use an interoperable metadata representation. |
| 🟠 P1 | SP-034 - Pack references lack authoritative validation | Member DIDs/feed URIs/local references are plain owner-writable strings and are not comprehensively validated before publication. | Canonicalise, deduplicate and validate every reference server-side. |
| 🟠 P1 | SP-035 - Arbitrary cover URLs can track viewers | Owner-writable `cover_image_url` is rendered directly in public `<img>` tags with no managed-upload/proxy restriction found. | Require managed uploads or privacy-preserving proxy/allowlist controls and strict URL/CSP/referrer policy. |
| 🟠 P1 | SP-036 - Auto-accept preference contract is inconsistent | UI/backend read `data.auto_accept_starter_pack`, but current User schema has no explicit field and canonical User properties are top-level. | Add an explicit owner-scoped boolean setting and one backend accessor. |
| 🟠 P1 | SP-037 - Response notifications bypass master pause before in-app creation | Inherited NF-011: response flow creates the author's Notification before central dispatcher filtering. | Gate in-app and push through one policy check before any Notification write. |
| 🟠 P1 | SP-038 - Starter Pack notifications are not localised | Inherited i18n audit: request/accept/deny notification text is constructed as English backend strings. | Emit stable message keys/params and localise for recipient locale. |
| 🟠 P1 | SP-039 - GDPR/CCPA export omits Starter Pack data | `export-my-data` omits StarterPack, StarterPackRequest, imported BlueskyList starter packs and the auto-accept preference. | Include all relevant authored/participating/imported/preference data in exports. |
| 🟠 P1 | SP-040 - Starter Packs cannot be reported | `ContentReport.content_type` does not include Starter Pack and no report control exists on pack surfaces. | Add Starter Pack reporting and moderator takedown/enforcement support. |
| 🟠 P1 | SP-041 - Local deletion has no guaranteed PDS deletion path | Owner RLS permits direct pack deletion without a Starter Pack lifecycle command that durably tombstones the federated record. | Delete through a backend command with PDS tombstone/outbox reconciliation before local source removal. |
| 🟠 P1 | SP-042 - Site-wide selection is not atomic | Admin setter clears current flags before validating/updating the new pack. A stale ID/failure can leave no site-wide pack. | Validate first and change one config reference atomically. |
| 🟠 P1 | SP-043 - Dedicated security/regression tests were not found | No dedicated Starter Pack suite was found for consent, site-wide privilege, bulk apply, races, federation consent, official import, erasure/export or malformed references. | Add unit/integration/adversarial tests and run them in canonical CI. |
| 🟡 P2 | SP-044 - No native edit/delete management UI | Authors can create packs but have no normal edit/delete/remove-member/request-management surface. | Add author management backed by authoritative lifecycle commands. |
| 🟡 P2 | SP-045 - Cover/featured-content features cannot be authored in composer | Schema/detail support cover, featured Binder and featured Journal, but composer has no controls for them. | Add validated controls or remove the fields/claims until supported. |
| 🟡 P2 | SP-046 - Pinned feeds are display-only | Detail renders feed names/URIs but offers no open/preview/subscribe/pin action. | Add resolved feed metadata and explicit subscribe/pin/open controls. |
| 🟡 P2 | SP-047 - Native and site-wide apply behaviour is inconsistent | Home site-wide action follows and joins Circles, while normal detail exposes only Follow All. | Define and reuse one consistent pack-apply contract with pre-action preview. |
| 🟡 P2 | SP-048 - Member presentation is raw DID-centric and misleading | Members are largely rendered as shortened DIDs and anyone not followed in the current component session is labelled external. | Hydrate canonical actor/local-membership/follow state server-side. |
| 🟡 P2 | SP-049 - Existing follow state is not loaded | Detail `followed` starts empty and only reflects the current Follow All attempt. | Batch-return authoritative current follow state. |
| 🟡 P2 | SP-050 - Discovery lacks search/ranking/sort | Directory has category chips and newest-first only. | Add server-side search/filter/sort with moderation/enforcement filtering. |
| 🟡 P2 | SP-051 - Directory capped at 50 with no pagination | `StarterPacks.jsx` retrieves max 50. | Add cursor pagination. |
| 🟡 P2 | SP-052 - Profile packs capped at 10 | `ProfileStarterPacks` returns ten with no continuation. | Paginate or link to author-filtered directory. |
| 🟡 P2 | SP-053 - Admin chooser capped at newest 50 | Older valid packs cannot be selected in the UI. | Add admin search/pagination and safety state. |
| 🟡 P2 | SP-054 - Circle picker is capped/client-filtered | It loads newest 200 readable Circles and searches in browser. | Use paginated server-side public/discoverable search. |
| 🟡 P2 | SP-055 - Member/feed search lacks resilient upstream handling | Raw AppView calls have no explicit timeout/backoff/429 UX and failures can look like empty results. | Add bounded timeouts, retry policy and explicit degraded/error state. |
| 🟡 P2 | SP-056 - Requests have no expiry/cancel/resend lifecycle | Pending requests can live indefinitely and author controls are read-only. | Define expiry and cancellation/resend. |
| 🟡 P2 | SP-057 - Request can resolve after pack disappeared | Response can mark an orphaned request accepted/denied even if pack no longer exists. | Cancel orphaned requests and reject responses to missing/archived packs. |
| 🟡 P2 | SP-058 - Subscriber count is not authoritative | `subscriber_count` is displayed, no subscription/install model was found, and owner can edit the field. | Remove it or compute it from a real backend-owned model. |
| 🟡 P2 | SP-059 - Starter Pack UI is largely English-only | Only nav label is translated; detailed feature strings are hard-coded English. | Move all feature text to i18n and test all supported locales. |
| 🟡 P2 | SP-060 - Composer/search accessibility incomplete | Dialog lacks full shared focus semantics and custom suggestion lists lack proper combobox/listbox keyboard behaviour. | Use shared accessible Dialog/Combobox primitives and keyboard/screen-reader tests. |
| 🟡 P2 | SP-061 - Starter Pack pages absent from sitemap | `seo-sitemap` omits `/starter-packs` and dynamic pack detail URLs. | Add valid public Starter Pack URLs to sitemap. |
| 🟡 P2 | SP-062 - Detail social metadata is generic | Pack detail uses generic description/default OG image instead of validated pack description/cover/author. | Use pack-specific share metadata and structured data where appropriate. |
| 🟢 P3 | SP-063 - Site-wide pack cannot be unset in admin UI | Backend accepts null selection but UI provides no remove action. | Add explicit remove-site-wide action with confirmation. |
| 🟢 P3 | SP-064 - Category labels are raw enum values | UI renders raw lowercase category IDs. | Map stable IDs to localised display labels. |
| 🟢 P3 | SP-065 - Help copy overstates portability/actionability | Help describes whole-bundle portability and one-tap onboarding while local IDs, official imports and normal-detail behaviour do not support those claims. | Align docs with deployed behaviour during remediation. |
| 🟢 P3 | SP-066 - Exact release build/lint/typecheck could not be rerun | Base44 command sandbox exposed no canonical application package checkout/package manifest. | Run build, lint, typecheck and Starter Pack suite against exact release commit in canonical CI. |

## Executive summary

Starter Packs are **not release ready** as a trusted onboarding/social-graph feature. The core issue is authority: the browser can write fields that should represent consent, authorship and admin trust. `member_dids` bypasses the normal inclusion request workflow, author DID/display metadata can be forged, and `is_site_wide` lets a normal creator bypass the admin setter and place their own bundle in the newcomer Home experience.

The normal detail-page Follow All action is also malformed and silently fails. The separate Home bulk-apply backend follows people only in the local database, bypasses the shared bridged-follow/bot/enforcement path, directly mutates Circle membership, bypasses private-Circle rules and can over-report successes.

Federation is incomplete. Immediate publication inherits the canonical federation-consent defect; local 100-member behaviour conflicts with the 50-member custom lexicon; several references are local Base44 IDs; and the official Bluesky importer does not follow the current `app.bsky.graph.starterpack` structure.

Current official Bluesky starter-pack records require `name`, `list` and `createdAt`; `list` is an AT URI to the underlying actor list, and optional `feeds` contains at most three feed URI items. SwapPulse currently reads a nonexistent `listItems` field and does not preserve official feeds.

Account deletion/export, member withdrawal, moderation/reporting, localisation and lifecycle management are also incomplete.

Audit-visible data contained **0 StarterPack rows, 0 StarterPackRequest rows and 0 BlueskyList rows with `list_type:starterpack`**. This is audit-session visibility only and does not prove production can never contain such rows. It is favourable remediation timing because the data model can be corrected before a large pack-membership corpus accumulates.

The required Base44 README returned HTTP 403. Connected source/schema/data APIs remained available. The Base44 command sandbox exposed `/workspace/CIRCLE_AUDIT.md` but no canonical application package checkout, so exact-release build/lint/typecheck/tests were not rerun.

No Starter Pack, request, user, Follow, Circle or production data was changed during this audit.

## Verified strengths to preserve

- Normal `add-starter-pack-member` checks authenticated author DID.
- Normal `respond-starter-pack-request` checks authenticated target DID.
- Pending targets are not promoted by the normal path before acceptance.
- Request notification creation checks the central notification filter.
- The explicit site-wide setter itself is admin-gated.
- Member/feed discovery runs server-side rather than exposing privileged credentials.
- `bridge-record` derives the canonical collection and verifies source ownership.
- `outbound-reconcile` checks Do Not Sell/Share, even though immediate publication needs the same canonical protection.
- Main pack text is rendered as text rather than raw HTML/Markdown.
- Audit-visible pack datasets are currently empty, reducing migration risk.

## Recommended target architecture

1. Make StarterPack a backend-owned aggregate. Browser code must not write authorship, members, site-wide state or subscriber counts directly.
2. Store inclusion as separate server-authoritative membership/request records with states `pending -> accepted | denied | cancelled | withdrawn | removed`.
3. Derive any public member projection from accepted state only.
4. Apply packs through the exact same authoritative Follow and Circle membership services used by individual actions.
5. Store site-wide selection in one admin-owned config record.
6. Enforce federation consent and reference/lexicon validation at the canonical PDS boundary.
7. Deliberately distinguish the richer native SwapPulse pack format from official Bluesky `app.bsky.graph.starterpack`, or implement the official list-based model correctly.
8. Complete deletion, withdrawal, export, moderation, localisation, accessibility and adversarial tests.

## Release decision

**Do not release Starter Packs while SP-001 through SP-008 remain unresolved.**

Remediation order:

**lock sensitive fields -> backend-mediate creation/update -> repair consent/membership -> move site-wide authority -> reuse Follow/Circle services -> add block/bot/enforcement -> repair erasure/export -> enforce federation consent -> fix native/official AT models -> complete UI/lifecycle/localisation -> run exact-release regression gates.**

## External protocol reference

Current official lexicon:

`https://github.com/bluesky-social/atproto/blob/main/lexicons/app/bsky/graph/starterpack.json`
