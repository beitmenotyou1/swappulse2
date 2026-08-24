import React from 'react';
import { Boxes } from 'lucide-react';
import WalletLinkCard from '@/components/blockchain/WalletLinkCard';
import UsernameMintCard from '@/components/blockchain/UsernameMintCard';
import { useAuth } from '@/lib/AuthContext';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export default function PolygonSettingsSection({ settings, update }) {
  const { user } = useAuth();
  const [walletLinked, setWalletLinked] = useState(false);

  useEffect(() => {
    if (!user?.did) return;
    base44.entities.WalletLink.filter({ did: user.did, active: true })
      .then((links) => setWalletLinked(links.length > 0))
      .catch(() => setWalletLinked(false));
  }, [user?.did]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Boxes className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Polygon Blockchain</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Link a Polygon wallet and mint your on-chain identity. Your username NFT is permanent and non-transferable;
        card NFTs are transferable proof of ownership.
      </p>
      <WalletLinkCard />
      <UsernameMintCard walletLinked={walletLinked} />
    </div>
  );
}