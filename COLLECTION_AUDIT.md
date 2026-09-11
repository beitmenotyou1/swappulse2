# SwapPulse Collection Audit

**Audit date:** 11 September 2026  
**Area:** Collection, collection-adjacent binders, scanning, grading, valuation, import/export and collection trust integrations  
**Overall score:** **38/100**  
**Risk:** **High**  
**Release status:** **NOT RELEASE READY**

## Executive summary

SwapPulse Collection has a strong feature set. The current product includes card tracking, rarity sorting, bulk actions, set completion, duplicate detection, a showcase binder, first-class multi-page binders, analytics, portfolio history, CSV/JSON/XML import and export, insurance reports, camera/photo scanning, grading submission tracking, photo-based possession checks, trade hand-off and collection-powered challenge/Web3 integrations.

The privacy foundation has improved significantly. Raw `CollectionEntry` records are owner-only in Base44, scanner and possession-check images use private uploads, current federation policy explicitly blocks raw CollectionEntry records from AT Protocol repositories, inbound PDS sync also refuses them, and an admin privacy-audit/remediation path exists for legacy public copies.

However, the collection subsystem still has several release-blocking trust and correctness problems. The most serious issue is a service-role binder resolver that trusts a mutable binder DID when selecting private CollectionEntry rows. A malicious binder owner can therefore attempt to resolve another collector's private cards through a binder they control. A previously identified challenge-submission path also still service-role fetches caller-supplied CollectionEntry IDs without binding them to the authenticated owner. In addition, the Insurance feature explicitly produces a PDF “for insurance claims and valuations” while operating on a collection silently capped at 500 entries and on `market_value` values that are not automatically maintained from the live `CardPricing` table.

Current live entity queries from the audit session returned no CollectionEntry or Binder records. That is not treated as proof that production has no records; it means this audit cannot assert a current live exposure count. Findings below distinguish verified code-level exploitability from observed live exposure.

## Scope

This audit covered:

- Collection Cards tab
- card count, total value and showcase count
- rarity filtering and sorting
- multi-select and bulk condition updates
- move-to-trade workflow
- set completion and missing-card calculations
- duplicate detection and Smart Bundles
- duplicate-to-trade workflow
- simple showcase binder, ordering, grid size and public/private toggle
- first-class Binder create/edit/view/delete flows
- binder visibility, followers-only access, AT Protocol publication and standard.site publication
- Collection Analytics and portfolio history
- scheduled portfolio snapshots
- market-price synchronisation
- JSON, CSV and XML export
- repository/data portability export
- CSV/JSON/XML import and AI file extraction
- insurance valuation PDF generation and document storage
- card scanner upload, review, quantity and finalisation flow
- automatic/self attestation and photo possession verification
- grading submission tracker
- collection-powered trade verification
- challenge contribution integration
- on-chain Card NFT minting from collection verification sessions
- profile/sidebar collection summaries
- offline/background collection writes
- privacy, federation, integrity, pagination, accessibility and release tests

## Method and constraints

The existing Base44 app was inspected directly through its project file/entity APIs. The project-mandated web-agent README URL was requested first from the Base44 sandbox but returned HTTP 403, so the audit continued against the actual application source, entity schemas, backend functions and current audit-visible entity data.

The Base44 shell environment exposed a separate `/workspace` without the app `package.json`, so `npm run build` could not be executed from that shell. This is recorded as an audit-environment limitation, not as evidence of a product build failure.

No Collection functionality was changed during this audit.

## Score breakdown

| Area | Score | Notes |
| --- | ---: | --- |
| Access control and privacy | 7/20 | Owner-only CollectionEntry RLS is good, but service-role binder/challenge paths break ownership isolation. |
| Data integrity and durability | 5/20 | Offline replay, non-atomic scan finalisation and silent optimistic failures can create drift or duplicates. |
| Valuation and reporting correctness | 3/15 | Portfolio and insurance values are not tied to authoritative live pricing; reporting can be incomplete. |
| Core collection workflows | 8/15 | Broad feature coverage, but the 500-entry ceiling affects nearly every tab. |
| Import, export and portability | 4/10 | Useful formats exist, but exports truncate and import trust/validation is weak. |
| Binders, sharing and federation | 4/10 | Current federation privacy policy is strong; binder ownership and lifecycle handling are not. |
| UX, accessibility and release confidence | 7/10 | Generally usable UI, but error handling, pagination, trust labelling and dedicated regression coverage are incomplete. |
| **Total** | **38/100** | **High Risk** |

## Findings

| Priority | Area | Finding | Required action |
| --- | --- | --- | --- |
| 🔴 P0 | Binder access control | `getBinder` uses service role and selects CollectionEntry rows with `binder.did` whenever it is present. `Binder.did` and binder slot IDs are owner-controlled data, so a malicious binder owner can supply another collector's DID and matching/guessed CollectionEntry IDs, then expose resolved private card details through a binder they control. | Derive collection ownership only from immutable `binder.created_by_id`; never use mutable DID as an authorisation selector. Validate every slot ID belongs to the binder owner on save and on read. Add cross-user negative tests. |
| 🔴 P0 | Challenge/collection ownership | `submitChallengeEntry` service-role fetches caller-supplied CollectionEntry IDs using only `{ id: { $in: ids } }` before validation. The function does not require `created_by_id: user.id`, so foreign private collection rows can be supplied to a challenge validation path. This remains the P0 previously identified in the backend audit. | Fetch contribution records with authenticated owner ID, reject any missing/foreign ID and calculate contribution state only from owner-bound rows. Add malicious foreign-card tests. |
| 🔴 P0 | Binder cross-post ownership | Binder creation integrates with the cross-post dispatcher, but `crossPostDispatcher` service-role loads caller-supplied Binder IDs without proving the Binder belongs to the caller or is public. A signed-in user who knows another Binder ID can cause its title/metadata to be formatted and sent through the attacker's own configured external destination. This remains the P0 previously identified in the backend audit. | Authorise every cross-post source record against the caller before service-role read. For Binder require owner match or an explicitly public, deliberately shareable read model; add foreign/private Binder cross-post tests. |
| 🔴 P0 | Insurance valuation integrity | The Insurance tab explicitly generates a PDF “for insurance claims and valuations”, but it receives the Collection page's maximum 500 entries and calls the resulting amount “Total declared value”. It also trusts `market_value`/purchase values that are not automatically reconciled from live CardPricing. The report can therefore be materially incomplete or stale while looking claim-ready. | Do not generate a claim-oriented report from partial/unverified data. Build the report server-side from the complete collection, include valuation source/currency/as-of timestamps and clear disclaimers, flag missing prices, and require the user to confirm the report is complete before export. |
| 🔴 P0 | Raw CollectionEntry federation | **Completed:** current `federationPolicy.ts` places `org.swappulse.collectionEntry` in `NEVER_FEDERATE`, `bridgeCollectionEntry()` is privacy-contained, and inbound PDS sync excludes raw CollectionEntry records. This closes the current publication path for sensitive collection notes, prices and acquisition dates. | **Completed:** keep the central deny policy and regression tests. Continue the legacy PDS cleanup/verification work in COL-015 until historical copies are proven absent. |
| 🟠 P1 | Collection completeness | `Collection.jsx` loads only the latest 500 CollectionEntry rows. The displayed card count, total value, rarity filters, select-all, set completion, duplicate analysis, simple binder, analytics, Import/Export and Insurance tabs all operate on that truncated array. This finding was already P1 in the frontend audit and remains unresolved. | Replace fixed-window collection reads with cursor pagination plus server-side aggregates. Every “total”, export and report must either be complete or explicitly labelled partial. |
| 🟠 P1 | Portfolio valuation | Collection “Total Value”, analytics, duplicate trade value, insurance reports and snapshots use `CollectionEntry.market_value || purchase_price`. The inspected pricing sync updates `CardPricing`, not CollectionEntry.market_value, so the displayed portfolio value can remain imported/manual/stale indefinitely. | Define one valuation service that joins each owned card/variant/condition to current pricing with currency and freshness. Store provenance/as-of time or calculate the aggregate on demand. Never present unversioned `market_value` as current market value. |
| 🟠 P1 | Pricing sync coverage | `syncPricing` reads only 500 CollectionEntry rows, 500 wishlists and 200 trades globally, then processes only the first 80 unique card IDs. Because each run begins from the same sorted windows, cards outside those windows/first 80 can starve rather than being “mopped up” on later runs. | Use persistent cursors/work queues and fair batching. Track last-priced time per card and prioritise stale/unpriced IDs rather than slicing the same deterministic first 80 each run. |
| 🟠 P1 | Portfolio snapshots | `capture-portfolio-snapshots` paginates CollectionEntry rows but stops after 5,000 records across the entire platform. Users beyond that global window can receive no snapshot or an incomplete one. | Paginate to exhaustion or process per-user partitions/cursors. Validate card_count/total against authoritative aggregates before writing a snapshot. |
| 🟠 P1 | Offline write integrity | `offlineSync.js` queues any failed create/update/delete/bulkUpdate as though it were an offline failure. Permanent auth/validation errors are therefore replayed indefinitely, and queued creates have no idempotency key. A server commit followed by a lost response can later replay into a duplicate physical-card row. | Queue only retryable connectivity failures, assign a client mutation/idempotency key to every operation, expose pending/failed outbox state and resolve conflicts explicitly. |
| 🟠 P1 | Collection export completeness | JSON/CSV/XML exports use the `items` prop whenever it is non-empty. Collection always passes its capped 500-row array, so a collector with more than 500 cards receives an apparently successful but incomplete backup/export. | Export through a backend/cursor path that reads the entire owner collection. Include record count, export timestamp and a completeness assertion in the file/response. |
| 🟠 P1 | Repository portability export | `export-repo` caps each entity at 1,000 rows and labels the result an AT Protocol-compatible/CAR-like repository while also embedding never-federated private CollectionEntry records and account email/full name. Large collections silently truncate and the archive semantics blur public AT records with private account data. | Rename this as a private account archive, paginate every entity to completion, separate private application data from public AT repository records and document the restore format/version. |
| 🟠 P1 | CSV export security | CSV values are quoted but cells beginning with `=`, `+`, `-` or `@` are not neutralised. User-controlled notes/card metadata can therefore become spreadsheet formulas when opened in Excel/compatible software. | Apply spreadsheet-safe CSV escaping/neutralisation to formula-like leading characters and test malicious note/card strings. |
| 🟠 P1 | Import rate limiting | `extract-collection-import` comments that it allows 10 extractions/user/hour, but it actually counts CollectionEntry rows created in the last hour and only blocks at 5,000. An authenticated user can repeatedly invoke paid file extraction without creating entries. | Add a dedicated extraction-attempt ledger/rate limiter keyed to user and time window. Enforce file-size, row, invocation and concurrency limits independently of successful import rows. |
| 🟠 P1 | Import remote-file trust | `extract-collection-import` accepts any plain HTTPS `file_url`; it does not prove the file is a Base44 private upload belonging to the caller. This turns the paid extraction integration into a remote-file processing boundary for arbitrary authenticated callers. | Accept only owner-scoped private file references or short-lived signed URLs generated by the application. Apply the existing SSRF/domain/provenance controls before any backend fetch/integration call. |
| 🟠 P1 | Import file privacy | CSV import uses generic `UploadFile` despite collection imports being able to contain acquisition dates, purchase prices and notes. The inspected flow does not establish the same private-upload guarantee used by Scanner and card attestation. | Use `UploadPrivateFile`, owner-scoped signed access and retention/deletion rules for collection import files. Do not expose a persistent public URL for sensitive import source data. |
| 🟠 P1 | Import data integrity | Import accepts a row when either `card_id` or `card_name` exists, performs no catalogue reconciliation/deduplication, accepts caller/importer-supplied `market_value`, and can import malformed or duplicate physical copies. Those values then feed portfolio and insurance calculations. | Add preview/dry-run, catalogue resolution, duplicate strategy, numeric/date validation and explicit value provenance. Imported market prices must be marked user-supplied, not current market data. |
| 🟠 P1 | Legacy PDS cleanup | Collection deletion calls `unbridgeRecord(item)` but ignores a failure and deletes/hides the local entry anyway. For a historical `bridged` CollectionEntry this can leave an orphaned public PDS record containing sensitive legacy fields. Admin privacy-audit/remediation tooling confirms this historical risk class exists. | Fail closed or queue guaranteed deletion/reconciliation before local retirement. Run the privacy audit to zero, remediate historical PDS copies, and retain tombstone/retry evidence. |
| 🟠 P1 | Binder privacy downgrade | When a first-class Binder changes from public to followers/private, PDS and standard.site deletion run asynchronously and failures are only logged. The UI navigates away without proving the former public copies were removed. | Make privacy downgrade a server-side transaction/state machine. Keep the binder in a “privacy update pending” state until every public publication is deleted or safely tombstoned, with retry/alerting. |
| 🟠 P1 | Binder federation updates | Public Binder edit calls `updateBridgedRecord(..., 'Binder')` without the required collection/NSID argument used by the helper/backend contract. Federation updates can therefore fail silently while the local binder appears saved. | Pass the canonical `org.swappulse.binder` collection or use a binder-specific server mutation. Surface reconciliation status and test edit propagation to the PDS. |
| 🟠 P1 | Binder deletion lifecycle | BinderDetail deletion removes the Base44 row but does not reliably unbridge the Binder PDS record. It also expects `standard_doc_uri` from `getBinder`, but that function does not return it, so standard.site cleanup normally cannot run from this page. | Delete all public copies server-side before/with local deletion and return the publication identifiers only through an authorised deletion endpoint rather than trusting page state. |
| 🟠 P1 | Binder public likes | BinderDetail optimistically increments `like_count` then directly calls `Binder.update`. Binder RLS allows owner/admin updates, not arbitrary visitors, so normal public likes can fail while the page still shows the increment locally. | Use a dedicated Like/recommend entity/function with one-like-per-user idempotency and server-maintained aggregate counts. Roll back UI on failure. |
| 🟠 P1 | Binder recommendations | `getBinder` omits `standard_doc_uri`, `recommend_count` and binder DID from the returned binder object, while BinderDetail requires those fields to render the interoperable Recommend control. The recommendation path is therefore disconnected. | Define and type one binder read model containing authorised publication/recommend metadata, or resolve recommendations through a dedicated endpoint. |
| 🟠 P1 | Binder collection resolution | `getBinder` resolves at most 500 owner CollectionEntry rows. Even after the ownership IDOR is fixed, a valid slot pointing to an older card can render blank once the owner has more than 500 entries. | Fetch exactly the slot IDs after validating ownership, rather than loading an arbitrary first 500 collection rows. |
| 🟠 P1 | Duplicate-to-trade workflow | Duplicates “List for Trade” directly creates a public TradeListing with no wanted cards, shipping/currency/expiry, no selected physical CollectionEntry/condition and no normal AT bridge/synchronisation flow. It bypasses the canonical TradeBoard creation path. | Route duplicates through the standard trade draft/create service, retain the chosen physical copy/condition and require the same visibility, expiry, shipping and federation rules as any other trade. |
| 🟠 P1 | Scanner atomicity | CardScanner creates CollectionEntry rows in the browser before calling `complete-card-scan`. If finalisation fails or the browser reloads after entries were created, those records remain while the scan session returns to review; the in-memory `createdByIndex` recovery map is lost on reload. | Move “create N owned entries + complete session” behind an idempotent backend transaction/workflow keyed by scan session and image/quantity. Retrying must return the same entry IDs. |
| 🟠 P1 | Simple binder privacy state | The Collection tab has a separate `binder_public`/`binder_grid_size` showcase system in addition to the first-class Binder entity. `setBinderSetting` updates local state before persistence and silently ignores `auth.updateMe()` failures; `binder_public` was not found in the inspected User schema. This retains the P1 privacy-truth problem from the frontend audit. | Consolidate on one binder model. If the showcase remains, give it an explicit schema/read model, authoritative save response and rollback/error state. Never display privacy state that failed to persist. |
| 🟠 P1 | Profile/sidebar portfolio consistency | Collection loads 500 entries, Profile loads smaller fixed windows (including 100 in collection-related profile paths), and RightSidebar uses 200. Users can therefore see different card counts/portfolio totals in different parts of SwapPulse. | Provide one owner portfolio aggregate service and paginated item service used by Collection, Profile, sidebar and agents. |
| 🟠 P1 | Privacy-contained profile collection feed | Some profile collection UI still uses `NetworkFeedSection type="collections"`, while `network-feed` intentionally returns an empty privacy-contained response for raw collection records. This leaves a collection-facing tab/section structurally present but incapable of showing data. | Replace it with an explicit, sanitised public collection projection if desired, or remove the network collection UI until such a projection exists. Never re-enable raw CollectionEntry federation. |
| 🟠 P1 | Card NFT trust wording | `mint-card` accepts any `status: verified` CardVerificationSession with levels 0-3. Level 0 is a self-attested collection claim, yet the uploaded NFT metadata description says “SwapPulse verified card possession attestation”. A level-0 token can therefore carry stronger wording than its evidence supports. | Require level 2+ for possession-verification wording, or label level 0 explicitly as self-claimed in token metadata/UI. Keep verification level machine-readable and human-readable. |
| 🟠 P1 | Collection regression coverage | Source searches found TCGDex unit tests but no dedicated automated coverage for Collection truncation, offline replay/idempotency, import/export completeness, binder ownership, insurance completeness, scanner transactionality or pricing/snapshot correctness. | Add unit, integration and adversarial tests for every P0/P1 invariant before release. |
| 🟠 P1 | Insurance document storage | Insurance PDFs are uploaded with generic `UploadFile` and the Document row only protects the stored URL. The report contains card inventory and valuation data, so confidentiality should not depend on obscurity of a file URL. | Store insurance reports as private files, return short-lived signed URLs to the owner and define retention/deletion behaviour. |
| 🟡 P2 | Grading trust semantics | GradingSubmission status progression and `received_grade` are entirely owner-editable. The feature is a personal tracker, not a verified PSA/BGS/CGC/ACE integration, but the UI does not prominently distinguish self-recorded grade/status from provider-confirmed data. | Label grading data “self-recorded” unless verified against a grading-provider source/certificate. Never feed self-entered grade into a platform verification level without independent evidence. |
| 🟡 P2 | Grading scale | Grading loads at most 200 submissions and 500 CollectionEntry rows with no pagination. Older submissions/cards can disappear from selection/history. | Add cursor pagination/search and preserve the exact CollectionEntry ID on a submission so duplicate copies are distinguishable. |
| 🟡 P2 | Possession attestation framing | `create-card-attestation` correctly documents that the visual check is off-chain and not bound to a chain identity, but the UI requires an on-chain identity and labels the action “Attest Card Ownership”. That can imply chain-backed ownership proof when the evidence is only an account-scoped visual possession check. | Rename the flow around “visual possession check”, explain that it is off-chain/not authenticity/ownership proof, and only claim on-chain binding after a wallet signature/contract commitment exists. |
| 🟡 P2 | Attestation collection scale | CardAttestation fetches only 100 CollectionEntry rows and displays only the first 12 unattested cards. Large collectors cannot reliably select older cards for an upgraded photo check. | Add owner-side search/pagination by card/entry and return only eligible entries from a backend query. |
| 🟡 P2 | Set-completion detail | Set completion derives from the truncated Collection array and the missing-card detail intentionally shows only the first 30 missing cards with no continuation. | After fixing source completeness, paginate/expand the missing list and show language/set-version assumptions. |
| 🟡 P2 | Price presentation consistency | Collection summary/analytics treat `market_value` as value, while CollectionCardRow primarily exposes purchase price. Users can see a total they cannot reconcile from the visible row values. | Show cost basis and estimated market value separately, including source/currency/as-of time, and provide an edit/history path for user-entered purchase data. |
| 🟡 P2 | Destructive card removal | Collection card deletion has no confirmation/undo and immediately removes the row from UI even when offlineSync may only have queued the delete. | Add confirmation or undo, show pending-sync state and restore the card if the authoritative delete fails. |
| 🟡 P2 | Binder slot portability | Binder schema calls `collection_entry_uri` an `at://` CollectionEntry URI, while BinderEdit actually stores local Base44 CollectionEntry IDs. Public binder federation therefore contains non-portable local identifiers and the field name/contracts are misleading. | Split `collection_entry_id` (private/local ownership reference) from portable public card projection data. Do not federate raw private CollectionEntry identifiers. |
| 🟡 P2 | Binder author navigation | BinderDetail links its author header to `/profile`, the current user's protected profile route, rather than the binder author's public `/profile/:did` or `/u/:handle` route. | Link to the binder author's resolved public profile. |
| 🟡 P2 | Binder editor scale | BinderEdit loads only 500 CollectionEntry rows into the slot picker, so older cards cannot be selected for a binder. | Search/paginate the owner's collection in SlotPicker instead of loading a fixed window. |
| 🟡 P2 | Binder directory scale | Binder lists use fixed maximum windows (for example 200) without continuation. Public/owner binders become undiscoverable beyond the cap. | Add stable cursor pagination to binder directories and owner binder management. |
| 🟡 P2 | Import UX | Import performs parsing/stamping/bulk creation immediately after file selection. There is no preview, column mapping, duplicate strategy, dry run or partial-error report, so one malformed row can make a large import difficult to diagnose. | Add staged preview/validation, row-level error reporting and explicit import confirmation. |
| 🟡 P2 | Background Sync claim | Collection offline code registers a `collection-sync` Background Sync tag, but the previously audited service worker has no corresponding `sync` handler. Offline replay therefore depends on foreground logic rather than the advertised background path. | Implement a service-worker sync handler with idempotency, or stop registering/claiming unsupported background sync. |
| 🟡 P2 | Binder reorder failure | Showcase binder reordering applies an optimistic local order and silently ignores persistence errors. The next visit can unexpectedly revert the order. | Roll back or mark unsaved order on failure and provide retry feedback. |
| 🟡 P2 | Trade draft identity | Bulk “Move to Trade List” converts selected physical CollectionEntry rows into only card ID/name/image. Condition, variant and CollectionEntry identity are lost, so multiple physical copies become indistinguishable in the trade draft. | Carry the selected CollectionEntry IDs/condition/variant into the trade draft and validate ownership before publication. |
| 🟢 P3 | Collection schema/documentation drift | CollectionEntry schema still describes raw records as mirrored to AT Protocol and `showcased` as a public digital binder flag even though current privacy policy forbids raw federation. | Update schema descriptions, documentation and comments to match the privacy-contained architecture. |
| 🟢 P3 | Binder copy/architecture drift | Binder code mixes terms such as AT URI, local entry ID, PDS binder, standard.site document and simple showcase binder without one user-facing trust model. | Document the two models or, preferably, consolidate them and use consistent “local/private”, “public federated” and “standard document” terminology. |
| 🟢 P3 | Audit build verification | The Base44 command shell did not expose the app package root (`/workspace/package.json` was absent), so build/lint/typecheck/browser tests could not be rerun in this audit session. | Run release gates from the canonical mounted checkout/CI deployment commit and attach immutable evidence to the remediation retest. |

## Feature-by-feature verdict

| Feature | Verdict | Notes |
| --- | --- | --- |
| Card tracking | Good foundation, not scalable | Owner-only RLS is strong; fixed 500-row read makes totals/history incomplete for large collections. |
| Rarity filter/sort | Works on loaded subset | Correct only inside the truncated window. |
| Bulk condition updates | Useful, durability risk | Offline queuing/error classification and silent federation no-ops need hardening. |
| Move to trade | Incomplete | Loses physical-copy/condition identity. |
| Set completion | Useful, incomplete | Based on capped collection and missing-list truncation. |
| Duplicates | Useful analysis | Trade CTA bypasses the normal trade workflow. |
| Smart Bundles | Promising | Should consume authoritative owner collection/trade services after the core integrity fixes. |
| Showcase binder | Architecture debt | Separate from first-class Binder and privacy persistence is optimistic/silent on failure. |
| First-class Binder | Unsafe | P0 cross-user private collection resolver plus publication lifecycle issues. |
| Analytics | Misleading at scale | Inherits collection cap and stale/unproven market values. |
| Portfolio history | Good concept | Scheduled snapshot global cap can omit users/cards. |
| Market pricing | Useful source layer | CardPricing is refreshed, but CollectionEntry values/portfolio are not reconciled to it. |
| JSON/CSV/XML export | Broken for large collections | Parent passes only the latest 500 records. |
| Repo/account export | Incomplete/misnamed | 1,000/entity cap and mixes private app data with AT repo semantics. |
| CSV import | High-risk data quality | No true extraction-attempt limiter, private-upload guarantee, preview, canonical validation or dedupe. |
| JSON/XML import | Functional foundation | Same validation/value-provenance problems after parsing. |
| Insurance PDF | Release blocker | Claim-oriented wording over partial/stale/unverified data. |
| Scanner | Strong privacy, weak transactionality | Private uploads and owner checks are good; creation/finalisation is not atomic across reload/failure. |
| Auto self-attestation | Correctly level 0 | Possession badge helper correctly requires level 2+, which should be preserved. |
| Photo possession check | Stronger foundation | Owner-scoped private files and level 2 threshold are good; UI overstates on-chain/ownership semantics. |
| Grading tracker | Personal tracker only | Self-entered statuses/grades are not provider verification. |
| Card NFT mint | Technically level-aware | Level 0 tokens need self-claim wording rather than “verified possession”. |
| Challenge contribution | Unsafe | P0 foreign CollectionEntry service-role read remains. |
| Profile/sidebar collection summaries | Inconsistent | Different hard caps produce conflicting portfolio totals. |
| Legacy collection federation | Contained in current code | Historical PDS cleanup still needs a proven zero state. |

## Verified strengths to preserve

The audit confirmed several controls that should remain:

- CollectionEntry direct RLS is owner-only for read, create, update and delete.
- Raw CollectionEntry federation is now centrally denied.
- `sync-from-pds` does not re-import raw CollectionEntry records.
- Scanner images use private uploads, enforce file count/type/size limits and require a review step.
- `complete-card-scan` binds scan sessions and CollectionEntry IDs to the authenticated user and validates card/condition/variant consistency.
- Photo possession verification resolves the card identity from the owned CollectionEntry rather than trusting a browser-supplied card ID.
- Possession-check images use short-lived signed URLs and are not persisted as signed public URLs.
- AI possession verification explicitly says it is not authenticity/grading/counterfeit verification.
- Trade `possession_verified` synchronisation correctly requires verification level 2+, so level-0 self claims do not earn the badge.
- First-class Binder federation helper only publishes explicitly public binders.
- Central federation policy recognises AT repositories as public and rejects followers/private publication semantics.
- Admin privacy audit/remediation tooling counts legacy bridged CollectionEntries and sensitive fields without returning the sensitive values themselves.
- `analyzeCollectionOpportunity` binds the CollectionEntry to the authenticated caller before reading it and treats model analysis as non-financial advice.

## Remediation order

### Phase 0 - release blockers

1. Fix `getBinder` ownership binding and slot validation.
2. Fix `submitChallengeEntry` foreign CollectionEntry access.
3. Fix Binder cross-post source ownership/visibility authorisation.
4. Redesign Insurance report generation around complete, source-attributed valuation data and private storage.
5. Run the legacy collection privacy audit/remediation until raw PDS copies are proven absent.

### Phase 1 - collection truth and durability

1. Remove the 500-entry collection ceiling with server aggregates and cursors.
2. Create an authoritative portfolio valuation service backed by CardPricing with source/currency/as-of metadata.
3. Replace pricing/snapshot fixed global windows with persistent fair cursors.
4. Add idempotent collection mutation IDs and classify retryable offline failures.
5. Make scanner confirmation transactional/idempotent.
6. Make all exports complete and imports staged/validated/private.

### Phase 2 - binder/trade/integration consolidation

1. Consolidate the showcase binder and first-class Binder models.
2. Make Binder privacy downgrade/delete publication cleanup fail-safe.
3. Repair Binder federation edit, likes, recommendations and public profile routing.
4. Route duplicate/bulk trade actions through the canonical trade service with physical-copy identity.
5. Correct Card NFT and attestation trust language.

### Phase 3 - scale, UX and accessibility

1. Add pagination/search to grading, attestation picker, binder editor/directory and completion lists.
2. Add import preview/row errors and delete/undo states.
3. Reconcile Collection/Profile/sidebar totals.
4. Update stale schemas/docs and add end-to-end collection regression tests.

## Required regression tests

At minimum, the release suite should prove:

- a binder owned by user A cannot resolve any CollectionEntry owned by user B even if A supplies B's DID and exact entry ID
- followers/private binder checks never rely on caller-controlled ownership fields
- challenge submission rejects any foreign CollectionEntry ID
- cross-posting a Binder rejects every foreign/private Binder ID not authorised for the caller
- Insurance report item count equals the owner's authoritative complete collection or clearly reports excluded/unvalued items
- Insurance valuations include source, currency and as-of time
- collections over 500/1,000/5,000 records retain correct count/value/export/snapshot behaviour
- every collection create has an idempotency key and ambiguous retries cannot duplicate a physical copy
- scanner retry/reload after partial creation reuses the same CollectionEntry IDs
- pricing sync eventually services every stale tracked card rather than the same first 80
- portfolio snapshots include every user/card regardless of platform-wide entry count
- JSON/CSV/XML exports contain every owner row
- CSV export neutralises formula injection
- collection import invocation limits count attempts, not resulting CollectionEntry rows
- import rejects unowned/untrusted remote file sources
- imported rows receive catalogue validation, row-level errors and an explicit value provenance
- raw CollectionEntry cannot be published or ingested through any PDS bridge path
- deletion/privacy downgrade retries historical PDS cleanup until confirmed
- public Binder edit updates the federated record
- public Binder delete removes PDS and standard.site publications
- public Binder like is authorised/idempotent and cannot be forged by client count updates
- duplicate-to-trade uses the normal trade validation/federation path
- level-0 self attestation never earns a possession-verified badge
- level-0 Card NFT metadata visibly says self-attested/self-claimed
- photo possession verification remains owner-scoped and private
- self-entered grading data is never treated as provider-verified
- Collection, Profile and sidebar use the same authoritative portfolio totals

## Release decision

**Collection should not be treated as production-release ready while the unresolved P0 findings remain.**

The immediate goal is not to add more collection features. The feature set is already broad. The priority is to make collection ownership authoritative across every service-role consumer, make “portfolio value” and insurance outputs provably complete and source-attributed, and make offline/scanner/import workflows idempotent enough that a physical-card inventory cannot silently diverge from what the collector actually owns.
