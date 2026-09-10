import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getGuildConfig, syncDiscordLink } from '../../shared/discordBot.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });
    const svc = base44.asServiceRole;
    const config = await getGuildConfig(svc, true);
    const links = await svc.entities.DiscordAccountLink
      .filter({ guild_id: config.guild_id }, 'last_role_sync_at', 500)
      .catch(() => []);
    const results = [];
    for (const link of links) {
      try {
        const result = await syncDiscordLink(svc, link, 'scheduled');
        results.push({ link_id: link.id, ok: true, roles: result.desired_roles });
      } catch (error) {
        results.push({ link_id: link.id, ok: false, code: String(error?.message || 'DISCORD_SYNC_FAILED').split(':')[0] });
      }
    }
    await svc.entities.DiscordGuildConfig.update(config.id, { last_sync_at: new Date().toISOString() });
    return Response.json({
      ok: true,
      considered: links.length,
      synced: results.filter((item) => item.ok).length,
      failed: results.filter((item) => !item.ok).length,
      results,
    });
  } catch (error) {
    const code = String(error?.message || 'DISCORD_SYNC_FAILED').split(':')[0];
    return Response.json({ error: 'Discord role synchronisation failed.', code }, { status: 500 });
  }
});
