// §9 Real-Time Update System - central event bus over the platform's entity
// realtime subscriptions, with heartbeat, exponential-backoff reconnect,
// REST catch-up on reconnect, and visibility-driven connect/disconnect.
import { base44 } from '@/api/base44Client';

const HEARTBEAT_MS = 30000;
const BACKOFF = [1000, 2000, 4000, 8000, 16000, 30000];
const TRACKED = ['Post', 'TradeListing', 'CardPricing', 'Reputation', 'TradeMessage', 'Wishlist', 'VoiceSpace', 'SpaceParticipant', 'PodcastEpisode', 'ExternalActivity', 'Notification', 'Like', 'Repost', 'Reaction', 'Follow', 'Story', 'DirectMessage', 'Conversation'];

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
    sub('VoiceSpace', (e) => {
      if (e.type === 'create') this.emit('space.new', e.data);
      if (e.type === 'update') {
        if (e.data.status === 'live') this.emit('space.started', e.data);
        if (e.data.status === 'ended' || e.data.status === 'cancelled') this.emit('space.ended', e.data);
      }
    });
    sub('SpaceParticipant', (e) => {
      if (e.type === 'create' || e.type === 'update') this.emit('space.participant_update', e.data);
    });
    sub('PodcastEpisode', (e) => {
      if (e.type === 'create') this.emit('podcast.new', e.data);
    });
    sub('ExternalActivity', (e) => {
      if (e.type === 'create' || e.type === 'update') {
        if (e.data.is_live) this.emit('presence.external_live', e.data);
        else this.emit('presence.external_offline', e.data);
      }
    });
    sub('Notification', (e) => {
      if (e.type === 'create') this.emit('notification.new', e.data);
    });
    sub('Like', (e) => {
      if (e.type === 'create') this.emit('interaction.like', e.data);
    });
    sub('Repost', (e) => {
      if (e.type === 'create') this.emit('interaction.repost', e.data);
    });
    sub('Reaction', (e) => {
      if (e.type === 'create') this.emit('interaction.reaction', e.data);
    });
    sub('Follow', (e) => {
      if (e.type === 'create') this.emit('interaction.follow', e.data);
    });
    sub('Story', (e) => {
      if (e.type === 'create') this.emit('story.new', e.data);
    });
    sub('DirectMessage', (e) => {
      if (e.type === 'create') this.emit('dm.new', e.data);
    });
    sub('Conversation', (e) => {
      if (e.type === 'create' || e.type === 'update') this.emit('dm.conversation_update', e.data);
    });
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
    await Promise.all([
      diff('Post', (it) => this.emit(it.post_type === 'pack_opening' ? 'feed.new_pull' : 'feed.new_post', it)),
      diff('TradeListing', (it) => { this.emit('trade.new_listing', it); this.checkMatch(it); }),
      diff('CardPricing', (it) => { this.emit('market.price_update', it); this.checkPriceAlert(it); }),
      diff('Reputation', (it) => this.emit('profile.reputation_update', it)),
      diff('TradeMessage', (it) => this.emit('trade.message', it)),
      diff('VoiceSpace', (it) => { if (it.status === 'live') this.emit('space.started', it); if (it.status === 'ended' || it.status === 'cancelled') this.emit('space.ended', it); }),
      diff('SpaceParticipant', (it) => this.emit('space.participant_update', it)),
      diff('PodcastEpisode', (it) => this.emit('podcast.new', it)),
      diff('ExternalActivity', (it) => { if (it.is_live) this.emit('presence.external_live', it); else this.emit('presence.external_offline', it); }),
      diff('Notification', (it) => this.emit('notification.new', it)),
      diff('Like', (it) => this.emit('interaction.like', it)),
      diff('Repost', (it) => this.emit('interaction.repost', it)),
      diff('Reaction', (it) => this.emit('interaction.reaction', it)),
      diff('Follow', (it) => this.emit('interaction.follow', it)),
      diff('Story', (it) => this.emit('story.new', it)),
      diff('DirectMessage', (it) => this.emit('dm.new', it)),
      diff('Conversation', (it) => this.emit('dm.conversation_update', it)),
    ]);
  }

  checkMatch(listing) {
    if (!listing?.id || this.matchedListings.has(listing.id)) return;
    const hits = (listing.wanted_card_ids || []).filter((id) => this.wishlistCardIds.has(id));
    if (hits.length) {
      this.matchedListings.add(listing.id);
      this.emit('trade.match', { listing, matchedCardIds: hits });
      this.notifyForMe('trade_match', listing, () => ({
        actor_name: listing.author_name || 'A collector',
        actor_handle: listing.author_handle,
        actor_avatar: listing.author_avatar,
        target_type: 'trade',
        target_path: '/trades',
        target_label: (listing.offer_card_names && listing.offer_card_names[0]) || 'a trade listing',
      }));
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
      this.notifyForMe('price_alert', { card_id: id }, () => ({
        actor_name: 'SwapPulse',
        target_type: 'card',
        target_path: `/card/${id}`,
        target_label: 'A wishlist card',
        group_key: `price_${id}`,
      }));
    } else if (low > max && this.alertedCards.has(id)) {
      this.alertedCards.delete(id);
    }
  }

  async notifyForMe(action_type, source, build) {
    try {
      const me = await base44.auth.me();
      if (!me?.did) return;
      const fields = build ? build(me) : {};
      // Route through the server-side notify-system-event function so the
      // recipient's notification preferences (paused / who_filter / on_site_only)
      // are enforced before the Notification record is created or push sent.
      const res = await base44.functions.invoke('notify-system-event', {
        recipientDid: me.did,
        actionType: action_type,
        source,
        fields,
      }).catch(() => null);
      // The server creates the record; emit locally so the bell updates instantly
      // even if the realtime subscription hasn't fired yet.
      if (res?.data?.ok || res?.ok) {
        this.emit('notification.new', { did: me.did, action_type, ...fields });
      }
    } catch (e) {
      console.error('notifyForMe failed', e?.message || e);
    }
  }

  dispatchPush(action_type, rec, source) {
    const title = this.titleForType(action_type, rec);
    const body = rec.target_label || 'You have a new notification';
    const params = this.paramsForType(action_type, source, rec);
    const priority = (action_type === 'trade_match' || action_type === 'price_alert') ? 'high' : 'standard';
    base44.functions.invoke('send-notification', {
      recipientDid: rec.did,
      type: action_type,
      title,
      body,
      params,
      subjectUri: rec.source_uri,
      priority,
    }).catch((e) => console.error('dispatchPush failed', e?.message || e));
  }

  titleForType(action_type, rec) {
    const name = rec.actor_name || 'SwapPulse';
    switch (action_type) {
      case 'trade_match': return 'New Trade Match!';
      case 'price_alert': return 'Price Drop Alert';
      case 'pack_pull': return `${name} pulled a new card`;
      case 'reaction': return `${name} reacted to your post`;
      case 'mention': return `${name} mentioned you`;
      case 'follow': return `${name} started following you`;
      case 'voice_live': return `${name} is going live`;
      case 'podcast': return 'New podcast episode';
      case 'message': return 'New trade message';
      case 'reputation': return 'Your reputation updated';
      default: return 'SwapPulse';
    }
  }

  paramsForType(action_type, source, rec) {
    switch (action_type) {
      case 'trade_match':
        return { listingId: source?.id || '' };
      case 'price_alert':
        return { cardId: source?.card_id || rec?.card_id || '' };
      case 'pack_pull':
        return { authorDid: rec?.did || source?.did || '' };
      case 'follow':
        return { followerDid: source?.did || rec?.actor_did || '' };
      case 'voice_live':
        return { userDid: source?.did || rec?.actor_did || '' };
      case 'message':
        return { tradeId: source?.trade_id || source?.id || '' };
      default:
        return {};
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

// §9.2 Optimistic update helper - apply instantly, rollback on rejection.
export async function optimisticUpdate({ apply, commit, rollback }) {
  apply();
  try {
    return await commit();
  } catch (e) {
    if (rollback) rollback();
    throw e;
  }
}