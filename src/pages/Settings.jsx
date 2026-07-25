import React, { useState } from 'react';
import { Shield, Globe, Eye, Bell, Accessibility as AccessIcon, Wrench, Loader2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { useSettings } from '@/hooks/useSettings';
import AccountSection from '@/components/settings/AccountSection';
import LanguageSection from '@/components/settings/LanguageSection';
import PrivacySection from '@/components/settings/PrivacySection';
import NotificationsSection from '@/components/settings/NotificationsSection';
import AccessibilitySection from '@/components/settings/AccessibilitySection';
import AdvancedSection from '@/components/settings/AdvancedSection';

const TABS = [
  { key: 'account', label: 'Account', Icon: Shield, Comp: AccountSection },
  { key: 'language', label: 'Language', Icon: Globe, Comp: LanguageSection },
  { key: 'privacy', label: 'Privacy', Icon: Eye, Comp: PrivacySection },
  { key: 'notifications', label: 'Notifications', Icon: Bell, Comp: NotificationsSection },
  { key: 'accessibility', label: 'Accessibility', Icon: AccessIcon, Comp: AccessibilitySection },
  { key: 'advanced', label: 'Advanced', Icon: Wrench, Comp: AdvancedSection },
];

export default function Settings() {
  const { settings, update, loading } = useSettings();
  const [tab, setTab] = useState('account');
  const Active = TABS.find((t) => t.key === tab)?.Comp || AccountSection;

  return (
    <div>
      <PageHeader title="Settings" subtitle="Your self-sovereign control centre — saved to your repository" />
      <div className="flex overflow-x-auto border-b border-border">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`relative flex shrink-0 items-center gap-1.5 px-4 py-3 text-sm font-semibold transition-colors ${tab === key ? 'text-foreground' : 'text-muted-foreground hover:bg-secondary'}`}
          >
            <Icon className="h-4 w-4" /> {label}
            {tab === key && <span className="absolute bottom-0 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-primary" />}
          </button>
        ))}
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <Active settings={settings} update={update} />
        )}
      </div>
    </div>
  );
}