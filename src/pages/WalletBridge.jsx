import React from 'react';
import PageHeader from '@/components/PageHeader';
import CrossChainBridge from '@/components/bridge/CrossChainBridge';
import { useAuth } from '@/lib/AuthContext';

export default function WalletBridge() {
  const { user } = useAuth();
  const walletAddress = user?.data?.wallet_address || '';

  return (
    <div className="min-h-screen pb-20">
      <PageHeader title="Cross-Chain Bridge" subtitle="Send $PULSE between PulseChain and Polygon" />
      <div className="px-4 py-6">
        <CrossChainBridge walletAddress={walletAddress} />
      </div>
    </div>
  );
}