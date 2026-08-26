import React, { useState, useEffect, useCallback } from 'react';
import { Boxes, Wallet, KeyRound, Loader2, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useCryptoEnabled } from '@/hooks/useCryptoEnabled';
import DisplayCurrencySelector from '@/components/wallet/DisplayCurrencySelector';
import CustodialWalletCard from './CustodialWalletCard';
import PasskeyManager from './PasskeyManager';
import WalletPinModal from './WalletPinModal';
import CreateWalletModal from './CreateWalletModal';
import WalletLinkCard from './WalletLinkCard';
import HardwareWalletCard from './HardwareWalletCard';
import DefaultWalletSelector from './DefaultWalletSelector';
import UsernameMintCard from './UsernameMintCard';
import AllowlistManager from '@/components/wallet/AllowlistManager';

export default function PolygonSettingsSection({ settings, update }) {
  const { user } = useAuth();
  const { cryptoEnabled } = useCryptoEnabled();
  const [custodialWallet, setCustodialWallet] = useState(null);
  const [linkedWallet, setLinkedWallet] = useState(null);
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);

  const userDid = user?.data?.did || user?.did;
  const loadWallet = useCallback(async () => {
    if (!userDid) { setLoadingWallet(false); return; }
    try {
      const [wallets, links] = await Promise.all([
        base44.entities.CustodialWallet.filter({ did: userDid, active: true }),
        base44.entities.WalletLink.filter({ did: userDid, active: true }).catch(() => []),
      ]);
      setCustodialWallet(wallets[0] || null);
      setLinkedWallet(links[0] || null);
    } catch { setCustodialWallet(null); setLinkedWallet(null); }
    finally { setLoadingWallet(false); }
  }, [userDid]);

  useEffect(() => { loadWallet(); }, [loadWallet]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Boxes className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Wallet & Blockchain</h2>
      </div>

      <p className="text-xs text-muted-foreground">
        Minting of username and card NFTs is on Polygon only — gas is paid by you.
      </p>

      {cryptoEnabled && (
        <DisplayCurrencySelector settings={settings} update={update} />
      )}

      {cryptoEnabled && (
        <>
          {loadingWallet ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : custodialWallet ? (
            <>
              <CustodialWalletCard wallet={custodialWallet} onUpdated={loadWallet} />
              <PasskeyManager wallet={custodialWallet} onUpdated={loadWallet} />

              {/* PIN management */}
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold">Wallet PIN</h3>
                  {custodialWallet.has_pin && (
                    <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">SET</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {custodialWallet.has_pin
                    ? 'A PIN is set as an alternative unlock method.'
                    : 'Optional: set a PIN as a backup unlock method.'}
                </p>
                <button
                  onClick={() => setShowPinModal(true)}
                  className="mt-3 flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
                >
                  <KeyRound className="h-4 w-4" />
                  {custodialWallet.has_pin ? 'Change PIN' : 'Set PIN'}
                </button>
              </div>

              {linkedWallet && (
                <DefaultWalletSelector
                  settings={settings}
                  update={update}
                  linkedWallet={linkedWallet}
                  custodialWallet={custodialWallet}
                />
              )}
              <HardwareWalletCard onLinked={loadWallet} />
              <UsernameMintCard walletLinked={true} />
              <AllowlistManager />
            </>
          ) : (
            <>
              {/* No custodial wallet — show create CTA + external link option */}
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold">Create a SwapPulse Wallet</h3>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  No browser extension needed. Your SwapPulse account becomes your Polygon wallet —
                  we'll generate and securely store your keys. You can also add a passkey (Face ID / Touch ID)
                  for protection and a 24-word recovery phrase for backup.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-3 flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" /> Create My Wallet
                </button>
              </div>

              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-semibold text-muted-foreground">OR</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <WalletLinkCard />
              <HardwareWalletCard onLinked={loadWallet} />
              <UsernameMintCard walletLinked={false} />
            </>
          )}

          {showCreateModal && (
            <CreateWalletModal onClose={() => { setShowCreateModal(false); loadWallet(); }} />
          )}
          {showPinModal && (
            <WalletPinModal
              open={true}
              hasExistingPin={custodialWallet?.has_pin || false}
              onClose={() => setShowPinModal(false)}
              onSuccess={() => { setShowPinModal(false); loadWallet(); }}
            />
          )}
        </>
      )}
    </div>
  );
}