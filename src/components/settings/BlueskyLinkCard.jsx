import React, { useState } from 'react';
import { Link2, CheckCircle2, Loader2, RefreshCw, Plane, Undo2, Globe, Lock, DownloadCloud, Bell, FileText } from 'lucide-react';
import AtProtoForm from '@/components/auth/AtProtoForm';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useT } from '@/lib/i18n/I18nProvider';

// BlueskyLinkCard — the primary AT Protocol onboarding surface in Settings.
// If the user has linked a Bluesky account (bsky_handle is set), shows their
// linked identity. If not, shows the AtProtoForm so they can link one.
//
// On successful link, the migration flow runs:
//   1. re-bridge-content moves existing shared-bridge posts to the user's DID.
//   2. migrate-to-swappulse pulls the Bluesky profile (displayName, description,
//      avatar) INTO SwapPulse, triggers the all-time post backfill (first
//      batch), imports the notification snapshot, updates the handle to
//      username.swappulse.org, and posts+pins a 'I've moved' announcement on
//      Bluesky. The Bluesky bio is NOT overwritten — it stays as the two-way
//      synced source of truth.
//   3. The post backfill loops (backfill-author-posts) until hasMore is false
//      so the user's full Bluesky post history renders on SwapPulse.
//
// When migrated, shows a sync status card (profile, posts, notifications) and
// a 'Move back to Bluesky' button. When migration_reverted (un-moved), shows a
// locked notice — profile editing is disabled and the profile reverts to the
// original Bluesky profile.
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

  const linked = !!user?.bsky_handle;
  const migrated = !!user?.migrated_from_bluesky;
  const reverted = !!user?.migration_reverted;
  const backfillComplete = !!user?.post_backfill_complete;
  const notificationsImported = !!user?.notifications_imported_at;

  const defaultHandle = user?.username || user?.email?.split('@')[0] || 'collector';

  // Loop backfill-author-posts until hasMore is false so the user's full
  // Bluesky post history is synced into SwapPulse. Each call is one page
  // (100 records); large histories need multiple calls within timeout.
  const runBackfillLoop = async () => {
    setBackfilling(true);
    setBackfillCount(0);
    let total = 0;
    try {
      let hasMore = true;
      let safety = 0; // cap at 50 pages (5000 posts) to avoid runaway loops
      while (hasMore && safety < 50) {
        const res = await base44.functions.invoke('backfill-author-posts', {});
        const result = res?.data ?? res;
        total += (result?.backfilled || 0) + (result?.updated || 0);
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
    // handle, post + pin announcement.
    setMigrating(true);
    try {
      const res = await base44.functions.invoke('migrate-to-swappulse', {
        customDomain: customDomain || undefined,
      });
      const result = res?.data ?? res;
      if (result?.ok || result?.alreadyMigrated) {
        await checkUserAuth?.();
        toast({
          title: t('migration.announceTitle'),
          description: result?.handleUpdated
            ? t('migration.handleUpdatedDesc', { handle: result.handle })
            : t('migration.announceDesc'),
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

    // Loop the post backfill to completion (migrate-to-swappulse ran the
    // first batch; this continues until hasMore is false).
    await runBackfillLoop();
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
        toast({
          title: t('migration.unmovedTitle'),
          description: t('migration.unmovedDesc'),
        });
      }
    } catch (e) {
      console.error('Un-move failed', e);
      toast({
        title: t('migration.unmoveFailedTitle'),
        description: t('migration.unmoveFailedDesc'),
        variant: 'destructive',
      });
    } finally {
      setUnmoving(false);
    }
  };

  const handleRemigrate = async () => {
    if (migrating) return;
    setMigrating(true);
    try {
      const res = await base44.functions.invoke('migrate-to-swappulse', {
        customDomain: customDomain || undefined,
      });
      const result = res?.data ?? res;
      if (result?.ok || result?.alreadyMigrated) {
        await checkUserAuth?.();
        toast({
          title: t('migration.announceTitle'),
          description: t('migration.announceDesc'),
        });
      }
    } catch (e) {
      console.error('Re-migration failed', e);
      toast({
        title: t('migration.announceFailedTitle'),
        description: t('migration.announceFailedDesc'),
        variant: 'destructive',
      });
    } finally {
      setMigrating(false);
    }
    await runBackfillLoop();
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

        {migrated && (
          <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-primary">
              <Plane className="h-3.5 w-3.5" /> {t('migration.statusMigrated')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('migration.statusMigratedDesc')}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {t('migration.handleLabel')}: <b className="text-foreground">@{user.bsky_handle}</b>
            </p>

            {/* Sync status checklist */}
            <div className="mt-2.5 space-y-1.5">
              <p className="flex items-center gap-1.5 text-xs text-success">
                <CheckCircle2 className="h-3 w-3" /> {t('migration.profilePulled')}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-success">
                <CheckCircle2 className="h-3 w-3" /> {t('migration.notificationsImported')}
              </p>
              <p className={`flex items-center gap-1.5 text-xs ${backfillComplete ? 'text-success' : 'text-muted-foreground'}`}>
                {backfillComplete ? <CheckCircle2 className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                {backfilling
                  ? t('migration.syncingPosts', { count: backfillCount })
                  : backfillComplete
                    ? t('migration.postsBackfilled')
                    : t('migration.continueSync')}
              </p>
            </div>

            {/* Continue sync button if backfill is incomplete */}
            {!backfillComplete && !backfilling && (
              <button
                onClick={runBackfillLoop}
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

        {reverted && !migrated && (
          <div className="mt-3 rounded-lg border border-warning/30 bg-warning/5 p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-warning">
              <Lock className="h-3.5 w-3.5" /> {t('migration.revertedTitle')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('migration.revertedDesc')}
            </p>
            <button
              onClick={handleRemigrate}
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

      {/* Handle preview — shows the default username.swappulse.org handle */}
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