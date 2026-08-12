import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/PageHeader';
import HealthSection from '@/components/admin/HealthSection';
import MetricsSection from '@/components/admin/MetricsSection';
import InviteCodesSection from '@/components/admin/InviteCodesSection';
import { Loader2, ShieldAlert } from 'lucide-react';

export default function Admin() {
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
      setError(e.response?.data?.error || e.message || 'Failed to load metrics');
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
        <PageHeader title="Admin" />
        <div className="grid place-items-center py-20 text-center">
          <ShieldAlert className="h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">Admins only</p>
          <p className="text-sm text-muted-foreground">You don't have access to this page.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Admin" subtitle="Production readiness dashboard" />
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
        <InviteCodesSection />
      </div>
    </>
  );
}