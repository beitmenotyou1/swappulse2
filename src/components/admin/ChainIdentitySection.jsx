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
    chain_id: '',
    account_class_hash: '',
    identity_registry_class_hash: '',
    identity_registry_address: '',
    identity_registry_owner: '',
    identity_verifier_address: '',
    recovery_controller: '',
    recovery_delay_seconds: '172800',
    rpc_url: '',
    tx_relay_url: '',
    explorer_url: '',
    status: 'UNCONFIGURED',
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [verifyingNetwork, setVerifyingNetwork] = useState(false);
  const [networkVerifyResult, setNetworkVerifyResult] = useState(null);
  const [manifestText, setManifestText] = useState('');
  const [importingManifest, setImportingManifest] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [prepared, setPrepared] = useState(null);
  const [accountAddress, setAccountAddress] = useState('');
  const [deploymentTxHash, setDeploymentTxHash] = useState('');
  const [registrationTxHash, setRegistrationTxHash] = useState('');
  const [recording, setRecording] = useState(false);
  const [provisioningResultText, setProvisioningResultText] = useState('');
  const [importingProvisioningResult, setImportingProvisioningResult] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState(null);

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
            chain_id: nextConfig?.chain_id || '',
            account_class_hash: nextConfig?.account_class_hash || '',
            identity_registry_class_hash: nextConfig?.identity_registry_class_hash || '',
            identity_registry_address: nextConfig?.identity_registry_address || '',
            identity_registry_owner: nextConfig?.identity_registry_owner || '',
            identity_verifier_address: nextConfig?.identity_verifier_address || '',
            recovery_controller: nextConfig?.recovery_controller || '',
            recovery_delay_seconds: String(nextConfig?.recovery_delay_seconds ?? 172800),
            rpc_url: nextConfig?.rpc_url || '',
            tx_relay_url: nextConfig?.tx_relay_url || '',
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
        chain_id: nextConfig?.chain_id || '',
        account_class_hash: nextConfig?.account_class_hash || '',
        identity_registry_class_hash: nextConfig?.identity_registry_class_hash || '',
        identity_registry_address: nextConfig?.identity_registry_address || '',
        identity_registry_owner: nextConfig?.identity_registry_owner || '',
        identity_verifier_address: nextConfig?.identity_verifier_address || '',
        recovery_controller: nextConfig?.recovery_controller || '',
        recovery_delay_seconds: String(nextConfig?.recovery_delay_seconds ?? 172800),
        rpc_url: nextConfig?.rpc_url || '',
        tx_relay_url: nextConfig?.tx_relay_url || '',
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

  const verifyNetwork = async () => {
    setVerifyingNetwork(true);
    setNetworkVerifyResult(null);
    try {
      const res = await base44.functions.invoke('chain-network-verify', {});
      const data = res?.data || res;
      setNetworkVerifyResult(data);

      const refreshed = await base44.functions.invoke('chain-identity-admin', { action: 'config' });
      const nextConfig = refreshed?.data?.config || refreshed?.config || null;
      setConfig(nextConfig);
      setConfigDraft((prev) => ({
        ...prev,
        chain_id: nextConfig?.chain_id || '',
        account_class_hash: nextConfig?.account_class_hash || '',
        identity_registry_class_hash: nextConfig?.identity_registry_class_hash || '',
        identity_registry_address: nextConfig?.identity_registry_address || '',
        identity_registry_owner: nextConfig?.identity_registry_owner || '',
        identity_verifier_address: nextConfig?.identity_verifier_address || '',
        recovery_controller: nextConfig?.recovery_controller || '',
        recovery_delay_seconds: String(nextConfig?.recovery_delay_seconds ?? 172800),
        rpc_url: nextConfig?.rpc_url || '',
        tx_relay_url: nextConfig?.tx_relay_url || '',
        explorer_url: nextConfig?.explorer_url || '',
        status: nextConfig?.status || 'UNCONFIGURED',
      }));
      toast({
        title: 'SwapPulse Testnet verified',
        description: `RPC confirmed chain ${data?.rpc?.chain_id || 'ID'} and both contract classes.`,
      });
    } catch (err) {
      toast({
        title: 'Testnet verification failed',
        description: err?.response?.data?.error || err?.message || 'Unknown verification error',
        variant: 'destructive',
      });
    } finally {
      setVerifyingNetwork(false);
    }
  };

  const importManifest = async () => {
    setImportingManifest(true);
    try {
      const res = await base44.functions.invoke('chain-identity-admin', {
        action: 'import_manifest',
        manifest: manifestText,
      });
      const data = res?.data || res;
      const nextConfig = data?.config || null;
      setConfig(nextConfig);
      setConfigDraft((prev) => ({
        ...prev,
        chain_id: nextConfig?.chain_id || '',
        account_class_hash: nextConfig?.account_class_hash || '',
        identity_registry_class_hash: nextConfig?.identity_registry_class_hash || '',
        identity_registry_address: nextConfig?.identity_registry_address || '',
        identity_registry_owner: nextConfig?.identity_registry_owner || '',
        identity_verifier_address: nextConfig?.identity_verifier_address || '',
        recovery_controller: nextConfig?.recovery_controller || '',
        recovery_delay_seconds: String(nextConfig?.recovery_delay_seconds ?? 172800),
        rpc_url: nextConfig?.rpc_url || '',
        tx_relay_url: nextConfig?.tx_relay_url || '',
        explorer_url: nextConfig?.explorer_url || '',
        status: nextConfig?.status || 'UNCONFIGURED',
      }));
      setNetworkVerifyResult(null);
      toast({
        title: 'Deployment manifest imported',
        description: 'Saved as an unverified draft. Verify & Activate will independently check the public RPC.',
      });
    } catch (err) {
      toast({
        title: 'Manifest import failed',
        description: err?.response?.data?.error || err?.message || 'Invalid deployment manifest',
        variant: 'destructive',
      });
    } finally {
      setImportingManifest(false);
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

  const importProvisioningResult = async () => {
    if (!prepared?.identity?.id) return;
    setImportingProvisioningResult(true);
    try {
      const res = await base44.functions.invoke('chain-identity-admin', {
        action: 'import_provisioning_result',
        record_id: prepared.identity.id,
        result: provisioningResultText,
      });
      const data = res?.data || res;
      setPrepared((prev) => ({ ...prev, identity: data.identity }));
      setAccountAddress(data?.identity?.account_address || '');
      setDeploymentTxHash(data?.identity?.deployment_tx_hash || '');
      setRegistrationTxHash(data?.identity?.registration_tx_hash || '');
      toast({
        title: 'Provisioning result accepted',
        description: 'Public deployment data matches the reserved signer and verified network. Reconcile From Chain is still required.',
      });
    } catch (err) {
      toast({
        title: 'Provisioning result rejected',
        description: err?.response?.data?.error || err?.message || 'Invalid provisioning result',
        variant: 'destructive',
      });
    } finally {
      setImportingProvisioningResult(false);
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

  const reconcile = async () => {
    if (!prepared?.identity?.id) return;
    setReconciling(true);
    setReconcileResult(null);
    try {
      const res = await base44.functions.invoke('chain-identity-reconcile', {
        record_id: prepared.identity.id,
      });
      const data = res?.data || res;
      setReconcileResult(data);
      const outcome = data?.results?.[0]?.outcome || 'UNKNOWN';
      toast({
        title: 'Chain state checked',
        description: `Reconciliation result: ${outcome}.`,
        variant: outcome === 'ERROR' || outcome === 'REVERSE_MISMATCH' ? 'destructive' : undefined,
      });
      const refreshed = await base44.functions.invoke('chain-identity-admin', {
        action: 'prepare',
        target_user_id: targetUserId.trim(),
        public_key: publicKey.trim(),
      });
      const refreshedData = refreshed?.data || refreshed;
      if (refreshedData?.identity) setPrepared(refreshedData);
    } catch (err) {
      toast({
        title: 'Chain reconciliation failed',
        description: err?.response?.data?.error || err?.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setReconciling(false);
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
            <p className="text-muted-foreground">Chain ID</p>
            <p className="mt-1 truncate font-mono">{config?.chain_id || 'Not pinned'}</p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-muted-foreground">Account class</p>
            <p className="mt-1 truncate font-mono">{config?.account_class_hash || 'Not declared'}</p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-muted-foreground">Registry class</p>
            <p className="mt-1 truncate font-mono">{config?.identity_registry_class_hash || 'Not declared'}</p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-muted-foreground">Identity registry</p>
            <p className="mt-1 truncate font-mono">{config?.identity_registry_address || 'Not deployed'}</p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-muted-foreground">Registry owner</p>
            <p className="mt-1 truncate font-mono">{config?.identity_registry_owner || 'Not pinned'}</p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-muted-foreground">Identity verifier</p>
            <p className="mt-1 truncate font-mono">{config?.identity_verifier_address || 'Not pinned'}</p>
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
              aria-label="Network configuration status"
              value={configDraft.status}
              onChange={(e) => setConfigDraft((p) => ({ ...p, status: e.target.value }))}
              className="rounded-lg border border-border bg-background px-2 py-2 text-xs"
            >
              <option value="UNCONFIGURED">Draft / unverified</option>
              <option value="CONFIGURED" disabled>Configured (RPC verified)</option>
              <option value="PAUSED">Paused</option>
            </select>
          </div>
          <details className="mb-3 rounded-lg border border-border bg-background/60 p-3">
            <summary className="cursor-pointer text-sm font-semibold">Import deployment manifest</summary>
            <p className="mt-2 text-xs text-muted-foreground">
              Paste the public JSON emitted by deploy-network.mjs. Secret-like fields are rejected, and importing never activates the network by itself.
            </p>
            <textarea
              value={manifestText}
              onChange={(e) => setManifestText(e.target.value)}
              placeholder={'{\n  "schema_version": 1,\n  "network": "SWAPPULSE_TESTNET",\n  ...\n}'}
              className="mt-2 min-h-40 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
              spellCheck={false}
             aria-label={'{\n  "schema_version": 1,\n  "network": "SWAPPULSE_TESTNET",\n  ...\n}'}/>
            <button
              onClick={importManifest}
              disabled={importingManifest || !manifestText.trim()}
              className="mt-2 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-secondary disabled:opacity-50"
            >
              {importingManifest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clipboard className="h-4 w-4" />}
              {importingManifest ? 'Importing…' : 'Import Public Manifest'}
            </button>
          </details>
          <div className="grid gap-2 md:grid-cols-2">
            <input
              value={configDraft.chain_id}
              onChange={(e) => setConfigDraft((p) => ({ ...p, chain_id: e.target.value }))}
              placeholder="Expected Starknet chain ID 0x…"
              className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
             aria-label="Expected Starknet chain ID 0x…"/>
            <input
              value={configDraft.account_class_hash}
              onChange={(e) => setConfigDraft((p) => ({ ...p, account_class_hash: e.target.value }))}
              placeholder="SwapPulseAccount class hash 0x…"
              className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
             aria-label="SwapPulseAccount class hash 0x…"/>
            <input
              value={configDraft.identity_registry_class_hash}
              onChange={(e) => setConfigDraft((p) => ({ ...p, identity_registry_class_hash: e.target.value }))}
              placeholder="IdentityRegistry class hash 0x…"
              className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
             aria-label="IdentityRegistry class hash 0x…"/>
            <input
              value={configDraft.identity_registry_address}
              onChange={(e) => setConfigDraft((p) => ({ ...p, identity_registry_address: e.target.value }))}
              placeholder="IdentityRegistry address 0x…"
              className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
             aria-label="IdentityRegistry address 0x…"/>
            <input
              value={configDraft.identity_registry_owner}
              onChange={(e) => setConfigDraft((p) => ({ ...p, identity_registry_owner: e.target.value }))}
              placeholder="IdentityRegistry owner 0x…"
              className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
             aria-label="IdentityRegistry owner 0x…"/>
            <input
              value={configDraft.identity_verifier_address}
              onChange={(e) => setConfigDraft((p) => ({ ...p, identity_verifier_address: e.target.value }))}
              placeholder="Authorised identity verifier 0x…"
              className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
             aria-label="Authorised identity verifier 0x…"/>
            <input
              value={configDraft.recovery_controller}
              onChange={(e) => setConfigDraft((p) => ({ ...p, recovery_controller: e.target.value }))}
              placeholder="Recovery controller 0x… (optional)"
              className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
             aria-label="Recovery controller 0x… (optional)"/>
            <input
              type="number"
              min="0"
              max="2592000"
              value={configDraft.recovery_delay_seconds}
              onChange={(e) => setConfigDraft((p) => ({ ...p, recovery_delay_seconds: e.target.value }))}
              placeholder="Recovery delay seconds"
              className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
             aria-label="Recovery delay seconds"/>
            <input
              value={configDraft.rpc_url}
              onChange={(e) => setConfigDraft((p) => ({ ...p, rpc_url: e.target.value }))}
              placeholder="Public HTTPS RPC URL (optional)"
              className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
             aria-label="Public HTTPS RPC URL (optional)"/>
            <input
              value={configDraft.tx_relay_url}
              onChange={(e) => setConfigDraft((p) => ({ ...p, tx_relay_url: e.target.value }))}
              placeholder="Privileged transaction relay HTTPS URL (optional)"
              className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
             aria-label="Privileged transaction relay HTTPS URL (optional)"/>
            <input
              value={configDraft.explorer_url}
              onChange={(e) => setConfigDraft((p) => ({ ...p, explorer_url: e.target.value }))}
              placeholder="Public explorer URL (optional)"
              className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
             aria-label="Public explorer URL (optional)"/>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={saveConfig}
              disabled={savingConfig}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-secondary disabled:opacity-50"
            >
              {savingConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {savingConfig ? 'Saving…' : 'Save Configuration Draft'}
            </button>
            <button
              onClick={verifyNetwork}
              disabled={verifyingNetwork || savingConfig || !configDraft.rpc_url || !configDraft.chain_id || !configDraft.account_class_hash || !configDraft.identity_registry_class_hash || !configDraft.identity_registry_address || !configDraft.identity_registry_owner || !configDraft.identity_verifier_address}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {verifyingNetwork ? <Loader2 className="h-4 w-4 animate-spin" /> : <Blocks className="h-4 w-4" />}
              {verifyingNetwork ? 'Verifying RPC…' : 'Verify & Activate'}
            </button>
            {config?.last_verified_at && (
              <span className="text-xs text-muted-foreground">
                Last verified {new Date(config.last_verified_at).toLocaleString()}
              </span>
            )}
          </div>
          {networkVerifyResult?.ok && (
            <div className="mt-3 rounded-lg border border-success/30 bg-success/10 p-3 text-xs">
              <p className="font-semibold text-success">RPC verification passed</p>
              <p className="mt-1 font-mono text-muted-foreground">Chain {networkVerifyResult.rpc?.chain_id} · registry {networkVerifyResult.contracts?.identity_registry_address}</p>
            </div>
          )}
        </div>
      )}

      {!loadingConfig && config && !config.ready && (
        <div className="mt-3 flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            The Cairo source is present, but the chain ID, account class hash, registry class hash, and IdentityRegistry address have not all been configured yet. You can reserve an identity now, but you cannot deploy it until the contracts are compiled, declared and deployed.
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
            <div>
              <p className="text-muted-foreground">Reserved signer public key</p>
              <p className="break-all font-mono">{prepared.identity.signer_public_key || publicKey || 'Not bound'}</p>
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
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-background/70 p-3">
                <p className="text-sm font-semibold">Import public provisioning result</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Paste the JSON printed by provision-test-identity.mjs. SwapPulse verifies the reserved signer, derived account address, chain, contract classes, registry owner and recovery policy before recording DEPLOYED.
                </p>
                <textarea
                  value={provisioningResultText}
                  onChange={(e) => setProvisioningResultText(e.target.value)}
                  placeholder={'{\n  "schema_version": 1,\n  "kind": "SWAPPULSE_TEST_IDENTITY_PROVISIONING_RESULT",\n  ...\n}'}
                  className="mt-2 min-h-40 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
                  spellCheck={false}
                 aria-label={'{\n  "schema_version": 1,\n  "kind": "SWAPPULSE_TEST_IDENTITY_PROVISIONING_RESULT",\n  ...\n}'}/>
                <button
                  onClick={importProvisioningResult}
                  disabled={importingProvisioningResult || !provisioningResultText.trim()}
                  className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
                >
                  {importingProvisioningResult ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clipboard className="h-4 w-4" />}
                  {importingProvisioningResult ? 'Verifying result…' : 'Import Provisioning Result'}
                </button>
              </div>

              <details className="rounded-lg border border-border bg-background/50 p-3">
                <summary className="cursor-pointer text-xs font-semibold">Manual deployment recording fallback</summary>
                <p className="mt-2 text-xs text-muted-foreground">
                  Prefer the signed-key-bound provisioning result above. This manual path exists for recovery/debugging and still cannot promote the identity beyond DEPLOYED.
                </p>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  <input
                    value={accountAddress}
                    onChange={(e) => setAccountAddress(e.target.value)}
                    placeholder="Deployed account address 0x…"
                    className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
                   aria-label="Deployed account address 0x…"/>
                  <input
                    value={deploymentTxHash}
                    onChange={(e) => setDeploymentTxHash(e.target.value)}
                    placeholder="Deploy tx hash (optional)"
                    className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
                   aria-label="Deploy tx hash (optional)"/>
                  <input
                    value={registrationTxHash}
                    onChange={(e) => setRegistrationTxHash(e.target.value)}
                    placeholder="Registry tx hash (optional)"
                    className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
                   aria-label="Registry tx hash (optional)"/>
                  <button
                    onClick={recordDeployment}
                    disabled={recording || !accountAddress.trim()}
                    className="md:col-span-3 inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-secondary disabled:opacity-50"
                  >
                    {recording ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {recording ? 'Recording…' : 'Record Deployment Manually'}
                  </button>
                </div>
              </details>
            </div>
          )}

          {['DEPLOYED', 'REGISTERED', 'RECOVERED', 'MERGED'].includes(prepared.identity.status) && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={reconcile}
                disabled={reconciling || !config?.rpc_url || !config?.chain_id}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-secondary disabled:opacity-50"
              >
                {reconciling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Blocks className="h-4 w-4" />}
                {reconciling ? 'Checking chain…' : 'Reconcile From Chain'}
              </button>
              {reconcileResult?.rpc?.chain_id && (
                <span className="text-xs text-muted-foreground">
                  RPC chain {reconcileResult.rpc.chain_id}, spec {reconcileResult.rpc.spec_version || 'unknown'}
                </span>
              )}
            </div>
          )}

          {reconcileResult?.results?.[0] && (
            <div className="rounded-lg border border-border bg-background p-3 text-xs">
              <p className="font-semibold">Last chain check: {reconcileResult.results[0].outcome}</p>
              {reconcileResult.results[0].canonical_identity_id && (
                <p className="mt-1 break-all font-mono text-muted-foreground">
                  Canonical identity: {reconcileResult.results[0].canonical_identity_id}
                </p>
              )}
              {reconcileResult.results[0].error && (
                <p className="mt-1 text-destructive">{reconcileResult.results[0].error}</p>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            DEPLOYED is not treated as chain-authoritative registration. Only a successful IdentityRegistry read-back can promote this mirror to REGISTERED or RECOVERED.
          </p>
        </div>
      )}
    </section>
  );
}
