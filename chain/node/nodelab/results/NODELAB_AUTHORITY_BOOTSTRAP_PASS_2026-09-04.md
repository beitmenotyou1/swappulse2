# SWAPPULSE_NODELAB_1 authority bootstrap pass — 2026-09-04

The clean node-lab deployment workspace successfully ran the pinned Cairo V2 regression suite before any network deployment work:

- Scarb 2.13.1
- Starknet Foundry 0.51.2
- 64 collected tests
- 63 passed
- 0 failed
- 1 intentionally ignored in the main run
- the ignored zero-public-key constructor case was then executed separately and correctly failed with `INVALID_PUBLIC_KEY`

The node-lab authority bootstrap then used one deterministic Madara devnet fixture only as a one-time funding/declaration bootstrap. It declared the audited `SwapPulseAccount` class and created two fresh SwapPulse accounts derived from local-only secrets in `.env.local`:

- deployer / future IdentityRegistry owner: `0x6f0d8c4486a57d5e88be0ffe9b2819b53b315bcbcb082c1017e1608b7c3dbb3`
- verifier: `0x6a51b1f7a7c9cec10b442ee790c0c21627f362f796cfb57d7e262aa621c6d3b`
- SwapPulseAccount class hash: `0x492c4b3e137468b6f6a805970d2c28b44f11bfd9f3cc6bd3187db5d83cb0a1c`

No private key was printed or written to the public result.

The first bootstrap generated declaration, funding and account-deployment transactions. Running the same bootstrap a second time returned the same public addresses/class hash and empty transaction fields, proving the bootstrap is idempotent and does not refuel/redeploy already-correct authority accounts.

Independent verification through both Madara RPCs confirmed that both fresh authority addresses resolve to the exact audited `SwapPulseAccount` class hash:

- sequencer `127.0.0.1:19950`: deployer PASS, verifier PASS
- observer `127.0.0.1:19951`: deployer PASS, verifier PASS

This closes the authority bootstrap gate for the V2 node-lab deployment. The next phase may deploy the audited V2 contract suite with the fresh deployer as owner and the fresh verifier as the only initial verification authority. The irreversible `require_verification_v2()` switch remains intentionally deferred until a genuine V2 identity/assurance transaction succeeds end-to-end on `SWAPPULSE_NODELAB_1`.
