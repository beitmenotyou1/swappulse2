# SwapPulse Challenges Full Feature Audit

**Audit date:** 12 September 2026  
**Scope:** Challenge discovery, administration, types, modes, scopes, Circle scoping, eligibility, submissions, evidence validation, ChallengeEntry trust model, progress, leaderboards, privacy opt-in, voting, winners, rewards, achievements, notifications, moderation, anti-abuse/enforcement, AT Protocol federation/import/export, deletion/data rights, SEO, UI/UX, accessibility/localisation and release testing  
**Overall score:** **8/100**  
**Risk:** **Critical / High Risk**  
**Release status:** **NOT RELEASE READY**  
**Status:** **In progress - exact release build/typecheck/test verification unavailable**

| Priority | Area | Finding | Required action |
| --- | --- | --- | --- |
| 🔴 P0 | CH-001 - Challenge contribution integrity | Preserved from the Backend/Full Project audits: ChallengeEntry owners can create or modify contribution_count, status, verification_hash, moderator_labels and other scoring fields. submitChallengeEntry also service-role fetches caller-supplied CollectionEntry IDs without requiring created_by_id ownership, and its DID check fails open when the CollectionEntry has no DID. | Fetch evidence by authenticated owner ID, reject every missing/foreign ID, compute all trusted fields server-side, and make participant/scoring/status/verification/moderation fields backend-only. Add direct-write and foreign-card adversarial tests. |
| 🔴 P0 | CH-002 - Circle-scoped challenge authorisation | Preserved from the Backend/Full Project/Circle audits: submitChallengeEntry and getLeaderboard do not enforce active Circle membership when Challenge.scope is circle. Knowing the challenge ID is sufficient to attempt submission and leaderboard/progress access. | Resolve the authoritative Circle and current membership server-side for submission, progress, leaderboard reads and reward calculation. Deny non-members, former members and banned members. |
| 🔴 P0 | CH-003 - Goal metrics are not actually verified | Challenge.goal.metric offers cards, shiny pulls, trades, scanner corrections, vouches, journals, meetups, sets and grading metrics, but the evaluator only receives CollectionEntry rows and never branches on the metric. Arbitrary cards can score unrelated activity. Current audit-visible live shiny-pull and set-completion Challenges use metrics the evaluator cannot prove. | Create one server-owned evaluator per metric using that metric's authoritative source entity/event. |
| 🔴 P0 | CH-004 - Direct ChallengeEntry creation enables ranking impersonation | ChallengeEntry create RLS binds only created_by_id. participant_did, participant_name, contribution_count, status, moderator_labels and override_profile_visibility are caller-supplied, so a modified client can impersonate another participant, opt them into display, assign score and mark it verified without the validator. | Stop browser creation of ChallengeEntry. Derive participant identity from auth and create trusted result fields only in the backend submission service. |
| 🔴 P0 | CH-005 - Invalid and replayed entries can control leaderboards | The collective leaderboard sums every entry regardless of pending/rejected/expired/spam state. Competitive ranking excludes only rejected/spam, so pending/expired entries count. Evidence can also be resubmitted across multiple entries because there is no cross-entry replay protection. | Rank only backend-approved current evidence and add an idempotent evidence key/commitment per challenge + participant + source record. |
| 🔴 P0 | CH-006 - Leaderboard privacy can be forged through SettingsConfig | Leaderboard opt-in is read from SettingsConfig by DID, but SettingsConfig ownership is created_by_id while did is caller-writable. Audit-visible data also contains duplicate rows for the same DID, and getLeaderboard can let older rows overwrite newer privacy choices. | Bind SettingsConfig.did to the authenticated canonical DID, enforce one authoritative record per user/DID and deterministically use the newest validated settings row. |
| 🔴 P0 | CH-007 - Legacy leaderboard API bypasses opt-in and scope | The feeds backend leaderboard path service-role reads ChallengeEntry and returns participant DID/name and owner-writable scores without checking opt-in, Circle membership, lifecycle, rejected/spam state or current Challenge policy. | Remove the legacy path or make it call the single authoritative leaderboard service. |
| 🔴 P0 | CH-008 - Circle Challenge metadata is publicly exposed and indexed | Challenge read RLS is public for every scope. Challenge surfaces and seo-sitemap do not restrict circle scope, so a future Circle-only Challenge can expose title, description, rules, rewards, dates and circle_ref to non-members and search engines. | Add an access-controlled Challenge projection and exclude private Circle Challenges from public discovery/SEO. |
| 🔴 P0 | CH-009 - Public profile activity can leak private ChallengeEntry data | get-activity uses service role and includes ChallengeEntry by DID even though ChallengeEntry RLS is owner/admin only and challengeVisibility is intended to control exposure. Legacy/imported rows carrying did can surface private Challenge participation on public profiles. | Do not service-role project private entries without authoritative visibility, scope and membership checks. |
| 🔴 P0 | CH-010 - Repo import can publish private ChallengeEntry records | org.swappulse.challengeEntry is correctly NEVER_FEDERATE, yet export-repo includes it and import-repo writes arbitrary archive collections directly to the PDS without applying federationPolicy. A private entry can therefore be publicly re-published during import. | Apply publication policy to every import record and never export private ChallengeEntry as a federatable record. |
| 🔴 P0 | CH-011 - Repo/federation ingestion bypasses trusted Challenge creation | Normal Challenge creation is admin-only, but import-repo can write caller-supplied Challenge records to a PDS and service-role upsert them locally. Firehose also accepts global remote Challenges, and mapChallengeFields trusts publisherDid from record content rather than repository provenance. | Define trusted Challenge issuers, derive publisher identity from repo provenance, require approval for remote/community Challenges and block arbitrary archive imports from creating trusted definitions. |
| 🔴 P0 | CH-012 - Challenge publication bypasses federation opt-out | Preserved from AT Protocol/API audits: canonical atproto-bridge create/update publication does not enforce Do Not Sell or Share/federation opt-out, so global Challenge publication can bypass that preference. | Enforce outward-publication consent inside the canonical PDS write boundary for create/update/retry/import. |
| 🟠 P1 | CH-013 - No authoritative winner or reward processor | winner_dids and multiple reward types exist, but no Challenge finaliser/reward-grant path was found. | Implement deterministic, idempotent finalisation and supported reward grants over frozen authoritative scores. |
| 🟠 P1 | CH-014 - Reward badge IDs do not map to Achievement | The live Challenges use shiny_season and sprint_champion, but neither exists in the fixed Achievement achievement_type enum. | Use one versioned reward catalogue shared by Challenges and Achievements and migrate invalid IDs. |
| 🟠 P1 | CH-015 - Voting lifecycle is modelled but not implemented | status voting, voting_ends_at, winner_dids and pull_of_week exist, but no Challenge vote entity/function/UI or tally/finalisation path was found. | Integrate the existing voting feature explicitly or add a ChallengeVote model with eligibility, one-person/one-vote, close and finalisation rules. |
| 🟠 P1 | CH-016 - Challenge lifecycle status is stale in live data | Both audit-visible Challenge rows ended 31 August 2026 but still store status active on 12 September. Some surfaces recompute dates while others query status active directly. | Use one lifecycle transition service/job and make every surface consume the same effective state. |
| 🟠 P1 | CH-017 - budget_deck is not implemented end to end | budget_limit exists but submission only selects CollectionEntry IDs and never validates deck composition, legality or budget. | Add a dedicated deck-list evaluator with legality and timestamped price/currency evidence. |
| 🟠 P1 | CH-018 - set_sprint does not verify target set completion | target_set_code is not consumed by validation, so selected cards can score without proving completion of the target set. | Compute set completion server-side from owned cards and the canonical set checklist. |
| 🟠 P1 | CH-019 - pull_of_week cannot be submitted through Challenge | ChallengeEntry has pull_post_uri, but the Challenge submission UI accepts only CollectionEntry IDs and never verifies a qualifying pull Post. | Verify an authenticated pull/post reference, timestamp/card/set criteria and uniqueness. |
| 🟠 P1 | CH-020 - min_value_usd is not enforced | challengeValidation explicitly defers the minimum-value filter. | Resolve an authoritative timestamped price source/currency and enforce it server-side. |
| 🟠 P1 | CH-021 - Collective participant cap is bypassable | The collective cap is calculated per entry rather than over all accepted contributions by the participant. | Aggregate prior accepted contribution and enforce the participant ceiling atomically. |
| 🟠 P1 | CH-022 - Verification hash is not a proof | The hash omits immutable source CIDs/digests, challenge/evaluator version and external evidence and is neither signed nor independently verifiable. | Commit to challenge version, evaluator version, canonical source URIs/CIDs/digests and computed result. |
| 🟠 P1 | CH-023 - Stored references can disagree with verified evidence | The record stores original caller contributionUris while the hash/score uses only validated/fetched rows, so invalid/rejected references can remain in the authoritative-looking entry. | Persist only accepted canonical evidence and return rejected inputs separately. |
| 🟠 P1 | CH-024 - Challenge strong references are not strong references | challenge_ref is a URI string without the Challenge CID, so the entry cannot prove the immutable version of rules evaluated. | Store a real uri+cid strongRef or immutable challenge_version/rules_hash. |
| 🟠 P1 | CH-025 - Leaderboard configuration is ignored | getLeaderboard does not enforce leaderboard_config.enabled, rank_limit or visibility_window_days. | Apply the server-owned Challenge leaderboard configuration consistently. |
| 🟠 P1 | CH-026 - Leaderboard truncates at 1,000 entries | getLeaderboard aggregates only the first 1,000 entries with no completeness warning. | Use indexed/materialised participant scores or aggregate all qualifying entries with pagination. |
| 🟠 P1 | CH-027 - Public pages depend on authenticated leaderboard API | ChallengeCard/Detail are publicly readable but invoke auth-required getLeaderboard; guest failures are swallowed into loading states. | Provide a public-safe projection or explicitly gate leaderboard/progress widgets behind sign-in. |
| 🟠 P1 | CH-028 - Leaderboard page can spin forever without category | Leaderboard only calls the backend after resolving a category; a competitive Challenge with no category can remain permanently loading. | Define a server-side default or render an explicit category-required/empty state. |
| 🟠 P1 | CH-029 - Collective leaderboard route has incompatible response shape | getLeaderboard collective response has no feed while Leaderboard assumes data.feed. | Gate the route by mode or use a typed common response contract. |
| 🟠 P1 | CH-030 - Submission UI sees only newest 200 cards | SubmitEntryPanel loads only 200 CollectionEntry rows, so older valid evidence cannot be selected. | Use paginated server-side eligible-evidence search. |
| 🟠 P1 | CH-031 - Bot protection exists but is not used | botGuard defines challenge_entry limits but submitChallengeEntry does not call it; direct entity creation bypasses it too. | Put bot/rate controls in the only allowed backend submission command. |
| 🟠 P1 | CH-032 - Account enforcement is not applied | Challenge submission/ranking paths do not check suspension/shadow-ban state before accepting or ranking entries. | Apply the shared enforcement authority to submission, ranking and reward eligibility. |
| 🟠 P1 | CH-033 - Remote Challenges have no trust/approval boundary | guild_approved exists but is not used in discovery. Global remote Challenges from scanned repos can appear beside platform Challenges without trust distinction. | Add issuer/approval status and prevent unverified remote Challenges from granting local rewards. |
| 🟠 P1 | CH-034 - Federated creator identity trusts record content | mapChallengeFields uses val.publisherDid before repository DID, so a remote record can claim another publisher. | Derive issuer identity from the signing repository; accept publisher metadata only when provenance matches. |
| 🟠 P1 | CH-035 - Federation drops trust/result fields on ingest | Outbound Challenge can include winnerDids/guildApproved but inbound mapping does not restore them. | Make mappings symmetric or explicitly remove local-only fields from the portable schema. |
| 🟠 P1 | CH-036 - ChallengeEntry portability claims contradict policy | Schema/docs/UI still describe/attempt ChallengeEntry PDS mirroring, while central policy correctly blocks it and UI swallows the failure. | Declare entries local/private, remove the bridge attempt and portability fields, or design a privacy-safe proof format. |
| 🟠 P1 | CH-037 - Challenge deletion lacks durable PDS lifecycle | No dedicated Challenge delete/archive command was found that guarantees PDS update/tombstone with retries. | Add a backend lifecycle service with exact federation state and durable outbox/retry. |
| 🟠 P1 | CH-038 - Account deletion omits authored Challenge definitions | delete-account/force-delete remove ChallengeEntry but not Challenge. Admin/publisher deletion can leave public Challenge definitions and PDS copies. | Define transfer/archive/tombstone policy for authored Challenges during account deletion/moderation. |
| 🟠 P1 | CH-039 - Challenges and entries cannot be reported | ContentReport does not support challenge or challenge_entry and no report control was found. | Add report types, evidence snapshots and moderation actions. |
| 🟠 P1 | CH-040 - Challenge-specific moderation workflow is missing | No staff workflow was found for under_review/flagged evidence, invalidating scores or rebuilding rankings. | Add evidence review with immutable audit log, status transitions and rank recomputation. |
| 🟠 P1 | CH-041 - Challenge lifecycle notifications are not implemented | deepLinkRoutes has challenge_update but no start/end/voting/winner/reward producer was found. | Emit typed lifecycle events through the central notification/localisation pipeline. |
| 🟠 P1 | CH-042 - challengeVisibility setting is unused | Settings offers public/friends-only/circle-scoped/private Challenge visibility but no Challenge/entry path consumes it. | Implement precise enforcement or remove the non-functional privacy control. |
| 🟠 P1 | CH-043 - Circle reference model conflicts with private Circles | circle_ref is an at:// URI, but non-public Circles are intentionally not federated and may have no safe public AT URI. | Scope locally with immutable Circle identity/membership authority and treat public AT URI as optional metadata only. |
| 🟠 P1 | CH-044 - No normal Challenge administration surface | Admin-only Challenge fields have no first-class validated creator/editor/finaliser UI. | Add an admin Challenge console backed by server-side validation and lifecycle/audit history. |
| 🟠 P1 | CH-045 - Date/state relationships are not validated | The model permits impossible/stale combinations such as active after end or invalid voting chronology; live data demonstrates stale active status. | Validate chronology and allowed state transitions server-side. |
| 🟠 P1 | CH-046 - Dedicated Challenge regression suite not found | The Base44 sandbox contains no test/spec files and no Challenge-specific adversarial suite was found. | Add unit/integration/adversarial tests for every critical path and run them in canonical CI. |
| 🟡 P2 | CH-047 - Directory capped at 100 | Challenges.jsx loads at most 100 rows with no continuation. | Add cursor/server-side pagination. |
| 🟡 P2 | CH-048 - My Entries capped at 100 | Participant history fetches at most 100 entries with no continuation. | Paginate and group by Challenge. |
| 🟡 P2 | CH-049 - Global Search omits Challenges | Search covers cards/profiles/posts but not Challenge titles/tags. | Add access-filtered Challenge search. |
| 🟡 P2 | CH-050 - Discovery filters are coarse | No challenge type, category, set, reward, tag or text search. | Add server-side filters after access control is fixed. |
| 🟡 P2 | CH-051 - Voting has no distinct directory state | The directory has no dedicated voting tab/experience despite voting status in the model. | Render voting explicitly when implemented. |
| 🟡 P2 | CH-052 - Rules text is not displayed | Detail Rules section renders derived filters but not the Challenge.rules text itself. | Render sanitised rules and distinguish them from derived filters. |
| 🟡 P2 | CH-053 - Type-specific fields are hidden | target_set_code, budget_limit, voting dates and winner state are not consistently shown. | Add type-specific detail panels with units/provenance/result state. |
| 🟡 P2 | CH-054 - Remote image URLs can track viewers | image_url is rendered directly and remote Challenges can supply it; no proxy/allowlist was found on this surface. | Proxy/allowlist media or require managed uploads with CSP/referrer protections. |
| 🟡 P2 | CH-055 - Challenge cards cause N+1 leaderboard work | Every ChallengeCard independently calls getLeaderboard. | Return batched/materialised public Challenge stats. |
| 🟡 P2 | CH-056 - Errors look like empty/loading states | Several backend failures are swallowed, including guest auth failures. | Use typed error/unauthorised/empty states with retry/CTA. |
| 🟡 P2 | CH-057 - Leaderboard canonical URL is wrong | Leaderboard sets canonicalPath to /challenges rather than its detail route. | Use the actual canonical or noindex the page. |
| 🟡 P2 | CH-058 - Detail SEO/share metadata is generic | Challenge detail does not use validated challenge-specific description/image/structured data. | Add per-Challenge metadata for public authorised records only. |
| 🟡 P2 | CH-059 - Localisation is incomplete | Core page strings are translated, but submission, opt-in, settings, type labels and some actions remain English. | Move all Challenge strings/status/category labels to the nine-locale registry. |
| 🟡 P2 | CH-060 - Selection accessibility is incomplete | Custom visibility/category/filter controls do not consistently expose radio/toggle selected semantics. | Use accessible RadioGroup/ToggleGroup semantics and keyboard tests. |
| 🟡 P2 | CH-061 - Circle context is not resolved | Circle Challenge UI generally shows a generic Circle marker/reference without access-checked Circle name/membership context. | Resolve context through the authoritative Circle membership projection. |
| 🟡 P2 | CH-062 - Reward fields are duplicated | reward.badge_id and top-level reward_badge create two sources of truth. | Use one versioned reward object and migrate/remove the redundant field. |
| 🟡 P2 | CH-063 - Goal target has no positive minimum | goal.target is an unrestricted integer, allowing zero/negative nonsense. | Require a positive metric-appropriate target. |
| 🟡 P2 | CH-064 - Documentation overstates implementation | Help says users Join, submit sets/deck lists/pull posts, compete in verified rankings and earn badges; current UI/validation/finalisation do not support all of that. | Align help with deployed behaviour and restore claims only with passing end-to-end tests. |
| 🟢 P3 | CH-065 - Type/category labels are inconsistent | Some surfaces use raw enum-like labels while others use friendly labels. | Centralise localised type/category/status label maps. |
| 🟢 P3 | CH-066 - Pull of the Week concepts overlap | SwapPulse has a dedicated Pull of the Week feature and a Challenge pull_of_week type without documented integration. | Choose one canonical implementation or document the interoperability boundary. |
| 🟢 P3 | CH-067 - Help uses future lifecycle language without capability markers | Guild challenges, Join, winners and rewards are described without clear unsupported/beta markers. | Add capability/status notes until those lifecycle pieces are implemented. |
| 🟢 P3 | CH-068 - Exact release gates could not be rerun | The Base44 command sandbox exposes no application package manifest/canonical checkout, so build, lint, typecheck and Challenge tests could not be rerun there. | Run all release gates in canonical CI against the exact release commit and attach evidence to the re-audit. |

## Executive summary

Challenges are not release-ready as a verified, competitive, reward-bearing or Circle-private feature. The central architectural flaw is that `ChallengeEntry` is both user-owned data and the authoritative scoring/verification object. A participant can bypass the normal validator through direct entity writes, while the validator itself only understands CollectionEntry rows and does not verify the metric the Challenge claims to measure.

Current audit-visible data contains **2 Challenge rows, 0 ChallengeEntry rows and 0 Circle-scoped Challenge rows**. Both visible Challenges are global and bridged. Both ended on **31 August 2026** but still store `status:'active'` on **12 September 2026**. The live Shiny Season and Set Completer Sprint metrics are not actually proven by the current evaluator.

Circle privacy is release-blocking because membership is not enforced on submission/leaderboards and Challenge definitions remain public and sitemap-indexable. Leaderboard privacy is also split across spoofable SettingsConfig rows and a legacy feed API that ignores opt-in.

The normal federation policy correctly blocks ChallengeEntry publication, but `export-repo`/`import-repo` bypasses that boundary and can write private entries to a public PDS. Import/federation also weakens the admin-only Challenge publisher trust boundary.

Voting, winner selection and reward granting are modelled but no authoritative finalisation implementation was found.

The required Base44 web-agent README remained unavailable from this environment. Connected source/schema/data APIs were available. The Base44 command sandbox did not expose the canonical application checkout/package manifest, so exact-release build, lint, typecheck and executable Challenge tests could not be rerun.

No Challenge, ChallengeEntry, SettingsConfig, Circle, User, leaderboard or production data was changed during this audit.

## Feature verdict

| Feature | Verdict | Notes |
| --- | --- | --- |
| Challenge discovery | Partial | Useful UI, but access/pagination/search/stale lifecycle gaps remain. |
| Challenge administration | Incomplete | Admin-only schema but no validated management/finalisation UI; import/federation trust can bypass it. |
| Community goals | Release blocker | Generic card evidence scores unrelated metrics. |
| Competitive Challenges | Release blocker | Scores and verified labels are user-forgeable/replayable. |
| Circle Challenges | Release blocker | Membership not enforced; definitions can be public/indexed. |
| Set Sprint | Not authoritative | Target set completion not verified. |
| Budget Deck | Not implemented | Deck legality/budget evaluator missing. |
| Pull of the Week Challenge | Not implemented | Pull evidence/voting lifecycle missing. |
| Grading Challenges | Release blocker | Preserved P0: no grading evidence evaluator. |
| Submission/evidence | Release blocker | Foreign-card access plus direct entity-write bypass. |
| Leaderboards | Release blocker | Invalid states, privacy spoofing, legacy bypass and truncation. |
| Voting/winners/rewards | Missing | No authoritative finalisation path. |
| Moderation/reporting | Missing | No Challenge report/review workflow. |
| Bot/enforcement | Incomplete | Supporting primitives exist but Challenge paths do not use them. |
| AT Challenge federation | High risk | Scope control helps; issuer/import/consent boundaries fail. |
| ChallengeEntry privacy | Release blocker | Normal bridge blocks it; repo import can publish it. |
| Localisation/accessibility | Partial | Core pages translated; several controls remain incomplete. |
| Tests/release evidence | Incomplete | Dedicated suite absent and exact-release gates unavailable in sandbox. |

## Score breakdown

| Area | Score | Notes |
| --- | ---: | --- |
| Submission identity/evidence integrity | 0/20 | Direct writes and foreign-card access defeat validation. |
| Metric correctness/replay protection | 0/15 | Metrics do not use authoritative sources. |
| Leaderboard/privacy correctness | 0/15 | Invalid states count and privacy authority is broken. |
| Circle scope/privacy | 0/10 | Membership not enforced; metadata may be public/indexed. |
| Lifecycle/voting/rewards | 1/10 | Models exist but finalisation is absent and live status is stale. |
| Federation/portability | 1/10 | Policy has useful controls but import/provenance/consent fail. |
| Moderation/anti-abuse/enforcement | 1/8 | Primitives exist but are not wired in. |
| UX/discovery/accessibility/localisation | 3/7 | Useful surfaces exist with completeness/error issues. |
| Data rights/reliability/testing | 2/5 | Export partly covers entries; executable release evidence missing. |
| **Total** | **8/100** | **Critical / NOT RELEASE READY** |

## Verified strengths to preserve

- Local Challenge definitions are admin-only through normal entity RLS.
- ChallengeEntry normal reads are owner/admin only.
- submitChallengeEntry derives the authenticated user and checks the date window.
- ChallengeEntry is correctly listed as NEVER_FEDERATE for normal bridge/reconcile paths.
- Circle-scoped Challenge definitions are blocked from ordinary outbound PDS publication.
- atproto-bridge now applies publication eligibility to normal create/update actions.
- Competitive leaderboard code attempts explicit opt-in rather than default-public ranking.
- Main directory recomputes effective lifecycle from dates, masking stale stored state on that page.
- GDPR/CCPA export includes ChallengeEntry.
- botGuard already has a challenge_entry rate-limit profile ready to wire in.
- No ChallengeEntry rows were audit-visible in this session, making remediation easier before a live ranking corpus accumulates.

## Recommended architecture

1. Make ChallengeEntry an immutable backend-owned evaluation result. A participant submits an evidence request; the backend derives identity, evaluates authoritative evidence and creates score/status/proof fields.
2. Implement one evaluator per goal metric/type using the authoritative source entity/event.
3. Centralise `viewer -> challenge -> lifecycle -> scope -> Circle membership -> eligibility -> visibility` in one Challenge access service.
4. Materialise one authoritative participant score per challenge/category and add replay protection.
5. Keep participation evidence private and store explicit server-bound leaderboard consent separately.
6. Add deterministic voting/finalisation/winner/reward processing.
7. Establish trusted Challenge issuer provenance and approval for remote records.
8. Apply federation policy/consent to every repo import/export/PDS write.

## Release decision

**Do not release Challenges as a verified, competitive, reward-bearing or Circle-private feature while CH-001 through CH-012 remain unresolved.**

Recommended remediation order: **lock ChallengeEntry trust fields -> one evidence-submission service -> metric-specific evaluators and replay protection -> central Challenge/Circle access -> authoritative score projections -> fix settings/legacy leaderboard/activity privacy -> block private-entry repo federation -> trusted issuer provenance -> canonical federation consent -> lifecycle/voting/finalisation/rewards -> moderation/bot/enforcement -> UX/i18n/SEO -> full adversarial release suite.**
