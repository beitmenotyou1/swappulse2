# Base44 Project

Use this repository to run and edit the app locally, then publish changes back through Base44.

Any change pushed to the repo will also be reflected in the Base44 Builder.

## Prerequisites

1. Clone the repository using the project's Git URL.
2. Navigate to the project directory.
3. Install dependencies: `npm install`.
4. Install the Base44 CLI: `npm install -g base44@latest`.

See the [Base44 CLI docs](https://docs.base44.com/developers/references/cli/get-started/overview) if you want to run Base44 commands directly.

## Run Locally

Run the full local development environment from the project root:

```bash
base44 dev
```

`base44 dev` starts the local Base44 development backend and, when this app is configured for it, also starts the frontend dev server for you. Use the frontend URL printed by the command.

For example, when the Base44 project config includes a `serveCommand`, `base44 dev` can launch the frontend too:

```json5
{
  "site": {
    "serveCommand": "npm run dev"
  }
}
```

In a Base44 project this lives in `base44/config.jsonc`.

## Run Only The Frontend

If you only want to work on the frontend against the hosted Base44 backend, run:

```bash
npm run dev
```

Open the local URL printed by Vite.

## Use The Hosted Backend

For frontend-only development, create or update `.env.local` in the project root:

```bash
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=https://your-app.base44.app
```

`VITE_BASE44_APP_ID` identifies the Base44 app.

`VITE_BASE44_APP_BASE_URL` tells the Base44 Vite plugin where to send local `/api` requests. Point it at your deployed Base44 app URL when you want the local frontend to use the hosted backend.

When you use `base44 dev`, the command injects the local Base44 values for you, so `.env.local` is mainly needed for frontend-only workflows.

## Connect and Publish with GitHub

For the initial source-code connection, use Base44's GitHub Integration from the app dashboard. The app owner authorises Base44 Builder, selects the GitHub account/organisation and creates the repository. This establishes two-way sync, so treat the connection as a long-lived source-control decision.

After GitHub is connected, merge local changes to the `main` branch. Base44 syncs those changes back into the app. Then open the Base44 dashboard and publish the app:

```bash
base44 dashboard open
```

## SwapPulse Network and Web3

SwapPulse uses Base44 as the application/orchestration layer and Cairo/Starknet for the self-custodial identity and Web3 trust layer.

Start with:

```text
chain/README.md
chain/OPERATOR_GUIDE.md
```

The live Milestone 1 deployment contains the Starknet smart-account and privacy-preserving identity registry. Phase 2 token, community staking/operator, reward and additional Web3 components remain undeployed until their pinned Cairo build, Starknet Foundry tests and deployment verification pass.

The current `SWAPPULSE_TESTNET` uses a single Starknet Devnet runtime. Community staking is therefore an economic accountability layer for operator services today, not a claim that the current testnet has decentralised consensus validators. The roadmap in `chain/OPERATOR_GUIDE.md` explains how this evolves towards permissionless appchain/rollup operation and token rewards for useful, verifiable work.

Reference infrastructure and migration documentation lives under:

```text
chain/infra/MINI_PC_MIGRATION.md
chain/infra/ZORIN_LOCAL_RELAY.md
```

The canonical public endpoints are:

```text
https://rpc.swappulse.org/rpc
https://relay.swappulse.org
```

Raw Devnet RPC must remain localhost-only. The public RPC gateway is read-only, and blockchain writes go through the authenticated relay. The Starknet path uses the server-side secrets `SWAPPULSE_TX_RELAY_URL` and `SWAPPULSE_TX_RELAY_TOKEN`; privileged keys and relay credentials must never be placed in browser code or committed to the repository.

## Docs & Support

Documentation: [https://docs.base44.com/Integrations/Using-GitHub](https://docs.base44.com/Integrations/Using-GitHub)

Base44 CLI command reference: [https://docs.base44.com/developers/references/cli/commands/introduction](https://docs.base44.com/developers/references/cli/commands/introduction)

Support: [https://app.base44.com/support](https://app.base44.com/support)
