# SwapPulse

SwapPulse is a free, open-source social collecting and trading platform for Pokémon TCG collectors, with AT Protocol federation and a self-custodial Web3 layer built with Cairo and Starknet.

The application combines community features, collections, trading, card attestations, smart-account identity, SWPX testnet assets, community staking and a public SwapPulse Chain Explorer.

**Website:** https://swappulse.org  
**Chain Explorer:** https://swappulse.org/chain/  
**Public read-only RPC:** https://rpc.swappulse.org/rpc  
**Repository:** https://github.com/beitmenotyou1/swappulse2

## Built with ChatGPT and Base44

SwapPulse has been developed end-to-end under human project direction using **ChatGPT** and **Base44** as the primary development tools.

That collaboration covers the React user interface, Base44 entities and backend functions, AT Protocol integrations, Cairo/Starknet architecture, smart contracts, transaction-relay policy, testing, security hardening, deployment tooling and project documentation.

Base44 remains the application and orchestration layer. Cairo/Starknet provides the decentralised trust and smart-contract layer. Privileged blockchain keys and trusted signing logic are never placed in browser code.

AI-assisted development does not replace review. Security-sensitive changes are expected to be tested, documented and reviewed against the project invariants described below.

## What SwapPulse does

SwapPulse currently provides:

- social profiles, posts, feeds, circles, messaging and live/community features;
- Pokémon TCG catalogue exploration, collections, binders and market/trading tools;
- AT Protocol federation and user-owned identity/data integrations;
- self-custodial SwapPulse smart accounts;
- privacy-preserving V2 on-chain identity assurance with no private identity evidence stored on-chain;
- SWPX testnet token functionality;
- community operator staking, delegation, unbonding and withdrawal flows;
- on-chain card possession/ownership attestations and CardNft support;
- cross-chain adapter infrastructure;
- delayed smart-account recovery;
- a public, read-only Chain Explorer for blocks, transactions and smart-account activity.

## Architecture

SwapPulse is deliberately split into trust layers.

```text
Collectors
   |
   v
React / Vite application
   |
   v
Base44
  - authentication
  - entities and row-level security
  - backend functions
  - workflows and reconciliation
  - private user/verifier state
   |
   +----------------------------+
   |                            |
   v                            v
AT Protocol / TCG services   SwapPulse blockchain boundary
                              |
                              +-> public read-only RPC gateway
                              |
                              +-> authenticated transaction relay
                                      |
                                      v
                                  Cairo / Starknet
                                  - IdentityRegistry V2
                                  - SwapPulseAccount
                                  - SWPX token
                                  - CardNft
                                  - ProofOfUsership
                                  - StakingPool
                                  - BridgeAdapter
```

### Privacy model

Private personal data is not written to the blockchain. Names, email addresses, dates of birth, identity documents and private verification evidence remain off-chain.

The chain stores only public wallet-linked references and cryptographic/trust metadata such as opaque identity identifiers, hashes/commitments, verification state, assurance type/level, verifier references, timestamps, expiry, revocation state and replay-protection identifiers.

### Signing and privileged operations

- User-approved account actions are signed by the user's smart-account signer.
- Trusted verifier/admin actions are performed server-side.
- Relay bearer tokens and privileged Starknet private keys remain on the host/backend.
- The public RPC is read-only.
- Raw Devnet RPC is localhost-only.
- The relay is allowlisted to known SwapPulse transaction shapes rather than exposing an arbitrary write proxy.

## V2 live baseline

The frozen post-cutover V2 baseline was established on 3 September 2026.

At that baseline:

- Cairo/Starknet Foundry: **64 tests collected, 63 passed, 0 failed, 1 intentionally ignored and separately verified**;
- relay policy regression: passed;
- hardened relay: live;
- public and local `/readyz`: healthy;
- permanent V2-only verification requirement: enabled and confirmed on-chain;
- repeat cut-over call: idempotent and sends no additional transaction;
- V2 expiry regression: passed;
- recovery from expiry: passed;
- existing validator self-stake survives identity-verification expiry;
- new staking/bridge actions fail closed while verification is expired or revoked;
- operator UX routes an existing validator to `increase_self_stake` rather than duplicate registration.

The detailed live architecture and operational invariants are documented in:

- [`docs/SWAPPULSE_V2_LIVE_ARCHITECTURE.md`](docs/SWAPPULSE_V2_LIVE_ARCHITECTURE.md)
- [`chain/README.md`](chain/README.md)
- [`chain/OPERATOR_GUIDE.md`](chain/OPERATOR_GUIDE.md)

## Chain Explorer

The public explorer lives at `/chain/` and is intentionally separated visually from the social application.

It supports:

- latest blocks and recent transactions;
- block-number and block-hash lookup;
- transaction-hash lookup with execution/finality/fee details;
- smart-contract and smart-account address lookup;
- direct wallet-to-transaction and wallet-to-address links;
- SwapPulse-indexed public smart-account activity;
- raw technical details for advanced users;
- all nine supported UI languages;
- keyboard navigation, focus handling, skip links and the app accessibility preferences.

The explorer never exposes relay credentials or turns the read-only RPC into a browser write endpoint.

## Network decentralisation roadmap

The current `SWAPPULSE_TESTNET` runtime is still a single Starknet Devnet execution environment behind the verified public RPC gateway. Community staking is therefore currently an economic/operator layer, **not a claim of decentralised block consensus**.

The next network phase is to introduce reproducible full-node and resource-light node profiles, then move towards multiple independent operators and eventually permissionless consensus/validation where the selected Starknet appchain architecture supports it.

See [`docs/NODE_ARCHITECTURE.md`](docs/NODE_ARCHITECTURE.md) for the honest staged design, hardware targets and Raspberry Pi goals.

## User guide

For normal site use, wallet setup, Chain Explorer, staking and troubleshooting, see:

- [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md)

## Contributing

Community contributions are welcome. Start with:

- [`CONTRIBUTING.md`](CONTRIBUTING.md)
- [`docs/CHANGE_PROTOCOL.md`](docs/CHANGE_PROTOCOL.md)

The project expects privacy, decentralisation, accessibility, localisation and fail-closed security behaviour to be preserved by future changes.

## Local development

### Prerequisites

- Node.js/npm
- Git
- Base44 access for hosted backend development
- Scarb and Starknet Foundry for Cairo work

Clone the repository and install frontend dependencies:

```bash
git clone https://github.com/beitmenotyou1/swappulse2.git
cd swappulse2
npm install
```

For frontend-only development against the hosted Base44 backend:

```bash
npm run dev
```

For a full Base44 local-development workflow, follow the current Base44 developer documentation and the repository's `base44/config.jsonc`.

Do not commit `.env`, `.env.local`, relay tokens, private keys, webhook secrets or PDS credentials.

## Chain development and tests

The Cairo workspace lives in `chain/`.

Run the pinned chain regression suite with:

```bash
cd chain
bash scripts/test-chain.sh
```

Relay policy checks live in:

```bash
cd chain/infra/tx-relay
node smoke-policy.mjs
```

Do not perform an irreversible network-policy write merely to test UI or documentation changes.

## Source-control principles

- `main` should represent a reviewable, working state.
- Preserve the frozen V2 security invariants unless an explicitly reviewed protocol migration changes them.
- Make security-sensitive changes in small checkpoints/commits.
- Add or update tests with contract/backend changes.
- Add translations for new user-visible copy.
- Treat accessibility regressions as product regressions.
- Never place privileged keys or trusted signing logic in frontend code.

## Open source

SwapPulse is intended to remain open source and community auditable. The code, architecture, security assumptions, contribution process and future protocol changes should be understandable without relying on private institutional knowledge.

If behaviour changes, the related tests and documentation should change in the same contribution.

## Support and project documentation

- User guide: [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md)
- V2 live architecture: [`docs/SWAPPULSE_V2_LIVE_ARCHITECTURE.md`](docs/SWAPPULSE_V2_LIVE_ARCHITECTURE.md)
- Node architecture: [`docs/NODE_ARCHITECTURE.md`](docs/NODE_ARCHITECTURE.md)
- Contribution guide: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- Change protocol: [`docs/CHANGE_PROTOCOL.md`](docs/CHANGE_PROTOCOL.md)
- Deployment notes: [`DEPLOYMENT.md`](DEPLOYMENT.md)
- Security audit: [`SECURITY_AUDIT.md`](SECURITY_AUDIT.md)
