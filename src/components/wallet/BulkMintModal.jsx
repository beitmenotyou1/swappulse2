import React, { useState, useRef, useCallback } from 'react';
import { X, Loader2, Camera, CheckCircle2, AlertCircle, ShieldCheck, Upload, Zap } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Image } from '@/components/ui/image';
import UnlockWalletModal from '@/components/blockchain/UnlockWalletModal';

// Bulk minting modal: collectors select multiple cards from their collection,
// capture a proof photo for each, and mint them all to Polygon simultaneously.
// Each NFT uses the official TCGDex card image and includes the minter's username.
export default function BulkMintModal({ onClose, onMinted }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState('select'); // select | photos | minting | results
  const [collection, setCollection] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [proofPhotos, setProofPhotos] = useState({}); // { collectionEntryId: url }
  const [loading, setLoading] = useState(true);
  const [uploadingFor, setUploadingFor] = useState(null);
  const [minting, setMinting] = useState(false);
  const [results, setResults] = useState(null);
  const [unlockState, setUnlockState] = useState(null);
  const fileInputRefs = useRef({});

  const userDid = user?.data?.did || user?.did;

  const loadCollection = useCallback(async () => {
    if (!userDid) { setLoading(false); return; }
    try {
      // Fetch collection entries that have card info
      const entries = await base44.entities.CollectionEntry.filter({}, '-updated_date', 200);
      // Filter out already-minted entries
      const mintedCheck = await base44.entities.OnChainAsset.filter({ asset_type: 'card' }, '-minted_at', 200).catch(() => []);
      const mintedEntryIds = new Set(mintedCheck.map(a => a.linked_collection_entry_id).filter(Boolean));
      const unminted = entries.filter(e => e.card_id && !mintedEntryIds.has(e.id));
      setCollection(unminted);
    } catch (e) {
      toast({ title: 'Failed to load collection', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [userDid]);

  React.useEffect(() => { loadCollection(); }, [loadCollection]);

  const toggleSelect = (entryId) => {
    const next = new Set(selected);
    if (next.has(entryId)) {
      next.delete(entryId);
      const photos = { ...proofPhotos };
      delete photos[entryId];
      setProofPhotos(photos);
    } else {
      next.add(entryId);
    }
    setSelected(next);
  };

  const handlePhotoUpload = async (entryId, file) => {
    setUploadingFor(entryId);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      setProofPhotos(prev => ({ ...prev, [entryId]: res.file_url }));
    } catch (e) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    } finally {
      setUploadingFor(null);
    }
  };

  const allPhotosReady = () => {
    for (const id of selected) {
      if (!proofPhotos[id]) return false;
    }
    return true;
  };

  const doBulkMint = async (unlockCredential) => {
    setMinting(true);
    setStep('minting');
    try {
      const items = Array.from(selected).map(id => {
        const entry = collection.find(e => e.id === id);
        return {
          collectionEntryId: id,
          proofPhotoUrl: proofPhotos[id],
          cardName: entry?.card_name || '',
        };
      });

      const res = await base44.functions.invoke('bulk-mint-cards', { items, unlockCredential });

      if (res.data.requiresUnlock) {
        setUnlockState({ hasPasskey: res.data.hasPasskey, hasPin: res.data.hasPin });
        setMinting(false);
        setStep('photos');
        return;
      }

      setResults(res.data);
      setStep('results');
      if (res.data.totalMinted > 0) {
        toast({
          title: `${res.data.totalMinted} card${res.data.totalMinted !== 1 ? 's' : ''} minted!`,
          description: 'Your NFTs are now on Polygon.',
        });
      }
      if (onMinted && res.data.totalMinted > 0) onMinted();
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      toast({ title: 'Bulk mint failed', description: msg, variant: 'destructive' });
      setStep('photos');
    } finally {
      setMinting(false);
    }
  };

  const handleUnlock = (credential) => {
    setUnlockState(null);
    doBulkMint(credential);
  };

  const selectedEntries = collection.filter(e => selected.has(e.id));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-border bg-card sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-3">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Bulk Mint Cards</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
          {['select', 'photos', 'minting', 'results'].map((s, i) => {
            const stepOrder = ['select', 'photos', 'minting', 'results'];
            const active = stepOrder.indexOf(step) >= i;
            return (
              <div key={s} className={`h-1.5 flex-1 rounded-full ${active ? 'bg-primary' : 'bg-secondary'}`} />
            );
          })}
        </div>

        <div className="p-4 space-y-4">
          {/* Step 1: Select cards */}
          {step === 'select' && (
            <>
              <div className="rounded-lg bg-primary/5 p-3 text-sm">
                <p className="font-semibold">Select cards to mint</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Choose multiple cards from your collection to mint as NFTs on Polygon simultaneously. Gas is paid by you.
                </p>
              </div>
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : collection.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm font-semibold text-muted-foreground">No unminted cards in your collection</p>
                  <p className="mt-1 text-xs text-muted-foreground">Add cards to your collection first, or they may already be minted.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{selected.size} selected · {collection.length} available</span>
                    <button
                      onClick={() => { setSelected(new Set()); setProofPhotos({}); }}
                      className="text-xs text-primary hover:underline"
                      disabled={selected.size === 0}
                    >
                      Clear
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {collection.map((entry) => {
                      const isSelected = selected.has(entry.id);
                      return (
                        <button
                          key={entry.id}
                          onClick={() => toggleSelect(entry.id)}
                          className={`relative overflow-hidden rounded-xl border-2 transition ${
                            isSelected ? 'border-primary shadow-raised' : 'border-border hover:border-primary/30'
                          }`}
                        >
                          <div className="aspect-[3/4] bg-secondary">
                            {entry.card_image ? (
                              <Image src={entry.card_image} alt={entry.card_name} fittingType="fill" className="h-full w-full" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">{entry.card_name?.slice(0, 12)}</div>
                            )}
                          </div>
                          {isSelected && (
                            <div className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-white">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </div>
                          )}
                          <p className="truncate p-1 text-[10px] font-semibold">{entry.card_name}</p>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => selected.size > 0 && setStep('photos')}
                    disabled={selected.size === 0}
                    className="w-full rounded-full bg-primary py-3 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
                  >
                    Continue with {selected.size} card{selected.size !== 1 ? 's' : ''}
                  </button>
                </>
              )}
            </>
          )}

          {/* Step 2: Capture proof photos */}
          {step === 'photos' && (
            <>
              <div className="rounded-lg bg-amber-500/10 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-amber-500" />
                  <p className="font-semibold">Capture proof photos</p>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Take a clear photo of each physical card to prove ownership. This establishes authenticity before minting.
                </p>
              </div>
              <div className="space-y-3">
                {selectedEntries.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                    <div className="h-16 w-12 shrink-0 overflow-hidden rounded border border-border bg-secondary">
                      {entry.card_image ? (
                        <Image src={entry.card_image} alt={entry.card_name} fittingType="fill" className="h-full w-full" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{entry.card_name}</p>
                      {proofPhotos[entry.id] ? (
                        <div className="mt-1 flex items-center gap-2">
                          <img src={proofPhotos[entry.id]} alt="Proof" className="h-12 w-12 rounded border object-cover" />
                          <button
                            onClick={() => fileInputRefs.current[entry.id]?.click()}
                            className="text-xs text-primary hover:underline"
                          >
                            Retake
                          </button>
                        </div>
                      ) : uploadingFor === entry.id ? (
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
                        </div>
                      ) : (
                        <button
                          onClick={() => fileInputRefs.current[entry.id]?.click()}
                          className="mt-1 flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-primary/50 hover:text-primary"
                        >
                          <Camera className="h-3.5 w-3.5" /> Take photo
                        </button>
                      )}
                      <input
                        ref={(el) => { fileInputRefs.current[entry.id] = el; }}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => e.target.files[0] && handlePhotoUpload(entry.id, e.target.files[0])}
                      />
                    </div>
                    {proofPhotos[entry.id] && (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep('select')}
                  className="flex-1 rounded-full border border-border py-2.5 text-sm font-semibold hover:bg-secondary"
                >
                  Back
                </button>
                <button
                  onClick={() => doBulkMint(null)}
                  disabled={!allPhotosReady() || minting}
                  className="flex-[2] rounded-full bg-primary py-2.5 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {minting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : `Mint ${selected.size} NFT${selected.size !== 1 ? 's' : ''} on Polygon`}
                </button>
              </div>
            </>
          )}

          {/* Step 3: Minting */}
          {step === 'minting' && (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-bold">Minting your cards on Polygon…</p>
              <p className="text-xs text-muted-foreground">This may take a moment. Each card is being minted as an NFT.</p>
            </div>
          )}

          {/* Step 4: Results */}
          {step === 'results' && results && (
            <>
              <div className="flex flex-col items-center gap-2 py-4">
                <div className="flex items-center gap-2">
                  {results.totalFailed === 0 ? (
                    <CheckCircle2 className="h-8 w-8 text-success" />
                  ) : results.totalMinted > 0 ? (
                    <AlertCircle className="h-8 w-8 text-amber-500" />
                  ) : (
                    <AlertCircle className="h-8 w-8 text-destructive" />
                  )}
                  <h3 className="text-xl font-extrabold">
                    {results.totalMinted} minted{results.totalFailed > 0 ? `, ${results.totalFailed} failed` : ''}
                  </h3>
                </div>
              </div>
              <div className="space-y-2">
                {results.results.map((r, i) => (
                  <div key={i} className={`flex items-center gap-3 rounded-xl border p-3 ${r.success ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'}`}>
                    {r.success ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" /> : <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{r.cardName}</p>
                      {r.success ? (
                        <a href={r.explorerUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                          View on PolygonScan
                        </a>
                      ) : (
                        <p className="text-xs text-destructive">{r.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={onClose}
                className="w-full rounded-full bg-primary py-3 text-sm font-bold text-white hover:bg-primary/90"
              >
                Done
              </button>
            </>
          )}
        </div>

        {unlockState && (
          <UnlockWalletModal
            open={true}
            unlockState={unlockState}
            onUnlock={handleUnlock}
            onCancel={() => { setUnlockState(null); setMinting(false); setStep('photos'); }}
          />
        )}
      </div>
    </div>
  );
}