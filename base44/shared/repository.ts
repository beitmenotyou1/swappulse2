/**
 * Card Data Repository — Base44 Platform Adapter
 *
 * Provides CRUD operations for card series, sets, cards, price history,
 * and sync status, bridging the TCGDex API client to persistent storage.
 *
 * On Base44, storage is via the entities SDK (base44.entities.*).
 * The TcgdexCard entity serves as the primary card cache / catalog store.
 * The TcgdexSyncState entity tracks sync cursor progress.
 *
 * All write operations use upsert semantics (update if exists, create if not).
 * Read operations support multi-language retrieval with fallback to English.
 *
 * For self-hosted deployments using PostgreSQL 17, see:
 *   base44/db/migrations/001-007 for the full schema.
 *
 * @author SwapPulse
 * @version 1.0.0
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { cacheGetOrSet, cacheDelete, cacheDeletePattern, CacheKeys, CacheTTL } from './cache.ts';
import { SUPPORTED_LANGUAGES, validateLanguage } from './tcgdexClient.ts';

// ============================================================
// Types
// ============================================================

export interface LocalizedCardData {
  name: string;
  description?: string;
  image?: string;
}

export interface LocalizedSetData {
  name: string;
  logo?: string;
  symbol?: string;
}

export interface SyncStats {
  seriesProcessed?: number;
  setsProcessed?: number;
  cardsUpserted?: number;
  cardsSkipped?: number;
  errors?: string[];
  [key: string]: unknown;
}

// ============================================================
// Repository Factory — call once per request with the Base44 client
// ============================================================

export function createRepository(base44: ReturnType<typeof createClientFromRequest>) {
  const entities = base44.entities as any;

  // ============================================================
  // Cards Repository
  // ============================================================

  const CardsRepo = {
    /**
     * Upserts a card from TCGDex data into the TcgdexCard entity.
     * Merges localizations from all languages without overwriting existing ones.
     */
    async upsert(card: any, setId: string, lang: string = 'en'): Promise<void> {
      const existing = await entities.TcgdexCard.filter({ card_id: card.id }, undefined, 1);
      const record = existing[0];

      const nameNormKey = `name_norm_${lang}`;
      const normName = (card.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      const data: Record<string, unknown> = {
        card_id: card.id,
        set_id: setId,
        name: record?.name || card.name,
        local_id: String(card.localId ?? ''),
        rarity: card.rarity ?? null,
        image: card.image ?? null,
        last_synced_at: new Date().toISOString(),
        [nameNormKey]: normName,
      };

      // Merge names map
      const names: Record<string, string> = { ...(record?.names ?? {}), [lang]: card.name };
      data.names = names;

      // Merge description into existing record safely
      if (card.description) {
        data.description = card.description;
      }

      if (record) {
        await entities.TcgdexCard.update(record.id, data);
      } else {
        await entities.TcgdexCard.create(data);
      }

      await cacheDeletePattern(`sp:card:${card.id}:*`);
    },

    /**
     * Batch upserts card briefs from a set listing.
     * More efficient than calling upsert individually — uses bulkCreate for new cards.
     */
    async batchUpsertBriefs(cards: any[], setId: string, lang: string = 'en'): Promise<number> {
      if (cards.length === 0) return 0;

      // Fetch existing IDs in this set to determine creates vs updates
      const existing = await entities.TcgdexCard.filter({ set_id: setId });
      const existingMap = new Map(existing.map((c: any) => [c.card_id, c]));

      const toCreate: any[] = [];
      const toUpdate: Array<{ id: string; data: Record<string, unknown> }> = [];

      for (const card of cards) {
        const normKey = `name_norm_${lang}`;
        const normName = (card.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

        if (existingMap.has(card.id)) {
          const rec = existingMap.get(card.id) as any;
          toUpdate.push({
            id: rec.id,
            data: {
              [normKey]: normName,
              names: { ...(rec.names ?? {}), [lang]: card.name },
              last_synced_at: new Date().toISOString(),
            },
          });
        } else {
          toCreate.push({
            card_id: card.id,
            set_id: setId,
            name: card.name,
            local_id: String(card.localId ?? ''),
            rarity: card.rarity ?? null,
            image: card.image ?? null,
            [normKey]: normName,
            names: { [lang]: card.name },
            last_synced_at: new Date().toISOString(),
          });
        }
      }

      if (toCreate.length > 0) {
        await entities.TcgdexCard.bulkCreate(toCreate);
      }
      if (toUpdate.length > 0) {
        await entities.TcgdexCard.bulkUpdate(toUpdate.map(({ id, data }) => ({ id, ...data })));
      }

      return toCreate.length + toUpdate.length;
    },

    /**
     * Gets a card by its TCGDex ID, with Redis-layer cache.
     */
    async getById(cardId: string): Promise<any | null> {
      return cacheGetOrSet(
        CacheKeys.card(cardId, 'en'),
        CacheTTL.CARD,
        async () => {
          const results = await entities.TcgdexCard.filter({ card_id: cardId }, undefined, 1);
          return results[0] ?? null;
        },
      );
    },

    /**
     * Gets the localised name for a card, falling back to English.
     */
    async getLocalizedName(cardId: string, lang: string): Promise<string | null> {
      const card = await CardsRepo.getById(cardId);
      if (!card) return null;
      const validated = validateLanguage(lang as any);
      return card.names?.[validated] ?? card.name ?? null;
    },

    /**
     * Updates multi-language localizations for a card.
     */
    async updateLocalizations(cardId: string, localizations: Record<string, LocalizedCardData>): Promise<void> {
      const existing = await entities.TcgdexCard.filter({ card_id: cardId }, undefined, 1);
      const record = existing[0];
      if (!record) return;

      const updates: Record<string, unknown> = { last_synced_at: new Date().toISOString() };
      const names: Record<string, string> = { ...(record.names ?? {}) };

      for (const [lang, data] of Object.entries(localizations)) {
        if (data.name) {
          names[lang] = data.name;
          const normKey = `name_norm_${lang}`;
          updates[normKey] = data.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        }
      }

      updates.names = names;

      await entities.TcgdexCard.update(record.id, updates);
      await cacheDeletePattern(`sp:card:${cardId}:*`);
    },

    /**
     * Gets cards that need pricing updates (no pricing data yet).
     */
    async getCardsNeedingPricing(limit: number = 250): Promise<any[]> {
      // Filter cards that haven't been synced recently
      const results = await entities.TcgdexCard.list('last_synced_at', limit);
      return results.filter((c: any) => !c.names || Object.keys(c.names).length < 3);
    },

    /**
     * Counts total cards in the catalog.
     */
    async count(): Promise<number> {
      const results = await entities.TcgdexCard.list(undefined, 1);
      // entities.list doesn't return total count — approximate via pagination
      const all = await entities.TcgdexCard.list();
      return all.length;
    },
  };

  // ============================================================
  // Sync Status Repository (backed by TcgdexSyncState entity)
  // ============================================================

  const SyncStatusRepo = {
    /**
     * Marks a sync job as started.
     */
    async markStarted(jobName: string): Promise<void> {
      const existing = await entities.TcgdexSyncState.filter({ current_lang: jobName }, undefined, 1);
      const data = {
        current_lang: jobName,
        last_synced_at: new Date().toISOString(),
        description: `running:${new Date().toISOString()}`,
      };
      if (existing[0]) {
        await entities.TcgdexSyncState.update(existing[0].id, data);
      } else {
        await entities.TcgdexSyncState.create(data);
      }
    },

    /**
     * Marks a sync job as completed with statistics.
     */
    async markCompleted(jobName: string, durationSeconds: number, stats: SyncStats): Promise<void> {
      const existing = await entities.TcgdexSyncState.filter({ current_lang: jobName }, undefined, 1);
      const data = {
        last_synced_at: new Date().toISOString(),
        description: `completed:${durationSeconds}s:${JSON.stringify(stats)}`,
      };
      if (existing[0]) {
        await entities.TcgdexSyncState.update(existing[0].id, data);
      } else {
        await entities.TcgdexSyncState.create({ current_lang: jobName, ...data });
      }
    },

    /**
     * Marks a sync job as failed with an error message.
     */
    async markFailed(jobName: string, errorMessage: string, stats?: SyncStats): Promise<void> {
      const existing = await entities.TcgdexSyncState.filter({ current_lang: jobName }, undefined, 1);
      const data = {
        last_synced_at: new Date().toISOString(),
        description: `failed:${errorMessage}`,
      };
      if (existing[0]) {
        await entities.TcgdexSyncState.update(existing[0].id, data);
      } else {
        await entities.TcgdexSyncState.create({ current_lang: jobName, ...data });
      }
    },

    /**
     * Gets the current sync cursor/status for a job.
     */
    async getStatus(jobName: string): Promise<any | null> {
      const results = await entities.TcgdexSyncState.filter({ current_lang: jobName }, undefined, 1);
      return results[0] ?? null;
    },

    /**
     * Gets all sync job statuses.
     */
    async getAll(): Promise<any[]> {
      return entities.TcgdexSyncState.list();
    },
  };

  // ============================================================
  // Price History (stored within TcgdexCard.names / description as JSONB)
  // For self-hosted deployments, this maps to the card_price_history table.
  // ============================================================

  const PriceHistoryRepo = {
    /**
     * Records a pricing snapshot. On Base44, pricing is stored in
     * the CardPricing entity (see base44/entities/CardPricing.jsonc).
     */
    async insert(cardId: string, source: 'cardmarket' | 'tcgplayer', data: Record<string, unknown>): Promise<void> {
      // CardPricing entity stores pricing snapshots per card
      await entities.CardPricing.create({
        card_id: cardId,
        source,
        price_data: data,
        fetched_at: new Date().toISOString(),
      }).catch(() => {
        // CardPricing may not exist in all deployments — fail silently
      });
    },

    /**
     * Gets price history for a card.
     */
    async getByCard(cardId: string, source?: string, limit: number = 90): Promise<any[]> {
      const filter: Record<string, unknown> = { card_id: cardId };
      if (source) filter.source = source;
      return entities.CardPricing.filter(filter, '-fetched_at', limit).catch(() => []);
    },

    /**
     * Gets the latest price snapshot for a card.
     */
    async getLatest(cardId: string, source: 'cardmarket' | 'tcgplayer'): Promise<any | null> {
      const results = await PriceHistoryRepo.getByCard(cardId, source, 1);
      return results[0] ?? null;
    },
  };

  // ============================================================
  // Health Check
  // ============================================================

  async function dbHealthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'down';
    latencyMs: number;
    details: string;
  }> {
    const start = Date.now();
    try {
      const sample = await entities.TcgdexCard.list(undefined, 1);
      const latencyMs = Date.now() - start;
      return {
        status: 'healthy',
        latencyMs,
        details: `Base44 entity store OK (${sample.length > 0 ? 'cards indexed' : 'empty catalog'})`,
      };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        details: `Error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  return {
    CardsRepo,
    SyncStatusRepo,
    PriceHistoryRepo,
    dbHealthCheck,
  };
}

export default createRepository;