import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Rocket, Loader2, CheckCircle2, AlertCircle, ExternalLink, Copy, Boxes, Link2 } from 'lucide-react';

// Admin-only: deploys all SwapPulse smart contracts across Polygon and
// PulseChain. Each deployment card calls its backend function and displays
// the returned contract addresses with copy buttons and the secret name to
// set in Settings.
export default function DeployContractsSection() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-1 flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" />
          <h3 className="font-bold">Contract Deployment</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Deploy SwapPulse smart contracts across Polygon and PulseChain. After each deployment, copy the returned addresses into the corresponding secrets.
        </p>
      </div>

      <DeployCard
        title="Polygon Contracts"
        icon={Boxes}
        description="Deploys the soulbound username and transferable card NFT contracts to Polygon. Required before minting works."
        functionName="deploy-polygon-contracts"
        confirmMessage="Deploy the SwapPulse Polygon contracts? This will spend gas from the configured deployer wallet."
        extractResults={(r) => [
          { label: 'Username contract', address: r.usernameContract, secret: 'POLYGON_USERNAME_CONTRACT', explorerUrl: `${r.explorerUrl || 'https://amoy.polygonscan.com'}/address/${r.usernameContract}` },
          { label: 'Card NFT contract', address: r.cardContract, secret: 'POLYGON_CARD_CONTRACT', explorerUrl: `${r.explorerUrl || 'https://amoy.polygonscan.com'}/address/${r.cardContract}` },
        ]}
      />

      <DeployCard
        title="PulseChain Contracts"
        icon={Rocket}
        description="Deploys V2 username, card, and PulseChainBridge contracts to PulseChain for dual-mint support. Requires PULSE_RPC_URL to be a valid EVM JSON-RPC endpoint."
        functionName="deploy-pulse-contracts"
        confirmMessage="Deploy the SwapPulse PulseChain contracts? This will spend gas from the PulseChain deployer wallet."
        extractResults={(r) => [
          { label: 'Username V2', address: r.contracts?.SwapPulseUsernameV2, secret: 'PULSE_SPUN_CONTRACT', explorerUrl: `${r.chain?.explorerUrl || ''}/address/${r.contracts?.SwapPulseUsernameV2}` },
          { label: 'Card NFT V2', address: r.contracts?.SwapPulseCardNFTV2, secret: 'PULSE_SPCD_CONTRACT', explorerUrl: `${r.chain?.explorerUrl || ''}/address/${r.contracts?.SwapPulseCardNFTV2}` },
          { label: 'PulseChain Bridge', address: r.contracts?.PulseChainBridge, secret: 'PULSE_BRIDGE_CONTRACT', explorerUrl: `${r.chain?.explorerUrl || ''}/address/${r.contracts?.PulseChainBridge}` },
        ]}
      />

      <DeployCard
        title="Polygon Bridge"
        icon={Link2}
        description="Deploys the PolygonBridge contract for locking Polygon NFTs during cross-chain bridges to PulseChain. Requires Polygon contracts to be deployed first."
        functionName="deploy-polygon-bridge"
        confirmMessage="Deploy the PolygonBridge contract? This will spend gas from the Polygon deployer wallet."
        extractResults={(r) => [
          { label: 'PolygonBridge', address: r.address, secret: 'POLYGON_BRIDGE_CONTRACT', explorerUrl: r.polygonExplorer },
        ]}
      />
    </div>
  );
}

function DeployCard({ title, icon: Icon, description, functionName, confirmMessage, extractResults }) {
  const [deploying, setDeploying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const deploy = async () => {
    if (!window.confirm(confirmMessage)) return;
    setDeploying(true);
    setError('');
    setResult(null);
    try {
      const res = await base44.functions.invoke(functionName, {});
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Deployment failed');
    } finally {
      setDeploying(false);
    }
  };

  const copy = (label, value) => {
    navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(''), 1500);
  };

  const results = result ? extractResults(result).filter((r) => r.address) : [];
  const nextSteps = result?.nextSteps || (result?.instructions ? [result.instructions] : []);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <h3 className="font-bold">{title}</h3>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{description}</p>
      <button
        onClick={deploy}
        disabled={deploying}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {deploying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
        {deploying ? 'Deploying…' : `Deploy ${title}`}
      </button>

      {results.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="flex items-start gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="font-semibold">Deployment successful</p>
          </div>
          <div className="space-y-2">
            {results.map((r) => (
              <ContractAddressRow
                key={r.label}
                label={r.label}
                address={r.address}
                secret={r.secret}
                explorerUrl={r.explorerUrl}
                copied={copied === r.label}
                onCopy={() => copy(r.label, r.address)}
              />
            ))}
          </div>
          {nextSteps.length > 0 && (
            <div className="rounded-lg bg-secondary p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Next steps</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                {nextSteps.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Deployment failed</p>
            <p className="text-xs opacity-80 whitespace-pre-wrap">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ContractAddressRow({ label, address, secret, explorerUrl, copied, onCopy }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/50 p-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="truncate font-mono text-xs">{address}</p>
        {secret && (
          <p className="mt-0.5 text-[10px] text-primary/80">Set as: <code className="font-mono">{secret}</code></p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button onClick={onCopy} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Copy address">
          {copied ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
        </button>
        {explorerUrl && (
          <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" title="View on explorer">
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
    </div>
  );
}