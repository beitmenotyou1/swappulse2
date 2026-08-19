import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { UI_STRINGS_EN } from '../../shared/uiStrings.ts';

// Admin-only: translates UI strings from English into all 8 non-English
// supported languages using InvokeLLM. Takes a `batch` array of translation
// keys in the request body. For each key and language, calls InvokeLLM to
// translate the English source value, then upserts a TranslationOverride
// record. Processes up to 20 key-language combinations per run.
//
// If `batch` is omitted, translates ALL keys in UI_STRINGS_EN (processing
// 20 per run; re-invoke to continue with the next batch).
//
// If `keys` is provided in the body, translates only those specific keys
// into all 8 languages (useful for filling gaps).

const TARGET_LANGS = [
  { code: 'fr', name: 'French' },
  { code: 'es', name: 'Spanish' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'jp', name: 'Japanese' },
  { code: 'zh', name: 'Chinese (Simplified)' },
  { code: 'ko', name: 'Korean' },
];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    // `keys` = specific keys to translate into all 8 languages
    // `batch` = { lang: 'fr', keys: [...] } translate a batch of keys into one language
    // If neither provided, translate ALL keys into all languages (20 per run)
    const specificKeys = body.keys;
    const batch = body.batch; // { lang: 'fr', keys: ['nav.home', 'nav.explore', ...] }

    let translated = 0;
    let errors = 0;
    let skipped = 0;
    let llmCalls = 0;
    const MAX_LLM_CALLS = 20;
    const errorDetails = [];

    // Build the work queue: array of { lang, keys }
    let workQueue: { lang: { code: string; name: string }; keys: string[] }[] = [];

    if (batch && batch.lang && batch.keys) {
      const lang = TARGET_LANGS.find(l => l.code === batch.lang);
      if (lang) workQueue.push({ lang, keys: batch.keys });
    } else if (specificKeys && Array.isArray(specificKeys)) {
      for (const lang of TARGET_LANGS) {
        workQueue.push({ lang, keys: specificKeys });
      }
    } else {
      // Translate ALL keys, 20 per run, cycling through languages
      const allKeys = Object.keys(UI_STRINGS_EN);
      // Determine which key index to start from based on a cursor in the body
      const startIdx = body.startIdx || 0;
      const keysSlice = allKeys.slice(startIdx, startIdx + 20);
      for (const lang of TARGET_LANGS) {
        workQueue.push({ lang, keys: keysSlice });
      }
    }

    for (const { lang, keys } of workQueue) {
      if (llmCalls >= MAX_LLM_CALLS) break;

      // Build the strings to translate for this batch
      const stringsToTranslate: Record<string, string> = {};
      for (const key of keys) {
        if (UI_STRINGS_EN[key]) {
          stringsToTranslate[key] = UI_STRINGS_EN[key];
        }
      }

      const keyCount = Object.keys(stringsToTranslate).length;
      if (keyCount === 0) { skipped += keys.length; continue; }

      try {
        // Build a JSON schema with all keys as properties
        const schemaProperties: Record<string, { type: string }> = {};
        for (const key of Object.keys(stringsToTranslate)) {
          schemaProperties[key] = { type: 'string' };
        }

        const prompt = `Translate the following English UI strings into ${lang.name}. This is for a Pokémon TCG collector platform called SwapPulse. Return a JSON object with the SAME keys and translated values. Keep brand names (SwapPulse, TCGDex, AT Protocol, Bluesky, Stripe, PSA, Beckett, CGC) untranslated. Return ONLY the JSON object, no markdown, no explanation.

Strings to translate:
${JSON.stringify(stringsToTranslate, null, 2)}`;

        const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt,
          response_json_schema: {
            type: 'object',
            properties: schemaProperties,
            required: Object.keys(stringsToTranslate),
          },
        });

        if (!result) {
          errors++;
          errorDetails.push({ lang: lang.code, error: 'No result from LLM' });
          llmCalls++;
          continue;
        }

        // Upsert each translation
        for (const key of Object.keys(stringsToTranslate)) {
          const translatedValue = result[key];
          if (!translatedValue || typeof translatedValue !== 'string') {
            errors++;
            errorDetails.push({ lang: lang.code, key, error: 'Missing or invalid translation' });
            continue;
          }

          try {
            // Check if an override already exists
            const existing = await base44.asServiceRole.entities.TranslationOverride.filter({
              translation_key: key,
              language: lang.code,
            }, '-created_date', 1);

            if (existing && existing.length > 0) {
              await base44.asServiceRole.entities.TranslationOverride.update(existing[0].id, {
                value: translatedValue,
                source_value: UI_STRINGS_EN[key],
                generated_at: new Date().toISOString(),
              });
            } else {
              await base44.asServiceRole.entities.TranslationOverride.create({
                translation_key: key,
                language: lang.code,
                source_value: UI_STRINGS_EN[key],
                value: translatedValue,
                source: 'ai',
                generated_at: new Date().toISOString(),
              });
            }
            translated++;
          } catch (e) {
            errors++;
            errorDetails.push({ lang: lang.code, key, error: 'Upsert failed: ' + (e.message || String(e)) });
          }
        }
        llmCalls++;
      } catch (e) {
        errors++;
        errorDetails.push({ lang: lang.code, error: e.message || String(e) });
        llmCalls++;
      }
    }

    return Response.json({
      translated,
      errors,
      skipped,
      llmCalls,
      errorDetails: errorDetails.slice(0, 10),
      message: `Translated ${translated} strings, errors ${errors}. ${llmCalls >= MAX_LLM_CALLS ? 'Batch limit reached — re-invoke to continue.' : 'Complete.'}`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}