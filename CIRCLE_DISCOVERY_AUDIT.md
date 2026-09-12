# SwapPulse Circle Discovery Audit

**Audit date:** 12 September 2026  
**Scope:** Circle directory/discovery, Circle creation, visibility modes, membership/join/leave, private/member-visible access, member lists, circle-scoped trades, challenges and meetups, Starter Pack recommendations/bulk join, Networking Concierge recommendations, AT Protocol federation, privacy/data rights, moderation, search/ranking, scale, accessibility/localisation and release verification  
**Overall score:** **22/100**  
**Risk:** **High Risk / Needs Remediation**  
**Release status:** **NOT RELEASE READY**  
**Status:** Complete with critical residual actions

## Executive summary

SwapPulse has a useful Circle concept and several sound building blocks: a public directory, theme filters, join/leave backend, member-only trade rendering, private/public federation policy, Starter Pack recommendations, Circle-aware trade creation, a Networking Concierge, public-only sitemap filtering and a server-side `get-visible-trades` gate. The central `federationPolicy.ts` correctly recognises that AT Protocol repositories are public and only permits `org.swappulse.circle` records whose visibility is explicitly `public` to cross the PDS boundary. That control should be preserved.

The feature is nevertheless not release ready because Circle metadata and Circle **authorisation state are the same mutable record**. `member_dids`, curator DID and `at_uri` live directly on `Circle`, and ordinary authenticated users can create Circle rows containing caller-chosen values for all of them. Downstream security code resolves a circle-scoped trade by filtering Circle on `at_uri` and trusting the newest matching row. A malicious user can therefore create a duplicate local Circle carrying a known real `at_uri`, add their own DID to `member_dids`, and potentially shadow the legitimate Circle during membership resolution. This is a release-blocking access-control design flaw.

A second inherited P0 remains from the Trade Board audit: `canViewCircleContent()` treats a public Circle as sufficient authorisation for circle-scoped content. Therefore a TradeListing labelled “Circle only” can be returned to a non-member whenever its Circle is publicly discoverable. Public Circle discoverability and Circle membership must be separate concepts.

Starter Packs introduce another bypass. The normal `circle-membership` endpoint correctly blocks joining a private Circle. `follow-starter-pack`, however, uses service role and directly appends the current user's DID to every Circle ID in the pack without checking Circle visibility, invitation, approval or ownership of the recommendation. Because StarterPack `circle_ids` are author-editable and public, a user who learns a private Circle ID can place it in a pack and use bulk join to enrol themselves despite the private-circle gate.

Two other inherited release blockers materially affect Circle Discovery. Circle-scoped challenges still do not require active Circle membership at the submission/leaderboard boundary, and the Networking Concierge still has the project-wide specialist-agent indirect prompt-injection/Markdown exfiltration issue while consuming user-generated Circle/social-graph data. The Explore audit's P0 Follow-graph spoofing also directly affects Circle recommendations because the Concierge uses Follow data as a relevance signal.

Privacy semantics are also incomplete. `getCircle` deliberately returns private/member-only Circle name, theme and member count to anyone who knows the ID. `CircleExit` is open-read and exposes DID, Circle ID/reference and exit time. Account deletion removes the user's own Circle rows but does not remove their DID/profile snapshot from Circles curated by someone else. Public Circle membership can eventually be written into the curator's public PDS record through outbound reconciliation, but the join UI does not clearly explain that public association or provide a portable, independently signed membership record.

The product currently has three overlapping discovery surfaces with different behaviour: `/circles` shows the newest 50 public Circles plus “my circles”, `/circles-directory` searches only the newest 100 public Circles client-side, and the Networking Concierge recommends from whatever Circle rows its RLS tool can see. Global Search does not search Circles at all. The directory says it can filter by theme, era or region, but it only implements theme plus free-text name/description search.

Audit-visible queries returned **0 Circle rows, 0 CircleExit rows and 0 StarterPack rows**, so no current live exposure count is claimed. The findings below are source-confirmed trust, privacy and functional defects that should be fixed before real private community data accumulates.

No Circle, membership, Starter Pack, recommendation or user data was changed during this audit.

## Method and constraints

The required Base44 MCP README URL was requested first from the Base44 sandbox and returned HTTP 403. The audit therefore continued against the existing application's live source tree, entity schemas, backend functions, agent configuration, previous project audits and audit-visible entity data.

The Base44 command sandbox exposed `/workspace` without the application `package.json`, so the current build, lint/typecheck and executable Circle regression suite could not be rerun in this audit session. Source search also found no dedicated Circle security test files.

## Score breakdown

| Area | Score | Notes |
| --- | ---: | --- |
| Membership and authorisation | 1/20 | Circle rows are caller-creatable authorisation objects; scoped trade membership is bypassable. |
| Privacy and visibility | 3/20 | Private metadata/exit history leaks and erasure gaps remain. |
| Discovery and recommendation integrity | 3/15 | Fixed-window newest-first discovery, spoofable Follow signals and AI scope problems. |
| Starter Packs and cross-feature scoping | 2/15 | Bulk join bypasses private Circle rules; challenge/trade scoping is inconsistent. |
| Federation and portability | 6/10 | Central public-only federation policy is strong, but identity/membership provenance and sync semantics are weak. |
| Moderation and abuse resistance | 2/10 | No Circle report path, creation moderation, rate limits or member moderation controls. |
| UX, accessibility, localisation and lifecycle | 3/10 | Missing lifecycle controls, inconsistent visibility semantics and incomplete localisation. |
| **Total** | **22/100** | **High Risk / Needs Remediation** |

## Findings

| Priority | Area | Finding | Required action |
| --- | --- | --- | --- |
| 🔴 P0 | Circle membership authorisation | `Circle` create RLS only proves the caller owns the new row; it does not bind `did`, `at_uri` or `member_dids` to authoritative values. `canViewCircleContent()` resolves a scope by `Circle.filter({ at_uri }, '-created_date', 1)` and trusts the newest row. An authenticated attacker who knows a real Circle `at_uri` can create a newer duplicate row with that `at_uri` and their own DID in `member_dids`, potentially shadowing the legitimate Circle and manufacturing membership for circle-scoped content. | Stop using mutable Circle metadata as the membership authority. Make Circle creation backend-only for security fields, enforce globally unique canonical Circle identity/reference, derive curator identity server-side, and store membership in a separate server-authoritative entity keyed to immutable Circle ID. Resolve scoped access from that entity, never from newest arbitrary `at_uri` match. Add duplicate-reference and forged-membership adversarial tests. |
| 🔴 P0 | Circle-scoped trade privacy | **Inherited from the Trade Board audit:** `get-visible-trades` says circle-scoped listings require membership, but `canViewCircleContent()` returns true whenever the referenced Circle is `public`. A non-member can therefore read a TradeListing labelled “Circle only” when its Circle is publicly discoverable. | Separate Circle discoverability from content membership. For `circle_scoped` TradeListings require an active membership/curator record regardless of Circle visibility. Preserve this finding at P0 until non-member, former-member and forged-reference tests pass. |
| 🔴 P0 | Starter Pack private-circle bypass | `circle-membership` correctly rejects joining a `private` Circle, but `follow-starter-pack` bypasses that endpoint and service-role appends the caller DID directly to every `pack.circle_ids` Circle without checking visibility, invitation or approval. StarterPack authors can edit `circle_ids`; a caller who learns a private Circle ID can put it in a pack and bulk-join themselves. | Make every membership change go through one authoritative membership service. `follow-starter-pack` must validate each Circle and require the same visibility/invite/approval rules as direct join. Do not accept arbitrary pack circle IDs as authority. Add private/members-visible/removed/banned Circle tests. |
| 🔴 P0 | Circle-scoped challenges | **Inherited from the Backend/Full Project audits:** `Challenge.scope === 'circle'` and `circle_ref` exist, but `submitChallengeEntry` and `getLeaderboard` do not enforce current Circle membership. Knowing a challenge ID is sufficient to submit/read participation paths that should be Circle-scoped. | Require current authoritative membership for Circle challenge submission, progress, leaderboard and reward calculation. Recheck membership on every access and exclude former members according to published policy. Preserve the historical P0 priority. |
| 🔴 P0 | AI Circle recommendation output boundary | **Inherited from the LLM/Agent audit:** `networking_concierge` consumes user-generated Circle/social records without the full explicit indirect-prompt-injection boundary used by stronger agents, while `NetworkingConcierge.jsx` renders model output through unrestricted `ReactMarkdown`. Hostile Circle/member/meetup data can influence model output and create an external-fetch/exfiltration chain. | Apply the shared untrusted-data agent policy, field-minimise recommendation inputs, disable remote images/raw external media in rendered Markdown and route generated external links through the safe confirmation layer. Add malicious Circle/Follow/Presence prompt-injection tests. |
| 🔴 P0 | Follow-graph integrity in Circle discovery | **Inherited from the Explore audit:** Follow rows are owner-created but the stored follower `did` is not server-bound to the authenticated user. The Networking Concierge explicitly uses Follow records/shared members to recommend Circles, so an attacker can poison another collector's apparent social graph and recommendation signals. | Move Follow creation/update/delete through a server-authoritative actor-bound path, derive follower DID from session/PDS identity, reject mismatches and deduplicate by follower+subject. Rebuild recommendation features only from verified graph edges. Preserve the inherited P0 priority. |
| 🟠 P1 | Private Circle metadata by ID | `getCircle` uses service role and, for a denied viewer, still returns Circle `id`, `name`, `visibility`, `theme` and `member_count`. Anyone who learns a private/member-only Circle ID can confirm its existence, name, niche and size; CircleDetail also feeds the returned name into page SEO state. | For unauthorised private/member-only Circles return a generic not-found/forbidden response with no private metadata. Never put hidden Circle names into SEO/social metadata for denied viewers. |
| 🟠 P1 | CircleExit privacy | `CircleExit` has open `read: {}` RLS and stores `did`, `circle_id`, `circle_ref` and `exited_at`. This publicly exposes a collector's Circle departure history and can disclose references to otherwise private communities. | Make CircleExit owner/staff-only or replace it with a server-private membership event. Public discovery must never expose private-group membership/exit history. |
| 🟠 P1 | Hidden `members_visible` access semantics | Non-members are denied by `getCircle` for every non-public Circle, so the UI cannot show/join a `members_visible` Circle. Yet `circle-membership` blocks only `private`, meaning anyone who knows a `members_visible` ID can call the backend directly and join it. | Define the exact semantics of `members_visible` and enforce them consistently in discovery and membership. If it is invite/approval-only, require an invite/request. If it is discoverable-but-member-list-private, expose only safe metadata and allow join deliberately. |
| 🟠 P1 | Private Circle onboarding | There is no invite, join-request, approval, invite-link or membership-request entity. A private Circle created through the normal UI has no legitimate path for another collector to join. | Add explicit invitation/request/approval records with expiry, actor binding and audit trail, or remove private Circles until a secure onboarding flow exists. |
| 🟠 P1 | Membership consent/provenance | A Circle owner has full update rights to their Circle row and can directly add arbitrary DIDs/profiles to `member_dids`/`member_profiles`. This can make another collector appear publicly associated with a Circle without their acceptance. | Make membership records participant-authored/accepted or created only by a backend after explicit consent. The curator may invite/kick but must not be able to fabricate another user's accepted membership. |
| 🟠 P1 | Curator identity provenance | Direct Circle creation accepts caller-supplied `did`, `author_name`, `author_handle`, `at_uri`, signature metadata and member profile fields. The UI stamps them correctly, but the entity boundary does not. Public Circle authorship and curator checks can therefore be forged at the local data layer. | Create Circles through a backend that derives curator user ID/DID and canonical record metadata from the authenticated session. Make identity/reference fields immutable to ordinary clients. |
| 🟠 P1 | Membership write races | `circle-membership` performs a read-modify-write of the complete `member_dids` and `member_profiles` arrays. Concurrent joins/leaves can overwrite each other, lose members or produce count/profile drift. | Use an atomic membership entity/transaction or compare-and-swap versioning. Derive member count from authoritative membership records rather than rewriting arrays. |
| 🟠 P1 | Membership capacity | Circle arrays are capped at 100 members, but `circle-membership` does not check capacity before appending. The 101st join can fail as a generic server error, and the product does not advertise a 100-member limit. | Decide and document Circle capacity. Enforce it before mutation with a clear response, or migrate membership out of fixed arrays so Circles can scale. |
| 🟠 P1 | “My Circles” scale | `getMyCircles` service-role lists only the newest 200 Circles globally and then filters for the current DID. Once more than 200 Circles exist, an older Circle a user belongs to can disappear from “Your circles” and from the Trade Board Circle selector. | Query membership directly by indexed membership records/canonical curator ID with cursor pagination. Never scan a fixed global newest window to determine a user's access. |
| 🟠 P1 | Directory search completeness | `/circles-directory` fetches only the newest 100 public Circles, then searches name/description in the browser. A matching older Circle is impossible to find even with an exact query. | Add server-side indexed search over the full public Circle corpus with cursor pagination and deterministic filters. |
| 🟠 P1 | Discovery starvation/spam | Any authenticated user can directly create unlimited public Circle rows. Discovery is newest-first with fixed 50/100 windows, so one account can flood new Circles and push legitimate communities out of both discovery surfaces. | Move creation through a backend with per-account rate/count limits, abuse signals and moderation hooks. Rank/search from the full eligible corpus rather than a newest-only window. |
| 🟠 P1 | Circle reporting | CircleDetail has no Report action and `ContentReport.content_type` does not support Circle. Scam, harassment, impersonation or abusive Circle names/descriptions cannot be reported through the standard moderation workflow. | Add Circle as a reportable subject with backend existence/visibility checks, moderation queue support and reporter privacy. |
| 🟠 P1 | Circle creation moderation | Circle names/descriptions/regions are written directly from the browser with no server-side moderation, bot protection, rate limit or trust check before becoming publicly discoverable. | Put public Circle publication behind an authenticated backend create/update service with rate limits, text moderation and enforcement-state checks. |
| 🟠 P1 | Curator lifecycle | No normal Circle edit, delete, archive, curator-transfer or ownership-recovery UI was found. Curators also cannot leave their own Circle, leaving no user-facing lifecycle path other than hidden/direct entity operations. | Add audited edit/archive/delete/transfer controls. Transfer must require recipient acceptance and should never silently rewrite curator identity. |
| 🟠 P1 | Member moderation | No kick, ban, temporary removal, role/moderator delegation or rejoin policy exists. A curator cannot manage abusive members through a supported flow. | Add server-authoritative member moderation with reason/audit records, blocked rejoin enforcement and narrowly scoped moderator roles. |
| 🟠 P1 | Account erasure of memberships | `delete-account` and moderator force-delete remove Circle rows owned by the deleted account and their CircleExit rows, but do not remove the user's DID/profile snapshot from Circles curated by other accounts. A deleted user's identity can remain in `member_dids`/`member_profiles`, including public Circles. | During account deletion/enforcement, remove or tombstone the user's membership records across all Circles, refresh public projections/PDS records, and prove erasure with tests. |
| 🟠 P1 | Circle data portability | `export-my-data` exports only Circle rows the user created. It omits CircleExit and cannot export memberships stored inside someone else's Circle row, so the user's joined-Circle and exit history is incomplete. | Export authoritative membership/invite/exit records belonging to the user, including Circle references and timestamps, subject to privacy minimisation. |
| 🟠 P1 | Public membership federation transparency | Public Circles are eligible for PDS federation and `buildRecord()` includes `memberDids`, `memberProfiles` and `memberCount`. Outbound reconciliation can therefore publish local membership changes into the curator's public AT repository. The join UI does not explicitly tell a user that joining a public Circle may make their DID/profile association public/federated. | Add explicit privacy copy/consent for public membership, minimise public fields, and prefer participant-authored membership assertions if public portability is required. Never publish private/member-only membership data. |
| 🟠 P1 | Local/PDS membership consistency | `circle-membership` intentionally changes local membership without updating the public AT record at join time. Later `outbound-reconcile` may update the curator's public Circle, but it currently processes only a limited migrated-user set per run. Local membership, remote member list and counts can therefore disagree for extended periods. | Define one authoritative membership model and sync strategy. If membership is local-only, remove it from the AT Circle lexicon. If portable/public, use signed membership records plus reliable cursor-based reconciliation. |
| 🟠 P1 | Federated curator identity | `mapCircleFields()` trusts `val.curatorDid || repoDid`. A remote public Circle can claim a curator DID different from the repository that actually published the record, and local `getCircle`/`getMyCircles` treat `circle.did` as curator identity. | Derive curator DID from the authenticated repository DID. Reject/quarantine records whose embedded curator DID conflicts with repo identity. |
| 🟠 P1 | Federated member-claim integrity | Remote public Circle records can provide arbitrary `memberDids` and SwapPulse imports them as membership claims. Those claims are not signed/accepted by the named members but can influence “my circles”, shared-member recommendations and future access logic. | Treat curator-supplied member lists as unverified display claims at most. Use participant-signed/locally accepted membership records for access and personalised discovery. |
| 🟠 P1 | Starter Pack private reference disclosure | StarterPack is public-readable/federated and carries `circle_ids`. A pack can include a non-public Circle ID; StarterPackDetail then links that ID and `getCircle` reveals the hidden Circle's name/theme/member count. | Validate StarterPack Circle references server-side and permit only public/discoverable Circles in public packs. Strip/reject private/member-only IDs on create/update/import. |
| 🟠 P1 | Networking Concierge social/presence scope | **Inherited from the LLM/Agent audit:** the Concierge can read broad Presence, Follow and SpaceParticipant data and is told to filter to the user “where possible”. This is too broad for a recommendation feature and can expose more social/presence context to the model than necessary. | Replace broad entity tools with purpose-built recommendation endpoints returning only authorised candidate IDs, minimal profile fields and coarse privacy-respecting signals. |
| 🟠 P1 | Networking Concierge membership completeness | The Concierge's Circle tool is ordinary entity read access: public Circles plus Circles the user created. It cannot reliably read non-public Circles the user merely joined, yet its prompt says to use past Circle memberships and provide a network overview. | Give the agent a purpose-built user-scoped “my circles” projection rather than broad Circle reads, or narrow its capability claims to public/created Circles only. |
| 🟠 P1 | Scoped discussions capability | Help says Circle members can see/join “scoped discussions”, but Post has no Circle scope/reference and CircleDetail renders no Circle discussion feed. | Remove the claim or implement a server-authorised Circle discussion model using the same membership service and privacy rules. |
| 🟠 P1 | Scoped meetups capability | Help says Circles include Circle-scoped meetups and recommends scoping a meetup to a Circle, but Meetup has no Circle reference/scope fields and CircleDetail has no meetup section. | Remove the claim or add an explicit Circle meetup scope with membership-authorised reads/RSVPs. |
| 🟠 P1 | Circle deletion dependencies | Deleting a Circle does not reconcile dependent `TradeListing.circle_ref`, Circle-scoped Challenges, StarterPack `circle_ids` or other references. Member trades/challenges can become orphaned or inaccessible without a clear lifecycle. | Before deletion, enumerate dependencies and require archive/migration/cancellation policy. Use immutable Circle IDs plus referential cleanup/jobs and user notifications. |
| 🟠 P1 | CircleExit actor integrity | CircleExit is directly user-creatable with owner-based row RLS but caller-supplied `did`. A user can create a public exit record claiming another DID left a Circle, poisoning history/reputation and exposing a victim association. | Make CircleExit backend-only and derive the actor DID from session. Prefer an immutable membership-event stream rather than a standalone public exit entity. |
| 🟠 P1 | Dedicated security regression coverage | No dedicated Circle membership/visibility/security tests were found. Critical invariants such as forged `at_uri`, private bulk join, public-Circle scoped-trade denial, former-member denial and account-erasure cleanup are not release-gated. | Add unit/integration/adversarial tests for every P0/P1 Circle boundary and run them in CI against the exact deployment commit. |
| 🟡 P2 | Global Search coverage | Global `/search` searches cards, profiles and posts but not Circles. Circle discovery therefore exists only on dedicated pages/AI and is inconsistent with site-wide search. | Add public Circle search to the global search service after authoritative visibility filtering is implemented. |
| 🟡 P2 | Directory pagination | Circle Directory shows at most 100 results and has no continuation. | Add cursor pagination/infinite loading with stable sorting. |
| 🟡 P2 | Main Circles discovery cap | `/circles` loads at most 50 public Circles for Discover with no continuation. | Paginate and query by relevance/filter rather than a fixed newest 50. |
| 🟡 P2 | Discovery ranking | Both human discovery pages are effectively newest-first. There is no activity, shared-interest, trusted-member or user-controlled ranking mode. | Add transparent ranking options only after graph/membership integrity is fixed; always offer chronological/search alternatives. |
| 🟡 P2 | Region filter claim | Circle Directory subtitle/SEO says users can filter by region, but no region filter exists. `local_region` is only a theme and free-text region is not queryable from the UI. | Add a normalised coarse-region filter or correct the copy. |
| 🟡 P2 | Era filter claim | Circle Directory says “Filter by theme, era, or region”, but Circle has no era field/filter. | Remove “era” from the promise or add a defined era taxonomy and filter. |
| 🟡 P2 | Search request efficiency | `CircleDirectory.load` depends on `query`, so every keystroke refetches the same up-to-100 Circle set and then filters it locally; there is no debounce. | Debounce server search and send the query to an indexed backend endpoint. |
| 🟡 P2 | Discovery failure state | Circle Directory and Circles catch load errors and render empty-state results, making an outage indistinguishable from “No circles match”. | Show a retryable error/degraded state and retain cached results when possible. |
| 🟡 P2 | Join/leave feedback | CircleDetail silently ignores join/leave errors. A private-policy, capacity, race or backend failure gives the collector no explanation. | Surface success/error toasts and restore button state based on authoritative response. |
| 🟡 P2 | Guest create UX | `/circles` is public and always displays “New circle”. A signed-out user can open the composer and only fails later when identity creation/auth is attempted. | Gate creation affordance behind authentication or show an explicit sign-in flow before opening the editor. |
| 🟡 P2 | Create-dialog accessibility | CreateCircleModal is a custom overlay rather than the shared accessible Dialog/Sheet and does not demonstrate focus trap, Escape close or focus restoration. | Use the shared dialog primitive with proper labelled title/description and keyboard/focus tests. |
| 🟡 P2 | Selector accessibility | Theme and visibility chips communicate selection visually but do not expose radio/pressed-state semantics. | Implement radio groups or `aria-pressed` states with keyboard navigation. |
| 🟡 P2 | Directory localisation | `CircleDirectory.jsx` hard-codes English page text, theme labels, search placeholder and empty state while the main Circles/CircleDetail surfaces use i18n keys. | Move all Circle Directory text to the nine supported locale dictionaries. |
| 🟡 P2 | Region privacy/normalisation | Region is free text with no schema max length, granularity rule or warning not to enter a precise address. The Networking Concierge uses region for recommendations. | Store a coarse normalised region code/label, cap length and explicitly prohibit precise home addresses. |
| 🟡 P2 | Member-count integrity | `member_count` is an independently mutable owner field and public cards display it directly. It can drift from `member_dids` or be deliberately inflated as social proof. | Derive counts server-side from authoritative membership records; do not let clients set them. |
| 🟡 P2 | Member-profile cache staleness | `member_profiles` copies name/handle/avatar at join and has no refresh path. Renames/avatar changes/deletions can leave stale personal data in Circle pages and federated public records. | Resolve current profiles at read time or maintain a privacy-aware refresh/tombstone process. |
| 🟡 P2 | Scoped-trade list pagination/freshness | CircleDetail service-role fetches only the newest 50 open scoped trades and does not filter expired `expires_at` records. | Reuse the authoritative visible-trade service with expiry filtering and cursor pagination. |
| 🟡 P2 | Non-public bridge attempts | CreateCircleModal calls `bridgeCircle` for every visibility. The backend correctly rejects non-public publication, but the frontend still performs a doomed federation request and silently continues. | Mirror the Binder pattern: skip federation client-side unless visibility is public and surface an accurate “local/private” state. |
| 🟡 P2 | Membership notifications | Normal join/leave has no curator/member notification or audit-facing event, making moderation and unexpected membership changes difficult to notice. | Add privacy-respecting membership events and optional notifications through the central dispatcher. |
| 🟢 P3 | Duplicate naming | No uniqueness/disambiguation policy exists for Circle names, so discovery can contain indistinguishable communities. | Allow duplicates only with clear curator/region disambiguation, or add slug/name collision guidance. |
| 🟢 P3 | Product copy drift | Promotional copy describes Circles as “invite-only collector groups”, while public Circles are one-click join and private Circles have no real invitation workflow. | Align marketing/help copy with the deployed membership modes. |
| 🟢 P3 | Portability wording | Circle schema/lexicon copy says membership is portable across PDSs, but current joins are explicitly local state and do not create participant-authored portable membership records. | Describe only Circle metadata as portable until a real membership protocol exists. |
| 🟢 P3 | Audit build verification | The Base44 command sandbox had no app checkout/package manifest, so build/lint/typecheck and executable Circle regression tests could not be run. | Run exact-commit CI build/test gates and attach the results to the Circle re-audit. |

## Feature-by-feature verdict

| Feature | Verdict | Notes |
| --- | --- | --- |
| `/circles` discovery | Incomplete | Newest 50 public rows only; no pagination/ranking and spam-starvable. |
| `/circles-directory` | Incomplete | Theme/search works only over newest 100; region/era promises are not implemented. |
| Circle creation | Not release ready | Direct client creation controls identity/reference/membership fields and lacks abuse controls. |
| Public Circles | Functional but unsafe for scoped authorisation | Public discoverability currently grants circle-scoped trade access through shared helper. |
| `members_visible` Circles | Broken/incoherent | Hidden in UI, yet direct backend join succeeds if ID is known. |
| Private Circles | No legitimate onboarding | Normal join blocked; no invite/approval model; Starter Packs bypass the block. |
| Join/leave | Good intent, weak model | Backend actor binding is good, but arrays/races/capacity/audit issues remain. |
| Member list | Privacy/integrity work required | Curator can claim members; public associations may federate; stale cache remains. |
| Circle-scoped trades | Release blocker | Membership check treats public Circle as authorisation and trusts shadowable Circle rows. |
| Circle-scoped challenges | Release blocker | Submission/leaderboard membership not enforced. |
| Circle discussions | Not implemented | Documentation overclaims. |
| Circle meetups | Not implemented | Meetup model has no Circle scope. |
| Starter Pack Circle recommendations | Release blocker | Public pack references can bypass private Circle join policy. |
| Networking Concierge recommendations | Not release ready | Inherited AI output-security issue, spoofable Follow graph and overbroad social/presence scope. |
| AT Protocol publication policy | Strong | Non-public Circles are correctly rejected from PDS federation. |
| Federated Circle identity/membership | Weak | Embedded curator/member claims are not independently authoritative. |
| Account deletion/export | Incomplete | Foreign-Circle memberships survive deletion and are absent from export. |
| Moderation/reporting | Missing | No Circle report path or supported member moderation lifecycle. |
| Global search | Missing Circle support | Dedicated directory only. |

## Verified strengths to preserve

- The central `federationPolicy.ts` explicitly recognises AT repositories as public and only allows Circles with `visibility === 'public'` to federate.
- `atproto-bridge` independently applies the publication policy on create and update, so the frontend's attempted private Circle bridge is rejected server-side.
- Inbound firehose ingestion also refuses non-public Circle records, avoiding amplification of remote pseudo-private AT records.
- `seo-sitemap` filters Circle detail pages to `visibility: 'public'`.
- Normal `circle-membership` derives the joining/leaving DID from the authenticated user and refuses direct private-Circle join.
- Ordinary Circle update/delete RLS is limited to the creator or admin, so members do not automatically gain write access to the curator's row.
- `getCircle` withholds full details/member list/scoped trades from denied viewers, even though its reduced metadata response is still too revealing.
- Circle-scoped trade creation uses `getMyCircles` and requires a Circle reference in the normal UI.
- The Networking Concierge agent is read-only; it does not itself join Circles or mutate memberships.
- Audit-visible entity data currently contains no Circle, CircleExit or StarterPack records, so there is no evidence of an already-populated private community corpus being exposed by these defects.

## Remediation order

### Phase 0 - rebuild the membership trust boundary

1. Create a server-authoritative CircleMembership model keyed by immutable Circle ID + member user/DID, with states such as invited/requested/active/left/kicked/banned.
2. Make Circle creation backend-only for curator identity, canonical reference and federation metadata.
3. Enforce unique canonical Circle references and stop resolving access from “newest Circle with this at_uri”.
4. Make `canViewCircleContent` membership-only when called for scoped resources. Circle visibility must never substitute for membership.
5. Route direct join, leave, Starter Pack bulk join, challenge access and all future invitation flows through the same membership service.
6. Fix Follow actor binding before using Follow/shared-member signals for personalised Circle discovery.
7. Apply the inherited Networking Concierge prompt-injection/Markdown remediation.

### Phase 1 - privacy and lifecycle

1. Return no private Circle metadata to unauthorised viewers.
2. Make CircleExit/member event data private and actor-bound.
3. Implement invite/request/approval flows for private or approval-required Circles.
4. Add curator edit/archive/delete/transfer plus member kick/ban/delegated moderation.
5. Remove deleted users from all memberships/profile projections and dependent public PDS records.
6. Include joined memberships/exits/invites in account export.
7. Validate StarterPack Circle references as public/discoverable before publication.

### Phase 2 - reliable discovery

1. Replace newest-window scans with indexed server search and cursor pagination.
2. Add coarse normalised region filtering and either implement or remove era filtering.
3. Add global Circle search.
4. Add rate limits/anti-spam/moderation to public Circle creation.
5. Add transparent ranking options only after social graph and membership integrity are fixed.
6. Give Networking Concierge purpose-built recommendation projections rather than broad Presence/Follow/Circle entity reads.

### Phase 3 - portability and product completeness

1. Decide whether membership is local-only or a portable protocol object.
2. If portable, use participant-authored/signed membership records instead of curator-authored member arrays.
3. Add scoped discussions/meetups only if the product intends to support them, using the same membership authority.
4. Align Help, promotional copy and schema descriptions with the deployed model.
5. Add accessible dialogs/selectors, complete localisation and operational/error states.

## Required regression and adversarial tests

Before declaring Circle Discovery release ready, test at minimum:

- an authenticated user cannot create a Circle that reuses another Circle's canonical reference;
- a forged local Circle row cannot grant access to any scoped resource;
- a non-member cannot read a `circle_scoped` TradeListing even when the Circle is public;
- former/kicked/banned members lose scoped access immediately;
- Starter Pack bulk join cannot join private/approval-required Circles without a valid invite/approval;
- arbitrary StarterPack `circle_ids` cannot disclose or enrol a private Circle;
- `members_visible` semantics are consistent in directory, detail and backend membership;
- a Circle curator cannot fabricate an accepted membership for another collector;
- simultaneous joins/leaves cannot lose membership updates;
- Circle capacity produces an explicit deterministic result;
- an older membership remains visible after more than 200 global Circles exist;
- exact search finds a Circle beyond the newest 100 records;
- Circle creation spam cannot monopolise discovery windows;
- unauthorised callers get no private Circle name/theme/member count/SEO metadata;
- CircleExit/member event records are not publicly readable or actor-spoofable;
- account deletion removes the user's membership/profile traces from Circles owned by others;
- data export includes the user's membership/invite/exit history;
- a remote Circle cannot claim a curator DID different from its repository DID;
- remote curator-supplied member lists are never treated as authoritative access without member consent;
- public membership federation is explicit and privacy-safe;
- circle-scoped Challenge submission/leaderboard/rewards reject non-members and former members;
- Networking Concierge cannot exfiltrate private/social data through malicious Circle text or Markdown;
- spoofed Follow rows cannot influence another user's Circle recommendations;
- Networking Concierge only receives minimum authorised recommendation data;
- Circle reports enter the moderation queue and cannot report invisible/private subjects without authorisation;
- deleted Circles reconcile dependent trades/challenges/packs safely;
- directory/main discovery pagination covers the complete public corpus;
- all Circle Directory strings work in the nine supported languages;
- keyboard/focus interaction passes on Circle creation and filters;
- exact deployment commit passes build, typecheck/lint and Circle security regression suites.

## Release decision

**Do not treat Circle Discovery as release ready while the P0 findings remain.**

The central fix is to stop treating the `Circle` document itself as both public community metadata and an access-control list. SwapPulse should have an immutable Circle identity plus a separate server-authoritative membership service. Once trades, challenges, Starter Packs, recommendations and deletion/export all consume that one membership authority, the existing public-directory UI and public-only federation policy can be retained and hardened rather than rewritten.