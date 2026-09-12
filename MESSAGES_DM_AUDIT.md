# SwapPulse Messages / Direct Messages Audit

**Audit date:** 12 September 2026  
**Scope:** 1:1 Messages UI, friendship gating, conversation creation, DirectMessage storage, end-to-end encryption, key lifecycle, read/unread state, realtime delivery, notifications, moderation/reporting, abuse controls, AT Protocol privacy boundaries, data export/deletion, account enforcement, mobile/accessibility behaviour and regression coverage.  
**Status:** **Complete with residual verification actions**  
**Overall score:** **30/100 - High Risk / Needs Remediation**  
**Release status:** **NOT RELEASE READY**

## Findings

| Priority | Area | Finding | Required action |
| --- | --- | --- | --- |
| 🔴 P0 | Conversation authorisation | **DM-001 - The “friends only” conversation rule is enforced by UI, not by the write boundary.** `MessageButton` calls `check-friendship`, but `startOrFindConversation()` then creates `Conversation` directly from the browser. `Conversation` create RLS only binds the creator `did` to the authenticated user; it does not prove the target is an accepted friend, that the target is a real user, that sender and recipient differ, or that `participant_dids` is exactly the authorised pair. A caller can bypass the button and create an unsolicited conversation with any DID. | Move conversation creation to a backend function. Derive the caller DID from the session, load an authoritative accepted friendship, validate the target/current account and exact participant pair, reject self-conversations, and atomically reuse/create one canonical 1:1 conversation. Block direct browser Conversation creation. |
| 🔴 P0 | Message authorisation / E2EE boundary | **DM-002 - DirectMessage can be created directly by an authenticated browser without proving conversation membership, friendship or ciphertext.** DirectMessage create RLS only binds `data.did` to the caller. It does not verify `conversation_id`, `recipient_did`, friendship, the other participant, `bridged:false`, or that `body` begins with the mandatory `e2ee:` envelope. A caller can bypass `sendDirectMessage()` and persist a plaintext or malformed message addressed to another DID, contradicting the entity description that plaintext is rejected before persistence. | Make DirectMessage create backend-only. The server must load the Conversation, prove current membership and friendship/policy eligibility, derive the recipient, require a versioned ciphertext envelope, enforce local-only flags, apply enforcement/rate limits, and use an idempotency key. Never accept recipient or sender metadata as free-form authoritative fields. |
| 🔴 P0 | Friendship trust boundary | **DM-003 - The Friendship records used to authorise DMs are themselves client-forgeable.** `Friendship` create RLS checks only `created_by_id`; it does not bind `did` to the caller or force an initial `pending` state. Owners can also update their own rows. `check-friendship` treats a single matching row with `status:'accepted'` as accepted. An authenticated user can therefore create or mutate a friendship row to make themselves appear accepted without the other collector's approval. The wider codebase also has inconsistent semantics: `AddFriendLink` describes friendship as two accepted records, while invite flows deliberately create one accepted record. | Replace direct Friendship writes with backend request/accept/remove operations. Define one authoritative state model, bind both DIDs to authenticated actors, require recipient action for ordinary acceptance, preserve explicit invite-link exceptions server-side, and make `check-friendship` consume the canonical relationship projection. |
| 🔴 P0 | E2EE key lifecycle | **DM-004 - The current one-public-key-per-DID design is incompatible with device-local private keys and can make message history undecryptable.** Each browser/device generates its own ECDH private key, but `publishPublicKey()` overwrites the current `DmPublicKey` for the DID. A second device therefore replaces the first device's public key. The ciphertext contains no sender/recipient key ID, so old messages and messages sent from an older device cannot select the historical key used to encrypt them. Normal multi-device use or key regeneration can permanently break decryption. | Introduce versioned per-device key records with immutable key IDs, creation/revocation timestamps and key history. Put sender and recipient key IDs plus an envelope version into every message. Decide on secure multi-device key agreement/backup or explicitly bind conversations to devices until a real design exists. Migrate/retire the mutable singleton key safely before real DM data accumulates. |
| 🔴 P0 | E2EE bootstrap | **DM-005 - First-contact encrypted messaging has a key bootstrap deadlock in the advertised user flow.** A recipient public key is published only by `MessageThread` after a conversation is opened. Visiting the empty Messages page does not publish a key. A sender can create an empty conversation but cannot encrypt the first message until the recipient manually discovers and opens that empty thread, then the sender retries. The help text says opening Messages enables DMs and the sender can simply type and send, which is not true. The live dataset currently has zero `DmPublicKey`, `Conversation` and `DirectMessage` records. | Provision/publish a recipient encryption key as part of an authenticated messaging-enrolment step before first contact, such as on Messages-page entry or account/device messaging setup. Expose key readiness before allowing Message, and test the complete brand-new User A -> brand-new User B first-message journey without manual coordination. |
| 🔴 P0 | Erasure / privacy | **DM-006 - Account deletion does not delete Conversation, DirectMessage or DmPublicKey records despite the Privacy Policy promising DM ciphertext removal.** `delete-account` omits all three entities from `ENTITY_CLEANUP`, while the Privacy Policy states account deletion removes direct messages from SwapPulse servers. Once real private conversations exist, deletion can leave ciphertext and relationship metadata after the account is gone. | Add Conversation, DirectMessage and DmPublicKey to deletion using both ownership and participant/recipient identifiers. Delete or appropriately tombstone both sides' relationship metadata according to the product's retention policy. Add post-deletion assertions proving no DM body, key or conversation metadata remains for the deleted account. Update policy only if a legally justified retention exception is intended. |
| 🟠 P1 | Story replies | **DM-007 - Story replies bypass the friends-only MessageButton gate.** `StoryViewer.sendReply()` calls `startOrFindConversation()` and `sendDirectMessage()` directly without checking friendship. A story viewer can therefore enter the DM path for a non-friend; today encryption may fail if no recipient key exists, but that is accidental, not an authorisation control. | Route story replies through the same backend-authorised DM send operation as normal messages. Enforce the same recipient policy before conversation creation or message persistence. |
| 🟠 P1 | Account isolation | **DM-008 - The E2EE private key is global to the browser origin, not scoped to a SwapPulse account/DID.** IndexedDB uses a fixed `KEY_ID='private-key'`. Logging into another account in the same browser reuses the same private/public key pair, linking separate identities cryptographically and violating account isolation. Logout and account deletion do not clear that IndexedDB key. | Scope private keys by immutable account ID + device ID, never a global origin key. On account switch, load only that account's key material. Provide deliberate local key deletion on account deletion/logout where appropriate and prevent one key being published under multiple unrelated DIDs. |
| 🟠 P1 | Key authenticity | **DM-009 - Recipients' public encryption keys have no cryptographic identity binding or continuity check.** Clients trust the latest `DmPublicKey` returned by the application database. There is no identity signature, safety number/fingerprint, previous-key continuity proof or key-change warning. A compromised service-role/backend could substitute public keys without either user detecting it, so the current legal/help claim that SwapPulse “cannot read your messages, ever” is stronger than the cryptographic trust model supports. | Sign device encryption keys with an identity-controlled key or another independently verifiable mechanism, pin known keys, show key-change warnings/safety fingerprints, and document the honest-server trust assumptions until independently verifiable key authenticity exists. |
| 🟠 P1 | Ciphertext/key versioning | **DM-010 - The E2EE envelope cannot identify which key version/device was used.** Messages store only `e2ee:<iv>:<ciphertext>`. There is no version, sender key ID, recipient key ID or algorithm identifier. Even if historical keys were retained tomorrow, clients could not deterministically choose the correct key for an existing message. | Define a versioned envelope containing protocol version, sender device/key ID, recipient device/key ID, IV/nonce and ciphertext, with a migration strategy for the current format. |
| 🟠 P1 | Public-key state | **DM-011 - DmPublicKey has no uniqueness, device model, revocation or key history.** Users may create multiple rows for the same DID, while reads simply select the newest record. Concurrent devices/requests can race and silently change the effective key. | Replace the singleton/latest-row convention with explicit per-device immutable key IDs, uniqueness constraints, active/revoked state and deterministic resolution rules. |
| 🟠 P1 | Send consistency | **DM-012 - Message persistence and conversation metadata update are separate non-transactional client operations.** After DirectMessage create, the browser fire-and-forgets a `Conversation.update()` for last-message ordering/preview. A successful message plus failed metadata update leaves the conversation stale or incorrectly ordered; the recipient may not see it move to the top. | Perform message creation and conversation projection update inside one trusted backend transaction/workflow with idempotency. Rebuild conversation metadata from authoritative messages if reconciliation is needed. |
| 🟠 P1 | Conversation integrity | **DM-013 - Either participant can directly forge last-message metadata.** Conversation update RLS permits creator or recipient updates, while `last_message_at`, `last_message_preview`, `last_message_did` and `description` lack field-level admin locks. A participant can alter ordering/unread cues without sending a message. | Make derived conversation metadata backend-only. Participants should not directly update projection fields; only the authoritative message send/read service should do so. |
| 🟠 P1 | Conversation uniqueness | **DM-014 - 1:1 conversation creation is race-prone and has no canonical unique pair.** `findConversation()` performs two client reads followed by create. Simultaneous starts from both users or devices can create duplicate conversations for the same pair. | Create an atomic backend `getOrCreateConversation` using a deterministic pair key, e.g. hash/sorted immutable account IDs, with a uniqueness guarantee and idempotent retry. |
| 🟠 P1 | Participant identity UI | **DM-015 - The recipient side displays the wrong conversation partner metadata.** Conversation stores only `recipient_name`, `recipient_handle` and `recipient_avatar` supplied when the creator targets someone. Both participants render those same fields. For the recipient, the header/list therefore show their own name/avatar rather than the creator's. | Store participant IDs only as authoritative relationship state and resolve the “other participant” profile dynamically, or store symmetric participant projections keyed by DID. Test both creator and recipient views. |
| 🟠 P1 | Message history | **DM-016 - Threads stop at the oldest 200 messages, making newer history inaccessible.** `MessageThread.refresh()` requests `created_date` ascending with `limit=200` and has no cursor. Once a conversation exceeds 200 rows, the query can return the earliest 200 and omit newer messages, including the actual latest messages. | Use cursor pagination from newest backwards, load the newest page initially, preserve scroll position when fetching older pages, and verify no gaps/duplicates beyond 200 messages. |
| 🟠 P1 | Unread state | **DM-017 - Conversation-list unread dots depend on a field that does not exist.** `ConversationList` compares `c.last_read_at` with `last_message_at`, but `Conversation` has no `last_read_at` field and `mark-dm-read` never updates one. An incoming conversation can therefore continue showing its unread dot after the DirectMessage rows are marked read, while the nav badge says zero. | Define a real per-participant read checkpoint or derive unread state from DirectMessage records. Do not reference an undeclared field. |
| 🟠 P1 | Notification idempotency | **DM-018 - The New Message Notifications workflow has no message idempotency key.** Every workflow invocation creates another Notification and dispatch attempt. Retry/replay of the same DirectMessage event can produce duplicate inbox entries and pushes. | Use `message_id` as a unique notification event key and make the producer insert-once/idempotent. Add workflow retry tests. |
| 🟠 P1 | Notification identity integrity | **DM-019 - DM notification display identity comes from client-controlled message metadata.** DirectMessage create binds `did` but not `author_name`, `author_handle` or `author_avatar`; `notify-new-message` trusts those fields for the visible sender name/avatar. A caller can make a notification visually impersonate another collector even though the underlying DID is theirs. | Derive sender presentation from the authoritative user/profile record at notification time. Never trust message-supplied display metadata as identity. |
| 🟠 P1 | Notification preferences | **DM-020 - The visible “Direct messages” notification toggle does not map to the event actually dispatched.** Settings use event key `direct_message`, while `notify-new-message` dispatches type `message`. Unknown event types default enabled in the dispatcher, so disabling Direct messages does not reliably disable DM push. | Use one shared notification event enum/mapping; make the UI setting and producer both use the same canonical DM event type and test it. |
| 🟠 P1 | Pause/privacy controls | **DM-021 - New-message in-app notifications are created before the central recipient filter is applied.** `notify-new-message` writes a Notification row first, then calls the dispatcher. A user with “Pause all notifications” can still receive a persistent in-app DM notification even if push is filtered. | Apply master pause/channel/privacy policy before the Notification record is written, using the same central notification service for both in-app and push delivery. |
| 🟠 P1 | Abuse controls | **DM-022 - The bot-protection system defines DM rate limits but the real DM write path never uses it.** `botGuard.ts` defines `dm` soft/hard thresholds, yet DirectMessage is created straight from the browser. Those limits and human challenges do not protect actual DMs. | Put DM sends behind a backend endpoint that invokes bot/rate controls without inspecting plaintext. Rate-limit by authenticated account, recipient pair and device/IP risk metadata while preserving message confidentiality. |
| 🟠 P1 | Enforcement | **DM-023 - Suspended/enforced users are not blocked at the DM write boundary.** Because Conversation/DirectMessage writes are direct entity operations, they do not consult AccountStatus/enforcement policy. Client-side navigation restrictions are not an authoritative write control. | Enforce account status in the backend conversation/send operation. Suspended/blocked accounts must be rejected server-side regardless of browser UI. |
| 🟠 P1 | User safety | **DM-024 - There is no first-class block or mute control for direct messages.** No DM block/mute entity or control was found, and no general user-block primitive was found in the relevant backend. This is especially significant while the current write boundary can be bypassed for unsolicited contact. | Add backend-enforced user blocking and conversation muting. A block must prevent new conversations/messages and notifications in both directions according to product policy; muting should suppress alerts without changing access. |
| 🟠 P1 | Abuse reporting | **DM-025 - A privacy-preserving DM report backend exists but normal message UI provides no report action.** `submit-dm-report` correctly verifies the caller is a participant and does not decrypt the message, but MessageBubble/MessageThread never render `ReportDialog`. Users cannot reach the protection from the actual DM experience. | Add per-message Report UI, explain that moderators cannot read E2EE content unless the reporter voluntarily supplies evidence, and preserve the participant check. |
| 🟠 P1 | Data portability | **DM-026 - The GDPR/CCPA export is incomplete for messaging.** `export-my-data` exports Conversation and DirectMessage only by `created_by_id`, so it includes conversations/messages the user created/sent but omits conversations where they are the recipient and messages they received. It also omits DmPublicKey state. | Export all records in which the user is a participant/recipient as well as owner, deduplicate them, include public-key/device metadata, and clearly identify ciphertext as encrypted content. |
| 🟠 P1 | Admin erasure | **DM-027 - Moderator/admin force-delete cleanup also omits Conversation, DirectMessage and DmPublicKey.** The enforcement cleanup list does not remove private messaging state for an account forcibly deleted for cause. | Extend force-delete cleanup with the same messaging erasure rules and post-condition tests as user-initiated account deletion. |
| 🟠 P1 | Legacy privacy UI | **DM-028 - The active profile DataPrivacy tool promises to delete/export “messages” but its entity list contains neither Conversation nor DirectMessage.** `ThemeTabContent` still renders this component. Users can be told their messages were exported/deleted when they were not. | Remove the legacy client-side privacy tool in favour of the authoritative backend Data & Rights flow, or make it use the same complete export/deletion service and result verification. |
| 🟠 P1 | Privacy documentation / federation | **DM-029 - Current privacy/lexicon documentation contradicts the secure local-only federation policy.** `federationPolicy.ts` correctly marks `org.swappulse.conversation` and `org.swappulse.directMessage` as NEVER_FEDERATE, but the Privacy Policy says DM ciphertext is “mirrored to your PDS”, and both legacy Lexicons describe DM/conversation records as mirrored to AT Protocol. AT Protocol repositories are public and verifiable, so those stale statements describe a materially less-private architecture than the implementation. | Correct the Privacy Policy, Help/Terms where needed, and lexicon descriptions to state DMs are local application data and never public-repo records. Mark legacy lexicons non-publishable/deprecated if retained for compatibility. Keep federationPolicy as the mandatory boundary. |
| 🟠 P1 | Relationship cleanup | **DM-030 - Friendship cleanup uses the wrong participant field.** Both `delete-account` and `enforcement` list Friendship extra cleanup as `subject_did`, but the schema uses `friend_did`. Relationships in which the deleted/enforced account is the friend target can therefore survive cleanup. | Replace `subject_did` with `friend_did`, cover both `did` and `friend_did`, and add deletion/enforcement regression tests. |
| 🟠 P1 | Send idempotency | **DM-031 - Direct message creation has no client/server idempotency or replay key.** If the create succeeds but the response is lost, a retry encrypts with a new IV and creates a second logically identical message. | Generate a client message ID/idempotency token before encryption and make the server accept it exactly once per sender/conversation. |
| 🟠 P1 | Regression coverage | **DM-032 - No DM/E2EE-specific automated tests were found.** Searches of the current Base44 test source found no Conversation, DirectMessage or DmPublicKey tests, despite critical RLS, key-lifecycle, deletion and notification behaviours. The connected sandbox snapshot also does not expose a runnable package/test manifest for executing an end-to-end suite. | Add unit tests for envelope/key selection, integration tests for RLS/backend authorisation, adversarial friendship/send tests, multi-device/account-switch E2EE tests, deletion/export tests, workflow idempotency tests and browser-level first-message tests. |
| 🟡 P2 | Private-key hardening | **DM-033 - The Web Crypto private key is generated as extractable.** `generateKey(..., true, ['deriveKey'])` permits export of the private key material. This weakens defence against same-origin script compromise compared with a non-extractable CryptoKey. | Generate private ECDH keys non-extractable where browser storage/support permits, and threat-model XSS/browser compromise separately. |
| 🟡 P2 | Forward secrecy | **DM-034 - Static long-term ECDH has no forward secrecy or ratcheting.** The pair derives the same long-lived AES-GCM key from two long-term device keys. Compromise of a long-term private key can endanger historical ciphertext associated with that key. | For a stronger privacy claim, adopt an established audited messaging construction with per-session/message key evolution (for example an appropriate ratchet/prekey design) rather than inventing custom cryptography. |
| 🟡 P2 | Ciphertext context binding | **DM-035 - AES-GCM does not authenticate message metadata as additional data.** Conversation ID, sender DID, recipient DID and key IDs are not included as AAD, so the ciphertext itself is not cryptographically bound to its application context. | Include immutable context fields as AES-GCM additional authenticated data in the versioned envelope and reject context mismatch. |
| 🟡 P2 | Notification privacy/UX | **DM-036 - New-message notifications send the E2EE ciphertext prefix/content as the preview.** `notify-new-message` slices `message.body` and passes it to Notification and push. Plaintext is not leaked, which is good, but ciphertext is unnecessary disclosure to push infrastructure and unreadable to users. | Use a fixed privacy-preserving preview such as “Encrypted message” and never include ciphertext in notification payloads. |
| 🟡 P2 | Dead notification integration | **DM-037 - The client still calls `notify-interaction` with unsupported action type `message`.** `dmBridge.sendDirectMessage()` makes this call after send, but `notify-interaction` rejects `message`; the real notification relies on the workflow. This creates avoidable errors and two conceptual producers. | Remove the dead client call and keep a single idempotent backend New Message producer. |
| 🟡 P2 | Legacy inbound-DM code | **DM-038 - `firehose-ingest` still executes a stale `syncInboundDms()` path built around public-repo DM assumptions.** The collection scan now correctly skips private DM collections, but the function still searches local unlinked DMs with `conversation_ref`, updates them, and attempts the same unsupported `notify-interaction('message')` call. | Remove or quarantine the obsolete inbound-PDS DM reconciliation path after verifying legacy data migration needs. Private local DMs should have one local reconciliation service, not firehose semantics. |
| 🟡 P2 | Conversation pagination | **DM-039 - Conversation list is capped at 100 created + 100 received rows with no cursor.** Older conversations can disappear from the list as usage grows. | Add server/cursor pagination using a canonical participant query and deterministic last-message ordering. |
| 🟡 P2 | Deep links | **DM-040 - `/messages/:conversationId` only opens if the conversation is already present in the capped list.** A valid authorised older conversation outside the first list window renders the generic “select a conversation” state instead of loading by ID. | Resolve the route ID through an authenticated backend membership lookup independently of the list page. |
| 🟡 P2 | Unread badge | **DM-041 - Navigation unread count silently caps at 200.** `useUnreadDMCount()` fetches at most 200 unread DirectMessages and displays `items.length`. | Add a server-side count or display `200+` once capped. |
| 🟡 P2 | New-conversation UX | **DM-042 - Help says users can open Messages and start a new conversation, but the Messages page has no New Message/search composer.** The only normal entry point is a profile Message button (plus story reply). | Add an authorised New Message picker/search flow or correct the help text to match the supported profile-only workflow. |
| 🟡 P2 | Conversation management | **DM-043 - Messages has no search or archive lifecycle controls.** Long-lived users cannot search conversations or archive old ones; mute is also absent but is separately covered as a safety control. | Add server-compatible search/participant filtering and optional archive state without exposing message plaintext to the server. |
| 🟡 P2 | Conversation removal | **DM-044 - Recipients cannot remove a Conversation record from their own view.** Conversation delete RLS permits creator/admin only. There is no local “leave/remove from inbox” state for the other participant. | Add participant-local hidden/archived state or an explicit leave/delete-for-me model. Do not hard-delete the counterparty's history without clear semantics. |
| 🟡 P2 | Read receipts UX | **DM-045 - A `read` boolean is stored but the sender UI exposes no delivered/read state.** Users cannot tell whether their message reached or was opened, while the system is already mutating read state. | Either expose clear privacy-conscious sent/delivered/read indicators or remove sender-visible semantics from the product definition. |
| 🟡 P2 | Key-management UX | **DM-046 - Users have no key/device management or readiness view.** There is no way to see whether encrypted messaging is enabled on this device, inspect a fingerprint, see key age/change, revoke a lost device or understand which device can decrypt a conversation. | Add a Messaging Security section showing device key state, fingerprints/key changes and safe revocation/recovery semantics once the key architecture is fixed. |
| 🟡 P2 | Internationalisation | **DM-047 - Core thread UI is hard-coded in English despite SwapPulse's translated Messages page shell.** Composer placeholder, encryption states, errors, empty-thread copy and several controls bypass the i18n provider. | Move all DM strings into the supported translation dictionaries and test the nine supported interface languages. |
| 🟡 P2 | Accessibility | **DM-048 - Incoming messages are not announced to assistive technology.** The live-updating message container has no `aria-live`/log semantics, so screen-reader users may not know that a new DM arrived while the thread is open. | Implement an accessible chat log pattern with appropriate `role="log"`, `aria-live` behaviour and focus handling without repeatedly announcing the full thread. |
| 🟡 P2 | Mobile viewport | **DM-049 - The Messages shell uses `100vh` rather than dynamic viewport units.** On mobile browsers/PWA keyboard and browser chrome changes can cause the thread/composer to be obscured or oversized. | Use `100dvh`/safe-area-aware sizing and test virtual-keyboard behaviour on Android/iOS PWA layouts. |
| 🟡 P2 | Product documentation | **DM-050 - Key-loss documentation understates the current key-rotation problem.** Help says a new browser/device creates a fresh key and “new conversations will work fine”, but publishing that fresh key replaces the DID's current public key and can also break existing peer decryption/key selection. | Rewrite messaging help after implementing versioned device keys. Until then, explicitly warn that switching devices/key regeneration is not safely supported for ongoing conversations. |

## Priority summary

- **P0:** 6 unresolved release blockers
- **P1:** 26 high-priority defects
- **P2:** 18 medium-priority defects
- **P3:** 0
- **Total:** 50 findings

## Score breakdown

| Category | Score | Maximum | Notes |
| --- | ---: | ---: | --- |
| Authorisation and trust boundaries | 3 | 20 | UI gating exists, but conversation/friend/message writes remain client-trusting. |
| E2EE design and key lifecycle | 6 | 20 | AES-GCM/ECDH is real and plaintext fails closed in the normal helper, but device/key lifecycle and authenticity are not production-safe. |
| Privacy, erasure and portability | 4 | 15 | DMs are correctly kept off public AT repos, but deletion/export and policy text are inconsistent. |
| Reliability, consistency and read state | 4 | 15 | Realtime foundation exists, but non-transactional sends, caps and unread drift are substantial. |
| Safety, moderation and abuse resistance | 3 | 10 | Participant-checked reporting backend is good; blocking, DM rate enforcement and report UX are missing. |
| Notification integration | 3 | 8 | Workflow exists, but preference mapping, idempotency, ciphertext previews and dead paths need repair. |
| UX, mobile, accessibility and i18n | 5 | 8 | Responsive 1:1 UI is understandable, but first-contact bootstrap, wrong partner identity and missing management features hurt usability. |
| Automated regression coverage | 2 | 4 | No dedicated DM/E2EE regression suite found in the connected source. |
| **Total** | **30** | **100** | **High Risk / Needs Remediation** |

## Release gate

Messages / DMs should remain **NOT RELEASE READY** until at minimum DM-001 through DM-006 are fixed and adversarially regression-tested. The most important architectural change is to stop treating Conversation, Friendship and DirectMessage as ordinary browser-writable entities. A trusted backend messaging service should establish the participant pair, authorisation, rate/enforcement policy, ciphertext envelope and idempotency before anything is persisted.

## Current production evidence

Read-only entity inspection on 12 September 2026 found:

- **Conversation:** 0 records
- **DirectMessage:** 0 records
- **DmPublicKey:** 0 records
- **Friendship:** 0 records

This means the audit found **no evidence of plaintext DM storage, unauthorised private-message access or abused conversation records in current production data**. It also means the key-bootstrap path has not yet accumulated real user key/message state, so the safest time to repair the architecture is now.

No fake friendship, victim conversation, plaintext DM or forged key was created to demonstrate the vulnerabilities.

## Feature-by-feature verdict

| Feature | Verdict | Notes |
| --- | --- | --- |
| 1:1 conversation list | Needs remediation | Basic desktop/mobile list exists; partner metadata, unread state and pagination are incorrect/incomplete. |
| Starting a conversation | Release blocking | Friends-only decision is client-side and conversation creation is not backend-authorised. |
| Friendship gating | Release blocking | Relationship state can be self-authored/accepted and semantics differ across invite/profile flows. |
| Sending text messages | Release blocking | Normal helper encrypts, but DirectMessage can be created directly without membership or ciphertext enforcement. |
| End-to-end encryption | Strong concept, unsafe lifecycle | ECDH P-256 + AES-GCM with browser-local private key is a useful foundation; key version/device/authenticity lifecycle must be redesigned. |
| First-message bootstrap | Release blocking | Recipient key is not provisioned until an actual thread is opened. |
| Multi-device/account switching | Release blocking/high risk | Singleton public key + device-local/global-browser private key causes decryption/account-isolation failures. |
| Realtime updates | Partial | Entity subscription works, but broad refresh and non-transactional conversation projection reduce reliability. |
| Read/unread | Broken at scale | DirectMessage read boolean works for small sets; conversation dot references nonexistent checkpoint and both read/count paths cap at 200. |
| Push/in-app DM notifications | Needs remediation | Workflow exists but current event mapping, idempotency and privacy controls are inconsistent; wider push VAPID failures are covered in the Notifications audit. |
| Reporting | Backend good, UI missing | Participant check and E2EE-preserving report design are strengths; users cannot access it from the thread. |
| Block/mute | Missing | No authoritative DM/user block or conversation mute control found. |
| Abuse/rate limiting | Not wired | DM thresholds exist in botGuard but direct entity writes bypass them. |
| Data export | Incomplete | Sent/owned DM records only; received messages/conversations and key state are omitted. |
| Account deletion | Release blocking | DM ciphertext/conversation/public-key records are not deleted. |
| Admin force deletion | Incomplete | Same private-message entities omitted. |
| AT Protocol boundary | Good code boundary, stale docs | `NEVER_FEDERATE` is correct; privacy/legacy lexicon text says the opposite. |
| Search/archive/delete-for-me | Mostly missing | No DM search/archive UI; recipient has no remove-for-me lifecycle. |
| Attachments/voice/stickers/reactions | Not implemented | Current direct-message product is text-only. No defect is assigned solely for optional features not promised. |
| Internationalisation/accessibility | Partial | Page shell is translated and controls have useful labels; thread content is largely English-only and live messages lack chat-log announcements. |

## Verified strengths

- New messages sent through `sendDirectMessage()` fail closed if a recipient public key is unavailable or encryption fails; that helper does not intentionally persist plaintext.
- Message bodies use AES-GCM with random 96-bit IVs and an ECDH P-256 derived key.
- The private key is stored client-side in IndexedDB rather than in a Base44 entity.
- DmPublicKey write RLS binds a normal user's key row to their own DID, preventing ordinary users from directly publishing a key under someone else's DID.
- DirectMessage reads are scoped to sender/recipient/admin; ordinary unrelated users cannot read ciphertext rows through the entity API.
- DirectMessage browser updates are admin-only, so recipients cannot rewrite body content while marking read; read mutation is routed through `mark-dm-read`.
- `mark-dm-read` only selects messages whose `recipient_did` is the authenticated user's DID.
- `submit-dm-report` verifies the caller is a participant and deliberately does not decrypt or expose the message body to moderators. It stores only an encrypted-message placeholder plus reporter-supplied details/evidence.
- External links in decrypted message text pass through SwapPulse's shared external-link confirmation behaviour rather than silently navigating away.
- Conversation previews generated by the normal sender helper use the fixed `🔒 Encrypted message` text rather than plaintext.
- `federationPolicy.ts` explicitly includes `org.swappulse.conversation` and `org.swappulse.directMessage` in `NEVER_FEDERATE`, and `firehose-ingest` skips never-federated collections.
- Keeping DMs out of AT repositories is correct: the current AT Protocol repository specification describes account repos as storage for **public** account records whose contents are public/verifiable. Current Bluesky chat functionality is represented by service RPC Lexicons such as `chat.bsky.convo.*`, rather than requiring private message bodies to be public repository records.
- The Message composer has a 2,000-character plaintext UI limit and visible send-failure rollback.
- Navigation exposes a dedicated unread-DM badge and desktop/mobile Messages entry point.

## Recommended remediation order

1. Create one backend-owned messaging service for friend requests/acceptance, get-or-create conversation, send message, mark read, block/mute and delete-for-me.
2. Lock direct browser create/update for Friendship, Conversation and DirectMessage to the minimum safe operations; ideally make these writes backend-only.
3. Define one canonical accepted-friendship model and migrate invite-created relationships into it.
4. Redesign E2EE keys as per-account, per-device, versioned keys with immutable IDs and verifiable identity binding.
5. Add a versioned ciphertext envelope with sender/recipient device-key IDs and authenticated context.
6. Fix first-contact key enrolment so a new recipient can receive the first DM without manually opening an empty thread.
7. Make message create + conversation projection atomic and idempotent.
8. Add account-status, block/mute and bot/rate policy at the backend send boundary.
9. Correct participant display, unread checkpoints and message/conversation cursor pagination.
10. Make New Message notification production idempotent, privacy-filtered and use a fixed encrypted-message preview.
11. Wire the existing E2EE-safe report backend into every message bubble/thread.
12. Fix export, user deletion and force-deletion coverage, including `friend_did` cleanup.
13. Remove stale public-PDS DM code/claims and mark legacy DM lexicons non-publishable.
14. Add a cryptography/authorisation regression suite before any real DM data is encouraged.

## Required regression tests

### Authorisation

- A non-friend cannot create a Conversation by calling the API directly.
- A user cannot create a DirectMessage for a conversation they are not a participant in.
- A user cannot choose a recipient different from the conversation's other participant.
- A user cannot persist a non-versioned/plaintext body through any supported API.
- A user cannot self-create or self-update an ordinary Friendship into accepted state.
- A story reply obeys exactly the same authorisation as a profile Message action.
- A suspended or blocked account cannot create conversations/messages even with handcrafted requests.

### E2EE and device lifecycle

- Two brand-new accounts can complete the first-message journey without manual out-of-band thread opening.
- Device A and Device B for the same account have distinct key IDs and do not overwrite one another.
- Historic messages retain deterministic key selection after adding/revoking another device.
- Switching accounts in one browser never reuses the previous account's private key.
- Key changes produce continuity warnings and cannot be silently substituted without detection under the intended trust model.
- Ciphertext fails authentication if conversation/sender/recipient/key-context metadata is changed.
- Clearing local keys fails safely without overwriting the published key until the user explicitly re-enrols/rekeys.

### Reliability/read state

- A send is exactly-once across network retry/timeout.
- Message create and conversation latest-message projection commit/reconcile together.
- Concurrent first sends produce one canonical 1:1 conversation.
- 1,000-message threads open on the newest page and can paginate to the oldest without gaps.
- More than 200 unread messages are all marked read correctly.
- Conversation list unread and nav unread count agree after opening a thread.
- Direct link to an authorised conversation works even if it is older than the first list page.

### Safety/moderation

- User block prevents new conversations, DMs and DM notifications according to policy.
- Mute suppresses alerts without exposing message content server-side.
- DM bot/rate thresholds are actually enforced at the send endpoint.
- Report action works only for participants and never gives moderators ciphertext/plaintext unless policy explicitly permits reporter-supplied evidence.

### Data rights

- Export includes sent and received messages/conversations plus relevant key metadata, with no unrelated user's data.
- User account deletion leaves zero Conversation/DirectMessage/DmPublicKey records associated with that account under the defined retention policy.
- Admin force-delete has the same DM cleanup guarantee.
- Friendship cleanup covers both `did` and `friend_did`.
- Deleting one account does not erase another participant's unrelated conversations.

### Notifications

- One DirectMessage creates exactly one persistent DM notification across workflow retries.
- DM notification preference disables the actual `message` event.
- Pause-all blocks both in-app and push DM notification delivery.
- Push/notification previews contain only a fixed encrypted-message label, never ciphertext or plaintext.
- Sender name/avatar in a notification comes from an authoritative profile, not message-supplied fields.

## AT Protocol design note

SwapPulse's present **local-only** DM boundary is the correct privacy direction. The current AT Protocol repository specification says account repositories store public account records and their contents are public/verifiable:

- https://atproto.com/specs/repository

Current Bluesky/AT ecosystem code also defines dedicated chat service RPC Lexicons such as `chat.bsky.convo.listConvos` and `chat.bsky.convo.sendMessage` outside the ordinary public-repository record model:

- https://github.com/bluesky-social/atproto/tree/main/lexicons/chat/bsky/convo

If SwapPulse later wants Bluesky-chat interoperability, evaluate an authenticated service/API bridge separately. Do **not** restore `org.swappulse.directMessage` or Conversation publication into public AT repositories merely to obtain federation.

## Audit limitations

- The required Base44 MCP README endpoint returned HTTP 403 from the app sandbox during this audit. The audit therefore used the connected app's actual Base44 source, entity schemas, workflows and read-only production data.
- No destructive exploit demonstration was performed. No fake friendship, victim conversation, plaintext DM or forged encryption key was inserted.
- Production DM/friend/key entities are currently empty, so findings about authorisation, encryption lifecycle and erasure are code-path findings rather than observed exploitation.
- No dedicated DM/E2EE tests were found in the connected Base44 test source, and the sandbox snapshot does not expose a runnable package/test manifest for full browser test execution. The audit is therefore marked **Complete with residual verification actions**, not as a passed release validation.
- The wider Web Push/VAPID outage and general notification trust-boundary findings are documented separately in `NOTIFICATIONS_AUDIT.md`; this report repeats only DM-specific integration consequences.

## Conclusion

SwapPulse's direct-message design has a valuable privacy foundation: the normal send helper encrypts before persistence, private keys stay browser-side, reporting does not decrypt user content, and the federation policy correctly keeps DMs out of public AT repositories. The feature is nevertheless not safe to release in its current form.

The two biggest architectural problems are that **authorisation is trusted to browser-side flows** and **E2EE keys are modelled as one mutable public key per DID while private keys are device-local**. Those issues undermine the friends-only promise, allow plaintext/malformed records through direct APIs, make first contact unreliable and make ordinary device/key changes capable of destroying decryptability. Data-erasure paths also currently contradict the Privacy Policy.

The target architecture should be: authenticated actor -> authoritative friendship/block/enforcement check -> canonical conversation -> versioned device keys -> locally produced authenticated ciphertext envelope -> backend membership/idempotency validation -> atomic message + conversation projection -> privacy-safe notification. That preserves self-sovereignty while moving only trust and routing decisions, never plaintext or privileged encryption secrets, into the Base44 backend.