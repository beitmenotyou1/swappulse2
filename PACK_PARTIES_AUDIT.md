# SwapPulse Pack Parties Full Feature Audit

**Audit date:** 12 September 2026  
**Scope:** PackParty entity and Lexicon, scheduling/creation, RSVP/join/leave, participant/attendance state, host controls, live lifecycle, synchronisation, party room/feed, pack pulls, reactions, invites, visibility/privacy, moderation/safety, notifications, AT Protocol publication/ingestion/discovery, account deletion/export/import, profile/activity integration, UI/UX, accessibility, localisation and release testing  
**Overall score:** **12/100**  
**Risk:** **Critical / High Risk**  
**Release status:** **NOT RELEASE READY**  
**Status:** **Source/schema/data audit complete; exact-release build/typecheck/test verification unavailable**

| Priority | Area | Finding | Required action |
| --- | --- | --- | --- |
| 🔴 P0 | PP-001 - RSVP / Join flow is non-functional | The visible Join Now control has no click handler. There is no PackPartyParticipant entity, participant DID list or RSVP record, so there is no supported join, RSVP, leave, attendee-list or membership-proof flow. | Implement backend-owned PackPartyParticipant/RSVP state with authenticated DID, unique party+participant membership, timestamps and Join/Leave backend operations. |
| 🔴 P0 | PP-002 - Normal parties can never become live or completed | New parties are created as `scheduled`. No scheduler, workflow, backend transition or host control was found to move them to `live` or `completed`. Join Now is only rendered for an already-live party. | Add authoritative scheduled -> live -> completed/cancelled lifecycle transitions, host controls, start/end timestamps and idempotent recovery. |
| 🔴 P0 | PP-003 - Host identity and party provenance are forgeable | PackParty is client-created. RLS binds created_by_id, but host identity, DID, status and participant count are caller-controlled. Generic bridge publication can publish an owner-created row whose `hostDid` claims another collector, and inbound mapping trusts that claim. | Create/update through backend functions, derive host DID/profile from the authenticated account/repository and bind inbound authorship to repo DID. |
| 🔴 P0 | PP-004 - Normal PackParty creation does not federate despite product claims | The create page only calls `PackParty.create`; it does not bridge, set DID or publish. New records stay `bridged:false`, while outbound-reconcile only processes matching DID records already marked bridged. | Publish public parties through the canonical backend creation path after consent/identity checks and expose local-only/pending/published/failed state. |
| 🔴 P0 | PP-005 - Remote PackParty lifecycle edits become stale after first ingest | The firehose high-water cursor skips old rkeys. Past-cursor edit detection is special-cased only for `app.bsky.feed.post`, so custom PackParty updates such as scheduled -> live/completed may never refresh locally. | Add CID/revision-aware custom-record update ingestion or a commit subscription architecture, with cross-PDS lifecycle tests. |
| 🔴 P0 | PP-006 - Account deletion does not erase PackParty data | `delete-account` omits PackParty. Hosted records can survive local account deletion, and public PDS copies are not enumerated/deleted by the account-erasure flow. | Include PackParty and future participant data in erasure, propagate PDS deletes before dropping local linkage and retry/report partial failures. |
| 🔴 P0 | PP-007 - PackParty publication inherits the AT Protocol federation-consent bypass | Preserved from the AT Protocol audit: outbound-reconcile checks Do Not Sell/Share but canonical bridge publication does not. An owner can manually bridge a PackParty despite the opt-out. | Enforce federation consent fail-closed in every canonical PDS create/update/retry path and preserve this inherited P0 until verified fixed. |
| 🟠 P1 | PP-008 - No server-authoritative party creation contract | Creation is a direct entity write with no backend validation of host DID, schedule, set, lifecycle, capacity, moderation or duplicate requests. | Replace direct writes with a backend create-pack-party function deriving trusted fields and policy. |
| 🟠 P1 | PP-009 - participant_count is owner-editable | The public count is not derived from membership and can be set by owner/admin or supplied by a remote record. | Derive counts from authoritative active memberships and make them non-client-writable. |
| 🟠 P1 | PP-010 - max_participants has no schema bounds | Entity, Lexicon and UI permit arbitrary integer capacities. | Define and enforce a bounded range server-side, locally and in the interoperable schema. |
| 🟠 P1 | PP-011 - Capacity is not enforceable | No participant records or atomic join operation exist, so there is no race-safe capacity check. | Atomically check capacity and create membership; test concurrent final-slot joins and retries. |
| 🟠 P1 | PP-012 - No authoritative membership or attendance provenance exists | A numeric count cannot prove who RSVP'd, attended, joined or left. | Separate RSVP from attendance/check-in state and derive counts from explicit authenticated states. |
| 🟠 P1 | PP-013 - No Leave / un-RSVP flow | There is no user control or backend operation to withdraw. | Add idempotent leave/un-RSVP operations and immediate capacity updates. |
| 🟠 P1 | PP-014 - No invite or circle-invite system despite documentation | Help says hosts can invite collectors/circles, but no invite entity, picker, acceptance or notification workflow exists. | Implement consent-based invites with circle authorisation, or remove the claims until implemented. |
| 🟠 P1 | PP-015 - No audience/visibility model | PackParty is public-read and has no public/followers/circle/private audience field. | Define audience semantics before real participation data and enforce them server-side. |
| 🟠 P1 | PP-016 - PackParty is always publication-eligible | Federation policy has no PackParty case, so any bridged party falls through as publicly eligible. | Only intentionally public parties may federate; private/circle/invite-only parties must remain off public AT repos. |
| 🟠 P1 | PP-017 - There is no party detail or room route | Only `/pack-parties` exists; cards are not links. Help's “open a party” flow is impossible. | Add an authorised `/pack-parties/:id` detail/room route or correct documentation. |
| 🟠 P1 | PP-018 - Party feed is not modelled | Post has no party reference and no party feed function was found. | Add a strong party reference to pull posts or a dedicated PackPartyPull record and visibility-gated query. |
| 🟠 P1 | PP-019 - No pull submission or pull-proof model | There is no PackPartyPull entity or backend flow tying a pull to party, participant, card/set, media or provenance. | Define an authenticated pull record and state whether pulls are self-reported or verified. |
| 🟠 P1 | PP-020 - Reactions are not scoped to a Pack Party | Generic Reaction references posts only; it cannot establish party context. | Resolve reactions through party-linked posts/pulls and enforce the relevant party visibility/membership. |
| 🟠 P1 | PP-021 - Synchronised opening is not implemented | No server start signal, countdown, ready state, clock strategy or synchronisation event exists. | Implement authoritative timestamps/events and a resilient countdown/ready flow, or stop calling the feature synchronised. |
| 🟠 P1 | PP-022 - Host management controls are absent | Hosts cannot edit, start early, end, cancel, remove participants or close joins through the UI. | Add explicit backend state-transition/moderation actions and audit logs instead of arbitrary row updates. |
| 🟠 P1 | PP-023 - Cancellation is not represented | Status supports only scheduled/live/completed. | Add versioned cancellation state/reason and notification lifecycle. |
| 🟠 P1 | PP-024 - Past/invalid schedules can be created | No server rule rejects past dates or unreasonable horizons. | Validate schedule timestamps server-side with lead time and horizon policy. |
| 🟠 P1 | PP-025 - No duration or authoritative end time exists | There is no planned duration, started_at or ended_at. | Add planned duration plus backend-controlled start/end timestamps. |
| 🟠 P1 | PP-026 - Set identity is free text and unverified | The set field is a plain text input; no TCGDex validation occurs. | Use a TCGDex-backed picker and persist canonical set ID/name/image. |
| 🟠 P1 | PP-027 - UI calls the set optional while schema calls it required | The UI says “Set (optional)” although the product/schema define a set-based event; empty string still passes the current client write. | Make the rule consistent and enforce non-empty canonical identity if required. |
| 🟠 P1 | PP-028 - Party creation bypasses bot/abuse controls | Direct entity creation bypasses a PackParty-specific risk/captcha/rate boundary. | Route creation through the common backend write-risk system and add per-account velocity controls. |
| 🟠 P1 | PP-029 - PackParty cannot be reported through ContentReport | ContentReport has no `pack_party` target. | Add PackParty reporting with safe preview/evidence and moderation actions. |
| 🟠 P1 | PP-030 - Pack Parties are not filtered by enforcement state | Discovery performs a raw public entity list and enforcement cleanup does not include PackParty. | Filter discovery by account/content enforcement and include parties in moderation takedown/force-delete. |
| 🟠 P1 | PP-031 - No PackParty notification contract exists | There are no invite, RSVP, reminder, starting, cancellation or ended notification types/producers. | Define typed events routed through central notification preferences, quiet hours and push policy. |
| 🟠 P1 | PP-032 - Discovery is capped at 50 records with no pagination | The page lists at most 50 parties with no cursor/load-more. | Implement paginated server discovery with time/status filters and deterministic cursors. |
| 🟠 P1 | PP-033 - Discovery ordering is poor for events | `-scheduled_at` puts furthest-future first and mixes scheduled/live/completed. | Show live first, then nearest upcoming ascending, with completed archive separate. |
| 🟠 P1 | PP-034 - The page does not subscribe to PackParty changes | The list is loaded once and has no realtime invalidation or refresh. | Add safe invalidation/refetch or visible refresh, through a server visibility gate. |
| 🟠 P1 | PP-035 - Forged remote hostDid can defeat delete detection | Inbound mapper stores local DID from remote hostDid, but delete detection later searches by source repo DID. A malicious hostDid can make the local row evade source-repo deletion cleanup. | Persist authoritative `source_repo_did` and reconcile lifecycle/delete by repository URI/repo DID. |
| 🟠 P1 | PP-036 - Remote host display metadata is self-asserted | Inbound mapping trusts record hostName/handle/avatar and the UI displays them directly. | Resolve identity/display metadata from the authoritative repo DID/profile. |
| 🟠 P1 | PP-037 - Cross-instance discovery does not match the product claim | Ingestion scans local, followed and migrated-user repos, not a global PackParty index. A published custom Lexicon alone does not provide network-wide discovery. | Add a relay/AppView/indexer or narrow the discovery claim to known repositories. |
| 🟠 P1 | PP-038 - Personal data export omits PackParty | `export-my-data` excludes PackParty despite Privacy listing party participation as activity data. | Include hosted and participant party data with provenance/federation metadata. |
| 🟠 P1 | PP-039 - AT repository export omits PackParty | `export-repo` excludes PackParty despite the custom Lexicon/portability claims. | Add public canonical PackParty records after publication is real, or remove portability claims. |
| 🟠 P1 | PP-040 - Generic repo import can introduce spoofed PackParty host fields | An archive can write a PackParty to the caller's repo, and local mapping trusts record hostDid/name fields. | Bind imported host identity to the importing repository DID and reject mismatches. |
| 🟠 P1 | PP-041 - PackParty Lexicon does not encode key trust constraints | Revision 1 does not require hostDid, bounds on participant counts, audience or authoritative lifecycle timestamps. | Define an interoperable trust contract and version the NSID if published constraints cannot safely change. |
| 🟠 P1 | PP-042 - Duplicate/idempotent party creation is not controlled | Double-submit/retries/multiple tabs can create duplicate parties. | Add idempotency keys and duplicate host+schedule detection. |
| 🟠 P1 | PP-043 - Federation state is not surfaced to the user | The page does not show local-only/pending/failed/published state. | Add explicit federation delivery state, safe retry/error details and UI status. |
| 🟠 P1 | PP-044 - No ordinary UI can update/delete federated PackParty lifecycle | Generic bridge functions exist, but there is no host edit/cancel/delete flow and normal creation is not bridged. | Make lifecycle operations backend-owned and durably reconcile public PDS copies. |
| 🟠 P1 | PP-045 - Remote PackParty content bypasses party-specific moderation review | Generic federation ingestion writes remote parties straight into public discovery without party quarantine/moderation state. | Apply safety/enforcement policy before discovery and propagate takedowns durably. |
| 🟠 P1 | PP-046 - No attendance/pull integrity means future rewards would be unsafe | Current counters/status cannot prove attendance, pulls or popularity. | Prohibit reward/reputation/achievement consumers until authoritative evidence exists. |
| 🟡 P2 | PP-047 - Privacy Policy and current data model disagree about participation | Privacy says party participation is collected, while the current model stores only aggregate participant_count. | Align policy with the deployed model and update it when participant records launch. |
| 🟡 P2 | PP-048 - Detailed PackParty UI is English-only in non-English locales | Non-English locale files contain only PackParty title/subtitle; detailed keys fall back to English. | Translate every PackParty key for all nine supported locales and add completeness tests. |
| 🟡 P2 | PP-049 - Input placeholders are hard-coded English | Create placeholders are embedded directly in JSX. | Move them to localisation resources. |
| 🟡 P2 | PP-050 - Relative event times are not locale-aware | `formatDistanceToNow()` is called without the selected date-fns locale. | Map app locale to date-fns locale and test all supported languages. |
| 🟡 P2 | PP-051 - Timezone is not shown | Cards show only relative time for a remote event. | Show absolute local time plus timezone and offer calendar export. |
| 🟡 P2 | PP-052 - Create modal lacks robust dialog accessibility | The custom overlay lacks dialog semantics, focus trap, Escape handling and focus policy. | Use the shared accessible Dialog and test keyboard/screen-reader behaviour. |
| 🟡 P2 | PP-053 - Form inputs do not expose schema length limits | Title/description inputs lack maxLength/counters/messages. | Mirror server limits client-side while keeping server validation authoritative. |
| 🟡 P2 | PP-054 - Participant-limit input lacks min/max controls | The number input provides no range. | Expose the supported capacity range and validate before submit. |
| 🟡 P2 | PP-055 - set_name is populated from the raw set ID | onChange writes the same typed value into setId and setName. | Resolve display name/image from TCGDex. |
| 🟡 P2 | PP-056 - set_image exists but is never used | Schema/Lexicon support set artwork but creation/UI ignore it. | Use validated set artwork or remove the unused field. |
| 🟡 P2 | PP-057 - No search or event filters | No set/host search, live/upcoming/archive, date or joined/hosted filters exist. | Add event discovery controls after the state model is secure. |
| 🟡 P2 | PP-058 - Host identity is not navigable | Host avatar/name is static, with no profile link or source indicator. | Link to authoritative DID/profile and provide identity context. |
| 🟡 P2 | PP-059 - Party cards are not navigable | Cards cannot be opened. | Make card/title a proper link once the detail route exists. |
| 🟡 P2 | PP-060 - No event countdown/ready-state UX | There is no countdown, ready/late-join/ended transition feedback. | Design accessible live-session state around authoritative lifecycle events. |
| 🟡 P2 | PP-061 - Discovery has no refresh/pull-to-refresh affordance | Users must reload the browser to refresh. | Add refresh/pull-to-refresh with clear loading/error states. |
| 🟡 P2 | PP-062 - PackParty activity is absent from profile/activity projections | `get-activity` omits hosting/participation. | Decide whether party activity is public/profile-visible and implement/document consistently. |
| 🟡 P2 | PP-063 - No calendar/share workflow | Scheduled events have no Add to Calendar, stable event deep-link/share or reminder setup. | Add these after detail route and lifecycle are secure. |
| 🟡 P2 | PP-064 - No PackParty operational/audit observability | No party-specific audit trail was found for lifecycle, membership, moderation or federation failures. | Add structured audit events and privacy-minimised metrics. |
| 🟡 P2 | PP-065 - Dedicated PackParty tests are absent and exact-release tests were not runnable | No PackParty tests were found under `base44/shared/__tests__`; the command sandbox exposes only an empty `/workspace` with no package manifest. | Add unit/integration/adversarial tests and run build/lint/typecheck/E2E in canonical CI against the release commit. |
| 🟢 P3 | PP-066 - UK spelling is inconsistent | Source descriptions use “synchronized” while UK-facing Help/docs use “synchronised”. | Standardise user-facing copy on UK English. |
| 🟢 P3 | PP-067 - Lexicon source is duplicated manually | Canonical PackParty JSON is manually mirrored inside `lexiconRegistry.ts`, with comments warning about drift. | Generate the deployable registry from canonical Lexicon JSON and fail CI on drift. |

## Executive summary

Pack Parties currently has a real route, create modal, entity schema and AT Protocol Lexicon, but it does **not** yet implement the social/live event that the product describes. The current UI can create and list a scheduled party card, but Join has no action and there is no participant/RSVP model, detail room, automatic live transition, host lifecycle controls, party feed, pull record, invitation flow or archive lifecycle.

Identity and federation need hardening before launch. Local trusted fields are client-writable, inbound records can assert a host DID that differs from their repository DID, ordinary UI-created parties do not federate at all, and later edits to remote custom records can be skipped by the current high-water ingestion logic.

Privacy and data-rights lifecycle is incomplete: PackParty is absent from account deletion, `export-my-data` and `export-repo`. The Privacy Policy explicitly describes pack party participation as activity data even though the current model stores no participant identity.

The audit-visible dataset contains **0 PackParty rows** in this session. This is an audit-visible observation only, not a claim that no production/environment can contain PackParty records. No exploitation is evidenced by the visible dataset.

The required Base44 web-agent README returned **HTTP 403 Forbidden**. The connected source/schema/entity APIs remained available. The command sandbox exposed only an empty `/workspace` with no package manifest, so exact-release build, lint, typecheck and runtime tests could not be rerun.

No functional code or production data was changed during this audit. Only this audit report and downloadable artifacts were created.

## Current feature reality

| Capability | Current state | Verdict |
| --- | --- | --- |
| Schedule a party | Present | Direct browser create, weak validation |
| Browse parties | Present | Public list, 50-record cap, poor event ordering |
| RSVP / Join | **Not implemented** | Button has no handler; no membership model |
| Leave / un-RSVP | **Not implemented** | No operation/model |
| Party detail page | **Not implemented** | Only `/pack-parties` route exists |
| Automatic go-live | **Not implemented** | No workflow/scheduler |
| Host start/end/cancel | **Not implemented** | No controls/state machine |
| Live synchronisation | **Not implemented** | No countdown/start event/clock strategy |
| Live room / party feed | **Not implemented** | No route/feed relation |
| Pack pull submission | **Not implemented** | No party pull entity/reference |
| Reactions in party | **Not implemented as party feature** | Generic post reactions only |
| Invite collectors/circles | **Not implemented** | No invite/consent workflow |
| Capacity enforcement | **Not implemented** | Count is mutable; no atomic joins |
| Attendance tracking | **Not implemented** | Aggregate count only |
| Moderation/reporting | Incomplete | PackParty not a ContentReport target |
| Notifications/reminders | **Not implemented** | No PackParty event types/producers |
| AT Lexicon | Present | `org.swappulse.packParty` revision 1 |
| Normal outbound AT publication | **Broken/not wired** | Current create path remains local |
| Inbound AT ingestion | Partial | Known/followed repos only; custom edits become stale |
| Account deletion | **Broken for PackParty** | Entity omitted |
| Personal data export | **Broken/incomplete** | Entity omitted |
| Repository export | **Broken/incomplete** | Entity omitted |
| Localisation | Partial | Only title/subtitle translated outside English |
| Dedicated tests | Not found | Release evidence incomplete |

## Score breakdown

| Area | Score | Notes |
| --- | ---: | --- |
| Core party functionality | 1/25 | Scheduling card exists; RSVP/live room/pulls are absent. |
| Identity, permissions and state integrity | 2/20 | Owner RLS exists, but trusted fields are client-controlled and no state machine exists. |
| Federation/interoperability | 2/15 | Lexicon and mapper exist; outbound create is unwired and inbound updates are stale. |
| Privacy and data lifecycle | 1/10 | Open public model plus deletion/export omissions. |
| Safety/moderation/abuse controls | 1/10 | No party report path, enforcement filter or write-risk boundary. |
| Notifications/event lifecycle | 0/5 | No PackParty event contract or reminders. |
| UI/UX, accessibility and localisation | 4/10 | Clean scheduling UI, but core actions/routes and translation/accessibility are incomplete. |
| Testing/operations | 1/5 | No dedicated tests found and exact-release sandbox checkout unavailable. |
| **Total** | **12/100** | **Critical / NOT RELEASE READY** |

## Verified strengths to preserve

- PackParty has owner/admin update/delete RLS rather than unrestricted global mutation.
- Public read semantics are explicit in the current schema.
- A versioned `org.swappulse.packParty` Lexicon exists and is registered in the canonical collection map.
- Generic bridge ownership checks require the caller to own the local record before bridge-record can operate on it.
- atproto-bridge binds PDS writes to the authenticated caller's personal DID where available.
- outbound-reconcile honours the Do Not Sell/Share preference, though the direct canonical publication boundary still needs the same enforcement.
- React escapes normal title/description text rendering.
- The create modal uses associated labels for inputs.
- The audit-visible dataset currently has no PackParty rows, reducing migration risk if fixed now.

## Recommended target architecture

1. **Separate Party, RSVP and Attendance.** PackParty should hold event metadata only. Participant rows should use an authenticated DID, explicit RSVP state, join/leave timestamps and actual attendance/check-in state.
2. **Backend-owned lifecycle.** Create, edit, join, leave, invite, accept/decline, start, end, cancel, remove participant and submit-pull should all be explicit authorised operations.
3. **Design privacy before federation.** Public parties may federate; followers/circle/invite-only parties and private membership data must remain out of public AT repositories.
4. **Bind identity to the repository.** `source_repo_did` is authoritative. hostDid must not override it; host display metadata should resolve from the verified profile.
5. **Build a real live-session projection.** Use authoritative start/end timestamps, countdown/ready state, active participant state, party-linked pulls/posts, reactions and moderation controls.
6. **Make federation durable.** Use an outbox/retry state for public creation/update/cancel/end and CID/revision-aware inbound updates.
7. **Complete data rights.** Include parties/participants in export, erasure, moderation deletion and federation reconciliation.

## AT Protocol references checked

- AT Protocol Lexicon specification: https://atproto.com/specs/lexicon
- Publishing Lexicons: https://atproto.com/guides/publishing-lexicons
- Personal Data Repositories: https://atproto.com/guides/data-repos
- Repository specification: https://atproto.com/specs/repository
- AT Protocol sync guide: https://atproto.com/guides/sync

## Release decision

**Do not release Pack Parties as a live synchronised social feature while PP-001 through PP-007 remain unresolved.**

Recommended order: **authoritative RSVP/membership -> backend lifecycle/start/end/cancel -> host identity binding -> detail/live room and pull/feed relationships -> public vs local-only audience -> durable federation/custom-record update ingestion -> moderation/notifications/enforcement -> deletion/export/import -> accessibility/localisation -> dedicated adversarial tests -> rerun audit.**
