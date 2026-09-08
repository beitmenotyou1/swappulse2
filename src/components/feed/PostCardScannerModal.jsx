import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  ImagePlus,
  Loader2,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import CardImage from '@/components/cards/CardImage';
import CardSearchModal from '@/components/cards/CardSearchModal';
import { useI18n } from '@/lib/i18n/I18nProvider';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function normaliseCard(card) {
  if (!card) return null;
  return {
    id: card.id || card.card_id,
    name: card.name || card.card_name || card.id || card.card_id,
    image: card.image || card.card_image || '',
    rarity: card.rarity || '',
    local_id: card.local_id || card.localId || '',
    set: {
      id: card.set?.id || card.set_id || '',
      name: card.set?.name || card.set_name || card.set?.id || card.set_id || '',
    },
  };
}

function candidateCard(candidate) {
  return normaliseCard({
    id: candidate?.card_id,
    name: candidate?.name,
    image: candidate?.image,
    rarity: candidate?.rarity,
    local_id: candidate?.local_id,
    set: {
      id: candidate?.set_id,
      name: candidate?.set_name,
    },
  });
}

export default function PostCardScannerModal({ open, onClose, onAttach }) {
  const { t, locale } = useI18n();
  const uploadRef = useRef(null);
  const cameraRef = useRef(null);
  const previewRef = useRef('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [stage, setStage] = useState('choose');
  const [session, setSession] = useState(null);
  const [result, setResult] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [error, setError] = useState('');

  const clearPreview = () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = '';
    setPreview('');
  };

  const reset = () => {
    clearPreview();
    setFile(null);
    setStage('choose');
    setSession(null);
    setResult(null);
    setSelectedCard(null);
    setManualOpen(false);
    setError('');
  };

  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  if (!open) return null;

  const chooseFile = (incoming) => {
    const next = incoming?.[0];
    if (!next) return;
    setError('');
    if (!ALLOWED_TYPES.has(next.type)) {
      setError(t('scanner.errorType'));
      return;
    }
    if (next.size > MAX_FILE_BYTES) {
      setError(t('scanner.errorFileSize'));
      return;
    }
    clearPreview();
    const nextPreview = URL.createObjectURL(next);
    previewRef.current = nextPreview;
    setPreview(nextPreview);
    setFile(next);
    setStage('choose');
    setSession(null);
    setResult(null);
    setSelectedCard(null);
  };

  const close = () => {
    if (stage === 'analysing' || stage === 'attaching') return;
    reset();
    onClose?.();
  };

  const analyse = async () => {
    if (!file || stage === 'analysing') return;
    if (!navigator.onLine) {
      setError(t('scanner.errorOnline'));
      return;
    }

    setError('');
    setStage('analysing');
    try {
      const uploaded = await base44.integrations.Core.UploadPrivateFile({ file });
      const fileUri = uploaded?.file_uri;
      if (!fileUri) throw new Error('PRIVATE_UPLOAD_FAILED');

      const response = await base44.functions.invoke('scan-card-batch', {
        file_uris: [fileUri],
        file_names: [file.name.slice(0, 180)],
        total_bytes: file.size,
        locale,
        purpose: 'post_attachment',
      });
      const data = response?.data ?? response;
      const firstResult = data?.session?.results?.[0];
      if (!data?.ok || !data?.session?.id || !firstResult) {
        throw new Error(data?.error || 'CARD_SCAN_FAILED');
      }

      setSession(data.session);
      setResult(firstResult);
      setSelectedCard(candidateCard(firstResult.candidates?.[0]));
      setStage('review');
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
        requestError?.message ||
        t('scanner.errorAnalysis'),
      );
      setStage('choose');
    }
  };

  const attach = async () => {
    if (!session?.id || !selectedCard?.id || stage === 'attaching') return;
    if (!navigator.onLine) {
      setError(t('scanner.errorOnline'));
      return;
    }

    setError('');
    setStage('attaching');
    try {
      const response = await base44.functions.invoke('complete-card-scan', {
        session_id: session.id,
        purpose: 'post_attachment',
        selections: [{
          image_index: 0,
          selected_card_id: selectedCard.id,
          condition: 'near_mint',
          variant: 'normal',
          quantity: 1,
          collection_entry_ids: [],
        }],
        skipped_indexes: [],
      });
      const data = response?.data ?? response;
      if (!data?.ok || Number(data.attached_count || 0) !== 1) {
        throw new Error(data?.error || 'SCAN_ATTACHMENT_FAILED');
      }

      onAttach?.(selectedCard);
      reset();
      onClose?.();
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
        requestError?.message ||
        t('scanner.postError'),
      );
      setStage('review');
    }
  };

  const candidates = result?.candidates || [];

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
        onClick={close}
        role="presentation"
      >
        <section
          className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-border bg-background p-4 sm:rounded-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="post-card-scanner-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="post-card-scanner-title" className="text-lg font-bold">
                {t('scanner.postTitle')}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('scanner.postBody')}
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              disabled={stage === 'analysing' || stage === 'attaching'}
              className="rounded-full p-2 hover:bg-secondary disabled:opacity-50"
              aria-label={t('scanner.close')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>{t('scanner.postReady')}</p>
          </div>

          {error && (
            <p className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          {!preview ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => uploadRef.current?.click()}
                className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-card p-4 hover:border-primary"
              >
                <ImagePlus className="h-7 w-7 text-primary" />
                <span className="font-semibold">{t('scanner.uploadPhoto')}</span>
              </button>
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-card p-4 hover:border-primary"
              >
                <Camera className="h-7 w-7 text-primary" />
                <span className="font-semibold">{t('scanner.takePhoto')}</span>
              </button>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-[180px_1fr]">
              <div className="aspect-[3/4] overflow-hidden rounded-xl border border-border bg-secondary">
                <img src={preview} alt={t('scanner.image')} className="h-full w-full object-contain" />
              </div>

              <div className="space-y-3">
                {stage === 'choose' && (
                  <>
                    <button
                      type="button"
                      onClick={analyse}
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
                    >
                      <Search className="h-4 w-4" />
                      {t('scanner.analyseBatch')}
                    </button>
                    <button
                      type="button"
                      onClick={() => uploadRef.current?.click()}
                      className="w-full rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-secondary"
                    >
                      {t('scanner.chooseAnotherPhoto')}
                    </button>
                  </>
                )}

                {(stage === 'analysing' || stage === 'attaching') && (
                  <div className="flex min-h-28 flex-col items-center justify-center gap-2 text-center">
                    <Loader2 className="h-7 w-7 animate-spin text-primary" />
                    <p className="text-sm font-semibold">
                      {stage === 'analysing'
                        ? t('scanner.analysing')
                        : t('scanner.attachingToPost')}
                    </p>
                  </div>
                )}

                {(stage === 'review' || stage === 'attaching') && selectedCard && (
                  <div className="rounded-xl border border-border bg-card p-3">
                    <div className="flex gap-3">
                      <div className="h-24 w-16 shrink-0 overflow-hidden rounded bg-secondary">
                        <CardImage card={selectedCard} alt={selectedCard.name} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold">{selectedCard.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {selectedCard.set?.name}
                          {selectedCard.local_id ? ` · ${selectedCard.local_id}` : ''}
                        </p>
                        {selectedCard.rarity && (
                          <p className="mt-1 text-xs text-primary">{selectedCard.rarity}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {stage === 'review' && (
            <div className="mt-4 space-y-3">
              {candidates.length > 1 && (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {t('scanner.suggestions')}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {candidates.slice(0, 3).map((candidate) => {
                      const card = candidateCard(candidate);
                      const selected = card?.id === selectedCard?.id;
                      return (
                        <button
                          key={candidate.card_id}
                          type="button"
                          onClick={() => setSelectedCard(card)}
                          className={`rounded-xl border p-2 text-left ${selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                        >
                          <p className="line-clamp-2 text-xs font-bold">{card?.name}</p>
                          <p className="mt-1 truncate text-[10px] text-muted-foreground">
                            {card?.set?.name} {card?.local_id ? `· ${card.local_id}` : ''}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                <button
                  type="button"
                  onClick={() => setManualOpen(true)}
                  className="flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary"
                >
                  <Search className="h-4 w-4" />
                  {t('scanner.findAnother')}
                </button>
                <button
                  type="button"
                  onClick={attach}
                  disabled={!selectedCard?.id}
                  className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {t('scanner.useInPost')}
                </button>
              </div>
            </div>
          )}

          <input
            ref={uploadRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              chooseFile(event.target.files);
              event.target.value = '';
            }}
            aria-label={t('scanner.uploadPhoto')}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              chooseFile(event.target.files);
              event.target.value = '';
            }}
            aria-label={t('scanner.takePhoto')}
          />
        </section>
      </div>

      <CardSearchModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onSelect={(card) => {
          setSelectedCard(normaliseCard(card));
          setManualOpen(false);
        }}
        title={t('scanner.manualSearchTitle')}
      />
    </>
  );
}
