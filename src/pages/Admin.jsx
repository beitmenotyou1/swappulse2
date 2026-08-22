import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/PageHeader';
import HealthSection from '@/components/admin/HealthSection';
import MetricsSection from '@/components/admin/MetricsSection';
import InviteCodesSection from '@/components/admin/InviteCodesSection';
import EmailTestSection from '@/components/admin/EmailTestSection';
import IncidentsSection from '@/components/admin/IncidentsSection';
import ServicesSection from '@/components/admin/ServicesSection';
import MaintenanceSection from '@/components/admin/MaintenanceSection';
import BackfillSection from '@/components/admin/BackfillSection';
import ProvisionIdentitiesSection from '@/components/admin/ProvisionIdentitiesSection';
import ConsolidateIdentitySection from '@/components/admin/ConsolidateIdentitySection';
import SyncProfilesSection from '@/components/admin/SyncProfilesSection';
import FederationDiagnosticsSection from '@/components/admin/FederationDiagnosticsSection';
import SeoAuditSection from '@/components/admin/SeoAuditSection';
import DataSubjectRequestsSection from '@/components/admin/DataSubjectRequestsSection';
import DsarSummaryCard from '@/components/admin/DsarSummaryCard';
import BotProtectionLogSection from '@/components/admin/BotProtectionLogSection';
import StandardSiteSection from '@/components/admin/StandardSiteSection';
import HelpPromoSection from '@/components/admin/HelpPromoSection';
import TranslationSyncSection from '@/components/admin/TranslationSyncSection';
import TrustTierSection from '@/components/admin/TrustTierSection';
import { Loader2, ShieldAlert } from 'lucide-react';
import GuideFooterLink from '@/components/help/GuideFooterLink';
import { useT } from '@/lib/i18n/I18nProvider';

export default function Admin() {
  const t = useT();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      <div className="space-y-6 p-4">
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {data && (
          <>
            <HealthSection health={data.health} generatedAt={data.generated_at} onRefresh={load} />
            <MetricsSection counts={data.counts} />
          </>
        )}
        <DsarSummaryCard />
        <InviteCodesSection />
        <EmailTestSection />
        <ServicesSection />
        <MaintenanceSection />
        <BackfillSection />
        <ProvisionIdentitiesSection />
        <ConsolidateIdentitySection />
        <FederationDiagnosticsSection />
        <SyncProfilesSection />
        <IncidentsSection />
        <DataSubjectRequestsSection />
        <BotProtectionLogSection />
        <StandardSiteSection />
        <HelpPromoSection />
        <TranslationSyncSection />
        <TrustTierSection />
        <SeoAuditSection />
      </div>
      <GuideFooterLink slug="admin" />
    </>
  );
}