import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { UI_STRINGS_EN } from "../../shared/uiStrings.ts";

// Admin-only: audits translation coverage for the SwapPulse application UI.
// Product/help documentation is maintained in GitBook and is intentionally not
// duplicated or translated by the app runtime.

const TARGET_LANGS = ['fr', 'es', 'de', 'it', 'pt', 'jp', 'zh', 'ko'];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const records = await base44.asServiceRole.entities.TranslationOverride.list('-created_date', 5000);

    const lookup: Record<string, Record<string, string>> = {};
    for (const r of records) {
      if (!r.translation_key) continue;
      if (!lookup[r.translation_key]) lookup[r.translation_key] = {};
      lookup[r.translation_key][r.language] = r.value || '';
    }

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

    const totalMissingUI = Object.values(missingUI).reduce((sum, keys) => sum + keys.length, 0);

    return Response.json({
      uiKeysTotal: uiKeys.length,
      languagesChecked: TARGET_LANGS.length,
      missingUI,
      summary: {
        totalMissingUI,
        totalMissing: totalMissingUI,
        complete: totalMissingUI === 0,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
