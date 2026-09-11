# SwapPulse Wallet & Identity Audit

**Audit date:** 11 September 2026  
**Area:** SwapPulse account identity, AT Protocol identity/PDS, Starknet/Cairo identity registry, smart account, wallet signing, recovery, age/assurance verification, chain actions, SWPX/staking, card attestations/NFT minting, faucet, bridge, Proof of Usership, handles, reconciliation, secrets, permissions, testing and governance  
**Overall score:** **46/100**  
**Risk:** **High**  
**Release status:** **NOT RELEASE READY**

## Executive summary

SwapPulse has a substantially stronger wallet and identity architecture than a conventional browser-wallet integration. The Base44 layer does not place privileged relay or verifier keys in browser code. Value-bearing actions use short-lived HMAC-bound drafts, the backend reconstructs exact calldata from server-side intent, verifies the user's Stark signature against the registered device key, applies fixed action/fee limits and sends only a canonical transaction object to the relay. The V2 Cairo IdentityRegistry uses OpenZeppelin Ownable and Upgradeable components, separates registry owner and verifier authority, enforces global account uniqueness, canonical identities, verifier-only attestation, expiry/revocation and global replay protection, and has a one-way V2-verification requirement. Staking independently checks that the caller owns the canonical active verified identity. Private DOB/documents and raw identity evidence are kept off-chain.

The account-security layer is also comparatively strong. Passwordless email login is rate-limited, configured TOTP/WebAuthn factors gate release of the persistent login credential, WebAuthn challenges are signed, origin/RP-bound and consumed, security-factor registration/deletion requires a fresh email step-up, passkey credential IDs are globally de-duplicated, PDS app passwords are encrypted at rest, and the old wallet/link/meta-transaction schemas are quarantined behind administrator-only permissions.

The system is nevertheless **not wallet/identity release ready** because several value and identity state machines treat transaction submission as chain finality, and the card bridge has an on-chain asset-recovery gap. `mint-card` marks a card NFT permanently `MINTED` as soon as the relay returns a transaction hash, then skips the reconciler state it would need to prove that mint. Card bridging burns the appchain NFT; the Cairo `refund()` path does not restore a burned card and says a privileged relay should re-mint it later. The Base44 bridge flow additionally marks the local card `BRIDGED_OUT` before source-chain confirmation and does not record the outbound nonce required by its own reconciler. These are release-blocking because local wallet state can diverge from the chain or, in the bridge failure case, a user asset can be destroyed without an atomic trustless refund.

Recovery has a separate release blocker: the browser deletes its current controlling private signer **before** the recovery proposal has successfully been accepted on-chain. A transient relay/network/MFA/proposal failure can therefore erase the device's still-valid key before the chain has committed to rotating it.

The two identity anchors also need hardening. AT Protocol link mode does not enforce global uniqueness of `User.did`, so the same authenticated DID can be bound to multiple Base44 accounts; DID-based account lookup then becomes ambiguous. On the Starknet side, value actions trust saved `verified_*` configuration pins indefinitely. The registry and supporting contracts are upgradeable, but there is no freshness TTL or scheduled `chain-network-verify` gate. A contract class/owner/verifier change after the last verification can therefore leave the app treating stale coordinates as verified until a separate manual reconciliation catches it.

The current audit-visible data is small: three Base44 users have AT Protocol DIDs and none are duplicated; one V2 ChainIdentity is currently chain-authoritative with an ACTIVE level-2 assurance; no ChainCardToken or BridgeTransfer rows were present; and four StakePosition rows were present, one active and three drafted. This means the architecture can be remediated before a large asset population is exposed, but sparse data is not evidence that the flaws are safe.

The Cairo source was inspected from the existing `beitmenotyou1/swappulse2` GitHub repository at current `main` commit `f47662335672eebacc38095770785370c40932b7`. The source contains 64 Starknet Foundry unit tests and one fuzz test across IdentityRegistry, SwapPulseAccount, NativeToken and StakingPool. BridgeAdapter, CardNft, ProofOfUsership and HandleRegistry have no dedicated test suites. Scarb and `snforge` are not installed in the Base44 audit sandbox, so those source tests could not be re-run against this exact commit during this audit.

## Scope

This audit covered:

- Base44 registration, login and activation identity boundary
- passwordless email authentication
- TOTP two-factor authentication
- WebAuthn/passkeys/security keys
- fresh security step-up tokens
- AT Protocol DID linking and DID-based login routing
- self-hosted PDS identity provisioning
- encrypted PDS app-password storage
- PDS migration/app-password management state
- custom-domain handle verification
- Starknet/Cairo ChainIdentity provisioning
- SwapPulseAccount deployment and device signer
- IndexedDB signer vault and Stark signing
- V2 IdentityRegistry registration/canonicalisation/merge/recovery count
- V2 verification commitments, replay IDs, verifier role, expiry and revocation
- private age/eligibility verification and webhook privacy
- ChainNetworkConfig verification/pinning
- chain transaction drafting/submission/relay policy
- wallet balance/activity presentation
- SWPX faucet
- validator/delegator staking and withdrawal intents
- Proof of Usership scoring/security weight
- card possession attestation
- CardNft minting
- BridgeAdapter token/card outbound flow and refund
- wallet recovery/controller flow
- signer-add/rotation UI
- chain event and identity reconciliation
- entity RLS/secret handling
- Cairo/OpenZeppelin contract structure
- Starknet Foundry tests and release CI/governance

## Method and constraints

The project-required Base44 web-agent README URL was requested first from the existing app's sandbox. It returned HTTP 403 on 11 September 2026, so the audit continued against the actual Base44 application source, entities, backend functions, workflows and audit-visible data instead of claiming the README had been read.

The Base44 app does not contain the Cairo source tree. To audit the actual smart contracts rather than infer them from Base44 ABI calls, the existing `beitmenotyou1/swappulse2` repository was inspected over the connected GitHub integration and cloned read-only into the audit sandbox. No replacement app or replacement chain project was created.

The audit sandbox does not have Scarb or Starknet Foundry installed. The current chain source and tests were inspected statically, but this audit cannot claim that `scarb test`/`snforge test` passed on commit `f47662335672eebacc38095770785370c40932b7` during this run.

No wallet, identity, chain or authentication functionality was changed during this audit.

## Score breakdown

| Area | Score | Notes |
| --- | ---: | --- |
| Account authentication & DID binding | 7/15 | Email/TOTP/WebAuthn controls are strong, but AT DID uniqueness and handle-claim provenance need hardening. |
| Cairo identity registry & smart account | 12/15 | Strong V2/replay/canonical/recovery primitives using OpenZeppelin; governance remains highly privileged. |
| Signing, key custody & recovery | 6/15 | Server transaction policy is strong, but recovery deletes the active local key too early and the advertised Add Signer path is not implemented by the account ABI. |
| Verification, age privacy & eligibility | 12/15 | Excellent off-chain privacy and two-sided assurance gating; commitment-key separation and card-proof semantics need work. |
| Wallet assets, staking, NFT & bridge | 5/20 | Staking is strong, but mint/bridge finality and card bridge refund/inbound behaviour are release blockers. |
| AT Protocol portability & self-sovereignty | 2/10 | Portable identity foundations exist, but app custody of PDS credentials, disabled migration and root-password UX weaken self-sovereignty. |
| Testing, governance & reconciliation | 2/10 | Core tests exist, but critical contracts lack suites, chain tests are not a required CI gate, main is unprotected, and network verification can go stale. |
| **Total** | **46/100** | **High Risk** |

## Findings

| Priority | Area | Finding | Required action |
| --- | --- | --- | --- |
| 🔴 P0 | Recovery key safety | The Recovery UI calls `resetDeviceTestSigner(user.id)` **before** invoking the on-chain recovery proposal. The browser therefore deletes the key that still controls the account before the relay/network/controller has accepted the recovery proposal. Any failure after deletion can create an avoidable self-lockout. | Keep the current signer until the recovery proposal is independently observed on-chain and the replacement key is durably staged. Use a two-slot key-rotation state: current signer remains usable until `RecoveryExecuted` is confirmed, then atomically promote the staged key and retire the old one. Test relay failure, MFA expiry, rejected proposal, browser crash and delayed execution. |
| 🔴 P0 | Card mint finality | `mint-card` creates `ChainCardToken` with `status: MINTED` and `confirmed_at` immediately after the relay returns a transaction hash. It does not verify transaction receipt, contract event, token ID or owner on-chain. The reconciler only checks `SUBMITTED` mint rows, so the current mint path bypasses reconciliation entirely. A reverted/dropped mint can be shown as permanent on-chain ownership. | Persist `SUBMITTED` only after relay acceptance. Reconcile receipt + `CardMinted` event + token ID + owner + attestation hash from the public RPC, then transition to `MINTED/CONFIRMED`. Never use relay submission alone as finality. Add dropped/reverted/reorg/duplicate-event tests. |
| 🔴 P0 | Card bridge asset recovery | Cairo `BridgeAdapter.bridge_out_card` burns the CardNft. `refund()` restores escrowed fungible tokens but does nothing for cards; the contract comment says burned cards are to be re-minted by the relay. That is not an atomic on-chain refund and makes card recovery depend on a privileged off-chain operator. The contract also has no equivalent inbound card-release implementation. | Do not enable card bridging in production until the protocol guarantees atomic recoverability. Prefer lock/escrow rather than burn, or implement a cryptographically authorised on-chain remint/refund state machine with immutable metadata, nonce/replay protection and destination proof. Add dedicated adversarial BridgeAdapter/CardNft tests before re-enabling. |
| 🔴 P0 | Bridge finality & reconciliation | Base44 marks a `ChainCardToken` `BRIDGED_OUT` as soon as the source transaction is submitted, not confirmed. `BridgeTransfer` then becomes `PENDING_RELAY`, but the current submit path does not persist the outbound bridge nonce that `reconcileBridges()` requires to query source-chain status. Transfers can become permanently unreconcilable while local card ownership is already hidden. | Source-chain confirmation must produce the canonical bridge nonce/event before local ownership changes. Persist nonce/event block/tx only after public-RPC verification, keep the card in a pending state until finality, then relay. Reconcile by nonce with pagination and reorg handling; restore local state only from verified contract outcome. |
| 🔴 P0 | AT Protocol DID uniqueness | `atproto-auth` link mode authenticates the external DID correctly but does not check whether that DID is already bound to another Base44 user. `User.did` has no enforced uniqueness constraint, while DID-based login looks up a single matching user. One AT identity can therefore be linked to multiple SwapPulse accounts and later resolve ambiguously. | Introduce an authoritative unique `IdentityBinding`/DID index maintained only by backend transactions. Reject a DID already bound to another account, migrate existing bindings, detect duplicates before login/link, and require explicit high-assurance transfer/unlink semantics rather than overwriting ownership. |
| 🔴 P0 | Stale chain verification pins | Value actions rely on saved `verified_*` ChainNetworkConfig pins. The current configuration was last independently verified on 1 September 2026, and `getVerifiedConfig()` checks saved values against saved pins but has no freshness TTL or live class/owner/verifier check. IdentityRegistry and supporting contracts are upgradeable at the same addresses, so code/authority can drift after verification while actions remain enabled. | Add a short verification TTL for value actions and scheduled independent verification. Pin and re-read chain ID, contract class hashes, registry owner, verifier, account class, supporting-contract identities and critical policy values. Fail closed if verification is stale or any live value differs. Emit operator alerts before re-enabling. |
| 🟠 P1 | Add Signer feature | The wallet exposes an Add Signer action, but `chainRelay` builds an `add_signer` account call that does not exist in the current SwapPulseAccount source/ABI. The account exposes `set_public_key`, not multi-signer membership. In addition, the draft endpoint checks step-up action `swappulse-security-stepup` while the shared UI issues `security_manage`, so the action cannot accept the token the user receives. | Remove/disable the feature until its security model is real. If the intent is key rotation, implement a clearly named `set_public_key` rotation flow with current-key authorisation and recovery safeguards. If true multi-sig is intended, implement/audit a multi-signer Cairo account and tests. Use one shared step-up purpose constant across UI/backend. |
| 🟠 P1 | Recovery-delay policy | `chain-identity-admin` permits recovery delay down to zero and changes to `recovery_delay_seconds` do not invalidate network verification pins. A privileged config change can therefore remove the user's cancellation window without forcing a fresh verification state. | Enforce a non-zero production minimum (for example the existing 48-hour policy), include recovery delay in verified policy pins, require explicit multi-party/admin approval for reductions, and invalidate wallet actions until the changed policy is independently verified. |
| 🟠 P1 | Recovery authority / sovereignty | SwapPulseAccount recovery ultimately trusts a configured recovery controller that can propose and execute public-key rotation after the delay. This is safer than immediate custodial reset, but it means a compromised controller can seize an account after the window if the user does not cancel. | Treat the controller as a high-value governance key: use multisig/HSM policy, publish controller address and delay in the wallet, notify through independent channels on every proposal, support user-configurable/rotatable recovery authority, and consider guardian/multi-controller recovery rather than a single operator. |
| 🟠 P1 | Browser signer custody | The local Stark private key is AES-GCM encrypted with a non-extractable WebCrypto key, but both ciphertext and the decrypt-capable `CryptoKey` live in the same IndexedDB origin. Non-extractable prevents export; it does not stop compromised same-origin JavaScript from invoking decrypt/sign. | Do not describe this as hardware-grade custody. Prefer passkey/WebAuthn PRF or platform secure-key integration where available, require explicit user presence for high-value signing, keep the strict CSP, and provide a hardware/external wallet path before real-value deployment. |
| 🟠 P1 | Merged identity wallet state | Backend identity logic correctly treats `MERGED` as chain-authoritative, but `src/lib/chainIdentityDisplay.js` only recognises `REGISTERED` and `RECOVERED`. A valid merged identity can therefore be shown as non-authoritative/locked out by wallet UI while the backend resolves it to a canonical identity. | Use one shared authoritative-status definition (`REGISTERED`, `RECOVERED`, `MERGED`) from backend policy and always resolve the canonical identity before wallet capability decisions. Add merged-source and merged-target UI tests. |
| 🟠 P1 | Card verification threshold | CardAttestation UI treats every `status === verified` session as mintable. The backend can mark level-1 partial visual matches `verified`, and `mint-card` accepts verification levels 0–3 without requiring level 2. This is weaker than the level-2 threshold used for the platform's possession-verified trade badge. | Require an explicit minimum verification policy for on-chain possession credentials, preferably level 2+ for a platform-issued possession claim. Encode the minimum server-side and in contract policy/version metadata; never rely on the UI filter. |
| 🟠 P1 | Card-proof trust wording | The UI says minted card proofs can let “anyone check possession proof without trusting SwapPulse”, but the attestation is created by SwapPulse's AI/backend and the CardNft is owner-minted by the platform. The chain proves that SwapPulse minted a hash/level; it does not independently prove physical possession or authenticity. | Change product/security language to distinguish **verifiable platform attestation** from trustless proof. Publish verifier methodology, level semantics, timestamp/expiry and issuer. For stronger claims, require user-signed challenge evidence and independent verifier/multi-attester proofs. |
| 🟠 P1 | Card attestation identity binding | The private scan flow correctly binds the CollectionEntry to the authenticated Base44 owner, but the visual attestation itself is not cryptographically signed by the user's registered Stark key before platform minting. The resulting NFT principally attests the platform's observation, not explicit wallet-holder consent to that exact evidence hash. | Include a short-lived user-signed mint challenge over chain identity, card/CollectionEntry commitment, attestation hash, level, network and expiry. Verify that signature server-side and, where practical, include the commitment in the mint/event so consent is independently auditable. |
| 🟠 P1 | Faucet finality | FaucetClaim is marked `CONFIRMED` from relay transaction-hash acceptance rather than public-chain receipt/state confirmation. This is testnet-only but repeats the same finality anti-pattern as minting. | Use `SUBMITTED → CONFIRMED/FAILED` with public-RPC receipt/event/balance reconciliation. Do not consume a successful user-facing claim state solely from relay acceptance. |
| 🟠 P1 | Proof-of-Usership finality | `usership-aggregate` marks `UsershipScore` `CONFIRMED` and consumes PointsLedger rows immediately after relay submission. It does not independently verify the on-chain score/event first. A reverted submission can therefore consume source activity and leave local security weight ahead of the chain. | Mark the score `SUBMITTED`, reconcile the `ScoreSubmitted` event/state from public RPC, and only then consume ledger rows/finalise the epoch. Keep failed/reorged submissions retryable and idempotent. |
| 🟠 P1 | Proof-of-Usership provenance | Proof of Usership includes `TRADE_COMPLETED` and `VOUCH_GIVEN` activity. The separate Trade Board audit found those trust inputs are not yet transaction-authoritative. If such rows enter PointsLedger, staking security weight can inherit forged social/trade activity even though stake itself is real. | Only award usership points from server-authoritative provenance. Gate trade/vouch scoring on the remediated accepted-trade and authenticated-vouch systems, store source record IDs/proof version, and make the aggregator reject legacy/unverified provenance. |
| 🟠 P1 | Registry/admin governance | IdentityRegistry is upgradeable and its owner can perform privileged account changes/merges; supporting contracts also use owner-admin paths. These are powerful recovery/maintenance tools but remain central authority over supposedly self-sovereign identities. | Move production owner/admin powers to a transparent multisig/timelock/governance process, separate emergency roles, monitor all ownership/upgrades/merges, and require explicit audit/change windows for code upgrades. Keep user self-service account change/recovery paths distinct from admin intervention. |
| 🟠 P1 | Native PDS root custody | Automatic PDS provisioning creates the user's account with a random master password generated server-side, uses it to create a bridge app password, then discards the master password. The user is not given a root credential or key-export step in this flow. This weakens practical self-sovereignty even though the DID/PDS are portable in principle. | Design an explicit user-controlled PDS custody ceremony: let the user set/recover root credentials or move to OAuth/delegated auth, document who can reset the account, and provide tested export/migration before presenting the identity as fully self-sovereign. |
| 🟠 P1 | PDS migration | `migrate-pds` is intentionally disabled (`410`) because the previous credential-reuse approach was unsafe. Disabling the unsafe flow is correct, but the app currently lacks a working migration path even though portability is a core identity promise. | Implement a standards-compatible migration/export flow with explicit user confirmation, fresh destination credentials/OAuth, repo integrity checks, handle/DID continuity checks, rollback guidance and no server-side reuse of destination secrets. Keep the old path disabled. |
| 🟠 P1 | Handle verification provenance | `verifyHandleClaim` verifies a caller-supplied DID instead of binding the request to `user.did`, and `HandleClaim` owner RLS allows the owner to update the record, including status fields. The later PDS handle-update path is safer because it uses the real user DID, but the local HandleClaim record itself is not a trustworthy verification primitive. | Make verification backend-derived from the authenticated user's immutable DID, protect status/verified timestamps from client writes, and derive high-trust handle badges from live DID/PDS/DNS resolution rather than mutable local claims. |
| 🟠 P1 | Commitment secret separation | Private on-chain eligibility commitment/replay derivation is rooted in the relay bearer token through HKDF. A relay-transport credential is being reused as a privacy/identity commitment secret; compromise exposes the derivation root and token rotation couples transport operations to commitment stability. | Use a dedicated, versioned commitment key stored in KMS/HSM/secret manager, separate from relay authentication. Include key version/domain separation in derivation and define a controlled rotation/migration strategy without exposing subject data. |
| 🟠 P1 | Critical contract test gaps | Current chain source has 64 unit tests and one fuzz test, but BridgeAdapter, CardNft, ProofOfUsership and HandleRegistry have no dedicated test files. The two components with the most serious audit findings, BridgeAdapter and CardNft, are therefore outside the dedicated contract test suites. | Add unit/integration/fuzz suites for every contract, especially burn/refund/inbound/replay/nonces, mint/burn authority, metadata immutability, score replay/epochs and handle reservation/canonical merges. Include malicious callers and zero/duplicate/expiry/revocation cases from the project test requirements. |
| 🟠 P1 | Chain CI & repository governance | The current GitHub `main` branch is unprotected, the inspected head commit is not cryptographically verified, and the only inspected GitHub workflow publishes release bundles on tags; it does not run Scarb/Starknet Foundry as a required merge/release gate. Security-critical Cairo can therefore land/release without enforced chain tests. | Protect `main`; require pull-request review, Scarb build, `snforge test`, fuzz/integration/security checks and deployment-manifest verification before merge/release. Prefer signed release tags/commits and attach test/manifest evidence to releases. |
| 🟠 P1 | Network-verification scheduling | The five-minute Chain Event Reconcile workflow does not replace `chain-network-verify`, and no scheduled network-verification workflow was found. Upgradeable contract/class/owner/verifier drift can therefore persist until a human or separate path explicitly verifies it. | Schedule independent network verification at a defined cadence and immediately after deployments/upgrades. Value actions must enforce the freshness TTL; reconciliation should alert and fail closed on drift. |
| 🟡 P2 | Reconciliation pagination | Chain event reconciliation uses fixed-size batches (100) without a durable cursor/pagination loop for every asset/state class. A larger wallet population can leave older submitted events unreconciled. | Add durable cursors/checkpoints, bounded repeated pages, block/event range tracking and backlog metrics. Reorg-safe idempotency should be tested at scale. |
| 🟡 P2 | `u256` amount support | The chain relay helper accepts only values up to `u128::MAX` and always encodes the high half of Cairo `u256` as zero. It fails closed for larger values, so this is not an overflow, but it is an undocumented protocol/UI limitation. | Either document/enforce the u128 application cap everywhere or implement full u256 parsing/encoding with explicit amount limits and tests. |
| 🟡 P2 | HandleRegistry integration | A Cairo HandleRegistry exists and is upgradeable/canonical-identity aware, but Base44 ChainNetworkConfig and current wallet/identity paths do not expose or verify it. SwapPulse custom-domain handles currently operate through AT Protocol rather than the on-chain registry. | Decide whether HandleRegistry is a production feature. If yes, add deployment/config verification, self-sovereign/authorised update semantics and tests. If no, remove it from deploy expectations/documentation to avoid maintaining an unaudited dormant authority surface. |
| 🟡 P2 | HandleRegistry authority | The current Cairo HandleRegistry allows only the contract owner to set or clear handles; the identity account cannot directly manage its own hash. This conflicts with a strong self-sovereign interpretation if the registry is intended for user identity. | If enabled, require user-authorised handle claims/changes (direct caller or signed intent) plus collision/canonical-merge protections. Reserve administrator intervention for narrowly documented recovery/moderation cases. |
| 🟡 P2 | PDS password legacy fallback | `getUserIdentity()` attempts AES-GCM decryption and, on any failure, treats the stored value as a plaintext legacy app password. This aids migration but can hide encryption-key/configuration failure and makes plaintext-at-rest legacy records silently supported. | Add an explicit storage-version field, migrate all plaintext records, fail closed on decryption failure for encrypted versions, and alert operators instead of silently downgrading interpretation. |
| 🟡 P2 | Legacy TOTP verifier | The compatibility/default mode of `verify-2fa` is unauthenticated and behaves differently for unknown users, users without TOTP, and users with invalid TOTP. It does not grant a session/login key, so it is not a login bypass, but it can act as an account/2FA-state oracle. | Retire the unused compatibility path or require a first-factor capability token. Keep all login 2FA checks in `verify-login-code`/WebAuthn flows. |
| 🟡 P2 | Recovery readiness UI | Recovery readiness is partly calculated client-side from local timestamps while execution authority ultimately depends on chain state/controller policy. Clock drift or stale records can produce confusing “ready” presentation even though backend/contract correctly rejects premature execution. | Display chain-derived recovery proposal/ready-at state from a public RPC or reconciled server projection and clearly label local estimates as estimates. |
| 🟡 P2 | Chain status evidence in wallet | Several wallet panels rely on Base44 projections for user-friendly status. Where a state is security/value-sensitive, users have limited direct evidence of block/receipt/event confirmation and reconciliation age. | Surface confirmation state, tx hash, block/finality/reconciliation timestamp and “pending/verified from chain” distinctions consistently. Provide explorer links where appropriate without exposing private verifier data. |
| 🟡 P2 | Proof-of-Usership central oracle | Cairo ProofOfUsership accepts score batches from the contract owner and staking consumes that score as security weight. The commitment makes the submitted activity set tamper-evident after publication, but the owner remains the scoring oracle and can alter scoring configuration. | Publish versioned scoring rules, commit inputs/proof roots, use multisig/timelock for config/score authority, expose independent recomputation data where privacy permits, and cap the influence of off-chain score relative to stake. |
| 🟡 P2 | CardNft issuer centralisation | CardNft mint/burn authority is owner-controlled. That is appropriate for an issuer-attestation NFT, but the product should not imply that ownership alone makes the credential decentralised or independently issued. | Explicitly model issuer/verifier trust, pin issuer authority in network verification, use multisig/timelock for issuer changes, and expose issuer/verification level/version in wallet proof views. |
| 🟡 P2 | Bridge relay centralisation | BridgeAdapter uses privileged relay/owner operations for destination release and refund administration. Even after the card-refund bug is fixed, the bridge is a trusted federation boundary rather than a trustless light-client bridge. | Document the trust model, use multisig/threshold relay control, publish relay health/attestations, add replay/nonces/finality proofs and emergency pause/refund procedures, and do not market it as trustless unless cryptographic cross-chain verification is implemented. |
| 🟡 P2 | Test execution evidence | The repository contains chain tests, but this audit could not execute them because Scarb and `snforge` are unavailable in the Base44 sandbox. Source presence must not be treated as proof that the current commit passes. | Make CI test artefacts authoritative: record exact commit/tool versions, pass/fail counts, fuzz seeds and deployment manifest hashes. Attach immutable evidence to the release audit. |
| 🟢 P3 | Login-code copy | `send-login-code` creates a five-minute code, while the email body says it expires in 15 minutes. The Login UI correctly counts down five minutes. | Align the email copy with the actual five-minute expiry so users do not attempt already-expired codes. |
| 🟢 P3 | Legacy wallet entities | **Completed:** WalletLink, WalletBalance and MetaTransaction are explicitly deprecated/quarantined behind administrator-only access rather than being exposed as a second wallet authority. | **Completed:** keep them non-user-writable and remove remaining references as migration evidence allows. |
| 🟢 P3 | Private identity data | **Completed:** age-verification and chain identity paths do not put names, email, DOB, documents or raw evidence on-chain. The verifier webhook rejects unexpected evidence fields and chain storage receives commitments/status/type/level/expiry/revocation metadata only. | **Completed:** preserve this boundary and include privacy regression tests for every future verifier/integration. |
| 🟢 P3 | Account security factors | **Completed:** passwordless login rate limits and consumes codes; configured TOTP/WebAuthn gates credential release; passkey challenges are origin/RP-bound and one-time; factor enrolment/removal requires fresh security step-up. | **Completed:** preserve these controls and keep WebAuthn/TOTP regression tests in the release gate. |
| 🟢 P3 | Privileged chain keys | **Completed:** inspected browser code does not contain relay/verifier/admin private keys or trusted server signing secrets. The browser holds only the user's device Stark signer; privileged relaying and verification remain backend-controlled. | **Completed:** preserve this separation, rotate/seal backend keys appropriately and reject any future client-side privileged-signing implementation. |

## Feature-by-feature verdict

| Feature | Verdict | Notes |
| --- | --- | --- |
| SwapPulse account login | Strong | Passwordless email, brute-force controls, suspension checks and 2FA gating are well structured. |
| TOTP 2FA | Strong | Fresh step-up is required to enrol/disable; legacy standalone verifier should be retired. |
| WebAuthn/passkeys | Strong | Origin/RP binding, signed one-time challenges, credential de-duplication and user verification are present. |
| AT Protocol login routing | Good foundation | PDS credential auth leads to email OTP rather than bypassing SwapPulse 2FA; DID uniqueness still needs enforcement. |
| AT Protocol identity linking | Release blocker at identity layer | Same external DID can currently be linked to more than one Base44 account. |
| Native `@swappulse.org` PDS provisioning | Functional, custodial bootstrap | App password is encrypted, but root-password custody/export/migration is not self-sovereign enough yet. |
| Custom-domain handle | Partially trustworthy | Live PDS/DNS update is useful; local HandleClaim provenance is client-mutable/caller-DID-controlled. |
| ChainIdentity provisioning | Strong architecture | Server coordinates identity/account registration without storing private personal data on-chain. |
| V2 IdentityRegistry | Strong | Canonical IDs, account uniqueness, verifier role, replay prevention, expiry/revocation and irreversible V2 mode are good. |
| SwapPulseAccount | Strong core, recovery caveat | User-signed account execution plus delayed controller recovery; no real multi-signer Add Signer feature. |
| Device signer vault | Acceptable testnet baseline | Encrypted local key, strict CSP; still same-origin software custody, not hardware security. |
| Wallet recovery | Release blocker | UI destroys current key before proposal acceptance. |
| Add Signer | Broken/not implemented | Backend targets nonexistent `add_signer` and step-up purpose mismatches. |
| Chain network verification | Good mechanism, stale operational model | Independent pins exist, but no freshness TTL/scheduled verification for upgradeable contracts. |
| Private age/eligibility verification | Strong | Raw identity evidence stays off-chain; value features require current private and on-chain assurance. |
| V2 on-chain assurance | Strong | Type/level/verifier/expiry/replay/revocation controls are substantial. |
| Card possession attestation | Good privacy, weak credential semantics | Level-1 can be minted and platform-AI attestation is not trustless possession proof. |
| Card NFT mint | Release blocker | Local MINTED state is set before chain confirmation and bypasses reconciliation. |
| Faucet | Safe testnet concept | Fixed/cooldown/identity gated; finality handling should match the rest of the wallet. |
| Validator/delegator staking | Strongest wallet value feature | Identity/canonical/verification checks are on-chain; existing dedicated tests are a positive control. |
| Proof of Usership | Promising but trusted oracle | Owner submits scores; finality/provenance and dedicated tests need strengthening. |
| Fungible-token bridge | Needs finality hardening | Source/destination relay trust and nonce reconciliation must be authoritative. |
| Card bridge | **Do not release** | Burn-without-on-chain-card-refund and missing inbound-card path create asset-loss risk. |
| Chain reconciliation | Useful but incomplete | Identity checks are strong; mint/bridge state paths currently skip/lack required evidence and batching needs pagination. |
| Legacy wallet stack | Correctly quarantined | Old WalletLink/WalletBalance/MetaTransaction are not competing authorities. |

## Verified strengths to preserve

- No privileged chain/verifier/relay private key was found in browser code.
- Chain action drafts bind user, record, action and signing hash with short-lived HMAC tokens.
- The backend rebuilds exact calldata instead of relaying caller-supplied arbitrary calls.
- Device signatures are verified against the registered Stark public key before relay submission.
- Fee/tip/paymaster/account-deployment fields are restricted rather than accepted from the browser.
- Value actions require current private eligibility plus current ACTIVE on-chain verification.
- V2 verification requires the expected type/level, non-zero replay ID, pinned verifier and valid expiry.
- IdentityRegistry has account uniqueness, canonical identity resolution, verifier-only attest/revoke, global replay protection and irreversible V2 enforcement.
- SwapPulseAccount normal upgrades require a self-call; recovery is delayed rather than immediate.
- Staking verifies active/canonical identity ownership and current registry verification on-chain.
- Card verification uploads are private/short-lived and raw scan evidence is not persisted to the public chain.
- The verifier webhook uses HMAC authentication, a metadata allowlist, tight body size and explicit unexpected-evidence rejection.
- ChainIdentity, ChainNetworkConfig, ChainCardToken, StakePosition, BridgeTransfer and age entities are not ordinary user-writable trust records.
- PDS app passwords are encrypted at rest and legacy app-password creation/reveal endpoints are disabled.
- Unsafe PDS migration was disabled rather than left active.
- WebAuthn credential registration/deletion requires fresh security step-up and globally rejects a key registered to another account.
- The old wallet/meta-transaction data model is quarantined rather than silently trusted.

## Remediation order

### Phase 0 - release blockers

1. Fix recovery so the active signer is never deleted before a confirmed recovery proposal/execution.
2. Convert every asset/value action to `DRAFTED/SUBMITTED → chain-confirmed → FINAL`, never “transaction hash = success”.
3. Fix card mint reconciliation and populate verified token ID/owner/event data.
4. Disable card bridging until burn/refund/inbound semantics are atomically safe on-chain.
5. Rebuild bridge transfer bookkeeping around confirmed source events/nonces before local asset state changes.
6. Enforce unique AT DID ↔ Base44 account binding.
7. Add a verification freshness TTL and scheduled live re-verification for all upgradeable chain coordinates/authorities.

### Phase 1 - high-risk identity/security hardening

1. Remove or redesign Add Signer around the actual smart-account security model.
2. Pin/minimum-enforce recovery delay and require governance for reductions.
3. Improve key custody with passkey/hardware-backed signing options and accurate security language.
4. Require level-2+ policy for possession NFT minting and bind mint consent to the user's Stark signer.
5. Separate commitment keys from relay bearer-token secrets.
6. Make handle verification backend-authoritative and authenticated-DID-bound.
7. Implement safe user-controlled PDS migration/root-custody/export flows.
8. Put registry/relay/verifier/admin authority behind multisig/timelock and monitoring.
9. Repair Proof-of-Usership finality and remove unverified trade/vouch provenance from security weight.

### Phase 2 - testing, monitoring and operational resilience

1. Add dedicated BridgeAdapter, CardNft, ProofOfUsership and HandleRegistry unit/integration/fuzz tests.
2. Make Scarb + Starknet Foundry + fuzz/security checks mandatory in protected-branch CI.
3. Sign releases/tags and verify deployment manifests against public RPC before activation.
4. Add durable event-reconciliation cursors, reorg handling and backlog alerts.
5. Schedule independent `chain-network-verify` and identity reconciliation.
6. Surface finality/reconciliation age and chain evidence consistently in wallet UI.
7. Retire legacy TOTP oracle/plaintext-PDS fallback paths after migration.

### Phase 3 - product truth and self-sovereignty

1. Align wallet wording with the actual issuer/controller/relay trust model.
2. Clearly distinguish platform attestation from trustless proof.
3. Show recovery controller, delay, registry owner/verifier and issuer addresses transparently.
4. Provide user-controlled export/migration/recovery documentation and tested procedures.
5. Decide whether HandleRegistry is a real product feature or remove dormant deployment expectations.

## Required regression tests

At minimum, release evidence should prove:

- recovery proposal failure never deletes or disables the current device signer
- recovery execution cannot occur before the configured delay
- recovery delay cannot be silently reduced below policy without invalidating verification
- recovery controller/user cancellation behaviour works under malicious/unexpected callers
- Add Signer/rotation targets an entrypoint actually present in the deployed account class
- every chain action signs the exact server-rebuilt action and rejects modified action/target/calldata/amount
- expired/replayed/mismatched drafts and signatures are rejected
- unsupported contract addresses/entrypoints cannot be relayed
- value actions fail closed when network verification TTL is stale
- value actions fail closed after registry/supporting-contract class hash, owner or verifier drift
- duplicate AT DID binding to a second Base44 account is rejected atomically
- unlink/transfer cannot create two active owners of the same DID
- handle verification cannot verify a DID other than the authenticated user's binding
- user-controlled HandleClaim fields cannot create a trusted verified status
- private age/DOB/document/evidence fields never reach chain calldata/events/entities intended for public exposure
- revoked/expired/private verifier state disables value actions before chain convergence
- V2 replay IDs cannot be reused across identities or attestations
- wrong verifier, zero commitment, zero account, duplicate registration, merged/retired identity and malicious caller cases fail
- a mint remains `SUBMITTED` until a verified CardMinted event/owner/token ID is read from public RPC
- a reverted/dropped mint can never show `MINTED`
- level-1 visual evidence cannot mint a level-2 possession credential
- card mint consent is bound to the registered signer and exact attestation hash
- source bridge state remains local/pending until confirmed outbound event and nonce exist
- bridge replay/duplicate nonce/wrong asset/wrong recipient/malicious relay cases fail
- failed card bridging restores the asset on-chain without relying on an operator manual remint
- inbound card bridging is either cryptographically implemented and tested or unavailable in UI/backend
- token bridge refund cannot be replayed and respects timeout/finality
- faucet/usership records do not become CONFIRMED until public-chain evidence exists
- staking rejects inactive, unverified, merged-source, wrong-account, zero/under-minimum and malicious callers
- Proof-of-Usership scoring cannot consume source activity until score submission is chain-confirmed
- unverified/legacy trade or vouch data cannot increase staking security weight
- reconciliation processes more than 100 records with durable cursors and survives reorg/retry
- WebAuthn replay/origin/RP/credential-owner mismatch fails
- adding/removing security factors always requires fresh step-up
- AT Protocol PDS endpoints remain SSRF-safe
- PDS migration never reuses or exposes destination root credentials
- Scarb build, all Foundry unit/integration tests and fuzz tests pass on the exact deployed commit

## Release decision

**Wallet and Identity should not be treated as production-release ready while any unresolved P0 remains.**

The Cairo identity registry and signed-action architecture are worth preserving. The next work should focus on making **chain finality authoritative everywhere**, fixing **card bridge asset safety**, preserving the current signer through recovery, enforcing **one DID → one SwapPulse account**, and making network verification continuously fresh. Once those foundations are reliable, the remaining self-sovereignty, issuer trust, governance and UX improvements can build on a genuinely secure wallet rather than compensating for divergent off-chain state.
