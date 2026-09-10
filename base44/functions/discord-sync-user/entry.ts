import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { discordGuildId, syncDiscordLink } from '../../shared/discordBot.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Sign in required' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const userId = caller.role === 'admin' && body?.user_id ? String(body.user_id) : caller.id;
    const svc = base44.asServiceRole;
    const links = await svc.entities.DiscordAccountLink
      .filter({ user_id: userId, guild_id: discordGuildId(), status: 'verified' }, '-created_date', 1)
      .catch(() => []);
    const link = links?.[0];
    if (!link) return Response.json({ error: 'No verified Discord account is linked.' }, { status: 404 });
    const result = await syncDiscordLink(svc, link, caller.role === 'admin' ? 'admin' : 'interaction');
    return Response.json(result);
  } catch (error) {
    const code = String(error?.message || 'DISCORD_SYNC_FAILED').split(':')[0];
    return Response.json({ error: 'Discord roles could not be refreshed.', code }, { status: 502 });
  }
});
