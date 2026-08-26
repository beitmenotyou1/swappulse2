import React from 'react';
import PageHeader from '@/components/PageHeader';
import CrossChainBridge from '@/components/bridge/CrossChainBridge';
import BridgeWallet from '@/components/bridge/BridgeWallet';
import { useAuth } from '@/lib/AuthContext';

export default function WalletBridge() {
  const { user } = useAuth();
  const walletAddress = user?.data?.wallet_address || '';
  const userDid = user?.data?.did || user?.did || '';

  return (
    <div className="min-h-screen pb-20">
      <PageHeader title="Cross-Chain Bridge" subtitle="Send $PULSE and port NFTs between PulseChain and Polygon" />
      <div className="px-4 py-6 space-y-6">
        <CrossChainBridge walletAddress={walletAddress} />
        <BridgeWallet userDid={userDid} />
      </div>
    </div>
  );
}