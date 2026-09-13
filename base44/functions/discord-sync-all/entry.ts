import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { configuredForDiscord, getGuildConfig, syncDiscordLink } from '../../shared/discordBot.ts';

// Scheduled runs must not fail when Discord simply isn't set up yet — these
// states are expected until an admin finishes the integration.
const SKIP_CODES = new Set(['DISCORD_NOT_BOOTSTRAPPED']);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });
    const svc = base44.asServiceRole;
    // Retention cleanup must run even when role synchronisation is disabled.
    const challengeCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await svc.entities.DiscordVerificationChallenge
      .deleteMany({ expires_at: { $lt: challengeCutoff } });
    if (!configuredForDiscord()) {
      return Response.json({ ok: true, skipped: true, code: 'DISCORD_CONFIG_MISSING', considered: 0, synced: 0, failed: 0 });
    }
    let config;
    try {
      config = await getGuildConfig(svc, false);
    } catch (error) {
      const code = String(error?.message || '').split(':')[0];
      if (SKIP_CODES.has(code)) {
        return Response.json({ ok: true, skipped: true, code, considered: 0, synced: 0, failed: 0 });
      }
      throw error;
    }
    // Emergency removals run ahead of grants. A disabled guild still retries
    // pending revocations. Oldest-first scheduling rotates through the
    // backlog because every attempted link receives last_role_sync_at.
    const pending = await svc.entities.DiscordAccountLink
      .filter({ guild_id: config.guild_id, status: 'revocation_pending' }, 'last_role_sync_at', 100);
    const active = config.enabled
      ? await svc.entities.DiscordAccountLink
        .filter({ guild_id: config.guild_id, status: 'verified' }, 'last_role_sync_at', 400)
      : [];
    const links = [...pending, ...active];
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
      pending_revocations: pending.length,
      batch_full: pending.length === 100 || active.length === 400,
      synced: results.filter((item) => item.ok).length,
      failed: results.filter((item) => !item.ok).length,
      results,
    });
  } catch (error) {
    const code = String(error?.message || 'DISCORD_SYNC_FAILED').split(':')[0];
    return Response.json({ error: 'Discord role synchronisation failed.', code }, { status: 500 });
  }
});