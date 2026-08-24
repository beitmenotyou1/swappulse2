import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Rocket, Loader2, CheckCircle2, AlertCircle, ExternalLink, Copy } from 'lucide-react';

// Admin-only: compiles and deploys the SwapPulse Polygon contracts (soulbound
// username + transferable card NFT) via the deploy-polygon-contracts backend
// function. Returns the deployed addresses, which the admin must then set as
// the POLYGON_USERNAME_CONTRACT and POLYGON_CARD_CONTRACT secrets.
export default function DeployContractsSection() {
  const [deploying, setDeploying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const deploy = async () => {
    if (!window.confirm('Deploy the SwapPulse Polygon contracts to mainnet? This will spend gas from the configured deployer wallet.')) return;
    setDeploying(true);
    setError('');
    setResult(null);
    try {
      const res = await base44.functions.invoke('deploy-polygon-contracts', {});
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

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Rocket className="h-5 w-5 text-primary" />
        <h3 className="font-bold">Deploy Polygon Contracts</h3>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Compiles and deploys the SwapPulse username (soulbound) and card NFT (transferable) contracts to Polygon using the deployer wallet configured in secrets. After deployment, copy the addresses below into the <code className="rounded bg-secondary px-1 py-0.5 text-xs">POLYGON_USERNAME_CONTRACT</code> and <code className="rounded bg-secondary px-1 py-0.5 text-xs">POLYGON_CARD_CONTRACT</code> secrets so mint functions can use them.
      </p>
      <button
        onClick={deploy}
        disabled={deploying}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {deploying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
        {deploying ? 'Deploying…' : 'Deploy contracts'}
      </button>

      {result?.success && (
        <div className="mt-4 space-y-3">
          <div className="flex items-start gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Contracts deployed successfully</p>
              <p className="text-xs opacity-80">Deployer: {result.deployer}</p>
            </div>
          </div>
          <div className="space-y-2">
            <ContractAddressRow
              label="Username contract"
              address={result.usernameContract}
              explorerUrl={`${result.explorerUrl || 'https://amoy.polygonscan.com'}/address/${result.usernameContract}`}
              copied={copied === 'username'}
              onCopy={() => copy('username', result.usernameContract)}
            />
            <ContractAddressRow
              label="Card NFT contract"
              address={result.cardContract}
              explorerUrl={`${result.explorerUrl || 'https://amoy.polygonscan.com'}/address/${result.cardContract}`}
              copied={copied === 'card'}
              onCopy={() => copy('card', result.cardContract)}
            />
          </div>
          <div className="rounded-lg bg-secondary p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Next steps</p>
            <p className="mt-1">{result.instructions}</p>
          </div>
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

function ContractAddressRow({ label, address, explorerUrl, copied, onCopy }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/50 p-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="truncate font-mono text-xs">{address}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button onClick={onCopy} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Copy address">
          {copied ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
        </button>
        <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" title="View on explorer">
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}