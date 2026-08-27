import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Fuel, Loader2, AlertCircle, CheckCircle2, Wallet, ExternalLink, Copy,
  Zap, RefreshCw,
} from 'lucide-react';

// Admin-only: shows the PulseChain treasury wallet's native PLS (gas) and
// ERC-20 PULSE token balances. If the treasury is low on gas, the admin can
// fund it directly from their MetaMask wallet — the transaction is pre-filled
// and just needs a confirmation click. After funding, an optional deferred
// action (mint, transfer, etc.) can auto-proceed.
export default function PulseTreasuryFundingSection({ pendingAction }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [funding, setFunding] = useState(false);
  const [fundResult, setFundResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [metaMaskAvailable, setMetaMaskAvailable] = useState(true);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('check-pulse-treasury-gas', {});
      setStatus(res.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to check treasury status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Check if MetaMask (window.ethereum) is available
  useEffect(() => {
    setMetaMaskAvailable(!!window.ethereum);
  }, []);

  const copyAddress = () => {
    if (status?.treasury_address) {
      navigator.clipboard.writeText(status.treasury_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  // Fund the treasury from the admin's MetaMask wallet. Sends native PLS to
  // the treasury address with a pre-filled value. The admin just confirms.
  const fundFromMetaMask = async () => {
    if (!window.ethereum) {
      setError('MetaMask or a Web3 wallet is not installed. Install MetaMask to fund the treasury.');
      return;
    }
    if (!status?.treasury_address || !status?.recommended_fund_wei) {
      setError('Treasury address or recommended amount not available.');
      return;
    }

    setFunding(true);
    setError('');
    setFundResult(null);

    try {
      // Request the admin's MetaMask account
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const from = accounts[0];

      // Ensure MetaMask is on the PulseChain network (chain ID from status)
      const targetChainId = status.chain_id ? `0x${status.chain_id.toString(16)}` : null;
      if (targetChainId) {
        const currentChain = await window.ethereum.request({ method: 'eth_chainId' }).catch(() => null);
        if (currentChain !== targetChainId) {
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: targetChainId }],
            });
          } catch (switchError) {
            // Chain not added to MetaMask (error 4902) — auto-add it via EIP-3085
            if (switchError.code === 4902 && status.network_params) {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [status.network_params],
              });
              // MetaMask auto-switches to the newly added chain
            } else {
              throw switchError;
            }
          }
        }
      }

      // Send the pre-filled transaction from the admin's MetaMask
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from,
          to: status.treasury_address,
          value: '0x' + BigInt(status.recommended_fund_wei).toString(16),
        }],
      });

      // Wait for the transaction to be mined, then verify on the backend
      setFundResult({ tx_hash: txHash, verifying: true });
      let attempts = 0;
      const maxAttempts = 12;
      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 5000));
        try {
          const res = await base44.functions.invoke('fund-pulse-treasury', {
            tx_hash: txHash,
            auto_proceed: pendingAction ? {
              function_name: pendingAction.function_name,
              payload: pendingAction.payload,
            } : undefined,
          });
          if (res.data?.verified) {
            setFundResult({ ...res.data, tx_hash: txHash, verifying: false });
            await fetchStatus();
            setFunding(false);
            return;
          }
        } catch (e) {
          // Tx might not be mined yet — keep polling
          const msg = e.response?.data?.error || e.message || '';
          if (msg.includes('not found') || msg.includes('pending')) {
            // keep polling
          } else {
            throw e;
          }
        }
        attempts++;
      }
      throw new Error('Transaction verification timed out. Check the tx on the explorer and try refreshing.');
    } catch (e) {
      if (e.code === 4001 || e.code === 'ACTION_REJECTED') {
        setError('Transaction rejected in MetaMask.');
      } else {
        setError(e.response?.data?.error || e.message || 'Funding failed');
      }
    } finally {
      setFunding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const needsFunding = status?.needs_funding;
  const explorerUrl = status?.treasury_address
    ? `https://explorer.pulsechain.com/address/${status.treasury_address}`
    : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Fuel className="h-5 w-5 text-primary" />
        <h3 className="font-bold">PulseChain Treasury Gas</h3>
        <button
          onClick={fetchStatus}
          className="ml-auto rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        The treasury wallet pays gas for all PulseChain actions (PULSE transfers, NFT mints, bridges). If it runs out of native PLS, fund it directly from your MetaMask wallet — no manual address copying needed.
      </p>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="whitespace-pre-wrap">{error}</p>
        </div>
      )}

      {/* Treasury address */}
      {status?.treasury_address && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/50 p-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground">Treasury Address</p>
            <p className="truncate font-mono text-xs">{status.treasury_address}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button onClick={copyAddress} className="rounded p-1.5 text-muted-foreground hover:bg-background hover:text-foreground" title="Copy address">
              {copied ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </button>
            {explorerUrl && (
              <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="rounded p-1.5 text-muted-foreground hover:bg-background hover:text-foreground" title="View on explorer">
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Balance cards */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className={`rounded-lg border p-3 ${needsFunding ? 'border-warning/40 bg-warning/5' : 'border-border bg-secondary/50'}`}>
          <div className="flex items-center gap-1.5">
            <Fuel className="h-4 w-4 text-warning" />
            <p className="text-xs font-semibold text-muted-foreground">Native PLS (Gas)</p>
          </div>
          <p className="mt-1 text-lg font-bold">{status?.native_balance_pls || '0'} <span className="text-xs font-normal text-muted-foreground">PLS</span></p>
          {needsFunding && (
            <p className="mt-0.5 text-[10px] font-semibold text-warning">⚠ Low — funding needed</p>
          )}
        </div>
        <div className="rounded-lg border border-border bg-secondary/50 p-3">
          <div className="flex items-center gap-1.5">
            <Wallet className="h-4 w-4 text-primary" />
            <p className="text-xs font-semibold text-muted-foreground">PULSE Token</p>
          </div>
          <p className="mt-1 text-lg font-bold">{status?.pulse_token_balance || '0'} <span className="text-xs font-normal text-muted-foreground">PULSE</span></p>
        </div>
      </div>

      {/* Funding action */}
      {needsFunding && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
          <div className="mb-3 flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div>
              <p className="text-sm font-semibold text-warning">Treasury needs gas funding</p>
              <p className="text-xs text-muted-foreground">
                Recommended: <span className="font-mono font-semibold">{status?.recommended_fund_pls} PLS</span> (~200 transactions worth of gas)
              </p>
            </div>
          </div>

          {!metaMaskAvailable ? (
            <p className="text-xs text-muted-foreground">
              MetaMask not detected. Install the MetaMask browser extension, or send PLS manually to the treasury address above.
            </p>
          ) : (
            <button
              onClick={fundFromMetaMask}
              disabled={funding}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {funding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {funding ? 'Funding…' : `Fund ${status?.recommended_fund_pls} PLS from MetaMask`}
            </button>
          )}

          {pendingAction && (
            <p className="mt-2 text-[10px] text-muted-foreground">
              After funding, the pending action ({pendingAction.label}) will proceed automatically.
            </p>
          )}
        </div>
      )}

      {/* Success result */}
      {fundResult?.verified && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Treasury funded successfully!</p>
            <p className="text-xs opacity-80">
              {fundResult.amount_funded_pls} PLS sent from {fundResult.funded_from?.slice(0, 8)}…
              Treasury now holds {fundResult.treasury_native_balance_pls} PLS.
            </p>
            {fundResult.proceed_result && !fundResult.proceed_result.error && (
              <p className="mt-1 text-xs font-semibold">✓ Pending action completed automatically.</p>
            )}
            {fundResult.proceed_result?.error && (
              <p className="mt-1 text-xs text-warning">Pending action failed: {fundResult.proceed_result.error}</p>
            )}
          </div>
        </div>
      )}

      {/* Verifying state */}
      {fundResult?.verifying && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <p>Verifying transaction on PulseChain…</p>
        </div>
      )}
    </div>
  );
}