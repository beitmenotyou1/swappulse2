# SwapPulse API Documentation

## Overview

SwapPulse's backend is built on Base44 backend functions. All endpoints are invoked through the Base44 SDK — there are no raw HTTP endpoints to call directly.

## Invocation Pattern

From the frontend, invoke functions via the pre-initialized SDK:

```javascript
import { base44 } from '@/api/base44Client';

const response = await base44.functions.invoke('functionName', {
  param1: 'value',
  param2: 123,
});
// Response is an Axios response object — your data is in response.data
const data = response.data;
```

From other backend functions, use `createClientFromRequest(req)`:

```typescript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  // ...
}
```

## Authentication

All authenticated endpoints require a valid Base44 session token (managed automatically by the SDK). Public endpoints (browsing cards, sets, trades) do not require auth.

---

## Card Catalogue API

### get-cards
Retrieve paginated card catalogue with filters.

```javascript
await base44.functions.invoke('get-cards', {
  page: 1,
  perPage: 24,
  setId: 'sv4',       // optional
  rarity: 'Rare',     // optional
  lang: 'en',         // optional (default: en)
  search: 'Charizard' // optional
});
```

**Response:**
```json
{
  "cards": [
    {
      "card_id": "sv4-001",
      "name": "Sprigatito",
      "image": "https://cdn.tcgdex.net/...",
      "rarity": "Common",
      "set_id": "sv4",
      "set_name": "Paradox Rift"
    }
  ],
  "total": 284,
  "page": 1,
  "perPage": 24
}
```

### get-card-detail
Retrieve detailed card information with pricing and localised metadata.

```javascript
await base44.functions.invoke('get-card-detail', {
  cardId: 'sv4-001',
  lang: 'en'
});
```

### get-sets
Retrieve all TCG sets with localisation.

```javascript
await base44.functions.invoke('get-sets', { lang: 'en' });
```

### search-cards
Full-text search across the card catalogue.

```javascript
await base44.functions.invoke('search-cards', {
  query: 'Charizard',
  lang: 'en',
  limit: 10
});
```

### get-pricing
Retrieve current and historical pricing for a card.

```javascript
await base44.functions.invoke('get-pricing', {
  cardId: 'sv4-001',
  days: 90
});
```

### card-metadata-localized
Retrieve localised ERC-721/ERC-1155 NFT metadata for a card.

```javascript
await base44.functions.invoke('card-metadata-localized', {
  cardId: 'sv4-001',
  variant: 'normal',
  lang: 'en'
});
```

---

## Wallet API

### get-wallet-balance
Retrieve the user's fiat and crypto balances.

```javascript
await base44.functions.invoke('get-wallet-balance', {});
```

**Response:**
```json
{
  "balance": {
    "fiat_cents": 5000,
    "usdc_wei": "1000000",
    "currency": "GBP"
  }
}
```

### execute-conversion
Convert between fiat and crypto (fiat→crypto, crypto→crypto, USDC→fiat).

```javascript
await base44.functions.invoke('execute-conversion', {
  mode: 'fiat_to_crypto',
  fiat_cents: 5000,
  target_token: '0x...', // or 'PULSE' sentinel
  currency: 'GBP'
});
```

### send-crypto
Send USDC or PULSE to an address or username.

```javascript
await base44.functions.invoke('send-crypto', {
  toAddress: '0x...',
  amount: '1000000', // USDC base units
  asset: 'USDC'
});
```

### cross-chain-transfer
Bridge $PULSE between PulseChain and Polygon via LayerZero.

```javascript
await base44.functions.invoke('cross-chain-transfer', {
  action: 'transfer',
  fromChain: 'pulse',
  toChain: 'polygon',
  toAddress: '0x...',
  amount: '1000000000000000000' // wei
});
```

### initiate-unbridge
Port an NFT asset back from one chain to the other.

```javascript
await base44.functions.invoke('initiate-unbridge', {
  assetId: 'on-chain-asset-id'
});
```

---

## Trading API

### create-escrow-trade
Create a new escrow-protected trade.

### confirm-escrow-receipt
Confirm receipt of a traded card (releases escrow).

### resolve-escrow-dispute
Resolve a trade dispute (admin/moderation).

### matchWishlistListings
Find trade listings matching a user's wishlist.

---

## Social API

### get-follow-feed
Retrieve the authenticated user's follow feed.

### get-explore-feed
Retrieve the explore/discover feed.

### get-author-feed
Retrieve posts by a specific author.

### notify-interaction
Send a notification when a user interacts (like, repost, comment).

---

## NFT / Minting API

### mint-card
Mint a card NFT on Polygon (and auto-bridge to PulseChain).

```javascript
await base44.functions.invoke('mint-card', {
  cardId: 'sv4-001',
  variant: 'normal',
  verificationLevel: 1
});
```

### mint-username
Mint a username NFT (soulbound identity).

### bulk-mint-cards
Batch mint multiple card NFTs.

### get-on-chain-assets
Retrieve a user's on-chain NFT assets.

### get-wallet-nfts
Retrieve NFTs in a user's wallet.

---

## Sync / Admin API

### sync-tcgdex-catalog
Incremental TCGDex catalogue sync (admin only).

### trigger-sync
Manually trigger a sync job (admin only).

### deploy-polygon-contracts
Deploy smart contracts to Polygon (admin only).

### admin-metrics
Retrieve platform admin metrics (admin only).

---

## Real-Time Events

SwapPulse uses Base44's entity subscriptions for real-time updates:

```javascript
useEffect(() => {
  const unsubscribe = base44.entities.Notification.subscribe((event) => {
    if (event.type === 'create') {
      // New notification received
    }
  });
  return unsubscribe;
}, []);
```

**Event types:** `create`, `update`, `delete`

---

## Rate Limits

- Auth endpoints: 5 attempts per minute
- API endpoints: 100 requests per minute per user
- Sync functions: 1 concurrent run per function

---

## Error Handling

All functions return errors in a consistent format:

```json
{
  "error": "Human-readable error message",
  "details": "Optional additional context"
}
```

HTTP status codes:
- `200` — Success
- `400` — Bad request (validation error)
- `401` — Unauthorized
- `403` — Forbidden (insufficient permissions)
- `404` — Not found
- `500` — Internal server error

---

Last Updated: 2026-08-26