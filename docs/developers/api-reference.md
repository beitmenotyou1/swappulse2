---
description: The machine-readable SwapPulse API contract and endpoint guidance.
---

# API Reference

GitBook tracks the public `swappulse-api` OpenAPI specification directly from the repository's authoritative `openapi.yaml` file.

{% hint style="info" %}
The OpenAPI source remains authoritative. If this overview and the specification differ, follow the specification and open a documentation issue.
{% endhint %}

## Resources

* [Open the published OpenAPI 3.1 specification](https://swappulse.org/openapi.yaml)
* [View the source specification on GitHub](https://github.com/beitmenotyou1/swappulse2/blob/main/openapi.yaml)
* [Read the backend function guide](backend-function-guide.md)
* [Read the OpenAPI maintenance guide](openapi-contract.md)

## Authentication

Public catalogue and discovery operations do not require a user token. Authenticated product functions use the Base44 application session described by the specification. Sensitive relay, verifier and administrative operations are deliberately excluded from the public contract.

## Versioning

The API contract follows the SwapPulse release process. Compatible changes may add fields or operations. Breaking changes require migration notes and an appropriate versioned release.
