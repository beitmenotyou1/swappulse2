import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/PageHeader';
import HealthSection from '@/components/admin/HealthSection';
import MetricsSection from '@/components/admin/MetricsSection';
import ExternalApiBudgetSection from '@/components/admin/ExternalApiBudgetSection';
import InviteCodesSection from '@/components/admin/InviteCodesSection';
import EmailTestSection from '@/components/admin/EmailTestSection';
import IncidentsSection from '@/components/admin/IncidentsSection';
import ServicesSection from '@/components/admin/ServicesSection';
import MaintenanceSection from '@/components/admin/MaintenanceSection';
import BackfillSection from '@/components/admin/BackfillSection';
import PrivacyAuditSection from '@/components/admin/PrivacyAuditSection';
import ProvisionIdentitiesSection from '@/components/admin/ProvisionIdentitiesSection';
import ConsolidateIdentitySection from '@/components/admin/ConsolidateIdentitySection';
import ChainIdentitySection from '@/components/admin/ChainIdentitySection';
import V2VerificationTestSection from '@/components/admin/V2VerificationTestSection';
import SyncProfilesSection from '@/components/admin/SyncProfilesSection';
import FederationDiagnosticsSection from '@/components/admin/FederationDiagnosticsSection';
import SeoAuditSection from '@/components/admin/SeoAuditSection';
import DataSubjectRequestsSection from '@/components/admin/DataSubjectRequestsSection';
import DsarSummaryCard from '@/components/admin/DsarSummaryCard';
import BotProtectionLogSection from '@/components/admin/BotProtectionLogSection';
import StandardSiteSection from '@/components/admin/StandardSiteSection';
import HelpPromoSection from '@/components/admin/HelpPromoSection';
import TranslationSyncSection from '@/components/admin/TranslationSyncSection';
import SiteWideStarterPackSection from '@/components/admin/SiteWideStarterPackSection';
import { Loader2, ShieldAlert, LayoutDashboard, Network, Globe2, Server, ShieldCheck } from 'lucide-react';
import GuideFooterLink from '@/components/help/GuideFooterLink';
import { useT } from '@/lib/i18n/I18nProvider';
import useSEO from '@/hooks/useSEO';

const TABS = [
  { key: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { key: 'identity', label: 'Identity & Federation', Icon: Network },
  { key: 'platform', label: 'Platform & Content', Icon: Globe2 },
  { key: 'system', label: 'System & Infrastructure', Icon: Server },
  { key: 'security', label: 'Users & Security', Icon: ShieldCheck },
];

export default function Admin() {
  const t = useT();
  useSEO({
    title: 'Admin Dashboard',
    description: 'SwapPulse admin dashboard for platform management, federation diagnostics, and moderation tools.',
    canonicalPath: '/admin',
  });
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('admin-metrics', {});
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message || t('admin.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') load();
    else setLoading(false);
  }, [user]);

  if (user?.role !== 'admin') {
    return (
      <>
        <PageHeader title={t('admin.title')} />
        <div className="grid place-items-center py-20 text-center">
          <ShieldAlert className="h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">{t('admin.adminsOnly')}</p>
          <p className="text-sm text-muted-foreground">{t('admin.noAccess')}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t('admin.title')} subtitle={t('admin.subtitle')} />
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
      <div className="space-y-6 p-4">
        {tab === 'overview' && (
          <>
            {loading && (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {data && (
              <>
                <HealthSection health={data.health} generatedAt={data.generated_at} onRefresh={load} />
                <ExternalApiBudgetSection pokewallet={data.pokewallet_usage} priceTracker={data.pokemon_price_tracker_usage} />
                <MetricsSection counts={data.counts} />
                <DsarSummaryCard />
              </>
            )}
          </>
        )}
        {tab === 'identity' && (
          <>
            <ChainIdentitySection />
            <V2VerificationTestSection />
            <ProvisionIdentitiesSection />
            <ConsolidateIdentitySection />
            <FederationDiagnosticsSection />
            <PrivacyAuditSection />
            <SyncProfilesSection />
            <BackfillSection />
          </>
        )}
        {tab === 'platform' && (
          <>
            <SiteWideStarterPackSection />
            <StandardSiteSection />
            <HelpPromoSection />
            <TranslationSyncSection />
          </>
        )}
        {tab === 'system' && (
          <>
            <ServicesSection />
            <MaintenanceSection />
            <IncidentsSection />
            <SeoAuditSection />
          </>
        )}
        {tab === 'security' && (
          <>
            <InviteCodesSection />
            <BotProtectionLogSection />
            <DataSubjectRequestsSection />
            <EmailTestSection />
          </>
        )}
      </div>
      <GuideFooterLink slug="admin" />
    </>
  );
}