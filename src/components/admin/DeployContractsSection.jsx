import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Rocket, Loader2, CheckCircle2, AlertCircle, ExternalLink, Copy,
  Boxes, Link2, Coins, FileCheck2,
} from 'lucide-react';

// Admin-only: deploys and displays all SwapPulse smart contracts across
// Polygon and PulseChain. On mount, fetches persisted contract addresses
// (from the ContractRegistry via get-contract-addresses) so already-
// deployed contracts are shown with their addresses and do NOT prompt for
// redeployment after a page refresh. Each deploy function persists its
// deployed address back to the registry on success.
export default function DeployContractsSection() {
  const [deployed, setDeployed] = useState(null);
  const [loadingAddresses, setLoadingAddresses] = useState(true);

  const fetchAddresses = async () => {
    try {
      const res = await base44.functions.invoke('get-contract-addresses', {});
      setDeployed(res.data);
    } catch (e) {
      console.error('Failed to fetch contract addresses:', e);
    } finally {
      setLoadingAddresses(false);
    }
  };

  useEffect(() => { fetchAddresses(); }, []);

  if (loadingAddresses) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const poly = deployed?.polygon || {};
  const pulse = deployed?.pulse || {};

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-1 flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" />
          <h3 className="font-bold">Contract Deployment</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Deploy and manage SwapPulse smart contracts across Polygon and PulseChain. Deployed contracts are persisted and remain visible after refresh — deploy only the contracts that haven't been deployed yet.
        </p>
      </div>

      {/* Polygon — NFT identity + card contracts */}
      <DeployCard
        title="Polygon · NFT Contracts"
        icon={Boxes}
        description="Soulbound username and transferable card NFT contracts on Polygon. Required before minting works."
        functionName="deploy-polygon-contracts"
        confirmMessage="Deploy the SwapPulse Polygon contracts? This will spend gas from the configured deployer wallet."
        extractResults={(r) => [
          { label: 'Username contract', address: r.usernameContract, secret: 'POLYGON_USERNAME_CONTRACT' },
          { label: 'Card NFT contract', address: r.cardContract, secret: 'POLYGON_CARD_CONTRACT' },
        ]}
        deployedAddresses={[
          { label: 'Username contract', ...poly.username, secret: 'POLYGON_USERNAME_CONTRACT' },
          { label: 'Card NFT contract', ...poly.card, secret: 'POLYGON_CARD_CONTRACT' },
        ]}
        onDeployed={fetchAddresses}
      />

      {/* Polygon — Bridge */}
      <DeployCard
        title="Polygon · Bridge"
        icon={Link2}
        description="PolygonBridge locks Polygon NFTs during cross-chain bridges to PulseChain and mints them on the way back. Requires Polygon NFT contracts to be deployed first."
        functionName="deploy-polygon-bridge"
        confirmMessage="Deploy the PolygonBridge contract? This will spend gas from the Polygon deployer wallet."
        extractResults={(r) => [
          { label: 'PolygonBridge', address: r.address, secret: 'POLYGON_BRIDGE_CONTRACT' },
        ]}
        deployedAddresses={[
          { label: 'PolygonBridge', ...poly.bridge, secret: 'POLYGON_BRIDGE_CONTRACT' },
        ]}
        onDeployed={fetchAddresses}
      />

      {/* PulseChain — NFT + Bridge contracts */}
      <DeployCard
        title="PulseChain · NFT & Bridge Contracts"
        icon={Rocket}
        description="V2 username, card, and PulseChainBridge contracts on PulseChain for dual-mint support. Requires PULSE_RPC_URL to be a valid EVM JSON-RPC endpoint."
        functionName="deploy-pulse-contracts"
        confirmMessage="Deploy the SwapPulse PulseChain contracts? This will spend gas from the PulseChain deployer wallet."
        extractResults={(r) => [
          { label: 'Username V2', address: r.contracts?.SwapPulseUsernameV2, secret: 'PULSE_SPUN_CONTRACT' },
          { label: 'Card NFT V2', address: r.contracts?.SwapPulseCardNFTV2, secret: 'PULSE_SPCD_CONTRACT' },
          { label: 'PulseChain Bridge', address: r.contracts?.PulseChainBridge, secret: 'PULSE_BRIDGE_CONTRACT' },
        ]}
        deployedAddresses={[
          { label: 'Username V2', ...pulse.username, secret: 'PULSE_SPUN_CONTRACT' },
          { label: 'Card NFT V2', ...pulse.card, secret: 'PULSE_SPCD_CONTRACT' },
          { label: 'PulseChain Bridge', ...pulse.bridge, secret: 'PULSE_BRIDGE_CONTRACT' },
        ]}
        onDeployed={fetchAddresses}
      />

      {/* Base $PULSE ERC-20 token (must be deployed before the OFT wrapper) */}
      <PulseTokenDeployCard
        deployed={{ pulse: pulse.token, polygon: poly.token }}
        onDeployed={fetchAddresses}
      />

      {/* LayerZero OFT PulseToken */}
      <OftDeployCard
        deployed={{ pulse: pulse.oft, polygon: poly.oft }}
        onDeployed={fetchAddresses}
      />

      {/* Card Metadata Anchor */}
      <DeployCard
        title="PulseChain · Card Metadata Anchor"
        icon={FileCheck2}
        description="CardMetadataAnchor stores on-chain hashes of TCGDex card metadata on PulseChain so trade-fairness calculations can verify off-chain data integrity."
        functionName="deploy-card-metadata-anchor"
        confirmMessage="Deploy the CardMetadataAnchor contract to PulseChain? This will spend gas from the PulseChain deployer wallet."
        extractResults={(r) => [
          { label: 'CardMetadataAnchor', address: r.contract_address, secret: 'CARD_METADATA_ANCHOR_CONTRACT' },
        ]}
        deployedAddresses={[
          { label: 'CardMetadataAnchor', ...pulse.cardMetadataAnchor, secret: 'CARD_METADATA_ANCHOR_CONTRACT' },
        ]}
        onDeployed={fetchAddresses}
      />
    </div>
  );
}

function DeployCard({
  title, icon: Icon, description, functionName, confirmMessage,
  extractResults, deployedAddresses = [], onDeployed, deployPayload,
}) {
  const [deploying, setDeploying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  // Addresses already persisted (from the registry / secrets).
  const alreadyDeployed = deployedAddresses.filter((a) => a.address);

  // Addresses newly deployed in this session (from the deploy result).
  const newResults = result ? extractResults(result).filter((r) => r.address) : [];

  // Merge: newly deployed take priority over persisted.
  const allAddresses = [
    ...newResults,
    ...alreadyDeployed.filter((a) => !newResults.some((r) => r.label === a.label)),
  ];

  const nextSteps = result?.nextSteps || (result?.instructions ? [result.instructions] : []);
  const isFullyDeployed = alreadyDeployed.length > 0 && alreadyDeployed.every((a) => a.address);

  const deploy = async () => {
    if (!window.confirm(confirmMessage)) return;
    setDeploying(true);
    setError('');
    setResult(null);
    try {
      const res = await base44.functions.invoke(functionName, deployPayload || {});
      setResult(res.data);
      if (onDeployed) onDeployed();
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
        <Icon className="h-5 w-5 text-primary" />
        <h3 className="font-bold">{title}</h3>
        {isFullyDeployed && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-xs font-bold text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Deployed
          </span>
        )}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{description}</p>

      {allAddresses.length > 0 && (
        <div className="mb-4 space-y-2">
          {allAddresses.map((r) => (
            <ContractAddressRow
              key={r.label}
              label={r.label}
              address={r.address}
              secret={r.secret}
              explorerUrl={r.explorerUrl}
              txHash={r.txHash}
              deployedAt={r.deployedAt}
              copied={copied === r.label}
              onCopy={() => copy(r.label, r.address)}
              isNew={newResults.some((nr) => nr.label === r.label)}
            />
          ))}
        </div>
      )}

      {!isFullyDeployed && (
        <button
          onClick={deploy}
          disabled={deploying}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {deploying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
          {deploying ? 'Deploying…' : `Deploy ${title}`}
        </button>
      )}

      {newResults.length > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="font-semibold">Deployment successful — addresses saved automatically.</p>
        </div>
      )}

      {nextSteps.length > 0 && newResults.length > 0 && (
        <div className="mt-3 rounded-lg bg-secondary p-3 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">Next steps</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {nextSteps.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
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

// Specialised card for the LayerZero OFT PulseToken, which takes a `chain`
// parameter (pulse or polygon) and can be deployed on either chain.
function OftDeployCard({ deployed, onDeployed }) {
  const [chain, setChain] = useState('pulse');
  const [endpoint, setEndpoint] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const current = deployed[chain] || {};
  const isDeployed = !!current.address;

  const deploy = async () => {
    if (!endpoint || !/^0x[a-fA-F0-9]{40}$/.test(endpoint.trim())) {
      setError('Enter the LayerZero V2 endpoint address (0x…) for the selected chain. Find it at https://docs.layerzero.network/v2/developers/evm/technical-reference/deployed-contracts');
      return;
    }
    if (!window.confirm(`Deploy the OFT PulseToken on ${chain}? This will spend gas from the ${chain} deployer wallet.`)) return;
    setDeploying(true);
    setError('');
    setResult(null);
    try {
      const res = await base44.functions.invoke('deploy-lz-pulse-token', { chain, endpoint: endpoint.trim() });
      setResult(res.data);
      if (onDeployed) onDeployed();
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
        <Coins className="h-5 w-5 text-primary" />
        <h3 className="font-bold">LayerZero · OFT PulseToken</h3>
        {isDeployed && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-xs font-bold text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Deployed
          </span>
        )}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        OFTPulseToken wraps the native $PULSE ERC-20 for cross-chain transfers via LayerZero V2. Deploy on each chain you want to bridge between, then run configure-lz-peers.
      </p>

      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground">Chain:</span>
        <div className="inline-flex rounded-lg border border-border p-0.5">
          {['pulse', 'polygon'].map((c) => (
            <button
              key={c}
              onClick={() => setChain(c)}
              className={`rounded-md px-3 py-1 text-xs font-semibold capitalize transition-colors ${chain === c ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-secondary'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {!isDeployed && (
        <div className="mb-4">
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">
            LayerZero V2 Endpoint Address
          </label>
          <input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="0x… (LayerZero V2 endpoint on the selected chain)"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            Find the endpoint for your chain at{' '}
            <a href="https://docs.layerzero.network/v2/developers/evm/technical-reference/deployed-contracts" target="_blank" rel="noopener noreferrer" className="text-primary underline">
              LayerZero docs
            </a>
          </p>
        </div>
      )}

      {current.address ? (
        <div className="mb-4 space-y-2">
          <ContractAddressRow
            label={`OFTPulseToken (${chain})`}
            address={current.address}
            secret={chain === 'pulse' ? 'OFT_PULSE_TOKEN_CONTRACT' : 'OFT_POLYGON_TOKEN_CONTRACT'}
            explorerUrl={current.explorerUrl}
            txHash={current.txHash}
            deployedAt={current.deployedAt}
            copied={copied === `oft-${chain}`}
            onCopy={() => copy(`oft-${chain}`, current.address)}
            isNew={!!result?.address && chain === result?.chain}
          />
        </div>
      ) : (
        <p className="mb-4 rounded-lg bg-secondary/60 p-3 text-xs text-muted-foreground">
          Not yet deployed on {chain}.
        </p>
      )}

      <button
        onClick={deploy}
        disabled={deploying}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {deploying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
        {deploying ? 'Deploying…' : `Deploy on ${chain}`}
      </button>

      {result?.address && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="font-semibold">Deployment successful — address saved automatically.</p>
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

// Chain-switching card for the base $PULSE ERC-20 token. Deploys on polygon
// (where POL gas is available) or pulse (requires PLS gas) via deploy-pulse-token.
function PulseTokenDeployCard({ deployed, onDeployed }) {
  const [chain, setChain] = useState('polygon');
  const [deploying, setDeploying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const current = deployed[chain] || {};
  const isDeployed = !!current.address;

  const deploy = async () => {
    if (!window.confirm(`Deploy the SwapPulse $PULSE ERC-20 token on ${chain}? This will spend gas from the ${chain} deployer wallet.`)) return;
    setDeploying(true);
    setError('');
    setResult(null);
    try {
      const res = await base44.functions.invoke('deploy-pulse-token', { chain });
      setResult(res.data);
      if (onDeployed) onDeployed();
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
        <Coins className="h-5 w-5 text-primary" />
        <h3 className="font-bold">$PULSE ERC-20 Token</h3>
        {isDeployed && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-xs font-bold text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Deployed
          </span>
        )}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Base SwapPulse $PULSE governance/utility token (1B supply, 40% usage-mining, 15% reserve). The LayerZero OFT wrapper wraps this token, so it must be deployed first. Deploy on Polygon (you have POL gas) or PulseChain (requires PLS gas). After deploying, save the address as the PULSE_TOKEN_CONTRACT secret.
      </p>

      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground">Chain:</span>
        <div className="inline-flex rounded-lg border border-border p-0.5">
          {['polygon', 'pulse'].map((c) => (
            <button
              key={c}
              onClick={() => setChain(c)}
              className={`rounded-md px-3 py-1 text-xs font-semibold capitalize transition-colors ${chain === c ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-secondary'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {current.address ? (
        <div className="mb-4 space-y-2">
          <ContractAddressRow
            label={`PulseToken (${chain})`}
            address={current.address}
            secret="PULSE_TOKEN_CONTRACT"
            explorerUrl={current.explorerUrl}
            txHash={current.txHash}
            deployedAt={current.deployedAt}
            copied={copied === `pulse-token-${chain}`}
            onCopy={() => copy(`pulse-token-${chain}`, current.address)}
            isNew={!!result?.address && chain === result?.chain}
          />
        </div>
      ) : (
        <p className="mb-4 rounded-lg bg-secondary/60 p-3 text-xs text-muted-foreground">
          Not yet deployed on {chain}.
        </p>
      )}

      <button
        onClick={deploy}
        disabled={deploying}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {deploying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
        {deploying ? 'Deploying…' : `Deploy on ${chain}`}
      </button>

      {result?.address && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="font-semibold">Deployment successful — address saved automatically.</p>
        </div>
      )}

      {result?.nextSteps?.length > 0 && result?.address && (
        <div className="mt-3 rounded-lg bg-secondary p-3 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">Next steps</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {result.nextSteps.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
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

function ContractAddressRow({ label, address, secret, explorerUrl, txHash, deployedAt, copied, onCopy, isNew }) {
  return (
    <div className={`flex items-center justify-between gap-2 rounded-lg border p-3 ${isNew ? 'border-success/30 bg-success/5' : 'border-border bg-secondary/50'}`}>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="truncate font-mono text-xs">{address}</p>
        {secret && (
          <p className="mt-0.5 text-[10px] text-primary/80">Secret: <code className="font-mono">{secret}</code></p>
        )}
        {deployedAt && (
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Deployed {new Date(deployedAt).toLocaleString()}
          </p>
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