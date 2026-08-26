import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  Loader2,
  AlertTriangle,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

/**
 * PortToPolygon — modal for returning NFT assets from PulseChain back to Polygon.
 * Burns the mirrored asset on PulseChain and unlocks the original on Polygon.
 */
export default function PortToPolygon({ asset, onClose, onSuccess }) {
  const { toast } = useToast();
  const [step, setStep] = useState('confirm');
  const [error, setError] = useState(null);

  const unbridgeMutation = useMutation({
    mutationFn: async () => {
      // Initiate unbridge via the dedicated backend function
      const res = await base44.functions.invoke('initiate-unbridge', {
        assetId: asset.id,
      });
      return res.data;
    },
    onSuccess: (data) => {
      if (data?.error) {
        setError(data.error);
        setStep('confirm');
        return;
      }
      setStep('complete');
      toast({
        title: 'Port initiated',
        description: 'Your asset is being transferred back. Check Bridge Wallet for status.',
      });
      setTimeout(() => {
        onSuccess?.();
      }, 2500);
    },
    onError: (err) => {
      setError(err?.message || 'Failed to initiate unbridge');
      setStep('confirm');
    },
  });

  const handleConfirm = () => {
    setStep('processing');
    setError(null);
    unbridgeMutation.mutate();
  };

  const assetLabel =
    asset?.asset_type === 'card'
      ? asset?.linked_card_name || asset?.linked_card_id || 'Card NFT'
      : asset?.handle ? `@${asset.handle}` : 'Username NFT';

  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
            Port to {asset?.source_chain === 'polygon' ? 'PulseChain' : 'Polygon'}
          </DialogTitle>
          <DialogDescription>
            Return <span className="font-semibold text-foreground">{assetLabel}</span> from{' '}
            {asset?.source_chain === 'polygon' ? 'Polygon' : 'PulseChain'} back to{' '}
            {asset?.source_chain === 'polygon' ? 'PulseChain' : 'Polygon'}.
          </DialogDescription>
        </DialogHeader>

        {step === 'confirm' && (
          <div className="space-y-4">
            {/* Warning */}
            <div className="rounded-lg border border-warning/20 bg-warning/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                <div>
                  <p className="text-sm font-medium text-warning">Important Notes</p>
                  <ul className="mt-1.5 list-disc pl-4 text-xs text-muted-foreground space-y-1">
                    <li>This action is irreversible once confirmed</li>
                    <li>Processing takes 15-30 minutes</li>
                    <li>Track progress in your Bridge Wallet</li>
                    <li>Gas fees are sponsored by SwapPulse</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={unbridgeMutation.isPending}
                className="flex-1"
              >
                {unbridgeMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Confirm Port'
                )}
              </Button>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
          </div>
        )}

        {step === 'processing' && (
          <div className="flex flex-col items-center py-8 text-center">
            <Loader2 className="mb-4 h-10 w-10 animate-spin text-primary" />
            <h3 className="mb-1 text-base font-semibold">Burning Asset...</h3>
            <p className="text-sm text-muted-foreground">
              Please wait while we process your port request.
            </p>
          </div>
        )}

        {step === 'complete' && (
          <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle2 className="mb-4 h-10 w-10 text-success" />
            <h3 className="mb-1 text-base font-semibold">Port Initiated!</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Your asset is being transferred back to{' '}
              {asset?.source_chain === 'polygon' ? 'PulseChain' : 'Polygon'}.
            </p>
            <Button onClick={onClose}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}