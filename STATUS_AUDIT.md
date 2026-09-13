# Status Audit

Audit date: 2026-09-13

Scope: Public `/status` experience, service health rows, uptime history, incident summaries and detail pages, scheduled maintenance, email status subscriptions, health-check API, scheduled monitoring workflow, automated incident creation and resolution, admin service controls, admin incident controls, admin maintenance controls, notification delivery, status entities, security/privacy, accessibility, localisation, SEO, documentation, resilience and release-readiness.

Status: Major remediation required before the Status surface can be treated as an authoritative source of platform health.

## Findings

| Priority | Area | Finding | Required action |
| --- | --- | --- | --- |
| P1 | Service truthfulness | 29 active services are published, but only 6 currently have a persisted `last_checked_at`. The other 23 are still allowed to present as `operational`, because `StatusService.current_status` defaults to operational and there is no unknown/stale state. | Add `unknown` and `stale` states, track probe freshness independently, apply per-service stale thresholds, and never treat an unprobed service as healthy by default. |
| P1 | Uptime history | `UptimeBar` treats the latest 30 status-change records as “Last 30 status checks”, fills missing segments as operational, and reports 100% when there is no history. This can manufacture green uptime. | Store real timestamped health samples or time buckets, calculate uptime from elapsed monitored time, preserve unknown gaps, and label the metric accurately. |
| P1 | Monitoring coverage | The scheduled monitor persists checks for only 6 of 29 active services. The public health overlay maps only 10 of 29, leaving most services without live evidence. | Create an explicit monitor policy for every published service, or label unmonitored services as manual/unknown instead of operational. Add coverage tests that fail when an active service lacks a monitoring policy. |
| P1 | Probe quality | Several “health” checks do not prove service availability: Base44 is always returned as up, Stripe/NowPayments/SMTP/VAPID primarily check configuration presence, and AT Protocol checks only PDS `_health`. | Separate configuration readiness from runtime health. Use end-to-end or dependency-aware probes with latency, freshness and failure classification. |
| P1 | Status precedence | A successful live health result can override a manually set degraded or maintenance state in the UI, visually turning an intentionally non-operational service green. | Define one authoritative precedence model. Manual maintenance and active incident state must not be silently overridden by a green dependency probe. |
| P1 | Incident auto-resolution | A service recovery can resolve an entire open incident merely because that service appears in `affected_services`, including manual or multi-service incidents whose other services may still be affected. | Resolve per-service impact first. Auto-resolve the incident only when every affected service has recovered, and never auto-close a manual incident unless it explicitly opted into automation. |
| P1 | Manual service freshness | `manage-service` sets `last_checked_at` when an admin changes a service manually, making a manual status edit indistinguishable from a successful automated probe. | Split `last_probe_at` from `manual_status_updated_at`, record status source, and show both accurately. |
| P1 | Notification consistency | Automated monitor incidents notify subscribers, but the service-management path can create or resolve incidents without sending equivalent notifications. | Centralise incident lifecycle transitions and notification dispatch so every state transition follows the same policy and is idempotent. |
| P1 | Subscriber delivery | Status subscriber preferences are stored but not enforced, maintenance notices are not sent by the shared notifier, only the latest 500 confirmed subscribers are loaded, and messages are sent sequentially without a durable queue or delivery record. | Honour preferences, paginate all confirmed subscribers, queue deliveries, add retries/idempotency/delivery audit, and support maintenance notifications. |
| P1 | Public diagnostics | The public `health-check` response can expose raw dependency error strings and internal configuration names. | Return a sanitised public health DTO with stable codes and generic messages. Keep diagnostic detail in private logs/telemetry. |
| P1 | Public operator identity | Public status updates/incidents can expose `authored_by`, while maintenance records expose `created_by`. Admin email addresses or IDs can therefore become public status data. | Store private actor IDs separately and publish only a safe display identity such as `SwapPulse Operations` unless an operator explicitly opts into attribution. |
| P1 | Error propagation | Raw probe errors can be copied into public StatusUpdate/StatusIncident records and then reused in email notifications. | Classify and sanitise errors before persistence or notification. Never publish upstream secrets, URLs, stack details or raw provider responses. |
| P1 | Incident retention | Admin incident deletion is a hard delete. A public incident and its historical updates can disappear without a tombstone, correction reason or audit trail. | Replace destructive deletion with soft-delete/correction workflows, immutable audit events and a public tombstone where appropriate. |
| P1 | Active incident completeness | `/status` loads only the 20 newest incidents and derives active incidents from that set. An older unresolved incident can disappear from the public active view if enough newer records exist. | Query unresolved incidents separately with no history cap, then paginate resolved history independently. |
| P1 | Service registry drift | Admin incident creation uses a hard-coded service list while the public status surface is entity-driven and currently has 29 active services. | Populate all service selectors from active `StatusService` records and validate submitted service slugs server-side. |
| P1 | AT Protocol health | The AT Protocol “relay” health check verifies a PDS health endpoint, not relay ingestion, federation progress or event freshness. A stale inbound sync can therefore coexist with a green relay status. | Monitor actual ingestion checkpoints, relay/firehose freshness, lag and last successful event, and expose the correct subsystem name. |
| P1 | SEO / incident canonical | `IncidentDetail` hard-codes its canonical URL to `/incidents`, which is not the incident’s real route and is not the correct canonical target. This was also identified in the SEO audit. | Self-canonicalise each `/incidents/:incidentId` page, or canonicalise to `/status` if individual incidents should not be indexed. |
| P1 | Admin authorisation | Public-impact status actions are available through the broad admin role without a status-specific permission boundary or step-up check for destructive operations. | Introduce scoped status-management permissions, step-up authentication for destructive/public-impact actions, and immutable actor audit logs. |
| P2 | Overall status | The headline aggregate is based mainly on service rows. Active incidents and scheduled maintenance are not independently authoritative inputs to the banner. | Define aggregate-state rules that include active incidents, maintenance and stale/unknown services. |
| P2 | Failure handling | Public and admin loaders often convert fetch failures into empty arrays or silent fallbacks. This can make data unavailability look like “no incidents”, “no history” or a partially healthy system. | Add explicit unavailable/error states, retry controls, stale-cache indicators and observability for failed loads. |
| P2 | Health fallback | If the live health endpoint fails, the page silently falls back to stored status without clearly marking the live layer stale or unavailable. | Show live-check freshness and distinguish cached/stored state from current probe state. |
| P2 | Flapping | One failed probe can create an incident and the next successful probe can resolve it. Live history already shows rapid automated AT Protocol and TCGDex transitions. | Add consecutive-failure thresholds, recovery thresholds, cooldown/hysteresis and incident deduplication. |
| P2 | Subscription privacy | `subscribe-status` returns an `alreadySubscribed` distinction for a confirmed address after Turnstile, enabling limited subscription-state enumeration. | Return the same generic response for new and existing addresses and keep account/subscription state private. |
| P2 | Subscription UX | If Turnstile is unavailable or its site key is missing, the subscribe button can remain unusable without a clear recovery path. | Show an explicit verification error, retry control and accessible fallback/support guidance. |
| P2 | Incident state model | Reopening a resolved incident does not clearly clear `resolved_at`, and backend inputs can create lifecycle combinations that do not match the visible incident status. | Enforce lifecycle invariants server-side and derive timestamps from valid transitions rather than arbitrary client input. |
| P2 | Entity validation | Incident and maintenance `affected_services` accept arbitrary strings rather than being validated against the active service registry. | Validate service IDs/slugs server-side and reject or explicitly preserve historical references. |
| P2 | Incident detail resilience | Incident detail has no live polling and a missing/deleted incident can fall through to a blank state rather than a clear 404/not-found experience. | Add not-found/error states and refresh or event-driven updates while an incident remains active. |
| P2 | Accessibility | Expand/collapse controls lack full disclosure semantics such as `aria-expanded`/`aria-controls`; uptime bars rely heavily on colour and tiny hover titles. | Add semantic disclosure state, keyboard/focus verification, text equivalents and non-colour status indicators. |
| P2 | Localisation | Much of the Status UI and incident detail text is hard-coded English, and backend status emails are English-only despite SwapPulse’s wider localisation work. | Move all UI strings and email templates into the localisation system and test supported locales. |
| P2 | Public service schema | `StatusService` is publicly readable as an entity, including fields such as endpoint URL, check interval and timeout that are operational metadata rather than public status content. | Expose a purpose-built public DTO/endpoint with an allowlist of fields instead of the complete entity shape. |
| P2 | Notification HTML | Dynamic incident text is interpolated into HTML email content without a clear escaping boundary. | HTML-escape all dynamic content and use a templating layer that escapes by default. |
| P2 | Incident updates | The backend can accept an empty incident update even though the admin UI normally prevents it. | Validate trimmed update content server-side and enforce a sensible length limit. |
| P2 | Environment portability | Status notification links are hard-coded to `https://swappulse.org`, making staging, previews and self-hosted deployments point at production. | Derive public origin from validated environment configuration. |
| P2 | Documentation accuracy | Status documentation says the page gives real-time health for every service and refers to estimated resolution times, but monitoring coverage is partial and the incident model has no ETA field. | Rewrite docs to match current guarantees, or implement the missing monitoring/ETA capabilities before making those claims. |
| P2 | Admin history | Admin incidents and maintenance views are capped and lack complete pagination/archive search, reducing operational usefulness as history grows. | Add server-side pagination, filters, archival views and stable ordering. |
| P3 | Public history | The public page focuses on current/future maintenance and recent incidents, with limited long-term maintenance history. | Add a historical maintenance/incident archive if transparency is a product goal. |
| P3 | Service transparency | Individual service rows do not prominently explain status source, last automated probe time, probe age or whether a service is manually monitored. | Show “last checked”, source and freshness metadata in human-friendly form. |
| P3 | Polling efficiency | Public status polling continues at fixed intervals without an explicit visibility-aware/backoff strategy. | Pause or reduce polling in background tabs, use jitter/backoff on errors, and consider event-driven updates for active incidents. |
| P3 | Subscriber controls | There is no obvious public preference-management centre for changing incident/resolution/maintenance choices after subscription. | Add a signed-token preference page so users can manage notification categories without creating an account. |

No P0 finding was identified in the inspected Status feature. The P1 findings are still significant because Status is a public trust surface: a green indicator must mean that SwapPulse has evidence of health, not merely an absence of recorded failure.

## Executive summary

SwapPulse has already built most of the machinery expected from a serious status platform: a public status page, per-service rows, incident timelines, incident detail routes, maintenance windows, double opt-in email subscriptions, an automated monitoring workflow, admin controls, public health probes and automatic incident notifications.

The strongest part is the automated path. The scheduled monitor is running, current records have fresh monitoring timestamps for the services it covers, and live history shows that it has detected and resolved genuine TCGDex and AT Protocol probe failures. Subscription confirmation also uses signed, action-bound tokens rather than trusting raw email query parameters.

The central weakness is confidence semantics. At the audit snapshot, 29 active services were published but only 6 had persisted automated-check freshness. The other 23 could still display `operational`. The uptime component compounds this by converting missing history into green segments and 100% uptime. This means the public page can look more certain than the monitoring evidence justifies.

Status should therefore be treated as **partially operational but not yet authoritative**. The release goal should be simple: every green state must have a defined source, a freshness bound and enough evidence to support the claim.

## Live audit snapshot

| Metric | Audit snapshot | Assessment |
| --- | ---: | --- |
| Active published services | 29 | Good breadth, but creates a coverage obligation. |
| Services with persisted `last_checked_at` | 6 / 29 (20.7%) | Insufficient for an authoritative all-green dashboard. |
| Services without persisted probe freshness | 23 / 29 (79.3%) | Must not default to operational. |
| Public health overlay mappings | 10 / 29 (34.5%) | Better than persisted monitor coverage, but still incomplete. |
| Persisted scheduled monitor mappings | 6 / 29 (20.7%) | Requires major expansion or clear manual-only labelling. |
| Current status model states | operational, degraded, outage, maintenance | Missing unknown/stale. |
| Automated incident activity | Confirmed in live records | Core automation works, but lifecycle rules need hardening. |
| Build/lint/E2E in Base44 command sandbox | Not available | `/workspace` contained no project `package.json`; exact-release executable verification could not be claimed. |

## Feature inventory and verdict

| Feature | Present | Verdict |
| --- | --- | --- |
| Public `/status` dashboard | Yes | Needs remediation |
| Overall status banner | Yes | Needs remediation |
| Per-service status rows | Yes | Needs remediation |
| Live health overlay | Yes | Partial coverage |
| Automated 5-minute monitor | Yes | Partial coverage |
| Service freshness tracking | Partial | Needs redesign |
| Uptime bars | Yes | Misleading calculation |
| Active incident list | Yes | Needs completeness fix |
| Resolved incident history | Yes | Needs pagination |
| Incident detail page | Yes | Needs resilience/SEO fix |
| Scheduled maintenance display | Yes | Good foundation |
| Status email subscription | Yes | Good foundation, delivery/privacy fixes needed |
| Double opt-in confirmation | Yes | Strong foundation |
| Unsubscribe token flow | Yes | Strong foundation |
| Subscriber preferences | Stored | Not fully enforced |
| Automated incident notification | Yes | Inconsistent across paths |
| Admin service controls | Yes | Needs source/freshness and authorisation fixes |
| Admin incident controls | Yes | Needs lifecycle/audit hardening |
| Admin maintenance controls | Yes | Needs notification/history hardening |
| Public health API | Yes | Needs sanitisation and semantics |
| Public status documentation | Yes | Overstates current guarantees |
| Localisation | Partial | Incomplete |
| Accessibility | Partial | Needs disclosure/uptime improvements |

## 1. Public status dashboard

### Overall state

`src/pages/Status.jsx` calculates a headline state from service status values. The current model is too binary about evidence. A service without a check can inherit `operational`, and a failure to retrieve live health can fall back to stored data without a strong stale indicator.

The aggregate should be driven by an explicit state machine, for example:

- operational: all required services have fresh successful evidence and there is no overriding incident/maintenance state;
- degraded: at least one service is degraded but critical availability remains;
- outage: one or more required services are unavailable according to policy;
- maintenance: planned work is actively affecting the relevant service set;
- unknown: health cannot currently be established;
- stale: the last successful evidence is older than the service’s allowed freshness window.

An “All Systems Operational” banner should not be possible while the majority of published services have no automated freshness evidence.

### Live overlay precedence

The page’s live health result can replace `current_status` for mapped services. That is helpful for currentness, but unsafe when the stored state represents a manual maintenance decision or active operational incident. A dependency probe returning HTTP success does not mean an intentionally maintained service should become green.

Recommended precedence:

1. active manual maintenance;
2. active incident impact;
3. fresh automated service probe;
4. recent stored status with known source;
5. stale/unknown.

### Loading and error states

The main page uses broad fallbacks when service/incident retrieval fails. A monitoring product must distinguish these cases visibly. “We cannot retrieve status data” is different from “there are no incidents”.

## 2. Service rows and uptime

`ServiceRow.jsx` is a useful disclosure pattern, but it inherits the core evidence problem. It defaults missing state to operational and silently treats history-load failure as no history.

`UptimeBar.jsx` is the most serious user-facing accuracy defect in this area. It receives recent status-update events, pads absent entries as green, and calculates an operational percentage from those entries. Status-change events are not fixed-duration health checks. Thirty events may represent minutes, months, or nothing at all.

A correct uptime implementation needs one of these models:

- regular persisted health samples with a defined cadence;
- time buckets such as 5-minute/day intervals with explicit unknown gaps;
- interval reconstruction from timestamped state transitions, bounded by a known monitoring start and freshness guarantees.

Until that exists, the current percentage should be removed or renamed as an event-history visual rather than uptime.

## 3. Automated monitoring

The scheduled `Status Monitoring` workflow runs every five minutes and calls `status-monitor`. The live data confirms that this path is operating for the subset it knows about.

The main issue is coverage. The persisted monitor’s `SLUG_MAP` covers only:

- web-app;
- postgresql;
- tcgdex-api;
- atproto-relay;
- stripe-api;
- nowpayments-api.

The browser health overlay covers a somewhat larger set, but still not the full public registry. This split also means a service may look live in one browser session without receiving persisted monitoring history or automated incident lifecycle events.

A better design is one monitor registry shared by:

- scheduled monitoring;
- public health DTO generation;
- admin diagnostics;
- service freshness policy;
- documentation of what “operational” means.

Each service should declare probe type, cadence, timeout, required consecutive failures, required recovery successes, stale threshold and whether the probe is end-to-end, dependency-only, configuration-only or manual.

## 4. Probe semantics

Not every current check is a health check in the same sense:

- Base44 is reported as available without an external availability signal;
- SMTP verifies configuration rather than successful mail delivery;
- VAPID verifies configuration rather than push delivery;
- Stripe and NowPayments primarily verify configured credentials rather than a successful provider interaction;
- AT Protocol currently tests PDS health rather than actual inbound federation/relay progress.

These can still be useful diagnostics, but they need honest labels. “Configured” and “reachable” are not interchangeable with “operational”.

## 5. Incident lifecycle

The incident model supports investigating, identified, monitoring and resolved states with update history. That is a good baseline.

The highest-risk lifecycle defect is broad auto-resolution. Both automated and manual service recovery paths can locate an open incident that names the recovered service and mark that whole incident resolved. For a multi-service incident, this can close the public event while another affected service is still failing.

Recommended incident invariants:

- every affected service has its own impact state;
- automation only controls incidents it created, unless a manual incident explicitly enables automated recovery;
- an incident resolves only when all unresolved impact conditions are cleared;
- reopening clears or supersedes `resolved_at` consistently;
- each transition is appended to an immutable audit/event history;
- destructive deletion is replaced by correction/tombstone handling.

## 6. Incident listing and detail

The public page loads only 20 recent incidents and then derives active incidents from those results. Active incidents must instead be queried independently so a long-running event can never age out of the active view.

`IncidentDetail.jsx` provides a dedicated timeline, which is useful for sharing and transparency, but needs:

- a self-canonical URL;
- a real not-found state;
- refresh/polling while active;
- localised status labels;
- safe public author attribution;
- consistent chronological ordering.

## 7. Scheduled maintenance

Maintenance windows are first-class entities with a title, description, start/end times and affected services. The public Status page can display active/future maintenance, and admin tooling can create and manage windows.

The missing pieces are mostly operational:

- maintenance recipients are not notified through the same complete notification pipeline;
- affected services are not strongly validated against the service registry;
- maintenance deletion is destructive rather than auditable;
- public history is limited;
- a live green probe can visually override a manually maintained service unless precedence is fixed.

## 8. Status subscriptions

The subscription flow has several positive security choices:

- Turnstile challenge before subscription;
- email validation;
- double opt-in confirmation;
- signed HMAC tokens;
- action-bound token intent;
- unsubscribe without requiring an account.

The main shortcomings are downstream delivery and privacy. Preferences exist but are not consistently applied, the notification helper only loads a capped subscriber set, maintenance messages are not fully wired, and sequential sending has no durable delivery state.

The subscribe endpoint should also avoid revealing whether an email is already confirmed. A generic “If this address can be subscribed, check your inbox” response is safer.

## 9. Notifications

Status notification generation should become a durable event-driven subsystem rather than being called opportunistically from whichever code path changed state.

Recommended event types:

- incident.created;
- incident.updated;
- incident.resolved;
- incident.reopened;
- maintenance.scheduled;
- maintenance.updated;
- maintenance.started;
- maintenance.completed;
- maintenance.cancelled.

A worker can then select subscribers by preferences, render escaped templates, deduplicate by event/subscriber, retry transient mail failures, and record delivery outcomes.

## 10. Admin service management

The service admin surface can create/edit service metadata and adjust state. It is useful, but manual operations need clearer provenance.

A service record should expose separate fields for:

- automated probe state;
- automated probe timestamp;
- manual override state;
- manual override reason;
- manual override expiry;
- status source;
- actor ID in a private audit trail.

This prevents an admin edit from looking like a successful machine check.

## 11. Admin incident management

The incident admin UI supports creation, updates, status changes and deletion. Key changes required:

- service selection must come from the live registry, not five hard-coded names;
- server validation must reject invalid service references;
- update text must be validated server-side;
- lifecycle timestamp invariants must be enforced;
- hard delete must be replaced;
- public-impact actions should require scoped permission and, where appropriate, step-up authentication.

## 12. Admin maintenance management

Maintenance management needs the same registry validation and auditability guarantees as incidents. It should additionally trigger subscriber events when windows are scheduled, changed, cancelled, started and completed.

As history grows, admin incident and maintenance lists also need pagination and archive/search rather than fixed caps.

## 13. Security and privacy

### Good foundations

The double opt-in token design is materially better than accepting raw identifiers from confirmation links. Admin-only entities for subscriber records also protect the subscriber list from public reading.

### Required hardening

The public contract should be narrowed. Rather than allowing the public client to read entire internal status entities, expose explicit public representations containing only fields required by the status page.

Raw health errors should remain private. Public output should use stable values such as:

```json
{
  "status": "degraded",
  "code": "DEPENDENCY_UNAVAILABLE",
  "message": "A dependency is currently unavailable.",
  "checked_at": "..."
}
```

Private logs can retain request IDs and provider detail for operators.

Operator email addresses/IDs should never be included in a public status response merely because they were convenient to store in `authored_by` or `created_by`.

## 14. Accessibility

The status layout is visually understandable, but disclosure controls and uptime visualisation need semantic hardening.

Required checks include:

- `aria-expanded` and `aria-controls` on service/incident disclosure buttons;
- full keyboard operability and visible focus;
- text labels/icons that do not rely on colour alone;
- accessible names for status indicators;
- screen-reader text for uptime/history state;
- sensible live-region use for subscription confirmation without creating noisy polling announcements;
- WCAG contrast verification for all four status colours in light and dark themes.

## 15. Localisation

Only part of the Status experience goes through the translation layer. Most status labels, helper text, incident-detail text and notification emails are hard-coded English.

All visible status terminology should use one translation vocabulary across:

- `/status`;
- `/incidents/:id`;
- subscription confirmations;
- notification emails;
- admin status controls where localisation is supported.

## 16. SEO and shareability

Incident detail pages are useful public references during an outage, so canonical correctness matters. The current `/incidents` canonical is not the actual route.

Recommended approach:

- self-canonicalise `/incidents/<id>` if incident pages are intended to be indexable and shareable;
- provide a clear title/description using the incident title and current status;
- add `noindex` only if public incident indexing is intentionally undesired;
- use `/status` as the canonical only when individual incident pages are not canonical resources.

## 17. Documentation

`docs/platform/status.md` describes a stronger guarantee than the implementation currently provides. In particular, “real-time health of every SwapPulse service” is not supported by the current monitoring coverage, and estimated resolution times are mentioned without an ETA field in the incident model/UI.

Documentation should define:

- which services are automatically monitored;
- what the check proves;
- expected cadence;
- stale threshold;
- status definitions;
- incident lifecycle;
- maintenance behaviour;
- subscription notification categories.

## What is working well

1. The Status product is not a mock shell. The scheduled monitoring workflow is executing and has generated genuine automated status transitions and incidents.
2. The public experience already joins service status, incidents, maintenance and subscriptions in one place.
3. Double opt-in subscription confirmation uses signed, action-bound tokens.
4. Subscriber records are admin-only rather than publicly readable.
5. Automated incident notification exists and can be reused once state transitions are centralised.
6. Status services are mostly registry-driven, which gives a good path to eliminating hard-coded service lists.
7. Incident updates support a public timeline rather than only a single current-state message.
8. Maintenance is represented as a first-class entity rather than improvised incident text.
9. The existing monitoring code records timestamps and can support better freshness semantics without replacing the whole subsystem.

## Recommended remediation order

### Release gate 1: Make green truthful

1. Add unknown/stale semantics.
2. Stop defaulting unprobed services to operational.
3. Replace or remove the current uptime percentage until real samples/time buckets exist.
4. Separate manual edits from automated probe freshness.
5. Define status precedence among maintenance, incidents, probes and cached state.

### Release gate 2: Fix monitoring coverage

1. Create a single monitor registry for every published service.
2. Add meaningful end-to-end probes where possible.
3. Clearly label configuration-only/manual checks.
4. Add AT Protocol ingestion/federation freshness rather than PDS-only health.
5. Add failure/recovery thresholds to prevent flapping incidents.

### Release gate 3: Make incident lifecycle safe

1. Prevent one recovered service from closing a multi-service/manual incident.
2. Validate affected services against the registry.
3. Query all unresolved incidents independently of history limits.
4. Enforce valid state/timestamp transitions.
5. Replace hard delete with audited correction/tombstone behaviour.

### Release gate 4: Make notifications reliable

1. Centralise incident/maintenance events.
2. Honour subscriber preferences.
3. Remove the 500-recipient ceiling with pagination/queueing.
4. Add retries, idempotency and delivery records.
5. Escape dynamic HTML and sanitise public messages.
6. Notify maintenance changes consistently.

### Release gate 5: Finish trust, privacy and UX

1. Create public DTOs for status data.
2. Remove operator identity and raw diagnostics from public responses.
3. Fix incident canonical URLs.
4. Complete localisation and accessibility.
5. Add explicit loading/error/stale states.
6. Correct documentation so it matches actual guarantees.

## Verification performed

This audit inspected the Status page, incident detail page, status components, admin service/incident/maintenance controls, all five Status-related entity schemas, monitoring workflow, health-check implementation, subscription/confirmation functions, notification helper, shared health-check code, documentation and related audit findings.

Live entity inspection confirmed the published service registry and showed that the scheduled monitor is actively writing checks and automated incidents for a subset of services.

The Base44 command sandbox available during this audit exposed an empty `/workspace` without the application `package.json`. Therefore an exact-release build, lint run, unit suite, browser E2E suite and dependency/security scan could not be truthfully rerun from that sandbox. Those remain required release-gate checks after the source fixes above.

## Suggested acceptance tests

1. A never-probed service renders `Unknown`, never green.
2. A service becomes `Stale` after its configured freshness threshold.
3. An active maintenance override remains visible even when its dependency probe succeeds.
4. A multi-service incident remains open when only one affected service recovers.
5. A manual incident is never auto-resolved by a service probe unless explicitly configured.
6. The overall banner cannot say all systems operational while any critical service is stale/unknown.
7. Uptime calculation uses time/sample coverage and does not treat missing data as success.
8. Every active public service has an explicit monitoring policy.
9. Status monitor flapping requires configured consecutive failures/recoveries before transition.
10. Public health output contains no stack traces, raw provider errors, secrets or internal operator identity.
11. Every unresolved incident appears on `/status` regardless of age/history volume.
12. Subscriber preferences suppress unwanted event categories.
13. More than 500 confirmed subscribers can be processed through queued pagination without loss.
14. Maintenance schedule/update/cancel events notify only opted-in recipients.
15. Incident and maintenance email HTML safely escapes user/admin/provider text.
16. A reopened incident has lifecycle timestamps consistent with its current state.
17. Invalid affected-service identifiers are rejected server-side.
18. Incident detail returns a clear not-found state for an invalid/deleted ID.
19. Disclosure controls announce expanded/collapsed state to assistive technology.
20. Status UI and email templates render in every supported locale without falling back unexpectedly to hard-coded English.
21. Incident canonical metadata points to the correct public resource.
22. A failed status-data fetch renders an explicit unavailable state rather than an empty/green dashboard.

## Final assessment

The Status feature is broad and genuinely functional, but its public confidence model is currently ahead of its evidence. The main engineering task is not to add more visual features. It is to make every status claim traceable to a trustworthy source, a timestamp and a defined lifecycle.

Once the P1 items are resolved, especially unknown/stale semantics, real uptime accounting, complete monitoring policy and safe incident resolution, the existing architecture can become a strong and credible public status system without requiring a ground-up rebuild.
