import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { configuredForDiscord, getGuildConfig, syncDiscordLink } from '../../shared/discordBot.ts';

// Scheduled runs must not fail when Discord simply isn't set up yet — these
// states are expected until an admin finishes the integration.
const SKIP_CODES = new Set(['DISCORD_NOT_BOOTSTRAPPED', 'DISCORD_SYNC_DISABLED']);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });
    if (!configuredForDiscord()) {
      return Response.json({ ok: true, skipped: true, code: 'DISCORD_CONFIG_MISSING', considered: 0, synced: 0, failed: 0 });
    }
    const svc = base44.asServiceRole;
    let config;
    try {
      config = await getGuildConfig(svc, true);
    } catch (error) {
      const code = String(error?.message || '').split(':')[0];
      if (SKIP_CODES.has(code)) {
        return Response.json({ ok: true, skipped: true, code, considered: 0, synced: 0, failed: 0 });
      }
      throw error;
    }
    // Verification URLs are short-lived. Keep their hashes only long enough
    // to diagnose a recent failure, then remove them as part of normal upkeep.
    const challengeCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await svc.entities.DiscordVerificationChallenge
      .deleteMany({ expires_at: { $lt: challengeCutoff } })
      .catch(() => null);

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
      expired_challenges_removed_before: challengeCutoff,
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