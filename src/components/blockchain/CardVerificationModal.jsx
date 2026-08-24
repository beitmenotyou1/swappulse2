import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Camera, ShieldCheck, AlertTriangle, Award, Upload, X, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import CardImage from '@/components/cards/CardImage';

// Multi-step modal for verifying physical card ownership before minting.
// Step 1: Upload scan photos of the physical card (+ optional grading cert)
// Step 2: AI vision verification (loading)
// Step 3: Result + mint at achieved level, or mint without verification (Level 0)
export default function CardVerificationModal({
  open,
  onOpenChange,
  collectionEntryId,
  card,
  onMint, // (verificationSessionId | null) => void
}) {
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  const [step, setStep] = useState('upload'); // upload | verifying | result
  const [scanUrls, setScanUrls] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [gradingCompany, setGradingCompany] = useState('none');
  const [gradingCert, setGradingCert] = useState('');
  const [result, setResult] = useState(null);
  const [minting, setMinting] = useState(false);

  const reset = () => {
    setStep('upload');
    setScanUrls([]);
    setGradingCompany('none');
    setGradingCert('');
    setResult(null);
    setMinting(false);
  };

  const handleFiles = async (files) => {
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of Array.from(files).slice(0, 4 - scanUrls.length)) {
        const res = await base44.integrations.Core.UploadFile({ file });
        uploaded.push(res.file_url);
      }
      setScanUrls([...scanUrls, ...uploaded]);
    } catch (e) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const removeScan = (idx) => {
    setScanUrls(scanUrls.filter((_, i) => i !== idx));
  };

  const handleVerify = async () => {
    if (scanUrls.length === 0) {
      toast({ title: 'Upload at least one photo', variant: 'destructive' });
      return;
    }
    setStep('verifying');
    try {
      const res = await base44.functions.invoke('verify-card-ownership', {
        collectionEntryId,
        scanImageUrls: scanUrls,
        gradingCompany: gradingCompany !== 'none' ? gradingCompany : undefined,
        gradingCertNumber: gradingCompany !== 'none' ? gradingCert : undefined,
      });
      setResult(res.data);
      setStep('result');
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      toast({ title: 'Verification failed', description: msg, variant: 'destructive' });
      setStep('upload');
    }
  };

  const handleMintWithVerification = async () => {
    setMinting(true);
    try {
      await onMint(result.session.id);
    } finally {
      setMinting(false);
    }
  };

  const handleMintWithoutVerification = async () => {
    setMinting(true);
    try {
      await onMint(null);
    } finally {
      setMinting(false);
    }
  };

  const levelLabel = (level) => {
    if (level >= 3) return { label: 'Level 3 — Graded', color: 'text-accent', icon: Award };
    if (level === 2) return { label: 'Level 2 — AI-Verified', color: 'text-primary', icon: ShieldCheck };
    if (level === 1) return { label: 'Level 1 — Scanned', color: 'text-primary', icon: ShieldCheck };
    return { label: 'Level 0 — Self-attested', color: 'text-muted-foreground', icon: AlertTriangle };
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Verify Card Ownership</DialogTitle>
          <DialogDescription>
            Prove you physically own this card before minting. Higher verification levels increase on-chain trust.
          </DialogDescription>
        </DialogHeader>

        {/* Reference card image */}
        {card && (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-2">
            <div className="h-20 w-16 shrink-0 overflow-hidden rounded">
              <CardImage card={card} quality="low" className="rounded" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{card.name || card.card_name}</p>
              <p className="text-xs text-muted-foreground">Reference card from TCGDex</p>
            </div>
          </div>
        )}

        {step === 'upload' && (
          <div className="space-y-4">
            {/* Scan photo upload */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">Photos of your physical card</label>
              <div className="grid grid-cols-4 gap-2">
                {scanUrls.map((url, idx) => (
                  <div key={idx} className="relative aspect-[3/4] overflow-hidden rounded border">
                    <img src={url} alt={`Scan ${idx + 1}`} className="h-full w-full object-cover" />
                    <button
                      onClick={() => removeScan(idx)}
                      className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {scanUrls.length < 4 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex aspect-[3/4] items-center justify-center rounded border-2 border-dashed border-border hover:border-primary/50 disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <Camera className="h-5 w-5 text-muted-foreground" />}
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <p className="mt-1 text-xs text-muted-foreground">Up to 4 photos. Take clear, well-lit photos of the front and back.</p>
            </div>

            {/* Optional grading cert */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Grading certificate (optional, for Level 3)</label>
              <div className="flex gap-2">
                <select
                  value={gradingCompany}
                  onChange={(e) => setGradingCompany(e.target.value)}
                  className="flex-1 rounded border border-input bg-background px-2 py-1.5 text-sm"
                >
                  <option value="none">No grading</option>
                  <option value="psa">PSA</option>
                  <option value="bgs">BGS</option>
                  <option value="cgc">CGC</option>
                </select>
                <input
                  type="text"
                  value={gradingCert}
                  onChange={(e) => setGradingCert(e.target.value)}
                  placeholder="Cert #"
                  disabled={gradingCompany === 'none'}
                  className="flex-1 rounded border border-input bg-background px-2 py-1.5 text-sm disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        )}

        {step === 'verifying' && (
          <div className="flex flex-col items-center justify-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">AI is verifying your card…</p>
            <p className="text-xs text-muted-foreground">Comparing your photos against the reference card</p>
          </div>
        )}

        {step === 'result' && result && (
          <div className="space-y-4">
            {result.aiResult && (
              <div className={`flex items-start gap-2 rounded-lg border p-3 ${result.aiResult.matched ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'}`}>
                {result.aiResult.matched ? <CheckCircle2 className="h-5 w-5 text-success shrink-0" /> : <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {result.aiResult.matched ? 'Card matched' : 'Could not confirm match'}
                    <span className="ml-1.5 text-muted-foreground">({Math.round((result.aiResult.confidence || 0) * 100)}% confidence)</span>
                  </p>
                  {result.aiResult.anomalies?.length > 0 && (
                    <ul className="mt-1 text-xs text-muted-foreground">
                      {result.aiResult.anomalies.map((a, i) => <li key={i}>• {a}</li>)}
                    </ul>
                  )}
                  {result.aiResult.is_screen_photo && (
                    <p className="mt-1 text-xs text-warning">⚠ Looks like a photo of a screen</p>
                  )}
                </div>
              </div>
            )}

            {result.gradingVerified && (
              <div className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 p-3">
                <Award className="h-5 w-5 text-accent shrink-0" />
                <p className="text-sm font-semibold">Grading certificate verified</p>
              </div>
            )}

            <div className="flex items-center gap-2 rounded-lg bg-primary/5 p-3">
              {(() => {
                const lvl = levelLabel(result.verificationLevel);
                const Icon = lvl.icon;
                return (
                  <>
                    <Icon className={`h-5 w-5 shrink-0 ${lvl.color}`} />
                    <div>
                      <p className="text-sm font-semibold">Achieved: {lvl.label}</p>
                      <p className="text-xs text-muted-foreground">This will be embedded in the NFT metadata</p>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {step === 'upload' && (
            <>
              <Button onClick={handleVerify} disabled={scanUrls.length === 0 || uploading} className="w-full">
                <ShieldCheck className="mr-1.5 h-4 w-4" />
                Verify & Continue
              </Button>
              <Button variant="ghost" onClick={handleMintWithoutVerification} disabled={minting} className="w-full text-xs">
                Skip verification (mint at Level 0)
              </Button>
            </>
          )}
          {step === 'result' && (
            <>
              <Button onClick={handleMintWithVerification} disabled={minting} className="w-full">
                {minting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-1.5 h-4 w-4" />}
                Mint at Level {result.verificationLevel}
              </Button>
              <Button variant="ghost" onClick={() => setStep('upload')} disabled={minting} className="w-full text-xs">
                Try again
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}