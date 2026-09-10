import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { discordGuildId, syncDiscordLink } from '../../shared/discordBot.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Sign in required' }, { status: 401 });
    const svc = base44.asServiceRole;
    const links = await svc.entities.DiscordAccountLink
      .filter({ user_id: caller.id, guild_id: discordGuildId(), status: 'verified' }, '-created_date', 10)
      .catch(() => []);
    if (!links.length) return Response.json({ ok: true, removed: 0 });

    let removed = 0;
    const failures = [];
    for (const link of links) {
      await svc.entities.DiscordAccountLink.update(link.id, {
        status: 'revoked',
        desired_roles: [],
        last_sync_error: '',
      });
      try {
        await syncDiscordLink(svc, { ...link, status: 'revoked' }, 'interaction');
        removed += 1;
      } catch (error) {
        failures.push(String(error?.message || 'DISCORD_SYNC_FAILED').split(':')[0]);
      }
    }
    return Response.json({ ok: failures.length === 0, removed, pending_removal: failures.length });
  } catch (error) {
    const code = String(error?.message || 'DISCORD_UNLINK_FAILED').split(':')[0];
    return Response.json({ error: 'Discord could not be disconnected.', code }, { status: 502 });
  }
});
