# SwapPulse Discord Bot Full Feature Audit

**Audit date:** 13 September 2026  
**Scope:** Discord bot source implemented so far: signed HTTP interactions; /verify, /roles and /support commands; OAuth account linking and guild join; CAPTCHA fallback; role evaluation/synchronisation; guild/application bootstrap; member Settings UI; admin bot UI; Discord verification page; Base44 entities/RLS; scheduled reconciliation; enforcement/deletion/privacy interactions; secrets boundary; rate limits; localisation; accessibility; testing and deployment readiness.  
**Status:** Source/schema/data audit complete with residual actions; bot is not bootstrapped in the audit-visible Base44 environment; exact-release build/lint/typecheck and live Discord Developer Portal/test-guild verification unavailable  
**Overall score:** 38/100  
**Risk if activated now:** Critical / High Risk  
**Activation status:** **DO NOT BOOTSTRAP / ENABLE YET**  
**Findings:** 49 total - 6 P0, 17 P1, 21 P2, 5 P3

> This audit deliberately does **not** penalise the bot merely because planned features are unfinished. Findings cover implemented behaviour, security/trust boundaries, integration correctness and the minimum evidence required before activation.

## Findings

| Priority | Area | Finding | Required action |
| --- | --- | --- | --- |
| 🔴 P0 | DIS-001 - Orphaned-account role evaluation | `evaluateAccountRoles()` returns `Collector` whenever the linked Base44 user cannot be loaded (`!user`), even when the link was originally a full `swappulse_account` link. A deleted/orphaned site account therefore fails open to a Discord role instead of zero managed roles. | Change missing-user handling to fail closed: only `verification_method === 'captcha'` may receive Collector without a Base44 user. A `swappulse_account` link whose user is missing must be revoked, all managed roles removed, and the orphan logged. |
| 🔴 P0 | DIS-002 - User account deletion | `delete-account` does not revoke/synchronise or delete `DiscordAccountLink` records before deleting the User. Existing Discord Moderator/Administrator/trust roles can remain externally until later reconciliation, and DIS-001 can then re-grant/retain Collector. | Before deleting the User, synchronously revoke every Discord link, remove all bot-managed Discord roles with a high-priority retry/queue, then delete or appropriately retain/anonymise Discord link data according to policy. Fail the destructive flow loudly if privileged Discord revocation cannot be confirmed. |
| 🔴 P0 | DIS-003 - Moderator/admin force deletion | `enforcement` force-delete does not revoke Discord roles or clean `DiscordAccountLink`. A user deleted for cause can retain external Discord privileges, including Moderator/Administrator, until a later sync; after the User disappears, DIS-001 can still leave Collector access. | Make Discord privilege revocation a mandatory phase of force-delete before the User is removed. Privileged role revocation must be confirmed or placed in a durable emergency queue that blocks completion/alerts administrators. |
| 🔴 P0 | DIS-004 - Verified/Trusted Trader role evidence | Discord `Verified Trader` and part of `Trusted Trader` are computed from `TradeListing.status === completed` plus `Reputation` rows. Current schemas allow a listing owner to update its lifecycle to `completed`, while Reputation creators supply the rated DID/rater DID/rating. Those records are not authoritative proof of a completed bilateral trade or legitimate counterparty rating, so a user can manufacture evidence that becomes an external Discord trust badge. | Disable automated Verified Trader/Trusted Trader grants until trade completion and reputation are backend-authoritative, counterparty-bound, duplicate-resistant and tied to an accepted trade agreement. Discord should consume a dedicated server-issued trust projection, not raw client-mutable entities. |
| 🔴 P0 | DIS-005 - Contributor role evidence | Discord `Contributor` accepts `binder_curator`, `community_voice`, `card_reviewer` or any three granted achievements. The achievement engine consumes records whose supporting fields remain owner-created/client-mutable, including Binder engagement/content, CardReview identity/content and event participation inputs. An administrator-issued Achievement row does not make the underlying proof trustworthy if the proof source is forgeable. | Keep Contributor disabled until each qualifying achievement has independently trustworthy proof provenance. Prefer a narrow Discord-role eligibility record produced by the hardened achievement engine with proof version, evaluated_at and revocation state. |
| 🔴 P0 | DIS-006 - Event Organiser role evidence | Discord `Event Organiser` is granted for any Meetup with `status === completed` or for `community_voice`. Meetup owners can update Meetup status and identity fields, while Community Voice depends on event/participant records that are not yet strong attendance proof. This can convert self-authored application state into an external organiser trust role. | Disable Event Organiser automation until completion and attendance are server-authoritative, duplicate-resistant and time-verified. Require a signed/verified event completion projection rather than direct Meetup/achievement reads. |
| 🟠 P1 | DIS-007 - Security-sensitive role revocation latency | Normal suspension, shadow-ban, site staff-role demotion and other eligibility changes do not trigger an immediate Discord reconciliation. The design relies mainly on the 30-minute scheduled sync or a manual/user refresh, leaving a privilege-revocation window for Moderator/Administrator and trust roles. | Trigger high-priority Discord reconciliation from enforcement and staff-role changes. Keep the 30-minute job as a repair sweep, not the primary security revocation mechanism. |
| 🟠 P1 | DIS-008 - Relinking Discord identities | During OAuth relinking, previous Discord links are marked revoked and `syncDiscordLink(...).catch(() => null)` ignores failed role removal. The new identity can continue linking while privileged roles remain on the old Discord account. | Require successful privileged-role revocation on the previous Discord account before granting equivalent roles to the new account, or place the revocation in a durable priority queue and hold privileged grants until it succeeds. |
| 🟠 P1 | DIS-009 - Unlink privilege removal | `discord-unlink` marks the link revoked in Base44 before Discord role removal is confirmed, and can return `pending_removal` while the external roles remain. This is acceptable for ordinary cosmetic roles but unsafe for Moderator/Administrator access. | For privileged roles, perform/confirm removal first or maintain a durable `REVOCATION_PENDING` state with frequent retry, admin alerting and UI that clearly says external access remains active until confirmed. |
| 🟠 P1 | DIS-010 - Account-link uniqueness | `DiscordAccountLink` has no database-level uniqueness invariant for `(discord_user_id, guild_id)` or `(user_id, guild_id)`. `upsertDiscordLink` and collision checks are application-level read-then-write operations and can race under concurrent callbacks. | Add enforced uniqueness or a transactional reservation/claim entity. Make OAuth linking idempotent and test concurrent callbacks for both Discord-user and SwapPulse-user collisions. |
| 🟠 P1 | DIS-011 - Guild configuration trust | Any Base44 admin can directly edit `DiscordGuildConfig.role_ids`, thresholds and `enabled`. `syncDiscordLink` trusts those stored role IDs without re-checking the live role name, permissions, managed flag or hierarchy. A stale/mistyped/malicious config can make the bot manage unintended roles. | Treat role IDs as verified deployment pins. On every activation/config change, fetch the live roles and verify exact expected name, permissions, guild and hierarchy; periodically revalidate before privileged grants. Restrict changes to a step-up protected Discord-admin operation. |
| 🟠 P1 | DIS-012 - Mutable audit trail | `DiscordRoleSyncAudit` is admin-readable but also admin-updatable and admin-deletable, so the audit history for role grants/removals is not append-only. | Make audit records backend-create-only and immutable to ordinary admins. If deletion is legally required, use a separate retention/redaction workflow with its own immutable audit event. |
| 🟠 P1 | DIS-013 - Audit failure is non-blocking | The shared `audit()` helper catches and suppresses audit-write failures. Discord roles can therefore be changed successfully with no durable SwapPulse audit record. | For privileged roles and bootstrap/config changes, fail closed or enqueue a durable audit event before/with the external mutation. At minimum expose an operational alarm and retry queue when audit persistence fails. |
| 🟠 P1 | DIS-014 - Discord REST timeouts | `discordRequest()` retries network/502/503/504 failures but has no AbortController or whole-request timeout. A stalled Discord connection can hold bootstrap, sync, unlink or role operations indefinitely relative to the function runtime. | Add per-attempt and whole-operation deadlines, abort timed-out fetches, return typed retryable errors and test hanging upstream behaviour. |
| 🟠 P1 | DIS-015 - OAuth upstream timeouts | `discord-link-callback` calls Discord's token and `/users/@me` endpoints with no timeout. A stalled OAuth request can leave the callback function hanging and the user in an ambiguous state. | Add strict timeouts and typed OAuth errors. Do not consume the local challenge until the external identity step has completed safely. |
| 🟠 P1 | DIS-016 - Discord rate-limit coordination | The REST helper correctly honours `Retry-After` after a 429, but it ignores Discord's route bucket headers and does not coordinate request budgets before hitting limits. Large reconciliation runs can repeatedly discover rate limits by failure. | Implement bucket-aware coordination using `X-RateLimit-Bucket`, remaining and reset headers, plus a global concurrency/rate budget. Discord currently recommends using bucket identifiers and Retry-After information. |
| 🟠 P1 | DIS-017 - Scheduled reconciliation scale | `discord-sync-all` processes at most 500 links in one sequential run with no explicit cursor, backlog metric or work queue. Each link performs a member read and potentially multiple role writes. At scale, runs can exceed the 30-minute cadence/function budget or become dominated by Discord rate limits. | Use cursor/batch jobs with bounded concurrency, explicit backlog age, resume tokens and prioritised revocations. Keep per-run work below a measured runtime budget. |
| 🟠 P1 | DIS-018 - Partial role mutation | `syncDiscordLink` performs role additions/removals sequentially. If a later Discord call fails, earlier external mutations remain, but the link is not updated to the actual partial state and the failure audit does not record which calls already succeeded. | Use an operation plan with per-role outcomes, record partial success durably, prioritise removals before additions where security requires it, then reconcile/read back actual managed roles. |
| 🟠 P1 | DIS-019 - Bootstrap atomicity | Bootstrap patches application metadata/interactions endpoint before completing all guild permission, role/channel conflict and hierarchy checks. A later failure can leave the Developer Portal partly changed with no rollback or durable setup transaction. | Split bootstrap into read-only preflight and apply phases. Preflight every application/guild/role/channel/hierarchy condition first; then apply an idempotent plan with step records and compensating/repair logic. |
| 🟠 P1 | DIS-020 - Bootstrap authentication strength | The destructive Discord bootstrap is protected by Base44 admin role plus a typed confirmation string, but not a fresh MFA/security step-up. A stolen/stale admin session can change an external community server. | Require fresh step-up authentication for bootstrap, enable/disable, role-pin changes and other external privileged Discord operations. |
| 🟠 P1 | DIS-021 - Bot-role hierarchy validation | Bootstrap verifies effective permissions but does not explicitly verify that the bot's highest integration role is above every existing/reused SwapPulse-managed role before setting `enabled: true`. Exact-name existing roles can pass configuration checks but still be unmanageable due to hierarchy. | Preflight and store role positions; refuse activation unless the bot can manage every pinned role. Recheck hierarchy during health checks and before privileged role grants. |
| 🟠 P1 | DIS-022 - Dedicated test coverage | No Discord-specific unit/integration/security tests were found. The highest-risk paths - signature verification, OAuth state, concurrent linking, deletion/enforcement revocation, role evidence, rate limits, partial Discord failures and bootstrap conflicts - currently lack a dedicated regression suite. | Add deterministic unit tests plus mocked Discord API integration tests and browser/OAuth E2E tests. Make deletion/enforcement privilege revocation and role-evidence integrity release blockers. |
| 🟠 P1 | DIS-023 - Suspension expiry consistency | Discord role evaluation treats any `AccountStatus.status !== active` as ineligible and does not consider `suspended_until`. Elsewhere expiry is displayed/calculated without automatically changing the persisted status, so an elapsed suspension can continue stripping Discord roles until a separate lift operation occurs. | Centralise effective enforcement-state calculation, automatically transition expired suspensions or have Discord evaluate `suspended_until` consistently. Test expiry across login, feeds and Discord roles. |
| 🟡 P2 | DIS-024 - OAuth start abuse controls | Authenticated users can call `discord-link-start` repeatedly, creating many 10-minute challenge rows and OAuth requests. There is no per-user cooldown/idempotent active challenge. | Allow one active link challenge per user/guild, rate-limit starts and reuse/replace the current active challenge safely. |
| 🟡 P2 | DIS-025 - `/verify` challenge abuse | A Discord member can repeatedly invoke `/verify`; each valid interaction creates another 15-minute challenge row. There is no per-member issuance cooldown. | Rate-limit challenge issuance per Discord user/guild and cap outstanding challenges. Revoke older challenges when issuing a new one. |
| 🟡 P2 | DIS-026 - Interaction replay deduplication | Interaction signature freshness is checked, but processed interaction IDs are not recorded. A captured valid signed `/verify` request replayed inside the accepted timestamp window can create duplicate challenges. | Persist a short-lived interaction-ID replay cache and make command side effects idempotent. |
| 🟡 P2 | DIS-027 - Interaction request-size defence | `discord-interactions` calls `req.text()` before signature verification and has no function-level body-size cap. Platform limits may exist, but they were not proven in this audit. | Enforce/confirm a small maximum interaction body size at the edge/function and reject oversized requests before expensive parsing/crypto. |
| 🟡 P2 | DIS-028 - Three-second interaction SLO | Discord requires the initial interaction response within 3 seconds. `/verify`, `/roles` and `/support` avoid slow Discord REST calls, which is good, but there is no latency instrumentation, timeout budget or deferred-response fallback for Base44/database degradation. | Instrument p95/p99 interaction latency, set an internal budget below 3 seconds and use a deferred ephemeral response for any command that grows beyond fast local reads. |
| 🟡 P2 | DIS-029 - Manual role-refresh abuse | Any linked user can repeatedly call `discord-sync-user`, causing repeated Discord member reads and role writes without a user cooldown. | Add a short per-user cooldown/idempotent coalescing and return the last successful reconciliation when refreshed too frequently. |
| 🟡 P2 | DIS-030 - OAuth callback partial-success state | The callback creates/updates a verified link and marks the challenge used before role synchronisation. If Discord role sync then fails, the browser is redirected as failed even though membership/linking succeeded and the state is consumed. | Model linking as explicit states (`LINKING`, `MEMBER_JOINED`, `ROLE_SYNC_PENDING`, `VERIFIED`) and present repairable partial success instead of a generic failure. |
| 🟡 P2 | DIS-031 - Eligibility query caps | Role evaluation limits ratings/trades to 500, achievements/meetups to 100 and disputes to 100 without pagination. Large accounts can be undercounted or evaluated from a truncated recent slice. | Use purpose-built aggregate/projection records or paginated authoritative queries rather than bounded raw lists. |
| 🟡 P2 | DIS-032 - Localisation | The Discord interaction responses are translated across the nine supported locales, but the member Settings panel, admin bot panel and CAPTCHA verification page are hard-coded in English. | Move all permanent UI strings for Discord Settings/Admin/verification into the existing i18n system and test all nine locales. |
| 🟡 P2 | DIS-033 - Settings load failures | `DiscordSection.load()` catches entity read errors and silently treats them as no link, which can present 'Connect Discord account' when the service/read actually failed. | Use explicit loading/error/unlinked states and provide retry/help instead of converting backend failure into a genuine unlinked state. |
| 🟡 P2 | DIS-034 - OAuth callback URL cleanup | Settings reads `?discord=linked\|failed` on mount but does not remove the query parameter, and it ignores the server-provided `reason`. Refresh/back navigation can repeat stale toasts without useful diagnostics. | Consume the callback result once with `history.replaceState`, map safe reason codes to localised messages and avoid exposing raw backend details. |
| 🟡 P2 | DIS-035 - Member sync observability | The Settings UI does not show `last_role_sync_at`, `last_sync_error`, a pending revocation state, or whether Discord membership/roles are currently confirmed. | Show last successful sync, last error and pending external revocation clearly, with a repair action when safe. |
| 🟡 P2 | DIS-036 - Admin operational observability | The admin panel shows guild ID/counts/last sync but no live Discord API health, interactions endpoint validation, command registration state, role hierarchy, rate-limit/backlog state or failed-link summary. | Add a read-only health/preflight endpoint and admin dashboard covering app/guild identity, commands, role pins/hierarchy, channel pins, sync backlog/failures and last successful external checks. |
| 🟡 P2 | DIS-037 - Discord audit-log reasons | Role/channel management requests do not send Discord's supported `X-Audit-Log-Reason`, reducing server-side administrator traceability for bot-managed changes. | Attach concise safe audit reasons containing operation type and opaque SwapPulse correlation ID, never private user data. |
| 🟡 P2 | DIS-038 - 403 error classification | Every Discord HTTP 403 in the shared helper is mapped to `DISCORD_ROLE_HIERARCHY`, even though 403 can also mean other permission/policy failures. | Map errors using endpoint context and Discord error code/message; reserve hierarchy wording for confirmed hierarchy failures. |
| 🟡 P2 | DIS-039 - Data portability | `export-my-data` omits `DiscordAccountLink`, so a user export does not include their linked Discord identifier, verification method/status and role-sync metadata. | Include user-owned Discord account-link data in the export, excluding internal secrets/audit-only operational data. |
| 🟡 P2 | DIS-040 - Challenge retention lifecycle | Expired verification challenges are deleted only as housekeeping inside `discord-sync-all`. If synchronisation is disabled after use, expired hashed identifiers can remain indefinitely. | Move challenge expiry cleanup to a dedicated retention job or TTL policy independent of role sync. |
| 🟡 P2 | DIS-041 - Trust-role freshness | Trader/Contributor/Event Organiser changes rely on the 30-minute sweep or manual refresh. Even after upstream evidence is hardened, role grants/revocations can be noticeably stale. | Emit role-reconciliation jobs from authoritative eligibility changes and keep the scheduled sweep as drift repair. |
| 🟡 P2 | DIS-042 - `/roles` is mirror-only | `/roles` reports `DiscordAccountLink.applied_roles`, not the member's current live Discord managed roles. Manual Discord changes, failed partial mutations or delayed sync can make the command stale. | Either label it as last reconciled SwapPulse state with timestamp or use a fast cached/live read designed to stay within Discord's interaction deadline. |
| 🟡 P2 | DIS-043 - Membership Screening state | Discord's Add Guild Member endpoint can create a member with `pending: true` when Membership Screening is enabled. The current OAuth flow does not detect/explain this state before saying the account is linked and attempting role sync. | Read the returned member state and surface 'complete server membership screening' where applicable; do not imply channel access is ready until Discord says membership is complete. |
| 🟡 P2 | DIS-044 - Exact-release/deployment verification | The current audit-visible environment has zero guild configs/links/challenges/audit rows, so bootstrap, Developer Portal settings, commands, OAuth callback, Turnstile and scheduled reconciliation are not proven live. Build/lint/typecheck could not run because the Base44 command sandbox mounts an empty `/workspace` with no package.json; all three returned exit 254/ENOENT. | Before activation, run canonical-checkout build/lint/typecheck and a dedicated non-admin test-guild smoke suite. Record Developer Portal configuration, interaction ping, OAuth join, CAPTCHA, each command, role grant/revoke, deletion/enforcement revocation and scheduled sync evidence. |
| 🟢 P3 | DIS-045 - Turnstile action binding | The CAPTCHA widget/siteverify flow validates success and hostname but does not set/check a Turnstile `action` or `cdata` value tied to the Discord verification purpose. | Use a fixed action such as `discord_verify` and validate it server-side for additional context binding. |
| 🟢 P3 | DIS-046 - Forwarded IP trust | CAPTCHA `remoteip` is derived directly from `cf-connecting-ip`/`x-forwarded-for` without an explicit trusted-proxy check. It is advisory to Turnstile rather than the core authentication decision, limiting impact. | Use the platform's trusted client-IP facility or trust forwarding headers only from the expected proxy path. |
| 🟢 P3 | DIS-047 - OAuth granted-scope verification | The callback assumes the returned OAuth token contains the requested `identify guilds.join` scopes and relies on downstream calls to fail if it does not. | Validate the returned `scope` set before using the token and return a specific safe error if required scopes are absent. |
| 🟢 P3 | DIS-048 - Discord profile freshness | `discord_username` is captured at link time and is not refreshed during later role synchronisation, so the Settings display can become stale after a Discord username/global-name change. | Refresh non-sensitive display metadata periodically or avoid presenting it as current identity evidence. |
| 🟢 P3 | DIS-049 - Verification-page accessibility polish | The CAPTCHA verification page changes among loading/error/success states visually but does not provide a dedicated polite live region/status announcement for all transitions. | Add appropriate `role=status`/`aria-live` messaging and verify keyboard, screen-reader and high-zoom behaviour with the Turnstile widget. |

## Audit conclusion

The Discord work is **substantive, not placeholder scaffolding**. The repository already contains a signed Discord interactions endpoint, guild-only slash commands, HMAC-bound OAuth state, CAPTCHA fallback, idempotent-ish guild bootstrap, server-side role reconciliation, member and administrator UI, and private Base44 data models. The design also intentionally avoids privileged Gateway intents and does not place bot/client/Turnstile secrets in browser source.

The blocker is that Discord roles turn SwapPulse application data into **external authority**. Until deletion/enforcement revocation and the upstream proof sources are hardened, enabling the bot can create real Discord access or trust labels from state that is not yet authoritative enough. The safest current milestone is to keep the bot unbootstrapped while fixing the P0/P1 items, then activate it first in a disposable non-production test guild.

### Current live-visible Base44 state

- `DiscordGuildConfig`: **0 rows**
- `DiscordAccountLink`: **0 rows**
- `DiscordVerificationChallenge`: **0 rows**
- `DiscordRoleSyncAudit`: **0 rows**

This means the audit-visible environment has no configured guild, linked Discord identities or Discord role-sync history yet. That substantially reduces current exposure and makes this the ideal point to harden the architecture before bootstrap.

## What is already implemented well

- Discord interaction requests are authenticated with the Discord Ed25519 public key and timestamp freshness checks before commands execute.
- Interaction responses are ephemeral and use `allowed_mentions: { parse: [] }`, reducing accidental mention abuse.
- Commands are registered for **guild install / guild context only** (`integration_types: [0]`, `contexts: [0]`).
- `/verify` creates a random one-use challenge and stores only a SHA-256 hash, never the raw CAPTCHA challenge URL token.
- OAuth linking requests only `identify` and `guilds.join`, does not request email, and does not retain Discord OAuth access/refresh tokens.
- OAuth `state` is HMAC-signed, nonce-bearing, expiry-bound and cross-checked against a stored challenge hash.
- The CAPTCHA path can grant only the lowest `Collector` role and cannot self-select stronger roles.
- Bot/server identifiers are stored separately from backend secrets. Discord entities are admin-managed and user reads are owner-scoped where appropriate.
- The bot intentionally does not request Discord's unrestricted `ADMINISTRATOR` permission.
- The requested install permissions are limited to the capabilities used by the implementation: create invite for OAuth guild join, manage channels for bootstrap, and manage roles for synchronisation.
- Bootstrap is admin-only, requires an exact confirmation phrase and performs substantial application/guild/permission/configuration checks.
- Discord application commands are guild-scoped rather than globally deployed during early development.
- Discord API 429 handling already honours `Retry-After`, which is the correct base behaviour.
- Account enforcement is consulted by role evaluation, so suspended/shadow-banned accounts are intended to lose managed roles.
- Every successful/failing full role reconciliation attempts to write a dedicated admin-only audit record.
- Interaction copy is translated by `discordLocale.ts` across the nine supported SwapPulse locales.
- No references to `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_SECRET`, `DISCORD_LINK_STATE_SECRET`, `DISCORD_PUBLIC_KEY` or `TURNSTILE_SECRET_KEY` were found under `src/`.

## Implemented feature inventory

| Area | Current source state | Audit view |
| --- | --- | --- |
| HTTP interactions endpoint | Implemented | Signed request verification, PING and application commands present |
| `/verify` | Implemented | Account-link and CAPTCHA buttons, ephemeral |
| `/roles` | Implemented | Reports last reconciled role mirror |
| `/support` | Implemented | Routes users to configured support channels |
| OAuth link start/callback | Implemented | HMAC state + one-use DB challenge + `identify guilds.join` |
| CAPTCHA fallback | Implemented | Turnstile server verification + Discord-member binding |
| Guild member join | Implemented | Uses OAuth user access token + bot API |
| Managed roles | Implemented | 8 configured role classes |
| Role calculation | Implemented | User enforcement, reputation/trades/achievements/meetups/site staff |
| Manual per-user sync | Implemented | User can refresh own link; admin can target a user |
| Scheduled bulk sync | Implemented in source | 30-minute workflow, not live-proven |
| Unlink/revoke | Implemented | DB revoke + Discord role-removal attempt |
| Guild/application bootstrap | Implemented in source | Preview/apply path, not live-proven |
| Member Settings UI | Implemented | Link, role refresh, disconnect |
| Admin UI | Implemented | Preview/bootstrap and manual sync |
| CAPTCHA verification page | Implemented | Turnstile client + server verification |
| Gateway bot / privileged intents | Not used by design | HTTP interactions architecture |
| Rich Presence / Discord Social SDK | Not implemented | Not required for current support-first bot |
| Moderation commands/ticketing automation | Not implemented | Not penalised as a defect in this audit |

## Role model under audit

| Managed role | Current source eligibility | Current decision |
| --- | --- | --- |
| Collector | CAPTCHA or linked account | **Keep**, after fixing orphan-account fail-open |
| Verified SwapPulse Account | Linked SwapPulse user | **Keep**, with lifecycle/revocation fixes |
| Verified Trader | Completed trades + ratings threshold | **Disable until proof sources are authoritative** |
| Trusted Trader | Achievement or higher trade/rating threshold | **Disable until proof sources are authoritative** |
| Contributor | Selected achievements / achievement count | **Disable until proof sources are authoritative** |
| Event Organiser | Completed Meetup or Community Voice | **Disable until proof sources are authoritative** |
| Moderator | Base44 `user.role === moderator` | **Keep only with immediate revocation hooks + step-up protected admin operations** |
| Administrator | Base44 `user.role === admin` | **Keep only with immediate revocation hooks + step-up protected admin operations** |

## External Discord API alignment

Current Discord documentation confirms the implementation is using the right broad primitives:

- Discord HTTP interactions expose a unique interaction ID, guild/context metadata and support ephemeral responses. The initial response must be sent within **3 seconds**; interaction tokens remain usable for 15 minutes.
- OAuth `identify` grants `/users/@me` without email; `guilds.join` permits adding the authorised user to the guild. Discord strongly recommends `state` to bind the authorization request to the initiating user/session.
- The Add Guild Member API requires the bot to already be in the guild with `CREATE_INSTANT_INVITE`; role assignment/removal requires `MANAGE_ROLES`.
- Discord recommends using `X-RateLimit-Bucket` and associated rate-limit headers to coordinate shared route limits, and relying on `Retry-After` / `retry_after` for 429 retries.
- `integration_types` selects installation contexts and `contexts` selects interaction surfaces. The bot's `[0]`/`[0]` command registration is therefore correctly limited to guild installs and guild interactions.

Official references:
- https://docs.discord.com/developers/interactions/receiving-and-responding
- https://docs.discord.com/developers/topics/oauth2
- https://docs.discord.com/developers/topics/rate-limits
- https://docs.discord.com/developers/interactions/application-commands
- https://docs.discord.com/developers/resources/guild

## Required architecture before activation

### 1. External privilege lifecycle

Discord access must be treated as a second security domain. Every event that removes eligibility on SwapPulse must revoke Discord roles promptly and durably:

```text
site role/enforcement/account lifecycle change
        |
        v
backend authoritative eligibility transition
        |
        +--> durable Discord revocation/grant job
        |
        v
Discord API mutation + read-back
        |
        v
immutable/correlation audit event
        |
        v
Base44 link mirror updated
```

Self-deletion and moderator force-deletion must not remove the local User first and hope the 30-minute reconciler eventually repairs Discord.

### 2. Role eligibility projection

Do not let Discord recalculate trust roles from broad user-editable application entities. Create a server-owned projection such as:

```text
DiscordRoleEligibility
  user_id
  did
  guild_id
  role_key
  eligible
  evidence_version
  evidence_refs[]
  evaluated_at
  expires_at
  revoked_at
```

The projection should be produced only after the underlying feature's authoritative server-side proof has passed. Discord synchronisation then becomes a simple consumer rather than another trust engine.

### 3. Link state machine

Recommended states:

```text
PENDING_OAUTH
DISCORD_IDENTIFIED
MEMBER_JOINED
ROLE_SYNC_PENDING
VERIFIED
REVOCATION_PENDING
REVOKED
FAILED
```

That makes partial OAuth/join/role-sync failures repairable and visible instead of forcing `verified`/`revoked` to carry too many meanings.

### 4. Reconciliation architecture

- immediate high-priority queue for security revocations;
- event-driven eligibility updates for normal role changes;
- bounded-concurrency Discord API workers;
- route/global rate-limit coordination;
- 30-minute sweep only as drift repair;
- explicit cursor/backlog metrics;
- live role read-back for privileged transitions;
- dead-letter queue and administrator alerting.

## Required test matrix before first test-guild activation

### Interaction security

- valid Discord PING;
- bad Ed25519 signature;
- missing signature headers;
- stale timestamp;
- wrong application ID;
- wrong guild ID;
- DM/user-install invocation rejected;
- duplicate interaction ID replay;
- oversized request body;
- `/verify`, `/roles`, `/support` under the 3-second SLO;
- `allowed_mentions` remains disabled;
- all nine locales.

### OAuth/account linking

- CSRF/state mismatch;
- state expiry;
- state replay;
- auth-code replay;
- missing granted scope;
- Discord user already linked to another SwapPulse user;
- one SwapPulse user attempting concurrent links to two Discord users;
- old-account privileged-role removal failure;
- Membership Screening pending member;
- Discord token endpoint timeout/429/5xx;
- `/users/@me` timeout/429/5xx;
- member-add timeout/403/429/5xx;
- no OAuth token persisted/logged.

### CAPTCHA

- invalid/expired challenge;
- challenge issued to another Discord user;
- challenge replay;
- Turnstile failure;
- Turnstile hostname/action mismatch;
- user no longer in guild;
- CAPTCHA never grants more than Collector;
- existing stronger account link is not downgraded.

### Role integrity

- orphaned Base44 user receives **zero** roles;
- self-delete removes all Discord roles before User deletion;
- force-delete removes all Discord roles before User deletion;
- suspension/shadow-ban immediately removes managed roles;
- staff demotion immediately removes Moderator/Administrator;
- relinking cannot leave privileged roles on the old Discord identity;
- direct role-ID configuration drift fails closed;
- bot role below a managed role fails health/preflight;
- partial Discord API failures are reconciled and audited;
- role revocation is prioritised before new grants where privilege is involved;
- automated Trader/Contributor/Event Organiser roles remain disabled until authoritative evidence tests pass.

### Rate limits/resilience

- route bucket exhaustion;
- global 429;
- Discord `Retry-After` handling;
- hanging Discord connection timeout;
- 500+ link backlog with cursor continuation;
- concurrency does not exceed API budget;
- scheduled job restart/resume;
- audit-write failure;
- Discord API outage while revocation is required.

### Admin/bootstrap

- non-admin rejected;
- admin without fresh step-up rejected;
- preview has no side effects;
- wrong application/guild/public key/redirect/terms/privacy rejected;
- bot_public unexpectedly enabled rejected;
- missing install permission rejected;
- role name/permission conflict rejected;
- role hierarchy conflict rejected;
- channel conflict rejected;
- partial bootstrap repair/idempotency;
- exact command definitions registered;
- application remains guild-install only;
- live interaction endpoint PING passes after bootstrap.

### Privacy/data lifecycle

- Discord link included in user export;
- unlink removes/queues all external roles;
- self-delete removes or anonymises Discord link metadata according to policy;
- force-delete revokes Discord access and follows retained-audit policy;
- audit retention/redaction policy tested;
- no Discord/OAuth/Turnstile secrets in browser bundle/logs.

## Activation sequence

1. Fix DIS-001 through DIS-006 before any production/community guild bootstrap.
2. Add immediate privilege-revocation hooks for enforcement, staff-role changes, relinking, unlink and deletion.
3. Make Discord role/config/audit storage tamper-resistant and step-up protected.
4. Add request timeouts, rate-limit coordination and durable reconciliation jobs.
5. Add the full Discord regression suite.
6. Run `npm run typecheck`, `npm run lint`, `npm run build` from the canonical Git checkout/CI.
7. Configure a **disposable non-production Discord test guild** and Developer Portal application settings.
8. Run bootstrap preflight only and resolve every mismatch.
9. Apply bootstrap and verify interaction endpoint, slash commands, roles, hierarchy and channels.
10. Test OAuth and CAPTCHA with non-staff test accounts.
11. Test role grant/revoke, relink and unlink under injected Discord API failures.
12. Test suspension, shadow-ban, staff demotion, self-delete and force-delete with immediate external role read-back.
13. Exercise the 30-minute reconciliation workflow and backlog/429 recovery.
14. Only then enable the real SwapPulse Discord guild.

## Verification limitations

- The required Base44 web-agent README could not be read in this environment: the browser path was unavailable and a sandbox urllib request returned HTTP 403.
- The Base44 command shell mounted an empty `/workspace`, so `npm run build`, `npm run lint` and `npm run typecheck` each returned exit code 254 because `/workspace/package.json` was absent. The authoritative MCP file layer does contain `package.json`; this is the known sandbox-shell limitation, not evidence that the repository itself lacks the file.
- No live DiscordGuildConfig exists, so this audit intentionally did not attempt to mutate the Discord Developer Portal/server or create roles/channels.
- Discord secret **values** were not requested or printed. The sandbox environment did not expose the expected Discord/Turnstile variable names, and no privileged Discord secret references were found in frontend source.
- No live test-guild interaction/OAuth/CAPTCHA/role-sync smoke test was possible without performing the bootstrap the user explicitly says is not finished.

## Final decision

**Keep developing the current bot. Do not replace it.** Its architecture already has several good security choices, especially HTTP interactions, least-privilege OAuth, hashed one-use challenges, server-only secrets and guild-scoped commands.

**Do not bootstrap it into the real SwapPulse Discord guild yet.** The first hardening phase should focus on immediate Discord privilege revocation during deletion/enforcement, failing orphaned links closed, and preventing untrusted trade/achievement/meetup evidence from becoming external Discord trust roles. Once those P0s are resolved, the remaining work is mostly state-machine, resilience, rate-limit, test and operational-hardening work rather than a redesign.