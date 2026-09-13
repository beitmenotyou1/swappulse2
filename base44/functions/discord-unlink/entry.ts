import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { revokeUserDiscordLinks } from '../../shared/discordBot.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Sign in required' }, { status: 401 });
    // The helper keeps every failed link in revocation_pending until Discord
    // confirms that all bot-managed roles have gone.
    const removed = await revokeUserDiscordLinks(base44.asServiceRole, caller.id, 'interaction');
    return Response.json({ ok: true, removed });
  } catch (error) {
    const code = String(error?.message || 'DISCORD_UNLINK_FAILED').split(':')[0];
    return Response.json({
      error: 'Discord access could not be confirmed removed. Please try again or contact support.',
      code, pending_removal: true,
    }, { status: 503 });
  }
});

