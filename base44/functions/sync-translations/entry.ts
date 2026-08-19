// sync-translations — processes pending TranslationOverride records (records
// with an empty value field) by calling InvokeLLM to translate the English
// source_value into the target language. Batches up to 50 keys per InvokeLLM
// call per language to conserve credits. Idempotent: skips records that already
// have a non-empty value. Admin-triggerable and invoked by a scheduled workflow
// daily during low-traffic hours.
//
// The admin UI seeds pending records by reading translations.js in the frontend,
// finding English keys that are missing from each non-English locale's static
// dictionary, and creating TranslationOverride records with source_value set
// and value empty. This function then picks up those pending records and fills
// in the translations.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const MAX_RECORDS_PER_RUN = 400; // ~50 keys × 8 languages
const BATCH_SIZE = 50;

// Map TCGDex language codes to human-readable language names for the LLM prompt
const LANG_NAMES: Record<string, string> = {
  fr: 'French',
  de: 'German',
  it: 'Italian',
  es: 'Spanish',
  pt: 'Portuguese (Brazilian)',
  jp: 'Japanese',
  zh: 'Chinese (Simplified)',
  ko: 'Korean',
};

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const svc = base44.asServiceRole;

    // Fetch pending records (value is empty or missing)
    const allPending = await svc.entities.TranslationOverride
      .filter({ value: '' }, '-created_date', MAX_RECORDS_PER_RUN)
      .catch(() => []);

    if (!allPending || allPending.length === 0) {
      return Response.json({ processed: 0, translated: 0, errors: 0 });
    }

    // Group by language for batched InvokeLLM calls
    const byLang: Record<string, Array<{ id: string; key: string; source_value: string }>> = {};
    for (const rec of allPending) {
      if (!rec.source_value) continue; // skip records without a source value
      const lang = rec.language;
      if (!byLang[lang]) byLang[lang] = [];
      byLang[lang].push({ id: rec.id, key: rec.translation_key, source_value: rec.source_value });
    }

    let translated = 0;
    let errors = 0;

    for (const [lang, records] of Object.entries(byLang)) {
      const langName = LANG_NAMES[lang] || lang;
      // Process in batches of BATCH_SIZE
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        const keysToTranslate: Record<string, string> = {};
        for (const r of batch) {
          keysToTranslate[r.key] = r.source_value;
        }

        try {
          const prompt = `You are a professional translator for a Pokémon TCG collector platform called SwapPulse. Translate the following UI strings from English to ${langName}. Preserve the meaning and tone. Keep placeholders like {count} or {name} intact. Return a JSON object with the same keys and translated values.\n\n${JSON.stringify(keysToTranslate, null, 2)}`;

          const result = await base44.integrations.Core.InvokeLLM({
            prompt,
            response_json_schema: {
              type: 'object',
              properties: Object.fromEntries(
                batch.map((r) => [r.key, { type: 'string' }])
              ),
              required: batch.map((r) => r.key),
            },
          });

          // result is a dict (since response_json_schema was specified)
          const translations = result as Record<string, string>;

          // Update each record with its translation
          const updates = batch
            .filter((r) => translations[r.key])
            .map((r) => ({
              id: r.id,
              value: translations[r.key],
              generated_at: new Date().toISOString(),
            }));

          if (updates.length > 0) {
            await svc.entities.TranslationOverride.bulkUpdate(updates);
            translated += updates.length;
          }
        } catch (e) {
          console.error(`sync-translations: error translating batch for ${lang}`, e?.message || e);
          errors++;
        }
      }
    }

    return Response.json({
      processed: allPending.length,
      translated,
      errors,
    });
  } catch (error) {
    console.error('sync-translations error', error?.message || error);
    return Response.json({ error: 'internal error' }, { status: 500 });
  }
}