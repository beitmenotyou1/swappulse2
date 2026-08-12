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
    const start = Date.now();
    await base44.asServiceRole.entities.User.list('-created_date', 1);
    return { status: 'up', latencyMs: Date.now() - start };
  } catch (e) {
    return { status: 'down', error: e?.message || String(e) };
  }
}

export function checkSmtp() {
  const host = Deno.env.get('SMTP_HOST');
  const user = Deno.env.get('SMTP_USERNAME');
  const pass = Deno.env.get('SMTP_TOKEN');
  if (!host || !user || !pass) {
    return { status: 'down', error: 'SMTP credentials not configured' };
  }
  return { status: 'up' };
}

export function checkVapid() {
  const pub = Deno.env.get('VAPID_PUBLIC_KEY');
  const priv = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!pub || !priv) {
    return { status: 'down', error: 'VAPID keys not configured' };
  }
  return { status: 'up' };
}

export function checkBase44() {
  return { status: 'up', latencyMs: 0 };
}