import React, { useState } from 'react';
import { Link2, CheckCircle2, Loader2, RefreshCw, Plane, Undo2, Globe, Lock, DownloadCloud, FileText, XCircle, AlertCircle, Server, User, Bell, Megaphone, Heart, Repeat2, List, Users } from 'lucide-react';
import AtProtoForm from '@/components/auth/AtProtoForm';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useT } from '@/lib/i18n/I18nProvider';

// BlueskyLinkCard — the primary AT Protocol onboarding surface in Settings.
// Shows the user's consolidated identity (did:plc, handle, PDS connection) and
// a per-step migration dashboard with success/failure status, error details,
// and retry controls — no more silent failures or manual 'continue sync'
// guessing.
//
// Migration steps tracked on User.migration_steps:
//   profile_pull, post_backfill, notification_import, handle_update, announcement
// Each step has { status: pending|running|success|failed, error, completed_at }.

const STEP_META = {
  profile_pull: { icon: User, label: 'Profile sync' },
  post_backfill: { icon: FileText, label: 'Post history' },
  likes_backfill: { icon: Heart, label: 'Likes history' },
  reposts_backfill: { icon: Repeat2, label: 'Reposts history' },
  notification_import: { icon: Bell, label: 'Notifications' },
  lists_backfill: { icon: List, label: 'Lists & starter packs' },
  graph_import: { icon: Users, label: 'Social graph' },
  handle_update: { icon: Globe, label: 'Handle update' },
  announcement: { icon: Megaphone, label: 'Announcement' },
};

function StepRow({ stepKey, step, onRetry, retrying }) {
  const meta = STEP_META[stepKey];
  if (!meta) return null;
  const Icon = meta.icon;
  const status = step?.status || 'pending';

  return (
    <div className="flex items-start gap-2 py-1">
      <div className="mt-0.5 shrink-0">
        {status === 'success' ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
        ) : status === 'failed' ? (
          <XCircle className="h-3.5 w-3.5 text-destructive" />
        ) : status === 'running' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        ) : (
          <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">{meta.label}</span>
        </div>
        {status === 'failed' && step?.error && (
          <p className="mt-0.5 text-[11px] text-destructive/80 break-words">{step.error}</p>
        )}
        {status === 'failed' && onRetry && (
          <button
            onClick={onRetry}
            disabled={retrying}
            className="mt-1 inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
          >
            {retrying ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <RefreshCw className="h-2.5 w-2.5" />}
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

export default function BlueskyLinkCard() {
  const t = useT();
  const { user, checkUserAuth } = useAuth();
  const { toast } = useToast();
  const [rebridging, setRebridging] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillCount, setBackfillCount] = useState(0);
  const [unmoving, setUnmoving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showDomainInput, setShowDomainInput] = useState(false);
  const [customDomain, setCustomDomain] = useState('');
  const [retryingStep, setRetryingStep] = useState('');

  const linked = !!user?.bsky_handle;
  const migrated = !!user?.migrated_from_bluesky;
  const reverted = !!user?.migration_reverted;
  const backfillComplete = !!(
    user?.post_backfill_complete &&
    user?.likes_backfill_complete &&
    user?.reposts_backfill_complete &&
    user?.notifications_backfill_complete &&
    user?.lists_backfill_complete
  );
  const steps = user?.migration_steps || {};
  const hasFailedSteps = Object.values(steps).some((s) => s?.status === 'failed');

  const defaultHandle = user?.username || user?.email?.split('@')[0] || 'collector';

  // Loop a backfill function until hasMore is false so the user's full
  // history for that collection is synced into SwapPulse. Used for posts,
  // likes, reposts, and lists.
  const runBackfillLoop = async (fnName = 'backfill-author-posts') => {
    setBackfilling(true);
    setBackfillCount(0);
    let total = 0;
    try {
      let hasMore = true;
      let safety = 0;
      while (hasMore && safety < 50) {
        const res = await base44.functions.invoke(fnName, {});
        const result = res?.data ?? res;
        total += (result?.backfilled || 0) + (result?.updated || 0) + (result?.processed || 0) + (result?.imported || 0);
        setBackfillCount(total);
        hasMore = !!result?.hasMore;
        safety++;
        if (!result?.ok) break;
      }
      await checkUserAuth?.();
    } catch (e) {
      console.error('Backfill loop failed', e);
    } finally {
      setBackfilling(false);
    }
  };

  // Loop all incomplete backfills to completion (posts, likes, reposts,
  // notifications, lists) — used by the "Sync all" button.
  const runAllBackfills = async () => {
    const fns = [
      'backfill-author-posts',
      'backfill-likes',
      'backfill-reposts',
      'import-notification-snapshot',
      'backfill-lists',
    ];
    for (const fn of fns) {
      await runBackfillLoop(fn);
    }
  };

  const handleLinked = async (data) => {
    toast({
      title: t('migration.linkedTitle'),
      description: t('migration.linkedDesc', { handle: data.handle }),
    });
    setShowForm(false);
    await checkUserAuth?.();

    // Fire-and-forget re-bridge of existing content to the new DID
    setRebridging(true);
    try {
      await base44.functions.invoke('re-bridge-content', {});
      toast({
        title: t('migration.contentMigratedTitle'),
        description: t('migration.contentMigratedDesc'),
      });
    } catch {
      // non-fatal — re-bridge is best-effort
    } finally {
      setRebridging(false);
    }

    // Auto-migrate: pull profile, trigger backfill + notifications, update
    // handle, post + pin announcement (gated on critical step success).
    setMigrating(true);
    try {
      const res = await base44.functions.invoke('migrate-to-swappulse', {
        customDomain: customDomain || undefined,
      });
      const result = res?.data ?? res;
      await checkUserAuth?.();
      if (result?.ok && result?.migrated) {
        toast({
          title: t('migration.announceTitle'),
          description: result?.handleUpdated
            ? t('migration.handleUpdatedDesc', { handle: result.handle })
            : t('migration.announceDesc'),
        });
      } else if (result?.incomplete) {
        // Critical steps failed — announcement was skipped
        toast({
          title: 'Migration incomplete',
          description: 'Some steps failed. Check the dashboard below and retry.',
          variant: 'destructive',
        });
      }
    } catch (e) {
      console.error('Auto-migration failed', e);
      toast({
        title: t('migration.announceFailedTitle'),
        description: t('migration.announceFailedDesc'),
        variant: 'destructive',
      });
    } finally {
      setMigrating(false);
    }

    // Loop all backfills (posts, likes, reposts, notifications, lists) to
    // completion so the user's full history is synced immediately.
    await runAllBackfills();
  };

  // Retry the full migration (re-runs all failed steps).
  const handleRetryMigration = async () => {
    if (migrating) return;
    setMigrating(true);
    try {
      const res = await base44.functions.invoke('migrate-to-swappulse', {
        customDomain: customDomain || undefined,
      });
      const result = res?.data ?? res;
      await checkUserAuth?.();
      if (result?.ok && result?.migrated) {
        toast({ title: t('migration.announceTitle'), description: t('migration.announceDesc') });
      } else if (result?.incomplete) {
        toast({
          title: 'Still incomplete',
          description: 'Some steps are still failing. Check the errors below.',
          variant: 'destructive',
        });
      }
    } catch (e) {
      console.error('Retry migration failed', e);
      toast({
        title: t('migration.announceFailedTitle'),
        description: t('migration.announceFailedDesc'),
        variant: 'destructive',
      });
    } finally {
      setMigrating(false);
    }
    await runAllBackfills();
  };

  // Retry a single step.
  const handleRetryStep = async (stepKey) => {
    setRetryingStep(stepKey);
    try {
      if (stepKey === 'post_backfill') {
        await runBackfillLoop('backfill-author-posts');
      } else if (stepKey === 'likes_backfill') {
        await runBackfillLoop('backfill-likes');
      } else if (stepKey === 'reposts_backfill') {
        await runBackfillLoop('backfill-reposts');
      } else if (stepKey === 'lists_backfill') {
        await runBackfillLoop('backfill-lists');
      } else if (stepKey === 'notification_import') {
        await runBackfillLoop('import-notification-snapshot');
        toast({ title: 'Notifications imported' });
      } else {
        // profile_pull, handle_update, announcement → re-run migrate
        await handleRetryMigration();
      }
    } catch (e) {
      console.error('Step retry failed', e);
      toast({ title: 'Retry failed', description: e?.message || '', variant: 'destructive' });
    } finally {
      setRetryingStep('');
    }
  };

  const handleUnmove = async () => {
    if (unmoving) return;
    if (!window.confirm(t('migration.unmoveConfirm'))) return;
    setUnmoving(true);
    try {
      const res = await base44.functions.invoke('unmove-from-bluesky', {});
      const result = res?.data ?? res;
      if (result?.ok || result?.notMigrated) {
        await checkUserAuth?.();
        toast({ title: t('migration.unmovedTitle'), description: t('migration.unmovedDesc') });
      }
    } catch (e) {
      console.error('Un-move failed', e);
      toast({ title: t('migration.unmoveFailedTitle'), description: t('migration.unmoveFailedDesc'), variant: 'destructive' });
    } finally {
      setUnmoving(false);
    }
  };

  if (linked && !showForm) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="flex items-center gap-2 text-sm font-bold">
          <CheckCircle2 className="h-4 w-4 text-success" /> {t('migration.linkedTitle')}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('migration.linkedFederating', { handle: user.bsky_handle })}
        </p>

        {/* Identity summary — one cohesive record */}
        <div className="mt-2.5 rounded-lg border border-border bg-secondary/30 p-2.5 space-y-1">
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Server className="h-3 w-3" /> DID
          </p>
          <p className="text-[11px] font-mono text-foreground break-all">{user.did || 'Not provisioned'}</p>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1.5">
            <Globe className="h-3 w-3" /> Handle
          </p>
          <p className="text-xs text-foreground">@{user.bsky_handle}</p>
        </div>

        {migrated && (
          <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-primary">
              <Plane className="h-3.5 w-3.5" /> {t('migration.statusMigrated')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('migration.statusMigratedDesc')}
            </p>

            {/* Per-step migration dashboard */}
            <div className="mt-2.5 rounded-md border border-border/60 bg-card/50 p-2">
              <p className="mb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Sync Status</p>
              {Object.entries(STEP_META).map(([key]) => (
                <StepRow
                  key={key}
                  stepKey={key}
                  step={steps[key]}
                  onRetry={steps[key]?.status === 'failed' ? () => handleRetryStep(key) : null}
                  retrying={retryingStep === key}
                />
              ))}
            </div>

            {/* Retry migration button if any step failed */}
            {hasFailedSteps && !migrating && (
              <button
                onClick={handleRetryMigration}
                disabled={migrating || backfilling}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Retry migration
              </button>
            )}

            {/* Continue all backfills if any are incomplete */}
            {!backfillComplete && !backfilling && (
              <button
                onClick={runAllBackfills}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-secondary py-2 text-xs font-bold text-secondary-foreground transition-colors hover:bg-secondary/80"
              >
                <DownloadCloud className="h-3.5 w-3.5" /> {t('migration.continueSync')}
              </button>
            )}

            <button
              onClick={handleUnmove}
              disabled={unmoving || backfilling}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-secondary py-2.5 text-sm font-bold text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
            >
              {unmoving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
              {t('migration.moveBack')}
            </button>
          </div>
        )}

        {/* Incomplete migration — not yet fully migrated but steps were attempted */}
        {!migrated && !reverted && hasFailedSteps && (
          <div className="mt-3 rounded-lg border border-warning/30 bg-warning/5 p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-warning">
              <AlertCircle className="h-3.5 w-3.5" /> Migration incomplete
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Some migration steps failed. Review the errors and retry.
            </p>
            <div className="mt-2.5 rounded-md border border-border/60 bg-card/50 p-2">
              {Object.entries(STEP_META).map(([key]) => (
                <StepRow
                  key={key}
                  stepKey={key}
                  step={steps[key]}
                  onRetry={steps[key]?.status === 'failed' ? () => handleRetryStep(key) : null}
                  retrying={retryingStep === key}
                />
              ))}
            </div>
            <button
              onClick={handleRetryMigration}
              disabled={migrating}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {migrating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Retry migration
            </button>
          </div>
        )}

        {reverted && !migrated && (
          <div className="mt-3 rounded-lg border border-warning/30 bg-warning/5 p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-warning">
              <Lock className="h-3.5 w-3.5" /> {t('migration.revertedTitle')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('migration.revertedDesc')}
            </p>
            <button
              onClick={handleRetryMigration}
              disabled={migrating}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {migrating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plane className="h-4 w-4" />}
              {t('migration.remigrate')}
            </button>
          </div>
        )}

        <button
          onClick={() => setShowForm(true)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-secondary py-2.5 text-sm font-bold text-secondary-foreground transition-colors hover:bg-secondary/80"
        >
          <RefreshCw className="h-4 w-4" /> {t('migration.relink')}
        </button>

        {(rebridging || migrating || backfilling) && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            {backfilling
              ? t('migration.syncingPosts', { count: backfillCount })
              : migrating
                ? t('migration.migratingStatus')
                : t('migration.rebridgingStatus')}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
      <p className="flex items-center gap-2 text-sm font-bold">
        <Link2 className="h-4 w-4 text-primary" /> {t('migration.linkTitle')}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {t('migration.linkDesc')}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {t('migration.linkAutoMigrate')}
      </p>

      {/* Handle preview */}
      <div className="mt-2 rounded-lg border border-border bg-card/50 p-2.5">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Globe className="h-3 w-3" /> {t('migration.handlePreview')}
        </p>
        <p className="mt-0.5 text-xs text-foreground">
          @{customDomain || `${defaultHandle}.swappulse.org`}
        </p>
        <button
          onClick={() => setShowDomainInput((v) => !v)}
          className="mt-1 text-[11px] font-semibold text-primary hover:underline"
        >
          {showDomainInput ? t('migration.useDefaultDomain') : t('migration.useCustomDomain')}
        </button>
        {showDomainInput && (
          <div className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-2.5 py-1.5">
            <span className="text-xs text-muted-foreground">@</span>
            <input
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder="yourbrand.com"
              className="flex-1 bg-transparent text-xs outline-none"
            />
          </div>
        )}
        {showDomainInput && customDomain && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t('migration.customDomainNote')}
          </p>
        )}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        {t('migration.noAccount')}{' '}
        <a
          href="https://bsky.app"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {t('migration.createAtBsky')}
        </a>
        {t('migration.thenComeBack')}
      </p>
      <div className="mt-3">
        <AtProtoForm mode="link" onSuccess={handleLinked} submitLabel={t('migration.linkButton')} />
      </div>
      {(rebridging || migrating || backfilling) && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          {backfilling
            ? t('migration.syncingPosts', { count: backfillCount })
            : migrating
              ? t('migration.migratingStatus')
              : t('migration.rebridgingStatus')}
        </p>
      )}
    </div>
  );
}