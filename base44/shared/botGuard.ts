// botGuard.ts — shared bot-protection guard for SwapPulse. Imported by
// write-handling backend functions and used by the check-bot-risk pre-flight
// function. Computes a bot-risk verdict from behavioural heuristics and
// per-action rate limits, issues/verifies in-flow 'verify you're human'
// challenges (Cloudflare Turnstile when configured, behavioural-timing
// fallback otherwise), and logs every flagged verdict to BotAttempt.
//
// Verdict shape: { allow, challengeRequired, block, riskScore, reasons,
//   challengeToken? }. Low risk passes silently; high risk returns a
// challenge (captcha required); severe risk or hard-rate-limit returns a
// block. Admins bypass entirely so ops are never locked out.

export interface BotVerdict {
  allow: boolean;
  challengeRequired: boolean;
  block: boolean;
  riskScore: number;
  reasons: string[];
  challengeToken?: string;
}

// Per-action rate limits: soft = trigger challenge, hard = block outright.
// Window is 60s for all; counts are per-subject within the window.
const WINDOW_MS = 60_000;
const RATE_LIMITS: Record<string, { soft: number; hard: number }> = {
  post:           { soft: 8,  hard: 25 },
  comment:        { soft: 12, hard: 35 },
  reply:          { soft: 12, hard: 35 },
  like:           { soft: 30, hard: 120 },
  repost:         { soft: 20, hard: 60 },
  reaction:       { soft: 30, hard: 120 },
  follow:         { soft: 20, hard: 60 },
  trade_message:  { soft: 10, hard: 30 },
  scan:           { soft: 20, hard: 60 },
  dm:             { soft: 15, hard: 40 },
  challenge_entry:{ soft: 5,  hard: 15 },
  meetup_rsvp:    { soft: 10, hard: 30 },
  binder_edit:    { soft: 20, hard: 60 },
  story:          { soft: 5,  hard: 15 },
  login_code:     { soft: 5,  hard: 12 },
  register:       { soft: 3,  hard: 6 },
  default:        { soft: 15, hard: 45 },
};

const CHALLENGE_THRESHOLD = 45;
const BLOCK_THRESHOLD = 80;
const BLOCK_DURATION_MS = 15 * 60 * 1000;
const CHALLENGE_MIN_HUMAN_MS = 1200;
const CHALLENGE_MAX_AGE_MS = 5 * 60 * 1000;
const MAX_CONSECUTIVE_FAILURES = 3;

function hashIp(ip: string): string {
  if (!ip) return '';
  let h = 0;
  for (let i = 0; i < ip.length; i++) h = ((h << 5) - h + ip.charCodeAt(i)) | 0;
  return 'h' + (h >>> 0).toString(16);
}

function getClientIp(req: Request): string {
  const h = req.headers;
  return (h.get('x-forwarded-for') || '').split(',')[0].trim()
    || h.get('x-real-ip') || '';
}

function isBotLikeUA(ua: string): boolean {
  const l = (ua || '').toLowerCase();
  if (!l) return true;
  const sigs = ['bot', 'crawler', 'spider', 'headless', 'phantom', 'puppeteer', 'selenium', 'webdriver', 'curl', 'wget', 'python-requests', 'node-fetch', 'go-http-client', 'libwww', 'scraper'];
  return sigs.some(s => l.includes(s));
}

function makeToken(): string {
  const bytes = crypto.getRandomValues(new Uint32Array(2));
  return Array.from(bytes).map(n => n.toString(36)).join('') + Date.now().toString(36);
}

function subjectKey(user: any, anonId?: string): string {
  if (user?.id) return user.id;
  return anonId ? ('anon:' + anonId) : 'anon:unknown';
}

export async function checkBotRisk(svc: any, opts: {
  user: any;
  actionType: string;
  content?: string;
  req: Request;
  captchaToken?: string;
  challengeToken?: string;
  anonId?: string;
  turnstileSecret?: string;
}): Promise<BotVerdict> {
  const { user, actionType, content, req, captchaToken, challengeToken, anonId, turnstileSecret } = opts;
  const reasons: string[] = [];
  let riskScore = 0;

  // Admins bypass — never lock out ops.
  if (user?.role === 'admin') {
    return { allow: true, challengeRequired: false, block: false, riskScore: 0, reasons: [] };
  }

  const userId = subjectKey(user, anonId);
  const did = user?.did || '';
  const ip = getClientIp(req);
  const ipHash = hashIp(ip);
  const ua = req.headers.get('user-agent') || '';

  // Load or create BotRiskState.
  let state: any = null;
  try {
    const existing = await svc.entities.BotRiskState.filter({ user_id: userId }, '-updated_date', 1).catch(() => []);
    state = existing?.[0] || null;
  } catch (e) {
    console.error('botGuard: load state failed', e?.message || e);
  }
  if (!state) {
    try {
      state = await svc.entities.BotRiskState.create({
        user_id: userId, did, risk_score: 0, challenges_passed: 0,
        challenges_failed: 0, action_count: 0,
        action_window_start: new Date().toISOString(), flagged_count: 0,
      });
    } catch (e) {
      console.error('botGuard: create state failed', e?.message || e);
    }
  }

  // Active block window.
  if (state?.blocked_until) {
    const until = new Date(state.blocked_until).getTime();
    if (Date.now() < until) {
      await logAttempt(svc, { userId, did, actionType, riskScore: 100, reasons: ['blocked_window'], ipHash, outcome: 'blocked' });
      return { allow: false, challengeRequired: false, block: true, riskScore: 100, reasons: ['blocked_window'] };
    }
  }

  // Challenge verification path (captcha or behavioural token supplied).
  if (captchaToken || challengeToken) {
    const verified = await verifyChallenge(svc, state, { captchaToken, challengeToken, turnstileSecret });
    if (verified.ok) {
      try {
        await svc.entities.BotRiskState.update(state.id, {
          pending_challenge_token: '',
          pending_challenge_at: '',
          challenges_passed: (state.challenges_passed || 0) + 1,
          risk_score: Math.max(0, (state.risk_score || 0) - 15),
          flagged_count: 0,
          last_challenge_at: new Date().toISOString(),
        });
      } catch {}
      await logAttempt(svc, { userId, did, actionType, riskScore: 0, reasons: ['challenge_passed'], ipHash, outcome: 'challenge_passed' });
      return { allow: true, challengeRequired: false, block: false, riskScore: 0, reasons: ['challenge_passed'] };
    } else {
      const newFail = (state.challenges_failed || 0) + 1;
      const shouldBlock = newFail >= MAX_CONSECUTIVE_FAILURES;
      try {
        await svc.entities.BotRiskState.update(state.id, {
          pending_challenge_token: '',
          challenges_failed: newFail,
          risk_score: Math.min(100, (state.risk_score || 0) + 20),
          blocked_until: shouldBlock ? new Date(Date.now() + BLOCK_DURATION_MS).toISOString() : (state.blocked_until || ''),
          last_challenge_at: new Date().toISOString(),
        });
      } catch {}
      await logAttempt(svc, { userId, did, actionType, riskScore: 70, reasons: ['challenge_failed'], ipHash, outcome: 'challenge_failed' });
      return { allow: false, challengeRequired: !shouldBlock, block: shouldBlock, riskScore: 70, reasons: ['challenge_failed'] };
    }
  }

  // Rate limit check (rolling window).
  const lim = RATE_LIMITS[actionType] || RATE_LIMITS.default;
  const now = Date.now();
  let count = state?.action_count || 0;
  let windowStart = state?.action_window_start ? new Date(state.action_window_start).getTime() : now;
  if (now - windowStart > WINDOW_MS) {
    count = 0;
    windowStart = now;
  }
  count += 1;
  try {
    await svc.entities.BotRiskState.update(state.id, {
      action_count: count,
      action_window_start: new Date(windowStart).toISOString(),
      last_action_at: new Date(now).toISOString(),
    });
  } catch {}

  if (count > lim.hard) {
    reasons.push('rate_hard_' + actionType);
    await escalateBlock(svc, state);
    await logAttempt(svc, { userId, did, actionType, riskScore: 90, reasons, ipHash, outcome: 'blocked' });
    return { allow: false, challengeRequired: false, block: true, riskScore: 90, reasons };
  }
  if (count > lim.soft) {
    reasons.push('rate_soft_' + actionType);
    riskScore = Math.max(riskScore, 55);
  }

  // Heuristics.
  if (isBotLikeUA(ua)) {
    reasons.push('bot_ua');
    riskScore = Math.max(riskScore, 85);
  }
  const acctAgeMs = user?.created_date ? (now - new Date(user.created_date).getTime()) : 0;
  if (user && acctAgeMs < 10 * 60 * 1000 && count > 3) {
    reasons.push('new_account_burst');
    riskScore = Math.max(riskScore, 60);
  }
  if (content && content.length > 0) {
    const lower = content.toLowerCase();
    const words = lower.split(/\s+/).filter(Boolean);
    if (words.length > 4) {
      const ratio = new Set(words).size / words.length;
      if (ratio < 0.4) { reasons.push('low_diversity'); riskScore = Math.max(riskScore, 50); }
    }
    const linkCount = (lower.match(/https?:\/\//g) || []).length;
    if (linkCount >= 3) { reasons.push('many_links'); riskScore = Math.max(riskScore, 45); }
  }
  if (state?.challenges_failed > 0) {
    reasons.push('prior_failures');
    riskScore = Math.max(riskScore, 30 + (state.challenges_failed * 10));
  }
  riskScore = Math.max(riskScore, state?.risk_score || 0);

  // Decide.
  if (riskScore >= BLOCK_THRESHOLD) {
    await escalateBlock(svc, state);
    await logAttempt(svc, { userId, did, actionType, riskScore, reasons, ipHash, outcome: 'blocked' });
    return { allow: false, challengeRequired: false, block: true, riskScore, reasons };
  }
  if (riskScore >= CHALLENGE_THRESHOLD) {
    const token = await issueChallenge(svc, state);
    await logAttempt(svc, { userId, did, actionType, riskScore, reasons, ipHash, outcome: 'challenged' });
    return { allow: false, challengeRequired: true, block: false, riskScore, reasons, challengeToken: token };
  }

  if (riskScore >= 30) {
    await logAttempt(svc, { userId, did, actionType, riskScore, reasons, ipHash, outcome: 'allowed' });
  }
  return { allow: true, challengeRequired: false, block: false, riskScore, reasons };
}

async function escalateBlock(svc: any, state: any): Promise<void> {
  if (!state) return;
  try {
    await svc.entities.BotRiskState.update(state.id, {
      blocked_until: new Date(Date.now() + BLOCK_DURATION_MS).toISOString(),
      flagged_count: (state.flagged_count || 0) + 1,
      risk_score: Math.min(100, (state.risk_score || 0) + 25),
    });
  } catch (e) {
    console.error('botGuard: escalateBlock failed', e?.message || e);
  }
}

async function issueChallenge(svc: any, state: any): Promise<string> {
  const token = makeToken();
  if (!state) return token;
  try {
    await svc.entities.BotRiskState.update(state.id, {
      pending_challenge_token: token,
      pending_challenge_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('botGuard: issueChallenge failed', e?.message || e);
  }
  return token;
}

async function verifyChallenge(svc: any, state: any, opts: { captchaToken?: string; challengeToken?: string; turnstileSecret?: string }): Promise<{ ok: boolean }> {
  if (!state) return { ok: false };
  const { captchaToken, challengeToken, turnstileSecret } = opts;

  // Real captcha (Cloudflare Turnstile) when configured.
  if (captchaToken && turnstileSecret) {
    try {
      const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: turnstileSecret, response: captchaToken }),
      });
      const data: any = await res.json();
      return { ok: !!data.success };
    } catch (e) {
      console.error('botGuard: turnstile verify failed', e?.message || e);
      return { ok: false };
    }
  }

  // Behavioural fallback: validate the issued single-use token + human timing.
  if (challengeToken && state.pending_challenge_token) {
    if (challengeToken !== state.pending_challenge_token) return { ok: false };
    const issuedAt = state.pending_challenge_at ? new Date(state.pending_challenge_at).getTime() : 0;
    const elapsed = Date.now() - issuedAt;
    if (elapsed < CHALLENGE_MIN_HUMAN_MS) return { ok: false };
    if (elapsed > CHALLENGE_MAX_AGE_MS) return { ok: false };
    return { ok: true };
  }
  return { ok: false };
}

async function logAttempt(svc: any, opts: { userId: string; did: string; actionType: string; riskScore: number; reasons: string[]; ipHash: string; outcome: string }): Promise<void> {
  try {
    await svc.entities.BotAttempt.create({
      user_id: opts.userId.startsWith('anon:') ? '' : opts.userId,
      anon_id: opts.userId.startsWith('anon:') ? opts.userId : '',
      did: opts.did,
      action_type: opts.actionType,
      risk_score: opts.riskScore,
      reasons: opts.reasons || [],
      ip_hash: opts.ipHash,
      outcome: opts.outcome,
    });
  } catch (e) {
    console.error('botGuard: logAttempt failed', e?.message || e);
  }
}