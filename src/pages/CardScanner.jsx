import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import DocumentationLink from '@/components/DocumentationLink';
import CardImage from '@/components/cards/CardImage';
import CardSearchModal from '@/components/cards/CardSearchModal';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';
import { useT } from '@/lib/i18n/I18nProvider';
import useSEO from '@/hooks/useSEO';

const MAX_FILES = 10;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_BATCH_BYTES = 50 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const CONDITIONS = ['mint', 'near_mint', 'excellent', 'good', 'damaged'];
const VARIANTS = ['normal', 'holo', 'reverse_holo'];

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

function confidenceLabel(value) {
  const percent = Math.round(Number(value || 0) * 100);
  return `${percent}%`;
}

function conditionLabel(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function variantLabel(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function CardScanner() {
  const t = useT();
  useSEO({
    title: t('scanner.title'),
    description: t('scanner.seoDescription'),
    canonicalPath: '/scan',
  });

  const inputRef = useRef(null);
  const filesRef = useRef([]);
  const createdByIndex = useRef({});
  const [files, setFiles] = useState([]);
  const [stage, setStage] = useState('select');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);
  const [reviewItems, setReviewItems] = useState([]);
  const [manualIndex, setManualIndex] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);

  const totalBytes = useMemo(
    () => files.reduce((sum, item) => sum + Number(item.file.size || 0), 0),
    [files],
  );
  const hasCreatedEntries = Object.values(createdByIndex.current)
    .some((ids) => Array.isArray(ids) && ids.length > 0);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => () => {
    filesRef.current.forEach((item) => URL.revokeObjectURL(item.preview));
  }, []);

  const addFiles = (incoming) => {
    setError('');
    const chosen = Array.from(incoming || []);
    if (chosen.length === 0) return;

    const invalidType = chosen.find((file) => !ALLOWED_TYPES.has(file.type));
    if (invalidType) {
      setError(t('scanner.errorType'));
      return;
    }
    const oversized = chosen.find((file) => file.size > MAX_FILE_BYTES);
    if (oversized) {
      setError(t('scanner.errorFileSize'));
      return;
    }

    const existingKeys = new Set(
      files.map((item) => `${item.file.name}:${item.file.size}:${item.file.lastModified}`),
    );
    const additions = chosen
      .filter((file) => {
        const key = `${file.name}:${file.size}:${file.lastModified}`;
        if (existingKeys.has(key)) return false;
        existingKeys.add(key);
        return true;
      })
      .map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        key: `${file.name}:${file.size}:${file.lastModified}`,
      }));

    if (files.length + additions.length > MAX_FILES) {
      additions.forEach((item) => URL.revokeObjectURL(item.preview));
      setError(t('scanner.errorCount'));
      return;
    }
    if (
      files.reduce((sum, item) => sum + item.file.size, 0) +
      additions.reduce((sum, item) => sum + item.file.size, 0) >
      MAX_BATCH_BYTES
    ) {
      additions.forEach((item) => URL.revokeObjectURL(item.preview));
      setError(t('scanner.errorBatchSize'));
      return;
    }

    setFiles((current) => [...current, ...additions]);
  };

  const removeFile = (key) => {
    if (stage !== 'select') return;
    setFiles((current) => {
      const removed = current.find((item) => item.key === key);
      if (removed) URL.revokeObjectURL(removed.preview);
      return current.filter((item) => item.key !== key);
    });
  };

  const reset = () => {
    if (hasCreatedEntries) return;
    files.forEach((item) => URL.revokeObjectURL(item.preview));
    createdByIndex.current = {};
    setFiles([]);
    setStage('select');
    setProgress('');
    setError('');
    setSession(null);
    setReviewItems([]);
    setManualIndex(null);
    setCompletedCount(0);
  };

  const startAnalysis = async () => {
    if (files.length < 1 || files.length > MAX_FILES || stage !== 'select') return;
    if (!navigator.onLine) {
      setError(t('scanner.errorOnline'));
      return;
    }

    setError('');
    setStage('uploading');

    try {
      const { did } = await ensureUserDid();
      const fileUris = [];

      for (let index = 0; index < files.length; index += 1) {
        setProgress(
          `${t('scanner.uploading')} ${index + 1}/${files.length}`,
        );
        const uploaded = await base44.integrations.Core.UploadPrivateFile({
          file: files[index].file,
        });
        const fileUri = uploaded?.file_uri;
        if (!fileUri) throw new Error('PRIVATE_UPLOAD_FAILED');
        fileUris.push(fileUri);
      }

      setProgress(t('scanner.analysing'));
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const record = await base44.entities.CardScanSession.create({
        did,
        status: 'uploaded',
        image_count: files.length,
        file_uris: fileUris,
        file_names: files.map((item) => item.file.name.slice(0, 180)),
        total_bytes: totalBytes,
        locale: navigator.language || 'en-GB',
        model_version: 'llm-vision-v2',
        expires_at: expiresAt,
      });

      const response = await base44.functions.invoke('scan-card-batch', {
        session_id: record.id,
      });
      const data = response?.data ?? response;
      if (!data?.ok || !data?.session?.results) {
        throw new Error(data?.error || 'CARD_SCAN_FAILED');
      }

      const items = data.session.results.map((result) => {
        const selectedCard = candidateCard(result.candidates?.[0]);
        return {
          ...result,
          include: Boolean(selectedCard),
          selectedCard,
          condition: CONDITIONS.includes(result.suggested_condition)
            ? result.suggested_condition
            : 'near_mint',
          variant: VARIANTS.includes(result.suggested_variant)
            ? result.suggested_variant
            : 'normal',
          quantity: 1,
        };
      });

      setSession(data.session);
      setReviewItems(items);
      setStage('review');
      setProgress('');
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
        requestError?.message ||
        t('scanner.errorAnalysis'),
      );
      setStage('select');
      setProgress('');
    }
  };

  const updateItem = (imageIndex, patch) => {
    if (hasCreatedEntries) return;
    setReviewItems((current) => current.map((item) =>
      item.image_index === imageIndex ? { ...item, ...patch } : item
    ));
  };

  const selectManualCard = (card) => {
    if (manualIndex === null) return;
    updateItem(manualIndex, {
      selectedCard: normaliseCard(card),
      include: true,
      needs_review: false,
    });
  };

  const confirmBatch = async () => {
    if (stage !== 'review') return;
    if (!navigator.onLine) {
      setError(t('scanner.errorOnline'));
      return;
    }

    const included = reviewItems.filter((item) => item.include);
    if (
      included.length === 0 ||
      included.some((item) => !item.selectedCard?.id)
    ) {
      setError(t('scanner.errorReview'));
      return;
    }

    setError('');
    setStage('saving');

    try {
      const { did, signingKey } = await ensureUserDid();
      const selections = [];

      for (let position = 0; position < included.length; position += 1) {
        const item = included[position];
        const card = item.selectedCard;
        const targetQuantity = Math.max(
          1,
          Math.min(20, Number(item.quantity || 1)),
        );
        const existingIds = Array.isArray(createdByIndex.current[item.image_index])
          ? [...createdByIndex.current[item.image_index]]
          : [];

        setProgress(
          `${t('scanner.adding')} ${position + 1}/${included.length}`,
        );

        while (existingIds.length < targetQuantity) {
          const stamped = await stampRecord({
            card_id: card.id,
            card_name: card.name,
            card_image: card.image,
            set_id: card.set?.id || '',
            set_name: card.set?.name || '',
            local_id: card.local_id || '',
            rarity: card.rarity || '',
            condition: item.condition,
            variant: item.variant,
            acquisition_date: new Date().toISOString().slice(0, 10),
            notes: 'Added after private batch scanner review.',
          }, NSID.COLLECTION_ENTRY, did, signingKey);

          // Scanner confirmation requires a live write. It is deliberately not
          // queued offline because the backend must verify each exact entry
          // before it records a quarantined correction label.
          const created = await base44.entities.CollectionEntry.create(stamped);
          if (!created?.id) throw new Error('COLLECTION_CREATE_FAILED');
          existingIds.push(created.id);
          createdByIndex.current[item.image_index] = [...existingIds];

          base44.functions.invoke('auto-attest-collection-card', {
            collection_entry_id: created.id,
            card_id: card.id,
            card_name: card.name,
          }).catch(() => {});
        }

        selections.push({
          image_index: item.image_index,
          selected_card_id: card.id,
          condition: item.condition,
          variant: item.variant,
          quantity: targetQuantity,
          collection_entry_ids: existingIds,
        });
      }

      setProgress(t('scanner.finalising'));
      const response = await base44.functions.invoke('complete-card-scan', {
        session_id: session.id,
        selections,
        skipped_indexes: reviewItems
          .filter((item) => !item.include)
          .map((item) => item.image_index),
      });
      const data = response?.data ?? response;
      if (!data?.ok) throw new Error(data?.error || 'SCAN_CONFIRMATION_FAILED');

      setCompletedCount(Number(data.added_count || 0));
      setStage('done');
      setProgress('');
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
        requestError?.message ||
        t('scanner.errorSave'),
      );
      setStage('review');
      setProgress('');
    }
  };

  const readyCount = reviewItems.filter(
    (item) => item.include && item.selectedCard?.id,
  ).length;

  return (
    <div>
      <PageHeader
        title={t('scanner.title')}
        subtitle={t('scanner.subtitle')}
      >
        <Link
          to="/collection"
          className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('nav.collection')}
        </Link>
      </PageHeader>

      <div className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            [ImagePlus, t('scanner.stepUpload'), '1'],
            [Search, t('scanner.stepReview'), '2'],
            [CheckCircle2, t('scanner.stepConfirm'), '3'],
          ].map(([Icon, label, number]) => (
            <div
              key={number}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {number}
              </span>
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">{label}</span>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            <strong>{t('scanner.privateTitle')}</strong>{' '}
            {t('scanner.privateBody')}
          </p>
        </div>

        {error && (
          <div
            className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {stage === 'select' && (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                addFiles(event.dataTransfer.files);
              }}
              className={`flex min-h-56 w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
                dragging
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:border-primary/60'
              }`}
            >
              <span className="rounded-full bg-primary/10 p-4">
                <UploadCloud className="h-8 w-8 text-primary" />
              </span>
              <div>
                <p className="font-bold">{t('scanner.dropTitle')}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('scanner.dropBody')}
                </p>
              </div>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = '';
              }}
              aria-label={t('scanner.chooseImages')}
            />

            {files.length > 0 && (
              <section className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-bold">
                      {t('scanner.selectedImages')} ({files.length}/{MAX_FILES})
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {(totalBytes / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="rounded-full border border-border px-3 py-1.5 text-sm font-semibold hover:bg-secondary"
                  >
                    {t('scanner.addMore')}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                  {files.map((item, index) => (
                    <div
                      key={item.key}
                      className="relative overflow-hidden rounded-xl border border-border bg-secondary"
                    >
                      <div className="aspect-[3/4]">
                        <img
                          src={item.preview}
                          alt={`${t('scanner.image')} ${index + 1}`}
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(item.key)}
                        className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1.5 text-white"
                        aria-label={t('scanner.removeImage')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <p className="truncate px-2 py-1.5 text-[11px]">
                        {index + 1}. {item.file.name}
                      </p>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={startAnalysis}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90"
                >
                  <Sparkles className="h-4 w-4" />
                  {t('scanner.analyseBatch')}
                </button>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  {t('scanner.consent')}
                </p>
              </section>
            )}
          </>
        )}

        {(stage === 'uploading' || stage === 'saving') && (
          <div className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card p-6 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div>
              <h2 className="text-lg font-bold">
                {stage === 'uploading'
                  ? t('scanner.workingTitle')
                  : t('scanner.savingTitle')}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{progress}</p>
            </div>
            <p className="max-w-lg text-xs text-muted-foreground">
              {t('scanner.keepOpen')}
            </p>
          </div>
        )}

        {stage === 'review' && (
          <>
            <div className="rounded-2xl border border-border bg-card p-4">
              <h2 className="font-bold">{t('scanner.reviewTitle')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('scanner.reviewBody')}
              </p>
            </div>

            <div className="space-y-4">
              {reviewItems.map((item) => {
                const card = item.selectedCard;
                const attention = item.needs_review || !card;
                return (
                  <article
                    key={item.image_index}
                    className={`rounded-2xl border bg-card p-4 ${
                      attention ? 'border-amber-500/50' : 'border-border'
                    }`}
                  >
                    <div className="grid gap-4 lg:grid-cols-[150px_1fr]">
                      <div>
                        <div className="aspect-[3/4] overflow-hidden rounded-xl border border-border bg-secondary">
                          <img
                            src={files[item.image_index]?.preview}
                            alt={`${t('scanner.image')} ${item.image_index + 1}`}
                            className="h-full w-full object-contain"
                          />
                        </div>
                        <p className="mt-2 text-center text-xs text-muted-foreground">
                          {t('scanner.image')} {item.image_index + 1}
                        </p>
                      </div>

                      <div className="min-w-0 space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold">
                                {card?.name || t('scanner.noMatch')}
                              </h3>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                  attention
                                    ? 'bg-amber-500/10 text-amber-600'
                                    : 'bg-success/10 text-success'
                                }`}
                              >
                                {attention
                                  ? t('scanner.needsReview')
                                  : t('scanner.likelyMatch')}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {t('scanner.visionConfidence')}: {confidenceLabel(item.confidence)}
                              {item.detected_language
                                ? ` · ${item.detected_language}`
                                : ''}
                            </p>
                          </div>
                          <label className="flex items-center gap-2 text-sm font-semibold">
                            <input
                              type="checkbox"
                              checked={item.include}
                              disabled={hasCreatedEntries}
                              onChange={(event) => updateItem(item.image_index, {
                                include: event.target.checked,
                              })}
                            />
                            {t('scanner.addThisCard')}
                          </label>
                        </div>

                        {item.candidates?.length > 0 && (
                          <div>
                            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                              {t('scanner.suggestions')}
                            </p>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                              {item.candidates.slice(0, 3).map((candidate) => {
                                const candidateValue = candidateCard(candidate);
                                const selected = candidateValue?.id === card?.id;
                                return (
                                  <button
                                    key={candidate.card_id}
                                    type="button"
                                    disabled={hasCreatedEntries}
                                    onClick={() => updateItem(item.image_index, {
                                      selectedCard: candidateValue,
                                      include: true,
                                    })}
                                    className={`overflow-hidden rounded-xl border p-2 text-left transition-colors ${
                                      selected
                                        ? 'border-primary bg-primary/5'
                                        : 'border-border hover:border-primary/50'
                                    }`}
                                  >
                                    <div className="flex gap-2">
                                      <div className="h-20 w-14 shrink-0 overflow-hidden rounded bg-secondary">
                                        <CardImage card={candidateValue} alt={candidateValue?.name} />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="line-clamp-2 text-xs font-bold">
                                          {candidate.name}
                                        </p>
                                        <p className="mt-1 truncate text-[10px] text-muted-foreground">
                                          {candidate.set_name} · {candidate.local_id}
                                        </p>
                                        <p className="mt-1 text-[10px] text-primary">
                                          {Math.round(Number(candidate.score || 0) * 100)}%
                                        </p>
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <button
                          type="button"
                          disabled={hasCreatedEntries}
                          onClick={() => setManualIndex(item.image_index)}
                          className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
                        >
                          <Search className="h-4 w-4" />
                          {t('scanner.findAnother')}
                        </button>

                        {item.include && card && (
                          <div className="grid gap-3 rounded-xl bg-secondary p-3 sm:grid-cols-3">
                            <label className="text-xs font-semibold">
                              {t('scanner.condition')}
                              <select
                                value={item.condition}
                                disabled={hasCreatedEntries}
                                onChange={(event) => updateItem(item.image_index, {
                                  condition: event.target.value,
                                })}
                                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
                              >
                                {CONDITIONS.map((value) => (
                                  <option key={value} value={value}>
                                    {conditionLabel(value)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="text-xs font-semibold">
                              {t('scanner.variant')}
                              <select
                                value={item.variant}
                                disabled={hasCreatedEntries}
                                onChange={(event) => updateItem(item.image_index, {
                                  variant: event.target.value,
                                })}
                                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
                              >
                                {VARIANTS.map((value) => (
                                  <option key={value} value={value}>
                                    {variantLabel(value)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="text-xs font-semibold">
                              {t('scanner.quantity')}
                              <input
                                type="number"
                                min="1"
                                max="20"
                                value={item.quantity}
                                disabled={hasCreatedEntries}
                                onChange={(event) => updateItem(item.image_index, {
                                  quantity: Math.max(
                                    1,
                                    Math.min(20, Number(event.target.value || 1)),
                                  ),
                                })}
                                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
                              />
                            </label>
                          </div>
                        )}

                        {item.notes && (
                          <p className="text-xs text-muted-foreground">
                            {item.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {hasCreatedEntries && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p>{t('scanner.retryLocked')}</p>
              </div>
            )}

            <div className="sticky bottom-16 z-20 rounded-2xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur md:bottom-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <p className="text-sm text-muted-foreground">
                  {readyCount} {t('scanner.readyToAdd')}
                </p>
                <div className="flex gap-2">
                  {!hasCreatedEntries && (
                    <button
                      type="button"
                      onClick={reset}
                      className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary"
                    >
                      {t('scanner.startOver')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={confirmBatch}
                    disabled={readyCount === 0}
                    className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
                  >
                    {hasCreatedEntries
                      ? <RefreshCw className="h-4 w-4" />
                      : <Check className="h-4 w-4" />}
                    {hasCreatedEntries
                      ? t('scanner.retryFinalise')
                      : t('scanner.confirmBatch')}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {stage === 'done' && (
          <div className="flex min-h-80 flex-col items-center justify-center gap-4 rounded-2xl border border-success/30 bg-success/5 p-6 text-center">
            <span className="rounded-full bg-success/10 p-4">
              <CheckCircle2 className="h-10 w-10 text-success" />
            </span>
            <div>
              <h2 className="text-xl font-bold">{t('scanner.completeTitle')}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {completedCount} {t('scanner.completeBody')}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Link
                to="/collection"
                className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
              >
                {t('scanner.viewCollection')}
              </Link>
              <button
                type="button"
                onClick={reset}
                className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-secondary"
              >
                {t('scanner.scanMore')}
              </button>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
          <Camera className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {t('scanner.advisory')}{' '}
            <Link to="/collector-copilot" className="font-semibold text-primary hover:underline">
              {t('nav.collectorCopilot')}
            </Link>
          </p>
        </div>
      </div>

      <CardSearchModal
        open={manualIndex !== null}
        onClose={() => setManualIndex(null)}
        onSelect={selectManualCard}
        title={t('scanner.manualSearchTitle')}
      />

      <DocumentationLink slug="card-scanner" />
    </div>
  );
}
