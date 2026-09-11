# SwapPulse Feature Audit

**Audit date:** 11 September 2026  
**Scope:** Application features, trust boundaries, Web3 integration, AT Protocol/federation, moderation, community features, public routes, production deployment and supporting APIs.  
**Status:** Audit findings register

| Priority | Area | Finding | Required action |
| --- | --- | --- | --- |
| 🔴 P0 | Card verification | A user could update their own `CardVerificationSession`, including `status` and `verification_level`, while `mint-card` trusted those values. A Level 0/self-attested card could therefore have been escalated before minting. | **Completed:** verification-session create/update is backend/admin controlled, card identity is derived server-side and possession-verified status requires a server-issued Level 2+ result. |
| 🔴 P0 | Community labels | A CommunityLabeler owner can update their own `approval_status`, meaning they can potentially self-approve and issue trusted authenticity/safety/grading labels. | Make approval, approver, approval date, accuracy and issue counters admin/backend-only. |
| 🔴 P0 | Trust/Vouches | `Vouch` creation accepts client-supplied DIDs and local vouches are counted by `getTrustProfile`. Fake DIDs can therefore inflate trust. | Create vouches through a backend function that derives the caller's DID and enforces uniqueness. |
| 🔴 P0 | Trade reputation | Reputation records similarly accept arbitrary `rater_did`, target DID, trade URI and rating. Portable reputation therefore cannot currently be treated as trustworthy. | Bind feedback to authenticated participants in a completed trade. Derive both parties server-side. |
| 🔴 P0 | Posts | Post owners can modify backend-managed fields including moderation status, moderation labels, federation status, `bridged`, AT URI/CID and counters. | Split user-editable content from system fields or require backend mutation endpoints. |
| 🔴 P0 | Challenges | ChallengeEntry owners can change contribution counts, status, verification hashes and moderation labels. Contributions are also not reliably bound to the user's CollectionEntry ownership. | Server-own scoring/status fields, verify `created_by_id`, and recompute scores server-side. |
| 🔴 P0 | Circle challenges | Circle-scoped challenges do not actually enforce circle membership consistently. | Enforce membership in backend reads/submissions, not just presentation logic. |
| 🔴 P0 | Voice Spaces | A participant can create/update their own participant row with a privileged role. A listener can potentially make themselves a speaker and publish microphone media without host approval. | Move stage-role changes behind host-authorised backend operations. |
| 🔴 P0 | WebRTC | `SpaceSignal` is publicly readable and `from_did` is not cryptographically/auth-bound. Signalling can be spoofed and SDP/ICE metadata is too broadly exposed. | Restrict signalling to space participants and bind sender identity server-side. |
| 🔴 P0 | Bridge | A submitted bridge transfer enters `PENDING_RELAY`, but `chain-action-submit` never records the BridgeAdapter outbound nonce. Reconciliation skips transfers without a nonce. | Capture nonce from the actual chain event/receipt and make reconciliation authoritative. |
| 🔴 P0 | Bridge safety | Destination addresses are essentially checked by string length. A malformed destination could be committed after locking tokens or burning a card NFT. | Add chain-specific Ethereum/L2/Solana validation before signing. |
| 🔴 P0 | Card bridge recovery | Cards are burned on bridge-out, while the refund contract path does not itself remint the card. The promised recovery/remint path is not comprehensively tested. | Implement and test secure failed-bridge remint/refund lifecycle. |
| 🔴 P0 | Staking recovery | Expired/revoked verification disables the whole staking UI and backend, including `request_undelegate`, `withdraw` and `exit_validator`. | Verification may gate new value actions, but must **never prevent users recovering their existing assets**. |
| 🔴 P0 | Production deployment | Live `chain-explorer` returns HTTP **503** with `Invalid URL: 'undefined'`, although the raw RPC is healthy. The response does not match the current checked-in implementation. | Reconcile repository vs deployed Base44 functions and redeploy the canonical version. |
| 🔴 P0 | Chain reconciliation | The only live ChainIdentity still says `ACTIVE` even though its V2 verification expired on **3 September 2026**. Its last reconciliation was 2 September. | Schedule `chain-identity-reconcile` and alert on stale reconciliation. |
| 🔴 P0 | AT outbound federation | Local posting works, but current SwapPulse outbound posts/promos are failing to publish to AT Protocol. | Repair PDS session/credential handling and prove publication end to end. |
| 🔴 P0 | Profile search | Main Search calls `search-profiles` with a request contract that the function does not accept, then silently swallows the error. | Replace with a proper local username search API and merge with federation results. |
| 🔴 P0 | Custom handles | Handle verification accepts a caller-supplied DID, while the client creates the verified HandleClaim itself. Trusted handle state is partly client-controlled. | Make verification + claim creation + PDS update an atomic backend workflow bound to `auth.me().did`. |
| 🟠 P1 | DMs | The UI encrypts messages correctly, but the entity does not require the `e2ee:` ciphertext format. A modified client can store plaintext directly. | Use backend-only message creation or schema-level ciphertext validation. |
| 🟠 P1 | Predictions | A voter creates a vote and then tries to update a poll owned by somebody else. RLS should reject that update, leaving inconsistent votes/tallies. | Use atomic backend voting with uniqueness and server-computed totals. |
| 🟠 P1 | Pull of the Week | Same vote-counter problem. “One vote per week” is primarily UI enforcement. | Add a backend vote endpoint with uniqueness and atomic counter update. |
| 🟠 P1 | Pack Parties | The prominent **Join Now** button has no click handler. | Implement join/leave/membership lifecycle or remove the action until ready. |
| 🟠 P1 | Trending cards | Hover preview can remain on an infinite spinner because the TCGDex call has no enforced request timeout. | Add backend timeout plus frontend timeout/error/retry state. |
| 🟠 P1 | Trending data | AI-generated TCGDex card IDs are accepted without proving that the card actually exists. | Validate every generated ID against TCGDex before caching. |
| 🟠 P1 | Public challenges | `/challenges/:id` is public, but leaderboard retrieval requires auth. Guests can get an indefinite loading state. | Add a public safe leaderboard endpoint or explicit signed-out state. |
| 🟠 P1 | Meetups | Meetup detail is a public route but `getMeetup` requires authentication, producing a misleading “not found” experience for guests. | Align route visibility and backend access. |
| 🟠 P1 | Meetup RSVP | UI attempts to federate RSVP records while the central privacy policy correctly prohibits federation of RSVPs. | Remove obsolete federation call and update documentation. |
| 🟠 P1 | Status page | Numerous services can appear “operational” despite never having been checked. `degraded` results are effectively presented as operational. | Add `unknown/stale/degraded` states and actual probes. |
| 🟠 P1 | Health endpoint | `/api/health` serves the SPA HTML rather than a real machine-readable health document. | Create a genuine health endpoint and validate response content. |
| 🟠 P1 | CSP | Production has HSTS, anti-framing and MIME protections, but no effective Content-Security-Policy was present in the live response. | Deploy a tested CSP covering Base44, uploads, required embeds and Cloudflare Turnstile. |
| 🟠 P1 | Security contact | `/.well-known/security.txt` currently returns 404. | Add an RFC-style security contact/policy file. |
| 🟠 P1 | API docs | `openapi.yaml` still identifies the API/release as **v0.9.0**, while the application is v0.10.0. It also describes an outdated function URL shape. | Regenerate/update OpenAPI from the release implementation. |
| 🟠 P1 | Authentication UX | Login codes actually expire after 5 minutes, while the email says 15 minutes. | Use one server-owned TTL and render it consistently. |
| 🟠 P1 | Handle SSRF | `verifyHandleClaim` performs a direct HTTPS fetch to a user-controlled hostname without the stronger shared DNS/IP SSRF guard. | Route it through the existing safe-host validation. |
| 🟠 P1 | Card scan input | Card verification accepted arbitrary HTTPS image URLs through the API, although the UI normally uploaded Base44 files. | **Completed:** verification now uses private Base44 uploads, authenticated signed-URL access, image upload validation and no longer accepts arbitrary caller-supplied scan URLs. |

Future feature audits must use the format defined in [AUDIT_STANDARD.md](AUDIT_STANDARD.md).
