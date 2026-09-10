# SwapPulse Bot

SwapPulse Bot links Discord membership to SwapPulse trust and staff status. It is designed for a support-first Discord server with private forums for announcements, support, developers and feature requests.

The package is safe by default. Adding the code does not connect a Discord server or change a role. An administrator must configure the backend secrets, preview the setup in **Admin > Users & Security > SwapPulse Bot**, and enter the exact confirmation before the bootstrap function creates anything in Discord.

## Verification routes

### SwapPulse account link

A signed-in collector opens **Settings > Discord** and chooses **Connect Discord account**. The page tells the collector that Discord will ask to identify their account and add it to the official SwapPulse server if they are not already a member. Discord OAuth records that explicit consent, confirms the Discord user, adds the user to the configured server if needed, and creates a link containing IDs and the verification result only.

The OAuth access token is used for that request and is not stored. The linked member receives **Collector** and **Verified SwapPulse Account**, followed by any roles justified by current SwapPulse data.

### CAPTCHA-only verification

A Discord member runs `/verify`. The bot returns a private, single-use link which expires after 15 minutes. The link is bound to that Discord user ID before the CAPTCHA is shown. A successful check grants **Collector** only.

CAPTCHA answers and response tokens are not stored.

## Managed roles

| Discord role | SwapPulse evidence |
| --- | --- |
| Collector | A verified SwapPulse account link or a valid Discord-bound CAPTCHA |
| Verified SwapPulse Account | A Discord account linked to an authenticated SwapPulse account |
| Verified Trader | At least 3 completed trades, at least 3 ratings, a 4.5 average or better, and no pending or reviewed dispute |
| Trusted Trader | The trusted_trader achievement, or at least 10 completed trades with a 4.75 average or better and no active dispute |
| Contributor | A relevant community achievement or at least 3 granted achievements |
| Event Organiser | A completed meetup or the community_voice achievement |
| Moderator | The current SwapPulse moderator role |
| Administrator | The current SwapPulse administrator role |

The numeric thresholds are stored in `DiscordGuildConfig` and can be changed without changing code. A suspended or shadow-banned linked SwapPulse account loses all managed Discord roles. The 30-minute reconciliation workflow also removes roles when reputation, achievements or site roles no longer qualify.

The bot-managed Administrator role intentionally does not receive Discord's unrestricted Administrator permission. It receives the narrower channel, message, event, nickname, thread and role-management permissions needed for community support.

## Required backend environment variables

Configure these in Base44's backend environment settings. Never put them in a client file or entity record.

- `DISCORD_BOT_TOKEN`
- `DISCORD_APPLICATION_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_PUBLIC_KEY`
- `DISCORD_GUILD_ID`
- `DISCORD_REDIRECT_URI`
- `DISCORD_LINK_STATE_SECRET`, at least 32 random bytes
- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`

## Discord Developer Portal checklist

The screenshots supplied for the current application show the app named **SwapPulse**, a generic icon, a blank interaction endpoint, no OAuth redirect, blank legal URLs, user installation enabled, and guild installation with only `applications.commands` and permission value `0`. That state cannot run the bot safely.

Configure the portal as follows before running the confirmed bootstrap:

1. General Information: rename the application **SwapPulse Bot**, upload the official SwapPulse logo, and add `https://swappulse.org/terms` and `https://swappulse.org/privacy`.
2. Installation: keep **Guild Install** enabled and disable **User Install**. This bot is bound to one configured server.
3. Default Guild Install: select `bot` and `applications.commands`. Request only Create Instant Invite, Manage Channels and Manage Roles, permission integer `268435473`.
4. OAuth2: add exactly `https://swappulse.org/functions/discord-link-callback` as a redirect URI. Keep Public Client off.
5. Bot: keep Require OAuth2 Code Grant off. Keep Presence, Server Members and Message Content privileged intents off. Keep Public Bot off during the private single-server rollout.
6. Install or re-authorise the bot in the intended server, then place its integration role above every SwapPulse-managed role.
7. Configure Cloudflare Turnstile for `swappulse.org`.

The confirmed bootstrap checks those prerequisites before creating roles or channels. It then sets `https://swappulse.org/functions/discord-interactions` as the interaction endpoint and applies the description, tags, guild-install defaults and logo through Discord's authenticated application API.

Activities, the Discord Social SDK, Rich Presence, game profiles, monetisation, webhook events and privileged Gateway intents are not used. SwapPulse is using a standard server-installed bot, signed HTTP interactions, web OAuth2 and targeted REST calls. Native Linked Roles are also not used because SwapPulse recalculates and directly manages server roles from its own reputation and staff records.

## Safe activation

1. Configure all environment variables.
2. Open the SwapPulse admin dashboard.
3. Select **Users & Security**.
4. Open the **SwapPulse Bot** preview and inspect the proposed roles and channels.
5. Enter `CREATE_SWAPPULSE_DISCORD_STRUCTURE` only when the guild ID and bot application are correct.
6. Run **Sync roles now**.
7. Test `/verify`, `/roles` and `/support` with a non-admin test member.
8. Confirm that bot responses follow the member's Discord language, and that `/roles` prefers a linked collector's SwapPulse account language.
9. Check that unverified members can see only the verification area and that Collector can see the support forums.

Bootstrap creates one public verification channel and four Collector-only forums. It does not rewrite permissions on existing Discord channels. Review existing channels manually before hiding them, since changing an established server's permissions automatically could lock out members or staff.

## Operational boundaries

- Role decisions come from SwapPulse entities and are recalculated. Discord is not the source of truth.
- Bot and OAuth secrets stay in backend environment variables.
- Every role grant, removal and failure is written to the administrator-only `DiscordRoleSyncAudit` entity.
- Account links never contain access or refresh tokens.
- Setup is idempotent by role and channel name, topic, forum tags and permission overwrites.
- Discord HTTP 429 responses honour `Retry-After`/`retry_after`; longer limits stop safely for the next scheduled reconciliation.
- Interaction requests require Discord's Ed25519 signature, a fresh timestamp, the configured application ID and the configured guild ID.
- Slash commands are guild-install and guild-context only. `/roles` reports the last reconciled role state without doing slow network work inside Discord's three-second response window.
- A role hierarchy error is surfaced for an administrator to fix. It is not bypassed.
