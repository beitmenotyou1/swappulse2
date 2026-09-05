---
description: Product-level chain explorer queries.
---

# Chain Explorer API

The product-level chain explorer endpoint provides curated chain data for SwapPulse interfaces. It is distinct from the lower-level JSON-RPC gateway.

## Chain explorer

{% openapi src="https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml" path="/functions/chain-explorer" method="post" %}
[https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml](https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml)
{% endopenapi %}

## Guidance

* Use this endpoint for application views that need normalised SwapPulse chain data.
* Use the read-only RPC gateway when you need an approved Starknet JSON-RPC method.
* Treat pending and finalised states differently in the interface.
* Do not infer successful settlement from transaction submission alone.
