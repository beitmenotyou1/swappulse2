import React, { useEffect, useState } from 'react';
import { Camera, Loader2, Wallet } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import WalletDashboard from '@/components/profile/onchain/WalletDashboard';
import SmartAccountSetup from '@/components/profile/onchain/SmartAccountSetup';
import CardAttestation from '@/components/profile/onchain/CardAttestation';

export default function OnChainTab({ isOwner, did }) {
  const { user: me } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attestations, setAttestations] = useState([]);

  const load = async () => {
    if (!isOwner) { setLoading(false); return; }
    setLoading(true);
    try {
      const [res, atts] = await Promise.all([
        base44.functions.invoke('chain-identity-user', { action: 'status' }),
        base44.entities.CardVerificationSession.filter({ created_by_id: me?.id }, '-created_date', 20).catch(() => []),
      ]);
      setStatus(res?.data || res || null);
      setAttestations(atts || []);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [isOwner, did]);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!isOwner) {
    return (
      <div className="py-12 text-center">
        <Wallet className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">On-chain identity details are visible to the account owner.</p>
      </div>
    );
  }

  const identity = status?.identity || null;

  return (
    <div className="space-y-6 py-2">
      {identity ? (
        <>
          <WalletDashboard status={status} onReload={load} />
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Camera className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold">Card Possession Attestations</h3>
            </div>
            <CardAttestation attestations={attestations} onReload={load} identity={identity} />
          </div>
        </>
      ) : (
        <SmartAccountSetup status={status} onReload={load} />
      )}
    </div>
  );
}