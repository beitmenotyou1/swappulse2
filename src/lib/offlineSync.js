// Offline outbox for collection writes - §8 Background Sync.
// Queues create/update/delete/bulkUpdate when offline and replays them when
// connectivity returns (window 'online' event + service-worker 'sync').
import { base44 } from '@/api/base44Client';
import { idbGetAll, idbPut, idbDelete, idbGet } from '@/lib/offlineDB';

export function isOnline() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

async function registerSync() {
  try {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    if (reg.sync && 'sync' in reg) await reg.sync.register('collection-sync');
  } catch {
    /* Background Sync not supported - window 'online' listener still replays */
  }
}

async function queue(op, payload) {
  const key = `${op}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await idbPut('outbox', key, { op, ...payload });
  await registerSync();
}

export async function createEntry(data) {
  if (isOnline()) {
    try {
      return await base44.entities.CollectionEntry.create(data);
    } catch {
      /* fall through to queue */
    }
  }
  await queue('create', { data });
  return { ...data, _pending: true };
}

export async function updateEntry(id, data) {
  if (isOnline()) {
    try {
      return await base44.entities.CollectionEntry.update(id, data);
    } catch {
      /* fall through to queue */
    }
  }
  await queue('update', { id, data });
}

export async function deleteEntry(id) {
  if (isOnline()) {
    try {
      return await base44.entities.CollectionEntry.delete(id);
    } catch {
      /* fall through to queue */
    }
  }
  await queue('delete', { id });
}

export async function bulkUpdateEntries(updates) {
  if (isOnline()) {
    try {
      return await base44.entities.CollectionEntry.bulkUpdate(updates);
    } catch {
      /* fall through to queue */
    }
  }
  await queue('bulkUpdate', { updates });
}

export async function replayOutbox() {
  if (!isOnline()) return { replayed: 0, remaining: 0 };
  const items = await idbGetAll('outbox');
  if (!items.length) return { replayed: 0, remaining: 0 };
  let ok = 0;
  let remaining = 0;
  for (const it of items) {
    try {
      if (it.op === 'create') await base44.entities.CollectionEntry.create(it.data);
      else if (it.op === 'update') await base44.entities.CollectionEntry.update(it.id, it.data);
      else if (it.op === 'delete') await base44.entities.CollectionEntry.delete(it.id);
      else if (it.op === 'bulkUpdate') await base44.entities.CollectionEntry.bulkUpdate(it.updates);
      await idbDelete('outbox', it.key);
      ok++;
    } catch {
      remaining++;
    }
  }
  return { replayed: ok, remaining };
}

export async function outboxCount() {
  return (await idbGetAll('outbox')).length;
}