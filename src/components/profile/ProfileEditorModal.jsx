import React, { useEffect, useState } from 'react';
import { X, Loader2, User, Link2, Milestone, Layout, Lock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useT } from '@/lib/i18n/I18nProvider';
import PersonalInfoTab from './PersonalInfoTab';
import ContactLinksTab from './ContactLinksTab';
import MilestonesTab from './MilestonesTab';
import LayoutThemeTab from './LayoutThemeTab';

const TABS = [
  { key: 'info', label: 'Personal', icon: User },
  { key: 'contact', label: 'Contact', icon: Link2 },
  { key: 'journey', label: 'Journey', icon: Milestone },
  { key: 'layout', label: 'Layout', icon: Layout },
];

// ProfileEditorModal — tabbed editor for the enhanced profile. Receives the
// owner's current config + an onSave(draft) from the page (single source of
// truth), edits a local draft, and persists on Save. The Layout tab needs
// sectionLabels (key -> human label) to render the reorder list.
export default function ProfileEditorModal({ config, onSave, onClose, saving, sectionLabels }) {
  const t = useT();
  const { user } = useAuth();
  const { toast } = useToast();
  const reverted = !!user?.migration_reverted;
  const migrated = !!user?.migrated_from_bluesky;
  const [tab, setTab] = useState('info');
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    if (config && !draft) setDraft(JSON.parse(JSON.stringify(config)));
  }, [config, draft]);

  const update = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const handleSave = async () => {
    if (!draft) return;
    try {
      await onSave(draft);
      // After saving the enhanced profile config, if the user has migrated,
      // push the profile to the PDS so edits reflect on the Protocol.
      if (migrated) {
        try {
          await base44.functions.invoke('sync-profile-records', {});
        } catch (e) {
          console.error('ProfileEditorModal: PDS sync failed', e);
        }
      }
      toast({ title: 'Profile updated' });
      onClose?.();
    } catch (e) {
      toast({ title: 'Could not save', description: e?.message, variant: 'destructive' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-bold">Customize profile</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-border px-2">
          {TABS.map((tb) => {
            const Icon = tb.icon;
            return (
              <button
                key={tb.key}
                onClick={() => setTab(tb.key)}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${tab === tb.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                <Icon className="h-4 w-4" /> {tb.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!draft ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-4">
              {reverted && (
                <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <div>
                    <p className="text-xs font-bold text-warning">{t('migration.revertedTitle')}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t('migration.editDisabledDesc')}</p>
                  </div>
                </div>
              )}
              {tab === 'info' ? (
                <PersonalInfoTab draft={draft} update={update} />
              ) : tab === 'contact' ? (
                <ContactLinksTab draft={draft} update={update} />
              ) : tab === 'journey' ? (
                <MilestonesTab draft={draft} update={update} />
              ) : (
                <LayoutThemeTab draft={draft} update={update} sectionLabels={sectionLabels} />
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-border p-4">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-secondary">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !draft || reverted}
            className="flex flex-[1.5] items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}