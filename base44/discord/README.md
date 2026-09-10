# SwapPulse Bot

SwapPulse Bot links Discord membership to SwapPulse trust and staff status. It is designed for a support-first Discord server with private forums for announcements, support, developers and feature requests.

The package is safe by default. Adding the code does not connect a Discord server or change a role. An administrator must configure the backend secrets, preview the setup in **Admin > Users & Security > SwapPulse Bot**, and enter the exact confirmation before the bootstrap function creates anything in Discord.

## Verification routes

### SwapPulse account link

A signed-in collector opens **Settings > Discord** and chooses **Connect Discord account**. Discord OAuth confirms the Discord user, adds the user to the configured server if needed, and creates a link containing IDs and the verification result only.

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

In the Discord Developer Portal:

1. Name the application **SwapPulse Bot** and use the official SwapPulse logo.
2. Add the deployed `discord-link-callback` function URL as the OAuth redirect.
3. Add the deployed `discord-interactions` function URL as the Interactions Endpoint URL.
4. Install the bot in the intended server with `bot` and `applications.commands` scopes.
5. Grant only View Channels, Send Messages, Read Message History, Manage Roles, Manage Channels, Manage Messages, Manage Threads and Manage Events. Do not grant Administrator.
6. Keep the bot's own role above every role that it manages.
7. Configure Cloudflare Turnstile for `swappulse.org`.

## Safe activation

1. Configure all environment variables.
2. Open the SwapPulse admin dashboard.
3. Select **Users & Security**.
4. Open the **SwapPulse Bot** preview and inspect the proposed roles and channels.
5. Enter `CREATE_SWAPPULSE_DISCORD_STRUCTURE` only when the guild ID and bot application are correct.
6. Run **Sync roles now**.
7. Test `/verify`, `/roles` and `/support` with a non-admin test member.
8. Check that unverified members can see only the verification area and that Collector can see the support forums.

Bootstrap creates one public verification channel and four Collector-only forums. It does not rewrite permissions on existing Discord channels. Review existing channels manually before hiding them, since changing an established server's permissions automatically could lock out members or staff.

## Operational boundaries

- Role decisions come from SwapPulse entities and are recalculated. Discord is not the source of truth.
- Bot and OAuth secrets stay in backend environment variables.
- Every role grant, removal and failure is written to the administrator-only `DiscordRoleSyncAudit` entity.
- Account links never contain access or refresh tokens.
- Setup is idempotent by role and channel name.
- A role hierarchy error is surfaced for an administrator to fix. It is not bypassed.
