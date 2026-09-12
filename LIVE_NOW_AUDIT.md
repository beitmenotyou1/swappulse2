# SwapPulse Live Now / Voice Spaces & Podcasts Full Feature Audit

**Audit date:** 12 September 2026  
**Scope:** Live Now discovery, Go Live, external streams, in-platform Voice Spaces, joining/leaving, WebRTC peer mesh, signalling, participant roles, stage moderation, hand raising, mute controls, recording, auto-end, live presence/rings, profile controls, notifications, cross-posting, AT Protocol federation, podcast creation/editing/playback/RSS, achievements, AI/networking integrations, moderation, privacy, data rights, accessibility, localisation, mobile UX and release verification.  
**Status:** **NOT RELEASE READY**. Source/schema/live-data review is complete. Exact-release build/lint/typecheck could not be rerun because the Base44 command sandbox exposes an empty `/workspace` with no `package.json`. The required Base44 web-agent README also returned HTTP 403 from the sandbox.  
**Overall score:** **12/100**  
**Risk:** **Critical / High Risk**  
**Findings:** **68 total: 10 P0, 37 P1, 20 P2, 1 P3**

| Priority | Area | Finding | Required action |
| --- | --- | --- | --- |
| 🔴 P0 | Participant roles | **LN-001:** `SpaceParticipant.role` is writable by the participant who owns the row. A modified client can create or update itself as `host`, `co_host`, `mod` or `speaker` instead of `listener`. In-platform publishing decisions trust this field, so privilege escalation can become microphone/stage access. | Move join and all role transitions behind backend operations. Derive caller DID/user ID, create ordinary joins as `listener`, and allow promotion/demotion only after proving the caller is the authoritative host/mod for that specific space. Make `role` backend-only. |
| 🔴 P0 | Live moderation | **LN-002:** The normal host/mod controls are also functionally broken by RLS. `InPlatformSpace.updatePart()` and the external-space `promote()` call `SpaceParticipant.update()` on another collector's row, but RLS allows update only to the row owner or an admin. Host actions such as promote, demote, mute, revoke mod and remove therefore fail for ordinary hosts/mods while self-owned malicious role edits remain possible. | Replace direct row mutation with authenticated server commands: `space-join`, `space-stage-action`, `space-leave`. Validate host/mod authority server-side, mutate target rows with service role only after authorisation, log actions and return explicit errors to the UI. |
| 🔴 P0 | WebRTC signalling | **LN-003:** `SpaceSignal` is publicly readable (`read: {}`), and any authenticated user can create a signal with arbitrary `space_id`, `from_participant_id`, `from_did`, `to_did` and unbounded SDP/ICE payload. This exposes connection metadata and permits sender/space spoofing without proving membership. | Make signalling private to active members of the specific room. Bind sender identity and participant ID from the session, validate target membership, cap payload size/type, add short TTL/deletion, and move signalling through a backend/realtime channel rather than a public entity. |
| 🔴 P0 | Achievement integrity | **LN-004:** The external-stream room deliberately seeds four fake listeners (`PokeProf`, `ShinyHunter`, `CardQueen`, `VintageVince`) with generated fake DIDs. More generally, participant DIDs/space IDs are caller-controlled and no uniqueness invariant exists. The achievement engine counts distinct `SpaceParticipant.did` values and awards **Community Voice** at 5+ participants for 30+ minutes, so synthetic rows can directly create false proof and pollute Networking Concierge history. | Delete `seedDemoListeners` and all production demo-attendance code. Make participation backend-authenticated, one active participant row per real account/space, derive DID server-side and rebuild/revoke any achievements whose proof includes synthetic/untrusted participant rows. |
| 🔴 P0 | Recording consent | **LN-005:** In-platform Go Live defaults `recordFromStart` to **true**. A joining participant is not presented with a recording consent gate or durable consent record; the only runtime notice is a small `REC` badge after joining. Hosts can also start recording mid-session. Terms state that joining a recording-enabled room constitutes consent, but the product does not obtain explicit, auditable consent before a microphone participant is recorded, which is especially risky on a 13+ service. | Default recording off. Before a listener can join a recording-enabled room or become a speaker after recording begins, show an explicit recording notice and require affirmative consent. Store minimal consent evidence tied to space/user/time, block recording of non-consenting speakers, and provide host/participant controls for withdrawal/future publication. |
| 🔴 P0 | Recording publication | **LN-006:** Ending a recorded in-platform Space automatically uploads the mixed audio and immediately creates a **public `PodcastEpisode`** with `published_at`. Public RSS consumes every episode. There is no separate publish/review confirmation even though Help says the host should end the room, open **Save as Podcast**, edit metadata and then publish. Recorded conversation can therefore become public distribution content simply by ending the Space. | Separate **recording storage** from **podcast publication**. Ending a room should create a private recording asset/draft owned by the host. Require a distinct publish action with consent confirmation, title/metadata review, moderation controls and federation/RSS opt-in before a `PodcastEpisode` becomes public. |
| 🔴 P0 | Cross-post authorisation | **LN-007:** `crossPostDispatcher` service-role loads caller-supplied `VoiceSpace` and `PodcastEpisode` IDs for `voice_space_live` / `podcast_episode` without proving the record belongs to the caller. This is the same unresolved project-wide cross-post content IDOR already classified P0. | Authorise every source object before service-role read. Require `created_by_id === caller.id` or another explicit publish permission and verify `contentType` matches the loaded entity. Reject foreign IDs and add adversarial tests for VoiceSpace/PodcastEpisode IDs. |
| 🔴 P0 | Data erasure | **LN-008:** Account deletion and enforcement clean `VoiceSpace`, `SpaceParticipant`, `PodcastEpisode` and `PodcastPlay`, but **omit `SpaceSignal`**. SDP/ICE records described as ephemeral can therefore remain after account deletion. Data export also omits `SpaceParticipant`, `SpaceSignal` and `PodcastPlay`. | Add signalling/participation/listen history to the maintained personal-data inventory. Delete short-lived signals automatically within minutes and explicitly remove remaining sender/target-linked signals during account erasure. Export applicable participation/listen records with privacy-safe field rules. |
| 🔴 P0 | Federation / erasure | **LN-009:** VoiceSpace and PodcastEpisode federation inherits the unresolved canonical consent/deletion gaps: the frontend bridge can publish through `atproto-bridge` without the project-wide `do_not_sell` guarantee at the lowest write boundary, and account deletion emits a PDS tombstone label rather than proving deletion of each actual public record. Uploaded recording/original-audio files are not deleted by entity cleanup. | Enforce federation consent inside the canonical PDS create/update boundary. Maintain per-record delivery references and delete/tombstone actual VoiceSpace/PodcastEpisode records during content/account erasure. Add storage-object deletion/retention jobs for recordings, originals and covers, with reconciliation and auditable failures. |
| 🔴 P0 | Podcast mobile UX | **LN-010:** The existing UI/UX audit already classifies a Live Now subfeature as P0: `StickyPlayerBar` switches to `sm:bottom-0` at 640px while the fixed MobileNav remains until 768px, so the podcast player can sit underneath the navigation from 640-767px. | Use one shared mobile-bottom inset/navigation-height token. Keep the player above MobileNav until the nav is actually removed, and regression-test 640, 667, 720 and 767px widths plus PWA safe areas. |
| 🟠 P1 | VoiceSpace authority | **LN-011:** VoiceSpace owners have broad row update authority and can rewrite lifecycle/status, start/end time, listener/viewer counters, recording state/URLs, host identity, DID, AT URI/CID, bridge state and content hash. Several downstream surfaces and achievements treat these fields as meaningful. | Partition user-editable presentation fields from lifecycle/trust/federation fields. Make status transitions, counters, host identity, recording references and federation metadata backend-owned. |
| 🟠 P1 | Participant provenance | **LN-012:** A participant also owns all non-role fields on their row, including `did`, display identity, `muted_by_host`, join/leave timestamps and AT metadata. Self-authored identities and host-mute state cannot be treated as authoritative. | Derive DID/profile identity/join time server-side. Restrict self-service to safe fields such as self-mute/hand-raised. Make host-mute, role, leave-for-removal and trust metadata backend-only. |
| 🟠 P1 | Duplicate joins | **LN-013:** There is no server uniqueness constraint for one participant/account per Space. The UI performs a best-effort `filter({space_id,did})`, but `did` itself is caller-controlled and direct clients can create multiple rows. | Enforce a server idempotency/unique key on `(space_id, authenticated_user_id)` or canonical DID, reuse/reactivate a single row on reconnect, and reject duplicate/fake DID rows. |
| 🟠 P1 | Live discovery | **LN-014:** `/spaces` defines “live” as `status === 'live' && stream_url`. Every in-platform Space intentionally has no `stream_url`, so the principal **Live Now** page excludes the new in-platform audio feature entirely even while it is live. | Build one safe live-read model that returns both `external` and `in_platform` spaces. Render mode-specific cards: `Join Space` routes in-app, `Watch Stream` goes through safe external-link handling. |
| 🟠 P1 | Home discovery | **LN-015:** `SpaceBar` similarly filters live spaces to records with a safe external `stream_url`; in-platform live rooms never appear in the Home live rail. | Use the same unified live-read model as `/spaces` and make the Home rail mode-aware. |
| 🟠 P1 | Live ring navigation | **LN-016:** `getLiveUsers` returns every live VoiceSpace with `sourceType: 'stream'`, no `spaceId`, and an empty `url` for in-platform rooms. `LiveAvatar` only routes in-app when `sourceType === 'voice_space' && spaceId`; otherwise it attempts to open `info.url`. An in-platform host can therefore show a red live ring that does nothing when clicked. | Return `sourceType:'voice_space'`, `spaceId` and an in-app join route for in-platform spaces; use `sourceType:'stream'` only for validated external URLs. Test avatar click/hover join from profile, feed and participant lists. |
| 🟠 P1 | Auto-end lifecycle | **LN-017:** Auto-end is **lazy**: only `getLiveUsers` marks expired records ended. `/spaces`, Profile and direct entity subscribers do not independently apply `auto_end_at`, so an expired room can remain `status:'live'` and visible until some authenticated client invokes `getLiveUsers`. | Add an authenticated scheduled/reconciler lifecycle job plus read-time effective state. Treat `auto_end_at <= now` as ended on every discovery/read surface and make server transition idempotent. |
| 🟠 P1 | Profile end flow | **LN-018:** Profile's **End Stream** button directly changes `VoiceSpace.status/ended_at` instead of calling `endSpace`. It skips participant-based listener metrics, recording finalisation and podcast linkage. | Route all end/cancel actions through one authoritative backend lifecycle endpoint. The profile button should never write VoiceSpace lifecycle directly. |
| 🟠 P1 | External-room authenticity | **LN-019:** External-stream spaces randomly toggle “speaking” indicators for simulated participants. The UI can show people apparently speaking when no such audio activity exists. | Remove simulated speaking/activity from production. External mode should show only verified platform metadata and actual SwapPulse participation, never invented real-time activity. |
| 🟠 P1 | External audio semantics | **LN-020:** ExternalStreamSpace asks the host for microphone access and toggles an in-app mic, but SwapPulse is only linking users out to Twitch/YouTube/Kick; that microphone audio is not sent to the external stream. The control implies a capability the system does not provide. | Remove the local mic/stage controls from external-link mode or integrate a real streaming transport. Clearly separate external broadcast metadata from in-platform audio. |
| 🟠 P1 | External URL trust | **LN-021:** Any authenticated user may publish an arbitrary HTTP/HTTPS stream URL and label it Twitch/YouTube/etc.; the backend does not verify domain, account ownership or that the URL is live. Viewer estimates are also owner-writable and used for ranking. | For named platforms, require canonical hostnames and normalise URLs; use “Custom external link” for others. Add reputation/abuse limits and optional provider verification/live checks. Never rank on caller-writable viewer counts. |
| 🟠 P1 | External-link safety | **LN-022:** LiveStreamCard and LiveAvatar call `window.open()` directly, and SpaceBar renders a raw external anchor. They bypass SwapPulse's shared `confirmExternalLink` leave-site confirmation used elsewhere. | Route every external stream click through the central external-link confirmation/safety component, display destination host, and reject insecure/non-public destinations where policy requires. |
| 🟠 P1 | Go-live push | **LN-023:** GoLiveModal calls the user-callable `dispatchBellNotifications` directly with caller-supplied category, preview and URL. The function proves only the author DID, not an underlying VoiceSpace event, and does not use the central notification preference/quiet-hours pipeline. External mode can put the arbitrary stream URL directly into push payloads. | Generate go-live notifications only from the authoritative server start transition using the persisted VoiceSpace. Use the central notification dispatcher/filter, deep-link to `/spaces/:id`, and let the app perform the external-link confirmation after open. |
| 🟠 P1 | Bell recipient provenance | **LN-024:** `FollowPreference.did` remains client-writable, while bell dispatch uses that DID to find recipient User push subscriptions. A collector can self-assert another DID in their preference row. | Make FollowPreference writes backend-bound to `auth.me().did`, enforce one preference per follower/subject pair and migrate/remove rows with unverifiable DID provenance. |
| 🟠 P1 | Moderation / reporting | **LN-025:** `ContentReport.content_type` supports posts, trades, profiles and DMs, but not VoiceSpace or PodcastEpisode. The AI moderation pipeline likewise has no live-space/podcast content type. Users have no dedicated report workflow for abusive live titles, harmful external links, live audio or podcast metadata/audio. | Add reportable `voice_space` and `podcast_episode` resources with host/episode IDs, optional timestamp/evidence, safe staff playback controls and human moderation. Add deterministic URL/domain abuse checks before discovery/push. |
| 🟠 P1 | Abuse throttling | **LN-026:** Go Live creates VoiceSpace directly in the browser. No server rate limit, bot-risk gate, concurrent-live invariant or anti-spam policy was found on creation. Direct entity callers bypass normal UI intent entirely. | Create spaces through a backend command that applies account enforcement/bot checks, per-user rate limits, one active Space per host, title/tag validation and idempotency. |
| 🟠 P1 | WebRTC reachability | **LN-027:** The in-platform mesh uses Google STUN only and explicitly has **no TURN**. Symmetric NAT, enterprise Wi-Fi and restrictive carrier networks can fail completely. | Deploy authenticated TURN/TURNS with bounded credentials and regional redundancy, or use a proper SFU. Add connectivity telemetry without logging SDP/private IPs. |
| 🟠 P1 | WebRTC error UX | **LN-028:** `SpaceMesh` exposes `onIceFail`, but `InPlatformSpace` does not pass a handler. Failed/disconnected peer connections can silently leave listeners unable to hear a speaker. | Surface peer connection state, retry/reconnect and a clear “audio connection failed” action. Log aggregate failure reasons, not raw ICE details. |
| 🟠 P1 | Mesh scalability | **LN-029:** `MAX_SPEAKERS = 6` is only a warning. Extra speakers are still promoted/connected and the peer mesh grows O(n²), creating browser/network resource exhaustion potential. | Enforce a server-side stage cap and a host-visible queue. For larger rooms use an SFU rather than unrestricted mesh growth. |
| 🟠 P1 | Audience/count consistency | **LN-030:** Participant reads use different caps (`200` in room UI, `500` in `endSpace`, `1000/3000` in achievement jobs). `endSpace` computes “peak” from the final currently-active listener count and a `peak_listener_count` field that is not maintained live. Displayed, stored and achievement counts can therefore disagree. | Maintain authoritative join/leave events and server counters. Track actual peak over time, paginate participant management, and make achievements consume the same reconciled event/count model. |
| 🟠 P1 | Recording segments | **LN-031:** If recording is stopped and later restarted, only one `partialRecordingRef` is retained. At final end, an active later segment takes precedence, so earlier recorded material can be silently lost instead of concatenated. | Store explicit recording segments with start/end/duration, upload durably, and require host review/merge before podcast publication. |
| 🟠 P1 | Recording resilience | **LN-032:** Recording is produced entirely in the host browser. A crash, tab kill, network loss or device sleep can destroy the in-memory MediaRecorder chunks before upload. | Treat browser recording as draft capture only or use server/SFU recording. Upload chunks incrementally with resumable identifiers and show clear recovery state. |
| 🟠 P1 | End transaction | **LN-033:** The client uploads audio and creates `PodcastEpisode` **before** calling `endSpace`. If the authoritative end call fails, a public podcast can exist for a Space that is still live, and retries can create duplicates. | Use one idempotent backend finalisation workflow: end Space first/atomically create recording draft, then optional publish. Use stable idempotency keys and reconciliation. |
| 🟠 P1 | Podcast authority | **LN-034:** PodcastEpisode owners can rewrite `did`, host identity, `source_space_id`, `play_count`, audio URLs and federation metadata. `SaveAsPodcastModal` also does not server-validate that the referenced source Space belongs to the publisher. | Publish/update episodes through backend endpoints that derive host identity, validate source ownership and media references, and make counters/federation fields backend-only. |
| 🟠 P1 | Podcast analytics | **LN-035:** The global player increments `PodcastEpisode.play_count` directly from the listener browser. RLS allows update only to the episode owner/admin, so listens to other people's episodes normally fail to increment; conversely the owner can set any play count. Help claims play count tracks listens. | Record listens through an authenticated backend event with dedup/rate policy and compute aggregate play count server-side from trusted events. Keep private resume progress separate. |
| 🟠 P1 | Podcast publishing model | **LN-036:** Every PodcastEpisode is public-read and the RSS endpoint publishes every matching row. There is no draft/private/unlisted state, explicit RSS opt-in or publish status separate from row existence. | Add `draft`, `published`, `unlisted`, `removed` lifecycle plus RSS/federation publication flags. Only explicitly published, eligible episodes should enter public discovery/RSS/PDS. |
| 🟠 P1 | Podcast content rating | **LN-037:** RSS hard-codes `<itunes:explicit>false</itunes:explicit>` for every episode although users can publish arbitrary live audio and there is no episode content-rating field. On a service used by teenagers this can incorrectly label mature content as non-explicit. | Add content-rating/explicit metadata with host declaration and moderator override. Default unknown content conservatively until classified and emit correct feed metadata. |
| 🟠 P1 | RSS moderation | **LN-038:** `podcast-rss-feed` uses service role and does not filter suspended/shadow-banned hosts, removed content or moderation decisions. An externally subscribed feed can continue distributing content the app has hidden. | Resolve effective account/content eligibility server-side before RSS output. Provide tombstone/removal semantics and cache invalidation guidance. |
| 🟠 P1 | VoiceSpace Lexicon drift | **LN-039:** Canonical file `base44/lexicons/org.swappulse.voiceSpace.json` is **revision 2** and includes `spaceMode` plus `recordingEnabled`, but `base44/shared/lexiconRegistry.ts` still registers **revision 1** described as a manual external stream and omits those fields. | Generate the deployable registry from canonical Lexicon JSON or add a CI equality check. Register revision 2 before claiming cross-instance in-platform interoperability. |
| 🟠 P1 | Federation mapping | **LN-040:** `firehoseMappers.mapVoiceSpaceFields` and the VoiceSpace outbound builder omit `spaceMode` and `recordingEnabled`. Even if revision 2 is registered, imported/reconciled records lose the fields needed to distinguish an in-platform room from an external stream. | Add versioned inbound/outbound mappings for all revision-2 fields and round-trip tests: local -> PDS -> firehose -> local must preserve space mode and recording metadata. |
| 🟠 P1 | Podcast federation | **LN-041:** Automatically created PodcastEpisodes in `InPlatformSpace`/`ExternalStreamSpace` are stamped locally but never call `bridgePodcastEpisode`; Help states episodes are mirrored to the host PDS. The separate Save-as-Podcast modal does bridge. | Make publication one server workflow that persists locally and publishes/reconciles PDS delivery consistently. Never have two episode creation paths with different federation semantics. |
| 🟠 P1 | Podcast trimming | **LN-042:** The browser trim routine closes `decodeCtx` and then calls `decodeCtx.createBuffer(...)`; it also calls `src.start()` before `MediaRecorder.start()` and waits for `rec.onstop` without an explicit source-ended -> recorder-stop transition. Trimming can fail/hang and can lose initial audio. | Replace with a tested media-processing pipeline, preferably backend FFmpeg/transcoding with bounded files/jobs. If retained client-side, use a fresh active AudioContext, start recorder before source, stop recorder on source end, and add deterministic tests. |
| 🟠 P1 | Original-audio retention | **LN-043:** Trimming deliberately retains `original_audio_url` indefinitely. There is no visible “delete original” control, retention setting or storage cleanup policy, so material the host intentionally trimmed out remains stored. | Make original retention explicit and time-bounded. Offer “delete original permanently”, apply storage lifecycle rules and explain consequences before deletion/retrim. |
| 🟠 P1 | Delete lifecycle | **LN-044:** Deleting a past VoiceSpace only deletes the VoiceSpace row. It does not remove/link-clean PodcastEpisode, recording blob/original audio, PDS records or participant/signal state. | Implement resource-aware deletion with dependency choices: delete event metadata only, unpublish podcast, delete recordings, or full purge. Reconcile local DB, storage, PDS/RSS and dependent records idempotently. |
| 🟠 P1 | Podcast media trust | **LN-045:** `PodcastEpisode.audio_url` is client-controlled. A modified client can create a public episode pointing at an arbitrary remote URL, causing listeners/podcast apps to fetch third-party tracking or malicious media endpoints. | Accept only server-validated media objects owned by the publisher or a tightly controlled external-media policy. Persist MIME/bytes/hash from trusted storage metadata. |
| 🟠 P1 | Upload validation boundary | **LN-046:** Save-as-Podcast validates audio/video type and 500 MB size only in browser code. Direct entity/API callers bypass this check; auto-record upload also bypasses `assertPodcastMediaUpload`. | Validate stored object ownership, magic bytes, MIME, byte size, duration and codec server-side before publication. Add per-user storage/rate quotas. |
| 🟠 P1 | Chapter/media integrity | **LN-047:** Chapter timestamps and optional card references are client-controlled and not bounded to episode duration or canonical card identity. Invalid chapters are emitted to RSS. | Validate sorted chapter times server-side (`0 <= timestamp < duration`), enforce sensible limits and resolve card references against TCGDex before publication. |
| 🟡 P2 | Pagination | **LN-048:** VoiceSpaces loads at most 200 Spaces and 50 podcast episodes; Past Streams loads 100. There is no cursor/load-more path. Older content silently disappears. | Add cursor pagination/infinite load with stable ordering and explicit end state. |
| 🟡 P2 | Error states | **LN-049:** VoiceSpaces converts load failures into empty arrays, so outages look like “No streams live” / “No recordings”. | Track spaces and podcasts independently with loading/error/retry states. Preserve partial results. |
| 🟡 P2 | Room error state | **LN-050:** SpaceRoom turns any `VoiceSpace.get()` error into “Space not found”, conflating 404 with auth, network and backend errors. | Distinguish not-found, signed-out/forbidden and temporary load failure, with retry and safe fallback. |
| 🟡 P2 | Localisation | **LN-051:** Major Live Now controls are hard-coded English: Go Live modal, room controls, stage labels, recording toasts, Space admin panel, Podcast editor and Past Streams. This conflicts with SwapPulse's nine-language support. | Move all user-facing strings into the i18n catalogue, including ARIA labels, errors and dynamic recording states; test long translations. |
| 🟡 P2 | Modal accessibility | **LN-052:** GoLiveModal, SaveAsPodcastModal, PodcastEditorModal and SpaceAdminPanel use custom fixed overlays rather than the shared accessible Dialog/Sheet primitives. They do not demonstrate focus trapping, Escape handling, `role="dialog"`, `aria-modal` or focus restoration. | Migrate to shared Dialog/Sheet components and add keyboard/screen-reader tests. |
| 🟡 P2 | Player scrubber | **LN-053:** Podcast scrubber is a clickable `div`, not an input/ARIA slider, so keyboard and assistive-technology users cannot seek reliably. | Use a native range control or complete slider semantics with keyboard increments, value text and focus indication. |
| 🟡 P2 | Playback speed | **LN-054:** Playback speed is hidden behind a 500 ms long-press on Play/Pause. It is undiscoverable and not equivalently accessible from keyboard. | Add a visible speed button/menu with 1x/1.5x/2x options and accessible labels. |
| 🟡 P2 | Transcripts / captions | **LN-055:** Published audio has no transcript/caption field or accessible text alternative. Voice-room audio likewise has no caption/transcription surface. | Add optional/assisted transcripts with consent/privacy controls, editable text and clear AI provenance if generated. At minimum support host-provided transcripts/show notes. |
| 🟡 P2 | Audio autoplay failure | **LN-056:** Remote WebRTC audio and podcast playback swallow `.play()` failures. If browser autoplay policy blocks audio, there is no explicit “Tap to hear audio” recovery state. | Detect blocked playback and surface a user-gesture resume control. |
| 🟡 P2 | Podcast duration | **LN-057:** SaveAsPodcast probes the uploaded URL for only four seconds and silently falls back to `duration_seconds = 1`. Bad metadata then affects UI, RSS duration, chapters and enclosure calculations. | Derive duration server-side from trusted media metadata/transcoding and reject publication until duration is known. |
| 🟡 P2 | RSS handle lookup | **LN-058:** Handle-based RSS lookup lists only the newest 500 PodcastEpisodes globally then filters client-side. A host's valid older feed can return incomplete/404 if their episodes fall outside that global window. | Query by normalised host handle with an indexed field or resolve handle -> DID and query by DID. |
| 🟡 P2 | RSS item cap | **LN-059:** DID-based RSS emits at most 200 episodes with no paging/archive feed strategy. | Define feed retention/archive policy and expose stable paged archives if history can exceed the active feed window. |
| 🟡 P2 | RSS language | **LN-060:** RSS hard-codes `<language>en-us</language>` although SwapPulse supports nine languages and episode language is not stored. | Store show/episode language and emit correct BCP-47/RSS language metadata. |
| 🟡 P2 | RSS media metadata | **LN-061:** RSS `enclosure length` is guessed as `duration * 128 * 1024`, not actual bytes, and MIME is inferred from URL suffix. Base44 URLs may not preserve extensions, so clients can receive incorrect enclosure metadata. | Persist trusted byte length and MIME during upload/transcode and emit those exact values. |
| 🟡 P2 | Past-stream stats | **LN-062:** PastStreamsSection labels owner-controlled `viewer_count_estimate` as “peak viewers” instead of using authoritative `peak_listener_count`. | Display mode-specific, server-derived metrics and label external viewer estimates separately from SwapPulse listeners. |
| 🟡 P2 | Help: RTMP | **LN-063:** Help promises “custom RTMP”, but UI/schema accept only HTTP/HTTPS URLs and no RTMP ingest exists. | Remove the RTMP claim or implement a real ingest service; do not advertise unsupported protocols. |
| 🟡 P2 | Help: podcast workflow | **LN-064:** Help says a host ends the Space, opens Save as Podcast, edits and then publishes. Recorded in-platform spaces actually auto-create a public PodcastEpisode on end. | Fix the product architecture to use a draft-first workflow, then make Help accurately describe it. |
| 🟡 P2 | Help: auto-end | **LN-065:** Help says Spaces “auto-end at the planned duration”. Current implementation only lazily ends expired records when `getLiveUsers` happens to run. | Implement deterministic lifecycle reconciliation, then retain the claim. Until then, describe expiry as best-effort rather than scheduled auto-end. |
| 🟡 P2 | Recording policy UX | **LN-066:** Terms say a visible REC indicator means joining constitutes recording consent, while Privacy says the host can then publish the recording. The product does not surface these policy consequences before join or promotion to speaker. | Put concise recording/publication notices in the join flow and speaker-promotion flow, with links to policy and explicit consent where recording is active. |
| 🟡 P2 | Profile migration state | **LN-067:** A profile marked `migration_reverted` disables Edit/Customize but does not disable Go Live. This is inconsistent with the profile being presented as read-only after moving back to Bluesky. | Define whether reverted accounts may create new SwapPulse content. If profile/content creation is meant to be read-only, disable Go Live server-side as well as in UI; otherwise update the migration copy. |
| 🟢 P3 | Terminology | **LN-068:** The same area is labelled **Live Now**, **Live Streams**, **Voice Spaces**, **Space**, **External Stream** and **Podcasts/Recordings** across nav, page title, help and code. The distinctions are meaningful but the hierarchy is unclear. | Standardise product language: e.g. top-level **Live**, modes **Voice Space** and **External Stream**, archive **Recordings & Podcasts**. Use the same terms in nav, Help, notifications and accessibility labels. |

## Executive assessment

Live Now has a strong feature concept but currently lacks an authoritative server-owned event model. The browser is simultaneously trusted to create the live object, choose participant identity/role, mutate lifecycle fields, exchange WebRTC signalling, control recording state, publish podcast records and update engagement counters. That makes security and normal functionality fail in opposite directions: malicious clients can self-elevate, while legitimate host moderation cannot update another participant because RLS blocks it.

The most urgent architectural issue is therefore not a missing button or isolated bug. It is the absence of one backend authority for **space lifecycle + membership + stage permissions + recording/publication**.

## Feature-by-feature audit

### 1. Live discovery and presence

The canonical route is `/spaces`. It presents **Live Now** and **Recordings** tabs and supports platform filtering plus viewer/recency sorting. This works only for external streams because the page defines live items as `status === 'live' && stream_url`. In-platform Voice Spaces intentionally have no stream URL, so they disappear from the very page meant to discover them.

The Home `SpaceBar` repeats the same external-only assumption. The site-wide red live ring uses `getLiveUsers`, but that function labels all rows `sourceType:'stream'` and does not return the Space ID. As a result, in-platform hosts can receive a live ring whose Join action has no URL and no in-app route.

A single backend `get-visible-live-spaces` read model should drive all three surfaces. It should return effective status, mode, stable join target, host identity, moderation/enforcement eligibility and safe metrics.

### 2. Going live

The UI has a sensible two-mode concept:

- **In-platform Space:** browser WebRTC audio stage.
- **External Stream:** user supplies an HTTP(S) URL for Twitch, YouTube, Kick, Facebook Gaming, Rumble or custom/other.

However, the browser directly creates VoiceSpace and stamps identity/federation metadata. There is no server-side one-live-space invariant, rate limit, bot-risk check or authoritative validation of stream destination/platform ownership.

The default recording toggle is on for in-platform rooms. Given the public-podcast behaviour at end, that default is too aggressive and should be changed to off even before the deeper recording redesign.

### 3. Joining, roles and stage management

The stage model includes host, co-host, moderator, speaker and listener, hand raising, self mute, host mute and removal. The UI is reasonably complete, but the permission model prevents it from being trustworthy:

- the joining user owns their participant row and can set its role/DID;
- host/mod controls attempt to edit other users' rows directly;
- RLS rejects those target-row writes unless the caller is admin;
- there is no backend uniqueness for one participant per account/Space.

The correct model is server commands with an immutable membership identity and a small set of allowed state transitions. The UI should render authoritative results rather than trying to enforce permissions itself.

### 4. WebRTC transport

The peer mesh has positive foundations: echo cancellation, noise suppression, auto gain control, speaking-level analysers, clean peer teardown and a stated speaker cap.

But production transport needs more work. Signalling records are public, unbounded and spoofable. There is no TURN. Connection failures are swallowed. The six-speaker cap is advisory rather than enforced, and mesh fan-out grows quadratically.

For a community live feature, either deploy authenticated TURN plus a strict small-room cap or move to a real SFU. The checked-in `provisionSpace` still describes a simulated LiveKit room, but the current in-platform implementation does not use it.

### 5. External streaming

External mode should be lightweight: declare a validated stream and send collectors through a safe external-link handoff. Instead it still contains legacy simulated stage behaviour, including fake listeners, fake speaking indicators and local host mic capture that is unrelated to Twitch/YouTube output.

Those simulation artefacts must be removed from production. They are not just cosmetic: the fake participant rows feed achievements and AI/networking data.

### 6. Recording and podcasts

Recording is currently host-browser MediaRecorder output over the mixed WebRTC audio. It can be toggled mid-session and uploaded at end. The concept is workable for a beta, but recording must be treated as sensitive media with a clear consent and publication lifecycle.

Today, ending a recorded room automatically creates a public PodcastEpisode. That conflicts with the documented Save-as-Podcast editing workflow and makes “stop recording/end room” equivalent to “publish publicly to RSS”. The architecture should instead be:

1. capture/upload private recording segments;
2. end room authoritatively;
3. create a private recording draft;
4. review/edit/trim/transcript/consent state;
5. explicitly publish;
6. then expose on profile, RSS and AT Protocol;
7. reconcile unpublish/delete to RSS/PDS/storage.

### 7. Podcast playback and editing

Positive UX features include resume progress, persistent playback across navigation, skip controls, chapter dropdown, speed control, editing, covers and RSS.

The major defects are that `play_count` is not an authoritative counter, the trim routine is unreliable, huge files are decoded fully in browser memory, transcripts are absent, and the sticky player collides with mobile navigation at 640-767px.

For editing, server-side media processing is substantially safer and more predictable than decoding/re-encoding up to 500 MB in the browser.

### 8. RSS distribution

The RSS generator correctly XML-escapes user metadata and produces RSS/iTunes namespace output, but publication eligibility is too broad. Every PodcastEpisode is treated as public/published, explicit is always false, media byte length is estimated, MIME is guessed from the URL and feed language is always English.

RSS is an irreversible-ish distribution surface because directories/cache layers can retain episodes after SwapPulse changes. Publication should therefore be a deliberate state with accurate media and content-rating metadata.

### 9. AT Protocol / decentralisation

VoiceSpace and PodcastEpisode are present in the firehose collection map, which is a good basis for portability. The VoiceSpace Lexicon source, however, has advanced to revision 2 while the deployable registry and mapper/builder logic remain revision 1/external-stream shaped. In-platform semantics therefore do not round-trip.

`SpaceSignal` should **not** be federated or public at all; it is transport metadata, not portable social content. Likewise, raw participation history should have an explicit privacy/interoperability design rather than inheriting public-record assumptions.

### 10. Notifications

Followers can opt into go-live events, which is a useful feature. The implementation should originate from the authoritative server start event, not a general user-callable push primitive. Deep links should always open the SwapPulse Space first so external destinations still get the application's leave-site warning.

The current data model mentions `podcast_episode` notification preference, but no dependable episode-publication notification workflow was found in the audited publication paths.

### 11. Moderation, safeguarding and abuse

Live audio and podcasts currently sit outside the dedicated ContentReport types. That is a significant moderation gap because the feature includes real-time voice, third-party links and public audio distribution.

At minimum, users need report controls for a live room and episode, with a timestamp/context field for audio reports. Staff need the ability to end a room, remove a participant, unpublish an episode and block a malicious external destination through a server-authoritative path.

### 12. Privacy and data rights

Privacy documentation correctly acknowledges WebRTC signalling and recording. The implementation does not yet honour the “ephemeral” signalling claim through an expiry cleanup path. `SpaceSignal` is also missing from account erasure/export.

Recording deletion needs to cover the actual stored file, not only its database row. The same applies to retained `original_audio_url` after trimming and to public PDS/RSS copies.

## Current audit-visible data

On 12 September 2026 the Base44-visible environment returned:

- **VoiceSpace:** 0 rows
- **SpaceParticipant:** 0 rows
- **SpaceSignal:** 0 rows
- **PodcastEpisode:** 0 rows
- **PodcastPlay:** 0 rows

That materially lowers migration risk. The authority, recording and schema model can be corrected before there is visible production Live Now history to reconcile.

## Verified strengths to preserve

- VoiceSpace distinguishes `external` and `in_platform` modes in the live entity schema.
- External stream URLs are constrained to ordinary HTTP(S) at schema/UI level; dangerous schemes are rejected.
- `endSpace` authenticates the caller and verifies they own the Space before service-role lifecycle mutation.
- `provisionSpace` likewise verifies host ownership before changing state.
- In-platform audio requests echo cancellation, noise suppression and auto gain control.
- WebRTC peer objects and local media tracks are explicitly destroyed on cleanup.
- Participant UI has clear host/mod/speaker/listener concepts, hand raising, self mute and host management affordances.
- Recording state has a visible `REC` indicator after the participant is in the room.
- Podcast listen-progress rows are private to their owner.
- Podcast file selection applies browser-side type/size guards, and cover upload rejects SVG.
- Podcast RSS XML-escapes user-supplied metadata.
- Canonical VoiceSpace and PodcastEpisode Lexicon files exist, and both content types have firehose mapping foundations.
- Account deletion at least includes VoiceSpace, SpaceParticipant, PodcastEpisode and PodcastPlay rows, even though signalling/storage/PDS cleanup is incomplete.
- The UI provides chapter marks, persistent playback, resume position, skip controls, trim UI and an RSS feed surface.
- The policy explicitly states recording/publication responsibilities, giving a basis for a stronger explicit consent UX.

## Target architecture

### Authoritative Space model

Create backend-owned operations around the existing VoiceSpace entity or a dedicated `LiveSession` domain model:

- `create-space`
- `start-space`
- `join-space`
- `leave-space`
- `raise-hand`
- `stage-action` (promote/demote/mute/remove/mod/co-host)
- `toggle-recording`
- `end-space`
- `create-recording-draft`
- `publish-podcast`
- `unpublish/delete-podcast`

The backend should derive caller identity, enforce one active membership and one active hosted Space, apply account enforcement/rate limits, and emit immutable audit events for privileged transitions.

### Signalling

Use a participant-scoped ephemeral signalling channel rather than a public entity. If Base44 entity/realtime remains the transport temporarily:

- read only by target/broadcast members of that specific active Space;
- create only by an authenticated active participant;
- server-bound `from_did`/participant ID;
- payload size/type limits;
- TTL measured in minutes;
- automatic cleanup and account-erasure coverage;
- never federate signalling to AT Protocol.

### Recording

Recording consent and publication should be separate concepts:

- recording defaults off;
- explicit consent before joining/speaking in a recording-enabled room;
- host can start recording only when current stage participants are eligible/consenting;
- durable segmented recording with resumable upload;
- end creates private recording draft;
- public podcast publication is a separate deliberate action;
- transcript/content rating/moderation before RSS if enabled;
- retention controls for originals and drafts.

### Federation

Only durable public social objects should federate:

- VoiceSpace public metadata (with revision-2 `spaceMode` semantics)
- explicitly published PodcastEpisode metadata/media reference

Do not federate SDP/ICE, private listening progress or other transport/session secrets. Generate the registry/mappers from canonical Lexicons and prove round-trip tests.

## Required release tests

Before Live Now can be considered release-ready, add automated tests that prove at least:

1. A listener cannot create/update itself as host/mod/co-host/speaker.
2. A host can successfully promote/demote/mute/remove another participant through the backend.
3. A non-host cannot run stage-management actions.
4. One account cannot create duplicate active participation rows for the same Space.
5. `from_did`, participant ID and space membership are server-bound for every signal.
6. A non-member cannot read/send SDP/ICE for a Space.
7. Signals expire/delete automatically and disappear on account deletion.
8. No demo/fake listeners are ever created in production.
9. Community Voice cannot be earned from fabricated participant DIDs.
10. In-platform Spaces appear on `/spaces`, Home live rail and live avatar rings.
11. Clicking an in-platform live ring opens `/spaces/:id`.
12. Auto-end works without relying on a client opening another surface.
13. Profile End uses the same lifecycle path as room End.
14. External stream links pass the leave-site confirmation and platform/domain validation.
15. Go-live push is generated only from a real persisted start event.
16. Notification master pause, quiet hours and per-event preferences are honoured.
17. Recording defaults off.
18. A participant cannot be recorded/published without the configured consent state.
19. Ending a recorded room creates a draft, not a public podcast.
20. Publishing is idempotent and cannot create duplicate PodcastEpisodes.
21. Stop/restart recording preserves or deliberately separates every segment.
22. Host crash/reconnect has a documented recovery behaviour.
23. Speaker cap is enforced, not only warned.
24. TURN/SFU fallback is exercised from restrictive-network integration tests.
25. Podcast media is validated server-side for ownership, magic bytes, size, MIME and duration.
26. Chapter marks must fall within actual duration.
27. Play counts are server-derived and cannot be set by episode owners.
28. Podcast trim completes deterministically on supported browsers/media or uses server media processing.
29. RSS emits correct byte length, MIME, language and explicit rating.
30. Removed/suspended content is excluded from RSS/discovery.
31. VoiceSpace revision-2 fields round-trip through PDS/firehose/reconcile.
32. Federation opt-out blocks VoiceSpace/PodcastEpisode create/update at the canonical boundary.
33. Unpublish/account deletion reconciles PDS records and stored media.
34. `SpaceSignal`, participation and listen history follow documented export/deletion policy.
35. Live/podcast reports reach staff with correct resource/timestamp context.
36. Keyboard-only users can operate player seek, playback speed, modals and stage controls.
37. Screen-reader users receive meaningful live/recording/connection state updates.
38. All Live Now and podcast strings are complete across all nine supported locales.
39. 640-767px player/mobile-nav collision is absent.
40. Exact-release build, lint, typecheck and relevant E2E/security suites pass from the canonical checkout.

## Recommended remediation order

1. **Remove fake participants immediately and invalidate/re-evaluate Community Voice proof derived from them.**
2. **Move participant join/roles/stage moderation to server-authoritative commands.**
3. **Lock down SpaceSignal membership/read/write/TTL and erase existing signals.**
4. **Separate recording from podcast publication, default recording off and add explicit consent.**
5. **Fix Live Now discovery/live-ring routing for in-platform rooms.**
6. **Unify start/end/auto-end lifecycle and counters behind backend endpoints.**
7. **Fix cross-post authorisation and external-link/go-live notification boundaries.**
8. **Add live/podcast moderation and reporting.**
9. **Fix VoiceSpace Lexicon revision drift and round-trip federation mappings.**
10. **Repair podcast authority, play counts, trim pipeline, RSS eligibility/media metadata and deletion/retention.**
11. **Add TURN/SFU strategy and enforce the speaker cap.**
12. **Complete data export/erasure/storage/PDS reconciliation.**
13. **Finish localisation, accessibility and mobile player layout.**
14. **Run the full security/regression matrix from the exact deployable checkout.**

## Release decision

SwapPulse **Live Now / Voice Spaces & Podcasts must not be considered release-ready** while the unresolved P0 findings remain.

The most urgent risks are the participant privilege model, non-functional host moderation, public/spoofable WebRTC signalling, synthetic attendance feeding proof-based achievements, recording/publication consent, cross-post authorisation and incomplete erasure. Fixing those authority boundaries will also simplify many secondary defects because discovery, counters, notifications, achievements and federation can all consume the same trusted live-session state.

No functional application code or user data was changed during this audit. The only project change is this audit report.