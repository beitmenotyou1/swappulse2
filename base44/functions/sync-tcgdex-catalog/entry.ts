// sync-tcgdex-catalog, incremental TCGDex catalogue sync into the local
// TcgdexCard cache. Resumes from a TcgdexSyncState cursor, processes a batch
// of sets for the current language, upserts cards, then advances/rotates the
// cursor. Rotates through all supported languages so non-English card names
// populate the language-specific name_norm_{lang} fields for multi-language
// scan resolution. Admin-only (service-role writes).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchTcgdex, TCGDEX_LANGS, RateLimiter } from '../../shared/tcgdexClient.ts';
import { normalizeName } from '../../shared/scannerLearning.ts';
import { computePHashFromUrl, buildJpgUrl } from '../../shared/phash.ts';

const SETS_PER_RUN = 20;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const svc = base44.asServiceRole;

    // Load or create sync state (single row).
    let state = (await svc.entities.TcgdexSyncState.list('-created_date', 1))[0];
    if (!state) {
      state = await svc.entities.TcgdexSyncState.create({
        current_lang: 'en', set_index: 0, total_sets: 0, sets_synced: 0,
      });
    }

    const lang = state.current_lang || 'en';
    const limiter = new RateLimiter();

    // Fetch the set list for the current language.
    let setList: any[] = [];
    try {
      const res = await limiter.enqueue(() => fetchTcgdex('/sets', lang));
      setList = Array.isArray(res) ? res : (res?.data || []);
    } catch (e: any) {
      console.error('[sync-tcgdex-catalog] set list fetch failed', e?.message || e);
      return Response.json({ error: `Failed to fetch set list: ${e?.message || e}` }, { status: 502 });
    }
    const totalSets = setList.length;

    const startIdx = state.set_index || 0;
    const endIdx = Math.min(startIdx + SETS_PER_RUN, totalSets);
    const batch = setList.slice(startIdx, endIdx);

    const normField = `name_norm_${lang}`;
    const now = new Date().toISOString();
    let cardsUpserted = 0;
    let setsProcessed = 0;
    let phashComputed = 0;
    const MAX_PHASH_PER_RUN = 100;

    for (const setSummary of batch) {
      const setId = setSummary.id || setSummary.name;
      let setDetail: any = null;
      try {
        setDetail = await limiter.enqueue(() => fetchTcgdex(`/sets/${encodeURIComponent(setId)}`, lang));
      } catch (e: any) {
        console.error('[sync-tcgdex-catalog] set detail fetch failed', setId, e?.message || e);
        continue;
      }
      setsProcessed++;
      const cards = Array.isArray(setDetail?.cards) ? setDetail.cards : [];
      const setName = setDetail?.name || setSummary.name || setId;

      const records: any[] = cards
        .map((c: any) => ({
          card_id: c.id,
          set_id: setId,
          set_name: setName,
          local_id: c.localId || '',
          rarity: c.rarity || '',
          image: typeof c.image === 'string' ? c.image : (c.image?.base ?? ''),
          name: c.name || '',
          [normField]: normalizeName(c.name || ''),
          names: { [lang]: c.name || '' },
          last_synced_at: now,
        }))
        .filter((r: any) => r.card_id);

      if (records.length === 0) continue;

      // Fetch existing records for this batch to upsert.
      const cardIds = records.map((r: any) => r.card_id);
      const existing = await svc.entities.TcgdexCard.filter({ card_id: { $in: cardIds } }, '-created_date', 500).catch(() => []);
      const existingMap = new Map(existing.map((e: any) => [e.card_id, e]));
      const toCreate: any[] = [];
      const toUpdate: any[] = [];
      for (const r of records) {
        const ex = existingMap.get(r.card_id);
        if (ex) {
          const mergedNames = { ...(ex.names || {}), ...(r.names || {}) };
          const update: any = {
            id: ex.id,
            [normField]: r[normField],
            names: mergedNames,
            last_synced_at: now,
            rarity: r.rarity || ex.rarity,
            local_id: r.local_id || ex.local_id,
            image: r.image || ex.image,
            set_id: r.set_id || ex.set_id,
            set_name: r.set_name || ex.set_name,
          };
          if (lang === 'en') update.name = r.name;
          toUpdate.push(update);
        } else {
          toCreate.push(r);
        }
      }
      // Compute pHash for new cards (capped per run to keep sync fast).
      for (const r of toCreate) {
        if (phashComputed >= MAX_PHASH_PER_RUN) break;
        const jpgUrl = buildJpgUrl(r.image);
        if (jpgUrl) {
          const ph = await computePHashFromUrl(jpgUrl).catch(() => null);
          if (ph) { r.phash = ph; phashComputed++; }
        }
      }
      if (toCreate.length) await svc.entities.TcgdexCard.bulkCreate(toCreate).catch((e: any) => console.error('[sync-tcgdex-catalog] bulkCreate failed', e?.message));
      if (toUpdate.length) await svc.entities.TcgdexCard.bulkUpdate(toUpdate).catch((e: any) => console.error('[sync-tcgdex-catalog] bulkUpdate failed', e?.message));
      cardsUpserted += records.length;
    }

    // Advance / rotate the cursor.
    const finishedLang = endIdx >= totalSets;
    const newIdx = finishedLang ? 0 : endIdx;
    const langPos = TCGDEX_LANGS.indexOf(lang);
    const nextLang = finishedLang ? TCGDEX_LANGS[(langPos + 1) % TCGDEX_LANGS.length] : lang;

    await svc.entities.TcgdexSyncState.update(state.id, {
      current_lang: nextLang,
      set_index: newIdx,
      total_sets: totalSets,
      last_synced_at: now,
      sets_synced: (state.sets_synced || 0) + setsProcessed,
    });

    return Response.json({
      ok: true,
      lang,
      sets_processed: setsProcessed,
      cards_upserted: cardsUpserted,
      next_lang: nextLang,
      next_index: newIdx,
      total_sets: totalSets,
      finished_lang: finishedLang,
    });
  } catch (error: any) {
    console.error('[sync-tcgdex-catalog] error', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}