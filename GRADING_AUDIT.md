# SwapPulse Grading Audit

**Audit date:** 12 September 2026  
**Scope:** Grading submission tracker, collection-card binding, provider/service modelling, status and grade recording, grading evidence/certificates, Level 3 graded attestations, on-chain graded-card trust, graded market data, community grader labels, grading challenge metrics, privacy/data rights, UX/accessibility/localisation, documentation and release verification  
**Overall score:** **34/100**  
**Risk:** **High**  
**Release status:** **NOT RELEASE READY as a verified/provenance grading system**  
**Status:** Complete with critical residual actions

## Executive summary

SwapPulse currently has three separate grading-related concepts that need to be kept distinct:

1. **GradingSubmission** is a private, owner-scoped manual tracker for cards a collector says they sent to PSA, BGS, CGC or ACE.
2. **Community grading labelers** can present grader/authenticity-style labels on profiles, posts and trade listings.
3. **Level 3 card verification** is described as a professional grading-certificate trust level carried into an on-chain CardNft.

The private tracker is a reasonable foundation, but it is not a professional grading integration. The collector can directly create and edit the grading company, card identity, status and final free-text grade. There is no provider submission ID, certificate number, official certificate lookup, slab/evidence record, immutable status history, or service-specific grade validation. The current record also does not store the selected `CollectionEntry.id`, so a submission is not actually bound to the exact physical copy selected from the collection.

The most serious grading-specific trust issue is inherited from the community labeler architecture. A CommunityLabeler owner can update their own `approval_status`. Because `apply-community-label` only checks that the labeler row says `approved`, a collector can potentially self-approve a grading labeler such as “Verified Grader” and then issue/federate labels such as `psa-confirmed`. This remains a release-blocking trust-boundary failure even though no audit-visible grading-category labeler currently exists.

A second inherited P0 affects grading challenges. `Challenge.goal.metric` allows `grading_submissions`, but `submitChallengeEntry` never validates `GradingSubmission` rows. It only accepts CollectionEntry IDs, and ChallengeEntry trust fields remain owner-updatable. A challenge that claims to reward real grading submissions therefore does not have an authoritative grading-evidence path.

The Level 3 on-chain path is not implemented. `create-card-attestation` explicitly states that Level 3 is reserved for future grading-company verification and can currently only produce Levels 0-2. However, the wallet/help documentation already says Level 3 means a PSA/BGS/CGC certificate “was confirmed”, and the ChainMedallion renders “Graded cert” whenever the numeric level is 3. The schema also says `grading_verified` means a cert was verified via an LLM web lookup, but no such current implementation exists. Professional certificate trust should use deterministic provider-specific verification against official grading-provider records where permitted, never a general LLM browsing decision.

Audit-visible data currently contains **0 GradingSubmission records, 0 Level 3 CardVerificationSession records, 0 grading-category CommunityLabeler records and 0 TrustTierRule records**. This reduces immediate live exposure but does not remove the architectural findings.

No grading functionality or user data was changed during this audit.

## Method and constraints

The project-mandated Base44 web-agent README URL was requested first but could not be fetched in this session. The audit therefore continued against the existing Base44 app source, schemas, backend functions, agents, workflows, documentation and audit-visible entity data.

Official certification lookup surfaces were cross-checked for PSA, CGC and ACE to validate the recommended direction for future Level 3 verification. Those providers expose public certification-verification mechanisms; a production verifier should use deterministic provider adapters/API contracts where permitted and retain provider response provenance.

The Base44 command sandbox currently exposes an empty `/workspace` without `package.json`, so build/lint/typecheck and executable grading regression suites could not be rerun in this audit session. This is an audit-environment limitation, not evidence that the deployed application build fails.

## Findings

| Priority | Area | Finding | Required action |
| --- | --- | --- | --- |
| 🔴 P0 | Community grading labelers | `CommunityLabeler` owners can update their own `approval_status`, while `apply-community-label` trusts that field and only requires the caller to own an “approved” labeler. A collector can therefore potentially self-approve a grading labeler such as “Verified Grader” and issue/federate grading/authenticity-style labels. | Make approval state, reviewer identity/date and allowed trust-sensitive label values backend/admin-only. Revalidate approval server-side from an immutable review record before every label issue. Retest grading-category labelers end to end. |
| 🔴 P0 | Grading challenge integrity | `Challenge.goal.metric` includes `grading_submissions`, but `submitChallengeEntry` only accepts and validates CollectionEntry IDs and never verifies GradingSubmission records. ChallengeEntry contribution count, status, verification hash and moderator labels are also owner-updatable under current RLS. A grading challenge can therefore claim verified grading activity without authoritative grading evidence. | Create a server-owned grading challenge evaluator that counts immutable, caller-owned qualifying GradingSubmission/provider-verification records. Make ChallengeEntry scoring/status/hash/labels backend-only and preserve the existing P0 priority from the project-wide challenge audit. |
| 🟠 P1 | Trust semantics | The Grading page looks like a professional grading tracker but all status and `received_grade` data is self-recorded by the collector. Help text says graded cards carry a “verified condition” and “provenance”, which overstates what the current tracker proves. | Label tracker data clearly as **self-recorded** unless independently verified against a grading provider. Never expose a manual GradingSubmission as provider-confirmed, authenticity-verified or trusted Level 3 evidence. |
| 🟠 P1 | Exact physical-card binding | `GradingForm` selects a CollectionEntry but creates GradingSubmission with only `card_id` and `card_name`; `collection_entry_id` is not stored and the schema has no such field. Two identical copies cannot be distinguished and the final grade cannot be linked to the exact selected card. | Add immutable `collection_entry_id`, verify ownership server-side at creation, and retain a historical copy reference even if the collection entry is later archived. |
| 🟠 P1 | Arbitrary grading records | UI selection comes from the caller's collection, but GradingSubmission is directly user-creatable and the schema does not enforce a CollectionEntry relationship. A modified client can create a “grading submission” for any arbitrary card ID/name. | Move creation behind a backend endpoint that derives card identity from a caller-owned CollectionEntry and rejects arbitrary client-supplied card identity. |
| 🟠 P1 | Mutable provenance | GradingSubmission owners can update the whole record. Service, card identity, status, declared value, timestamps and received grade are therefore mutable after the supposed submission occurred. | Split user-editable notes from provenance fields. Use backend state-transition endpoints and append-only events for submission/service/card/status/final-grade changes. |
| 🟠 P1 | Status state machine | No server-side transition rules exist. A modified client can jump backwards/forwards between submitted, in_progress, graded, returned and rejected or rewrite dates independently of status. | Enforce an explicit server-side state machine with allowed transitions, timestamps generated by the backend and admin correction events rather than destructive rewrites. |
| 🟠 P1 | Grade validation | `received_grade` is free text up to 20 characters. It can contain values inconsistent with the selected company, such as `PSA 10` on a BGS submission, impossible grades, arbitrary text or qualifiers the UI does not understand. | Model normalized provider, numeric grade, grade label/qualifier and optional subgrades separately. Validate against provider-specific scales and supported qualifiers before saving. |
| 🟠 P1 | Provider submission provenance | GradingSubmission has no grading-company order/submission ID, item number, certification number, verification URL or provider response metadata. A “graded” status cannot be tied to an official provider record. | Add provider submission ID/item ID and, once graded, certificate number plus provider-verification provenance. Keep parcel tracking separate from grading-provider identifiers. |
| 🟠 P1 | Official certificate verification | No PSA/BGS/CGC/ACE certificate-verification adapter exists in the current backend. Final grades are manual only. | Implement provider-specific verification adapters using official provider verification surfaces/APIs where permitted. Verify card identity, grade, cert status and provider source; store fetched-at/source/result hashes and fail closed on ambiguity. |
| 🟠 P1 | Pre-grade condition feature | Help/documentation says collectors can record centering, corners, edges and surface before submission, but neither GradingSubmission nor GradingForm has those fields. | Add a structured pre-grade condition report with photos/notes and clearly label it collector-assessed, or remove the capability claim until implemented. |
| 🟠 P1 | Submission batching | Documentation says users can group multiple cards into one grading submission batch, but each GradingSubmission row represents one card and there is no batch/order entity. | Add a GradingBatch/Submission entity with provider, package/order IDs and one-to-many item rows, or rewrite documentation to the actual single-card tracker. |
| 🟠 P1 | Grader support contract | Help says users may choose “PSA, BGS, CGC, or other”, but the schema enum only permits PSA, BGS, CGC and ACE. | Either support a validated custom/other provider model or document the exact supported services. Do not promise an option the schema rejects. |
| 🟠 P1 | Rejection lifecycle | `rejected` exists in the schema/UI metadata, but the normal UI cannot transition a submission to rejected or record a rejection reason. | Add provider-return/rejected/cancelled states and reason fields with auditable transitions. Distinguish grading rejection, cancellation, lost shipment and returned-ungraded outcomes. |
| 🟠 P1 | Collection integration | Recording a final grade does not update or link a verified grade on CollectionEntry. Help text says the grade is linked to the collection entry, but no such data relationship exists. | Add a separate verified grading projection linked to the exact CollectionEntry. Keep original raw-card condition separate from professional grade and never overwrite history. |
| 🟠 P1 | Trade/insurance provenance | GradingSubmission is not consumed by TradeListing, collection insurance exports or other provenance surfaces. A recorded grade therefore does not currently provide the trading/selling provenance described in help text. | Only surface professional grade in trades/exports after provider verification and exact-copy binding. Include provider, grade, cert reference, verification timestamp and provenance state. |
| 🟠 P1 | Graded valuation integration | The graded sold-price panel from PokemonPriceTracker is generic market enrichment and is not matched to the user's GradingSubmission, exact certificate or exact collection copy. The user's manual grade also does not alter portfolio valuation. | Build valuation from the exact provider/grade/variant/certified copy and clearly separate generic graded-market comparables from a valuation of the user's slab. |
| 🟠 P1 | Level 3 availability | Wallet/help docs say Level 3 means a PSA/BGS/CGC certificate was confirmed, but `create-card-attestation` explicitly reserves Level 3 for future work and currently only returns Levels 0-2. | Mark Level 3 as unavailable/coming later everywhere until provider verification exists. Do not present it as a live trust level. |
| 🟠 P1 | Level 3 provider mismatch | The Grading tracker supports ACE, but CardVerificationSession `grading_company` permits only PSA, BGS, CGC and none. ACE cannot participate in the documented Level 3 path even though ACE has a certificate lookup surface. | Define one canonical supported-provider registry used by tracker, verifier, docs, UI and chain metadata. |
| 🟠 P1 | Level 3 verification design | CardVerificationSession says `grading_verified` means a certificate was verified via “InvokeLLM web lookup”. No such current path exists, and a general LLM lookup is not an appropriate trust oracle for a professional certificate. | Replace the schema description/design with deterministic provider adapters. LLMs may assist UI parsing only, never decide certificate validity. |
| 🟠 P1 | On-chain Level 3 provenance | `mint-card` carries only numeric verification level and grading company into metadata. There is no provider cert proof/commitment, provider response hash, verified-at source or grade value that an independent verifier could check. | For Level 3, commit a privacy-safe cert/provenance hash plus provider, normalized grade and verification timestamp/source revision. Keep sensitive or unnecessary personal data off-chain. |
| 🟠 P1 | Level 3 revocation | No graded-certificate revocation/recheck model exists for CardVerificationSession or ChainCardToken. Once a future Level 3 token is minted, the displayed trust level has no mechanism to reflect provider correction/revocation/reholdering. | Add provider revalidation and an on-chain/off-chain revocation or supersession event model before enabling Level 3 minting. |
| 🟠 P1 | Graded medallion trust display | `ChainMedallion` displays “Graded cert” whenever `verification_level === 3`, with no provider, grade, verification timestamp or revocation status. | Render Level 3 only from reconciled verified provenance and expose provider/grade/status/as-of details to the user. |
| 🟠 P1 | Direct entity write boundary | Grading writes occur directly through the client entity API. There is no server-side input contract, idempotency key, per-user rate limit, bot-abuse control or authoritative validation layer. | Route create/update/status/grade operations through backend endpoints with validation, idempotency, rate limits and audit events. Keep the entity owner-readable but backend-written for trust fields. |
| 🟠 P1 | Duplicate submissions | Nothing prevents the same card/copy from being submitted repeatedly with overlapping active records. A collector can create unlimited parallel records for the same card. | Define duplicate rules using exact CollectionEntry + provider + active batch/order and enforce server-side idempotency/uniqueness. |
| 🟠 P1 | Grader-domain trust tiers | `getTrustProfile` grants a TrustTierRule when `handle.endsWith(domain_suffix)`. A rule for `psacard.com` would also match a verified handle such as `notpsacard.com` unless the rule includes a boundary dot. No live rules were visible, but the implementation is unsafe for future grader/industry provenance. | Match exact domain or `.` + suffix boundaries after canonical hostname normalization. Require admin-reviewed organisation ownership before granting grading/industry trust tiers. |
| 🟠 P1 | Data portability | `export-my-data` omits GradingSubmission entirely even though grading submissions, tracking numbers, declared values and results are user account data. | Add GradingSubmission and future grading batches/evidence to user data export, excluding internal security-only fields where appropriate. |
| 🟠 P1 | Release verification | No audit-visible GradingSubmission or Level 3 session existed, so real create→status→grade→provider verification→collection/trade/on-chain behaviour could not be exercised end to end. The sandbox also cannot run the current app build/tests. | Before release, populate staging fixtures and run complete grading workflows against the exact deployment commit, including provider failures, tampered certs, duplicate copies and account export/delete. |
| 🟡 P2 | History pagination | Grading loads only the newest 200 GradingSubmission rows with no pagination. Older grading history disappears from the UI. | Add cursor pagination/filtering and expose complete history or a clearly stated archive boundary. |
| 🟡 P2 | Collection selector cap | The form loads only the latest 500 CollectionEntry rows. Collectors with larger collections cannot select older cards for grading. | Use searchable server-side card selection/pagination keyed to the owner's complete collection. |
| 🟡 P2 | Card image display | Grading page tries to render `sub.card_image`, but GradingForm never stores `card_image` and the schema has no field. Newly created grading cards therefore normally lack the expected image. | Derive image from canonical card/CollectionEntry during read, or store an immutable canonical display snapshot through the backend. |
| 🟡 P2 | Declared value validation | Declared value is hard-coded as GBP pence and has no minimum/maximum or currency field. Negative or unrealistic values are not explicitly blocked by the schema. | Store ISO currency plus validated amount, enforce non-negative sensible bounds and distinguish declared insurance value from market value. |
| 🟡 P2 | Date consistency | `expected_return`, `submitted_at` and `received_at` have no chronological validation. A modified client can create impossible timelines. | Validate expected/received dates against submitted date in backend transitions and preserve correction history. |
| 🟡 P2 | Tracking integration | Tracking number is a free string and is not associated with a carrier, shipment direction or delivery status. | Add optional carrier + outbound/return shipment records and safe carrier links/status where legally/technically appropriate. Keep provider order IDs separate. |
| 🟡 P2 | Notifications | There are no grading reminders or status notifications for expected-return dates, overdue submissions or return delivery. | Add opt-in reminders based on tracker state, using the central notification dispatcher and user preferences. Do not imply provider-live status unless it is provider-sourced. |
| 🟡 P2 | Edit/delete controls | The UI allows creation, status advancement and grade entry but no normal edit/delete/archive flow for tracking number, expected date, declared value or mistaken submissions. | Add explicit edit/archive/delete controls with confirmation and audit history. |
| 🟡 P2 | Mutation error feedback | `advance()` and `setGrade()` do not catch errors or show success/failure feedback. A failed request can surface as an unhandled promise and leave the user unsure whether the change saved. | Add loading/error states, toasts and retry handling for every mutation. |
| 🟡 P2 | Grade save interaction | The final grade saves on input blur rather than an explicit confirmation action. Accidental focus changes can commit a value. | Use a clear Save/Confirm grade action with validation and review of provider + grade before persistence. |
| 🟡 P2 | Status advancement UX | “Advance status” is a one-click irreversible UI action with no confirmation, reason or visible undo. | Add explicit next-state text, confirmation for consequential transitions and an auditable correction path. |
| 🟡 P2 | Status vocabulary drift | Help describes prepared → sent → in review → returned, while code uses submitted → in_progress → graded → returned. There is no prepared state and “graded” is a separate status before return. | Define one canonical lifecycle vocabulary and use it in schema, UI, help and provider adapters. |
| 🟡 P2 | Submission economics | There are no fields for service level, grading fee, shipping/insurance cost, declared package value or turnaround estimate source. | Add optional cost/service-tier fields if SwapPulse intends to help collectors manage grading economics; otherwise document the tracker as intentionally minimal. |
| 🟡 P2 | Evidence uploads | GradingSubmission cannot attach pre-submission photos, slab photos, invoice/submission documents or certificate images. | Add private evidence attachments with strict file validation/retention controls if provenance review is a product goal. Do not make those files public or put them on-chain. |
| 🟡 P2 | Search/filtering | The Grading page has no search, company filter, status filter, overdue filter or sort controls beyond newest submitted date. | Add accessible filtering once pagination and authoritative fields exist. |
| 🟡 P2 | Localisation | New-form keys such as card picker, service, tracking number, declared value and submit exist only in the English static dictionary; other supported locales fall back to English. | Translate all grading form/status/error strings across the nine supported locales and test fallback/overrides. |
| 🟡 P2 | Date localisation | Submitted dates are hard-coded to `en-GB` rather than the active application locale. | Format dates using the user's locale/date settings. |
| 🟡 P2 | Dialog accessibility | GradingForm is a custom fixed overlay without the shared Dialog/Sheet semantics. It does not demonstrate focus trapping, focus restoration or keyboard Escape behaviour. | Use the shared accessible dialog primitive with `role=dialog`, `aria-modal`, labelled title/description, focus trap and focus return. |
| 🟡 P2 | Service selector accessibility | Company buttons visually show the selected service but do not expose a radio-group/`aria-pressed` selected state. | Implement an accessible radio group or pressed-state semantics and keyboard navigation. |
| 🟡 P2 | Privacy inventory | Privacy policy does not explicitly describe grading submissions, shipment tracking numbers, declared values or future certificate/evidence processing. | Add grading data to the personal-data inventory, including purpose, visibility, providers, retention and deletion/export behaviour. |
| 🟡 P2 | Retention policy | No grading-specific retention policy is defined for shipment details, provider responses or future certificate/evidence files. | Define retention by data type. Keep only provenance necessary for the user's requested history and delete private shipping/evidence metadata when no longer needed. |
| 🟡 P2 | Provider outage state | Future provider verification has no model for unavailable/rate-limited provider lookup versus invalid certificate. | Model `verified`, `not_found`, `mismatch`, `provider_unavailable`, `stale` and `manual_review` separately so outages never become failed authenticity claims. |
| 🟢 P3 | AT Protocol schema drift | `GradingSubmission` contains DID/AT URI/CID/record_type/signature fields and `src/lib/atproto.js` defines a grading NSID, but no grading lexicon/bridge use was found. | Remove/deprecate unused federation fields or implement a deliberate privacy-reviewed grading federation design. Grading/shipping/cert evidence should remain private by default. |
| 🟢 P3 | Service naming | UI/help alternates between “BGS” and “Beckett”, and the page subtitle omits ACE although the form supports it. | Standardise provider display names and supported-provider copy from one registry. |
| 🟢 P3 | Documentation capability drift | Grading help currently promises batches, condition reports, exact collection linkage and verified/provenance semantics that the implementation does not provide. | Rewrite docs to the current manual single-card tracker immediately, then expand them only as provider-backed features land. |
| 🟢 P3 | Level 3 documentation drift | Wallet/card-attestation docs present Level 3 as live even though code marks it future-only. | Mark Level 3 “planned/not yet available” until the provider-verification and revocation design is deployed and tested. |
| 🟢 P3 | Audit build evidence | The Base44 command sandbox had no app checkout/package manifest, so no current build/lint/typecheck or grading test suite could be run here. | Run release gates from the canonical exact-commit CI checkout and attach results to the grading re-audit. |

## Feature-by-feature verdict

| Feature | Verdict | Notes |
| --- | --- | --- |
| Private grading submission tracker | Usable only as self-recorded notes | Owner-scoped RLS is good, but data is not provider verified and provenance fields are mutable. |
| Add submission | Incomplete | Selects one collection card, but does not persist exact CollectionEntry ID; docs promise batching/condition reports that do not exist. |
| Company selection | Partial | PSA/BGS/CGC/ACE only; “other” is documented but unsupported. |
| Parcel tracking | Minimal | Free-text tracking number only, no carrier/status model. |
| Declared value | Partial | GBP-only, no currency/bounds, not tied to valuation. |
| Status tracking | Self-recorded | No provider sync or server-enforced transition state machine. |
| Final grade recording | Self-recorded and unvalidated | Free text, no provider scale/cert link/subgrades. |
| Submission history | Incomplete | Newest 200 only, no pagination/search/archive. |
| Collection linkage | Broken | Card identity copied, exact physical collection copy not linked. |
| Grading condition report | Not implemented | Help claims centering/corners/edges/surface tracking but data model has none. |
| Grading batch/order management | Not implemented | One row per card, no batch/order entity. |
| Provider certificate verification | Not implemented | No current PSA/BGS/CGC/ACE verification adapter. |
| Level 3 graded attestation | Not implemented | Current attestation backend can only produce Levels 0-2. |
| Level 3 on-chain provenance | Not release ready | No external cert proof/revocation design. |
| Graded card medallion | Premature | Numeric level alone drives “Graded cert” display. |
| Graded-market price panel | Useful generic context | Shows provider/grade comparables but is not linked to the user's slab/cert. |
| Grading community labelers | Release blocker | Labeler self-approval can create false grader trust labels. |
| Grading challenge metric | Release blocker | Metric exists without authoritative GradingSubmission validation and inherits ChallengeEntry mutability. |
| Data export | Incomplete | GradingSubmission omitted. |
| Account deletion | Good baseline | GradingSubmission is included in account cleanup. |
| Authentication/privacy | Good baseline | `/grading` is protected and GradingSubmission RLS is owner-scoped for read/create/delete. |

## Verified strengths to preserve

- `/grading` is behind the authenticated ProtectedRoute.
- GradingSubmission read/create/delete is owner-scoped, so another ordinary collector cannot browse someone else's grading tracker through normal entity RLS.
- Account deletion includes GradingSubmission cleanup.
- The form normally starts from cards in the caller's own collection rather than arbitrary catalogue search.
- Declared monetary value is stored as pence, consistent with other GBP collection fields, even though future multi-currency support is needed.
- Current professional-grade records are not automatically treated as on-chain Level 3 evidence.
- `create-card-attestation` explicitly says Level 3 is future-only and does not accept caller-supplied grading fields.
- CardVerificationSession creation/update is backend/admin controlled, which prevents an ordinary browser client directly upgrading itself to Level 3.
- Private possession photos use private Base44 storage and short-lived signed URLs; professional grading evidence should preserve the same privacy pattern.
- PokemonPriceTracker public use is licence-gated and its graded-price data is presented as market enrichment, not as the user's certificate.
- No audit-visible live GradingSubmission, Level 3 attestation, grading CommunityLabeler or TrustTierRule records existed during this review.

## Recommended remediation order

### Phase 0 - fix trust boundaries

1. Make CommunityLabeler approval/reviewer/trust-label fields admin/backend-only and re-audit grading/authenticity label issuance.
2. Remove `grading_submissions` challenge rewards until a backend-authoritative grading-evidence evaluator exists; make ChallengeEntry trust fields backend-only.
3. Reword the current Grading page everywhere as a **self-recorded grading tracker**.

### Phase 1 - make the tracker structurally correct

1. Introduce `GradingBatch` + `GradingItem` (or equivalent) with immutable exact `collection_entry_id`.
2. Move all writes behind backend endpoints with a real state machine and audit-event history.
3. Add provider/order/item IDs, company-specific grade model, rejection/cancel states and duplicate protection.
4. Add structured pre-grade condition/evidence only if it is genuinely in scope.
5. Add pagination, edit/archive controls, error feedback and data export.

### Phase 2 - professional certificate verification

1. Build a canonical grading-provider registry.
2. Add deterministic provider-specific certification verification using official provider mechanisms where permitted.
3. Store normalized grade, cert reference, provider response provenance, fetched/verified timestamps and mismatch/unavailable states.
4. Separate self-recorded grade from provider-verified grade in every API/UI field.
5. Add revalidation, revocation/supersession and manual-review processes.

### Phase 3 - Level 3 and downstream trust

1. Do not enable Level 3 until the professional verification pipeline passes security tests.
2. Bind Level 3 to exact CollectionEntry + provider cert + smart-account signed challenge where appropriate.
3. Put only privacy-safe commitments/status/provenance on-chain, never private shipping details, scans or documents.
4. Make trade/insurance/value surfaces consume only the provider-verified grading projection.
5. Render provider/grade/as-of/revocation state with every “graded” trust badge.

## Required regression and adversarial tests

Before declaring grading release ready, test at minimum:

- a user cannot create a grading record for another user's CollectionEntry;
- a user cannot create a grading record for a card they do not own through a modified client;
- two identical collection copies remain distinguishable through submission, return and provider verification;
- duplicate active submissions follow the intended idempotency rule;
- invalid status transitions are rejected server-side;
- client attempts to rewrite service/card/timestamps/provider cert provenance are rejected;
- PSA/BGS/CGC/ACE grade formats are validated independently;
- a grade from one provider cannot be entered under another provider's cert;
- malformed/unknown cert numbers fail closed;
- provider network outage is not treated as invalid/counterfeit;
- provider result card identity must match the exact expected card before verification;
- provider result grade must match the displayed normalized grade;
- revoked/replaced/reholdered cert state supersedes old trust cleanly;
- self-recorded grade never becomes Level 3;
- only provider-verified grade can feed trade/insurance/on-chain graded trust;
- Level 3 mint metadata/commitment can be independently reconciled to the verified off-chain provenance without revealing private data;
- a user cannot self-approve a grading CommunityLabeler;
- an unapproved/revoked grading labeler cannot issue labels;
- grading labels cannot claim provider confirmation without evidence policy;
- a `grading_submissions` challenge only counts authoritative caller-owned grading evidence;
- ChallengeEntry contribution count/status/hash/labels cannot be user-modified;
- >200 grading submissions remain accessible through pagination;
- >500 collection cards remain selectable/searchable;
- grading data is present in export-my-data and removed by account deletion;
- tracking/evidence files remain private and are not federated/on-chain;
- all nine supported languages render the grading workflow without English-only form gaps;
- keyboard/focus tests pass for the submission dialog;
- build, lint/typecheck and grading tests run against the exact deployment commit.

## Release decision

**SwapPulse Grading should not be described or released as a verified grading/provenance system while the P0 findings remain.**

The existing page can be safely retained as a **private manual grading tracker** once its copy is corrected and exact-card binding/state integrity are fixed. Professional grade trust, “Verified Grader” labels, trade/insurance provenance and Level 3 on-chain status should remain disabled or clearly marked unavailable until deterministic provider verification, revocation and auditability are in place.