import React, { forwardRef, useImperativeHandle, useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Upload, Search, RefreshCw, ScanLine, AlertCircle } from 'lucide-react';
import { uploadScanImage, runScan } from '@/lib/scanUpload';
import MatchOverlay from '@/components/scanner/MatchOverlay';

const POLL_MS = 2500;
const FIRST_POLL_MS = 800;
const CONFIDENCE_THRESHOLD = 0.8;
const CONSECUTIVE_REQUIRED = 2;
const MAX_DIM = 1600;

// Shared continuous auto-scan camera view. Captures frames on a throttled
// interval, uploads each via the reliable UploadFile path, invokes scan-card,
// and renders the top candidate live over the viewfinder. Auto-locks when the
// same candidate exceeds the confidence threshold for N consecutive scans.
// Exposes `reset()` via ref so the parent can clear a lock and scan again.
const LiveCameraScanner = forwardRef(function LiveCameraScanner({ onLock, onReset, onManual }, ref) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanningRef = useRef(false);
  const aliveRef = useRef(true);
  const lockedRef = useRef(false);
  const onLockRef = useRef(onLock);
  const onResetRef = useRef(onReset);
  const consecutiveRef = useRef({ id: '', count: 0 });
  const fileInputRef = useRef(null);

  const [status, setStatus] = useState('starting'); // starting | live | denied | error
  const [liveMatch, setLiveMatch] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [locked, setLocked] = useState(null);
  const [fileError, setFileError] = useState('');

  useEffect(() => { onLockRef.current = onLock; }, [onLock]);
  useEffect(() => { onResetRef.current = onReset; }, [onReset]);

  const captureFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
    const canvas = canvasRef.current;
    let w = video.videoWidth;
    let h = video.videoHeight;
    const scale = Math.min(1, MAX_DIM / Math.max(w, h));
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(video, 0, 0, w, h);
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92));
  }, []);

  const runOneScan = useCallback(async () => {
    if (scanningRef.current || lockedRef.current || !aliveRef.current) return;
    const blob = await captureFrame();
    if (!blob || lockedRef.current || !aliveRef.current) return;
    scanningRef.current = true;
    setScanning(true);
    try {
      const file = new File([blob], 'scan.jpg', { type: 'image/jpeg' });
      const url = await uploadScanImage(file);
      const data = await runScan(url);
      if (!aliveRef.current || lockedRef.current) return;
      const top = data.candidates?.[0];
      setLiveMatch(top ? { ...top, imageUrl: url } : null);
      if (top && top.card_id && (top.confidence ?? 0) >= CONFIDENCE_THRESHOLD) {
        const c = consecutiveRef.current;
        if (c.id === top.card_id) c.count += 1;
        else { c.id = top.card_id; c.count = 1; }
        if (c.count >= CONSECUTIVE_REQUIRED) {
          lockedRef.current = true;
          const payload = { ...data, imageUrl: url };
          setLocked(payload);
          onLockRef.current?.(payload);
        }
      } else {
        consecutiveRef.current = { id: '', count: 0 };
      }
    } catch {
      // transient — keep scanning on the next tick
    } finally {
      scanningRef.current = false;
      setScanning(false);
    }
  }, [captureFrame]);

  // Start the camera stream.
  useEffect(() => {
    aliveRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) { setStatus('denied'); return; }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setStatus('live');
      } catch (e) {
        if (cancelled) return;
        setStatus(e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'denied' : 'error');
      }
    })();
    return () => {
      cancelled = true;
      aliveRef.current = false;
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    };
  }, []);

  // Throttled poll loop — runs while live and not locked.
  useEffect(() => {
    if (status !== 'live' || locked) return;
    let cancelled = false;
    let timer;
    (async () => {
      await new Promise((r) => { timer = setTimeout(r, FIRST_POLL_MS); });
      while (!cancelled && !lockedRef.current && aliveRef.current) {
        await runOneScan();
        if (cancelled || lockedRef.current) break;
        await new Promise((r) => { timer = setTimeout(r, POLL_MS); });
      }
    })();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [status, locked, runOneScan]);

  const reset = useCallback(() => {
    lockedRef.current = false;
    consecutiveRef.current = { id: '', count: 0 };
    setLocked(null);
    setLiveMatch(null);
    setFileError('');
    onResetRef.current?.();
  }, []);

  useImperativeHandle(ref, () => ({ reset }), [reset]);

  const onFile = useCallback(async (file) => {
    if (!file) return;
    setFileError('');
    scanningRef.current = true;
    setScanning(true);
    try {
      const url = await uploadScanImage(file);
      const data = await runScan(url);
      if (!aliveRef.current) return;
      const top = data.candidates?.[0];
      setLiveMatch(top ? { ...top, imageUrl: url } : null);
      lockedRef.current = true;
      const payload = { ...data, imageUrl: url };
      setLocked(payload);
      onLockRef.current?.(payload);
    } catch (e) {
      setFileError(e?.message || 'Upload failed — try again');
    } finally {
      scanningRef.current = false;
      setScanning(false);
    }
  }, []);

  const top = locked?.candidates?.[0] || liveMatch;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-black" style={{ aspectRatio: '3 / 4' }}>
      <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />

      {/* starting */}
      {status === 'starting' && (
        <div className="absolute inset-0 grid place-items-center bg-black/60">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-xs">Starting camera…</p>
          </div>
        </div>
      )}

      {/* live scanning indicator */}
      {status === 'live' && !locked && (
        <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur">
          {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanLine className="h-3.5 w-3.5" />}
          {scanning ? 'Identifying…' : 'Scanning…'}
        </div>
      )}

      {/* live match overlay */}
      {status === 'live' && !locked && top && <MatchOverlay candidate={top} locked={false} />}

      {/* locked overlay + scan again */}
      {locked && (
        <>
          {top && <MatchOverlay candidate={top} locked />}
          <button
            type="button"
            onClick={reset}
            className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur hover:bg-black/80"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Scan again
          </button>
        </>
      )}

      {/* gallery upload (secondary) — always available */}
      {status === 'live' && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur hover:bg-black/80"
          >
            <Upload className="h-3.5 w-3.5" /> Gallery
          </button>
        </>
      )}

      {/* permission denied / error fallback */}
      {(status === 'denied' || status === 'error') && (
        <div className="absolute inset-0 grid place-items-center bg-black/70 p-6 text-center">
          <div className="flex max-w-xs flex-col items-center gap-3">
            <AlertCircle className="h-9 w-9 text-warning" />
            <p className="text-sm font-semibold text-white">
              {status === 'denied' ? 'Camera access blocked' : 'Camera unavailable'}
            </p>
            <p className="text-xs text-muted-foreground">
              {status === 'denied'
                ? 'Allow camera access, or upload a photo from your gallery instead.'
                : 'We could not open the camera. Try uploading a photo instead.'}
            </p>
            {fileError && <p className="text-xs text-destructive">{fileError}</p>}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Upload className="h-4 w-4" /> Upload photo
              </button>
              {onManual && (
                <button
                  type="button"
                  onClick={onManual}
                  className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
                >
                  <Search className="h-4 w-4" /> Search manually
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
            />
          </div>
        </div>
      )}
    </div>
  );
});

export default LiveCameraScanner;