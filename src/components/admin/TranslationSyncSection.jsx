import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { translations, SUPPORTED_LOCALES, LOCALE_TO_TCGDEX } from '@/lib/i18n/translations';
import { HELP_CONTENT } from '@/lib/helpContent';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

// Admin tool for managing translations. Three actions:
// 1. Seed missing UI keys — scans translations.js for English keys missing from
//    each non-English locale and creates pending TranslationOverride records.
// 2. Sync translations — triggers the sync-translations backend function to
//    process pending records via InvokeLLM.
// 3. Translate help content — sends all help page content to the
//    translate-help-content backend function for AI translation into 8 languages.

// Map locale codes to TCGDex language codes (reverse of LOCALE_TO_TCGDEX)
const LOCALE_TO_LANG = {};
for (const [loc, lang] of Object.entries(LOCALE_TO_TCGDEX)) {
  if (!LOCALE_TO_LANG[lang]) LOCALE_TO_LANG[lang] = [];
  LOCALE_TO_LANG[lang].push(loc);
}

const NON_EN_LOCALES = SUPPORTED_LOCALES.filter((l) => LOCALE_TO_TCGDEX[l] && LOCALE_TO_TCGDEX[l] !== 'en');
const UNIQUE_LANGS = [...new Set(NON_EN_LOCALES.map((l) => LOCALE_TO_TCGDEX[l]))];

export default function TranslationSyncSection() {
  const { toast } = useToast();
  const [seeding, setSeeding] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [translatingHelp, setTranslatingHelp] = useState(false);
  const [report, setReport] = useState(null);

  // Action 1: Seed missing UI keys as pending TranslationOverride records
  const handleSeedMissing = async () => {
    setSeeding(true);
    setReport(null);
    try {
      const enDict = translations['en-GB'];
      const enKeys = Object.keys(enDict);

      // Fetch existing TranslationOverride records to avoid duplicates
      const existing = await base44.entities.TranslationOverride.list('-created_date', 5000);
      const existingSet = new Set(existing.map((r) => `${r.translation_key}|||${r.language}`));

      const toCreate = [];
      for (const lang of UNIQUE_LANGS) {
        // Find which locales map to this language
        const langLocales = LOCALE_TO_LANG[lang] || [];
        // Get the static dict for the first locale of this language
        const staticDict = translations[langLocales[0]] || {};
        for (const key of enKeys) {
          // Skip if the key already has a human translation in the static dict
          if (staticDict[key]) continue;
          // Skip if a TranslationOverride record already exists
          if (existingSet.has(`${key}|||${lang}`)) continue;
          toCreate.push({
            translation_key: key,
            language: lang,
            source_value: enDict[key],
            value: '',
            source: 'ai',
          });
        }
      }

      if (toCreate.length === 0) {
        toast({ title: 'All translations synced', description: 'No missing keys found.' });
        setReport({ seeded: 0, message: 'All keys are already translated.' });
        return;
      }

      // Bulk create pending records (max 500 per call)
      let created = 0;
      for (let i = 0; i < toCreate.length; i += 500) {
        const batch = toCreate.slice(i, i + 500);
        await base44.entities.TranslationOverride.bulkCreate(batch);
        created += batch.length;
      }

      toast({ title: 'Pending translations seeded', description: `${created} records created.` });
      setReport({ seeded: created, message: `${created} pending records created. Run Sync to translate them.` });
    } catch (e) {
      toast({ title: 'Error', description: e?.message || 'Failed to seed translations', variant: 'destructive' });
    } finally {
      setSeeding(false);
    }
  };

  // Action 2: Trigger the sync-translations backend function
  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/functions/sync-translations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.error) {
        toast({ title: 'Sync failed', description: data.error, variant: 'destructive' });
      } else {
        toast({
          title: 'Translations synced',
          description: `Processed: ${data.processed}, Translated: ${data.translated}, Errors: ${data.errors}`,
        });
        setReport(data);
      }
    } catch (e) {
      toast({ title: 'Error', description: e?.message || 'Failed to sync', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  // Action 3: Translate all help page content
  const handleTranslateHelp = async () => {
    setTranslatingHelp(true);
    try {
      const pages = Object.entries(HELP_CONTENT).map(([slug, content]) => ({
        slug,
        content: { ...content, slug },
      }));

      const res = await fetch('/api/functions/translate-help-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages }),
      });
      const data = await res.json();
      if (data.error) {
        toast({ title: 'Help translation failed', description: data.error, variant: 'destructive' });
      } else {
        toast({
          title: 'Help content translated',
          description: `Translated: ${data.translated}, Errors: ${data.errors}`,
        });
        setReport(data);
      }
    } catch (e) {
      toast({ title: 'Error', description: e?.message || 'Failed to translate help content', variant: 'destructive' });
    } finally {
      setTranslatingHelp(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-1 font-bold">Translation Management</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Keep all nine supported languages in sync. Seed missing keys, then sync to generate AI translations via InvokeLLM.
          Translate help page content separately (44 pages × 8 languages).
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSeedMissing} disabled={seeding} variant="outline">
            {seeding ? 'Seeding…' : 'Seed Missing UI Keys'}
          </Button>
          <Button onClick={handleSync} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync Translations'}
          </Button>
          <Button onClick={handleTranslateHelp} disabled={translatingHelp} variant="secondary">
            {translatingHelp ? 'Translating Help…' : 'Translate Help Content'}
          </Button>
        </div>
        {report && (
          <div className="mt-4 rounded-lg bg-muted p-3 text-sm">
            <pre className="whitespace-pre-wrap">{JSON.stringify(report, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}