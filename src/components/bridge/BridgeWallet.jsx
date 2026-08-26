import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowLeftRight,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Wallet,
  Layers,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import DualChainBadge from '@/components/nft/DualChainBadge';
import PortToPolygon from '@/components/bridge/PortToPolygon';

/**
 * BridgeWallet — unified view of user's NFT assets across Polygon + PulseChain.
 * Shows pending bridge operations, completed history, and allows porting.
 */
export default function BridgeWallet({ userDid }) {
  const { user } = useAuth();
  const did = userDid || user?.data?.did || user?.did;
  const [activeTab, setActiveTab] = useState('assets');
  const [portAsset, setPortAsset] = useState(null);

  // Fetch user's on-chain assets
  const { data: assets, isLoading: assetsLoading } = useQuery({
    queryKey: ['bridge-wallet-assets', did],
    queryFn: async () => {
      if (!did) return [];
      const res = await base44.entities.OnChainAsset.filter({ owner_did: did }, '-created_date', 100);
      return res || [];
    },
    enabled: !!did,
  });

  // Fetch user's cross-chain transfers
  const { data: transfers, isLoading: transfersLoading } = useQuery({
    queryKey: ['bridge-wallet-transfers', did],
    queryFn: async () => {
      if (!did) return [];
      const res = await base44.entities.CrossChainTransfer.filter({ did }, '-created_date', 50);
      return res || [];
    },
    enabled: !!did,
  });

  const pendingTransfers = (transfers || []).filter((t) => t.status === 'pending');
  const completedTransfers = (transfers || []).filter((t) => t.status === 'delivered' || t.status === 'failed');

  const polygonAssets = (assets || []).filter((a) => a.source_chain === 'polygon');
  const pulseAssets = (assets || []).filter((a) => a.source_chain === 'pulse');

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Bridge Wallet</h2>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Layers className="h-4 w-4" />
          <span>{(assets || []).length} assets</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-secondary p-1">
        {[
          { id: 'assets', label: 'My Assets' },
          { id: 'pending', label: 'Pending', count: pendingTransfers.length },
          { id: 'history', label: 'History' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="rounded bg-primary-foreground/20 px-1.5 py-0.5 text-xs">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[200px]">
        {activeTab === 'assets' && (
          <AssetsTab
            polygonAssets={polygonAssets}
            pulseAssets={pulseAssets}
            loading={assetsLoading}
            onPort={setPortAsset}
          />
        )}

        {activeTab === 'pending' && (
          <PendingTransfers transfers={pendingTransfers} loading={transfersLoading} />
        )}

        {activeTab === 'history' && (
          <TransferHistory transfers={completedTransfers} loading={transfersLoading} />
        )}
      </div>

      {/* Port to Polygon Modal */}
      {portAsset && (
        <PortToPolygon
          asset={portAsset}
          onClose={() => setPortAsset(null)}
          onSuccess={() => {
            setPortAsset(null);
            // Invalidate queries to refresh
            setTimeout(() => window.location.reload(), 2000);
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Assets Tab
// ============================================================

function AssetsTab({ polygonAssets, pulseAssets, loading, onPort }) {
  const [chainFilter, setChainFilter] = useState('all');

  const filteredAssets =
    chainFilter === 'all'
      ? [...polygonAssets, ...pulseAssets]
      : chainFilter === 'polygon'
      ? polygonAssets
      : pulseAssets;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (filteredAssets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Wallet className="mb-2 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No assets on this chain yet</p>
        <Link to="/trades" className="mt-2 text-sm text-primary hover:underline">
          Browse trades →
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Chain Filter */}
      <div className="mb-3 flex gap-2">
        {[
          { id: 'all', label: 'All Chains' },
          { id: 'polygon', label: 'Polygon' },
          { id: 'pulse', label: 'PulseChain' },
        ].map((chain) => (
          <button
            key={chain.id}
            onClick={() => setChainFilter(chain.id)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              chainFilter === chain.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            )}
          >
            {chain.label}
          </button>
        ))}
      </div>

      {/* Assets Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredAssets.map((asset) => (
          <div
            key={asset.id}
            className="group relative overflow-hidden rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-raised"
          >
            {/* Chain Badge */}
            <div className="absolute right-2 top-2">
              <DualChainBadge chain={asset.source_chain} dualChain={asset.dual_chain} />
            </div>

            {/* Card Content */}
            {asset.asset_type === 'card' ? (
              <div className="flex items-center gap-3">
                {asset.linked_card_image ? (
                  <img
                    src={asset.linked_card_image}
                    alt={asset.linked_card_name || asset.linked_card_id}
                    className="h-16 w-16 rounded object-cover"
                  />
                ) : (
                  <div className="h-16 w-16 rounded bg-secondary" />
                )}
                <div>
                  <h4 className="line-clamp-1 font-semibold text-foreground">
                    {asset.linked_card_name || asset.linked_card_id}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {asset.linked_card_id}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded bg-secondary">
                  <span className="text-2xl">@</span>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">
                    {asset.handle || 'Username'}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {asset.transferable ? 'Transferable NFT' : 'Soulbound NFT'}
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-3 flex gap-2">
              <Link
                to={asset.asset_type === 'card' ? `/card/${asset.linked_card_id}` : '/profile'}
                className="flex-1 rounded bg-secondary px-3 py-1.5 text-center text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                View
              </Link>
              <button
                onClick={() => onPort(asset)}
                className="flex-1 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Port to {asset.source_chain === 'polygon' ? 'Pulse' : 'Polygon'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Pending Transfers
// ============================================================

function PendingTransfers({ transfers, loading }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (transfers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Clock className="mb-2 h-8 w-8 text-muted-foreground/50" />
        <h3 className="mb-1 text-base font-semibold">No Pending Transfers</h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          Bridge your $PULSE between PulseChain and Polygon for faster transactions and lower fees.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {transfers.map((transfer) => (
        <TransferCard key={transfer.id} transfer={transfer} pending />
      ))}
    </div>
  );
}

// ============================================================
// Transfer History
// ============================================================

function TransferHistory({ transfers, loading }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (transfers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle2 className="mb-2 h-8 w-8 text-muted-foreground/50" />
        <h3 className="mb-1 text-base font-semibold">No Transfer History</h3>
        <p className="text-sm text-muted-foreground">Completed bridge transfers will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {transfers.map((transfer) => (
        <TransferCard key={transfer.id} transfer={transfer} />
      ))}
    </div>
  );
}

// ============================================================
// Transfer Card
// ============================================================

function TransferCard({ transfer, pending }) {
  const statusConfig = {
    pending: { icon: Clock, label: 'In Transit', color: 'text-warning', bg: 'bg-warning/10' },
    delivered: { icon: CheckCircle2, label: 'Delivered', color: 'text-success', bg: 'bg-success/10' },
    failed: { icon: AlertCircle, label: 'Failed', color: 'text-destructive', bg: 'bg-destructive/10' },
  };

  const config = statusConfig[transfer.status] || statusConfig.pending;
  const Icon = config.icon;

  const amount = transfer.amount_wei ? (Number(BigInt(transfer.amount_wei)) / 1e18).toFixed(2) : '0';

  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <div className="flex items-center gap-3">
        <div className={cn('rounded-full p-2', config.bg)}>
          <Icon className={cn('h-4 w-4', config.color)} />
        </div>
        <div>
          <h4 className="text-sm font-medium text-foreground">
            {amount} $PULSE
          </h4>
          <p className="text-xs text-muted-foreground">
            {transfer.from_chain} → {transfer.to_chain}
          </p>
        </div>
      </div>

      <div className="text-right">
        <p className={cn('text-sm font-medium', config.color)}>{config.label}</p>
        <p className="text-xs text-muted-foreground">
          {transfer.sent_at ? format(new Date(transfer.sent_at), 'MMM d, HH:mm') : ''}
        </p>
      </div>
    </div>
  );
}