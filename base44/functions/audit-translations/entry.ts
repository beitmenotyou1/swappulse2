import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { UI_STRINGS_EN } from "../../shared/uiStrings.ts";
import { HELP_ARTICLES } from "../../shared/helpArticles.ts";

// Admin-only: audits translation coverage across all 9 supported languages.
// Compares every English UI string key and every help-page slug against the
// TranslationOverride records in the database, flagging any key/slug that is
// missing or empty for a non-English language (meaning that page/string will
// fall back to English at runtime).
//
// Returns:
//   - missingUI: { [lang]: [keys...] } — UI string keys missing per language
//   - missingHelp: { [lang]: [slugs...] } — help page slugs missing per language
//   - summary: { totalMissing, complete }

const TARGET_LANGS = ['fr', 'es', 'de', 'it', 'pt', 'jp', 'zh', 'ko'];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Fetch all TranslationOverride records (both UI and help.* keys)
    const records = await base44.asServiceRole.entities.TranslationOverride.list('-created_date', 5000);

    // Build lookup: { translation_key: { lang: value } }
    const lookup: Record<string, Record<string, string>> = {};
    for (const r of records) {
      if (!r.translation_key) continue;
      if (!lookup[r.translation_key]) lookup[r.translation_key] = {};
      lookup[r.translation_key][r.language] = r.value || '';
    }

    // Check UI string keys
    const uiKeys = Object.keys(UI_STRINGS_EN);
    const missingUI: Record<string, string[]> = {};
    for (const lang of TARGET_LANGS) {
      const missing: string[] = [];
      for (const key of uiKeys) {
        const val = lookup[key]?.[lang];
        if (!val || val.length === 0) missing.push(key);
      }
      if (missing.length > 0) missingUI[lang] = missing;
    }

    // Check help page slugs
    const helpSlugs = HELP_ARTICLES.map((a) => a.slug);
    const missingHelp: Record<string, string[]> = {};
    for (const lang of TARGET_LANGS) {
      const missing: string[] = [];
      for (const slug of helpSlugs) {
        const key = `help.${slug}`;
        const val = lookup[key]?.[lang];
        if (!val || val.length === 0) missing.push(slug);
      }
      if (missing.length > 0) missingHelp[lang] = missing;
    }

    const totalMissingUI = Object.values(missingUI).reduce((s, a) => s + a.length, 0);
    const totalMissingHelp = Object.values(missingHelp).reduce((s, a) => s + a.length, 0);

    return Response.json({
      uiKeysTotal: uiKeys.length,
      helpPagesTotal: helpSlugs.length,
      languagesChecked: TARGET_LANGS.length,
      missingUI,
      missingHelp,
      summary: {
        totalMissingUI,
        totalMissingHelp,
        totalMissing: totalMissingUI + totalMissingHelp,
        complete: totalMissingUI + totalMissingHelp === 0,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}