# SwapPulse Meetups Full Feature Audit

**Audit date:** 12 September 2026  
**Scope:** Meetup creation, organiser identity, scheduling, venue/location handling, discovery, detail views, RSVP lifecycle, attendee privacy, vouch gating, capacity, cancellation/edit/deletion, moderation, notifications, Circle integration, pre-meetup trade matching, profiles/activity, achievements/Discord roles, AI recommendations, AT Protocol federation/import/export, data rights, SEO, accessibility/localisation and release verification  
**Overall score:** **16/100**  
**Risk:** **High Risk / Needs Remediation**  
**Release status:** **NOT RELEASE READY**  
**Status:** **Complete with residual verification actions**

| Priority | Area | Finding | Required action |
| --- | --- | --- | --- |
| 🔴 P0 | MT-001 - Public RSVP activity bypasses attendee privacy | `get-activity` is a public, unauthenticated service-role endpoint. For any supplied DID it reads `MeetupRsvp` and emits “RSVP’d to a meetup” with a `/meetups/:id` link. This bypasses MeetupRsvp owner/admin RLS and the `getMeetup` vouch gate, allowing a guest who knows a DID to discover a collector’s planned or past association with an in-person event and then read the public event venue/time. | Remove MeetupRsvp from the public activity projection unless the subject has explicitly opted into public attendance. Use a viewer-authorised activity service, never service-role RSVP reads for guests. Treat in-person attendance/location linkage as sensitive and add guest/vouch/privacy regression tests. |
| 🔴 P0 | MT-002 - Vouch-gated attendee list is forgeable | `getMeetup` decides whether a viewer can see the attendee list by counting raw `Vouch` rows with `vouched_did === user.did`. It does not require distinct active vouchers, exclude revoked vouches, verify voucher trust, or bind vouch authorship strongly enough. The Vouch model is caller-creatable, so a viewer can manufacture enough rows to satisfy `required_vouches` and expose attendee identities. | Do not use raw Vouch row count as an access-control credential. Build a server-authoritative trust resolver using distinct authenticated vouchers, revocation state, trust requirements and anti-duplication. Add forged, duplicate, revoked and self-vouch tests before relying on vouches for real-world attendance privacy. |
| 🔴 P0 | MT-003 - Meetup achievements and Discord roles are forgeable | `Community Voice` counts RSVP rows rather than distinct verified attendees and accepts a Meetup whose owner-controlled `status` is `completed` with owner-controlled duration. MeetupRsvp permits duplicate direct creates. An organiser can therefore create five duplicate yes-RSVPs and mark the event completed to satisfy the achievement. Because organiser DID fields are also caller-controlled, malicious records can poison another DID’s achievement evidence. Discord grants `Event Organiser` for any completed Meetup by `creator_did` or the Community Voice achievement. | Make event proof derive from immutable organiser identity, validated lifecycle timestamps and distinct authenticated attendees. Lock status/duration/organiser evidence behind backend transitions. Recalculate and revoke any forged Community Voice credentials and Discord roles, then add duplicate-attendee, victim-DID and fake-completion tests. |
| 🔴 P0 | MT-004 - Repository import can publish private RSVP data | `org.swappulse.meetupRsvp` is explicitly in `NEVER_FEDERATE`, and normal `atproto-bridge` publication correctly rejects it. `import-repo`, however, accepts archive collections and writes them directly with `com.atproto.repo.createRecord` without calling `isPublicationEligible` or checking the never-federate set. A crafted archive can therefore place attendee identity, binder intent and card-wanted data into a public PDS. | Apply the canonical federation policy and a strict collection allowlist before every import write. Reject MeetupRsvp and every never-federate collection before touching the PDS. Add crafted-archive tests proving RSVP records cannot cross the public repository boundary. |
| 🔴 P0 | MT-005 - Meetup publication bypasses federation consent | Inherited from the AT Protocol audit: `outbound-reconcile` honours the outward sharing/Do Not Sell preference, but canonical publication through `atproto-bridge` does not enforce it itself. Meetup creation calls that canonical bridge directly, so a public real-world event record containing time and venue can be published even when the user’s federation opt-out should block outward publication. | Move outward-publication consent enforcement into the canonical PDS write boundary used by create, update, retry, reconcile and import. Fail closed before Meetup publication after opt-out or consent withdrawal and test every write path. |
| 🔴 P0 | MT-006 - Account deletion does not prove public Meetup removal | Inherited from the AT Protocol account-erasure finding: `delete-account` removes local Meetup/MeetupRsvp rows but only attempts a PDS moderation-label tombstone. It does not delete/deactivate the repository or verify deletion of the user’s public `org.swappulse.meetup` records. Event location/time records can therefore remain network-visible after the SwapPulse account is deleted. | Define explicit self-sovereign deletion/disconnect choices. For SwapPulse-managed PDS accounts, strongly authenticate and delete/deactivate the account or delete all managed records, revoke credentials and verify the public post-condition before completing local erasure. |
| 🔴 P0 | MT-007 - AI Meetup recommendation prompt-injection/exfiltration boundary | The Networking Concierge reads user-controlled Meetup title, description, region and location data and renders model output through unrestricted `ReactMarkdown`. This inherits the project’s indirect-prompt-injection problem: hostile Meetup text can steer the model to reveal tool-visible social/location data or emit external Markdown resources/links that the browser may fetch. | Apply the shared untrusted-data agent policy to every Meetup field, minimise tool inputs, disable remote images/media in rendered Markdown, sanitise/confirm external links and regression-test malicious Meetup descriptions that attempt to exfiltrate other tool data. |
| 🔴 P0 | MT-008 - Live AT federation is currently unavailable | Live `AtprotoAccountHealth` checked during this audit on 12 September 2026 shows all three monitored identities with `credential_valid:false`, `profile_resolves:false`, `handle_resolves:false` and `repo_reachable:false`. Meetup creation persists locally and attempts federation asynchronously, so the advertised portable/discoverable AT record cannot currently be relied on in production. | Keep Meetup federation release-blocked until real accounts pass DID/handle/profile/repository health plus fresh Meetup create/read/update/delete and ingestion verification. Reconcile failed/unbridged records only after the underlying PDS/session issue is fixed. |
| 🟠 P1 | MT-009 - RSVP attendee identity is caller-controlled | MeetupDetail creates MeetupRsvp directly from the browser. Entity RLS binds only `created_by_id`, while `did`, attendee name/handle/avatar, meetup ID/reference and attendance fields remain caller supplied. A collector can create an owned row claiming another DID is attending or looking for cards. | Create/update RSVP only through an authenticated backend endpoint that derives attendee DID/profile and canonical Meetup identity server-side. Make provenance fields immutable to ordinary clients. |
| 🟠 P1 | MT-010 - Multiple RSVPs per person/event are allowed | There is no uniqueness constraint or backend deduplication on MeetupRsvp. One account can create multiple RSVP rows for the same Meetup. `getMeetup` chooses `myRsvps[0]`, leaving duplicate rows active and counted. | Enforce one authoritative RSVP per `(meetup_id, user_id/DID)` and use idempotent upsert semantics. Reconcile historical duplicates before calculating capacity, attendance or achievements. |
| 🟠 P1 | MT-011 - Meetup capacity is not enforced | `capacity` is displayed and schema-bounded, but RSVP creation never checks whether the event is full. Duplicate rows and concurrent users can exceed capacity with no waiting-list or rejection path. | Enforce capacity atomically inside the RSVP transaction using distinct active yes-RSVPs. Return a clear full/waitlist result and concurrency-test the last available place. |
| 🟠 P1 | MT-012 - First RSVP can partially commit then appear to fail | After creating a new MeetupRsvp, MeetupDetail calls `Meetup.update()` to increment `rsvp_count`. A normal attendee does not have update permission on the organiser’s Meetup row, so that step can fail after the RSVP has already been persisted. The catch is silent and skips the reload, leaving the user unsure whether the RSVP succeeded. | Move RSVP creation and count maintenance to one backend transaction. Never require an attendee to update the organiser’s Meetup row. Surface deterministic success/error feedback and make retries idempotent. |
| 🟠 P1 | MT-013 - `rsvp_count` is not trustworthy | `rsvp_count` is a separately stored, organiser-editable field. The client increments it only for a first RSVP and regardless of yes/maybe/no, does not decrement it when attendance changes, and the update normally fails for non-organisers. Directory cards therefore show a stale/manipulable number unrelated to actual yes attendance. | Remove client-maintained `rsvp_count`. Derive it server-side from authoritative distinct active RSVPs or maintain it transactionally as a protected projection. |
| 🟠 P1 | MT-014 - Attendee/count calculations silently cap at 50 rows | `getMeetup` service-role loads only the newest 50 MeetupRsvp rows and calculates yes/maybe counts from that subset. Duplicate records can exceed 50 and organisers can lose visibility of older responses, producing incorrect counts and incomplete attendee lists. | Query authoritative RSVP state with cursor pagination or aggregate counts server-side. Never calculate event capacity/attendance from a fixed newest-row window. |
| 🟠 P1 | MT-015 - Attendee response overexposes RSVP fields | When the vouch gate passes, `getMeetup` returns full MeetupRsvp rows even though the UI only needs a small display projection. This exposes DID, handle, `looking_for_cards`, internal/federation metadata and other fields to every qualified viewer. | Return a minimised attendee DTO. Expose only fields explicitly required for the attendee list, and keep trade-wanted data private unless a separate consented matching feature needs it. |
| 🟠 P1 | MT-016 - “Can’t make it” responders are exposed as attendees | The attendee list returns and renders every RSVP, including `attending:'no'`. A vouch-qualified non-organiser can therefore see people who explicitly said they are not attending, creating unnecessary association disclosure. | Show yes/maybe attendees only to ordinary qualified viewers. Keep no/withdrawn responses private to the subject and organiser where operationally needed. |
| 🟠 P1 | MT-017 - “Vouch-gated Meetup” product claim overstates the control | SwapPulse labels Meetups as “Vouch-gated local collector meetups”, but `required_vouches` gates only the attendee list. Venue, region, scheduled time and description are open-read, and any authenticated user can RSVP regardless of vouch count. | Rename the feature to accurately describe attendee-list gating, or implement a real trust-gated event mode covering detail visibility and/or RSVP eligibility. Avoid implying stronger personal-safety protection than the backend enforces. |
| 🟠 P1 | MT-018 - Public Meetup route requires authentication | `/meetups` is publicly readable, its cards link to `/meetups/:id`, and the sitemap can emit Meetup detail URLs. `getMeetup`, however, requires authentication. Signed-out visitors are shown the generic “Meetup not found” state rather than a public-safe detail page or a sign-in requirement. | Either provide a public-safe Meetup detail projection with no RSVP/private data, or require authentication consistently and remove guest/sitemap promises for inaccessible detail routes. |
| 🟠 P1 | MT-019 - No first-class RSVP withdrawal/deletion | The UI lets a collector switch to “Can’t make it” but provides no way to withdraw/delete the RSVP record. Their association remains stored, can remain in public activity, and continues to exist until separate account/data-rights actions. | Add a clear Withdraw RSVP action backed by the authoritative RSVP service. Remove or tombstone the association according to retention policy and update activity/counts immediately. |
| 🟠 P1 | MT-020 - Meetup creation lacks abuse/enforcement controls | Meetup creation is a direct entity write. It does not run account enforcement, bot risk, rate limiting or server-side content moderation before an event becomes publicly discoverable and potentially federated. One account can spam fake venues/events or harmful descriptions. | Move Meetup creation/update into a backend command that checks account status, bot/rate limits, moderation policy and idempotency before publication. |
| 🟠 P1 | MT-021 - Organiser identity/provenance fields are mutable | The Meetup entity lets the creator update `did`, `creator_did`, author metadata, `at_uri`, `cid`, `bridged`, signature-like fields and content hash. Those fields feed organiser checks, federation, Discord roles and achievements. | Separate editable event content from backend-owned organiser/federation provenance. Derive organiser identity from the session and make system fields immutable. |
| 🟠 P1 | MT-022 - Federated organiser DID can impersonate another identity | `mapMeetupFields()` prefers remote `organiserDid` over the repository DID. A remote repo can therefore publish a Meetup claiming another DID as organiser, and local code later treats that embedded DID as organiser identity and achievement/Discord evidence. | Derive organiser identity from the repository DID. Reject or quarantine a Meetup whose embedded organiser DID conflicts with the publishing repository. |
| 🟠 P1 | MT-023 - Event lifecycle transitions are unauthoritative | A Meetup owner can directly set any allowed status, including `ongoing` or `completed`, without schedule/time checks, participant evidence or transition rules. This affects discovery, credentials and Discord roles. | Implement backend state transitions with a valid state machine, actor checks, timestamps and evidence. Do not let ordinary entity updates set lifecycle status. |
| 🟠 P1 | MT-024 - No edit/reschedule/archive/delete lifecycle UI | Organisers can create and cancel, but no normal UI was found for correcting a venue, changing time/capacity/vouch requirement, rescheduling, archiving, transferring management or safely deleting an event. | Add an audited organiser lifecycle workflow with edit/reschedule/archive/delete controls and clear treatment of existing RSVPs and federated copies. |
| 🟠 P1 | MT-025 - Cancellation/reschedule does not notify attendees | Cancelling a Meetup updates the row but no backend notification is sent to RSVP’d users. There is no reschedule workflow at all. For an in-person event, stale time/location information can cause real-world inconvenience or safety issues. | Notify all affected active RSVPs on cancellation, material venue/time changes and organiser transfer. Use the central notification dispatcher and retain an auditable delivery result. |
| 🟠 P1 | MT-026 - Meetup notification setting does not map to a real event type | Inherited from the Notifications audit: Settings exposes `meetup_announcement`, but the Notification schema/event producers do not define that canonical type. The visible Meetup toggle therefore cannot reliably control actual Meetup notifications. | Define one shared notification event enum and add tested Meetup announcement/cancellation/reschedule/reminder event types used consistently by schema, UI, dispatcher and producers. |
| 🟠 P1 | MT-027 - Meetups cannot be reported through standard moderation | `ContentReport.content_type` does not include Meetup and MeetupDetail has no Report action. Fake events, harassment, unsafe venue claims, impersonation or scam meetups cannot enter the standard moderation queue. | Add Meetup as a reportable subject with backend visibility/existence validation, reporter privacy, evidence support and moderator actions for event takedown/organiser enforcement. |
| 🟠 P1 | MT-028 - Cancellation can drift from the public PDS | Cancellation is committed locally first and the PDS update is fire-and-forget with errors swallowed. A failed update can leave the public federated event advertising a scheduled meetup after SwapPulse shows it cancelled until a later reconciliation succeeds. | Use a durable federation state/outbox for safety-critical event changes. Persist pending/failed sync, retry with bounded backoff, expose status to the organiser and verify the public copy after cancellation. |
| 🟠 P1 | MT-029 - Direct Meetup deletion can orphan PDS and RSVP state | Meetup RLS allows the owner to delete the local row directly. There is no central delete-remote-first Meetup transaction that removes/tombstones the PDS record and reconciles dependent RSVPs before local deletion. | Replace direct delete with a backend archive/delete service that resolves dependent RSVPs, removes the public PDS record, verifies the result and only then retires the local source. |
| 🟠 P1 | MT-030 - Organiser account deletion leaves other users’ RSVP rows orphaned | `delete-account` deletes the organiser’s Meetup rows and the organiser’s own MeetupRsvp rows, but it does not delete RSVP rows created by other users that reference the deleted Meetup. Those attendance associations can survive with a dead `meetup_id`. | During Meetup deletion/account erasure, enumerate dependent RSVP rows by `meetup_id` and delete/tombstone them according to retention policy, with participant notification where appropriate. |
| 🟠 P1 | MT-031 - RSVP schema/UI still claim public federation despite privacy policy | The MeetupRsvp entity and Lexicon describe RSVPs as mirrored/portable AT records, and the UI still calls legacy RSVP bridge helpers. The central policy correctly says MeetupRsvp must never federate, so the product contains contradictory privacy contracts. | Remove RSVP bridge calls and public-portability wording. Mark RSVP as local/private in schema/help/code until a separate explicit public-attendance protocol is designed. |
| 🟠 P1 | MT-032 - RSVP depends on a Meetup AT URI that may not exist | `MeetupRsvp.meetup_ref` is required and described as a strongRef AT URI, but Meetup publication is asynchronous and currently unhealthy. A user can open a newly created or unbridged Meetup and attempt an RSVP while `m.at_uri` is empty. | Use the immutable local Meetup ID as the application authority. Make the AT reference optional metadata populated only when a public Meetup is successfully federated. |
| 🟠 P1 | MT-033 - All Meetups are effectively public with no publication choice | Meetup has no visibility field and normal creation immediately attempts public PDS federation. The event includes date/time, venue, region and optional coordinates, yet the creation flow gives no explicit public-network disclosure or unlisted/private event option. | Add a clear publication/privacy choice and an explicit warning that federated Meetup data is public. If private/unlisted events are supported, keep them local and exclude them from PDS, sitemap, AI discovery and public feeds. |
| 🟠 P1 | MT-034 - Venue/location safety is not enforced | `location_name` is open-read and federated. Although the schema comment says “not precise address”, neither frontend nor backend prevents a home address or other sensitive exact location from being entered; lat/lng are also available fields. | Provide safe-location guidance, prefer public venue names/coarse regions, validate/granularise coordinates, and require explicit confirmation before publishing exact real-world location data. |
| 🟠 P1 | MT-035 - Circle-scoped Meetups are documented but not implemented | Circle help and Meetup help say events can be scoped to a Circle, but Meetup has no `circle_id`/`circle_ref`/scope field and CircleDetail has no Meetup integration. | Remove the claim or add a server-authorised Circle Meetup scope using the authoritative Circle membership service. Private Circle events must not require public AT publication. |
| 🟠 P1 | MT-036 - Promised map/nearby discovery is not implemented | Help and Privacy documentation say Meetups appear on a Leaflet/OpenStreetMap map with pan/zoom and markers. The actual Meetups page is a simple newest/upcoming list and Create Meetup does not geocode or set coordinates. Leaflet is installed but unused for Meetups. | Implement the documented map/nearby experience with privacy-safe coarse geocoding, or remove the map/nearby claims and the unused dependency until it exists. |
| 🟠 P1 | MT-037 - Promised pre-meetup trade matching is not implemented | Onboarding email copy says Meetups are trust-gated and provide pre-meetup trade matching with attendees who have wanted cards. The RSVP form captures `looking_for_cards`, but no matching service or attendee trade-matching UI was found. | Remove the promise or implement a consented, privacy-minimised matching service that never exposes attendees/wants outside the authorised event audience. |
| 🟠 P1 | MT-038 - Global Search omits Meetups | The global Search page searches cards, collectors and federated posts only. Meetups cannot be found by title, venue or region outside the fixed Meetups page/AI suggestions. | Add server-side public Meetup search with schedule/status/privacy filtering after the authoritative read model is fixed. |
| 🟠 P1 | MT-039 - Past scheduled Meetups can remain “upcoming” indefinitely | The Meetups page filters by `status === scheduled || ongoing` but never requires `scheduled_at` to be in the future. There is no lifecycle worker automatically moving past events to completed/expired. A forgotten status can leave an old event in the upcoming list forever. | Add schedule-aware lifecycle processing and query predicates. Past scheduled events should become expired/completed/review-needed rather than remaining discoverable as upcoming. |
| 🟠 P1 | MT-040 - Bot protection exists for RSVP but is bypassed | `botGuard.ts` defines a `meetup_rsvp` rate limit, but the normal RSVP path writes the entity directly and never calls the bot guard. The configured protection is therefore decorative for this feature. | Put RSVP behind the protected backend command and invoke bot/rate controls there. Remove client-direct mutation paths that bypass the guard. |
| 🟠 P1 | MT-041 - Suspended/enforced users can bypass policy through direct writes | Meetup create/RSVP are direct entity SDK mutations and do not consult AccountStatus/enforcement. Unless blocked globally elsewhere, a suspended or shadow-banned account can continue writing event/attendance records through these feature paths. | Make Meetup/RSVP backend commands check current enforcement state before mutation and add suspended/shadow-banned negative tests. |
| 🟠 P1 | MT-042 - Networking Concierge receives broader location/social data than necessary | The Networking Concierge has direct read tools for Meetup, Circle, Follow, Presence and SpaceParticipant. Meetup recommendations need only a small public event projection, but the model can receive full entity records and combine them with broad social/presence context. | Replace broad entity tools with purpose-built recommendation endpoints that return only eligible public event fields and coarse relevance signals. |
| 🟠 P1 | MT-043 - Meetup Event structured data is missing | Inherited from the SEO audit: Meetup is a real-world event page but no Event JSON-LD implementation was found for the detail route. This limits search-engine event understanding and rich-result eligibility, while current sitemap/detail access is already inconsistent. | Add valid Schema.org Event structured data only for genuinely public/indexable Meetups, including visible name, start date, location and status. Validate representative pages and suppress cancelled/private events appropriately. |
| 🟠 P1 | MT-044 - Federated organiser/local organiser checks use the wrong authority | `getMeetup` considers `meetup.did === user.did` sufficient to be organiser, while entity update permission is based on `created_by_id`. Forged/imported/remote DID fields can therefore disagree with actual local control, producing inconsistent organiser UI and attendee access. | For local events, derive organiser authority from immutable creator ownership; for remote events, use repository provenance. Never use mutable embedded DID alone as a privileged local role. |
| 🟡 P2 | MT-045 - Creation accepts past dates | The create form requires a datetime but does not reject a time in the past, and there is no backend schedule validation. | Require a sensible future start time server-side, with an explicit exception only for authorised historical/import operations. |
| 🟡 P2 | MT-046 - Duration validation is incomplete | The UI sets `min=15` but the schema has no minimum/maximum for `estimated_duration`, and API/direct writes can supply implausible or negative values. Duration also feeds achievement evidence. | Validate duration server-side with sensible bounds and store actual start/end evidence separately from estimates used before the event. |
| 🟡 P2 | MT-047 - Latitude/longitude are not range constrained | Meetup supports numeric `lat`/`lng` but the schema does not constrain latitude to -90..90 or longitude to -180..180. | Add coordinate bounds and reject non-finite/invalid coordinates before storage or map rendering. |
| 🟡 P2 | MT-048 - Region is unnormalised and unbounded | `region` has no max length or taxonomy. Free text weakens nearby/search behaviour and can carry overly precise or abusive content. | Limit and normalise coarse region values and use a separate safe geocoding/search representation. |
| 🟡 P2 | MT-049 - Event timezone is implicit | `datetime-local` is converted through the organiser’s browser timezone and only the UTC timestamp is stored. The event’s venue timezone is not stored or displayed explicitly, so cross-region organisers/attendees can misunderstand local event time. | Store an IANA event timezone alongside the instant and display both venue-local time and viewer-local conversion when they differ. |
| 🟡 P2 | MT-050 - Meetups list is capped at 100 with no pagination | `Meetups.jsx` fetches at most 100 records, filters client-side and provides no continuation. | Add cursor-based server filtering/pagination for upcoming eligible events. |
| 🟡 P2 | MT-051 - Meetups discovery has no search/filter/sort controls | The dedicated page provides no region filter, date range, distance, event status, capacity or organiser filter despite being a local-event discovery feature. | Add server-side filters and transparent sorting after safe location handling is implemented. |
| 🟡 P2 | MT-052 - Load failures look like an empty Meetup catalogue | Meetups catches read errors and sets an empty array, so outages and authorisation failures render the same “No meetups scheduled” message as a genuinely empty catalogue. | Show a retryable error/degraded state and retain cached results where possible. |
| 🟡 P2 | MT-053 - No full/waitlist UX | The event card/detail displays capacity but has no “full” state, waitlist or clear behaviour when the last place is taken. | Add full/waitlist states backed by the atomic RSVP capacity service. |
| 🟡 P2 | MT-054 - No organiser profile navigation | MeetupDetail shows organiser name/avatar but does not link to the organiser’s profile or provide verified identity context. | Link to the authoritative organiser profile and clearly distinguish local/federated organisers. |
| 🟡 P2 | MT-055 - Attendee entries have no profile/action affordance | Visible attendee rows show name/avatar/status but no safe profile link or controlled pre-event contact path. | Where privacy permits, link to the attendee profile by authoritative DID and keep messaging/trade contact subject to normal relationship/privacy rules. |
| 🟡 P2 | MT-056 - Wanted-card input is captured but unused | The RSVP form collects up to 10 comma-separated card strings, but the standard attendee UI does not show or use them and no matching feature exists. | Either remove the field until matching exists or give it a clear consented purpose, canonical card identifiers and private matching behaviour. |
| 🟡 P2 | MT-057 - Create Meetup modal accessibility is incomplete | CreateMeetupModal is a custom full-screen overlay rather than the shared Dialog primitive and does not demonstrate focus trapping, Escape handling or focus restoration. | Use the shared accessible dialog/sheet component and add keyboard/focus regression tests. |
| 🟡 P2 | MT-058 - RSVP choice controls lack radio semantics | The Going/Maybe/Can’t make it choices are plain buttons with visual selected styling but no radio-group/`aria-pressed` state for assistive technology. | Use an accessible radio group or correct pressed-state semantics and keyboard navigation. |
| 🟡 P2 | MT-059 - Detailed Meetup localisation is incomplete | Only English contains the detailed creation/detail keys such as `meetup.new`, `meetup.attending.*`, `meetup.stats` and `meetup.vouchGated`; searches of the other locale dictionaries found only the high-level Meetup page/card keys. Non-English users therefore fall back or lose complete localisation. | Add and review the full Meetup keyset for all nine supported locales, including interpolation/pluralisation and safety wording. |
| 🟡 P2 | MT-060 - Sitemap includes stale event states and has a 500-row cap | `seo-sitemap` lists up to 500 Meetups without filtering by schedule/status. Cancelled/completed/stale events can remain indexed and older eligible events fall outside the fixed window. | Index only public, meaningful event states and use paginated/index sitemaps so the full eligible corpus is represented. |
| 🟡 P2 | MT-061 - Meetup cards have no event image/share preview workflow | The Meetup model and editor have no event image/banner field, leaving social shares and event discovery visually weak and forcing generic metadata. | Optionally add a moderated event image/OG workflow with safe upload handling and sensible defaults. |
| 🟡 P2 | MT-062 - Weekly digest counts every newly created Meetup | `weekly-feed-digest` counts new Meetup rows by creation date without checking whether the event was immediately cancelled, invalid or already in the past. | Count only eligible public/current events in the public digest and exclude cancelled/invalid records. |
| 🟡 P2 | MT-063 - No Add-to-calendar/share workflow | For an in-person scheduled event, the detail page has no calendar export, copy/share affordance or explicit venue-time summary users can save. | Add a safe share link and standards-based calendar export using the authoritative event timezone/status. |
| 🟡 P2 | MT-064 - No actual attendance/check-in distinction | RSVP status is used as the event participant evidence source, but an RSVP proves intent rather than real attendance. There is no check-in/organiser confirmation model. | Introduce a separate verified attendance/check-in record for achievements, moderation and event analytics. Never treat RSVP intent as proof of presence. |
| 🟢 P3 | MT-065 - Privacy documentation claims an inactive map provider | The Privacy page says Meetup locations are displayed with Leaflet/OpenStreetMap, while the current feature does not render a Meetup map. | Update the privacy/documentation statement until the map integration actually exists, then document exactly what location data is sent to any map provider. |
| 🟢 P3 | MT-066 - Legacy RSVP portability wording is stale across code/docs | Comments, schema text and Help still describe Meetup RSVP as a federated portable record despite the central privacy policy intentionally blocking it. | After the privacy model is finalised, remove stale federation comments/labels and document the local/private RSVP contract consistently. |
| 🟢 P3 | MT-067 - Exact-release executable verification unavailable | The Base44 source API exposes the project files, but the command sandbox for this audit did not expose the canonical app checkout/package manifest, so build, lint, typecheck and an executable Meetup regression suite could not be run there. | Run build, lint, typecheck and the Meetup adversarial suite from the exact release commit in canonical CI and attach results to the re-audit. |

## Executive summary

Meetups are one of SwapPulse's most safety-sensitive features because they connect an online identity with a real place and time. The feature has useful foundations, including a dedicated Meetup/RSVP model, a private RSVP entity policy, configurable vouch threshold, capacity field, public event discovery, AT Protocol event records, data export support and a central federation policy that correctly marks Meetup RSVP as never-federate.

The current implementation is nevertheless not release ready. The most serious privacy defect is that the vouch-gated attendee list is not the only way to infer attendance. The public `get-activity` endpoint runs as service role and exposes Meetup RSVP activity for an arbitrary DID, linking directly to the event. A guest can therefore associate a collector with a real-world Meetup even when the attendee list itself is hidden.

The vouch gate is also not a trustworthy security boundary. It counts raw Vouch rows rather than distinct, active, trusted vouchers. Because Vouch provenance is not sufficiently authoritative, a viewer can manufacture the threshold and reveal attendees.

RSVP itself is browser-direct and non-transactional. There is no uniqueness, capacity or authoritative actor check. The normal first-RSVP flow can persist the RSVP and then fail while trying to update the organiser-owned Meetup counter, leaving the user with no confirmation even though the attendance record exists.

Meetup data also feeds credentials. The Community Voice achievement counts RSVP rows, while Event Organiser Discord access can be derived from a completed Meetup. Duplicate RSVPs, caller-controlled organiser identity and owner-controlled completion state make this proof forgeable and capable of poisoning another DID's credential state.

The AT privacy design has one particularly strong control worth preserving: `org.swappulse.meetupRsvp` is in the central never-federate set, and normal publication rejects it. However, repository import bypasses that policy and can publish a crafted RSVP to a public PDS. Public Meetup publication also inherits the broader federation-consent and account-deletion/PDS lifecycle blockers.

Product functionality is significantly behind the help/marketing contract. The app documents a map, nearby discovery, Circle-scoped Meetups and pre-meetup trade matching; none is implemented in the current Meetup feature. The page is a capped list with no server search/filter/pagination. The global Search page does not search Meetups.

Live audit-visible data returned **0 Meetup rows and 0 MeetupRsvp rows**, so this audit does not claim an existing production attendance exposure. That is good remediation timing: the model can be corrected before real-world event and attendee data accumulates.

The mandated Base44 web-agent README was not accessible in this session. The connected Base44 source/schema/data APIs remained available and were used. The Base44 command sandbox did not expose the canonical application checkout/package manifest, so build/lint/typecheck and executable Meetup regression tests could not be run there.

No Meetup, RSVP, user or production data was changed. Only this audit report was created.

## Feature verdict

| Feature | Verdict | Notes |
| --- | --- | --- |
| Meetup creation | Not release ready | Direct browser write; no authoritative moderation/enforcement/rate boundary. |
| Public discovery | Partial | Basic upcoming list works, but no map/search/filter/pagination and stale scheduled events can remain. |
| Meetup detail | Broken for guests | Public listing/sitemap routes lead to an auth-required backend. |
| RSVP | Not release ready | Identity, uniqueness, capacity and transaction integrity are missing. |
| Capacity | Not enforced | Display-only field today. |
| Vouch-gated attendees | Release blocker | Gate is forgeable and bypassed by public activity. |
| Attendee privacy | Release blocker | Public activity and overbroad response expose associations. |
| Organiser controls | Incomplete | Cancel only; no edit/reschedule/archive/delete/transfer workflow. |
| Cancellation | Partial | Local state changes but no attendee notification and federated drift can remain. |
| Circle-scoped Meetups | Not implemented | Documentation overclaims. |
| Map / nearby | Not implemented | Documentation and Privacy page say it exists. |
| Pre-meetup trade matching | Not implemented | Onboarding copy promises it. |
| Notifications | Incomplete | No canonical Meetup notification type/producer mapping. |
| Moderation/reporting | Missing | Meetups are not reportable through ContentReport. |
| Community Voice achievement | Release blocker | Duplicate RSVP and mutable lifecycle evidence can forge the proof. |
| Discord Event Organiser | Release blocker | Completed Meetup/achievement evidence is not trustworthy. |
| Networking Concierge | Not release ready | Broad Meetup/social context plus indirect prompt-injection output boundary. |
| Meetup federation | Currently unavailable | Live monitored AT identities all fail current health checks. |
| RSVP federation privacy | Strong policy, bypassable import | Normal path blocks; import path must be fixed. |
| Account erasure | Incomplete | Public PDS Meetup lifecycle and dependent attendee RSVPs are not fully reconciled. |
| Data portability | Partial | GDPR export includes owned Meetup/RSVP records; repo export/import model is not safe for RSVP. |
| SEO | Incomplete | Event JSON-LD missing; sitemap state/cap issues. |
| Accessibility/localisation | Partial | Core labels exist; custom dialog/radio semantics and locale coverage need work. |
| Release verification | Residual action | Exact-commit executable gates unavailable in this audit sandbox. |

## Score breakdown

| Area | Score | Notes |
| --- | ---: | --- |
| RSVP identity and integrity | 1/20 | Browser-direct, non-unique, capacity-unchecked and non-transactional. |
| Real-world privacy and safety | 2/20 | Public activity bypasses attendee privacy and vouch gate is forgeable. |
| Organiser/lifecycle correctness | 2/10 | Cancel-only UI and mutable status/provenance. |
| Moderation and abuse resistance | 1/10 | No Meetup reporting, backend creation guard or effective RSVP bot guard. |
| Federation and portability | 3/15 | RSVP never-federate policy is good, but import/consent/live-health/erasure blockers remain. |
| Cross-feature trust | 1/10 | Achievement/Discord proof is forgeable; AI boundary remains unsafe. |
| Discovery and product completeness | 2/10 | Map, nearby, Circle scope, matching and global search are missing. |
| UX/accessibility/localisation/SEO | 3/10 | Useful basic UI, but route, accessibility, localisation and Event schema gaps. |
| Testing/release evidence | 1/5 | Static/source review complete; executable exact-commit gates unavailable here. |
| **Total** | **16/100** | **High Risk / NOT RELEASE READY** |

## Verified strengths to preserve

- MeetupRsvp entity reads are owner/admin-only at the direct entity layer.
- `org.swappulse.meetupRsvp` is explicitly classified as never-federate by the central federation policy.
- Normal `atproto-bridge` create/update publication applies `isPublicationEligible`, so ordinary RSVP bridge attempts are rejected rather than published.
- Meetup capacity has a schema maximum of 50, even though RSVP enforcement still needs to honour it transactionally.
- `getMeetup` deliberately withholds the attendee array until its vouch check passes, even though the vouch resolver and alternate leak paths need redesign.
- The organiser can cancel a Meetup through the normal detail UI.
- Meetup and MeetupRsvp are included in the GDPR/CCPA data export.
- `outbound-reconcile` has bounded PDS pagination and honours the outward-sharing opt-out in that reconciliation path.
- `atproto-bridge` binds its PDS session to the caller DID for non-admin users.
- The normal PDS bridge verifies ownership before update/delete.
- The feature already uses i18n keys for much of the primary UI, so completing localisation is incremental rather than a rewrite.
- Audit-visible live data currently contains no Meetups or Meetup RSVPs, making migration much safer now.

## Recommended architecture

### 1. Create a single backend Meetup command layer

Browser code should no longer directly create/update/delete Meetup or MeetupRsvp security-sensitive state. Use backend commands such as:

- `createMeetup`
- `updateMeetup`
- `transitionMeetup`
- `rsvpMeetup`
- `withdrawMeetupRsvp`
- `deleteMeetup`

Each command should derive actor identity from authentication, check AccountStatus, apply bot/rate controls, validate state and be idempotent.

### 2. Make RSVP one transactional record per person/event

Use a unique key for `(meetup_id, member_user_id/DID)`. RSVP upsert should atomically:

1. validate Meetup exists and is open for RSVP;
2. bind the attendee identity;
3. enforce one row per attendee;
4. enforce capacity using distinct yes responses;
5. validate allowed transition yes/maybe/no/withdrawn;
6. update protected aggregate counts;
7. emit appropriate notification/audit events;
8. return a minimised response.

### 3. Separate public event data from attendee privacy

Meetup metadata can be public only by explicit organiser choice. RSVP and attendee association should remain private by default. Public profile activity must not reveal attendance unless the attendee explicitly opts in. `looking_for_cards` should be a separate consented matching input, not automatically returned with attendee lists.

### 4. Replace raw vouch counts with a trusted access decision

If vouches remain a safety gate, use a purpose-built resolver based on distinct, authenticated, active, non-revoked vouchers and documented trust requirements. Do not count mutable raw rows.

### 5. Separate intent, attendance and achievement proof

RSVP means planned attendance. Add a check-in/verified-attendance model for real participation. Community Voice should use distinct verified participants and actual event duration, not RSVP intent plus owner-controlled fields.

### 6. Use a durable federation outbox

Meetup create/edit/cancel/delete should persist a federation state such as pending/synced/failed. Safety-critical changes such as cancellation or venue move should retry and be verifiably reflected on the PDS before being considered fully synchronised.

## Required release tests

At minimum, exact-commit CI should prove:

- a guest cannot learn a user's Meetup RSVP through activity or another service-role projection;
- fewer than the required number of distinct trusted vouches cannot view attendees;
- duplicate, self-created and revoked vouches do not satisfy the attendee gate;
- a caller cannot create an RSVP carrying another user's DID/profile;
- a user cannot have more than one active RSVP per Meetup;
- two concurrent users cannot overbook the final available place;
- a failed count update cannot leave an ambiguous partially committed RSVP;
- changing yes → maybe/no/withdraw updates authoritative counts correctly;
- `attending:no` is not disclosed to ordinary attendee-list viewers;
- `looking_for_cards` is not exposed without the matching feature's explicit consent;
- a Meetup with 50+ RSVP records still has complete accurate aggregate counts;
- a suspended/shadow-banned user cannot create Meetups or RSVP through direct/API bypasses;
- a bot cannot bypass the configured meetup_rsvp rate limits;
- a malicious organiser cannot set another DID as organiser;
- a remote repo cannot claim another DID as organiser;
- invalid state transitions such as scheduled → completed without evidence are rejected;
- duplicate RSVPs cannot grant Community Voice;
- RSVP intent alone cannot count as verified attendance;
- forged Meetup data cannot grant another user Community Voice or Event Organiser;
- cancelled/rescheduled events notify affected attendees;
- cancellation is reflected in the public PDS or visibly remains in a failed-sync state;
- direct/local deletion cannot leave a public orphan Meetup;
- deleting an organiser account cleans dependent RSVP associations appropriately;
- a crafted repo archive containing `org.swappulse.meetupRsvp` is rejected before PDS write;
- outward federation opt-out blocks Meetup publication at the canonical boundary;
- account erasure verifies the chosen PDS/record deletion outcome;
- a Meetup can be private/unlisted without entering public PDS/sitemap/AI discovery, if that mode is offered;
- past scheduled events stop appearing as upcoming;
- date/duration/coordinate validation rejects malformed inputs;
- Meetup search/pagination works beyond the first 100 records;
- Circle-scoped Meetups enforce authoritative Circle membership if implemented;
- all nine locales contain the complete Meetup UI/safety text;
- creation/RSVP controls pass keyboard, focus and screen-reader tests;
- Event JSON-LD validates for eligible public Meetups;
- the exact release commit passes build, lint, typecheck and the full Meetup adversarial suite.

## Release decision

**Do not treat Meetups as production-ready while MT-001 through MT-008 remain unresolved.**

The immediate priority is not adding the map. First make attendee privacy and RSVP integrity trustworthy: remove the public attendance leak, replace the raw-vouch gate, create one authoritative RSVP service, separate RSVP intent from verified attendance, and stop mutable Meetup data from driving credentials. Then fix the federation privacy/lifecycle boundary and only afterwards expand map, nearby discovery, Circle scope and trade matching.
