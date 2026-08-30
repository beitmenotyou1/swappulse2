import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Camera, Loader2, ShieldCheck, User, Wallet as WalletIcon } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import WalletDashboard from '@/components/profile/onchain/WalletDashboard';
import SmartAccountSetup from '@/components/profile/onchain/SmartAccountSetup';
import CardAttestation from '@/components/profile/onchain/CardAttestation';
import MintedCardsPanel from '@/components/chain/MintedCardsPanel';
import StakingPanel from '@/components/chain/StakingPanel';
import BridgePanel from '@/components/chain/BridgePanel';
import { isChainAuthoritative } from '@/lib/chainIdentityDisplay';
import GuideFooterLink from '@/components/help/GuideFooterLink';
import useSEO from '@/hooks/useSEO';

export default function Wallet() {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attestations, setAttestations] = useState([]);

  useSEO({
    title: 'Wallet & On-Chain Identity',
    description: 'Manage your self-custodial SwapPulse smart account: on-chain identity, card possession attestations, anchored cards, network staking, and cross-chain transfers. Free and open source, with no protocol fees.',
    canonicalPath: '/wallet',
  });

  const load = async () => {
    setLoading(true);
    try {
      const [res, atts] = await Promise.all([
        base44.functions.invoke('chain-identity-user', { action: 'status' }),
        base44.entities.CardVerificationSession.filter({ created_by_id: user?.id }, '-created_date', 50).catch(() => []),
      ]);
      setStatus(res?.data || res || null);
      setAttestations(atts || []);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user?.id) load(); }, [user?.id]);

  const identity = status?.identity || null;
  // Staking, minting and bridging all require an identity the chain itself
  // confirmed — a reservation alone is not enough to hold assets.
  const secured = isChainAuthoritative(identity?.status);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <Link to="/" className="rounded-full p-2 hover:bg-secondary" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-2">
          <WalletIcon className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Wallet & Identity</h1>
        </div>
      </div>

      <Link
        to="/profile"
        className="mb-5 flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary"
      >
        <div className="rounded-full bg-primary/10 p-2.5">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">View your profile</p>
          <p className="text-xs text-muted-foreground">See your collection status, attestations, and public identity</p>
        </div>
        <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
      </Link>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : identity ? (
        <div className="space-y-6">
          <div>
            <h2 className="mb-3 text-sm font-bold uppercase text-muted-foreground">Smart Account</h2>
            <WalletDashboard status={status} onReload={load} />
          </div>
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Camera className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold uppercase text-muted-foreground">Card Possession Attestations</h2>
            </div>
            <CardAttestation attestations={attestations} onReload={load} identity={identity} />
          </div>
          <div>
            <h2 className="mb-3 text-sm font-bold uppercase text-muted-foreground">On-Chain Cards</h2>
            <MintedCardsPanel identitySecured={secured} />
          </div>
          <div>
            <h2 className="mb-3 text-sm font-bold uppercase text-muted-foreground">Network Staking</h2>
            <StakingPanel identitySecured={secured} />
          </div>
          <div>
            <h2 className="mb-3 text-sm font-bold uppercase text-muted-foreground">Cross-Chain</h2>
            <BridgePanel identitySecured={secured} />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm font-medium">Create your on-chain identity to start attesting card ownership.</p>
          </div>
          <SmartAccountSetup status={status} onReload={load} />
        </div>
      )}

      <GuideFooterLink slug="wallet" />
    </div>
  );
}