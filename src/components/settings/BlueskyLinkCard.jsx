import React, { useState } from 'react';
import { Link2, CheckCircle2, Loader2, RefreshCw, Plane, Undo2 } from 'lucide-react';
import AtProtoForm from '@/components/auth/AtProtoForm';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useT } from '@/lib/i18n/I18nProvider';

// BlueskyLinkCard — the primary AT Protocol onboarding surface in Settings.
// If the user has linked a Bluesky account (bsky_handle is set), shows their
// linked identity. If not, shows the AtProtoForm so they can link one.
// On successful link, refreshes the user context, fires re-bridge-content to
// migrate existing shared-bridge posts to their own DID, and automatically
// triggers migrate-to-swappulse to post and pin a 'I've moved' announcement on
// Bluesky and replace the Bluesky bio with a SwapPulse pointer. When migrated,
// shows a 'Move back to Bluesky' button to reverse the migration.
export default function BlueskyLinkCard() {
  const t = useT();
  const { user, checkUserAuth } = useAuth();
  const { toast } = useToast();
  const [rebridging, setRebridging] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [unmoving, setUnmoving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const linked = !!user?.bsky_handle;
  const migrated = !!user?.migrated_from_bluesky;

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

    // Auto-migrate: post announcement, pin it, replace Bluesky bio
    setMigrating(true);
    try {
      const res = await base44.functions.invoke('migrate-to-swappulse', {});
      const result = res?.data ?? res;
      if (result?.ok || result?.alreadyMigrated) {
        await checkUserAuth?.();
        toast({
          title: t('migration.announceTitle'),
          description: t('migration.announceDesc'),
        });
      }
    } catch (e) {
      // non-fatal — migration is best-effort; linking still succeeded
      console.error('Auto-migration failed', e);
      toast({
        title: t('migration.announceFailedTitle'),
        description: t('migration.announceFailedDesc'),
        variant: 'destructive',
      });
    } finally {
      setMigrating(false);
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
            <button
              onClick={handleUnmove}
              disabled={unmoving}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-secondary py-2.5 text-sm font-bold text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
            >
              {unmoving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
              {t('migration.moveBack')}
            </button>
          </div>
        )}

        <button
          onClick={() => setShowForm(true)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-secondary py-2.5 text-sm font-bold text-secondary-foreground transition-colors hover:bg-secondary/80"
        >
          <RefreshCw className="h-4 w-4" /> {t('migration.relink')}
        </button>

        {(rebridging || migrating) && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            {migrating ? t('migration.migratingStatus') : t('migration.rebridgingStatus')}
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
      <p className="mt-1 text-xs text-muted-foreground">
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
      {(rebridging || migrating) && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          {migrating ? t('migration.migratingStatus') : t('migration.rebridgingStatus')}
        </p>
      )}
    </div>
  );
}