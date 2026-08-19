// translate-help-content — translates structured help-page content into all
// nine supported languages via InvokeLLM. The admin UI sends the English content
// for one or more help pages as a payload; this function translates the content
// into each non-English language and stores the result as a JSON string in the
// TranslationOverride entity (key: 'help.<slug>', language: target lang).
//
// The content payload is an array of { slug, content } objects where content is
// the structured page data (title, subtitle, sections with blocks). The function
// preserves the structure and translates only text fields (title, subtitle,
// section titles, block texts, list items).
//
// Idempotent: overwrites existing TranslationOverride records for the same
// (key, language) pair.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

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

const TARGET_LANGS = ['fr', 'de', 'it', 'es', 'pt', 'jp', 'zh', 'ko'];

// Recursively translate all string values in a nested structure, preserving
// non-text fields (type, variant, icon).
function translateStrings(obj: any, translations: Map<string, string>, path: string = ''): any {
  if (typeof obj === 'string') {
    return translations.get(path) || obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item, i) => translateStrings(item, translations, `${path}.${i}`));
  }
  if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip non-translatable fields
      if (key === 'type' || key === 'variant' || key === 'icon' || key === 'slug') {
        result[key] = value;
      } else {
        result[key] = translateStrings(value, translations, path ? `${path}.${key}` : key);
      }
    }
    return result;
  }
  return obj;
}

// Extract all translatable strings from the content structure with their paths
function extractStrings(obj: any, path: string = ''): Array<{ path: string; value: string }> {
  const result: Array<{ path: string; value: string }> = [];
  if (typeof obj === 'string') {
    result.push({ path, value: obj });
  } else if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      result.push(...extractStrings(item, `${path}.${i}`));
    });
  } else if (obj && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'type' || key === 'variant' || key === 'icon' || key === 'slug') continue;
      result.push(...extractStrings(value, path ? `${path}.${key}` : key));
    }
  }
  return result;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const pages: Array<{ slug: string; content: any }> = body.pages || [];

    if (!pages || pages.length === 0) {
      return Response.json({ error: 'No pages provided' }, { status: 400 });
    }

    let translated = 0;
    let errors = 0;
    const results: Array<{ slug: string; lang: string; status: string }> = [];

    for (const page of pages) {
      const { slug, content } = page;
      if (!slug || !content) continue;

      // Extract all translatable strings from the content
      const strings = extractStrings(content);

      for (const lang of TARGET_LANGS) {
        const langName = LANG_NAMES[lang];
        try {
          // Build a flat object of path -> English value
          const toTranslate: Record<string, string> = {};
          for (const s of strings) {
            toTranslate[s.path] = s.value;
          }

          const prompt = `You are a professional translator for a Pokémon TCG collector platform called SwapPulse. Translate the following help-page text strings from English to ${langName}. These are UI strings for a help/guide page. Preserve the meaning, tone, and any HTML tags like <b>. Keep Pokémon TCG terminology natural for ${langName} speakers. Return a JSON object with the same keys and translated values.\n\n${JSON.stringify(toTranslate, null, 2)}`;

          const result = await base44.integrations.Core.InvokeLLM({
            prompt,
            response_json_schema: {
              type: 'object',
              properties: Object.fromEntries(
                strings.map((s) => [s.path, { type: 'string' }])
              ),
              required: strings.map((s) => s.path),
            },
          });

          const translations = result as Record<string, string>;

          // Build a map of path -> translated value
          const translationMap = new Map<string, string>();
          for (const s of strings) {
            if (translations[s.path]) {
              translationMap.set(s.path, translations[s.path]);
            }
          }

          // Reconstruct the content with translated strings
          const translatedContent = translateStrings(content, translationMap);

          // Store as a JSON string in TranslationOverride
          const key = `help.${slug}`;
          // Check if a record already exists
          const existing = await svc.entities.TranslationOverride
            .filter({ translation_key: key, language: lang }, '-created_date', 1)
            .catch(() => []);

          if (existing && existing.length > 0) {
            await svc.entities.TranslationOverride.update(existing[0].id, {
              source_value: JSON.stringify(content),
              value: JSON.stringify(translatedContent),
              source: 'ai',
              generated_at: new Date().toISOString(),
            });
          } else {
            await svc.entities.TranslationOverride.create({
              translation_key: key,
              language: lang,
              source_value: JSON.stringify(content),
              value: JSON.stringify(translatedContent),
              source: 'ai',
              generated_at: new Date().toISOString(),
            });
          }

          translated++;
          results.push({ slug, lang, status: 'ok' });
        } catch (e) {
          console.error(`translate-help-content: error for ${slug}/${lang}`, e?.message || e);
          errors++;
          results.push({ slug, lang, status: 'error' });
        }
      }
    }

    return Response.json({ translated, errors, results });
  } catch (error) {
    console.error('translate-help-content error', error?.message || error);
    return Response.json({ error: 'internal error' }, { status: 500 });
  }
}