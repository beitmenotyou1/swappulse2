import React, { useRef, useState } from 'react';
import { ScanLine, Camera, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { queueScannerCorrection, createEntry } from '@/lib/offlineSync';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import CardSearchModal from '@/components/cards/CardSearchModal';
import ScanResultCard from '@/components/scanner/ScanResultCard';
import ScanTips from '@/components/scanner/ScanTips';

export default function Scanner() {
  const { toast } = useToast();
  const inputRef = useRef(null);
  const [scans, setScans] = useState([]);
  const [busy, setBusy] = useState(false);
  const [manualFor, setManualFor] = useState(null);
  const [pendingCorrection, setPendingCorrection] = useState(null);

  const detectCorrectionType = (scan, card, viaManual = false) => {
    const top = scan.candidates?.[0];
    if (viaManual && (!top || !scan.prediction?.card_name)) return 'no_match_found';
    if (!top || !top.card_id) return 'no_match_found';
    if (top.card_id === card.card_id) return 'confirm_correct';
    if (top.set_id && card.set_id && top.set_id !== card.set_id) return 'wrong_set';
    return 'wrong_card';
  };

  const submitAndAdd = async (scan, card, correctionType, notes, viaManual = false) => {
    const top = scan.candidates?.[0];
    try {
      await queueScannerCorrection({
        image_hash: scan.imageHash || '',
        image_url: scan.imageUrl || '',
        predicted_card_id: top?.card_id || '',
        predicted_set_id: top?.set_id || '',
        predicted_card_name: scan.prediction?.card_name || top?.card_name || '',
        corrected_card_id: card.card_id,
        corrected_set_id: card.set_id || '',
        corrected_card_name: card.card_name,
        confidence: scan.prediction?.confidence || 0,
        correction_type: correctionType,
        scanner_version: scan.modelVersion || '',
        notes: notes || '',
      });

      await createEntry({
        card_id: card.card_id,
        card_name: card.card_name,
        card_image: card.image,
        set_id: card.set_id,
        set_name: card.set_name,
        local_id: card.local_id,
        rarity: card.rarity,
        variant: scan.prediction?.variant || 'normal',
        condition: 'near_mint',
        acquisition_date: new Date().toISOString().slice(0, 10),
      });

      toast({ title: 'Added to collection', description: card.card_name });
      setScans((prev) => prev.map((s) => (s.id === scan.id ? { ...s, status: 'added', addedCard: card, correctionType } : s)));
      setPendingCorrection(null);
    } catch (e) {
      toast({ title: 'Could not add', description: e.message, variant: 'destructive' });
    }
  };

  const handleSelectCandidate = (scan, candidate) => {
    const correctionType = detectCorrectionType(scan, candidate, false);
    if (correctionType === 'confirm_correct') {
      submitAndAdd(scan, candidate, correctionType, '');
    } else {
      setPendingCorrection({ scanId: scan.id, card: candidate, correctionType, viaManual: false });
    }
  };

  const runScan = async (file) => {
    const scanId = crypto.randomUUID();
    setScans((prev) => [{ id: scanId, status: 'uploading', file }, ...prev]);
    let imageUrl;
    try {
      const up = await base44.integrations.Core.UploadFile({ file });
      imageUrl = up.file_url;
    } catch {
      setScans((prev) => prev.map((s) => (s.id === scanId ? { ...s, status: 'fallback', error: 'Upload failed' } : s)));
      return;
    }
    setScans((prev) => prev.map((s) => (s.id === scanId ? { ...s, status: 'scanning', imageUrl } : s)));
    try {
      const res = await base44.functions.invoke('scan-card', { image_url: imageUrl });
      const data = res.data || {};
      setScans((prev) =>
        prev.map((s) =>
          s.id === scanId
            ? {
                ...s,
                status: data.fallback ? 'fallback' : 'done',
                scanId: data.scan_id,
                modelVersion: data.model_version,
                imageHash: data.image_hash,
                timestamp: data.timestamp,
                prediction: data.prediction,
                candidates: data.candidates || [],
                error: data.error,
              }
            : s,
        ),
      );
    } catch (e) {
      setScans((prev) => prev.map((s) => (s.id === scanId ? { ...s, status: 'fallback', error: e.message } : s)));
    }
  };

  const onFiles = async (files) => {
    if (!files?.length) return;
    setBusy(true);
    await Promise.allSettled(Array.from(files).map(runScan));
    setBusy(false);
  };

  const onManualSelect = (card) => {
    const scan = scans.find((s) => s.id === manualFor);
    if (scan) {
      const correctionType = detectCorrectionType(scan, card, true);
      if (correctionType === 'confirm_correct') {
        submitAndAdd(scan, card, correctionType, '', true);
      } else {
        setPendingCorrection({ scanId: scan.id, card, correctionType, viaManual: true });
      }
    }
    setManualFor(null);
  };

  const dismiss = (id) => {
    setScans((prev) => prev.filter((s) => s.id !== id));
    if (pendingCorrection?.scanId === id) setPendingCorrection(null);
  };

  return (
    <>
      <PageHeader title="Scan Cards" subtitle="Photograph a card and add it to your collection">
        <Button size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Camera className="mr-1.5 h-4 w-4" />}
          Scan
        </Button>
      </PageHeader>

      <div className="p-4">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="hidden"
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = '';
          }}
        />

        {scans.length === 0 ? (
          <div>
            <button
              onClick={() => inputRef.current?.click()}
              className="grid w-full place-items-center gap-3 rounded-2xl border-2 border-dashed border-border py-16 text-center transition-colors hover:border-primary/60 hover:bg-secondary"
            >
              <ScanLine className="h-10 w-10 text-primary" />
              <div>
                <p className="font-semibold">Tap to scan a card</p>
                <p className="text-sm text-muted-foreground">Take a photo or upload an image — we'll identify it for you</p>
              </div>
            </button>
            <ScanTips />
          </div>
        ) : (
          <div className="space-y-3">
            {scans.map((scan) => (
              <ScanResultCard
                key={scan.id}
                scan={scan}
                onSelectCandidate={handleSelectCandidate}
                onManual={(id) => setManualFor(id)}
                onDismiss={dismiss}
                pendingCorrection={pendingCorrection}
                onSubmitCorrection={submitAndAdd}
                onCancelCorrection={() => setPendingCorrection(null)}
              />
            ))}
          </div>
        )}
      </div>

      <CardSearchModal open={!!manualFor} onClose={() => setManualFor(null)} onSelect={onManualSelect} title="Find the right card" />
    </>
  );
}