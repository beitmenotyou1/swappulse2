import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Dynamic ERC-721 metadata endpoint for SwapPulse username NFTs.
// Returns JSON metadata with an SVG image (logo + username + user details)
// that updates each time it's fetched — so when a collector edits their
// profile (display name, bio, etc.), the NFT metadata reflects the change.
// Called by wallets/marketplaces via the token's metadataURI, and by the
// frontend for the NFT preview.

const LOGO_URL =
  'https://media.base44.com/images/public/6a63d9d64a4d65d370c70892/2087a0265_a_transparent_version_of_the_socialpulse_logo_a_digital_pulse_line_forming_an_s1.png';

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function encodeBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function generateSvg(
  handle: string,
  displayName: string,
  bio: string,
  memberSince: string,
): string {
  const h = escapeXml(handle);
  const name = escapeXml(displayName);
  const bioShort = escapeXml(bio ? bio.slice(0, 80) : 'SwapPulse Collector');
  const date = escapeXml(memberSince);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <rect width="600" height="600" fill="#000000"/>
  <image href="${LOGO_URL}" x="80" y="100" width="440" height="440" preserveAspectRatio="xMidYMid meet" opacity="0.85"/>
  <defs>
    <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="bg" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="600" height="130" fill="url(#tg)"/>
  <text x="300" y="75" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="44" font-weight="800" fill="#FFD700">@${h}</text>
  <rect x="0" y="460" width="600" height="140" fill="url(#bg)"/>
  <text x="300" y="510" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="600" fill="#FFFFFF">${name}</text>
  <text x="300" y="545" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="15" fill="#9CA3AF">${bioShort}</text>
  <text x="300" y="578" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="13" fill="#6B7280">SwapPulse Member since ${date}</text>
</svg>`;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);

    let did = url.searchParams.get('did');
    if (!did) {
      const body = await req.json().catch(() => ({}));
      did = body.did;
    }
    if (!did) return Response.json({ error: 'Missing did parameter' }, { status: 400 });

    // Look up the username NFT
    const assets = await base44.asServiceRole.entities.OnChainAsset.filter({
      owner_did: did,
      asset_type: 'username',
    });
    if (!assets.length) {
      return Response.json({ error: 'No username NFT found for this DID' }, { status: 404 });
    }
    const asset = assets[0];

    // Fetch current user profile details (dynamic — changes with profile edits)
    const users = await base44.asServiceRole.entities.User.filter({ 'data.did': did }).catch(() => []);
    const user = users[0];

    // Fetch ProfileConfig for bio (RLS-restricted, so service role needed)
    const profiles = await base44.asServiceRole.entities.ProfileConfig.filter({ did }).catch(() => []);
    const profile = profiles[0];

    const handle = asset.handle || user?.bsky_handles || user?.username || '';
    const displayName = user?.data?.display_name || user?.full_name || handle;
    const bio = profile?.bio || user?.data?.description || '';
    const bioShort = bio ? bio.slice(0, 80) : 'SwapPulse Collector';
    const createdDate = user?.created_date || asset.minted_at;
    const memberSince = new Date(createdDate).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    const svg = generateSvg(handle, displayName, bioShort, memberSince);
    const imageDataUri = `data:image/svg+xml;base64,${encodeBase64(svg)}`;

    const metadata = {
      name: `@${handle}`,
      description: `${displayName} — SwapPulse Username NFT (Soulbound)`,
      image: imageDataUri,
      external_url: `https://swap-pulse-hub.base44.app/u/${handle}`,
      attributes: [
        { trait_type: 'Handle', value: `@${handle}` },
        { trait_type: 'Display Name', value: displayName },
        { trait_type: 'DID', value: did },
        { trait_type: 'Member Since', value: memberSince },
        { trait_type: 'Soulbound', value: 'true' },
        { trait_type: 'Platform', value: 'SwapPulse' },
        ...(bio ? [{ trait_type: 'Bio', value: bio.slice(0, 200) }] : []),
        ...(profile?.location ? [{ trait_type: 'Location', value: profile.location }] : []),
        ...(profile?.pronouns ? [{ trait_type: 'Pronouns', value: profile.pronouns }] : []),
      ],
    };

    return Response.json(metadata, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error) {
    return Response.json(
      { error: error.message },
      {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
      },
    );
  }
}