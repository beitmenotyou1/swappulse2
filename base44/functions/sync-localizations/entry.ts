// sync-localizations — fetches full card data in all 17 TCGDex-supported
// languages and populates the TcgdexCard entity's `names` JSONB and
// per-language `name_norm_{lang}` fields.
//
// Two modes:
//   1. On-demand (single card): pass { cardId } in the request body.
//      Fetches all 17 languages for that card and updates the record.
//   2. Batch: no cardId. Finds TcgdexCard records with fewer than 17
//      languages in `names` and localizes them (up to BATCH_LIMIT per run).
//
// Admin-only. Uses getCardInAllLanguages from the shared tcgdexClient
// (17 API calls per card, rate-limited at 10 req/s by the sliding window).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getCardInAllLanguages, toInternalLang } from '../../shared/tcgdexClient.ts';
import { normalizeName } from '../../shared/scannerLearning.ts';
import { createLogger } from '../../shared/logger.ts';
import { SyncStats, safeExecute } from '../../shared/syncUtils.ts';

const logger = createLogger('sync-localizations');

// Each card makes 17 API calls. At 10 req/s that's ~1.7s per card.
// Keep the batch small to stay well within the function timeout.
const BATCH_LIMIT = 5;
const TARGET_LANG_COUNT = 17;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const { cardId } = body;

    // On-demand single card localization
    if (cardId) {
      logger.info('On-demand localization', { cardId, caller: caller.email });
      const result = await syncCardLocalizations(svc, cardId);
      return Response.json({ ok: true, ...result });
    }

    // Batch mode: find cards with incomplete localizations
    const stats = new SyncStats();
    logger.info('Batch localization starting', { batchLimit: BATCH_LIMIT });

    // Fetch a larger pool than BATCH_LIMIT so we can skip already-complete cards
    const pool = await svc.entities.TcgdexCard.list('-created_date', BATCH_LIMIT * 4);

    const toSync: any[] = [];
    for (const card of pool) {
      const langCount = card.names ? Object.keys(card.names).length : 0;
      if (langCount < TARGET_LANG_COUNT) {
        toSync.push(card);
      }
      if (toSync.length >= BATCH_LIMIT) break;
    }

    if (toSync.length === 0) {
      logger.info('No cards need localization');
      return Response.json({ ok: true, processed: 0, message: 'All sampled cards are fully localized' });
    }

    stats.incrementProcessed(toSync.length);

    for (const card of toSync) {
      const result = await safeExecute(
        () => syncCardLocalizations(svc, card.card_id, card.id),
        { cardId: card.card_id, success: false, languagesSynced: 0, error: 'safeExecute fallback' },
        { cardId: card.card_id },
      );

      if (result.success) {
        stats.incrementSucceeded();
      } else {
        stats.incrementFailed();
        stats.addError(card.card_id, result.error || 'Unknown error');
      }
    }

    logger.info('Batch localization completed', { stats: stats.toJSON() });

    return Response.json({
      ok: true,
      processed: toSync.length,
      succeeded: stats.toJSON().itemsSucceeded,
      failed: stats.toJSON().itemsFailed,
      durationSeconds: stats.getDurationSeconds(),
      results: stats.toJSON().errors,
    });
  } catch (error: any) {
    logger.error('sync-localizations failed', error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}

// ============================================================
// Single Card Localization
// ============================================================

async function syncCardLocalizations(
  svc: any,
  cardId: string,
  entityId?: string,
): Promise<{ cardId: string; success: boolean; languagesSynced: number; error?: string }> {
  try {
    // Look up the entity ID if not provided
    if (!entityId) {
      const existing = await svc.entities.TcgdexCard.filter({ card_id: cardId }, '-created_date', 1);
      if (!existing || existing.length === 0) {
        return { cardId, success: false, languagesSynced: 0, error: 'Card not found in database' };
      }
      entityId = existing[0].id;
    }

    // Fetch all 17 language versions from TCGDex
    const localizations = await getCardInAllLanguages(cardId);
    const apiLangCount = Object.keys(localizations).length;

    if (apiLangCount === 0) {
      return { cardId, success: false, languagesSynced: 0, error: 'No languages fetched from TCGDex' };
    }

    // Build the names object and name_norm_{lang} fields using internal lang codes
    // (TCGDex API uses ja/zh-tw; our entity uses jp/zh)
    const names: Record<string, string> = {};
    const update: any = { names, last_synced_at: new Date().toISOString() };

    for (const [apiLang, data] of Object.entries(localizations)) {
      const internalLang = toInternalLang(apiLang);
      const localizedData = data as { name?: string; description?: string; image?: string };
      if (localizedData.name) {
        names[internalLang] = localizedData.name;
        const normField = `name_norm_${internalLang}`;
        update[normField] = normalizeName(localizedData.name);
      }
    }

    // Update description and image from the English version (authoritative)
    if (localizations.en?.description) {
      update.description = String(localizations.en.description).slice(0, 1000);
    }
    if (localizations.en?.image) {
      update.image = localizations.en.image;
    }

    await svc.entities.TcgdexCard.update(entityId, update);

    const languagesSynced = Object.keys(names).length;
    logger.debug('Card localized', { cardId, languagesSynced });

    return { cardId, success: true, languagesSynced };
  } catch (error: any) {
    logger.error('Card localization failed', error, { cardId });
    return { cardId, success: false, languagesSynced: 0, error: error?.message || 'Unknown error' };
  }
}