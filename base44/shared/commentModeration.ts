// Shared auto-moderation rules for comments (Post records with reply_to / card_id).
// Used by the autoModerateComment backend function. Kept in shared/ so future
// backend functions (e.g. a workflow step) can reuse the same rule set.

export interface CommentRuleResult {
  label: string;
  severity: 'inform' | 'warn' | 'hide';
  reason: string;
  confidence: number;
  ruleName: string;
}

// Scam / spam patterns — case-insensitive
const SCAM_PATTERN = /(send.{0,20}(cash|paypal|venmo|zelle|crypto|btc|eth)|free.{0,10}(cards|packs|giveaway)|dm.{0,10}(me|us).{0,10}(deal|offer|cheap)|wholesale|bulk.{0,10}(lot|discount))/i;

// 11+ identical characters in a row
const REPEATED_CHARS = /(.)\1{10,}/;

// External link detection
const URL_PATTERN = /https?:\/\/[^\s]+/gi;
const ALLOWED_DOMAINS = [
  'swappulse.org', 'tcgdex.net', 'tcgplayer.com', 'cardmarket.com',
  'psacard.com', 'beckett.com', 'cgccards.com', 'acegrading.com',
  'youtube.com', 'twitch.tv', 'imgur.com',
];

// Rate limit: max comments per user per window
export const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
export const RATE_LIMIT_MAX = 10; // 10 per minute

export function evaluateCommentRules(text: string): CommentRuleResult[] {
  const results: CommentRuleResult[] = [];

  // 1. Scam pattern
  if (SCAM_PATTERN.test(text)) {
    results.push({
      label: 'scam-suspected',
      severity: 'hide',
      reason: 'Matches known scam / spam pattern',
      confidence: 0.9,
      ruleName: 'scam-pattern',
    });
  }

  // 2. Repeated characters (spam)
  if (REPEATED_CHARS.test(text)) {
    results.push({
      label: 'low-effort',
      severity: 'inform',
      reason: 'Excessive repeated characters',
      confidence: 0.7,
      ruleName: 'repeated-chars',
    });
  }

  // 3. External link check
  const urls = text.match(URL_PATTERN) || [];
  for (const url of urls) {
    try {
      const hostname = new URL(url).hostname;
      const isAllowed = ALLOWED_DOMAINS.some((d) => hostname.includes(d));
      if (!isAllowed) {
        results.push({
          label: 'external-link',
          severity: 'warn',
          reason: `External link to ${hostname}`,
          confidence: 0.8,
          ruleName: 'link-block',
        });
        break;
      }
    } catch {
      // Invalid URL — flag it
      results.push({
        label: 'external-link',
        severity: 'warn',
        reason: 'Unrecognised link format',
        confidence: 0.6,
        ruleName: 'link-block',
      });
      break;
    }
  }

  return results;
}

export function severityForLabel(label: string): 'inform' | 'warn' | 'hide' {
  switch (label) {
    case 'scam-suspected':
      return 'hide';
    case 'external-link':
      return 'warn';
    case 'low-effort':
      return 'inform';
    default:
      return 'inform';
  }
}

// Check if a moderation_labels array contains a hide-severity label
export function hasHideLabel(labels: any[] | null | undefined): boolean {
  if (!Array.isArray(labels)) return false;
  return labels.some((l) => l?.severity === 'hide');
}