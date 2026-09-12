# SwapPulse Labelers and Labels Audit

**Audit date:** 12 September 2026  
**Scope:** Community labeler directory, creation/approval model, labeler subscriptions, label issue/removal, badges and feed filters, AT Protocol federation, inbound label provenance, platform moderation labels, AI moderation workflows, label revocation/appeals, notifications, account deletion/export, accessibility/localisation, scalability and automated test coverage.  
**Overall score:** **31/100**  
**Risk:** **High Risk / Needs Remediation**  
**Release status:** **NOT RELEASE READY**  
**Status:** Complete with critical residual actions

## Findings

| Priority | Area | Finding | Required action |
| --- | --- | --- | --- |
| 🔴 P0 | LB-001 - Community labeler self-approval | `CommunityLabeler` owners can update their own whole row through RLS, including `approval_status`, `reviewed_by` and `reviewed_at`. `apply-community-label` trusts `approval_status === 'approved'`. A collector can therefore create a labeler, set it to approved and immediately gain the trusted labelling capability without an independent SwapPulse review. This is the same structural P0 already recorded in the AT Protocol, Backend and Grading audits. | Make approval state and reviewer metadata backend/admin-only. Create a separate review action that derives reviewer identity/time server-side, records an immutable review event and is the only path to `approved`, `rejected` or `revoked`. Keep this P0 priority after remediation and mark the action `Completed:` when fixed. |
| 🔴 P0 | LB-002 - Post-approval policy mutation | Even if an administrator legitimately approves a labeler, the owner can subsequently rewrite `category`, `label_values`, `did`, author metadata and trust counters while remaining `approved`. An approved low-risk labeler can therefore turn itself into a grading/authenticity/safety authority or add new trust-sensitive labels after review without re-approval. | Freeze the reviewed policy envelope after approval. Make category, label values, DID binding, approval fields and counters backend-owned. Any policy expansion or identity change must move the labeler back to `pending` and require a new review. |
| 🔴 P0 | LB-003 - Federated labeler approval forgery | `mapCommunityLabelerFields()` imports remote `approvalStatus`, `reviewedBy`, `reviewedAt`, counters and `authorDid` directly from the remote record into local `CommunityLabeler`. `shouldIngestFederatedRecord()` has no labeler-specific trust gate. A remote repository can therefore publish a record that says it is `approved` and have that self-asserted state stored in the same local field used for SwapPulse-approved labelers. | Treat remote labeler records as untrusted declarations only. Bind authorship to the repository DID, ignore remote approval/reviewer/counter claims, store external-review state separately, and require an explicit local trust decision before a remote labeler can be shown as SwapPulse-approved or issue trusted local labels. |
| 🔴 P0 | LB-004 - Federated label impersonation | `mapCommunityLabelFields()` accepts remote `labelerId`, `labelerDid`, `labelerName`, `labelerCategory`, `labelValue` and `authorDid` without proving that the repository DID owns the referenced labeler, that the labeler is locally approved, or that the label value is allowed. `get-community-labels` then trusts `labeler_id` when deciding which labels a subscriber sees. A malicious remote repository can therefore create a `CommunityLabel` that names a legitimate subscribed labeler ID and have it rendered to that labeler's subscribers. | On ingest, derive issuer DID from the repository/AT URI, resolve the authoritative labeler record, require issuer DID ownership plus current local approval, validate the label value against the approved policy, validate the subject and reject conflicting cached identity fields. Add adversarial cross-labeler impersonation tests. |
| 🔴 P0 | LB-005 - Platform moderation-state ownership | `Post` owners can still update their own record, including `moderation_labels`, `moderation_status`, `moderation_notes`, `moderated_by` and `moderated_at`. A post author can therefore alter or clear platform moderation labels/state that were intended to be moderator-controlled. This is inherited from PF-002 and remains directly relevant to the labels subsystem. | Move every platform moderation field behind moderator/service-role-only mutation. Normal post editing must use an allowlist that excludes moderation state. Add tests proving an author cannot remove, rewrite or downgrade labels/status. |
| 🔴 P0 | LB-006 - Moderation labels not enforced in discovery | Current audit-visible data still contains **446 public Post rows with `moderation_status: escalated`**, many carrying moderation labels whose recommended action is `hide`. Key public feed paths do not consistently convert moderation state into feed eligibility. This is inherited from PF-005 and remains an active labels/enforcement failure. | Introduce one mandatory server-side feed-eligibility policy covering platform moderation labels/status/action, account enforcement and viewer controls, then apply it to Explore, Home, custom feeds, hashtag/profile feeds and external merges. Reconcile existing escalated rows before release. |
| 🟠 P1 | LB-007 - No standards-based AT labeler service | SwapPulse's network-label path calls `com.atproto.label.emitLabels` through the user's/shared PDS. No standards-based labeler service identity, `#atproto_label` signing key, `#atproto_labeler` service endpoint, `com.atproto.label.queryLabels` endpoint or `com.atproto.label.subscribeLabels` stream was found. Current AT Protocol guidance treats labels as signed, free-standing objects distributed by a labeler service. | If protocol-native labels are required, operate/integrate a real AT labeler service such as Ozone, publish the labeler DID/service/signing key, sign labels and expose/query the standard distribution endpoints. Keep custom SwapPulse community records separate if they remain a distinct product feature. |
| 🟠 P1 | LB-008 - Custom labels are presented as protocol labels | `org.swappulse.communityLabel` is a custom repository record. The Help page says labels are AT Protocol records published by labeler accounts and that SwapPulse subscribes to labelers in the protocol-native sense. That conflates custom repo records with AT's label primitive, which has different signing, source, distribution, policy-definition and negation semantics. | Rename/document the custom feature accurately, or migrate it onto the protocol-native label architecture. Do not describe a custom repository record as equivalent to a signed AT moderation label. |
| 🟠 P1 | LB-009 - Labeler-subscription portability is internally contradictory | The `LabelerSubscription` schema/Lexicon says subscriptions are mirrored/portable and `SubscribeLabelerButton` invokes `bridge-record` after creating one. `federationPolicy.ts`, however, places `org.swappulse.labelerSubscription` in `NEVER_FEDERATE`, so the bridge rejects publication. The UI swallows that failure. | Decide the privacy model. If subscriptions are private, keep them local, remove portability claims/Lexicon publication attempts and do not call the bridge. If portability is required, design an explicit privacy-safe standards-compatible preference mechanism rather than silently publishing a user's moderation choices. |
| 🟠 P1 | LB-010 - Labeler creation and governance workflow missing | Help says any collector can set up a labeler in Settings, but no current creation/settings workflow was found. There is also no dedicated administrator review queue/function for approving, rejecting, revoking or re-reviewing a CommunityLabeler. The only structural route to approval is the insecure editable entity field. | Build backend-owned `request-labeler`, `review-labeler`, `update-labeler-policy` and `revoke-labeler` flows with UI for applicants and moderators. Record review reason, reviewer, scope, effective time and policy revision. |
| 🟠 P1 | LB-011 - Revocation not enforced at label read time | `get-community-labels` resolves the viewer's subscribed `labeler_id` values and returns matching `CommunityLabel` rows. It does not re-check that each referenced `CommunityLabeler` is currently `approved`. Existing labels from a revoked/rejected labeler can therefore continue to render for subscribers. | Join/resolve current labeler trust state server-side for every label response, or materialise a verified issuer projection. Suppress labels from revoked/unapproved issuers immediately and invalidate caches/subscriptions on revocation. |
| 🟠 P1 | LB-012 - Subscription target integrity | `LabelerSubscription` remains directly client-creatable and only RLS-binds ownership of the row, not the target. A modified client can create duplicate subscriptions or subscribe to a nonexistent, pending, rejected or revoked `labeler_id`. The documented one-record-per `(did,labeler_id)` rule is not enforced. | Move subscribe/unsubscribe behind an authenticated backend endpoint that derives the caller DID, requires a current approved labeler, enforces idempotent uniqueness and rejects invalid/revoked targets. |
| 🟠 P1 | LB-013 - Labeler updates/deletes bypass federation reconciliation | Owners can directly update/delete CommunityLabeler rows. Those entity operations do not automatically call `updateCommunityLabeler`/PDS deletion. Local policy/approval/name changes can therefore drift from a previously published PDS record, and direct deletion can leave a remote copy behind. | Make labeler mutation backend-only and drive local state plus PDS/outbox state through one transaction/state machine. Persist pending/failed reconciliation and retry until local/PDS state converges. |
| 🟠 P1 | LB-014 - Labeler deletion has no cascade/retraction policy | Deleting a CommunityLabeler does not retract its CommunityLabels, remove/invalidate LabelerSubscriptions, preserve an issuer tombstone, or reconcile its public record. Existing labels can become orphaned with cached issuer names/categories and subscribers can retain dead references. | Implement explicit retirement/revocation rather than destructive deletion for approved labelers. Retract/supersede issued labels, invalidate subscriptions, retain a minimal audit tombstone and reconcile federation. |
| 🟠 P1 | LB-015 - Label removal can be stranded after DID change | `apply-community-label` removal authorises a normal caller by comparing the label's cached `did` with the caller's current DID. It does not resolve immutable ownership through `labeler_id`/creator ID. A legitimate DID migration can therefore make the original labeler owner unable to remove an old label without administrator help. | Authorise removal by immutable labeler ownership/account identity, then verify current issuer DID separately for federation. Add DID-migration tests and preserve issuer history. |
| 🟠 P1 | LB-016 - Label subject is not authoritatively validated | `apply-community-label` accepts caller-provided `subject_uri` and `subject_type` without loading the target, proving that it exists, checking that `subject_type` matches, checking target version/CID, or applying type-specific policy. Approved labelers can create misleading labels against arbitrary/malformed references. | Resolve the subject through a server-side target registry. Validate URI syntax, actual record type, existence/visibility/version and any labeler scope restrictions before issuance. |
| 🟠 P1 | LB-017 - Local fallback subject IDs break portable labels | Post and trade UI pass `post.at_uri || post.id` and `trade.at_uri || trade.id` into `LabelContentButton`. The CommunityLabel Lexicon requires `subjectUri` to be an `at-uri`. A label can therefore succeed locally against a plain Base44 ID but fail federation, while the UI still presents the local operation as applied. | Use a typed local subject identifier for local-only labels, or require a real AT URI before claiming federation. Do not submit a local database ID into an `at-uri` field. Surface local-only versus federated status clearly. |
| 🟠 P1 | LB-018 - Community labels are not bound to a subject version | CommunityLabel has no subject CID/version field. A trust/safety label can remain attached after the target record is materially edited or replaced, even when the evidence/reason for the original label no longer applies. | Store the evaluated subject CID/version where available and define whether a label follows the URI across edits or requires re-evaluation. For trust-sensitive labels, default to version-bound evidence or explicit revalidation. |
| 🟠 P1 | LB-019 - Community-label lifecycle lacks expiry/negation history | The custom CommunityLabel model has no expiry, negation or supersession fields. Removal physically deletes the local row after remote deletion instead of retaining a retraction/audit event. This is materially weaker than the lifecycle expected from moderation/trust labels. | Add append-only issue/retract/supersede/expire events or use the native AT label lifecycle. Preserve who retracted, when, why and which prior label was superseded. |
| 🟠 P1 | LB-020 - No appeal/dispute route for labelled subjects | A user whose post/profile/trade receives a community label has no dedicated appeal, correction request, contextual response or review workflow. The target owner also cannot remove the label, which is correct for issuer integrity but requires a fair dispute path. | Add label appeal/report flows routed to the issuer and, for trust-sensitive categories, to SwapPulse moderation. Preserve original evidence and final review outcome in an auditable history. |
| 🟠 P1 | LB-021 - No labelling abuse/rate controls | `apply-community-label` has no explicit per-labeler/user rate limit, batch ceiling, abuse throttle or bot-risk control. Once a labeler is approved, it can rapidly mass-label arbitrary subjects and generate public records/notes until manually stopped. | Add per-labeler and per-account rate limits, anomaly monitoring, batch safeguards and emergency revocation. Alert on abnormal issue/retract volume and trust-category spikes. |
| 🟠 P1 | LB-022 - Community-label notification control is non-functional | Settings exposes an event trigger named `community_label` with the description "Labels applied to your content". The `Notification.action_type` enum has no `community_label` value and no backend producer was found. Users are offered a safety notification preference that cannot currently deliver. | Add a first-class community-label notification event through the central dispatcher, or remove the control until implemented. Notify target owners of issue, change, retraction and appeal outcome while respecting central notification policy. |
| 🟠 P1 | LB-023 - No per-label hide/warn/ignore policy | Native AT label consumption supports configurable behaviour such as hide, warn or ignore for each label definition. SwapPulse subscriptions are all-or-nothing. No per-label policy/default setting or adult/sensitive-content override exists in the CommunityLabeler model/UI. | Add explicit per-label policy definitions and user choices, or integrate native labeler policy definitions. Separate informational trust badges from moderation labels that hide/warn content. |
| 🟠 P1 | LB-024 - Help overstates automatic enforcement | Help says labels from subscribed labelers "automatically filter or warn" content. Current normal UI renders coloured badges and offers an optional label filter; no automatic hide/warn policy is applied by subscription alone. | Rewrite Help immediately to the current badge/filter behaviour, or implement the promised per-label enforcement system before making the claim. |
| 🟠 P1 | LB-025 - Feed label filter bypasses opt-in trust model | `getFeedSkeleton` implements the `labels=` filter by querying up to 500 CommunityLabel rows globally by `label_value`. It does not require viewer subscriptions, current issuer approval or verified label provenance. A forged/remote/unapproved label can therefore make content match a public feed filter. | Resolve filters only against verified current issuers selected by the viewer/feed policy. Include issuer identity in the filter key rather than trusting a global free-form label value. |
| 🟠 P1 | LB-026 - Badge cache is not scoped to the active account | `src/lib/communityLabels.js` uses a module-level cache keyed only by subject URI. Cached label arrays are not keyed by authenticated user, subscription revision or session epoch. On account switching within the same app session, a second user/guest can temporarily see the first user's opted-in label badges. | Key cache entries by session/user plus subscription revision, and clear all label caches on login/logout/account/DID changes. Never reuse viewer-specific policy results across identities. |
| 🟠 P1 | LB-027 - Label lookup failures become sticky false negatives | If `get-community-labels` fails, the client caches an empty array for every requested URI. There is no expiry/backoff/retry marker, so a transient backend outage can suppress safety/trust labels for the rest of the module session. | Cache errors separately from confirmed empty results, use short TTL/backoff and retry. Safety-related label failures should surface degraded state rather than silently becoming "no labels". |
| 🟠 P1 | LB-028 - Subscription changes do not invalidate badge cache | Subscribe/unsubscribe updates local subscription UI but does not invalidate the module-level CommunityLabel cache. Already-viewed subjects can keep old labels after unsubscribe or fail to gain newly subscribed labels until reload/other invalidation. | Invalidate/reload label caches whenever subscriptions change and include a subscription version in cache keys. Add subscribe/unsubscribe live-update tests. |
| 🟠 P1 | LB-029 - Subscription DID source is inconsistent | `SubscribeLabelerButton` writes `did: user.data?.did || ''`, while current identity code elsewhere uses `user.did` as authoritative. A valid signed-in user can create a subscription with an empty/stale stored DID even though row ownership works via `created_by_id`. | Stop accepting DID from the browser. Derive current DID server-side in the subscription endpoint and reconcile stale/empty existing rows. |
| 🟠 P1 | LB-030 - Subscriber counts are not authoritative | The UI displays `CommunityLabeler.subscriber_count`, but subscribe/unsubscribe does not update that counter and no authoritative recomputation path was found. Labeler popularity can therefore remain at zero/stale values and the field is owner-editable under current RLS. | Derive subscriber counts from authoritative subscriptions or maintain them atomically server-side. Make the counter read-only to labeler owners and periodically reconcile it. |
| 🟠 P1 | LB-031 - Label counts are race-prone and forgeable | `apply-community-label` increments/decrements `label_count` using read-modify-write and swallows update failures. Concurrent operations can lose updates. CommunityLabeler owners can also edit the counter directly. The directory therefore presents a trust metric that is neither immutable nor reliably counted. | Maintain counts atomically/backend-only or calculate them from labels. Reconcile existing counts and never use them as a trust signal until authoritative. |
| 🟠 P1 | LB-032 - Revoked/rejected status is misrepresented in UI | `LabelerCard` renders `Approved` only for `approved`; every other state, including `rejected` and `revoked`, is displayed as `Pending`. A revoked labeler can therefore appear merely awaiting review rather than explicitly untrusted/withdrawn. | Render all four statuses distinctly, with reason/effective date where appropriate. Hide or clearly quarantine revoked/rejected entries from the normal discovery catalogue. |
| 🟠 P1 | LB-033 - Badge provenance is too weak for trust labels | `LabelBadges` displays only cached `labeler_name`, category colour, label value and note in a browser `title` tooltip. It does not show issuer DID, current approval/revocation state, policy revision, label timestamp, evidence/source link or a route to inspect the labeler. Cached names/categories can also be forged by the inbound issue in LB-004. | Render verifiable issuer identity and current trust state, link to a labeler detail/provenance view, and distinguish locally verified metadata from issuer-supplied display text. |
| 🟠 P1 | LB-034 - Single moderation dismissal can diverge remotely | `moderation` emits negation labels after a single `dismiss`, but does so asynchronously and catches/logs the failure without persisting retry state. The local moderation decision can say dismissed while a previously emitted network label remains active. | Use a durable outbox/reconciliation state for every label issue/negation. Do not treat remote retraction as complete until confirmed; expose pending/failed state to moderators. |
| 🟠 P1 | LB-035 - Bulk moderation dismissal does not emit network negations | The moderation `bulk` path updates post status and logs actions, but unlike the single-item `dismiss` path it does not emit negation labels for dismissed posts. Bulk-dismissed labels can therefore remain active on the network even when local moderation says dismissed. | Route single and bulk actions through the same label lifecycle service so every dismissal produces/retries the required retraction/negation events. |
| 🟠 P1 | LB-036 - Moderation queue and statistics are capped at 500 posts | `loadFlagged()` calls `Post.list('-created_date', 500)` and performs all queue/stat filtering in memory. Older labelled/escalated posts fall outside moderation queue statistics and cannot be reached through this path once the platform exceeds the cap. | Use server-side indexed filters and cursor pagination over the complete moderation dataset. Compute stats from the full authoritative set or a maintained aggregate, not the latest 500 Posts. |
| 🟠 P1 | LB-037 - Account deletion omits community labeler data | `delete-account` does not include `CommunityLabeler`, `CommunityLabel` or `LabelerSubscription` in its cleanup list. Deleting a SwapPulse account can therefore leave applicant/issuer records, labels and subscription preference rows behind. | Define retention/legal policy for issued moderation records, then explicitly clean/anonymise account-owned CommunityLabeler and LabelerSubscription data and preserve only the minimal justified moderation audit data. Reconcile any public PDS records before deleting the local identity. |
| 🟠 P1 | LB-038 - Data export omits labeler/subscription data | `export-my-data` does not export CommunityLabeler, CommunityLabel or LabelerSubscription rows. A user's labeler applications/policies, issued labels and moderation-subscription preferences are therefore absent from the portability archive. | Add user-owned labeler/subscription/issued-label records to data export with clear provenance and exclusions for protected internal moderation-only fields. |
| 🟠 P1 | LB-039 - Legacy `ModerationLabel` corpus is fragmented from the live UI model | Audit pagination proved **more than 2,000 `ModerationLabel` rows** exist. Current post rendering primarily uses embedded `Post.moderation_labels`, while CommunityLabel uses a third model. The three label systems do not share one issuer, revocation, expiry, appeal or audit lifecycle. | Define a canonical architecture: platform enforcement labels, community opt-in labels and any native AT labels may remain distinct classes, but each needs explicit provenance and a shared lifecycle/audit contract. Migrate or retire the legacy corpus deliberately rather than leaving disconnected records indefinitely. |
| 🟠 P1 | LB-040 - No dedicated labeler/moderation regression suite | The only test file visible under `base44/shared/__tests__` is `tcgdexClient.test.ts`. No dedicated tests were found for labeler approval, post-approval mutation, remote issuer forgery, subscription isolation, revocation, badge cache isolation, label appeals, moderation-feed enforcement or remote negation. | Add unit/integration/adversarial tests for every P0/P1 invariant and make them release gates. Include multi-account, DID-migration, federated attacker, bulk moderation and transient-network cases. |
| 🟡 P2 | LB-041 - Labeler catalogue pagination | `/labelers` loads at most 50 labelers and has no pagination, search or continuation. Valid approved labelers beyond the newest 50 become undiscoverable. | Add cursor pagination/search and default the catalogue to approved/current labelers only. |
| 🟡 P2 | LB-042 - Subscription list caps | The Labelers page loads at most 100 subscriptions and `get-community-labels` loads at most 200 subscriptions for the active user. Larger subscription sets silently become partial. | Use cursor/complete indexed lookups or enforce a documented subscription limit with explicit UX. Never silently ignore saved subscriptions. |
| 🟡 P2 | LB-043 - Per-batch label truncation | For each chunk of up to 50 subject URIs, `get-community-labels` fetches at most 200 matching labels. A heavily labelled feed batch can silently omit labels with no `partial` indicator. | Page until complete or return deterministic per-subject limits plus truncation metadata. Safety labels should never disappear because an unrelated subject consumed the batch cap. |
| 🟡 P2 | LB-044 - Feed filter scans only 500 labels | `getFeedSkeleton` resolves a label filter from at most 500 CommunityLabel rows. Older matching labels are ignored, so labelled feed results change as the global label table grows. | Query by indexed issuer/value/subject with stable pagination or materialise a filter index. Do not derive feed correctness from a global 500-row window. |
| 🟡 P2 | LB-045 - Label-value schema is under-constrained | CommunityLabeler limits the array to 20 items but does not impose an item length/pattern/canonicalisation rule. The individual issued `label_value` is max 60, so a labeler policy can contain values that cannot be issued cleanly or that differ by case/spacing. | Define a canonical identifier format and per-item max length, normalise/deduplicate values and version policy changes. |
| 🟡 P2 | LB-046 - Positive and negative semantics share only category styling | Authenticity, grading and safety badges colour by category, not by the meaning/severity of the label. A positive value such as `verified-authentic` and a negative value such as `suspected-reprint` from the same category receive the same visual trust treatment. | Give every label definition explicit semantics/severity/default behaviour and render positive, cautionary and blocking signals distinctly. |
| 🟡 P2 | LB-047 - Labeler UI is hardcoded English | Labeler directory, category chips, subscription controls, application dialog, status text, notes and errors are hardcoded English rather than using the nine-locale translation system. | Add stable translation keys for the full labeler/moderation UX and test all supported locales, including long labels/status names. |
| 🟡 P2 | LB-048 - Label application dialog accessibility | `LabelContentButton` implements its modal as a custom fixed overlay rather than the shared accessible Dialog primitive. Focus trapping/restoration, Escape handling and modal semantics are not demonstrated. | Use the shared Dialog component with `aria-modal`, labelled title/description, focus trap, Escape close and focus restoration. |
| 🟡 P2 | LB-049 - Badge explanation relies on `title` tooltip | Label reason/issuer text is placed in the HTML `title` attribute. This is unreliable on touch devices and weak for keyboard/screen-reader users. | Provide an accessible popover/details control with focusable disclosure, semantic issuer/value/reason text and mobile support. |
| 🟡 P2 | LB-050 - Help promises media labelling not implemented by the model | Help says labelers apply to posts, profiles and media. `CommunityLabel.subject_type` supports only `post`, `profile` and `trade_listing`; there is no media subject type or media-specific badge/enforcement path. | Remove the media claim or implement an explicit media subject model with precise blob/version references and viewer controls. |
| 🟡 P2 | LB-051 - AI moderation is on security hold without labeler-facing operational clarity | `AI Moderation - Posts` and `Toxic Label Handling` workflows are intentionally disabled with `condition: false` pending secure internal authentication/human review. This is a good safety hold, but normal labeler/moderation product copy does not clearly distinguish inactive automated enforcement from active manual/community features. | Keep the workflows disabled until securely redesigned, and expose accurate operational status in administrator/help documentation so nobody assumes automatic labels/strikes are currently active. |
| 🟡 P2 | LB-052 - Exact-release build/test execution unavailable in this audit shell | The Base44 command sandbox does not mount the app package checkout even though `package.json` is visible through Base44 source APIs, so build/lint/typecheck and executable labeler tests could not be rerun against the exact audited tree in this session. | Run `build`, `lint`, `typecheck` and the new labeler/moderation tests from the canonical exact-commit CI checkout before changing release status. Attach results to the re-audit. |
| 🟢 P3 | LB-053 - Label terminology is overloaded | Product/code use "label", "labeler", "community label", `Post.moderation_labels` and `ModerationLabel` for different trust and moderation mechanisms. This makes it easy for future code/docs to accidentally treat custom opt-in badges as platform enforcement or native AT labels. | Adopt explicit names such as **Community Trust Label**, **Platform Moderation Decision/Label** and **AT Protocol Label**, and document the boundaries in architecture/help material. |

## Executive assessment

SwapPulse currently has three materially different label systems:

1. **CommunityLabeler / CommunityLabel**: custom SwapPulse records intended as opt-in collector trust signals.
2. **`Post.moderation_labels` / `moderation_status`**: the fields the current moderation queue and post enforcement logic actually use.
3. **ModerationLabel**: a separate AT-label-shaped entity with a large legacy corpus, but not the primary label source used by normal Post rendering.

Those systems do not share one authoritative issuer model, revocation/expiry lifecycle, appeal path, notification path or federation contract. The most serious issue is that the community-labeler trust decision itself is not privileged: a labeler owner can self-approve, can rewrite trust-sensitive policy after approval, and remote repositories can import self-asserted approval or impersonate a subscribed labeler through custom records.

The native AT Protocol label architecture is also not implemented. Current AT documentation describes labels as self-authenticating objects signed by a labeler DID and normally distributed through a labeler service using `com.atproto.label.queryLabels` and/or `com.atproto.label.subscribeLabels`. A labeler DID advertises a `#atproto_label` signing key and `#atproto_labeler` service endpoint. SwapPulse's custom `org.swappulse.communityLabel` records can still be a valid application feature, but they should not be represented as equivalent to that protocol primitive until the service/signature/distribution model exists.

## Current production-data evidence

The audit used read-only entity queries. No CommunityLabeler, CommunityLabel, LabelerSubscription, ModerationLabel or Post records were created/modified/deleted.

- **0 CommunityLabeler rows** were present in the audit-visible dataset.
- **0 CommunityLabel rows** were present.
- **0 LabelerSubscription rows** were present.
- The absence of live community-label records lowers immediate exposure but also means the end-to-end community-labeler workflow has not been proven in current production data.
- Audit pagination found a `ModerationLabel` record at offset 2,000 and none at offset 2,500, proving **more than 2,000 legacy/current ModerationLabel rows** exist. Recent rows are dominated by historical `off-topic`, `scam` and `spam` labels from August 2026.
- **446 public Posts** still match `moderation_status: escalated`, many with moderation labels recommending `hide`. This is active evidence that label state is not consistently enforced in discovery/feed eligibility.
- `AI Moderation - Posts` and `Toxic Label Handling` are intentionally disabled with `condition: false` as a security hold.

## Feature-by-feature verdict

| Feature | Verdict | Notes |
| --- | --- | --- |
| Community Labelers directory | Partial | Public catalogue/categories work, but loads only 50 and shows non-approved states poorly. |
| Create/run a labeler | Not implemented safely | Help promises it; no safe applicant workflow exists and entity self-approval is P0. |
| Admin approval/revocation | Release blocker | Approval is an owner-editable field; no immutable review workflow. |
| Label policy/category | Release blocker | Owner can rewrite reviewed category/values while remaining approved. |
| Subscribe/unsubscribe | Locally functional but incomplete | Owner-scoped rows work, but no backend uniqueness/target validation; portability attempt conflicts with privacy policy. |
| Subscriber count | Not authoritative | Subscribe/unsubscribe does not maintain it and owners can edit it. |
| Apply community label | Locally functional after approval check | Backend validates owner + allowed value, but the approval boundary is forgeable and subject validation is weak. |
| Remove community label | Improved but incomplete | Remote delete is attempted before local delete, but DID migration can strand ownership and there is no durable retraction/outbox. |
| Label badges | Functional UI foundation | Opt-in backend lookup is good, but viewer cache isolation, provenance and accessibility need work. |
| Community label feed filters | Incomplete trust model | Filter ignores subscriptions/issuer approval and scans only 500 global labels. |
| Per-label hide/warn/ignore | Not implemented | Subscription alone does not implement native-style label policy. |
| Label appeals | Not implemented | No target-owner dispute/correction path. |
| Label notifications | Not implemented | Settings toggle exists but Notification schema/producer do not. |
| Labeler federation | Not trustworthy yet | Remote labeler approval and remote label issuer fields are self-asserted. |
| Native AT label service | Not implemented | No signed labeler service/query/subscription architecture found. |
| Platform moderation labels | High risk | Post owners can mutate moderation state and escalated public content remains feed-eligible. |
| Single moderator dismissal | Partial | Attempts remote negation but failure is best-effort only. |
| Bulk moderator dismissal | Broken network lifecycle | Does not emit remote negations. |
| AI moderation | Intentionally disabled | Security hold is preferable to unsafe autonomous enforcement; must stay disabled until redesigned/tested. |
| Legacy ModerationLabel entity | Needs migration decision | >2,000 rows exist outside the main Post label lifecycle. |
| Account deletion | Incomplete | Community labeler/subscription entities omitted. |
| Data export | Incomplete | Labeler/subscription/issued-label records omitted. |
| Accessibility/localisation | Incomplete | Custom modal, title-only tooltip and English-only UI. |
| Automated tests | Insufficient | No dedicated labeler/moderation regression suite found. |

## Verified strengths to preserve

- Direct browser mutation of **CommunityLabel** is now admin-only; ordinary label issue/removal goes through `apply-community-label`.
- `apply-community-label` verifies authentication, labeler ownership, current `approved` status and that `label_value` is present in the labeler's allowed values before a local label is created.
- Duplicate local issuance from the same `labeler_id + subject_uri + label_value` is detected and returned idempotently.
- Label removal attempts to remove the bridged PDS record before deleting locally, which is safer than silently deleting only the local copy.
- `get-community-labels` scopes normal badge results to subscriptions owned by the authenticated viewer's `created_by_id`; guests/no-subscription users receive no community badges from that endpoint.
- CommunityLabel direct update/delete are admin-only at the entity boundary.
- The normal subscription entity is owner-readable/owner-mutable, so another ordinary user cannot browse someone else's subscription rows through normal RLS.
- `atproto-bridge` is authenticated and restricts `emitLabels` to administrators.
- `atproto-bridge` verifies local record ownership before non-admin PDS update/delete and binds the PDS session DID to the authenticated identity.
- AI moderation and toxic-label automation are currently **disabled rather than allowed to mutate account enforcement without a trustworthy internal-authentication/human-review path**.
- The moderation read queue is restricted to moderators/admins, and resolution/bulk mutation is admin-gated.
- The project already has an explicit label negation concept in `ModerationLabel.neg` and a single-dismiss path that attempts network negation; these are useful foundations for a durable lifecycle.

## Recommended remediation order

### Phase 0 - close the trust boundary

1. Make all CommunityLabeler approval/reviewer/policy/DID/counter fields backend-owned.
2. Introduce immutable applicant/review/policy-revision records and force re-review after trust-sensitive policy changes.
3. Reject remote labeler approval claims and bind every remote author/issuer to the repository DID.
4. Validate every remote CommunityLabel against the authoritative approved issuer and allowed label policy before persistence/display.
5. Lock Post moderation fields to moderator/backend-only mutation.
6. Enforce moderation eligibility centrally and reconcile the 446 currently escalated public Posts.

### Phase 1 - make the community feature coherent

1. Build safe labeler application/review/revoke/retire flows.
2. Move subscription create/delete behind backend endpoints with session-derived DID and uniqueness.
3. Revalidate labeler approval at read time and immediately invalidate revoked issuers.
4. Add subject resolution/type/version checks to label issuance.
5. Add retraction/expiry/supersession plus durable federation outbox/retry.
6. Add target-owner notifications, appeal/report paths and rate/abuse controls.
7. Make subscriber/label counts authoritative.
8. Fix per-user caching and live subscription invalidation.

### Phase 2 - decide AT Protocol interoperability

Choose one explicit architecture:

- **Custom SwapPulse trust records:** keep `org.swappulse.communityLabel*` as application records, describe them accurately, do not claim native AT-label interoperability, and build a SwapPulse trust index with repository-DID provenance; or
- **Native AT labels:** deploy/integrate a real labeler service, sign labels with the labeler DID, publish service/signing-key DID metadata, use standard query/subscription endpoints and consume label definitions/user policies as specified by the protocol.

Do not keep the current hybrid where custom records are described as native labels while network negation is attempted through a PDS-only path.

### Phase 3 - clean up moderation/legacy state

1. Unify single/bulk moderator decisions through one durable label lifecycle.
2. Decide how the >2,000 ModerationLabel rows map into the canonical platform moderation history.
3. Preserve justified moderation audit history while fixing account export/deletion/retention rules.
4. Keep automated AI enforcement disabled until secure invocation, model-quality, human-review and appeal tests pass.
5. Add observability for label issue/retract failures, queue age, federation drift, issuer revocations and feed-enforcement violations.

## Required regression and adversarial tests

Before labelers can be considered release ready, test at minimum:

### Approval and issuer authority

- Owner cannot set `approval_status`, reviewer fields, counters, DID or trust-sensitive policy fields directly.
- Approved owner cannot add a grading/authenticity/safety label value without re-review.
- Remote repository claiming `approvalStatus: approved` remains untrusted locally.
- Remote repository cannot claim another labeler's local ID/DID/name/category.
- Remote label with unapproved value is rejected.
- Remote label from revoked issuer is rejected/suppressed immediately.

### Subscription isolation

- Subscriber DID is derived from session, not request body/client state.
- Duplicate `(user,labeler)` subscribe is idempotent.
- Pending/rejected/revoked/nonexistent labeler cannot be subscribed through a modified client.
- User A's cached labels never appear for User B after account switch.
- Subscribe/unsubscribe updates already-rendered badges without reload.
- Transient label endpoint failure retries and does not permanently cache an empty result.

### Issue/retraction lifecycle

- Subject URI must resolve and match the declared type.
- Unbridged/local target cannot be published as an invalid `at-uri`.
- Version-bound labels behave correctly after the subject is edited.
- Duplicate issuance is idempotent under concurrency.
- Label counts remain correct under concurrent issue/retract.
- DID migration does not strand label removal.
- Single and bulk retraction produce identical durable network/local state.
- PDS/labeler-service outage leaves a visible pending retraction and retries safely.
- Revoking a labeler immediately suppresses its labels and prevents new issuance.

### Moderation enforcement

- Post author cannot edit/clear platform moderation labels/status.
- `escalated`/hide-recommended posts are excluded from every configured public feed according to policy.
- Dismissal/appeal changes state atomically and leaves an audit event.
- Moderation queue pagination reaches records older than 500 Posts.

### User rights and UX

- Label target owner receives the configured community-label notification.
- User can inspect issuer identity/policy/reason and submit an appeal.
- Export contains the user's labeler/subscription/issued-label data.
- Account deletion cleans or retains label records according to the documented legal/retention policy.
- Screen-reader/keyboard/touch users can open label details and operate the application dialog.
- Labeler UI renders correctly in every supported locale.

## AT Protocol references

- Labels specification: https://atproto.com/specs/label
- Labels guide: https://atproto.com/guides/labels
- Add Labels to Your App tutorial: https://atproto.com/guides/labels-tutorial
- Creating a Labeler: https://atproto.com/guides/creating-a-labeler
- Labeler subscriptions: https://atproto.com/guides/subscriptions
- Ozone labeler guidance: https://atproto.com/guides/using-ozone

## Audit limitations

- The project-mandated Base44 web-agent README endpoint was fetched first from the Base44 sandbox and still returned **HTTP 403**, so this audit continued against the connected app source, schemas, backend functions, workflows and audit-visible production entities.
- No destructive proof-of-concept labeler, subscription or forged remote records were created. Structural vulnerabilities were verified from RLS/functions/mappers and current read-only data.
- There were no live CommunityLabeler/CommunityLabel/LabelerSubscription rows to exercise end-to-end safely in production.
- The Base44 command shell currently does not mount the app package checkout, so build/lint/typecheck and executable labeler tests could not be rerun in this interface. This does not assert that the deployed build fails; it means executable release verification remains outstanding.

## Release decision

SwapPulse **Labelers and Labels are NOT RELEASE READY**. The community-label feature should remain non-authoritative until **LB-001 through LB-006** are fixed and regression-tested. The next blockers are remote issuer validation, revocation/read-time enforcement, a real governance workflow, durable retraction, truthful AT Protocol semantics and the current platform moderation-feed gap.

Recommended order: **lock labeler approval/policy -> bind federated issuers to repository DID -> validate remote labels -> lock Post moderation state -> enforce labels in feeds -> build safe subscribe/revoke/appeal lifecycle -> make federation/retractions durable -> decide custom-vs-native AT label architecture -> migrate legacy ModerationLabel history -> run full adversarial/CI release suite.**
