import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import SetChecklistManager from '@/components/sets/SetChecklistManager';
import { Loader2 } from 'lucide-react';
import useSEO from '@/hooks/useSEO';

export default function Sets() {
  useSEO({
    title: 'Set Checklists',
    description: 'Track your Pokémon TCG set completion, scan cards, and download printable PDF checklists on SwapPulse.',
    canonicalPath: '/sets',
  });
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h2 className="text-xl font-bold">Sign in to track your collection</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You need a SwapPulse account to manage your set checklists and download PDFs.
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Set Checklists" subtitle="Track completion, scan cards, and download printable PDFs" />
      <div className="p-4">
        <SetChecklistManager userId={user.id} />
      </div>
    </div>
  );
}