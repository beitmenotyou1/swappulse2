// update-token-profile — admin-only: prepares the off-chain token profile
// metadata (official logo PNG, website, Bluesky link, description) for the
// $PULSE token on Polygonscan / Etherscan. Etherscan does not expose a public
// API for token-profile updates (logo + social links) — these are submitted
// via the explorer's "Update Token Info" web form. This function returns the
// pre-filled metadata + direct links to the token profile update page so the
// admin can complete the submission in one click.
//
// The logo PNG is generated client-side (canvas rasterisation of the SVG) and
// uploaded via UploadFile before calling this function; the resulting URL is
// passed in as `png_url`.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { resolveDeployedAddress } from '../../shared/contractRegistry.ts';
import { getExplorerSiteBase } from '../../shared/contractSources.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { chain, png_url } = body;
    if (!chain) {
      return Response.json({ error: 'chain is required' }, { status: 400 });
    }

    // Resolve the token contract address from the registry.
    const svc = base44.asServiceRole;
    const tokenKey = chain === 'polygon' ? 'polygon_token' : 'pulse_token';
    const address = await resolveDeployedAddress(svc, tokenKey);
    if (!address) {
      return Response.json({ error: `$PULSE token not deployed on ${chain} yet` }, { status: 400 });
    }

    const blueskyHandle = secrets.get('SWAPPULSE_BLUESKY_HANDLE') || '';
    const website = 'https://swap-pulse-hub.base44.app';
    const explorerSite = getExplorerSiteBase(chain, secrets.get('PULSE_EXPLORER_URL') || '');

    // Etherscan/Polygonscan token profile update URL.
    // The admin uploads the logo PNG and fills in the social links on this page.
    const tokenProfileUrl = `${explorerSite}/token/${address}#profileUpdate`;
    const tokenPageUrl = `${explorerSite}/token/${address}`;

    const profile = {
      token_name: 'PulseToken',
      token_symbol: 'PULSE',
      official_site_url: website,
      social_links: {
        bluesky: blueskyHandle ? `https://bsky.app/profile/${blueskyHandle}` : '',
      },
      description: 'SwapPulse — the decentralized social platform for Pokémon TCG collectors. $PULSE is the governance and utility token powering usage-mining rewards, trade escrow, and community governance.',
      logo_png_url: png_url || '',
    };

    return Response.json({
      status: 'ready',
      chain,
      address,
      profile,
      token_profile_url: tokenProfileUrl,
      token_page_url: tokenPageUrl,
      message: 'Token profile metadata prepared. Open the Polygonscan/Etherscan token page and click "Update Token Info" to upload the logo PNG and paste the website + Bluesky link below.',
      instructions: [
        `1. Download the logo PNG from: ${png_url || '(generate it first)'}`,
        `2. Open: ${tokenProfileUrl}`,
        '3. Upload the PNG as the token icon',
        `4. Set website to: ${website}`,
        `5. Set Bluesky to: ${profile.social_links.bluesky || '(set SWAPPULSE_BLUESKY_HANDLE secret first)'}`,
        `6. Set description to: ${profile.description}`,
      ],
    });
  } catch (error: any) {
    console.error('update-token-profile error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}