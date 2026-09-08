---
description: Admin dashboard and tools
---

# Admin

Admin dashboard and tools

## What is the Admin page?

The Admin page is the administration dashboard for SwapPulse admins. It provides centralised access to system health, operational metrics, service management, incident handling, and federation diagnostics. Access is restricted to admin-role users.

## What admins can do

* **Health monitoring:** View live service health and trigger health checks.
* **Metrics:** Platform-wide metrics for users, posts, trades, and activity.
* **Service management:** Update service status, criticality, and check intervals.
* **Incident management:** Create, update, and resolve incidents.
* **Maintenance windows:** Schedule and manage maintenance.
* **Federation diagnostics:** Check AT Protocol federation health and PDS sync.
* **Invite codes:** Generate and manage invite codes for the alpha.
* **Email testing:** Send test emails to verify SMTP configuration.
* **Copilot source review:** Check allowlisted project-source revisions and approve or reject quarantined knowledge updates.
* **Agent insight review:** Approve or reject inactive feedback-derived suggestions before an assistant can use them.

## Health and diagnostics

The health section shows real-time service status and lets admins trigger manual health checks. Federation diagnostics help troubleshoot AT Protocol connectivity, PDS sync, and firehose ingestion issues.

## User management

Admins can invite users, manage roles, and handle data subject requests. User records are created via invitation, not direct creation.

## Operations

The admin dashboard surfaces operational tasks like SEO audits, bot protection logs, backfill operations and AI review queues so the team can keep the platform healthy and secure.

Project-source refreshes record an immutable revision and content hash. They do not publish automatically. An administrator must read and approve a queued revision, and safety-flagged material requires an additional acknowledgement. Feedback-derived insights use a separate review queue and also remain inactive until approved.

## Open this feature

* [Open Admin in SwapPulse](https://swappulse.org/admin)
* [View the original help route](https://swappulse.org/help/admin)
