import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Admin-only: translates help-page content from English into all 8 non-English
// supported languages using InvokeLLM. Takes a `pages` array in the request body,
// each item { slug, content }. For each page and language, calls InvokeLLM to
// translate the structured content, then upserts a TranslationOverride record
// with key 'help.<slug>' and value as a JSON string.
//
// Processes up to 5 page-language combinations per run to stay within timeout.
// The admin TranslationSyncSection sends all pages; the function processes a
// batch each call and the admin can re-invoke until all are done.

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
    const pages = body.pages;
    if (!pages || !Array.isArray(pages) || pages.length === 0) {
      return Response.json({ error: 'No pages provided' }, { status: 400 });
    }

    let translated = 0;
    let errors = 0;
    let skipped = 0;
    const errorDetails = [];

    // Process page-language combinations, up to 5 LLM calls per run
    let llmCalls = 0;
    const MAX_LLM_CALLS = 5;

    outer: for (const page of pages) {
      const slug = page.slug;
      const content = page.content;
      if (!slug || !content) { skipped++; continue; }

      for (const lang of TARGET_LANGS) {
        if (llmCalls >= MAX_LLM_CALLS) break outer;

        // Check if a non-empty override already exists
        try {
          const existing = await base44.asServiceRole.entities.TranslationOverride.filter({
            translation_key: `help.${slug}`,
            language: lang.code,
          }, '-created_date', 1);

          if (existing && existing.length > 0 && existing[0].value) {
            skipped++;
            continue;
          }
        } catch {
          // If filter fails, proceed with translation
        }

        try {
          const prompt = `Translate the following help page content from English into ${lang.name}. This is for a Pokémon TCG collector platform called SwapPulse. The content is a JSON object with "title", "subtitle", and "sections". Each section has optional "icon" and "title" fields (keep icon names untranslated), optional "variant" (keep untranslated), and "blocks" array. Each block has a "type" field ("p" for paragraph, "steps" for ordered list, "list" for unordered list) and either "text" (for "p") or "items" (for "steps"/"list").

Rules:
- Keep all <b>...</b> tags intact around the translated text inside them.
- Keep brand names untranslated: SwapPulse, TCGDex, AT Protocol, Bluesky, Stripe, PSA, Beckett, CGC, VAPID, WebRTC, IndexedDB.
- Keep all "type", "icon", and "variant" field values untranslated.
- Keep the JSON structure identical.
- Return ONLY the translated JSON object, no markdown, no explanation.

Content to translate:
${JSON.stringify(content)}`;

          const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt,
            response_json_schema: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                subtitle: { type: 'string' },
                sections: { type: 'array' },
              },
              required: ['title', 'subtitle', 'sections'],
            },
          });

          if (!result || !result.sections) {
            errors++;
            errorDetails.push({ slug, lang: lang.code, error: 'Invalid translation response' });
            llmCalls++;
            continue;
          }

          const valueJson = JSON.stringify(result);

          // Upsert: if a pending record exists, update it; otherwise create
          try {
            const existing = await base44.asServiceRole.entities.TranslationOverride.filter({
              translation_key: `help.${slug}`,
              language: lang.code,
            }, '-created_date', 1);

            if (existing && existing.length > 0) {
              await base44.asServiceRole.entities.TranslationOverride.update(existing[0].id, {
                value: valueJson,
                generated_at: new Date().toISOString(),
              });
            } else {
              await base44.asServiceRole.entities.TranslationOverride.create({
                translation_key: `help.${slug}`,
                language: lang.code,
                source_value: JSON.stringify(content),
                value: valueJson,
                source: 'ai',
                generated_at: new Date().toISOString(),
              });
            }
          } catch (e) {
            errors++;
            errorDetails.push({ slug, lang: lang.code, error: 'Upsert failed: ' + (e.message || String(e)) });
            llmCalls++;
            continue;
          }

          translated++;
          llmCalls++;
        } catch (e) {
          errors++;
          errorDetails.push({ slug, lang: lang.code, error: e.message || String(e) });
          llmCalls++;
        }
      }
    }

    return Response.json({
      translated,
      errors,
      skipped,
      llmCalls,
      errorDetails: errorDetails.slice(0, 10),
      message: `Translated ${translated}, skipped ${skipped}, errors ${errors}. ${llmCalls >= MAX_LLM_CALLS ? 'Batch limit reached — re-invoke to continue.' : 'Complete.'}`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}