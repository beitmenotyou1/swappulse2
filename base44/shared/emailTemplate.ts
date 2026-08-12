// SwapPulse branded HTML email template — Midnight Vault dark theme.
// All CSS is inline (email-client-safe). No <style> tags, no external stylesheets.
// Exports buildBrandedHtml() and buildPlainText().

const COLORS = {
  bg: '#1a1f2e',
  card: '#212638',
  cardHover: '#283048',
  primary: '#6d4aff',
  primaryHover: '#7c5fff',
  gold: '#fbbf24',
  text: '#f1f5f9',
  muted: '#94a3b8',
  border: '#374151',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
};

// Inline SVG icons (24x24, stroke-based, lucide-style)
const ICONS: Record<string, string> = {
  collection: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${COLORS.primary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/></svg>`,
  scanner: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${COLORS.primary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></svg>`,
  feed: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${COLORS.primary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.16 5-1 5-1"/></svg>`,
  trade: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${COLORS.primary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M21 3l-7 7"/><path d="M3 3l7 7"/><path d="M8 21H3v-5"/><path d="M16 21h5v-5"/><path d="M3 21l7-7"/><path d="M21 21l-7-7"/></svg>`,
  binder: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${COLORS.primary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>`,
  market: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${COLORS.primary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>`,
  journal: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${COLORS.primary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M9 7h6"/><path d="M9 11h6"/></svg>`,
  meetup: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${COLORS.primary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`,
  live: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${COLORS.primary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 10.5a8 8 0 0 1 15 0"/><path d="M2 13a12 12 0 0 1 20 0"/><circle cx="12" cy="18" r="2"/></svg>`,
  warning: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${COLORS.danger}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/></svg>`,
  shield: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${COLORS.primary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.5 6.5-2.5C13.5 2.5 16 4 18 4a1 1 0 0 1 1 1z"/></svg>`,
  sparkles: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${COLORS.gold}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.5 5L5 9.5 10.5 11 12 16l1.5-5L19 9.5 13.5 8 12 3Z"/><path d="M5 20v-3M3.5 18.5h3M19 20v-3M17.5 18.5h3"/></svg>`,
};

function icon(name: string): string {
  return ICONS[name] || ICONS.sparkles;
}

function esc(s: string): string {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface BrandedEmailInput {
  subject: string;
  preheader: string;
  bodyHtml: string;
  ctaLink?: string;
  ctaLabel?: string;
  accentColor?: string;
  footerReason: string;
}

export function buildBrandedHtml(input: BrandedEmailInput): string {
  const accent = input.accentColor || COLORS.primary;
  const ctaHtml = input.ctaLink && input.ctaLabel
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;"><tr><td align="center">
         <a href="${esc(input.ctaLink)}" style="display:inline-block;background:${COLORS.primary};color:#ffffff;font-family:Inter,system-ui,sans-serif;font-size:16px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:8px;letter-spacing:0.3px;">${esc(input.ctaLabel)}</a>
       </td></tr></table>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>${esc(input.subject)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:Inter,system-ui,-apple-system,sans-serif;color:${COLORS.text};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(input.preheader)}</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};padding:24px 12px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${COLORS.card};border-radius:16px;overflow:hidden;border:1px solid ${COLORS.border};">
        <!-- Header -->
        <tr>
          <td style="padding:32px 40px 0;text-align:center;">
            <div style="font-size:26px;font-weight:800;letter-spacing:-0.5px;color:${COLORS.text};">
              Swap<span style="color:${COLORS.primary};">Pulse</span>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 40px 0;">
            <div style="height:4px;border-radius:2px;background:linear-gradient(90deg,${COLORS.primary},${COLORS.gold});"></div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:28px 40px 8px;border-left:4px solid ${accent};">
            ${input.bodyHtml}
          </td>
        </tr>
        <!-- CTA -->
        <tr><td style="padding:0 40px;">${ctaHtml}</td></tr>
        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px 32px;border-top:1px solid ${COLORS.border};margin-top:20px;">
            <p style="margin:0 0 8px;font-size:13px;color:${COLORS.muted};line-height:1.6;">${esc(input.footerReason)}</p>
            <p style="margin:0 0 4px;font-size:13px;color:${COLORS.muted};">
              <a href="https://swappulse.org/settings" style="color:${COLORS.primary};text-decoration:none;">Email preferences</a>
              &nbsp;·&nbsp;
              <a href="https://swappulse.org/help" style="color:${COLORS.primary};text-decoration:none;">Help</a>
            </p>
            <p style="margin:12px 0 0;font-size:12px;color:${COLORS.muted};">SwapPulse Alpha · swappulse.org</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buildPlainText(subject: string, lines: string[], ctaLink?: string, ctaLabel?: string): string {
  const parts = [subject, '', ...lines];
  if (ctaLink && ctaLabel) parts.push('', ctaLabel + ':', ctaLink);
  parts.push('', 'SwapPulse Alpha · swappulse.org');
  return parts.join('\n');
}

// Helper: render a step card (numbered, with icon)
export function stepCard(num: number, iconName: string, title: string, desc: string, link?: string): string {
  const linkHtml = link
    ? `<a href="${esc(link)}" style="color:${COLORS.primary};font-size:14px;font-weight:600;text-decoration:none;">Open →</a>`
    : '';
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;background:${COLORS.cardHover};border-radius:12px;border:1px solid ${COLORS.border};">
      <tr>
        <td style="padding:18px 20px;vertical-align:top;width:56px;">
          <div style="width:44px;height:44px;border-radius:10px;background:${COLORS.primary}22;display:flex;align-items:center;justify-content:center;">
            ${icon(iconName)}
          </div>
        </td>
        <td style="padding:18px 20px 18px 4px;vertical-align:top;">
          <div style="font-size:11px;font-weight:700;color:${COLORS.gold};letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Step ${num}</div>
          <div style="font-size:16px;font-weight:700;color:${COLORS.text};margin-bottom:4px;">${esc(title)}</div>
          <div style="font-size:14px;color:${COLORS.muted};line-height:1.6;">${esc(desc)}</div>
          ${linkHtml ? `<div style="margin-top:8px;">${linkHtml}</div>` : ''}
        </td>
      </tr>
    </table>`;
}

// Helper: render a stat card row
export function statRow(stats: { label: string; value: string; icon?: string }[]): string {
  const cells = stats.map((s) => `
    <td style="padding:0 6px;vertical-align:top;width:${Math.floor(100 / stats.length)}%;">
      <div style="background:${COLORS.cardHover};border-radius:12px;border:1px solid ${COLORS.border};padding:18px 12px;text-align:center;">
        ${s.icon ? `<div style="margin-bottom:8px;">${icon(s.icon)}</div>` : ''}
        <div style="font-size:22px;font-weight:800;color:${COLORS.text};margin-bottom:2px;">${esc(s.value)}</div>
        <div style="font-size:12px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.5px;">${esc(s.label)}</div>
      </div>
    </td>`).join('');
  return `<table width="100%" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table>`;
}

// Helper: render a feature card (icon + title + desc)
export function featureCard(iconName: string, title: string, desc: string, link?: string): string {
  const linkHtml = link
    ? `<a href="${esc(link)}" style="color:${COLORS.primary};font-size:14px;font-weight:600;text-decoration:none;">Open →</a>`
    : '';
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;background:${COLORS.cardHover};border-radius:12px;border:1px solid ${COLORS.border};">
      <tr>
        <td style="padding:18px 20px;vertical-align:top;width:56px;">
          <div style="width:44px;height:44px;border-radius:10px;background:${COLORS.primary}22;display:flex;align-items:center;justify-content:center;">
            ${icon(iconName)}
          </div>
        </td>
        <td style="padding:18px 20px 18px 4px;vertical-align:top;">
          <div style="font-size:16px;font-weight:700;color:${COLORS.text};margin-bottom:4px;">${esc(title)}</div>
          <div style="font-size:14px;color:${COLORS.muted};line-height:1.6;">${esc(desc)}</div>
          ${linkHtml ? `<div style="margin-top:8px;">${linkHtml}</div>` : ''}
        </td>
      </tr>
    </table>`;
}

export { COLORS, icon, esc };