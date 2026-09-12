# SwapPulse Pull of the Week Full Feature Audit

**Audit date:** 12 September 2026  
**Scope:** Pull of the Week nomination, eligibility/provenance, weekly bucketing, voting, duplicate/replay protection, tally integrity, leader/winner calculation, closing/finalisation, archive/hall of fame, card/post evidence, moderation, notifications, achievements/rewards, AT Protocol publication/ingestion/discovery, deletion/export/import, UI/UX, accessibility, localisation, abuse controls and release testing  
**Overall score:** **8/100**  
**Risk:** **Critical / High Risk**  
**Release status:** **NOT RELEASE READY**  
**Status:** **Source/schema/data audit complete; exact-release build/typecheck/test verification unavailable**

| Priority | Area | Finding | Required action |
| --- | --- | --- | --- |
| 🔴 P0 | PW-001 - Voting for another collector is broken | The Vote action first creates a `PullVote`, then performs `PullNomination.update(nominationId, { vote_count: ... })`. `PullNomination` update RLS is owner/admin-only. A normal voter therefore cannot increment another collector's nomination. The vote row can be created before the counter update fails, leaving a stranded vote while the displayed tally remains unchanged. | Replace both browser writes with one backend `cast-pull-vote` operation that validates the voter and nomination, enforces policy, writes the vote and updates/derives the tally atomically. Direct client updates of nomination tallies must be blocked. |
| 🔴 P0 | PW-002 - Nomination owners can forge the leaderboard | `vote_count` is an ordinary owner-editable field on `PullNomination`. A nomination owner can set their own score to any integer through the entity API, independent of `PullVote` rows, and the page sorts/renders the leaderboard directly from that value. | Make tally fields backend-only or remove stored tallies entirely. Compute results from authoritative immutable vote records or update a protected aggregate transactionally. Add tamper tests. |
| 🔴 P0 | PW-003 - One-vote-per-week is not an authoritative invariant | `PullVote` claims “One vote per user per week” but has no database/server uniqueness for voter+week. RLS only binds record ownership. A caller can create multiple `PullVote` records directly, bypassing the UI-only `myVote` guard. | Enforce a unique voter/week key server-side, derive the voter from the authenticated session, reject duplicates and make retries idempotent. |
| 🔴 P0 | PW-004 - Vote creation and tally mutation are non-atomic | Voting is two independent browser writes. Network errors, RLS failures, retries, double-clicks or concurrent voters can leave vote rows and tally values permanently divergent. There is no rollback or reconciliation transaction. | Perform vote creation and tally derivation in one authoritative backend operation. Prefer deriving totals from vote rows; otherwise use an atomic increment protected by a unique vote insertion and reconciliation job. |
| 🔴 P0 | PW-005 - A nomination does not prove a real pull | The nomination form accepts free-text card name, card ID, image URL, rarity and set. It does not require an existing pack-opening post, CollectionEntry, media evidence or trusted TCGDex selection, and it does not prove the card was pulled by the nominator or during the stated week. A fabricated card can enter the contest as a “best pull”. | Define the contest evidence model. At minimum select a canonical TCGDex card and bind the nomination to an authenticated pack-opening post owned by the nominator with a server-validated timestamp inside the eligible week. Clearly label any remaining self-reported evidence. |
| 🔴 P0 | PW-006 - The weekly contest never becomes a final authoritative result | There is no voting-close job, finalisation function, immutable winner record, completed-week state or winner snapshot. The UI only labels the highest current mutable `vote_count` as the leader. Old nominations and counts remain owner-editable, so there is no trustworthy “winner” to announce or archive. | Add a server-owned weekly contest state with canonical start/close timestamps, finalisation, tie handling, immutable winner snapshot and post-finalisation mutation rules. Archive only finalised results. |
| 🔴 P0 | PW-007 - A remote repository can self-assign any federated score | `org.swappulse.pullNomination` carries `voteCount`, and `mapPullNominationFields()` trusts the remote record's `voteCount` directly. The Pull of the Week page then ranks that local value. A remote author in an ingested repository can publish a current-week nomination with an arbitrarily high count and become leader without any verifiable votes. | Never trust federated aggregate vote counts as contest authority. Federate verifiable vote events or keep voting explicitly instance-local, and calculate the local result only from trusted vote records. |
| 🔴 P0 | PW-008 - Federated nominator identity can be impersonated | `mapPullNominationFields()` stores `did: val.nominatorDid || repoDid`. AT repositories are signed by their repository DID, but the mapper lets a record claim another collector's DID and displays self-asserted name/handle/avatar metadata. This breaks contest attribution and can make an attacker appear to be the victim. | Bind nomination authorship to the source repository DID. Treat an embedded `nominatorDid` as redundant and require it to match the repo DID if retained. Resolve display metadata from the verified actor profile. |
| 🔴 P0 | PW-009 - Nomination publishing bypasses the federation opt-out boundary | The current nomination UI calls `atproto-bridge` directly after local creation. `atproto-bridge` does not check the Do Not Sell/Share federation preference. This is the same unresolved canonical-publication consent failure identified in the AT Protocol audit, and Pull of the Week exercises that bypass directly. | Enforce federation consent fail-closed inside every canonical PDS create/update/retry path, including `atproto-bridge`. Test opt-out before nomination, after withdrawal and during retries. Preserve this P0 until verified fixed. |
| 🔴 P0 | PW-010 - The outbound nomination record does not match the canonical Lexicon | The UI sends `cardId` to `atproto-bridge`, while `org.swappulse.pullNomination` revision 1 requires `cardUri`. The normal outbound record is therefore non-conformant with SwapPulse's published Lexicon even though the local entity uses `card_id`. | Stop hand-building the PDS payload in the page. Publish through the canonical backend `buildRecord`/bridge path so the emitted field is `cardUri`, validate the record against the Lexicon before write, and add contract tests. |
| 🔴 P0 | PW-011 - PDS publication success is never attached to the local nomination | The page creates a stamped local row, then calls `atproto-bridge` without awaiting/storing its returned real URI, CID, DID or content hash. The local row remains on simulated metadata with `bridged:false`. Reconciliation only processes already-bridged rows, and a later ingest of the real PDS record can become a separate local nomination. | Publish through `bridge-record`/`publishRecord` or an equivalent backend transaction that writes the real PDS identity back to the same local row, records delivery status and supports idempotent retry/deduplication. |
| 🟠 P1 | PW-012 - ISO week keys use the wrong year at year boundaries | The page combines calendar year `format(now, 'yyyy')` with `getISOWeek(now)`. For example, 29 December 2025 is ISO week 1 of 2026 but the code produces `2025-W01`; 1 January 2027 belongs to ISO week 53 of 2026 but is labelled `2027-W53`. | Use the ISO week-numbering year (`RRRR`/`getISOWeekYear`) together with ISO week number and add New Year boundary tests. |
| 🟠 P1 | PW-013 - The browser clock and timezone define contest membership | `weekKey` is calculated once from the client's local `new Date()`. Different timezones can enter a new week at different moments, and a manipulated device clock can move the UI into a past/future contest bucket. | Define a canonical contest timezone and server time. Return the active contest/week from a backend endpoint and ignore caller-selected current-week values for nomination/voting. |
| 🟠 P1 | PW-014 - Arbitrary week keys are accepted at the write boundary | `PullNomination` and `PullVote` only require a string `week_key`; no backend validates it against the active contest. Direct API callers can create records in past, future or malformed week buckets. | Make week assignment server-derived. Add a strict format constraint for stored historical keys and reject voting/nominating outside the active window. |
| 🟠 P1 | PW-015 - Users can submit unlimited nominations per week | There is no uniqueness or quota for nominator+week. The UI button remains available after nomination, so a collector can submit multiple entries and occupy the contest repeatedly. | Define the nomination quota, normally one entry per collector per week, and enforce it server-side with a unique key/idempotent submission. |
| 🟠 P1 | PW-016 - Self-voting is allowed and is the only ordinary vote whose tally update can currently pass RLS | No policy prevents a nominator voting for their own entry. Because owners are permitted to update their own `PullNomination`, the current broken client flow can actually increment a self-vote while cross-owner votes fail. | Decide and document self-vote policy. For a fair contest, reject it in the backend vote operation and test it explicitly. |
| 🟠 P1 | PW-017 - Vote target integrity is not validated | `PullVote.create` accepts any `nomination_id` and caller-supplied `week_key`. There is no server check that the nomination exists, belongs to the same active week or is eligible/open for voting. | Load the target nomination server-side during voting and validate existence, active week, candidate state and voting window before writing a vote. |
| 🟠 P1 | PW-018 - Vote rows are mutable | `PullVote` owners can update their vote row after creation, including `week_key` and `nomination_id`, without recalculating any tally. | Make vote choice immutable after cast, or implement a backend `change-vote` transaction that atomically moves the vote and recalculates results according to explicit policy. |
| 🟠 P1 | PW-019 - Vote deletion does not undo the tally | `PullVote` owners can delete votes, but no hook decrements/recalculates `PullNomination.vote_count`. | Either prohibit vote deletion during a contest or route it through a server operation that atomically updates the authoritative result. |
| 🟠 P1 | PW-020 - Nominations can be rewritten after voting begins | Owners can update the entire nomination row, including week, card identity, image, post URI, DID and federation metadata, while retaining accumulated `vote_count`. A nominated card can therefore be swapped after receiving votes. | Freeze identity/evidence fields once voting opens. Use backend-controlled edit rules and a revision/audit model for permitted corrections. |
| 🟠 P1 | PW-021 - Nomination deletion leaves orphan votes | Owners can delete a nomination directly. No cascade or cleanup of `PullVote.nomination_id` records exists. | Route withdrawal/deletion through the backend, handle linked votes deterministically, and preserve an audit-safe tombstone if a contest record must be disqualified rather than erased. |
| 🟠 P1 | PW-022 - There is no candidate state model | Nominations have no pending, eligible, disqualified, withdrawn or finalised state. Moderators cannot exclude an invalid nomination without deleting/editing generic data. | Add backend-owned candidate status, reason, reviewer and timestamps with explicit allowed transitions. |
| 🟠 P1 | PW-023 - Tie behaviour is undefined | The page treats the first item returned by `-vote_count` as leader and has no deterministic tie policy or multi-winner state. Equal scores can produce arbitrary visual leadership. | Define tie-breaking or co-winner rules server-side and persist the final decision in the winner snapshot. |
| 🟠 P1 | PW-024 - There are no canonical contest start/close timestamps | The contest is inferred solely from `week_key`. There is no stored opens_at, closes_at or finalised_at value, so clients cannot reliably know when voting closes. | Create a weekly contest/window entity or backend configuration with canonical offset-aware timestamps and publish the deadline to clients. |
| 🟠 P1 | PW-025 - The advertised Hall of Fame does not exist | Help/docs say past winners are archived and browsable, but the page only queries the current week and exposes no historical winner/archive route or data model. | Implement a finalised weekly-result archive with previous-week navigation, or remove the Hall of Fame claim until it exists. |
| 🟠 P1 | PW-026 - Voting policy contradicts the documentation | Help and GitBook say users can “vote on multiple nominations”, while the UI/entity description implements one vote per user per week. | Choose one voting rule and enforce it server-side. Update Help, GitBook, schema descriptions and UI to the same policy. |
| 🟠 P1 | PW-027 - The nomination workflow contradicts the documentation | Help says users select a card they pulled, attach the card and add a description. The actual form is free-text fields and has no card picker, no attached pack-opening post and no nomination description input. | Either implement the documented picker/evidence/description flow or rewrite the documentation to match the deliberately supported workflow. |
| 🟠 P1 | PW-028 - Card ID is labelled optional although it is required by both local schema and Lexicon | The UI says `Card ID (optional)` and enables submission with card name only, but `PullNomination` requires `card_id` and the Lexicon requires `cardUri`. An empty string can be submitted as the required value. | Make canonical card selection required and enforce a non-empty valid TCGDex identifier server-side. |
| 🟠 P1 | PW-029 - Card identity is not validated against TCGDex | Card ID, name, rarity and set are independently typed fields. A caller can combine a real ID with a fake name/rarity/set or invent all of them. | Resolve card metadata from the canonical TCGDex card ID server-side and ignore caller-supplied derived metadata. |
| 🟠 P1 | PW-030 - The normal UI never records the claimed source pack-opening post | `PullNomination.post_uri` exists specifically to reference the original pack-opening post, but the nomination form never asks for or sets it. | Nominate from an existing eligible pack-opening post or require/select one during submission and persist its authoritative AT URI/CID. |
| 🟠 P1 | PW-031 - Supplied source post references are not verified | Even when `post_uri` is written through the API/federation, no nomination backend proves that the post exists, is a pack-opening post, belongs to the nominator, contains the nominated card or falls inside the active week. | Resolve and validate source post ownership/type/card/time server-side before eligibility is granted. |
| 🟠 P1 | PW-032 - Evidence is not bound to a post version | The Lexicon stores only `postUri`, not the source post CID/version. A referenced post can be edited after nomination without the nomination proving which content was judged. | Store a strong reference containing URI and CID, or snapshot the minimum verified evidence/hash used for eligibility. |
| 🟠 P1 | PW-033 - User-supplied card images can load arbitrary external origins | `card_image` is a free-text URL rendered directly in `<img src>`. A nomination can make every viewer's browser request an attacker-controlled URL, exposing normal web-request metadata such as IP address and user agent to that host. | Use trusted catalogue/CDN images or proxy/allowlist remote media with privacy-preserving fetch/referrer policy. Do not render arbitrary nomination URLs directly. |
| 🟠 P1 | PW-034 - Pull votes have no AT Protocol Lexicon or federation path | `PullVote` describes itself as `org.swappulse.pullVote`, but no such Lexicon, collection mapping or bridge path exists. Nominations federate while the votes that are supposed to justify their scores do not. | Decide whether voting is instance-local or interoperable. If federated, define a vote Lexicon with subject strongRef, voter repo authorship and lifecycle; if local, remove cross-instance voting claims and never federate author-controlled totals as authoritative. |
| 🟠 P1 | PW-035 - Cross-instance discovery is not network-wide | `firehose-ingest` scans the local repo, followed DIDs and migrated users. It does not provide a relay/AppView index for every `org.swappulse.pullNomination` on the network. Publishing a custom Lexicon does not by itself create a global Bluesky contest directory. | Build/query a dedicated relay/indexer for this Lexicon or document the discovery boundary accurately. |
| 🟠 P1 | PW-036 - Remote nomination edits become stale after initial ingest | Firehose high-water logic skips records at/below the cursor; CID edit detection is special-cased only for `app.bsky.feed.post`. Later edits to a remote PullNomination's metadata or score may never update locally. | Process custom-record update commits or compare CIDs/revisions for PullNomination and other mutable custom records. Add remote create/update/delete integration tests. |
| 🟠 P1 | PW-037 - Spoofed nominator DID can evade normal repository delete reconciliation | Inbound mapping stores the record-claimed `nominatorDid` as local `did`, but delete detection searches bridged rows by the source repository DID. A malicious record claiming another DID can fall outside its actual repo's normal cleanup query. | Persist `source_repo_did` independently and reconcile create/update/delete by authoritative AT URI/repository identity, never a self-asserted author field. |
| 🟠 P1 | PW-038 - Federation source provenance is not stored separately | PullNomination has only one `did` field, conflating asserted nominator identity with the repository that delivered the record. | Add immutable source repository/provenance fields for inbound federated records and use them for trust and lifecycle reconciliation. |
| 🟠 P1 | PW-039 - Nomination federation errors are silently swallowed | The UI invokes `atproto-bridge(...).catch(() => {})` and immediately closes the modal. Users get no local-only/pending/failed/published state and no retry control. | Use a durable outbox/publication state with safe error codes, retries and user-visible federation status. |
| 🟠 P1 | PW-040 - Users without a valid personal PDS identity can silently fail federation | `atproto-bridge` requires a valid personal AT identity for non-admin publication, while the page treats federation as non-fatal and hides errors. Locally generated/fallback identities can therefore create a local nomination that never becomes a real AT record. | Gate federation on resolved personal PDS identity and show accurate local-only status; provide an explicit migration/connect flow rather than silently claiming federation. |
| 🟠 P1 | PW-041 - Repository export omits PullNomination | `export-repo` does not include `PullNomination` even though it is presented as a portable federated custom record. | Add canonical PullNomination records to repository export once publication metadata is trustworthy and round-trip test export/import. |
| 🟠 P1 | PW-042 - Account deletion omits nominations and votes | `delete-account` omits both `PullNomination` and `PullVote`. A deleted account can leave local contest entries/votes behind, and public nomination PDS records are not individually deleted. | Include both entities in erasure, propagate public nomination deletes to the user's PDS before local unlinking, and handle finalised historical results under an explicit retention/anonymisation policy. |
| 🟠 P1 | PW-043 - Moderator force-delete omits nominations and votes | `enforcement` cleanup also omits `PullNomination` and `PullVote`, so a force-deleted or abusive account can leave contest content/results visible. | Include nomination/vote cleanup or disqualification in enforcement and make public discovery consult active enforcement state. |
| 🟠 P1 | PW-044 - Pull nominations cannot be reported through ContentReport | `ContentReport.content_type` does not include pull nominations. Users cannot report fake, abusive, impersonating or inappropriate nomination content as the contest object itself. | Add `pull_nomination` as a reportable type with safe preview/evidence fields and moderator actions. |
| 🟠 P1 | PW-045 - Nominations have no moderation/quarantine state | PullNomination lacks moderation labels/status/reviewer fields and the page lists raw public nominations immediately. | Apply the platform's authoritative moderation/enforcement policy before discovery, with disqualification rather than silent score manipulation. |
| 🟠 P1 | PW-046 - Account enforcement is not applied to contest discovery | The page directly queries public PullNomination rows and does not filter suspended/shadow-banned/deleted authors. Combined with cleanup omissions, sanctioned accounts can remain visible and competitive. | Query through a server discovery endpoint that enforces active account/content state before returning candidates. |
| 🟠 P1 | PW-047 - Pull of the Week has no notification lifecycle | No notification type/producer was found for nomination accepted, vote received, voting closing, winner announced, disqualified entry or new-week reminder. Generic `pack_pull` is not a contest result workflow. | Define typed contest notifications and route them through the central preference, push and quiet-hours controls. |
| 🟠 P1 | PW-048 - Nomination and voting bypass backend abuse controls | Both actions are direct entity writes. No contest-specific rate limit, risk check, captcha threshold or account-age/eligibility gate was found. | Put nomination/vote mutations behind backend abuse controls with per-account velocity limits and bot-protection telemetry. |
| 🟠 P1 | PW-049 - Nomination submission is not idempotent | Repeated requests/tabs can create duplicate nominations because there is no submission key or server uniqueness. | Use a unique nominator+week constraint and idempotency key in the backend nomination operation. |
| 🟠 P1 | PW-050 - Vote submission is not idempotent | Retries can create multiple PullVote rows because there is no idempotency token or authoritative uniqueness constraint. | Make `cast-pull-vote` idempotent and return the existing vote for repeated equivalent requests. |
| 🟠 P1 | PW-051 - There is no tally reconciliation from vote records | No job/function recalculates `vote_count` from PullVote rows. Once drift occurs, there is no authoritative repair mechanism. | Make vote rows the source of truth and provide a reconciliation invariant/test that recomputes or verifies aggregates before finalisation. |
| 🟠 P1 | PW-052 - Vote records do not record the authenticated voter DID | The normal `PullVote.create` writes `week_key`, `nomination_id` and `voter_name`, but not `did`. The record cannot be tied to the voter's decentralised identity from its own fields. | Derive and store the authenticated voter DID server-side where legitimately needed, while continuing to use immutable account ID for local uniqueness. |
| 🟠 P1 | PW-053 - Core contest fields lack structural constraints | `week_key` has no pattern; card/name/set fields lack useful length/canonical constraints; `vote_count` has no minimum. Malformed week keys, oversized metadata and negative/absurd scores can be stored. | Add strict schema/backend validation: ISO week pattern, canonical card IDs, bounded text, trusted URI rules and non-negative server-owned tallies. |
| 🟠 P1 | PW-054 - The Lexicon does not require repository-bound nominator identity | `nominatorDid` is optional even though consumer code treats it as authorship. This encourages consumers to trust an unbound optional field rather than repository provenance. | Either remove redundant author DID from the record or require equality with the repository DID in application validation and document repository DID as authoritative. |
| 🟠 P1 | PW-055 - Imported repository nominations can preserve forged embedded identity/score | `import-repo` can recreate supported custom records in the importing user's repo, after which the generic mapper still trusts embedded `nominatorDid` and `voteCount`. The imported repository identity is not used to overwrite those trust-sensitive fields. | Validate imported PullNomination records against contest invariants and bind authorship to the importing repository DID. Never import vote aggregates as authoritative results. |
| 🟠 P1 | PW-056 - Contest decisions have no dedicated audit log | There is no durable record of eligibility review, disqualification, close, tie resolution, final tally or winner finalisation. | Add contest audit events with actor, reason, timestamps and immutable final-result references. |
| 🟠 P1 | PW-057 - Profile activity does not include nominations or wins | `get-activity` omits PullNomination/PullVote/final winner activity. This makes the feature inconsistent with other social/community actions and leaves no authoritative public “won Pull of the Week” projection. | Decide which contest activity is public, then project verified nominations/finalised wins only, not mutable leader state. |
| 🟡 P2 | PW-058 - Current-week discovery is capped at 50 nominations | The page requests at most 50 nominations and offers no cursor/load-more path. | Add deterministic server pagination and a clear total/result navigation model. |
| 🟡 P2 | PW-059 - There is no contest search or filtering | Users cannot filter by set, rarity, nominator, newest or finalised state. | Add useful filters after canonical card and contest-state models are trustworthy. |
| 🟡 P2 | PW-060 - The page has no realtime refresh strategy | Nominations/votes are loaded on mount and after the current user's actions only. Other voters' changes require a reload to appear. | Add safe realtime invalidation or periodic/manual refresh against the authoritative server result. |
| 🟡 P2 | PW-061 - Load failures are presented as an empty contest | `loadData` catches errors by setting nominations to `[]`, which makes backend/network failure indistinguishable from “No nominations yet”. | Preserve an explicit error state with retry rather than showing a false empty result. |
| 🟡 P2 | PW-062 - The active week and deadline are not shown | The page does not display the canonical week key, date range, voting deadline or time remaining. | Show server-supplied contest dates/deadline in the user's locale/timezone, with an accessible closing countdown if desired. |
| 🟡 P2 | PW-063 - Users cannot browse previous weeks | The page is hard-wired to the current client-derived week and exposes no previous/next week or history navigation. | Add archive/week routes backed by finalised result records. |
| 🟡 P2 | PW-064 - Nominator identity is not navigable | Name/avatar are static; users cannot open the nominator's authoritative profile from a contest card. | Link to the verified DID/profile and avoid relying on cached self-asserted display text. |
| 🟡 P2 | PW-065 - Nominated cards are not linked to canonical card details | Even when `card_id` exists, the contest card has no link to the TCGDex-backed SwapPulse card page. | Make validated card identity navigable and display canonical set/rarity metadata. |
| 🟡 P2 | PW-066 - Most Pull of the Week UI is untranslated | French, German, Spanish, Italian, Portuguese, Japanese, Chinese and Korean translation files contain only the Pull of the Week title/subtitle. Nomination, voting, errors and form labels exist only in English and therefore fall back. | Translate every `page.pullOfTheWeek.*` key for all supported locales and add translation-completeness tests. |
| 🟡 P2 | PW-067 - Form placeholders are hard-coded English | `Charizard ex`, `sv3-215`, `https://...`, `Rare Holo` and `Scarlet & Violet` are embedded directly in JSX. | Move user-facing examples/placeholders into localisation or use locale-neutral catalogue pickers. |
| 🟡 P2 | PW-068 - Nomination modal lacks robust dialog accessibility | The custom overlay has no shared Dialog semantics, `role=dialog`, `aria-modal`, focus trap, initial-focus policy or Escape-key handling. | Use the shared accessible Dialog component and add keyboard/screen-reader tests. |
| 🟡 P2 | PW-069 - No vote-in-progress state exists | Vote buttons remain enabled while the async two-write action is running, so rapid clicks can issue overlapping requests before `myVote` is set. | Add a per-vote submitting state immediately, while relying on backend idempotency/uniqueness for real protection. |
| 🟡 P2 | PW-070 - Local nominations omit avatar data used by the card | The normal stamped local record writes nominator name/handle but not `nominator_avatar`, although the card renders that field. | Populate display metadata from the authenticated profile projection or resolve it by DID at render time. |
| 🟡 P2 | PW-071 - The current leader UI does not communicate ties | Only `nominations[0]` receives the trophy/banner even when several entries share the same score. | Detect ties in the presentation and show “tied for lead” until the server finalises according to the chosen tie policy. |
| 🟡 P2 | PW-072 - The documented nomination description is not rendered or collected | PullNomination has a generic `description` field, but the form never collects it and cards never show it, despite Help instructing users to add a description. | Either implement a bounded nomination story/description consistently or remove it from Help/schema if unnecessary. |
| 🟡 P2 | PW-073 - `cardUri` is semantically misleading in the Lexicon | The Lexicon field is named `cardUri` but the product treats it as a plain TCGDex card ID such as `sv3-215`, not a URI. | Rename in a versioned Lexicon to `cardId`/`catalogCardId` or formally define the identifier syntax so interoperating clients do not assume URI semantics. |
| 🟡 P2 | PW-074 - Dedicated Pull of the Week regression tests are absent and exact-release gates could not be rerun | No PullNomination/PullVote tests are visible through source search. The connected command sandbox mounts an empty `/workspace` without `package.json`, so build, lint, typecheck and runtime/E2E gates could not be rerun against the exact app checkout. | Add unit/integration/adversarial tests for nomination, voting, week rollover, finalisation and federation, and run the normal CI/release gates against the canonical release commit. |
| 🟢 P3 | PW-075 - The PullNomination Lexicon is duplicated manually | `base44/lexicons/org.swappulse.pullNomination.json` is manually mirrored in `base44/shared/lexiconRegistry.ts`, creating schema-drift risk such as the current outbound field mismatch. | Generate the deployable registry/types from canonical Lexicon JSON and fail CI when generated artefacts drift. |

## Executive summary

Pull of the Week is **not currently a trustworthy voting contest**. The most serious local bug is structural: a voter can create a `PullVote` for someone else's nomination, but cannot update that nomination's `vote_count` because nomination updates are restricted to the nomination owner/admin. The vote can therefore become stranded. At the same time, nomination owners can directly edit their own `vote_count`, so the visible ranking can be forged without any votes at all.

The feature also has no server-enforced one-vote-per-week constraint, no atomic vote operation, no evidence that a nominated card was really pulled by the nominator that week, and no weekly closing/finalisation/winner record. What the page calls a leader is simply the first mutable row returned after sorting by a mutable counter.

Federation makes the integrity problem worse rather than fixing it. Remote PullNomination records can self-assert both `voteCount` and `nominatorDid`; the mapper trusts both, even though AT Protocol repository authorship is established by the repository DID. The normal outbound UI additionally emits `cardId` even though the canonical Lexicon requires `cardUri`, bypasses the user's federation opt-out by calling `atproto-bridge` directly, and discards any real PDS URI/CID returned by that publication attempt.

The published docs overstate several features that are not implemented: multiple votes per user, selecting/attaching the pulled card, adding a nomination description, automatic end-of-week closing, winner announcement and a historical Hall of Fame.

The audit-visible dataset contained **0 PullNomination records and 0 PullVote records** in this session. That is an audit-visible observation only, not a claim that every deployment contains no records, and it is not evidence that the source-level failures are safe.

The required Base44 web-agent README returned **HTTP 403 Forbidden** both externally and from the Base44 sandbox. Source/schema/entity access remained available. The command sandbox exposed an empty `/workspace` with no package manifest, so exact-release build/lint/typecheck/E2E verification could not be performed.

No functional code or production data was changed during this audit. Only this audit report and downloadable artefacts were created.

## Current feature reality

| Capability | Current state | Verdict |
| --- | --- | --- |
| Nominate a card | Present | Free-text/self-reported, weak provenance |
| Canonical card picker | Not implemented | No TCGDex validation |
| Bind to real pack-opening post | Not implemented | `post_uri` unused by normal UI |
| One nomination per collector/week | Not enforced | Unlimited direct/client submissions |
| Cast a vote | Present but broken | Cross-owner tally update fails RLS |
| One vote per week | UI intention only | No backend uniqueness |
| Authoritative tally | Broken | Owner-editable aggregate |
| Self-vote policy | Not enforced | Self-vote can count |
| Automatic weekly close | Not implemented | No contest scheduler/state |
| Final winner record | Not implemented | Only mutable current leader |
| Tie handling | Not implemented | First sorted row wins presentation |
| Winner announcement | Not implemented | No notification/result workflow |
| Hall of Fame/archive | Not implemented | Current week only |
| Moderation/reporting | Incomplete | Nomination not reportable, no candidate state |
| Personal data export | Present | PullNomination and PullVote included |
| Account deletion | Broken | Both omitted |
| AT PullNomination Lexicon | Present | Revision 1, but normal outbound shape mismatches |
| AT PullVote Lexicon | Not implemented | Votes are not interoperable |
| Cross-instance score integrity | Broken | Remote `voteCount` is self-asserted |
| Cross-instance identity integrity | Broken | Remote `nominatorDid` is trusted |
| Localisation | Partial | Detailed UI English-only outside title/subtitle |
| Dedicated tests | Not found | Exact release sandbox unavailable |

## Score breakdown

| Area | Score | Notes |
| --- | ---: | --- |
| Voting/result integrity | 0/25 | Cross-owner votes fail while owners can forge totals. |
| Nomination provenance/eligibility | 1/15 | Required card ID exists, but evidence and catalogue validation do not. |
| Weekly lifecycle/finalisation | 0/15 | No close, immutable winner or archive. |
| Identity/permissions/abuse resistance | 1/10 | Basic owner RLS exists but protects the wrong trust fields. |
| Federation/interoperability | 1/15 | Lexicon exists, but payload, provenance, vote federation and sync are broken. |
| Privacy/data lifecycle/moderation | 1/10 | Personal export includes records; deletion/enforcement/reporting do not. |
| UI/UX/accessibility/localisation | 3/7 | Usable basic page/form, but major product/documentation and locale gaps. |
| Testing/operations | 1/3 | No dedicated tests found; exact release gates unavailable. |
| **Total** | **8/100** | **Critical / NOT RELEASE READY** |

## Verified strengths to preserve

- `PullNomination` is public-readable intentionally while `PullVote` read access is restricted to the vote owner/admin.
- Direct creation is authenticated through `created_by_id` RLS for both entities.
- A canonical `org.swappulse.pullNomination` Lexicon exists and uses a TID record key.
- The local PullNomination schema now requires `card_id` as well as week/card name, even though the UI still permits an empty value.
- The page uses translated keys for its main controls and labels rather than hard-coding all UI copy.
- Card images have a basic `alt` value using card name.
- `export-my-data` already includes both PullNomination and PullVote, which is a good foundation for data portability.
- The generic AT bridge requires authenticated publication and binds a real personal PDS session to the caller DID where available.
- The current audit-visible dataset has no Pull of the Week records, making a clean contest-model migration easier before real vote history accumulates.

## Recommended target architecture

### 1. Create a server-owned weekly contest

Use a `PullOfWeekContest`/weekly result object with:

- canonical ISO week + timezone
- opens_at / closes_at / finalised_at
- status: upcoming, nominating, voting, closed, finalised
- eligibility/rule version
- winner nomination IDs/DIDs
- tie policy/result
- immutable final tally snapshot

Clients should receive the active contest from the backend, not calculate it from their own clock.

### 2. Make nominations evidence-based

A nomination should be created through a backend function that:

- derives the nominator from auth
- resolves a canonical TCGDex card
- enforces one nomination per user/week if that is the rule
- binds to an owned pack-opening post strongRef (URI + CID) created during the eligible window
- records candidate state separately from user-editable display copy
- rejects suspended/ineligible accounts

### 3. Make votes the source of truth

Create a backend `cast-pull-vote` operation that:

- derives voter ID/DID from auth
- verifies active contest and eligible nomination
- rejects self-vote if prohibited
- enforces unique voter/week or voter+nomination according to the chosen policy
- is idempotent
- writes an immutable vote
- derives the result from vote records rather than trusting candidate-owned counters

### 4. Finalise deterministically

At close time, a backend job should freeze new votes, reconcile all votes, apply disqualification/tie rules, write the final result snapshot and emit winner/participant notifications. Historical pages should read only finalised snapshots.

### 5. Fix AT Protocol semantics

AT Protocol repositories are public, self-certifying account repositories. The repository DID is the author identity. Public nomination records can be portable, but `nominatorDid` must not override repo identity and `voteCount` must not be treated as trusted network consensus. citeturn598662search0turn598662search1

If SwapPulse wants federated voting, publish individual vote records whose authorship is the voter's repository and whose subject is a strong reference to the nomination. Otherwise keep votes explicitly local to an AppView/instance and federate only descriptive nomination metadata.

A custom Lexicon defines interoperable record structure, but application-wide discovery/ranking still requires an indexing/AppView layer; publishing a Lexicon alone does not create a global contest index. citeturn598662search3turn598662search6

### 6. Complete moderation and data rights

Add nomination reporting/disqualification, enforcement filtering, deletion/retention rules for finalised results, public PDS deletion when appropriate, and winner audit logs. Keep personal data minimal and do not put private voter information on-chain.

## Required release tests

Before release, prove at minimum that:

- Alice can vote for Bob and the authoritative tally changes exactly once.
- Alice cannot cast a second vote when the policy is one-per-week.
- Concurrent/retried votes cannot duplicate or lose a vote.
- A nomination owner cannot edit any tally/result field.
- A user cannot nominate another person's post/card evidence.
- A user cannot nominate a post outside the active week.
- A user cannot submit more nominations than policy allows.
- Self-vote behaviour matches the documented policy.
- Vote deletion/change behaviour matches the documented policy and results remain consistent.
- Closing prevents late votes and nominations.
- Finalisation is idempotent and produces one deterministic winner/tie result.
- Finalised historical results cannot be rewritten by nomination owners.
- 29-31 December / 1-4 January ISO week-year boundaries produce correct contest keys.
- Client clock/timezone manipulation cannot select an unauthorised contest.
- Remote PullNomination `nominatorDid` cannot impersonate another DID.
- Remote `voteCount` cannot alter the authoritative local winner.
- Remote nomination create/update/delete commits reconcile correctly.
- The outbound nomination record validates against `org.swappulse.pullNomination` and uses `cardUri`.
- PDS publication writes real URI/CID/delivery state back to the same local row without duplicates.
- Do Not Sell/Share blocks nomination PDS publication and retry.
- Account deletion handles nominations/votes and public PDS records according to retention policy.
- Force-delete/disqualification removes an abusive account from contest discovery.
- Fake/abusive nominations can be reported and moderated.
- Winner/close notifications respect preferences and quiet hours.
- Discovery paginates beyond 50 nominations.
- All supported locales contain every Pull of the Week UI string.
- Modal keyboard, focus and screen-reader tests pass.
- Dedicated unit, integration and adversarial tests pass.
- Build, lint, typecheck and E2E gates pass against the exact release commit.

## AT Protocol references checked

- Repository specification: https://atproto.com/specs/repository
- Personal Data Repositories: https://atproto.com/guides/data-repos
- Lexicon specification: https://atproto.com/specs/lexicon
- Publishing Lexicons: https://atproto.com/guides/publishing-lexicons
- AT application stack / AppViews: https://atproto.com/guides/the-at-stack
- Sync guide: https://atproto.com/guides/sync
- Record key specification: https://atproto.com/specs/record-key

## Release decision

**Do not release Pull of the Week as a competitive weekly voting feature while PW-001 through PW-011 remain unresolved.**

The safest remediation order is:

**authoritative weekly contest/time window -> evidence-based nomination backend -> immutable unique vote backend -> derived/reconciled tally -> closing/finalisation/winner snapshot -> repository-bound federation identity -> fix canonical PDS payload/delivery state/consent -> moderation/enforcement/data lifecycle -> archive/notifications -> localisation/accessibility -> dedicated adversarial tests -> rerun this audit.**
