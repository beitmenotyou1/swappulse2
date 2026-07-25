// §13 Appendix - canonical record interfaces (documentation only).
// These mirror the AT-Protocol lexicons and Base44 entity schemas already in use.
// Entity persistence is handled by the Base44 SDK; these types describe the shapes.

export type CollectionEntryRecord = {
  $type: 'org.swappulse.collectionEntry';
  cardUri: string; // AT Protocol URI / TCGDex card id
  condition: 'mint' | 'near_mint' | 'excellent' | 'good' | 'damaged';
  variant: 'normal' | 'holo' | 'reverse_holo';
  setCode: string;
  cardNumber: string;
  pokemonName: string;
  rarity: string;
  acquisitionDate: string; // ISO 8601 date
  purchasePrice: number; // pence (GBP) - see CardPricing for source
  marketValue: number; // pence
  notes?: string; // max 500 chars
  imageUrl?: string;
  showcased?: boolean;
  binderIndex?: number;
};

export type TradeListingRecord = {
  $type: 'org.swappulse.tradeListing';
  offerCardUris: string[]; // min 1, max 50
  wantedCardUris: string[]; // min 1, max 50
  status: 'open' | 'negotiating' | 'pending_ship' | 'completed' | 'cancelled';
  visibility: 'public' | 'wishlist_only';
  negotiationBlobRef?: string; // CID of encrypted negotiation
  shippingRegions: string[]; // e.g. ['UK', 'EU', 'NA']
  preferredCurrency?: 'GBP' | 'EUR' | 'USD';
  notes?: string; // max 500 chars
};

export type TradeNegotiationRecord = {
  $type: 'org.swappulse.tradeNegotiation';
  tradeId: string;
  body: string; // max 1000 chars
  authorDid: string;
  authorName?: string;
  authorHandle?: string;
};

export type FeedResponse = {
  feed: Array<{
    post: string; // AT Protocol URI
    reason?: string;
    feedContext?: string;
  }>;
  cursor?: string; // pagination token
};