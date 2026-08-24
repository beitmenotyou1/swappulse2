import React, { useState, useEffect } from 'react';
import { Package, Truck, MapPin, Camera, Check, Loader2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import UnlockWalletModal from '@/components/blockchain/UnlockWalletModal';

const STATUS_STEPS = ['created', 'funded', 'shipped', 'delivered', 'released'];
const STATUS_LABELS = {
  created: 'Created', funded: 'Funded', shipped: 'Shipped',
  delivered: 'Delivered', released: 'Released', disputed: 'Disputed',
  cancelled: 'Cancelled', refunded: 'Refunded',
};
const STATUS_COLORS = {
  created: 'bg-secondary text-foreground',
  funded: 'bg-primary/15 text-primary',
  shipped: 'bg-accent/20 text-accent',
  delivered: 'bg-warning/15 text-warning',
  released: 'bg-success/15 text-success',
  disputed: 'bg-destructive/15 text-destructive',
  cancelled: 'bg-destructive/10 text-destructive',
  refunded: 'bg-secondary text-muted-foreground',
};

export default function EscrowTracker({ tradeListingId, trade, me }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [escrow, setEscrow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showShipping, setShowShipping] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [showBuy, setShowBuy] = useState(false);
  const [unlockState, setUnlockState] = useState(null);

  const userDid = user?.data?.did || user?.did;
  const isOwner = !!me && !!trade && trade.created_by_id === me.id;

  useEffect(() => {
    (async () => {
      if (!tradeListingId) { setLoading(false); return; }
      try {
        const escrows = await base44.entities.EscrowTrade
          .filter({ trade_listing_id: tradeListingId }, '-created_date', 1).catch(() => []);
        setEscrow(escrows[0] || null);
      } catch (e) {
        console.error('Escrow load error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [tradeListingId]);

  const refresh = async () => {
    if (!tradeListingId) return;
    const escrows = await base44.entities.EscrowTrade
      .filter({ trade_listing_id: tradeListingId }, '-created_date', 1).catch(() => []);
    setEscrow(escrows[0] || null);
  };

  if (loading) {
    return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  // If no escrow exists and the user is not the owner, show a "Buy with USDC" button
  if (!escrow && !isOwner && trade && trade.status === 'open') {
    return <BuyWithUsdcSection trade={trade} me={me} tradeListingId={tradeListingId} onCreated={refresh} />;
  }

  if (!escrow) return null;

  const isBuyer = escrow.buyer_did === userDid;
  const isSeller = escrow.seller_did === userDid;
  const isParty = isBuyer || isSeller;

  if (!isParty) return null;

  const currentStepIndex = STATUS_STEPS.indexOf(escrow.status);
  const isDisputed = escrow.status === 'disputed';
  const isComplete = ['released', 'cancelled', 'refunded'].includes(escrow.status);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-bold">
          {escrow.trade_type === 'usdc_purchase' ? 'Escrow Protected Purchase' : 'Escrow Protected Swap'}
        </h3>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_COLORS[escrow.status] || 'bg-secondary'}`}>
          {STATUS_LABELS[escrow.status] || escrow.status}
        </span>
      </div>

      {/* Stepper */}
      {!isDisputed && !isComplete && (
        <div className="mb-4 flex items-center gap-1">
          {STATUS_STEPS.map((step, i) => (
            <React.Fragment key={step}>
              <div className="flex flex-col items-center gap-1">
                <div className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
                  i <= currentStepIndex ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'
                }`}>
                  {i < currentStepIndex ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span className="text-[10px] font-semibold">{STATUS_LABELS[step]}</span>
              </div>
              {i < STATUS_STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 ${i < currentStepIndex ? 'bg-primary' : 'bg-border'}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* USDC amount (for purchases) */}
      {escrow.trade_type === 'usdc_purchase' && (
        <div className="mb-3 rounded-lg bg-secondary p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Purchase Amount</span>
            <span className="font-bold">{(Number(BigInt(escrow.usdc_amount_wei || '0')) / 1_000_000).toFixed(2)} USDC</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fee (2%)</span>
            <span className="font-semibold">{(Number(BigInt(escrow.fee_wei || '0')) / 1_000_000).toFixed(2)} USDC</span>
          </div>
        </div>
      )}

      {/* Shipping info display */}
      {(escrow.buyer_tracking_code || escrow.seller_tracking_code) && (
        <div className="mb-3 space-y-2">
          {escrow.buyer_tracking_code && (
            <div className="flex items-center gap-2 text-xs">
              <Truck className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Buyer tracking:</span>
              <span className="font-mono font-semibold">{escrow.buyer_carrier} {escrow.buyer_tracking_code}</span>
            </div>
          )}
          {escrow.seller_tracking_code && (
            <div className="flex items-center gap-2 text-xs">
              <Truck className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Seller tracking:</span>
              <span className="font-mono font-semibold">{escrow.seller_carrier} {escrow.seller_tracking_code}</span>
            </div>
          )}
        </div>
      )}

      {/* Confirmation photos */}
      {(escrow.buyer_confirmation_photo || escrow.seller_confirmation_photo) && (
        <div className="mb-3 flex gap-2">
          {escrow.buyer_confirmation_photo && (
            <img src={escrow.buyer_confirmation_photo} alt="Buyer confirmation" className="h-16 w-16 rounded-lg object-cover" />
          )}
          {escrow.seller_confirmation_photo && (
            <img src={escrow.seller_confirmation_photo} alt="Seller confirmation" className="h-16 w-16 rounded-lg object-cover" />
          )}
        </div>
      )}

      {/* Actions */}
      {!isComplete && !isDisputed && isParty && (
        <div className="flex flex-wrap gap-2">
          {/* Enter shipping details */}
          {escrow.trade_type === 'usdc_purchase' && isSeller && !escrow.seller_tracking_code && (
            <button
              onClick={() => setShowShipping(true)}
              className="flex items-center gap-2 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary/90"
            >
              <MapPin className="h-3.5 w-3.5" /> Enter Shipping Details
            </button>
          )}
          {escrow.trade_type === 'card_swap' && !isBuyer && !escrow.buyer_tracking_code && (
            <button
              onClick={() => setShowShipping(true)}
              className="flex items-center gap-2 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary/90"
            >
              <MapPin className="h-3.5 w-3.5" /> Enter Shipping Details
            </button>
          )}
          {escrow.trade_type === 'card_swap' && !isSeller && !escrow.seller_tracking_code && (
            <button
              onClick={() => setShowShipping(true)}
              className="flex items-center gap-2 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary/90"
            >
              <MapPin className="h-3.5 w-3.5" /> Enter Shipping Details
            </button>
          )}

          {/* Confirm receipt (usdc_purchase: buyer only) */}
          {escrow.trade_type === 'usdc_purchase' && isBuyer && escrow.status === 'shipped' && (
            <button
              onClick={() => setShowConfirm(true)}
              className="flex items-center gap-2 rounded-full bg-success px-3 py-1.5 text-xs font-bold text-white hover:bg-success/90"
            >
              <Camera className="h-3.5 w-3.5" /> Confirm Receipt
            </button>
          )}

          {/* Confirm receipt (card_swap: both parties) */}
          {escrow.trade_type === 'card_swap' && escrow.status === 'shipped' && (
            <button
              onClick={() => setShowConfirm(true)}
              className="flex items-center gap-2 rounded-full bg-success px-3 py-1.5 text-xs font-bold text-white hover:bg-success/90"
            >
              <Camera className="h-3.5 w-3.5" /> Confirm Receipt
            </button>
          )}

          {/* Dispute */}
          <button
            onClick={() => setShowDispute(true)}
            className="flex items-center gap-2 rounded-full border border-destructive/30 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/10"
          >
            <AlertTriangle className="h-3.5 w-3.5" /> File Dispute
          </button>
        </div>
      )}

      {/* Disputed state */}
      {isDisputed && (
        <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
          <p className="font-bold">Dispute filed</p>
          <p className="mt-1">{escrow.dispute_reason}</p>
          <p className="mt-1 text-muted-foreground">A moderator will review and resolve this dispute.</p>
        </div>
      )}

      {/* Released state */}
      {escrow.status === 'released' && (
        <div className="rounded-lg bg-success/10 p-3 text-xs text-success">
          <p className="font-bold flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Trade Complete</p>
          <p className="mt-1">Both parties confirmed receipt. {escrow.trade_type === 'usdc_purchase' && 'USDC released to seller.'}</p>
        </div>
      )}

      {/* Shipping form modal */}
      {showShipping && (
        <ShippingFormModal
          escrow={escrow}
          isBuyer={isBuyer}
          onClose={() => setShowShipping(false)}
          onSuccess={() => { setShowShipping(false); refresh(); }}
        />
      )}

      {/* Confirm receipt modal */}
      {showConfirm && (
        <ConfirmReceiptModal
          escrow={escrow}
          isBuyer={isBuyer}
          onClose={() => setShowConfirm(false)}
          onSuccess={() => { setShowConfirm(false); refresh(); }}
        />
      )}

      {/* Dispute modal */}
      {showDispute && (
        <DisputeModal
          escrow={escrow}
          onClose={() => setShowDispute(false)}
          onSuccess={() => { setShowDispute(false); refresh(); }}
        />
      )}
    </div>
  );
}

// --- Buy with USDC section (shown when no escrow exists and user is not owner) ---

function BuyWithUsdcSection({ trade, me, tradeListingId, onCreated }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [showBuy, setShowBuy] = useState(false);
  const [usdcAmount, setUsdcAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [unlockState, setUnlockState] = useState(null);

  const userDid = user?.data?.did || user?.did;
  if (!userDid) return null;

  const handleBuy = async (unlockCredential) => {
    const wei = BigInt(Math.round(parseFloat(usdcAmount) * 1_000_000)).toString();
    setLoading(true);
    try {
      const res = await base44.functions.invoke('create-escrow-trade', {
        trade_type: 'usdc_purchase',
        trade_listing_id: tradeListingId,
        counterparty_did: trade.did,
        counterparty_name: trade.author_name,
        counterparty_handle: trade.author_handle,
        usdc_amount_wei: wei,
        card_ids: trade.offer_card_ids || [],
        card_names: trade.offer_card_names || [],
        unlockCredential,
      });
      if (res.data?.requiresUnlock) {
        setUnlockState({ hasPasskey: res.data.hasPasskey, hasPin: res.data.hasPin });
        setLoading(false);
        return;
      }
      if (res.data?.error) {
        toast({ title: 'Purchase failed', description: res.data.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Escrow created!', description: 'USDC locked. Waiting for seller to ship.' });
      setShowBuy(false);
      onCreated();
    } catch (e) {
      toast({ title: 'Purchase failed', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = (credential) => {
    setUnlockState(null);
    handleBuy(credential);
  };

  return (
    <>
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-bold">Buy with USDC</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Purchase this card with USDC on Polygon. Funds are held in escrow until you confirm receipt.
          A 2% fee applies.
        </p>
        <button
          onClick={() => setShowBuy(true)}
          className="mt-3 flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90"
        >
          <Package className="h-4 w-4" /> Buy with USDC
        </button>
      </div>

      {showBuy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowBuy(false)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-elevated" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-bold">Buy with USDC</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Enter the USDC amount to pay for this card. A 2% fee will be added.
            </p>
            <input
              type="number"
              step="0.01"
              min="0"
              value={usdcAmount}
              onChange={(e) => setUsdcAmount(e.target.value)}
              placeholder="0.00"
              className="mb-3 w-full rounded-xl border border-border bg-secondary px-3 py-3 text-lg font-semibold outline-none focus:border-primary"
            />
            {usdcAmount && parseFloat(usdcAmount) > 0 && (
              <div className="mb-4 rounded-lg bg-secondary p-3 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-semibold">{parseFloat(usdcAmount).toFixed(2)} USDC</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Fee (2%)</span><span className="font-semibold">{(parseFloat(usdcAmount) * 0.02).toFixed(2)} USDC</span></div>
                <div className="mt-1 flex justify-between border-t border-border pt-1"><span className="font-bold">Total</span><span className="font-bold">{(parseFloat(usdcAmount) * 1.02).toFixed(2)} USDC</span></div>
              </div>
            )}
            <button
              onClick={() => handleBuy(null)}
              disabled={loading || !usdcAmount}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
              {loading ? 'Creating escrow…' : 'Lock USDC in Escrow'}
            </button>
          </div>
        </div>
      )}

      {unlockState && (
        <UnlockWalletModal
          open={true}
          unlockState={unlockState}
          onUnlock={handleUnlock}
          onCancel={() => { setUnlockState(null); setLoading(false); }}
        />
      )}
    </>
  );
}

// --- Shipping form modal ---

function ShippingFormModal({ escrow, isBuyer, onClose, onSuccess }) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  const [carrier, setCarrier] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name || !address || !trackingCode) {
      toast({ title: 'Missing details', description: 'All fields are required', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('update-escrow-shipping', {
        escrow_id: escrow.id,
        shipping_name: name,
        shipping_address: address,
        tracking_code: trackingCode,
        carrier,
      });
      if (res.data?.error) {
        toast({ title: 'Failed', description: res.data.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Shipping details saved' });
      onSuccess();
    } catch (e) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold">Enter Shipping Details</h2>
        <div className="space-y-3">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Recipient name" className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm outline-none focus:border-primary" />
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full shipping address" rows={3} className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm outline-none focus:border-primary" />
          <input type="text" value={trackingCode} onChange={(e) => setTrackingCode(e.target.value)} placeholder="Tracking code" className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm font-mono outline-none focus:border-primary" />
          <input type="text" value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Carrier (e.g. Royal Mail, USPS)" className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm outline-none focus:border-primary" />
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary">Cancel</button>
          <button onClick={handleSave} disabled={loading} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Confirm receipt modal ---

function ConfirmReceiptModal({ escrow, isBuyer, onClose, onSuccess }) {
  const { toast } = useToast();
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPhotoUrl(file_url);
    } catch (e) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = async () => {
    if (!photoUrl) {
      toast({ title: 'Photo required', description: 'Upload a photo showing the tracking code', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const fn = escrow.trade_type === 'usdc_purchase' ? 'confirm-escrow-receipt' : 'confirm-swap-receipt';
      const res = await base44.functions.invoke(fn, {
        escrow_id: escrow.id,
        confirmation_photo_url: photoUrl,
      });
      if (res.data?.error) {
        toast({ title: 'Failed', description: res.data.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Receipt confirmed!', description: escrow.trade_type === 'usdc_purchase' ? 'USDC released to seller.' : 'Confirmation recorded.' });
      onSuccess();
    } catch (e) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold">Confirm Receipt</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Upload a photo of the received item with the tracking code clearly visible.
          This confirms you've received the card and releases the escrow.
        </p>
        {photoUrl ? (
          <img src={photoUrl} alt="Confirmation" className="mb-4 h-40 w-full rounded-xl object-cover" />
        ) : (
          <label className="mb-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 hover:bg-secondary">
            {uploading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <Camera className="h-6 w-6 text-muted-foreground" />}
            <span className="mt-2 text-sm text-muted-foreground">{uploading ? 'Uploading…' : 'Click to upload photo'}</span>
            <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
          </label>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary">Cancel</button>
          <button onClick={handleConfirm} disabled={loading || !photoUrl} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-success px-4 py-2.5 text-sm font-bold text-white hover:bg-success/90 disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Dispute modal ---

function DisputeModal({ escrow, onClose, onSuccess }) {
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDispute = async () => {
    if (!reason.trim()) {
      toast({ title: 'Reason required', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('dispute-escrow', {
        escrow_id: escrow.id,
        reason: reason.trim(),
      });
      if (res.data?.error) {
        toast({ title: 'Failed', description: res.data.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Dispute filed', description: 'A moderator will review your case.' });
      onSuccess();
    } catch (e) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold text-destructive">File a Dispute</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Explain the issue with this trade. A moderator will review and resolve the dispute.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Describe the issue…"
          rows={4}
          className="mb-4 w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary">Cancel</button>
          <button onClick={handleDispute} disabled={loading} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-destructive px-4 py-2.5 text-sm font-bold text-white hover:bg-destructive/90 disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />} File Dispute
          </button>
        </div>
      </div>
    </div>
  );
}