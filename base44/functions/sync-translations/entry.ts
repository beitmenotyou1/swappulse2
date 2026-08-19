import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Admin-only: processes pending TranslationOverride records (value is empty,
// source_value is non-empty) by calling InvokeLLM to translate the English
// source_value into the target language. Processes up to 50 records per run
// to stay within timeout limits. Returns a summary of work done.

const LANGUAGE_NAMES = {
  fr: 'French',
  es: 'Spanish',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  jp: 'Japanese',
  zh: 'Chinese (Simplified)',
  ko: 'Korean',
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Fetch pending records (value is empty). Use service role since the
    // function is admin-verified and we want to read all records regardless
    // of any RLS nuances.
    const pending = await base44.asServiceRole.entities.TranslationOverride.filter({
      value: '',
    }, '-created_date', 50);

    if (!pending || pending.length === 0) {
      return Response.json({ processed: 0, translated: 0, errors: 0, message: 'No pending translations.' });
    }

    let translated = 0;
    let errors = 0;
    const errorDetails = [];

    for (const record of pending) {
      try {
        const langName = LANGUAGE_NAMES[record.language] || record.language;
        const prompt = `Translate the following English UI text into ${langName}. This is a user interface string for a Pokémon TCG collector platform called SwapPulse. Return ONLY the translation, no quotes, no explanation, no extra text. Keep brand names (SwapPulse, TCGDex, AT Protocol, Bluesky, Stripe) untranslated. Keep any HTML-like tags such as <b>...</b> intact.

English text:
${record.source_value}`;

        const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt,
          response_json_schema: {
            type: 'object',
            properties: {
              translation: { type: 'string' },
            },
            required: ['translation'],
          },
        });

        const translation = result?.translation?.trim();
        if (!translation) {
          errors++;
          errorDetails.push({ id: record.id, error: 'Empty translation returned' });
          continue;
        }

        await base44.asServiceRole.entities.TranslationOverride.update(record.id, {
          value: translation,
          generated_at: new Date().toISOString(),
        });
        translated++;
      } catch (e) {
        errors++;
        errorDetails.push({ id: record.id, error: e.message || String(e) });
      }
    }

    return Response.json({
      processed: pending.length,
      translated,
      errors,
      errorDetails: errorDetails.slice(0, 10),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}