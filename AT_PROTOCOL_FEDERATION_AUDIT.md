# SwapPulse AT Protocol / Federation Audit

**Audit date:** 11 September 2026  
**Scope:** PDS sessions and credentials, outbound federation, profile/handle discovery, custom handles, AT record ownership, federated privacy boundaries and SSRF/session safety.  
**Status:** Findings register. Some earlier platform hardening is complete; unresolved federation P0/P1 items remain.

| Priority | Area | Finding | Required action |
| --- | --- | --- | --- |
| 🔴 P0 | Outbound federation | Local posting works, but current SwapPulse outbound posts/promos are failing to publish to the wider AT Protocol network. | Repair PDS session/credential handling and prove publication end to end from SwapPulse through the user's PDS to an independent AT Protocol client/AppView. |
| 🔴 P0 | Profile search | Main Search calls `search-profiles` with a request contract that the function does not accept, then silently swallows the error. Local and wider-network profile discovery therefore diverge. | Replace the broken call with a defined local username-search API and merge local results with federation/AppView results using explicit error states. |
| 🔴 P0 | Custom handles | Handle verification accepts a caller-supplied DID while the client creates trusted HandleClaim state. Verified handle ownership is therefore partly client-controlled. | Make verification, claim creation and PDS handle update one atomic backend workflow bound to the authenticated user's canonical DID. |
| 🔴 P0 | AT record system fields | Post owners can alter backend-managed federation fields such as moderation/federation status, `bridged`, AT URI/CID and counters. | Separate user-editable post content from backend-managed federation/system fields and mutate trusted fields only through authenticated backend functions. |
| 🟠 P1 | Handle SSRF | `verifyHandleClaim` performs direct HTTPS fetches to a user-controlled hostname without the stronger shared DNS/IP SSRF guard. | Route handle verification through the shared safe-host/DNS/IP validation and reject private, local, reserved or redirect-to-private targets. |
| 🟠 P1 | PDS origin trust | User-controlled/stored PDS origins are an SSRF and credential-exfiltration boundary. | **Completed in the earlier security audit:** require public HTTPS origins, reject private/local/reserved targets and redirects, and bind authenticated sessions to both DID and validated PDS origin. |
| 🟠 P1 | Bearer-token destination | PDS bearer/session tokens must not be replayed to a different or shared PDS after authentication. | **Completed in the earlier security audit:** authenticated PDS requests use the exact validated origin that issued the session. |
| 🟠 P1 | Direct-message federation | Private direct messages must not become public AT repository records or fall back to plaintext. | **Completed in the earlier security audit:** new DMs are local-only and E2EE is required; public PDS federation/plaintext fallback is disabled. |
| 🟠 P1 | Meetup RSVP privacy | The UI attempts to federate RSVP records while the central privacy policy says RSVP data must not federate. | Remove the obsolete federation call and keep RSVP records local/private according to policy. |
| 🟠 P1 | Legacy simulated signing | Legacy simulated AT signing remains architectural debt even where the signing key is backend-protected. | Replace compatibility signing with proper PDS-native signing/session semantics and never reuse this mechanism for Starknet keys. |
| 🟡 P2 | Federation observability | Silent error swallowing makes federation/search failures look like empty results or local success. | Surface explicit federation delivery/search health states, retain safe diagnostics and distinguish local persistence from successful network publication. |
| 🟡 P2 | End-to-end interoperability | Internal success does not prove discoverability on the broader network. | Add repeatable tests that create/update a record on SwapPulse, resolve it independently through AT Protocol infrastructure and confirm it is discoverable from another client/service. |

Future AT Protocol/federation audits must use [AUDIT_STANDARD.md](AUDIT_STANDARD.md).
