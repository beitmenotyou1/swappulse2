import React from 'react';
import { Globe, Languages } from 'lucide-react';
import { LANGUAGES } from '@/hooks/useSettings';
import SettingRow from '@/components/settings/SettingRow';
import SettingSelect from '@/components/settings/SettingSelect';
import { useI18n } from '@/lib/i18n/I18nProvider';

const PROVIDERS = [
  { id: 'libre-local', name: 'Local (self-hosted)', privacy: 'High' },
  { id: 'deepl-api', name: 'DeepL', privacy: 'Medium' },
  { id: 'google-api', name: 'Google Translate', privacy: 'Low' },
];

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${active ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-foreground hover:bg-secondary'}`}
    >
      {children}
    </button>
  );
}

function toggleArray(arr, code) {
  return arr.includes(code) ? arr.filter((c) => c !== code) : [...arr, code];
}

export default function LanguageSection({ settings, update }) {
  const { locale, setLocale } = useI18n();
  const lang = settings.language || {};
  const fluent = lang.fluent || [];
  const hidden = lang.hidden || [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="flex items-center gap-2 text-sm font-bold"><Globe className="h-4 w-4 text-primary" /> Interface language</p>
        <div className="mt-2">
          <SettingSelect
            label="Interface language"
            value={locale}
            options={LANGUAGES.map((l) => ({ value: l.code, label: l.name }))}
            onChange={(v) => {
              setLocale(v);
              update({ locale: { interface: v } });
            }}
          />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">Switches the UI and card catalogue instantly. Saved to your account and browser for future visits.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <SettingRow
          label="Auto-translate posts"
          description="Translate posts you don't understand automatically."
          checked={!!lang.autoTranslate}
          onChange={(v) => update({ language: { autoTranslate: v } })}
        />
        {lang.autoTranslate && (
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Target language</label>
              <div className="mt-1">
                <SettingSelect
                  label="Target language"
                  value={lang.targetLanguage || 'en-GB'}
                  options={LANGUAGES.map((l) => ({ value: l.code, label: l.name }))}
                  onChange={(v) => update({ language: { targetLanguage: v } })}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Translation provider</label>
              <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => update({ language: { translationProvider: p.id } })}
                    className={`rounded-xl border p-3 text-left ${lang.translationProvider === p.id ? 'border-primary bg-secondary' : 'border-border hover:bg-secondary'}`}
                  >
                    <p className="text-sm font-bold">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">Privacy: {p.privacy}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <p className="flex items-center gap-2 text-sm font-bold"><Languages className="h-4 w-4 text-primary" /> Languages I speak</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {LANGUAGES.map((l) => (
            <Chip key={l.code} active={fluent.includes(l.code)} onClick={() => update({ language: { fluent: toggleArray(fluent, l.code) } })}>
              {l.name}
            </Chip>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-sm font-bold">Hide posts in these languages</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {LANGUAGES.map((l) => (
            <Chip key={l.code} active={hidden.includes(l.code)} onClick={() => update({ language: { hidden: toggleArray(hidden, l.code) } })}>
              {l.name}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}