---
description: Age-status and chain-identity endpoints.
---

# Identity API

Identity endpoints expose minimal status data needed by the application. They do not return identity documents or dates of birth.

## Age status

{% openapi src="https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml" path="/functions/age-status" method="post" %}
[https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml](https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml)
{% endopenapi %}

## Chain identity user

{% openapi src="https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml" path="/functions/chain-identity-user" method="post" %}
[https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml](https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml)
{% endopenapi %}

## Privacy guidance

* Request only the status needed for the current action.
* Do not store or log verification secrets or evidence.
* Treat expiry and revocation as normal state transitions.
* Recheck current status before a restricted action rather than relying on a stale client value.
