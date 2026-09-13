import React, { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { DiscordIcon } from '@/components/share/PlatformIcons';
import { useToast } from '@/components/ui/use-toast';

function unwrap(response) {
  return response?.data || response;
}

export default function DiscordSection() {
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [loadError, setLoadError] = useState('');
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      const links = await base44.entities.DiscordAccountLink
        .filter({ user_id: user.id }, '-created_date', 1);
      setLink(links?.[0] || null);
      setLoadError('');
    } catch {
      setLoadError('Discord connection status could not be loaded. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const url = new URL(window.location.href);
    const status = url.searchParams.get('discord');
    const reason = url.searchParams.get('reason');
    if (status) {
      url.searchParams.delete('discord');
      url.searchParams.delete('reason');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
    if (status === 'linked') {
      toast({
        title: 'Discord connected',
        description: reason === 'screening'
          ? 'Complete the server membership screening in Discord before accessing its channels.'
          : 'SwapPulse Bot has synchronised your current roles.',
      });
    } else if (status === 'pending') {
      toast({ title: 'Discord linked, roles pending', description: 'The link succeeded but role synchronisation needs a retry.' });
    } else if (status === 'failed') {
      toast({
        title: 'Discord connection was not completed',
        description: reason === 'oauth_scope_missing'
          ? 'Discord did not grant the required identity and server-join permissions.'
          : 'Please try again, or ask in the public Discord verification channel.',
        variant: 'destructive',
      });
    }
  }, []);

  const connect = async () => {
    setWorking(true);
    try {
      const response = unwrap(await base44.functions.invoke('discord-link-start', {}));
      if (!response?.authorize_url) throw new Error(response?.error || 'Discord linking is not ready.');
      window.location.assign(response.authorize_url);
    } catch (error) {
      toast({
        title: 'Discord linking is not ready',
        description: error?.message || 'Please try again later.',
        variant: 'destructive',
      });
      setWorking(false);
    }
  };

  const disconnect = async () => {
    setWorking(true);
    try {
      await base44.functions.invoke('discord-unlink', {});
      toast({ title: 'Discord disconnected', description: 'SwapPulse-managed roles were confirmed removed.' });
      await load();
    } catch (error) {
      toast({ title: 'Discord removal pending', description: error?.response?.data?.error || 'Discord access could not be confirmed removed. Please retry or contact support.', variant: 'destructive' });
      await load();
    } finally {
      setWorking(false);
    }
  };

  const refresh = async () => {
    setWorking(true);
    try {
      const response = unwrap(await base44.functions.invoke('discord-sync-user', {}));
      toast({
        title: 'Discord roles refreshed',
        description: (response?.desired_roles || []).join(', ') || 'Your managed roles are up to date.',
      });
      await load();
    } catch (error) {
      toast({
        title: 'Roles could not be refreshed',
        description: error?.message || 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setWorking(false);
    }
  };

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-[#5865F2]/15 p-2 text-[#5865F2]">
            <DiscordIcon className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold">SwapPulse Bot</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Link your Discord membership to receive Collector access and your verified SwapPulse account role.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="mt-5 flex justify-center py-4" role="status" aria-label="Loading Discord connection">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : loadError ? (
          <div className="mt-5" role="alert">
            <p className="text-sm text-destructive">{loadError}</p>
            <Button className="mt-3" variant="outline" onClick={load}>Retry</Button>
          </div>
        ) : link?.status === 'revocation_pending' ? (
          <div className="mt-5 space-y-3" role="alert">
            <p className="text-sm text-destructive">Discord removal is pending. External roles may still be active.</p>
            <Button onClick={disconnect} disabled={working} variant="outline">Retry role removal</Button>
          </div>
        ) : link?.status === 'verified' ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-lg border border-success/30 bg-success/10 p-3">
              <div className="flex items-center gap-2 font-semibold text-success">
                <CheckCircle2 className="h-4 w-4" />
                Discord account verified
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {link.discord_username || 'Discord member'} · {link.verification_method === 'swappulse_account' ? 'SwapPulse account link' : 'CAPTCHA verification'}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Managed roles</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(link.applied_roles || []).map((role) => (
                  <span key={role} className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">{role}</span>
                ))}
                {!link.applied_roles?.length && <span className="text-sm text-muted-foreground">No roles confirmed yet.</span>}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Last confirmed sync: {link.last_role_sync_at ? new Date(link.last_role_sync_at).toLocaleString() : 'Not yet'}
              </p>
              {link.last_sync_error && <p className="mt-1 text-xs text-destructive" role="alert">Latest sync error: {link.last_sync_error.split(':')[0]}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={refresh} disabled={working} variant="outline">
                {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Refresh roles
              </Button>
              <Button onClick={disconnect} disabled={working} variant="ghost" className="text-destructive hover:text-destructive">
                Disconnect Discord
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <p className="mb-3 text-sm text-muted-foreground">
              Continuing opens Discord's consent screen. SwapPulse requests only your basic Discord identity and permission to add you to the official SwapPulse server if you are not already a member.
            </p>
            <Button onClick={connect} disabled={working}>
              {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
              Connect Discord account
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold">How access works</h3>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              <li>Account linking can grant Collector and Verified SwapPulse Account. Other trust and staff roles are paused while their proof and revocation paths are hardened.</li>
              <li>Use /verify in Discord if you prefer the CAPTCHA route. It grants Collector access only.</li>
              <li>Roles are checked regularly and removed when the matching SwapPulse status no longer applies.</li>
              <li>SwapPulse never stores your Discord OAuth token, bot token or CAPTCHA response.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
