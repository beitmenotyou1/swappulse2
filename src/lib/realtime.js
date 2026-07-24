// §9 Real-Time Update System — central event bus over the platform's entity
// realtime subscriptions, with heartbeat, exponential-backoff reconnect,
// REST catch-up on reconnect, and visibility-driven connect/disconnect.
import { base44 } from '@/api/base44Client';

const HEARTBEAT_MS = 30000;
const BACKOFF = [1000, 2000, 4000, 8000, 16000, 30000];
const TRACKED = ['Post', 'TradeListing', 'CardPricing', 'Reputation', 'TradeMessage', 'Wishlist'];

class RealTimeManager {
  constructor() {
    this.handlers = new Map();
    this.unsubs = [];
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    this.backoffIndex = 0;
    this.connected = false;
    this.connecting = false;
    this.firstConnect = true;
    this.wishlistCardIds = new Set();
    this.wishlistMaxPrices = new Map();
    this.knownIds = Object.fromEntries(TRACKED.map((n) => [n, new Set()]));
    this.alertedCards = new Set();
    this.matchedListings = new Set();
  }

  on(eventType, handler) {
    if (!this.handlers.has(eventType)) this.handlers.set(eventType, new Set());
    this.handlers.get(eventType).add(handler);
    return () => this.handlers.get(eventType)?.delete(handler);
  }

  emit(eventType, payload) {
    (this.handlers.get(eventType) || new Set()).forEach((h) => {
      try { h(payload); } catch {}
    });
  }

  async loadWishlist() {
    try {
      const items = await base44.entities.Wishlist.list('-created_date', 200);
      this.wishlistCardIds = new Set(items.map((i) => i.card_id).filter(Boolean));
      this.wishlistMaxPrices = new Map(
        items.filter((i) => i.max_price && i.card_id).map((i) => [i.card_id, i.max_price])
      );
      items.forEach((i) => this.knownIds.Wishlist.add(i.id));
    } catch {}
  }

  async connect() {
    if (this.connecting || this.connected) return;
    this.connecting = true;
    try {
      await this.loadWishlist();
      if (this.firstConnect) {
        await this.seedKnownIds();
        this.firstConnect = false;
      } else {
        await this.catchUpEmit();
      }
      this.subscribeEntities();
      this.startHeartbeat();
      this.connected = true;
      this.backoffIndex = 0;
      this.emit('_connected', {});
    } catch {
      this.scheduleReconnect();
    } finally {
      this.connecting = false;
    }
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.unsubs.forEach((u) => { try { u(); } catch {} });
    this.unsubs = [];
    this.connected = false;
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = BACKOFF[Math.min(this.backoffIndex, BACKOFF.length - 1)];
    this.backoffIndex++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.disconnect();
      this.connect();
    }, delay);
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(async () => {
      try {
        await base44.auth.me();
      } catch {
        this.scheduleReconnect();
      }
    }, HEARTBEAT_MS);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
  }

  subscribeEntities() {
    const sub = (entity, fn) => {
      const u = base44.entities[entity].subscribe((event) => {
        if (event.data?.id) this.knownIds[entity].add(event.data.id);
        fn(event);
      });
      this.unsubs.push(u);
    };
    sub('Post', (e) => {
      if (e.type === 'create') this.emit(e.data.post_type === 'pack_opening' ? 'feed.new_pull' : 'feed.new_post', e.data);
    });
    sub('TradeListing', (e) => {
      if (e.type === 'create') { this.emit('trade.new_listing', e.data); this.checkMatch(e.data); }
      if (e.type === 'update') this.emit('trade.status_update', e.data);
    });
    sub('CardPricing', (e) => {
      if (e.type === 'update') { this.emit('market.price_update', e.data); this.checkPriceAlert(e.data); }
    });
    sub('Reputation', (e) => {
      if (e.type === 'create' || e.type === 'update') this.emit('profile.reputation_update', e.data);
    });
    sub('TradeMessage', (e) => {
      if (e.type === 'create') this.emit('trade.message', e.data);
    });
    sub('Wishlist', () => { this.loadWishlist(); });
  }

  async seedKnownIds() {
    await Promise.all(TRACKED.map(async (entity) => {
      try {
        const items = await base44.entities[entity].list('-created_date', 50);
        items.forEach((i) => this.knownIds[entity].add(i.id));
      } catch {}
    }));
  }

  async catchUpEmit() {
    const diff = async (entity, mapper) => {
      try {
        const items = await base44.entities[entity].list('-created_date', 50);
        for (const it of items) {
          if (this.knownIds[entity].has(it.id)) continue;
          this.knownIds[entity].add(it.id);
          mapper(it);
        }
      } catch {}
    };
    await diff('Post', (it) => this.emit(it.post_type === 'pack_opening' ? 'feed.new_pull' : 'feed.new_post', it));
    await diff('TradeListing', (it) => { this.emit('trade.new_listing', it); this.checkMatch(it); });
    await diff('CardPricing', (it) => { this.emit('market.price_update', it); this.checkPriceAlert(it); });
    await diff('Reputation', (it) => this.emit('profile.reputation_update', it));
    await diff('TradeMessage', (it) => this.emit('trade.message', it));
  }

  checkMatch(listing) {
    if (!listing?.id || this.matchedListings.has(listing.id)) return;
    const hits = (listing.wanted_card_ids || []).filter((id) => this.wishlistCardIds.has(id));
    if (hits.length) {
      this.matchedListings.add(listing.id);
      this.emit('trade.match', { listing, matchedCardIds: hits });
    }
  }

  checkPriceAlert(pricing) {
    const id = pricing.card_id;
    if (!id || !this.wishlistCardIds.has(id)) return;
    const max = this.wishlistMaxPrices.get(id);
    const low = pricing.low ?? pricing.avg;
    if (!max || low == null) return;
    if (low <= max && !this.alertedCards.has(id)) {
      this.alertedCards.add(id);
      this.emit('market.price_alert', { card_id: id, price: low, max });
    } else if (low > max && this.alertedCards.has(id)) {
      this.alertedCards.delete(id);
    }
  }
}

export const rt = new RealTimeManager();

export function initRealtime() {
  rt.connect();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) rt.disconnect();
    else rt.connect();
  });
  window.addEventListener('online', () => rt.connect());
  window.addEventListener('offline', () => rt.disconnect());
}

// §9.2 Optimistic update helper — apply instantly, rollback on rejection.
export async function optimisticUpdate({ apply, commit, rollback }) {
  apply();
  try {
    return await commit();
  } catch (e) {
    if (rollback) rollback();
    throw e;
  }
}