---
description: Explore and following-feed endpoints.
---

# Community API

Community endpoints return public discovery content and personalised feeds.

## Explore feed

{% openapi src="https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml" path="/functions/get-explore-feed" method="post" %}
[https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml](https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml)
{% endopenapi %}

## Following feed

{% openapi src="https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml" path="/functions/get-follow-feed" method="post" %}
[https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml](https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml)
{% endopenapi %}

## Guidance

* Use the returned cursor rather than constructing one.
* Signed-in and personalised results must not be cached across users.
* Community content may be moderated, removed or made unavailable after it is returned.
* Render user-generated text safely and preserve content labels.
