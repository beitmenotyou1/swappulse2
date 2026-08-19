import React, { useState } from 'react';
import { Shield, Globe, Eye, Bell, Accessibility as AccessIcon, Wrench, Loader2, Target, Lock, Network, Scale } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { useSettings } from '@/hooks/useSettings';
import AccountSection from '@/components/settings/AccountSection';
import LanguageSection from '@/components/settings/LanguageSection';
import PrivacySection from '@/components/settings/PrivacySection';
import NotificationsSection from '@/components/settings/NotificationsSection';
import AccessibilitySection from '@/components/settings/AccessibilitySection';
import AdvancedSection from '@/components/settings/AdvancedSection';
import ChallengesSection from '@/components/settings/ChallengesSection';
import SecuritySection from '@/components/settings/SecuritySection';
import AtProtoSection from '@/components/settings/AtProtoSection';
import DataPrivacyRightsSection from '@/components/settings/DataPrivacyRightsSection';
import GuideFooterLink from '@/components/help/GuideFooterLink';
import { useT } from '@/lib/i18n/I18nProvider';

const TABS = [
  { key: 'account', tKey: 'settings.tab.account', Icon: Shield, Comp: AccountSection },
  { key: 'language', tKey: 'settings.tab.language', Icon: Globe, Comp: LanguageSection },
  { key: 'privacy', tKey: 'settings.tab.privacy', Icon: Eye, Comp: PrivacySection },
  { key: 'notifications', tKey: 'settings.tab.notifications', Icon: Bell, Comp: NotificationsSection },
  { key: 'accessibility', tKey: 'settings.tab.accessibility', Icon: AccessIcon, Comp: AccessibilitySection },
  { key: 'advanced', tKey: 'settings.tab.advanced', Icon: Wrench, Comp: AdvancedSection },
  { key: 'challenges', tKey: 'settings.tab.challenges', Icon: Target, Comp: ChallengesSection },
  { key: 'security', tKey: 'settings.tab.security', Icon: Lock, Comp: SecuritySection },
  { key: 'datarights', tKey: 'settings.tab.datarights', Icon: Scale, Comp: DataPrivacyRightsSection },
  { key: 'atprotocol', tKey: 'settings.tab.atprotocol', Icon: Network, Comp: AtProtoSection },
];

export default function Settings() {
  const t = useT();
  const { settings, update, loading } = useSettings();
  const [tab, setTab] = useState('account');
  const Active = TABS.find((t) => t.key === tab)?.Comp || AccountSection;

  return (
    <div>
      <PageHeader title={t('page.settings.title')} subtitle={t('page.settings.subtitle')} />
      <div className="flex overflow-x-auto border-b border-border">
        {TABS.map(({ key, tKey, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`relative flex shrink-0 items-center gap-1.5 px-4 py-3 text-sm font-semibold transition-colors ${tab === key ? 'text-foreground' : 'text-muted-foreground hover:bg-secondary'}`}
          >
            <Icon className="h-4 w-4" /> {t(tKey)}
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
      <GuideFooterLink slug="settings" />
    </div>
  );
}