// trigger-sync — manual sync trigger for admins.
//
// Allows an authenticated admin to manually invoke any TCGDex sync service:
//   { job: "catalog" }       → invokes sync-tcgdex-catalog
//   { job: "pricing" }       → invokes syncPricing
//   { job: "localization" } → invokes sync-localizations (batch)
//   { job: "card", cardId } → invokes sync-localizations (single card)
//
// Useful for testing, initial data population, or recovering from a
// prolonged TCGDex API outage. The invoked functions do their own admin
// auth check, so the token is forwarded via base44.functions.invoke.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { createLogger } from '../../shared/logger.ts';

const logger = createLogger('trigger-sync');

type SyncJob = 'catalog' | 'pricing' | 'localization' | 'card';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { job, cardId } = body as { job: SyncJob; cardId?: string };

    if (!job) {
      return Response.json(
        { error: 'Missing "job" field. Valid: catalog, pricing, localization, card' },
        { status: 400 },
      );
    }

    logger.info('Manual sync triggered', { job, cardId, caller: caller.email });

    switch (job) {
      case 'catalog': {
        // Fire-and-forget: catalog sync processes 20 sets and can take >2min,
        // which exceeds the function-to-function HTTP timeout. Start it in the
        // background and return immediately.
        base44.functions
          .invoke('sync-tcgdex-catalog', {})
          .catch((e: any) => logger.warn('Catalog sync background invocation failed', { error: e?.message }));
        return Response.json({
          status: 'triggered',
          job: 'catalog',
          message: 'Catalog sync started in background. Check sync status in Admin dashboard.',
        });
      }

      case 'pricing': {
        base44.functions
          .invoke('syncPricing', {})
          .catch((e: any) => logger.warn('Pricing sync background invocation failed', { error: e?.message }));
        return Response.json({
          status: 'triggered',
          job: 'pricing',
          message: 'Pricing sync started in background.',
        });
      }

      case 'localization': {
        const res = await base44.functions.invoke('sync-localizations', {});
        return Response.json({ status: 'completed', job: 'localization', result: res.data ?? res });
      }

      case 'card': {
        if (!cardId) {
          return Response.json(
            { error: 'cardId is required when job is "card"' },
            { status: 400 },
          );
        }
        const res = await base44.functions.invoke('sync-localizations', { cardId });
        return Response.json({ status: 'completed', job: 'card', cardId, result: res.data ?? res });
      }

      default:
        return Response.json(
          { error: `Unknown job: ${job}. Valid: catalog, pricing, localization, card` },
          { status: 400 },
        );
    }
  } catch (error: any) {
    logger.error('trigger-sync failed', error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}