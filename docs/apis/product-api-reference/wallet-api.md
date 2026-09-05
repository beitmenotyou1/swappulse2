---
description: Staking, faucet, recovery and chain-action endpoints.
---

# Wallet API

Wallet endpoints prepare and submit supported SwapPulse chain actions. Signing and final user approval remain explicit parts of the flow.

## Staking status

{% openapi src="https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml" path="/functions/chain-staking-status" method="post" %}
[https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml](https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml)
{% endopenapi %}

## Faucet claim

{% openapi src="https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml" path="/functions/faucet-claim" method="post" %}
[https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml](https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml)
{% endopenapi %}

## Recovery

{% openapi src="https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml" path="/functions/chain-recovery" method="post" %}
[https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml](https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml)
{% endopenapi %}

## Draft a chain action

{% openapi src="https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml" path="/functions/chain-action-draft" method="post" %}
[https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml](https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml)
{% endopenapi %}

## Submit a chain action

{% openapi src="https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml" path="/functions/chain-action-submit" method="post" %}
[https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml](https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml)
{% endopenapi %}

## Safety guidance

* Display the destination, action, amount and fees before signing.
* Treat drafts as untrusted until the wallet validates them.
* Never collect a seed phrase or private key.
* Submission does not guarantee finalisation. Poll the receipt or status until the required finality level is reached.
* Make retries idempotent and prevent duplicate submissions.
