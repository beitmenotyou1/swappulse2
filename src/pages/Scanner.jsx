import React, { useRef, useState } from 'react';
import { ScanLine, Camera, Search, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import CardSearchModal from '@/components/cards/CardSearchModal';
import ScanResultCard from '@/components/scanner/ScanResultCard';

export default function Scanner() {
  const { toast } = useToast();
  const inputRef = useRef(null);
  const [scans, setScans] = useState([]);
  const [busy, setBusy] = useState(false);
  const [manualFor, setManualFor] = useState(null);

  const logCorrection = async (scan, card, correctionType) => {
    try {
      await base44.entities.ScannerCorrection.create({
        original_scan_uri: scan.imageUrl,
        original_prediction: scan.prediction,
        corrected_card_id: card.card_id,
        corrected_card_name: card.card_name,
        correction_type: correctionType,
      });
    } catch (e) {
      console.error('correction log failed', e?.message || e);
    }
  };

  const addToCollection = async (scan, card) => {
    await base44.entities.CollectionEntry.create({
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
    setScans((prev) => prev.map((s) => (s.id === scan.id ? { ...s, status: 'added', addedCard: card } : s)));
  };

  const chooseCard = async (scan, card, viaManual = false) => {
    const top = scan.candidates?.[0];
    const isCorrection = (top && top.card_id !== card.card_id) || viaManual;
    try {
      if (isCorrection && scan.prediction?.card_name) {
        await logCorrection(scan, card, 'wrong_card');
      }
      await addToCollection(scan, card);
    } catch (e) {
      toast({ title: 'Could not add', description: e.message, variant: 'destructive' });
    }
  };

  const runScan = async (file) => {
    const scanId = crypto.randomUUID();
    setScans((prev) => [{ id: scanId, status: 'uploading', file }, ...prev]);
    let imageUrl;
    try {
      const up = await base44.integrations.Core.UploadFile({ file });
      imageUrl = up.file_url;
    } catch (e) {
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
            ? { ...s, status: data.fallback ? 'fallback' : 'done', prediction: data.prediction, candidates: data.candidates || [], error: data.error }
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
    if (scan) chooseCard(scan, card, true);
    setManualFor(null);
  };

  const dismiss = (id) => setScans((prev) => prev.filter((s) => s.id !== id));

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
        ) : (
          <div className="space-y-3">
            {scans.map((scan) => (
              <ScanResultCard
                key={scan.id}
                scan={scan}
                onChoose={(s, c) => chooseCard(s, c)}
                onManual={(id) => setManualFor(id)}
                onDismiss={dismiss}
              />
            ))}
          </div>
        )}
      </div>

      <CardSearchModal open={!!manualFor} onClose={() => setManualFor(null)} onSelect={onManualSelect} title="Find the right card" />
    </>
  );
}