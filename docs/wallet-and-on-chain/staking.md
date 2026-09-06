---
description: >-
  Detailed rules for SwapPulse community staking, operator registration,
  delegation, unbonding, withdrawal, exit, verification gating and
  chain-authoritative state.
---

# Community Staking

SwapPulse community staking is the economic-accountability layer for community-operated services on the current testnet.

{% hint style="warning" %}
Current staking uses testnet SWPX. It does not yet secure permissionless blockchain consensus and should not be described as an investment or production yield product.
{% endhint %}

## Community operators, not consensus validators

Some Cairo and Base44 fields retain the historical term `validator` for ABI compatibility. In the product these actors are **community operators**.

Today, operator stake represents accountability for supported application/network services such as availability, indexing and verification duties. The current network architecture is not yet a decentralised permissionless validator set.

## Ways to participate

There are two main participation modes:

1. **Community operator** - register an eligible smart account, bond minimum self-stake and operate supported services.
2. **Delegator** - delegate SWPX to an active operator without registering as an operator yourself.

## Eligibility gate

New value-bearing staking writes require current identity assurance.

The application checks both:

* the private Base44 verifier assertion; and
* the public V2 chain attestation.

Current chain-side policy requires a current ACTIVE assertion with the configured verifier, verification type `1`, verification level `>= 2` and a non-zero attestation/replay identifier.

If either private or public assurance expires or is revoked, new staking writes fail closed.

Existing stake does **not** disappear when verification expires.

## Chain-authoritative state

The public `StakingPool` contract is authoritative for operator/delegation state.

Base44 mirrors support UX, history and propagation handling, but they are not the balance ledger.

`chain-staking-status` reads the verified public RPC and reports current operator state such as:

```
NONE
ACTIVE
EXITING
SLASHED
```

The UI must follow chain state when deciding which lifecycle action is valid.

## Operator registration

Operator registration requires, at minimum:

* caller-owned active chain identity;
* current verification eligibility;
* valid smart-account binding;
* minimum required self-stake;
* commission within the configured allowed range;
* no existing operator registration for the account.

A duplicate registration is invalid.

If the account is already ACTIVE, the UI offers **Increase operator self-stake** instead of a second registration.

The backend independently enforces this and returns `OPERATOR_ALREADY_REGISTERED` for a duplicate registration attempt.

## Increase self-stake

An existing active operator can add more self-stake without re-registering or replacing the existing commission setting.

The action uses the current operator record and increases bonded self-stake according to the contract's accounting rules.

The UI should never make an active operator fill out a new registration form just to add stake.

## Commission

Commission is set at operator registration and must remain inside the contract's configured range.

The commission field represents the operator's configured share/rate for future reward logic. Testnet configuration should not be interpreted as a promise of production rewards.

A self-stake increase does not implicitly change the commission.

## Delegation

To delegate:

1. secure and verify your SwapPulse smart-account identity;
2. open Wallet -> Community Staking;
3. choose an active external operator;
4. enter the amount to delegate;
5. approve/confirm the exact user-signed transaction;
6. wait for public-chain confirmation and reconciliation.

The backend checks current operator state before issuing the signed transaction draft.

Self-delegation and invalid operator targets are rejected according to the contract/backend policy.

## Request undelegation

Delegated stake is not immediately withdrawable.

A request to undelegate:

* reduces active delegated weight according to contract rules;
* creates a pending/unbonding position;
* records the amount and timing needed for later withdrawal;
* cannot exceed the user's active delegation.

The backend rechecks the current public delegation before creating the action draft.

## Unbonding delay

Unbonding creates a delay between requesting exit of stake and withdrawing it.

This delay prevents participants from instantly removing accountable stake during a lifecycle transition or potential penalty window.

The exact current delay should be read from the verified contract/network configuration rather than hard-coded into third-party clients.

## Withdrawal

Withdrawal is only valid after the applicable unbonding period has matured.

The backend checks:

* a pending withdrawal/unbonding amount exists;
* the requested withdrawal corresponds to current chain state;
* the unlock time has passed;
* the operator/delegation lifecycle permits withdrawal.

A premature withdrawal attempt is rejected.

## Operator exit

Exiting an operator is a deliberate lifecycle transition, not an instant delete.

The UI uses a deliberate confirmation flow before submitting operator exit.

Once exiting:

* the account cannot simply register a second operator to bypass the lifecycle;
* self-stake may remain locked for the applicable delay;
* existing state remains auditable;
* later withdrawal is permitted only when contract timing/state allows it.

## Slashed state

A `SLASHED` operator is not treated as an unregistered account.

The UI blocks a second registration while the chain reports `SLASHED`, and lifecycle handling follows the contract state rather than creating a new parallel operator record.

Slashing during exit and related edge cases are part of the Cairo test coverage.

## Expired or revoked identity

When the user's V2 assurance expires or is revoked:

* the identity anchor remains;
* existing operator registration remains;
* existing self-stake remains on-chain;
* existing delegation remains on-chain;
* read-only position display can continue;
* new staking writes are locked;
* permanent V2-only network policy remains unchanged.

After a fresh V2 assertion is issued and reconciled, eligible staking actions can become available again without recreating the operator.

## Transaction drafting and signing

Staking writes use the protected Base44 draft/sign/submit flow.

Base44:

1. authenticates the user;
2. verifies current identity/value eligibility;
3. reads verified network/staking state;
4. constructs the exact intended calldata;
5. issues a short-lived action draft;
6. receives the user's explicit Stark signature;
7. verifies the signature against the expected intent;
8. recomputes/validates calldata at submission time;
9. forwards only the approved allowlisted call to the relay.

The relay allows only approved StakingPool entrypoints and rejects arbitrary invokes.

## Reconciliation

After submission, Base44 does not treat a local row or relay response as final balance truth.

The public chain is read again and stake mirrors are reconciled.

Periodic chain-event reconciliation advances lifecycle mirrors for submitted actions, unbonding timestamps, pending amounts and completed withdrawals.

## Base44 StakePosition records

`StakePosition` can record useful private/application metadata such as:

* submitted action history;
* known operator addresses;
* pending propagation state;
* unbonding timestamps/amounts;
* notification/reconciliation state.

It must not override contradictory `StakingPool` state.

## Proof of Usership

SwapPulse also has a `ProofOfUsership` contract for public epoch-bound usership results.

Off-chain activity can contribute to an approved usership score/commitment without publishing the user's full activity history on-chain.

Any future effect of usership on staking weight/rewards must be governed by published deterministic rules and tested contract/application logic. Do not infer future token economics from current testnet experimentation.

## Current tested behaviours

Coverage includes:

* operator registration permissions;
* minimum self-stake rules;
* duplicate registration rejection;
* self-stake increase lifecycle;
* delegation rules;
* self-delegation/invalid delegation controls;
* partial undelegation;
* withdrawal timing;
* operator exit;
* slashing during exit;
* verification gating;
* expired/revoked identity behaviour;
* malicious/unexpected caller handling.

## Safe UX rules

The Wallet should:

* show current chain-authoritative operator status;
* show existing positions even when new writes are locked;
* offer self-stake increase for an active operator;
* prevent duplicate registration flows;
* explain unbonding/withdrawal timing before signature;
* distinguish submitted/pending mirrors from confirmed chain state;
* explain when verification expiry is the reason an action is unavailable.

## Related pages

* Cairo Contracts Reference
* Verifier Logic and Assurance
* Chain State and Reconciliation
* Transaction Relay API and Policy
* SwapPulse V2 Live Architecture
