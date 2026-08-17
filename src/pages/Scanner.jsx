import React, { useRef, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { queueScannerCorrection, createEntry } from '@/lib/offlineSync';
import PageHeader from '@/components/PageHeader';
import CardSearchModal from '@/components/cards/CardSearchModal';
import ScanResultCard from '@/components/scanner/ScanResultCard';
import LiveCameraScanner from '@/components/scanner/LiveCameraScanner';

export default function Scanner() {
  const { toast } = useToast();
  const scannerRef = useRef(null);
  const [lockedScan, setLockedScan] = useState(null);
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
      setLockedScan((prev) => (prev?.id === scan.id ? { ...prev, status: 'added', addedCard: card, correctionType } : prev));
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

  const onLock = (data) => {
    setLockedScan({
      id: data.scan_id || crypto.randomUUID(),
      status: 'done',
      imageUrl: data.imageUrl,
      scanId: data.scan_id,
      modelVersion: data.model_version,
      imageHash: data.image_hash,
      timestamp: data.timestamp,
      prediction: data.prediction,
      candidates: data.candidates || [],
    });
  };

  const resetScanner = () => {
    scannerRef.current?.reset();
    setLockedScan(null);
    setPendingCorrection(null);
  };

  const onManualSelect = async (card) => {
    const scan = lockedScan;
    setManualFor(null);
    if (!scan) {
      // No scan context (camera denied) — add directly without a correction.
      try {
        await createEntry({
          card_id: card.card_id,
          card_name: card.card_name,
          card_image: card.image,
          set_id: card.set_id,
          set_name: card.set_name,
          local_id: card.local_id,
          rarity: card.rarity,
          variant: 'normal',
          condition: 'near_mint',
          acquisition_date: new Date().toISOString().slice(0, 10),
        });
        toast({ title: 'Added to collection', description: card.card_name });
      } catch (e) {
        toast({ title: 'Could not add', description: e.message, variant: 'destructive' });
      }
      return;
    }
    const correctionType = detectCorrectionType(scan, card, true);
    if (correctionType === 'confirm_correct') {
      submitAndAdd(scan, card, correctionType, '', true);
    } else {
      setPendingCorrection({ scanId: scan.id, card, correctionType, viaManual: true });
    }
  };

  return (
    <>
      <PageHeader title="Scan Cards" subtitle="Point your camera at a card — we'll identify it live" />
      <div className="space-y-3 p-4">
        <LiveCameraScanner
          ref={scannerRef}
          onLock={onLock}
          onReset={() => setLockedScan(null)}
          onManual={() => setManualFor('denied')}
        />
        {lockedScan && (
          <ScanResultCard
            scan={lockedScan}
            onSelectCandidate={handleSelectCandidate}
            onManual={() => setManualFor(lockedScan.id)}
            onDismiss={resetScanner}
            pendingCorrection={pendingCorrection}
            onSubmitCorrection={submitAndAdd}
            onCancelCorrection={() => setPendingCorrection(null)}
          />
        )}
      </div>
      <CardSearchModal open={!!manualFor} onClose={() => setManualFor(null)} onSelect={onManualSelect} title="Find the right card" />
    </>
  );
}