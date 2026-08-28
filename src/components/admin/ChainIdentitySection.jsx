import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { AlertTriangle, Blocks, CheckCircle2, Clipboard, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function ChainIdentitySection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [config, setConfig] = useState(null);
  const [configDraft, setConfigDraft] = useState({
    account_class_hash: '',
    identity_registry_address: '',
    recovery_controller: '',
    recovery_delay_seconds: '172800',
    rpc_url: '',
    explorer_url: '',
    status: 'UNCONFIGURED',
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [prepared, setPrepared] = useState(null);
  const [accountAddress, setAccountAddress] = useState('');
  const [deploymentTxHash, setDeploymentTxHash] = useState('');
  const [registrationTxHash, setRegistrationTxHash] = useState('');
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (user?.id && !targetUserId) setTargetUserId(user.id);
  }, [user?.id, targetUserId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingConfig(true);
      try {
        const res = await base44.functions.invoke('chain-identity-admin', { action: 'config' });
        const nextConfig = res?.data?.config || res?.config || null;
        if (!cancelled) {
          setConfig(nextConfig);
          setConfigDraft({
            account_class_hash: nextConfig?.account_class_hash || '',
            identity_registry_address: nextConfig?.identity_registry_address || '',
            recovery_controller: nextConfig?.recovery_controller || '',
            recovery_delay_seconds: String(nextConfig?.recovery_delay_seconds ?? 172800),
            rpc_url: nextConfig?.rpc_url || '',
            explorer_url: nextConfig?.explorer_url || '',
            status: nextConfig?.status || 'UNCONFIGURED',
          });
        }
      } catch (err) {
        if (!cancelled) {
          toast({
            title: 'SwapPulse Testnet config unavailable',
            description: err?.message || 'Unable to load chain configuration.',
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) setLoadingConfig(false);
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await base44.functions.invoke('chain-identity-admin', {
        action: 'save_config',
        ...configDraft,
        recovery_delay_seconds: Number(configDraft.recovery_delay_seconds || 0),
      });
      const nextConfig = res?.data?.config || res?.config || null;
      setConfig(nextConfig);
      setConfigDraft((prev) => ({
        ...prev,
        account_class_hash: nextConfig?.account_class_hash || '',
        identity_registry_address: nextConfig?.identity_registry_address || '',
        recovery_controller: nextConfig?.recovery_controller || '',
        recovery_delay_seconds: String(nextConfig?.recovery_delay_seconds ?? 172800),
        rpc_url: nextConfig?.rpc_url || '',
        explorer_url: nextConfig?.explorer_url || '',
        status: nextConfig?.status || 'UNCONFIGURED',
      }));
      toast({
        title: 'SwapPulse Testnet configuration saved',
        description: nextConfig?.ready
          ? 'Contract configuration is ready for identity deployment.'
          : 'Configuration saved, but the network is not yet marked ready.',
      });
    } catch (err) {
      toast({
        title: 'Could not save testnet configuration',
        description: err?.response?.data?.error || err?.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSavingConfig(false);
    }
  };

  const deploymentJson = useMemo(() => {
    if (!prepared?.deployment) return '';
    return JSON.stringify(prepared.deployment, null, 2);
  }, [prepared]);

  const prepare = async () => {
    setPreparing(true);
    try {
      const res = await base44.functions.invoke('chain-identity-admin', {
        action: 'prepare',
        target_user_id: targetUserId.trim(),
        public_key: publicKey.trim(),
      });
      const data = res?.data || res;
      setPrepared(data);
      toast({
        title: data?.existing ? 'Existing chain identity found' : 'Chain identity reserved',
        description: data?.chain_ready === false
          ? 'The identity is pending. Declare/deploy the testnet contracts before account deployment.'
          : 'Deployment payload is ready. No private key was uploaded.',
      });
    } catch (err) {
      toast({
        title: 'Identity preparation failed',
        description: err?.response?.data?.error || err?.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setPreparing(false);
    }
  };

  const recordDeployment = async () => {
    if (!prepared?.identity?.id) return;
    setRecording(true);
    try {
      const res = await base44.functions.invoke('chain-identity-admin', {
        action: 'record_deployment',
        record_id: prepared.identity.id,
        account_address: accountAddress.trim(),
        deployment_tx_hash: deploymentTxHash.trim() || undefined,
        registration_tx_hash: registrationTxHash.trim() || undefined,
      });
      const data = res?.data || res;
      setPrepared((prev) => ({ ...prev, identity: data.identity }));
      toast({
        title: 'Deployment recorded',
        description: 'Status is DEPLOYED. It will not become REGISTERED until chain read-back verification exists.',
      });
    } catch (err) {
      toast({
        title: 'Could not record deployment',
        description: err?.response?.data?.error || err?.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setRecording(false);
    }
  };

  const copyDeployment = async () => {
    if (!deploymentJson) return;
    await navigator.clipboard?.writeText(deploymentJson);
    toast({ title: 'Deployment payload copied' });
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-base">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-bold">
            <Blocks className="h-4 w-4 text-primary" />
            SwapPulse Network — Identity Testnet
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Milestone 1 admin plumbing for the Cairo smart account and permanent chain identity. This tool accepts a public Stark key only. Private keys and passkey secrets must never be pasted here.
          </p>
        </div>
        {!loadingConfig && config && (
          <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${config.ready ? 'bg-success/10 text-success' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
            {config.ready ? 'Testnet configured' : 'Contracts not configured'}
          </span>
        )}
      </div>

      {loadingConfig ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading chain configuration…
        </div>
      ) : (
        <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-muted-foreground">Network</p>
            <p className="mt-1 font-mono font-semibold">{config?.network || 'SWAPPULSE_TESTNET'}</p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-muted-foreground">Account class</p>
            <p className="mt-1 truncate font-mono">{config?.account_class_hash || 'Not declared'}</p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-muted-foreground">Identity registry</p>
            <p className="mt-1 truncate font-mono">{config?.identity_registry_address || 'Not deployed'}</p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-muted-foreground">Recovery delay</p>
            <p className="mt-1 font-semibold">{config?.recovery_delay_seconds ?? 172800}s</p>
          </div>
        </div>
      )}

      {!loadingConfig && (
        <div className="mt-4 rounded-xl border border-border bg-secondary/20 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Public testnet configuration</p>
              <p className="text-xs text-muted-foreground">These are public chain coordinates, not secrets. Never paste private RPC credentials or signer keys here.</p>
            </div>
            <select
              value={configDraft.status}
              onChange={(e) => setConfigDraft((p) => ({ ...p, status: e.target.value }))}
              className="rounded-lg border border-border bg-background px-2 py-2 text-xs"
            >
              <option value="UNCONFIGURED">Unconfigured</option>
              <option value="CONFIGURED">Configured</option>
              <option value="PAUSED">Paused</option>
            </select>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <input
              value={configDraft.account_class_hash}
              onChange={(e) => setConfigDraft((p) => ({ ...p, account_class_hash: e.target.value }))}
              placeholder="SwapPulseAccount class hash 0x…"
              className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
            />
            <input
              value={configDraft.identity_registry_address}
              onChange={(e) => setConfigDraft((p) => ({ ...p, identity_registry_address: e.target.value }))}
              placeholder="IdentityRegistry address 0x…"
              className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
            />
            <input
              value={configDraft.recovery_controller}
              onChange={(e) => setConfigDraft((p) => ({ ...p, recovery_controller: e.target.value }))}
              placeholder="Recovery controller 0x… (optional)"
              className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
            />
            <input
              type="number"
              min="0"
              max="2592000"
              value={configDraft.recovery_delay_seconds}
              onChange={(e) => setConfigDraft((p) => ({ ...p, recovery_delay_seconds: e.target.value }))}
              placeholder="Recovery delay seconds"
              className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
            />
            <input
              value={configDraft.rpc_url}
              onChange={(e) => setConfigDraft((p) => ({ ...p, rpc_url: e.target.value }))}
              placeholder="Public HTTPS RPC URL (optional)"
              className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
            />
            <input
              value={configDraft.explorer_url}
              onChange={(e) => setConfigDraft((p) => ({ ...p, explorer_url: e.target.value }))}
              placeholder="Public explorer URL (optional)"
              className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
            />
          </div>
          <button
            onClick={saveConfig}
            disabled={savingConfig}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-secondary disabled:opacity-50"
          >
            {savingConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {savingConfig ? 'Saving…' : 'Save Testnet Configuration'}
          </button>
        </div>
      )}

      {!loadingConfig && config && !config.ready && (
        <div className="mt-3 flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            The Cairo source is present, but the testnet class hash and IdentityRegistry address have not been configured yet. You can reserve an identity now, but you cannot deploy it until the contracts are compiled, declared and deployed.
          </p>
        </div>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-semibold">Target Base44 user ID</span>
          <input
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
            autoComplete="off"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold">Testnet Stark public key</span>
          <input
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
            placeholder="0x… public key only"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
            autoComplete="off"
          />
        </label>
      </div>

      <button
        onClick={prepare}
        disabled={preparing || !targetUserId.trim() || !publicKey.trim()}
        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
      >
        {preparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Blocks className="h-4 w-4" />}
        {preparing ? 'Preparing…' : 'Prepare Test Identity'}
      </button>

      {prepared?.identity && (
        <div className="mt-5 space-y-3 rounded-xl border border-border bg-secondary/20 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <h3 className="font-semibold">Identity reservation</h3>
            <span className="ml-auto rounded-full bg-secondary px-2 py-1 text-xs font-semibold">{prepared.identity.status}</span>
          </div>
          <div className="grid gap-2 text-xs md:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Chain identity ID</p>
              <p className="break-all font-mono">{prepared.identity.chain_identity_id}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Account address</p>
              <p className="break-all font-mono">{prepared.identity.account_address || 'Awaiting deployment'}</p>
            </div>
          </div>

          {deploymentJson && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-semibold">Advanced deployment payload</p>
                <button onClick={copyDeployment} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  <Clipboard className="h-3.5 w-3.5" /> Copy
                </button>
              </div>
              <pre className="max-h-72 overflow-auto rounded-lg bg-background p-3 text-[11px] leading-relaxed">{deploymentJson}</pre>
            </div>
          )}

          {prepared.identity.status === 'PENDING' && (
            <div className="grid gap-2 md:grid-cols-3">
              <input
                value={accountAddress}
                onChange={(e) => setAccountAddress(e.target.value)}
                placeholder="Deployed account address 0x…"
                className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
              />
              <input
                value={deploymentTxHash}
                onChange={(e) => setDeploymentTxHash(e.target.value)}
                placeholder="Deploy tx hash (optional)"
                className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
              />
              <input
                value={registrationTxHash}
                onChange={(e) => setRegistrationTxHash(e.target.value)}
                placeholder="Registry tx hash (optional)"
                className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
              />
              <button
                onClick={recordDeployment}
                disabled={recording || !accountAddress.trim()}
                className="md:col-span-3 inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-secondary disabled:opacity-50"
              >
                {recording ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {recording ? 'Recording…' : 'Record Deployment'}
              </button>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            DEPLOYED is not treated as chain-authoritative registration. The later reconciliation worker must read IdentityRegistry before changing this mirror to REGISTERED.
          </p>
        </div>
      )}
    </section>
  );
}
