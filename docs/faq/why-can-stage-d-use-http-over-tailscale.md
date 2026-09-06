---
description: Why Stage D has a narrow opt-in for private Tailscale HTTP peers.
---

# Why can Stage D use HTTP over Tailscale?

Stage D uses a narrow HTTP exception because both RPC surfaces stay inside a reviewed private Tailscale overlay. The application still blocks ordinary remote HTTP by default.

`SWAPPULSE_ALLOW_TAILSCALE_HTTP=1` permits an HTTP peer only when the URL uses a literal IPv4 address inside Tailscale's `100.64.0.0/10` range. The policy rejects:

* HTTP peers outside that range;
* ordinary private-LAN and public IPv4 addresses;
* hostnames that merely resolve to a Tailscale address;
* embedded usernames or passwords;
* protocols other than HTTP or HTTPS.

This setting is opt-in and is intended for the controlled Stage D node lab. Prefer HTTPS for public or independently operated RPCs. Never use the flag to bypass transport checks for an ordinary LAN or Internet endpoint.

See the [Lite node guide](../network-and-web3/lite-node.md) for the exact setting and the [Full node guide](../network-and-web3/full-node.md) for the private Stage D topology.
