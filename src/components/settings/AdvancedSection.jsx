import React from 'react';
import { Download, KeyRound, Bug } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import SettingSelect from '@/components/settings/SettingSelect';

export default function AdvancedSection({ settings, update }) {
  const { toast } = useToast();

  const exportJson = () => {
    try {
      const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'swappulse-settings.json';
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Settings exported', description: 'Your settingsConfig JSON has been downloaded.' });
    } catch (e) {
      toast({ title: 'Export failed', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="flex items-center gap-2 text-sm font-bold"><Download className="h-4 w-4 text-primary" /> Data export</p>
        <p className="text-xs text-muted-foreground">Download your settingsConfig blob as JSON.</p>
        <button onClick={exportJson} className="mt-2 w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground">
          Export settings JSON
        </button>
      </div>

      <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
        <p className="mb-1 flex items-center gap-2 font-semibold text-foreground"><KeyRound className="h-4 w-4" /> Planned</p>
        Collection/trade JSON dump, raw AT Protocol repository backup, insurance PDF valuation, and API-key issuance arrive with the developer tools release.
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <p className="flex items-center gap-2 text-sm font-bold"><Bug className="h-4 w-4 text-primary" /> Debug log level</p>
        <div className="mt-2">
          <SettingSelect
            label="Debug log level"
            value={settings.debugLogLevel || 'info'}
            options={[
              { value: 'info', label: 'Info' },
              { value: 'debug', label: 'Debug' },
              { value: 'verbose', label: 'Verbose' },
            ]}
            onChange={(v) => update({ debugLogLevel: v })}
          />
        </div>
      </div>
    </div>
  );
}