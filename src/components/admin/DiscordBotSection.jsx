import React, { useEffect, useState } from 'react';
import { Bot, CheckCircle2, Loader2, Play, RefreshCw, ShieldAlert } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';

const CONFIRMATION = 'CREATE_SWAPPULSE_DISCORD_STRUCTURE';
const BotInput = /** @type {any} */ (Input);

function unwrap(response) {
  return response?.data || response;
}

export default function DiscordBotSection() {
  const [config, setConfig] = useState(null);
  const [preview, setPreview] = useState(null);
  const [confirmation, setConfirmation] = useState('');
  const [working, setWorking] = useState('');
  const { toast } = useToast();

  const load = async () => {
    const rows = await base44.entities.DiscordGuildConfig.list('-created_date', 1).catch(() => []);
    setConfig(rows?.[0] || null);
  };

  useEffect(() => {
    load();
  }, []);

  const runPreview = async () => {
    setWorking('preview');
    try {
      const result = unwrap(await base44.functions.invoke('discord-bootstrap', { apply: false }));
      setPreview(result);
    } catch (error) {
      toast({ title: 'Discord preview failed', description: error?.message || 'Check the backend configuration.', variant: 'destructive' });
    } finally {
      setWorking('');
    }
  };

  const apply = async () => {
    setWorking('apply');
    try {
      const result = unwrap(await base44.functions.invoke('discord-bootstrap', {
        apply: true,
        confirmation,
      }));
      if (!result?.ok) throw new Error(result?.error || 'Discord setup failed.');
      toast({ title: 'SwapPulse Bot configured', description: 'Roles, private forums and commands are now registered.' });
      setConfirmation('');
      await load();
    } catch (error) {
      toast({ title: 'Discord setup failed', description: error?.message || 'No safe change was confirmed.', variant: 'destructive' });
    } finally {
      setWorking('');
    }
  };

  const sync = async () => {
    setWorking('sync');
    try {
      const result = unwrap(await base44.functions.invoke('discord-sync-all', {}));
      toast({ title: 'Discord sync complete', description: `${result?.synced || 0} linked members updated, ${result?.failed || 0} failed.` });
      await load();
    } catch (error) {
      toast({ title: 'Discord sync failed', description: error?.message || 'Check the bot configuration.', variant: 'destructive' });
    } finally {
      setWorking('');
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="rounded-lg bg-[#5865F2]/15 p-2 text-[#5865F2]"><Bot className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold">SwapPulse Bot</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage Discord verification, support forums and roles derived from SwapPulse reputation and staff status.
          </p>
        </div>
        {config?.enabled ? (
          <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-xs font-semibold text-success">
            <CheckCircle2 className="h-3.5 w-3.5" /> Enabled
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-full bg-warning/10 px-2 py-1 text-xs font-semibold text-warning">
            <ShieldAlert className="h-3.5 w-3.5" /> Not enabled
          </span>
        )}
      </div>

      {config && (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Guild</dt><dd className="font-mono text-xs">{config.guild_id}</dd></div>
          <div><dt className="text-muted-foreground">Last role sync</dt><dd>{config.last_sync_at ? new Date(config.last_sync_at).toLocaleString() : 'Not run'}</dd></div>
          <div><dt className="text-muted-foreground">Managed roles</dt><dd>{Object.keys(config.role_ids || {}).length}</dd></div>
          <div><dt className="text-muted-foreground">Managed channels</dt><dd>{Object.keys(config.channel_ids || {}).length}</dd></div>
        </dl>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="outline" onClick={runPreview} disabled={!!working}>
          {working === 'preview' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
          Preview setup
        </Button>
        {config?.enabled && (
          <Button variant="outline" onClick={sync} disabled={!!working}>
            {working === 'sync' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Sync roles now
          </Button>
        )}
      </div>

      {preview?.portal && !config?.enabled && (
        <div className="mt-5 rounded-lg border border-border bg-muted/30 p-4">
          <p className="font-semibold">Discord Developer Portal prerequisites</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The bootstrap checks these values before it creates any role or channel.
          </p>
          <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Application</dt><dd className="break-all font-mono">{preview.portal.application_id}</dd></div>
            <div><dt className="text-muted-foreground">Install permissions</dt><dd className="font-mono">{preview.portal.install_permissions}</dd></div>
            <div className="sm:col-span-2"><dt className="text-muted-foreground">Interaction endpoint</dt><dd className="break-all font-mono">{preview.portal.interactions_endpoint_url}</dd></div>
            <div className="sm:col-span-2"><dt className="text-muted-foreground">OAuth redirect</dt><dd className="break-all font-mono">{preview.portal.oauth_redirect_uri}</dd></div>
            <div><dt className="text-muted-foreground">Installation</dt><dd>Guild on, User off</dd></div>
            <div><dt className="text-muted-foreground">Gateway intents</dt><dd>All off</dd></div>
          </dl>
          {preview.portal.install_url && (
            <a
              className="mt-3 inline-flex text-sm font-semibold text-primary hover:underline"
              href={preview.portal.install_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Install or re-authorise SwapPulse Bot
            </a>
          )}
        </div>
      )}

      {preview && !config?.enabled && (
        <div className="mt-5 rounded-lg border border-warning/30 bg-warning/5 p-4">
          <p className="font-semibold">External Discord changes require confirmation</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This configures the application metadata, then creates the listed roles and five support channels. Existing channels are not changed. Enter the exact confirmation below only after completing the portal prerequisites and checking the preview.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(preview.roles || []).map((role) => <span key={role} className="rounded-full bg-secondary px-2 py-1 text-xs">{role}</span>)}
          </div>
          <BotInput
            className="mt-4 font-mono"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={CONFIRMATION}
          />
          <Button
            className="mt-3"
            onClick={apply}
            disabled={working === 'apply' || confirmation !== CONFIRMATION}
          >
            {working === 'apply' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create the reviewed Discord structure
          </Button>
        </div>
      )}
    </section>
  );
}
