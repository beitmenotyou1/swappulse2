# SwapPulse Identity Registry

## Purpose

`IdentityRegistry` provides a permanent, chain-level identity anchor for SwapPulse accounts while keeping personal identity data off-chain.

The registry is intentionally split into two layers:

1. **Identity anchor**: an opaque `identity_id`, its bound account, status, canonical merge target, creation time and recovery history.
2. **Verification attestation**: a cryptographic commitment to an off-chain verified claim set plus audit metadata.

## Privacy boundary

Do not write plaintext personally identifying information to this contract.

That includes names, email addresses, phone numbers, dates of birth, postal addresses, government identifiers, document images or document numbers.

The current verification scaffold stores:

- `verification_root`: commitment to the verified claim set. Intended for a Merkle/Poseidon root or equivalent Starknet-friendly commitment.
- `schema_hash`: identifier/commitment for the schema used to build the claim set.
- `status`: `0 = none`, `1 = verified`, `2 = revoked`.
- `attested_by`: account that submitted the attestation.
- `verified_at`: Starknet block timestamp at attestation time.
- `expires_at`: optional expiry timestamp. `0` means no expiry.
- `version`: monotonically increasing attestation/revocation version.

The raw claims and supporting evidence remain off-chain. A future proof system can prove selected properties against `verification_root` without revealing the full claim set.

## Current trust model

Verification writes are owner-only for this first scaffold. This is intentional while the verifier architecture is still being defined.

Before production verification is enabled, replace or extend this with an audited verifier authorisation model, such as an allowlisted verifier role, multisig-controlled verifier registry or proof-verifier contract.

## Canonical identities

Merged identities remain historically queryable. `is_verified(identity_id)` resolves the identity through `resolve_canonical()` and checks the final active identity's verification state.

This means a historical/merged identity follows the verification status of its surviving canonical identity.

## Next contract steps

- Define the canonical claim schema and deterministic commitment algorithm.
- Add verifier authorisation separate from contract ownership.
- Decide whether multiple simultaneous attestation types are required per identity.
- Add proof-verification entry points only after the exact proof format is selected.
- Define revocation/re-attestation policy and verifier rotation procedure.
- Keep all plaintext identity evidence and recovery documents off-chain.
