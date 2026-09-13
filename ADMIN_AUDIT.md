# SwapPulse Admin Full Feature Audit

**Audit date:** 13 September 2026  
**Scope:** `/admin` and all reachable or closely-coupled administrator capabilities, including overview/health, external API budgets, platform metrics, data-subject requests, Starknet identity and network administration, V2 verification test controls, PDS provisioning/consolidation/diagnostics/privacy remediation, federation backfills/profile sync, AI knowledge and insight review, scanner correction review, starter-pack curation, Standard.site publication, translation management, service status, maintenance, incidents, SEO audit visibility, Discord administration, invite codes, bot-protection logs, branded email testing, privileged entity permissions, authentication artefacts, destructive actions, accessibility, localisation, pagination and release verification.

**Overall score:** **12/100**  
**Risk:** **Critical / Very High Risk**  
**Release status:** **NOT RELEASE READY**  
**Status:** Source, schema and audit-visible live-data review complete. Exact-release build/lint/typecheck and browser E2E could not be executed because the Base44 command workspace contains no `package.json`. The required Base44 web-agent README endpoint also returned HTTP 403, so this audit does not claim that inaccessible document was read.

## Findings

| Priority | Area | Finding | Required action |
| --- | --- | --- | --- |
| 🔴 P0 | Authentication | **ADM-001: `LoginCode` stores the active passwordless sign-in code in plaintext and permits `role=admin` reads.** `verify-login-code` compares the submitted value directly against `active.code`, so an administrator session able to query the entity can potentially obtain a still-valid first-factor login code. | Store only a keyed/salted digest, exactly as newer security-step-up models do. Remove all client/admin read access. Make LoginCode service-role-only and rotate/delete all existing records during migration. |
| 🔴 P0 | Authentication / secrets | **ADM-002: backend-only user secrets are exposed to the admin data plane.** Field-level User permissions allow admins to read `two_factor_secret`, `login_key`, `pds_app_password` and `signing_key` even though their descriptions identify them as backend-only security material. A compromised admin session therefore has access to credentials capable of weakening 2FA, passwordless login, federation and legacy signing boundaries. | Remove browser/admin read permission from every secret-bearing User field. Move secrets to server-only encrypted storage where possible. Provide only non-secret health/status booleans to Admin. Rotate affected persistent credentials after the boundary is fixed. |
| 🔴 P0 | AT Protocol credentials | **ADM-003: `PdsCredential.app_password` is plaintext and admin-readable despite the entity description explicitly saying all client access should be blocked.** Three legacy `PdsCredential` rows are present in the audit-visible live data, one for each current user. | Immediately remove all client/admin RLS from `PdsCredential`, verify consolidation, revoke/rotate every exposed PDS app password, migrate only encrypted server-held credentials, then delete/retire the legacy rows and entity path. |
| 🔴 P0 | Starknet network trust | **ADM-004: direct admin CRUD on `ChainNetworkConfig` bypasses the hardened verification workflow.** An admin client can update `status`, current contract coordinates and the matching `verified_*` fields directly. `networkConfig().ready` compares stored values to stored verification pins, so forged matching values can manufacture an apparently `CONFIGURED`/ready network without `chain-network-verify`. The current audit-visible network is already `CONFIGURED`, V2. | Make `ChainNetworkConfig` client read-only. All create/update/delete operations must be service-role-only behind `import_manifest`, `save_config` and independent RPC verification. Verification fields must never be client-writable. Add append-only verification receipts and refuse destructive deletion. |
| 🔴 P0 | Starknet identity authority | **ADM-005: direct admin CRUD on `ChainIdentity` contradicts its own “blockchain is authoritative” model.** An admin client can rewrite or delete status, account address, signer key, verification state and transaction metadata without chain reconciliation. | Make `ChainIdentity` client read-only, including for admins. Allow state transitions only through narrowly-scoped backend reconciliation/provisioning functions that prove chain state. Preserve historical records with append-only/tombstone semantics rather than delete. |
| 🔴 P0 | User self-sovereignty | **ADM-006: `chain-identity-admin` action `prepare` lets an administrator bind another user's identity reservation to any administrator-supplied Stark public key.** The target user only needs an eligible AgeStatus; there is no wallet/passkey challenge or target-user signature proving consent/control of that signer. | Move identity reservation to the user's authenticated wallet/passkey flow. Require a signed challenge binding user id, network, chain identity id, signer public key, expiry and nonce. Admins may diagnose or cancel failed reservations, but must not select a user's signer. |
| 🔴 P0 | AT Protocol identity ownership | **ADM-007: `provision-all-identities` can replace a user's existing foreign `did:plc` with a newly-provisioned account on the SwapPulse PDS without the user's explicit approval.** Its documented path 3 provisions a new current-PDS account when the existing DID resolves elsewhere. | Never replace or repoint an existing decentralised identity as an admin batch operation. Use standards-compliant account migration/DID continuity with explicit user approval, or leave externally-hosted identities externally hosted. Make provisioning opt-in per user. |
| 🔴 P0 | Federation backfill | **ADM-008: `backfill-follows` reads every user's local Follow records with service-role access but calls `atproto-bridge` as the administrator.** The bridge creates the record in `session.did`, so an admin/shared repository can receive another collector's follow and its URI/CID is then written back onto that collector's local Follow record. This breaks repository provenance. | Rebuild the backfill around the Follow owner's authenticated PDS session/DID. Verify `created_by_id`/owner DID before every write, prove returned `at://` authority matches that owner, and quarantine mismatches instead of stamping them bridged. |
| 🔴 P0 | Privacy / compliance | **ADM-009: the Data Subject Requests UI can mark legal requests “completed” without executing the requested right.** It only changes entity status/notes. Access, rectification, erasure, objection, restriction, consent withdrawal and portability are not proven before completion. Bulk “Delete” is especially misleading because it actually marks requests `rejected`. | Replace direct status mutation with typed server-side fulfilment workflows. Each right needs evidence of execution, exceptions/limitations, identity verification where necessary, immutable timestamps and delivery proof. Only the backend should transition a request to completed. Rename/remove the misleading bulk Delete control. |
| 🟠 P1 | App-password verification | **ADM-010: `AppPasswordCode` also stores its 6-digit verification code in plaintext and permits admin reads.** The current flow uses it to authorise deletion of legacy app passwords. | Hash codes at creation, compare digests, and remove all admin/client reads. Reuse the newer `SecurityActionCode`/`SecurityStepUpCode` pattern. |
| 🟠 P1 | Privilege model | **ADM-011: almost all privileged capabilities collapse into one coarse `admin` role.** Chain control, identity/PDS custody, privacy rights, Discord structure, AI knowledge, scanner training, status incidents, invite codes and translations are reachable under the same role. | Introduce least-privilege scopes/roles such as security admin, chain operator, privacy officer, federation operator, community admin and operations/status admin. Default admins to the minimum required scopes. |
| 🟠 P1 | Step-up authentication | **ADM-012: no recent-authentication or WebAuthn/passkey step-up was found on the audited high-impact Admin actions.** Existing step-up models exist elsewhere, but the Admin surface does not use them before chain configuration, identity provisioning, PDS remediation, Discord bootstrap, incident deletion or similar actions. | Require a fresh phishing-resistant step-up for high-risk actions and expire authorisation rapidly. Bind the step-up token to the exact action, target and nonce. |
| 🟠 P1 | Dual control | **ADM-013: irreversible/global operations lack two-person approval.** The permanent V2 switch has a strong typed confirmation and chain preflight, but one admin can still initiate the irreversible global change. PDS/privacy operations and trust-configuration changes have a similar single-operator risk. | Add maker-checker approval for irreversible trust changes and bulk identity/privacy operations. Require two distinct scoped admins and record both approvals immutably. |
| 🟠 P1 | Privileged auditability | **ADM-014: no central append-only Admin audit ledger exists.** There are specialised logs such as moderation and Discord role-sync audit records, but no single immutable trail covering chain config, identity provisioning, PDS operations, privacy requests, status changes, AI publishing, translation publishing and role changes. | Add an append-only `AdminSecurityAudit` written only by backend functions with actor, step-up method, action, target, reason, before/after hash, correlation id, result and timestamp. Disallow client update/delete. |
| 🟠 P1 | Role/security mutation | **ADM-015: sensitive User fields can be changed through generic admin field permissions instead of a controlled privileged workflow.** `role`, 2FA/WebAuthn flags, moderation restriction fields, DID/PDS fields and other backend-managed fields expose admin mutation paths without action-specific validation or audit. | Remove generic admin mutation from security/identity fields. Provide narrow backend commands with validation, step-up, reason capture and immutable audit events. |
| 🟠 P1 | Admin lifecycle | **ADM-016: there is no safe first-class Admin user/role lifecycle surface even though raw `User.role` mutation is permitted.** The current audit-visible roster has three users and two admins, so privileged membership is a material control rather than a theoretical future concern. | Create a dedicated privileged-access management flow with role/scopes, invitations, expiry, step-up, second-admin approval, revocation, last-admin protection and audit history. |
| 🟠 P1 | Credential retirement | **ADM-017: `consolidate-identity` encrypts/copies legacy PDS credentials onto User records but deliberately leaves the original `PdsCredential` rows in place.** The three live legacy rows therefore remain exposed after consolidation. | After successful encryption and verification, revoke old app passwords, delete the plaintext legacy rows and record a non-secret migration receipt. Make cleanup part of the migration's success criteria. |
| 🟠 P1 | Federation privilege | **ADM-018: `atproto-bridge` gives admins a blanket ownership bypass for update/delete.** This makes an ordinary admin session a broadly-authorised repository mutation principal rather than a narrowly-scoped moderation tool. | Replace blanket admin bypass with action-specific service capabilities, repository-owner sessions and audited moderation workflows. Network moderation should label/hide where possible rather than silently mutate a user's repository. |
| 🟠 P1 | Federation backfill reliability | **ADM-019: `backfill-follows` only fetches the newest 100 Follow records and merely skips already-bridged rows.** Re-running can repeatedly revisit the same newest 100 and starve older unbridged follows forever. | Query specifically for unbridged rows or persist a cursor/keyset checkpoint. Prove monotonic progress and expose remaining/failed counts. |
| 🟠 P1 | PDS provisioning scale | **ADM-020: `provision-all-identities` scans at most 500 users.** Accounts beyond the first 500 are never considered, and no continuation cursor is persisted. | Use keyset pagination over the complete roster and persist resumable progress. Keep per-run work bounded but guarantee eventual coverage. |
| 🟠 P1 | Profile federation scale | **ADM-021: the admin profile-sync backfill stops after 200 users per run but starts from the newest users again on every invocation.** Without a persistent cursor, migrated users older than the first 200 can be permanently starved. | Persist a backfill cursor or select only profiles due/pending for sync. Add total remaining and last-completed checkpoint metrics. |
| 🟠 P1 | Discord synchronisation | **ADM-022: `discord-sync-all` only reads 500 account links with no pagination.** Larger communities can leave older Discord links permanently unsynchronised. | Paginate/keyset through all enabled links or persist a scheduled cursor. Report remaining work and stale-role age. |
| 🟠 P1 | Compliance audit trail | **ADM-023: users can delete their own `DataSubjectRequest` records under entity RLS.** That can erase the platform's evidence that a request was received and how it was handled. | Prevent deletion of submitted requests. Allow withdrawal through a new immutable status/event while retaining the compliance record under the applicable retention policy. |
| 🟠 P1 | Compliance queue | **ADM-024: the Admin request queue loads only the latest 100 DataSubjectRequest rows with no pagination.** An older unresolved request can disappear from the operator's working view after enough newer requests arrive. | Add server-side pagination and explicit filters for all open/overdue requests. Never cap the compliance work queue silently. |
| 🟠 P1 | Compliance accountability | **ADM-025: the Admin UI does not populate `resolved_by` when completing/rejecting a request even though the schema provides the field.** | Make all resolution transitions backend-owned and stamp the authenticated operator id, decision basis, evidence reference and timestamp. |
| 🟠 P1 | Chain verification freshness | **ADM-026: `ChainNetworkConfig.ready` does not require verification freshness.** The visible CONFIGURED V2 network was last verified on 1 September 2026, while this audit is 13 September. Owner/verifier/policy state can change on-chain, yet stored pins remain “ready” until a manual re-verification occurs. | Add freshness/SLA requirements and scheduled independent verification of owner, verifier, V2 mode, class hashes and RPC chain id. Fail closed for sensitive operations when verification is stale or unreachable. |
| 🟠 P1 | Privacy remediation completeness | **ADM-027: PDS privacy remediation caps each source scan at 5,000 rows and can still execute a batch while `capped=true`.** This can remove a subset while leaving additional ineligible public copies undiscovered. | Require complete cursor-based enumeration for a remediation campaign. Treat any capped scan as incomplete and prevent “all clear”/completion claims until every page has been processed. |
| 🟠 P1 | Status incident integrity | **ADM-028: returning one service to operational can auto-resolve every open incident that names that service, including a multi-service incident that may still affect other services.** | Resolve an incident only when all affected services satisfy the incident's recovery conditions, or require explicit incident resolution. Never infer global resolution from one service. |
| 🟠 P1 | Status notifications | **ADM-029: `manage-service` creates status updates and auto-creates/auto-resolves incidents without calling the subscriber notification path used by `manage-incident`.** | Route every public status transition through one backend status service that writes the event and notifies confirmed subscribers consistently and idempotently. |
| 🟠 P1 | Admin privacy | **ADM-030: public status/incident records can use the administrator's email as `authored_by` when no full name is present.** | Publish a controlled staff display name or role label. Keep administrator email addresses private. |
| 🟠 P1 | Incident history | **ADM-031: an admin can permanently delete an incident.** The delete path leaves no tombstone, reason or subscriber notice, damaging the operational history and accountability record. | Replace hard delete with immutable archive/retraction status. Capture reason and actor, preserve updates, and notify subscribers when a public incident is corrected/retracted where appropriate. |
| 🟠 P1 | Incident service model | **ADM-032: incident creation hardcodes only five service names while `StatusService` is a live entity and its schema describes 14 seeded services.** Admins cannot accurately associate incidents with the full monitored estate. | Populate incident affected-service choices from `StatusService` ids/slugs and validate them server-side. |
| 🟠 P1 | AI knowledge safety | **ADM-033: `AgentKnowledgeDocument` itself grants admins direct create/update/delete access.** That bypasses the otherwise strong `refresh-agent-knowledge` + hash/safety + `review-agent-knowledge` publication pipeline and allows unreviewed text to become an approved agent source. | Make published agent knowledge service-role-only for mutation. Admins should review quarantined revisions, while the review backend alone publishes an immutable approved revision. |
| 🟠 P1 | AI learning safety | **ADM-034: `AgentInsight` direct admin update can set `review_status=approved`, `safety_status=passed` and `active=true` without `review-agent-insight`.** | Remove direct client mutation. Make the review function the sole transition path and keep immutable review receipts. |
| 🟠 P1 | AI review state | **ADM-035: `review-agent-insight` does not require `review_status === pending_review`.** An already approved/rejected insight can be reviewed again and reactivated. | Enforce a strict state machine. Final decisions should be immutable; replacement requires a new revision linked to the previous one. |
| 🟠 P1 | Scanner learning | **ADM-036: scanner corrections are approved/rejected through direct entity updates from the browser.** This bypasses an action-specific backend and gives no immutable evidence protecting future model/training inputs. | Add a backend review command with reviewer, source snapshot, decision, reason and immutable event. Training/export must consume only review receipts, not client-writable flags. |
| 🟠 P1 | Translation publishing | **ADM-037: AI-generated translations are written directly into public `TranslationOverride.value` and become runtime UI copy without a human approval state.** | Introduce pending/approved/rejected translation revisions, safety checks and preview. Publish only reviewed values, with rollback to a prior approved revision. |
| 🟠 P1 | Standard.site trust | **ADM-038: `StandardSiteConfig` is directly admin-writable even though `publish-standard-publication` is the intended verified publication path.** A raw admin update can spoof the URI later returned by the well-known site association. | Make StandardSiteConfig service-role-only for mutation. Derive it solely from successful PDS publication and verify the DID/domain relationship before storing. |
| 🟠 P1 | Starter-pack atomicity | **ADM-039: setting a site-wide Starter Pack clears every current site-wide flag before validating/updating the requested new pack.** An invalid or failed target update can leave the site with no designated pack. | Validate the target first and perform a transactional/compare-and-swap change, or update the new pack before safely clearing the old one with rollback. |
| 🟠 P1 | Starter-pack trust | **ADM-040: any existing user-authored StarterPack can be made site-wide without a server-side eligibility/moderation/visibility/federation check.** | Add a curation policy and backend validation for ownership state, moderation status, member validity, visibility, content safety and federation health before site-wide promotion. |
| 🟡 P2 | Compliance deadline UX | **ADM-041: the Admin UI frames the response target as “30 days”, while current ICO guidance for UK GDPR subject access says without undue delay and at the latest within one month, with defined circumstances for pausing/extending.** | Store jurisdiction/request metadata and calculate the applicable deadline rather than hard-coding 30 days. Surface extension/clarification state and deadline history. |
| 🟡 P2 | Login UX | **ADM-042: `send-login-code` creates a code valid for 5 minutes but the email text says 15 minutes, and the LoginCode schema description also says 15 minutes.** | Use one shared expiry constant and render the actual expiry in email/UI/schema documentation. |
| 🟡 P2 | Operations overview | **ADM-043: “System Health” covers only TCGDex, PokéWallet and database while Admin controls many other critical dependencies.** PDS/federation, Starknet RPC/relay, Discord, email, push, TCGPlayer/Impact, price tracker, firehose and scheduled jobs are absent from the primary health view. | Build a complete dependency/service-health model with freshness, last success, degraded state and links to diagnostics. |
| 🟡 P2 | Health quality | **ADM-044: health is presented primarily as a binary current snapshot with no latency/SLO/history or stale-data indicator.** | Add rolling availability, latency, last-known-good timestamp, error budget and explicit unknown/stale states. |
| 🟡 P2 | External API budgets | **ADM-045: live provider tests can consume external API credits/calls from the Admin UI without a clear per-test cost confirmation.** | Display expected credit/call cost and require confirmation for billable or scarce tests. Rate-limit test actions and log their budget impact. |
| 🟡 P2 | Bot review | **ADM-046: Bot Protection Log displays only 50 attempts with no pagination.** Older high-risk events can fall out of the operator view. | Add paginated/time-filtered security-event search and retain aggregate risk metrics. |
| 🟡 P2 | Invite management | **ADM-047: Invite Codes shows only the latest 50 and lacks a first-class search/disable/revoke workflow for older active codes.** | Add pagination, status/batch filters, search and audited bulk disable/revoke. |
| 🟡 P2 | Review queues | **ADM-048: Agent Knowledge, Agent Insight and Scanner Correction review surfaces each use finite queue caps (typically 100) without pagination.** | Add server-side pagination and oldest-pending/SLA views so safety work cannot starve behind newer items. |
| 🟡 P2 | Starter-pack selection | **ADM-049: site-wide Starter Pack selection lists only 50 packs.** Older eligible packs cannot be selected through Admin. | Add search and pagination, preferably backed by a curated eligibility query. |
| 🟡 P2 | Incident/maintenance history | **ADM-050: Incidents and Maintenance lists are capped at 50 with no pagination/archive search.** Older unresolved or historically relevant records can be hard to discover. | Add open-first filters, pagination and archive/history search. |
| 🟡 P2 | Translation scale | **ADM-051: Translation management assumes at most 5,000 TranslationOverride records in seed/audit reads.** Beyond that, existing records can be missed and coverage/duplicate avoidance becomes unreliable. | Paginate the complete key/language index or enforce a unique compound key and query per language/key set. |
| 🟡 P2 | PDS cut-over UX | **ADM-052: `PdsCutoverSection.jsx` exists but is not imported/rendered by the current Admin page.** The code represents powerful provisioning/re-bridge/cut-over operations but is effectively orphaned from the current operator workflow. | Either remove the dead surface and obsolete backend paths, or redesign it into an explicit migration runbook with user-consent safeguards, staged preview and auditable checkpoints. |
| 🟡 P2 | Localisation | **ADM-053: most Admin child surfaces use hard-coded English strings despite SwapPulse's translation system and nine supported interface locales.** | Move all operator UI copy into the i18n catalogue and include Admin in translation coverage tests. |
| 🟡 P2 | Accessibility | **ADM-054: the five Admin tab buttons are visually selected but do not implement a complete tabs accessibility pattern (`role=tablist/tab`, `aria-selected`, associated tabpanels and keyboard arrow navigation).** | Implement semantic tabs or use a tested accessible tabs component. |
| 🟡 P2 | Destructive-action UX | **ADM-055: confirmation strength is inconsistent.** The permanent V2 transition and PDS privacy remediation use exact phrases, while other destructive actions use a simple browser `confirm()` or no equivalent step-up. | Define risk tiers and a common privileged-confirmation component with target summary, impact, reason, step-up and typed confirmation where warranted. |
| 🟡 P2 | Error handling | **ADM-056: several Admin sections catch load failures and render empty arrays, making an outage look like “no records”.** Examples include service/maintenance/starter-pack and other list surfaces. | Preserve error state separately from empty state, show retry/details safely, and log a correlation id. |
| 🟡 P2 | Search indexing | **ADM-057: `/admin` uses normal SEO title/description/canonical metadata and no explicit `noindex` directive was observed in the audited page.** | Add `noindex,nofollow` for authenticated administration/security pages and verify robots/header behaviour in the deployed app. |
| 🟢 P3 | Information architecture | **ADM-058: high-risk operations are grouped mainly by broad product labels rather than risk/ownership.** “Identity & PDS” mixes chain trust and federation custody; “Platform” mixes AI learning, scanner training, publishing and translations. | Add clear risk badges and ownership labels, and separate security-critical operator tasks from routine content/operations tooling. |

## Release-blocking summary

SwapPulse Admin is broad and feature-rich, but its privileged security boundary is not safe enough for release. The most urgent issue is not whether the Admin buttons themselves check `role === 'admin'`; most do. The problem is that multiple underlying entity schemas expose secrets or permit direct writes that bypass the safer backend workflows.

The nine release blockers are:

1. Plaintext passwordless login codes are admin-readable.
2. Backend-only User secrets such as TOTP, login, PDS and signing material are admin-readable.
3. Legacy plaintext PDS app passwords are admin-readable and three live legacy rows remain.
4. ChainNetworkConfig can be directly rewritten to manufacture stored verification readiness.
5. ChainIdentity can be directly rewritten/deleted despite the blockchain-authoritative design.
6. An admin can reserve another user's chain identity to an admin-chosen signer without user proof.
7. Bulk PDS provisioning can replace an externally-hosted DID with a new SwapPulse-PDS identity without explicit user consent.
8. Follow federation backfill can publish another user's graph record under the wrong repository.
9. Data-subject requests can be recorded as completed/rejected without evidence that the legal right was actually fulfilled.

These blockers affect authentication, decentralised identity, chain trust, privacy/compliance and federation provenance. They should be fixed before expanding Admin capability further.

## Current audit-visible state

The audit queried only fields needed to establish scope and intentionally avoided retrieving secret values.

- Users visible to the audit: **3**.
- Users with role `admin`: **2**.
- Legacy `PdsCredential` rows: **3**.
- `ChainNetworkConfig` rows: **1**, status **CONFIGURED**, identity mode **V2**.
- That visible network's `last_verified_at`: **1 September 2026 22:38:13 UTC**.
- `ChainIdentity` rows: **1**, status **REGISTERED**, verification status **ACTIVE**.
- DataSubjectRequest rows currently visible: **0**.

The absence of a current DSAR backlog reduces immediate operational load, but it does not reduce the severity of the broken fulfilment/state-transition design.

## What is already strong

Several Admin/backend paths demonstrate the right security direction and should be preserved while tightening the overall boundary:

- Most privileged backend functions independently authenticate the caller and check `role === 'admin'` instead of trusting only the page gate.
- The permanent V2 policy switch uses an exact confirmation phrase and extensive chain preflight: verified V2 mode, active assurance, spent replay id, identity binding, staking proof and post-write verification.
- Chain deployment manifest import rejects secret-like fields, validates felt/address formats, separates registry owner from verifier, and imports as unconfigured until independently verified.
- Provisioning-result import validates chain id, identity id, signer key, account class, registry owner, recovery policy and deterministic account-address derivation before recording DEPLOYED.
- Discord bootstrap keeps bot/OAuth/CAPTCHA secrets in environment variables, previews before apply, uses an exact confirmation phrase, checks application/guild configuration and deliberately avoids granting Discord's Administrator permission to the managed role.
- PDS privacy remediation has a dry-run mode, explicit confirmation phrase, bounded batches and attempts to authenticate to the record owner's repository rather than deleting everything through one shared identity.
- Federation diagnostics does not return passwords, access tokens or raw PDS response bodies.
- Agent knowledge refresh uses an allowlisted project-source set, pins GitHub content to a commit, hashes content and quarantines changed revisions for human review.
- Agent knowledge review verifies the hash again and refuses safety-flagged or oversized material.
- AT Protocol image upload uses an HTTPS hostname allowlist and rejects redirects, substantially reducing SSRF risk.
- The branded email test sends only to the logged-in administrator's own address.
- Impact affiliate testing is server-side and admin-only.
- Privacy audit returns counts instead of raw sensitive collection values.
- `ChainIdentity` contains no private keys, seed phrases, DOB, email address or document evidence.

The secure implementation patterns already exist. The priority is to make them the only possible mutation paths.

## Recommended target Admin architecture

### 1. Make the browser an untrusted operator console

Admin pages should never receive authentication secrets, PDS app passwords, TOTP seeds, login bridge keys or privileged signing material. The browser submits intent; a backend capability validates actor, scope, step-up, target, state and policy, then performs the mutation.

### 2. Split privileged roles

Suggested scoped roles/capabilities:

- **Security admin:** privileged account/security operations, no content publishing or chain signing.
- **Privacy officer:** DSAR workflow and privacy remediation, no user authentication secrets.
- **Chain operator:** public chain manifest/verification and diagnostics, no user signer selection.
- **Federation operator:** diagnostics/migration tooling, with no raw credentials and explicit user-consent boundaries.
- **Community admin:** invites, starter packs, Discord community settings.
- **Operations admin:** incidents, service status and maintenance.
- **AI curator:** quarantined knowledge/insight/scanner review only.

Use temporary elevation for rare operations rather than permanent super-admin capability.

### 3. Create one privileged-action gateway

Every sensitive admin mutation should require:

- authenticated scoped operator;
- recent WebAuthn/passkey step-up;
- action-specific authorisation;
- exact target and state validation;
- idempotency key / replay protection;
- reason/ticket reference;
- immutable audit event;
- optional second-admin approval based on risk;
- deterministic result and correlation id.

### 4. Enforce blockchain authority technically

`ChainNetworkConfig` and `ChainIdentity` should be client read-only. Verification pins and chain-derived state must only be written by backend code after public RPC verification. Add verification freshness and continuous drift monitoring.

A user's account/signer association must start with that user's signature. Admins may not choose a user's signer key.

### 5. Restore AT Protocol self-sovereignty

Do not use bulk administration to replace users' external DIDs. Support external PDS accounts as first-class identities or perform real user-approved migration while preserving DID continuity. Every outbound record must be written to and verified against the owner's repository.

### 6. Turn DSAR into an evidence-bearing workflow

Use explicit states such as:

`received -> identity_check_if_needed -> scoped -> in_progress -> response_ready -> securely_delivered -> completed`

with separate `withdrawn`, `partially_refused`, `refused` and `extended` paths. Store immutable events rather than allowing request deletion. Tie completion to export/erasure/rectification/restriction/objection/consent/portability execution evidence as applicable.

### 7. Make all safety-review records revisioned

Agent knowledge, insights, scanner corrections and translations should move through quarantined revisions. No browser should be able to create an “approved” published record directly. Approval should create an immutable receipt and a backend-controlled active revision.

### 8. Make Admin queues resumable and complete

Replace fixed 50/100/200/500/5,000 list caps with cursor pagination and oldest-pending/SLA views. Batch jobs should persist progress and guarantee eventual coverage instead of restarting at the newest row.

### 9. Build a real operations cockpit

Include health/freshness for Base44 database, PDS, AppView/PLC, federation firehose, Starknet RPC, transaction relay, Discord, SMTP, push, TCGDex, PokéWallet, TCGPlayer, Impact, price tracker and scheduled workflows. Show last success, latency, SLO/error budget, backlog and stale state.

## Required security and regression tests

### Authentication and secret isolation

- Admin browser/API cannot read `LoginCode.code`.
- Admin browser/API cannot read `two_factor_secret`, `login_key`, `pds_app_password`, `signing_key` or plaintext PDS credentials.
- Login and action codes are stored only as non-reversible digests.
- A compromised ordinary admin token cannot obtain another user's login capability.
- Secret migration rotates/revokes all historical credentials and leaves no legacy plaintext rows.

### Privileged access

- Each scoped admin role is denied unrelated functions/entities.
- Sensitive actions fail without fresh WebAuthn/passkey step-up.
- Step-up tokens are target/action/nonce bound and single use.
- Irreversible operations require two distinct approved operators.
- Removing/demoting the final break-glass admin is prevented.
- Role changes are fully audited and cannot occur through generic entity mutation.

### Chain administration

- Direct client create/update/delete of ChainNetworkConfig and ChainIdentity is denied, including for admins.
- Only independent RPC verification can write `verified_*` fields or activate CONFIGURED.
- Stale verification fails closed for value-bearing/high-risk operations.
- Owner/verifier/mode/class-hash drift is detected.
- User identity preparation fails without a valid user signature for the signer key.
- Admin cannot bind a target user to an admin-controlled signer.
- Reconciliation alone moves chain-authoritative states such as REGISTERED/RECOVERED.
- Chain history cannot be hard-deleted.
- Permanent V2 switch remains idempotent and requires the existing strong preflight plus dual approval.

### Federation / PDS

- Every backfilled record's `at://` DID equals the local record owner's DID.
- An admin cannot publish a user's record through the admin/shared repo unless the record is explicitly a SwapPulse-owned shared-service record.
- External-PDS users are never silently re-provisioned onto SwapPulse PDS.
- User-approved migration preserves DID continuity and is replay-safe.
- Follow backfill progresses beyond 100 rows and survives failures/restarts.
- Profile backfill progresses beyond 200 users.
- Provisioning progresses beyond 500 users.
- PDS privacy remediation processes more than 5,000 candidate records without a false “complete”.
- Admin bridge mutation cannot silently delete/update another user's repository content outside a documented moderation capability.

### Compliance

- A submitted DataSubjectRequest cannot be deleted by the requester or administrator.
- Every request remains visible regardless of queue size.
- `resolved_by`/timestamps/evidence are server-generated.
- Access completion requires a generated and securely-delivered export where applicable.
- Erasure completion requires deletion/anonymisation evidence and documented exceptions.
- Rectification/restriction/objection/consent withdrawal/portability each have type-specific execution paths.
- Deadline calculation uses applicable legal timing rather than a fixed 30-day integer.
- Extensions/clarifications/identity checks update the legal deadline correctly and are recorded.

### AI/scanner/translation safety

- Direct browser writes cannot create approved AgentKnowledgeDocument/AgentInsight states.
- Already-reviewed insight decisions cannot be silently reopened.
- Prompt-injection test cases remain quarantined.
- Scanner labels do not enter training until a backend review receipt exists.
- AI translations require human approval and support rollback.
- Review queues remain complete above 100 records.

### Operations / Discord / status

- Discord sync covers more than 500 links with resumable pagination.
- Service recovery does not resolve a multi-service incident while another affected service is down.
- Manual service changes notify confirmed subscribers exactly once.
- Incident retraction preserves an immutable history.
- All monitored StatusService records can be selected when creating an incident.
- Admin email addresses never leak into public status authorship.
- External provider tests are rate-limited and budget-attributed.

### Accessibility / localisation / UX

- Admin tabs meet the WAI-ARIA tabs keyboard pattern.
- All Admin controls are available in all supported interface locales.
- Destructive confirmations expose the exact target and consequence to screen readers.
- Load failure is visually/semantically distinct from an empty queue.
- `/admin` and related privileged pages are verified `noindex,nofollow` in the deployed app.

## Verification limitations

1. The required Base44 web-agent README at `https://app.base44.com/api/sandbox/6a63d9d64a4d65d370c70892/web-agent/readme.md` returned **HTTP 403**, so it could not be read in this audit.
2. The Base44 command workspace reported `/workspace`, but no `package.json` was present. Exact-release `npm run build`, `npm run lint` and `npm run typecheck` therefore could not be executed from that workspace.
3. This audit did not claim full browser E2E coverage of every Admin control or external scheduled workflow.
4. Audit-visible entity queries were used only for non-secret fields. No PDS app passwords, login codes, TOTP secrets, login keys or other secret values were retrieved.

## External reference checks

- UK Information Commissioner's Office, current subject access guidance: `https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/subject-access-requests/a-guide-to-subject-access/`. Current guidance states that SARs must be handled without undue delay and generally within one month, with defined extension/clarification provisions.
- AT Protocol Repository specification: `https://atproto.com/specs/repository`. Each account has its own repository and the authoritative repository location is the account's PDS declared in its DID document.
- AT URI specification: `https://atproto.com/specs/at-uri-scheme`. The authority identifies the repository by DID/handle, which is why writing one collector's follow under another repository is a provenance failure.

## Final verdict

**SwapPulse Admin is not release ready.** The feature set itself is substantial and several backend functions show strong security engineering, especially the V2 chain preflight, manifest validation, Discord bootstrap checks, PDS privacy dry run and agent-knowledge quarantine/review pipeline. However, those protections are undermined by privileged entity permissions that expose authentication/federation secrets or allow direct writes around the safer workflows.

The first remediation phase should be a **privileged-boundary lockdown**, not more Admin features:

1. remove admin/browser reads of all secrets and plaintext codes;
2. rotate the three live PDS app passwords and retire legacy PdsCredential rows;
3. make ChainNetworkConfig and ChainIdentity client read-only;
4. require user signatures for chain identity signer binding;
5. disable unsafe bulk DID replacement and repair follow backfill ownership;
6. replace direct DSAR status editing with evidence-bearing fulfilment workflows;
7. introduce scoped roles, passkey step-up, dual control and a central immutable admin audit ledger;
8. then address pagination, operations health, accessibility/localisation and queue UX.

Only after those controls are in place should the exact release build, E2E, adversarial admin-permission tests, federation round-trip tests and live chain verification be treated as final release evidence.
