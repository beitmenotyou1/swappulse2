import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Camera, Loader2, ShieldCheck, User, Wallet as WalletIcon } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import WalletDashboard from '@/components/profile/onchain/WalletDashboard';
import SmartAccountSetup from '@/components/profile/onchain/SmartAccountSetup';
import CardAttestation from '@/components/profile/onchain/CardAttestation';
import MintedCardsPanel from '@/components/chain/MintedCardsPanel';
import FaucetCard from '@/components/chain/FaucetCard';
import StakingPanel from '@/components/chain/StakingPanel';
import BridgePanel from '@/components/chain/BridgePanel';
import WalletOverviewCard from '@/components/chain/WalletOverviewCard';
import { isChainAuthoritative } from '@/lib/chainIdentityDisplay';
import DocumentationLink from '@/components/DocumentationLink';
import useSEO from '@/hooks/useSEO';
import { useT } from '@/lib/i18n/I18nProvider';

export default function Wallet() {
  const { user } = useAuth();
  const t = useT();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attestations, setAttestations] = useState([]);
  const [eligibilityNow, setEligibilityNow] = useState(() => Date.now());

  useSEO({
    title: t('page.wallet.seoTitle'),
    description: t('page.wallet.seoDescription'),
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
  useEffect(() => {
    const timer = window.setInterval(() => setEligibilityNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const identity = status?.identity || null;
  // Staking, minting and bridging all require an identity the chain itself
  // confirmed — a reservation alone is not enough to hold assets.
  const secured = isChainAuthoritative(identity?.status);
  const privateExpiryMs = status?.age?.verifier_expires_at
    ? new Date(status.age.verifier_expires_at).getTime()
    : 0;
  const chainExpirySeconds = Number(identity?.verification_expires_at || 0);
  const privateVerificationCurrent = !privateExpiryMs
    || (Number.isFinite(privateExpiryMs) && privateExpiryMs > eligibilityNow);
  const chainVerificationCurrent = Number.isFinite(chainExpirySeconds)
    && chainExpirySeconds >= 0
    && (chainExpirySeconds === 0 || chainExpirySeconds * 1000 > eligibilityNow);
  const valueFeaturesReady = Boolean(
    secured
    && status?.age?.value_features_eligible
    && status?.age?.verifier_status === 'VERIFIED'
    && privateVerificationCurrent
    && identity?.verification_status === 'ACTIVE'
    && chainVerificationCurrent
    && Number(identity?.verification_type || 0) === 1
    && Number(identity?.verification_level || 0) >= 2
    && Boolean(identity?.verification_attestation_id)
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <Link to="/" className="rounded-full p-2 hover:bg-secondary" aria-label={t('page.wallet.back')}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-2">
          <WalletIcon className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">{t('page.wallet.title')}</h1>
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
          <p className="text-sm font-bold">{t('page.wallet.viewProfile')}</p>
          <p className="text-xs text-muted-foreground">{t('page.wallet.viewProfileSub')}</p>
        </div>
        <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
      </Link>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : identity ? (
        <div className="space-y-6">
          <WalletOverviewCard identity={identity} network={status?.network} />
          <div id="wallet-identity" className="scroll-mt-24">
            <h2 className="mb-3 text-sm font-bold uppercase text-muted-foreground">{t('wallet.overview.security')}</h2>
            <WalletDashboard status={status} onReload={load} />
            {!secured && (
              <div className="mt-4">
                <SmartAccountSetup status={status} onReload={load} />
              </div>
            )}
          </div>
          <div id="wallet-funding" className="scroll-mt-24">
            <h2 className="mb-3 text-sm font-bold uppercase text-muted-foreground">{t('page.wallet.section.faucet')}</h2>
            <FaucetCard />
          </div>
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Camera className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold uppercase text-muted-foreground">{t('page.wallet.section.attestations')}</h2>
            </div>
            <CardAttestation attestations={attestations} onReload={load} identity={identity} />
          </div>
          <div>
            <h2 className="mb-3 text-sm font-bold uppercase text-muted-foreground">{t('page.wallet.section.onChainCards')}</h2>
            <MintedCardsPanel identitySecured={secured} />
          </div>
          <div id="wallet-staking" className="scroll-mt-24">
            <h2 className="mb-3 text-sm font-bold uppercase text-muted-foreground">{t('page.wallet.section.staking')}</h2>
            <StakingPanel identitySecured={secured} valueFeaturesReady={valueFeaturesReady} />
          </div>
          <div id="wallet-bridge" className="scroll-mt-24">
            <h2 className="mb-3 text-sm font-bold uppercase text-muted-foreground">{t('page.wallet.section.crossChain')}</h2>
            <BridgePanel identitySecured={secured} valueFeaturesReady={valueFeaturesReady} />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm font-medium">{t('page.wallet.createPrompt')}</p>
          </div>
          <SmartAccountSetup status={status} onReload={load} />
        </div>
      )}

      <Link to="/recover" className="mt-6 block text-center text-xs text-muted-foreground underline hover:text-foreground">
        {t('wallet.recoverLink')}
      </Link>

      <DocumentationLink slug="wallet" />
    </div>
  );
}