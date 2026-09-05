import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { translations, SUPPORTED_LOCALES, LOCALE_TO_TCGDEX } from '@/lib/i18n/translations';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

// Admin tool for managing interface translations. Help/documentation content
// now lives in GitBook and is maintained there independently of the app UI.

// Map locale codes to TCGDex language codes (reverse of LOCALE_TO_TCGDEX)
const LOCALE_TO_LANG = {};
for (const [loc, lang] of Object.entries(LOCALE_TO_TCGDEX)) {
  if (!LOCALE_TO_LANG[lang]) LOCALE_TO_LANG[lang] = [];
  LOCALE_TO_LANG[lang].push(loc);
}

const UNIQUE_LANGS = [...new Set(SUPPORTED_LOCALES.map((l) => LOCALE_TO_TCGDEX[l]).filter((l) => l && l !== 'en'))];

export default function TranslationSyncSection() {
  const { toast } = useToast();
  const [seeding, setSeeding] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [report, setReport] = useState(null);
  const [auditReport, setAuditReport] = useState(null);

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
        // Get the static dict for the first locale of this language
        const langLocales = Object.entries(LOCALE_TO_TCGDEX).filter(([, l]) => l === lang).map(([loc]) => loc);
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
      const res = await base44.functions.invoke('sync-translations', {});
      const data = res.data || res;
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

  // Action 3: Audit translation coverage across all interface languages
  const handleAudit = async () => {
    setAuditing(true);
    setAuditReport(null);
    try {
      const res = await base44.functions.invoke('audit-translations', {});
      const data = res.data || res;
      if (data.error) {
        toast({ title: 'Audit failed', description: data.error, variant: 'destructive' });
      } else {
        toast({
          title: data.summary.complete ? 'Translations complete' : 'Missing translations found',
          description: data.summary.complete
            ? `All ${data.uiKeysTotal} UI keys are translated into all 8 non-English languages.`
            : `${data.summary.totalMissing} interface translations are missing.`,
          variant: data.summary.complete ? 'default' : 'destructive',
        });
        setAuditReport(data);
      }
    } catch (e) {
      toast({ title: 'Error', description: e?.message || 'Failed to audit translations', variant: 'destructive' });
    } finally {
      setAuditing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-1 font-bold">Translation Management</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Keep all nine supported interface languages in sync. Seed missing keys, sync approved translations, and audit coverage. Product documentation is maintained separately in GitBook.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSeedMissing} disabled={seeding} variant="outline">
            {seeding ? 'Seeding…' : 'Seed Missing UI Keys'}
          </Button>
          <Button onClick={handleSync} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync Translations'}
          </Button>
          <Button onClick={handleAudit} disabled={auditing} variant="outline">
            {auditing ? 'Auditing…' : 'Audit Translations'}
          </Button>
        </div>
        {report && (
          <div className="mt-4 rounded-lg bg-muted p-3 text-sm">
            <pre className="whitespace-pre-wrap">{JSON.stringify(report, null, 2)}</pre>
          </div>
        )}
        {auditReport && (
          <div className="mt-4 rounded-lg border border-border bg-card p-3 text-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-bold">Audit Report</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${auditReport.summary.complete ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}>
                {auditReport.summary.complete ? 'Complete' : `${auditReport.summary.totalMissing} missing`}
              </span>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">
              {auditReport.uiKeysTotal} UI keys · {auditReport.languagesChecked} languages checked
            </p>
            {auditReport.summary.complete ? (
              <p className="text-success">All translations present — no pages falling back to English.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(auditReport.missingUI).map(([lang, keys]) => (
                  <div key={`ui-${lang}`}>
                    <p className="font-semibold text-destructive">UI ({lang}): {keys.length} missing</p>
                    <p className="text-xs text-muted-foreground">{keys.slice(0, 10).join(', ')}{keys.length > 10 ? ` … +${keys.length - 10} more` : ''}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}