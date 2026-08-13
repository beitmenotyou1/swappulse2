import React, { useRef, useState, useCallback } from 'react';
import { UploadCloud, Loader2, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const AUTO_ADD_THRESHOLD = 0.5;

export default function ScannerBatchUpload({ setId, setName, onScanComplete }) {
  const fileInputRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previews, setPreviews] = useState([]);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFiles = useCallback(async (files) => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);
    setError(null);
    setResults(null);
    setProgress(0);

    const fileArr = Array.from(files).slice(0, 20);
    const urls = fileArr.map((f) => URL.createObjectURL(f));
    setPreviews(urls);

    const scanResults = [];
    const matchedIds = [];
    const entriesToCreate = [];

    try {
      for (let i = 0; i < fileArr.length; i++) {
        setProgress(Math.round(((i + 1) / fileArr.length) * 100));
        const file = fileArr[i];

        // 1. Upload the image
        const { file_url } = await base44.integrations.Core.UploadFile({ file });

        // 2. Scan it
        const scanRes = await base44.functions.invoke('scan-card', { image_url: file_url });
        const scan = scanRes.data || scanRes;
        const candidates = scan.candidates || [];
        const top = candidates[0];

        if (top && (top.confidence ?? 0) >= AUTO_ADD_THRESHOLD) {
          entriesToCreate.push({
            card_id: top.card_id,
            card_name: top.card_name,
            set_id: top.set_id || setId,
            set_name: top.set_name || '',
            local_id: top.local_id || '',
            rarity: top.rarity || '',
            card_image: top.image || '',
          });
          matchedIds.push(top.card_id);
          scanResults.push({ card: top, status: 'matched', confidence: top.confidence });
        } else if (top) {
          scanResults.push({ card: top, status: 'review', confidence: top.confidence });
        } else {
          scanResults.push({ card: null, status: 'no_match', confidence: 0 });
        }
      }

      // Batch-create all matched collection entries in a single API call
      if (entriesToCreate.length > 0) {
        try {
          await base44.entities.CollectionEntry.bulkCreate(entriesToCreate);
        } catch {
          // Mark matched entries as error if bulk create fails
          for (const r of scanResults) {
            if (r.status === 'matched') r.status = 'error';
          }
        }
      }

      setResults(scanResults);
      onScanComplete?.(matchedIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scanner failed to process images');
    } finally {
      setIsProcessing(false);
    }
  }, [setId, onScanComplete]);

  const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); };
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  const handleReset = () => {
    previews.forEach((url) => URL.revokeObjectURL(url));
    setPreviews([]);
    setResults(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const matched = results?.filter((r) => r.status === 'matched').length || 0;
  const review = results?.filter((r) => r.status === 'review').length || 0;
  const noMatch = results?.filter((r) => r.status === 'no_match').length || 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <UploadCloud className="h-5 w-5 text-primary" />
        <h3 className="font-bold">Batch Scan Cards</h3>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Snap photos of your cards and upload them here. Our AI scanner will identify each card and mark it as owned in your checklist automatically.
      </p>

      {/* Upload zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-secondary/20'
        } ${isProcessing ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        {isProcessing ? (
          <div className="space-y-3">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Scanning… {progress}%</p>
            <div className="mx-auto h-1.5 w-48 overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : previews.length > 0 ? (
          <div className="space-y-3">
            <div className="flex flex-wrap justify-center gap-2">
              {previews.slice(0, 6).map((url, idx) => (
                <img key={idx} src={url} alt={`Card ${idx + 1}`} className="h-16 w-12 rounded border border-border object-cover" />
              ))}
              {previews.length > 6 && (
                <div className="flex h-16 w-12 items-center justify-center rounded border border-border bg-secondary text-xs text-muted-foreground">
                  +{previews.length - 6}
                </div>
              )}
            </div>
            <button onClick={(e) => { e.stopPropagation(); handleReset(); }} className="text-xs text-muted-foreground hover:text-foreground">
              Clear and scan again
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Drag and drop card photos here</p>
            <p className="text-xs text-muted-foreground/70">or click to browse (up to 20 at once)</p>
          </div>
        )}
      </div>

      {/* Results */}
      {results && !isProcessing && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-success/20 bg-success/5 p-3 text-center">
              <p className="text-2xl font-bold text-success">{matched}</p>
              <p className="text-xs text-muted-foreground">Matched</p>
            </div>
            <div className="rounded-lg border border-warning/20 bg-warning/5 p-3 text-center">
              <p className="text-2xl font-bold text-warning">{review}</p>
              <p className="text-xs text-muted-foreground">Need review</p>
            </div>
            <div className="rounded-lg border border-border bg-secondary p-3 text-center">
              <p className="text-2xl font-bold text-muted-foreground">{noMatch}</p>
              <p className="text-xs text-muted-foreground">No match</p>
            </div>
          </div>
          {matched > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 p-3 text-xs text-success">
              <CheckCircle2 className="h-4 w-4" /> Added {matched} {matched === 1 ? 'card' : 'cards'} to your collection.
            </div>
          )}
          {review > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/5 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p className="text-xs text-muted-foreground">
                {review} {review === 1 ? 'card needs' : 'cards need'} manual review — the scanner wasn't confident enough. You can mark them manually in the checklist below.
              </p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
          <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}