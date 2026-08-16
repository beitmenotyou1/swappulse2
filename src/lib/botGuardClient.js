// Client-side bot-protection wrapper. Exposes withBotGuard() which gates any
// write action behind the server-side botGuard: it calls check-bot-risk, and
// only proceeds with the action when allowed. If a challenge is required, the
// BotChallengeProvider (mounted in Layout) opens the 'verify you're human'
// modal, obtains a captcha/behavioural token, and retries the check. If the
// action is blocked, a BotBlockError is thrown for the caller to surface.
//
// The provider registers itself via setBotChallengeAPI on mount. If no
// provider is mounted (e.g. on a public page), withBotGuard skips the check
// and runs the action directly so writes never break.

import { base44 } from '@/api/base44Client';

export class BotBlockError extends Error {
  constructor(actionType, reasons) {
    super('Action blocked — please try again later.');
    this.name = 'BotBlockError';
    this.actionType = actionType;
    this.reasons = reasons || [];
  }
}

let challengeAPI = null;

export function setBotChallengeAPI(api) {
  challengeAPI = api;
}

// Gate a write action. Usage:
//   const created = await withBotGuard('post', text, () => base44.entities.Post.create(...));
export async function withBotGuard(actionType, content, performWrite) {
  if (challengeAPI) {
    await challengeAPI.ensureAllowed(actionType, content || '');
  }
  return performWrite();
}

// Pre-flight only (no write to wrap). Resolves true if allowed, throws BotBlockError if blocked.
export async function ensureBotAllowed(actionType, content) {
  if (challengeAPI) {
    await challengeAPI.ensureAllowed(actionType, content || '');
  }
  return true;
}

export function isBotBlockError(e) {
  return e && e.name === 'BotBlockError';
}

// Direct check (used by the provider).
export async function checkBotRiskServer(actionType, content, token) {
  const payload = { actionType, content };
  if (token) {
    if (token.captchaToken) payload.captchaToken = token.captchaToken;
    if (token.challengeToken) payload.challengeToken = token.challengeToken;
  }
  const res = await base44.functions.invoke('check-bot-risk', payload);
  return res.data;
}