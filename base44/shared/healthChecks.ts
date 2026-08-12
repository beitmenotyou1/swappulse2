import { fetchTcgdex } from './tcgdexClient.ts';

export async function checkTcgdex() {
  try {
    await fetchTcgdex('/sets', 'en');
    return { status: 'up' };
  } catch (e) {
    return { status: 'down', error: e?.message || String(e) };
  }
}

export async function checkDatabase(base44) {
  try {
    await base44.asServiceRole.entities.User.list('-created_date', 1);
    return { status: 'up' };
  } catch (e) {
    return { status: 'down', error: e?.message || String(e) };
  }
}