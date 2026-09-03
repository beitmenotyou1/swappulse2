import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { checkTcgdex, checkPokewallet, checkDatabase } from '../../shared/healthChecks.ts';
import { getPokeWalletUsageStatus } from '../../shared/pokewalletClient.ts';

async function count(base44, name, query) {
  try {
    const items = await base44.asServiceRole.entities[name].filter(query || {}, '-created_date', 1000);
    return { count: items.length, capped: items.length === 1000 };
  } catch (e) {
    return { count: 0, error: e?.message || String(e) };
  }
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const [tcgdex, pokewallet, database, pokewalletUsage, users, trades, collections, posts, circles, invites] = await Promise.all([
      checkTcgdex(),
      checkPokewallet(),
      checkDatabase(base44),
      getPokeWalletUsageStatus(base44.asServiceRole).catch(() => null),
      count(base44, 'User'),
      count(base44, 'TradeListing', { status: 'open' }),
      count(base44, 'CollectionEntry'),
      count(base44, 'Post'),
      count(base44, 'Circle'),
      count(base44, 'InviteCode', { status: 'active' }),
    ]);

    return Response.json({
      health: { tcgdex, pokewallet, database },
      pokewallet_usage: pokewalletUsage,
      counts: { users, trades, collections, posts, circles, invites },
      generated_at: new Date().toISOString(),
    });
  } catch (e) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}