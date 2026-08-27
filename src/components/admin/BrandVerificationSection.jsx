import React, { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import {
  BadgeCheck, Loader2, AlertCircle, CheckCircle2, ExternalLink, Image as ImageIcon,
  Download, ShieldCheck, RefreshCw, Upload, FileCheck2, Link2,
} from 'lucide-react';

// Admin-only: Brand & Verification hub. Manages the official SwapPulse logo
// (SVG → PNG rasterisation for explorer submission), contract source
// verification on Polygonscan/Etherscan, and token profile enrichment
// (logo + website + Bluesky link).
//
// The logo PNG is generated client-side by rasterising the SVG onto a canvas
// (no native backend dependency), then uploaded via UploadFile so the URL
// can be passed to the explorer token-profile function.

const LOGO_SVG_URL = 'https://media.base44.com/images/public/6a63d9d64a4d65d370c70892/083cc4953_a_transparent_version_of_the_socialpulse_logo_a_digital_pulse_line_forming_an_s1.svg';

export default function BrandVerificationSection() {
  const [contracts, setContracts] = useState(null);
  const [loadingContracts, setLoadingContracts] = useState(true);
  const [pngUrl, setPngUrl] = useState('');
  const [generatingPng, setGeneratingPng] = useState(false);
  const [verifyResults, setVerifyResults] = useState({});
  const [verifying, setVerifying] = useState('');
  const [profileResult, setProfileResult] = useState(null);
  const [preparingProfile, setPreparingProfile] = useState('');
  const [error, setError] = useState('');

  const fetchContracts = useCallback(async () => {
    setLoadingContracts(true);
    try {
      const res = await base44.functions.invoke('get-contract-addresses', {});
      setContracts(res.data);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load contracts');
    } finally {
      setLoadingContracts(false);
    }
  }, []);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  // Rasterise the SVG logo to a 256×256 PNG via an offscreen canvas, then
  // upload it via UploadFile so we get a reusable URL for explorer submission.
  const generatePng = async () => {
    setGeneratingPng(true);
    setError('');
    try {
      // Load the SVG as an image, draw it onto a 256×256 canvas, export PNG.
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = LOGO_SVG_URL;
      });

      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 256, 256);
      ctx.drawImage(img, 0, 0, 256, 256);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
      if (!blob) throw new Error('Failed to rasterise logo');

      const file = new File([blob], 'swappulse-logo-256.png', { type: 'image/png' });
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      setPngUrl(uploadRes.file_url);
    } catch (e) {
      setError(e?.message || 'Failed to generate PNG from SVG');
    } finally {
      setGeneratingPng(false);
    }
  };

  const verifyContract = async (contractKey, chain) => {
    setVerifying(`${chain}:${contractKey}`);
    setError('');
    try {
      const res = await base44.functions.invoke('verify-contract', {
        contract_key: contractKey,
        chain,
      });
      setVerifyResults((prev) => ({ ...prev, [`${chain}:${contractKey}`]: res.data }));
    } catch (e) {
      setVerifyResults((prev) => ({
        ...prev,
        [`${chain}:${contractKey}`]: { status: 'failed', error: e?.response?.data?.error || e?.message },
      }));
    } finally {
      setVerifying('');
    }
  };

  const prepareProfile = async (chain) => {
    setPreparingProfile(chain);
    setError('');
    try {
      const res = await base44.functions.invoke('update-token-profile', {
        chain,
        png_url: pngUrl,
      });
      setProfileResult(res.data);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to prepare token profile');
    } finally {
      setPreparingProfile('');
    }
  };

  // Flatten all contracts into rows.
  const rows = [];
  if (contracts) {
    for (const chain of ['polygon', 'pulse']) {
      const chainData = contracts[chain] || {};
      for (const [key, val] of Object.entries(chainData)) {
        if (key === 'explorerUrl' || !val?.address) continue;
        rows.push({
          chain,
          contract_key: chain === 'polygon'
            ? (key === 'username' ? 'polygon_username' : key === 'card' ? 'polygon_card' : key === 'bridge' ? 'polygon_bridge' : key === 'oft' ? 'oft_polygon' : 'polygon_token')
            : (key === 'username' ? 'pulse_username' : key === 'card' ? 'pulse_card' : key === 'bridge' ? 'pulse_bridge' : key === 'oft' ? 'oft_pulse' : key === 'cardMetadataAnchor' ? 'card_metadata_anchor' : 'pulse_token'),
          label: `${chain === 'polygon' ? 'Polygon' : 'PulseChain'} · ${key}`,
          address: val.address,
          explorerUrl: val.explorerUrl,
        });
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Logo & PNG generation */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-primary" />
          <h3 className="font-bold">Official Logo & Explorer PNG</h3>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          The official SwapPulse logo (SVG) is used across all in-app token and blockchain surfaces. Generate a 256×256 PNG version for block-explorer token-profile submission.
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/50 p-3">
            <img src={LOGO_SVG_URL} alt="SwapPulse logo" className="h-12 w-12" />
            <div>
              <p className="text-xs font-semibold">SVG (in-app)</p>
              <p className="text-[10px] text-muted-foreground">Used in explorer, wallet, token cards</p>
            </div>
          </div>

          {pngUrl ? (
            <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 p-3">
              <img src={pngUrl} alt="PNG logo" className="h-12 w-12 rounded-lg" />
              <div>
                <p className="text-xs font-semibold text-success">PNG ready</p>
                <a href={pngUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary underline">
                  View URL
                </a>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-border p-3">
              <Download className="h-6 w-6 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">PNG not generated yet</p>
            </div>
          )}

          <button
            onClick={generatePng}
            disabled={generatingPng}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {generatingPng ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {generatingPng ? 'Generating…' : pngUrl ? 'Regenerate PNG' : 'Generate 256×256 PNG'}
          </button>
        </div>
      </div>

      {/* Contract verification table */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h3 className="font-bold">Contract Verification</h3>
          <button onClick={fetchContracts} className="ml-auto rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Refresh">
            <RefreshCw className={`h-4 w-4 ${loadingContracts ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Verify each deployed contract's source code on Polygonscan / Etherscan. Self-contained contracts (Polygon NFTs) are auto-verified; contracts with OpenZeppelin imports need manual submission via the explorer's "Verify & Publish" page.
        </p>

        {loadingContracts ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => {
              const resultKey = `${r.chain}:${r.contract_key}`;
              const result = verifyResults[resultKey];
              const isVerifying = verifying === resultKey;
              return (
                <div key={resultKey} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary/30 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold">{r.label}</p>
                    <a href={r.explorerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-primary">
                      {r.address.slice(0, 10)}…{r.address.slice(-6)} <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>

                  {result?.status === 'verified' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-1 text-[10px] font-bold text-success">
                      <CheckCircle2 className="h-3 w-3" /> Verified
                    </span>
                  )}
                  {result?.status === 'already_verified' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-1 text-[10px] font-bold text-success">
                      <BadgeCheck className="h-3 w-3" /> Already verified
                    </span>
                  )}
                  {result?.status === 'manual_required' && (
                    <a href={result.manual_verify_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-1 text-[10px] font-bold text-warning">
                      <ExternalLink className="h-3 w-3" /> Verify manually
                    </a>
                  )}
                  {result?.status === 'pending' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-1 text-[10px] font-bold text-warning">
                      <Loader2 className="h-3 w-3 animate-spin" /> Pending
                    </span>
                  )}
                  {result?.status === 'failed' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-1 text-[10px] font-bold text-destructive" title={result.error}>
                      <AlertCircle className="h-3 w-3" /> Failed
                    </span>
                  )}

                  <button
                    onClick={() => verifyContract(r.contract_key, r.chain)}
                    disabled={isVerifying}
                    className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1.5 text-[11px] font-semibold transition-colors hover:bg-secondary/70 disabled:opacity-50"
                  >
                    {isVerifying ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileCheck2 className="h-3 w-3" />}
                    {result?.status === 'verified' || result?.status === 'already_verified' ? 'Re-verify' : 'Verify'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {result?.status === 'failed' && verifyResults[Object.keys(verifyResults)[0]]?.error && (
          <div className="mt-3 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
            {Object.values(verifyResults).find((r) => r?.error)?.error}
          </div>
        )}
      </div>

      {/* Token profile enrichment */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" />
          <h3 className="font-bold">Token Profile (Logo + Website + Bluesky)</h3>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Prepare the $PULSE token profile metadata (official logo, website, Bluesky link) for Polygonscan / Etherscan. Etherscan doesn't expose a public API for token-profile updates, so this generates the pre-filled metadata + direct links to the explorer's token update page.
        </p>

        <div className="flex flex-wrap gap-2">
          {['polygon', 'pulse'].map((chain) => {
            const tokenAddr = contracts?.[chain]?.token?.address;
            if (!tokenAddr) return null;
            return (
              <button
                key={chain}
                onClick={() => prepareProfile(chain)}
                disabled={preparingProfile === chain}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {preparingProfile === chain ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Prepare {chain === 'polygon' ? 'Polygon' : 'PulseChain'} Profile
              </button>
            );
          })}
        </div>

        {!pngUrl && (
          <p className="mt-2 text-[10px] text-warning">
            ⚠ Generate the PNG logo first so it can be attached to the token profile.
          </p>
        )}

        {profileResult && (
          <div className="mt-4 space-y-3">
            <div className="rounded-lg bg-success/10 p-3 text-sm text-success">
              <p className="font-semibold">Token profile metadata ready for {profileResult.chain}</p>
              <p className="text-xs opacity-80">{profileResult.message}</p>
            </div>
            <div className="rounded-lg border border-border bg-secondary/50 p-3 text-xs">
              <p className="mb-1 font-semibold">Pre-filled metadata</p>
              <dl className="space-y-1">
                <div><dt className="inline text-muted-foreground">Token:</dt> <dd className="inline font-mono">{profileResult.profile.token_name} ({profileResult.profile.token_symbol})</dd></div>
                <div><dt className="inline text-muted-foreground">Website:</dt> <dd className="inline font-mono">{profileResult.profile.official_site_url}</dd></div>
                <div><dt className="inline text-muted-foreground">Bluesky:</dt> <dd className="inline font-mono">{profileResult.profile.social_links.bluesky || '(set SWAPPULSE_BLUESKY_HANDLE secret)'}</dd></div>
                <div><dt className="inline text-muted-foreground">Logo PNG:</dt> <dd className="inline font-mono">{profileResult.profile.logo_png_url || '(not generated)'}</dd></div>
              </dl>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={profileResult.token_profile_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary/90">
                <ExternalLink className="h-3 w-3" /> Open Token Profile Update
              </a>
              <a href={profileResult.token_page_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-secondary px-3 py-2 text-xs font-semibold hover:bg-secondary/70">
                <ExternalLink className="h-3 w-3" /> View Token Page
              </a>
              {profileResult.profile.logo_png_url && (
                <a href={profileResult.profile.logo_png_url} download="swappulse-logo-256.png" className="inline-flex items-center gap-1 rounded-lg bg-secondary px-3 py-2 text-xs font-semibold hover:bg-secondary/70">
                  <Download className="h-3 w-3" /> Download Logo PNG
                </a>
              )}
            </div>
            <div className="rounded-lg bg-secondary p-3 text-[11px] text-muted-foreground">
              <p className="mb-1 font-semibold text-foreground">Steps</p>
              <ol className="list-inside list-decimal space-y-0.5">
                {profileResult.instructions?.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="whitespace-pre-wrap">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}