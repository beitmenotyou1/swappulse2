// Content builders for all 6 SwapPulse email types.
// Each returns { subject, html, text } — html is full branded HTML, text is plain-text alternative.
// All builders accept an optional locale so system emails render in the
// recipient's preferred language. Card data (names, set names) is never
// translated — cards always render in their native TCGDex language.
import { buildBrandedHtml, buildPlainText, stepCard, featureCard, statRow, COLORS, esc } from './emailTemplate.ts';
import { normalizeEmailLocale, t as tt } from './emailI18n.ts';
export { COLORS, esc };
export { normalizeEmailLocale } from './emailI18n.ts';

const APP_URL = 'https://swappulse.org';

// 1. Activation link email (send-activation)
export function buildActivationEmail(name: string, link: string, locale?: string) {
  const L = normalizeEmailLocale(locale);
  const heading = tt(L, 'activation.heading');
  const body = tt(L, 'activation.body', { name: name || 'collector' });
  const codeHint = tt(L, 'activation.code_hint');
  const subject = tt(L, 'activation.subject');
  const preheader = tt(L, 'activation.preheader');
  const cta = tt(L, 'activation.cta');
  const footer = tt(L, 'activation.footer');
  const bodyHtml = `
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:800;color:${COLORS.text};">${esc(heading)}</h1>
    <p style="margin:0 0 16px;font-size:15px;color:${COLORS.muted};line-height:1.7;">
      ${esc(body)}
    </p>
    <p style="margin:0 0 8px;font-size:14px;color:${COLORS.muted};line-height:1.7;">
      ${esc(codeHint)}
    </p>`;
  return {
    subject,
    html: buildBrandedHtml({
      subject,
      preheader,
      bodyHtml,
      ctaLink: link,
      ctaLabel: cta,
      accentColor: COLORS.primary,
      footerReason: footer,
    }),
    text: buildPlainText(
      subject,
      [
        `${heading}, ${name || 'collector'}!`,
        '',
        body,
        link,
        '',
        codeHint,
        '',
        footer,
      ],
    ),
  };
}

// 2. Activation warning email (activation-lifecycle)
export function buildActivationWarningEmail(name: string, link: string, locale?: string) {
  const L = normalizeEmailLocale(locale);
  const heading = tt(L, 'activation_warning.heading');
  const body = tt(L, 'activation_warning.body', { name: name || 'there' });
  const codeHint = tt(L, 'activation_warning.code_hint');
  const subject = tt(L, 'activation_warning.subject');
  const preheader = tt(L, 'activation_warning.preheader');
  const cta = tt(L, 'activation_warning.cta');
  const footer = tt(L, 'activation_warning.footer');
  const bodyHtml = `
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:800;color:${COLORS.danger};">${esc(heading)}</h1>
    <p style="margin:0 0 16px;font-size:15px;color:${COLORS.muted};line-height:1.7;">
      ${esc(body)}
    </p>
    <p style="margin:0 0 8px;font-size:14px;color:${COLORS.muted};line-height:1.7;">
      ${esc(codeHint)}
    </p>`;
  return {
    subject,
    html: buildBrandedHtml({
      subject,
      preheader,
      bodyHtml,
      ctaLink: link,
      ctaLabel: cta,
      accentColor: COLORS.danger,
      footerReason: footer,
    }),
    text: buildPlainText(
      subject,
      [
        body,
        '',
        link,
        '',
        codeHint,
        '',
        footer,
      ],
    ),
  };
}

// 3. Onboarding Day 1 — "Your first 3 steps"
export function buildDay1Email(name: string, locale?: string) {
  const L = normalizeEmailLocale(locale);
  const heading = tt(L, 'day1.heading');
  const body = tt(L, 'day1.body', { name: name || 'collector' });
  const subject = tt(L, 'day1.subject');
  const cta = tt(L, 'day1.cta');
  const footer = tt(L, 'day1.footer');
  const tip = tt(L, 'day1.tip');
  const bodyHtml = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:${COLORS.text};">${esc(heading)}</h1>
    <p style="margin:0 0 24px;font-size:15px;color:${COLORS.muted};line-height:1.7;">
      ${esc(body)}
    </p>
    ${stepCard(1, 'collection', tt(L, 'day1.step1_title'), tt(L, 'day1.step1_desc'), `${APP_URL}/collection`)}
    ${stepCard(2, 'scanner', tt(L, 'day1.step2_title'), tt(L, 'day1.step2_desc'), `${APP_URL}/scan`)}
    ${stepCard(3, 'feed', tt(L, 'day1.step3_title'), tt(L, 'day1.step3_desc'), `${APP_URL}/`)}
    <p style="margin:20px 0 0;font-size:14px;color:${COLORS.muted};line-height:1.7;">
      <strong style="color:${COLORS.gold};">${esc(L === 'en' ? 'Tip:' : '')}</strong> ${esc(tip)}
    </p>`;
  return {
    subject,
    html: buildBrandedHtml({
      subject,
      preheader: body,
      bodyHtml,
      ctaLink: `${APP_URL}/`,
      ctaLabel: cta,
      accentColor: COLORS.primary,
      footerReason: footer,
    }),
    text: buildPlainText(
      subject,
      [
        heading,
        '',
        body,
        '',
        `1. ${tt(L, 'day1.step1_title')}`,
        `   ${tt(L, 'day1.step1_desc')}`,
        `   -> ${APP_URL}/collection`,
        '',
        `2. ${tt(L, 'day1.step2_title')}`,
        `   ${tt(L, 'day1.step2_desc')}`,
        `   -> ${APP_URL}/scan`,
        '',
        `3. ${tt(L, 'day1.step3_title')}`,
        `   ${tt(L, 'day1.step3_desc')}`,
        `   -> ${APP_URL}/`,
        '',
        tip,
      ],
      `${APP_URL}/`,
      cta,
    ),
  };
}

// 4. Onboarding Day 3 — "Ready to trade?"
export function buildDay3Email(name: string, matches: number, locale?: string) {
  const L = normalizeEmailLocale(locale);
  const heading = tt(L, 'day3.heading');
  const body = tt(L, 'day3.body', { name: name || 'collector' });
  const subject = tt(L, 'day3.subject');
  const cta = tt(L, 'day3.cta');
  const footer = tt(L, 'day3.footer');
  const negotiate = tt(L, 'day3.negotiate');
  const matchLabel = tt(L, 'day3.match_found', { count: matches, plural: matches === 1 ? '' : 'es' });
  const matchHint = tt(L, 'day3.match_hint');
  const banner = matches > 0
    ? `<div style="margin-bottom:20px;padding:14px 18px;border-radius:10px;background:${COLORS.gold}22;border:1px solid ${COLORS.gold}55;">
         <div style="font-size:14px;color:${COLORS.gold};font-weight:600;">${esc(matchLabel)}</div>
         <div style="font-size:13px;color:${COLORS.muted};margin-top:2px;">${esc(matchHint)}</div>
       </div>`
    : '';
  const bodyHtml = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:${COLORS.text};">${esc(heading)}</h1>
    <p style="margin:0 0 24px;font-size:15px;color:${COLORS.muted};line-height:1.7;">
      ${esc(body)}
    </p>
    ${banner}
    ${featureCard('trade', tt(L, 'day3.f1_title'), tt(L, 'day3.f1_desc'), `${APP_URL}/trades`)}
    ${featureCard('binder', tt(L, 'day3.f2_title'), tt(L, 'day3.f2_desc'), `${APP_URL}/binders`)}
    <p style="margin:20px 0 0;font-size:14px;color:${COLORS.muted};line-height:1.7;">
      ${esc(negotiate)}
    </p>`;
  return {
    subject,
    html: buildBrandedHtml({
      subject,
      preheader: matches > 0 ? matchLabel : body,
      bodyHtml,
      ctaLink: `${APP_URL}/trades`,
      ctaLabel: cta,
      accentColor: COLORS.primary,
      footerReason: footer,
    }),
    text: buildPlainText(
      subject,
      [
        `${heading}, ${name || 'collector'}`,
        '',
        body,
        ...(matches > 0 ? ['', matchLabel, matchHint] : []),
        '',
        tt(L, 'day3.f1_title'),
        `  ${tt(L, 'day3.f1_desc')}`,
        `  -> ${APP_URL}/trades`,
        '',
        tt(L, 'day3.f2_title'),
        `  ${tt(L, 'day3.f2_desc')}`,
        `  -> ${APP_URL}/binders`,
        '',
        negotiate,
      ],
      `${APP_URL}/trades`,
      cta,
    ),
  };
}

// 5. Onboarding Day 7 — "Level up"
export function buildDay7Email(name: string, locale?: string) {
  const L = normalizeEmailLocale(locale);
  const heading = tt(L, 'day7.heading');
  const body = tt(L, 'day7.body', { name: name || 'collector' });
  const subject = tt(L, 'day7.subject');
  const cta = tt(L, 'day7.cta');
  const footer = tt(L, 'day7.footer');
  const bonus = tt(L, 'day7.bonus');
  const bodyHtml = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:${COLORS.text};">${esc(heading)}</h1>
    <p style="margin:0 0 24px;font-size:15px;color:${COLORS.muted};line-height:1.7;">
      ${esc(body)}
    </p>
    ${featureCard('market', tt(L, 'day7.f1_title'), tt(L, 'day7.f1_desc'), `${APP_URL}/market`)}
    ${featureCard('journal', tt(L, 'day7.f2_title'), tt(L, 'day7.f2_desc'), `${APP_URL}/profile`)}
    ${featureCard('meetup', tt(L, 'day7.f3_title'), tt(L, 'day7.f3_desc'), `${APP_URL}/meetups`)}
    ${featureCard('live', tt(L, 'day7.f4_title'), tt(L, 'day7.f4_desc'), `${APP_URL}/spaces`)}
    <p style="margin:20px 0 0;font-size:14px;color:${COLORS.muted};line-height:1.7;">
      <strong style="color:${COLORS.gold};">${esc(L === 'en' ? 'Bonus:' : '')}</strong> ${esc(bonus)}
    </p>`;
  return {
    subject,
    html: buildBrandedHtml({
      subject,
      preheader: body,
      bodyHtml,
      ctaLink: `${APP_URL}/`,
      ctaLabel: cta,
      accentColor: COLORS.gold,
      footerReason: footer,
    }),
    text: buildPlainText(
      subject,
      [
        `${heading}, ${name || 'collector'}`,
        '',
        body,
        '',
        tt(L, 'day7.f1_title'),
        `  ${tt(L, 'day7.f1_desc')}`,
        `  -> ${APP_URL}/market`,
        '',
        tt(L, 'day7.f2_title'),
        `  ${tt(L, 'day7.f2_desc')}`,
        `  -> ${APP_URL}/profile`,
        '',
        tt(L, 'day7.f3_title'),
        `  ${tt(L, 'day7.f3_desc')}`,
        `  -> ${APP_URL}/meetups`,
        '',
        tt(L, 'day7.f4_title'),
        `  ${tt(L, 'day7.f4_desc')}`,
        `  -> ${APP_URL}/spaces`,
        '',
        bonus,
      ],
      `${APP_URL}/`,
      cta,
    ),
  };
}

// 7. Donation thank-you email (stripe-webhook / nowpayments-ipn)
export function buildDonationThankYouEmail(amount: number, currency: string, method: string, donorName: string, locale?: string) {
  const L = normalizeEmailLocale(locale);
  const cur = currency.toUpperCase();
  const symbol = cur === 'GBP' ? '£' : cur === 'USD' ? '$' : '€';
  const amt = `${symbol}${Number(amount).toFixed(2)}`;
  const methodLabel = method === 'card' ? tt(L, 'donation.method_card') : tt(L, 'donation.method_crypto');
  const heading = tt(L, 'donation.heading');
  const body = tt(L, 'donation.body', { name: donorName || 'collector', method: methodLabel, amount: amt });
  const body2 = tt(L, 'donation.body2');
  const subject = tt(L, 'donation.subject');
  const cta = tt(L, 'donation.cta');
  const footer = tt(L, 'donation.footer');
  const bodyHtml = `
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:800;color:${COLORS.text};">${esc(heading)}</h1>
    <p style="margin:0 0 16px;font-size:15px;color:${COLORS.muted};line-height:1.7;">
      ${esc(body)}
    </p>
    <p style="margin:0 0 8px;font-size:14px;color:${COLORS.muted};line-height:1.7;">
      ${esc(body2)}
    </p>`;
  return {
    subject,
    html: buildBrandedHtml({
      subject,
      preheader: `${body} ${amt}`,
      bodyHtml,
      ctaLink: `${APP_URL}/`,
      ctaLabel: cta,
      accentColor: COLORS.gold,
      footerReason: footer,
    }),
    text: buildPlainText(
      subject,
      [
        body,
        '',
        body2,
        '',
        footer,
      ],
      `${APP_URL}/`,
      cta,
    ),
  };
}

// Admin alert email — urgent branded variant for admin-only notifications.
// Reuses buildBrandedHtml with a danger/red accent, an "ADMIN ALERT" pill
// badge, a warning-triangle icon, and a red top border on the card.
export function buildAdminAlertEmail(opts: {
  subject: string;
  preheader: string;
  heading: string;
  bodyHtml: string;
  ctaLink?: string;
  ctaLabel?: string;
  footerReason: string;
}) {
  const badge = `<div style="display:inline-block;padding:5px 14px;border-radius:999px;background:${COLORS.danger}22;border:1px solid ${COLORS.danger};font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${COLORS.danger};margin-bottom:16px;">&#9888; Admin Alert</div>`;
  const warnIcon = `<div style="margin-bottom:14px;">${icon('warning')}</div>`;
  const headingHtml = `<h1 style="margin:0 0 16px;font-size:24px;font-weight:800;color:${COLORS.text};">${esc(opts.heading)}</h1>`;
  const bodyHtml = `${badge}${warnIcon}${headingHtml}${opts.bodyHtml}`;
  const subject = `[ADMIN ALERT] ${opts.subject}`;
  return {
    subject,
    html: buildBrandedHtml({
      subject,
      preheader: opts.preheader,
      bodyHtml,
      ctaLink: opts.ctaLink,
      ctaLabel: opts.ctaLabel,
      accentColor: COLORS.danger,
      topBorderColor: COLORS.danger,
      footerReason: opts.footerReason,
    }),
    text: `[ADMIN ALERT] ${opts.subject}\n\n${buildPlainText(opts.subject, [opts.heading, '', opts.preheader], opts.ctaLink, opts.ctaLabel)}`,
  };
}

// 6. Weekly Digest
export function buildWeeklyDigestEmail(name: string, stats: {
  cardCount: number;
  portfolioValue: string;
  openTrades: number;
  recentCards: { name: string; setValue: string }[];
  wishlist: { name: string; maxPrice?: string }[];
}, locale?: string) {
  const L = normalizeEmailLocale(locale);
  const heading = tt(L, 'digest.heading');
  const body = tt(L, 'digest.body', { name: name || 'collector' });
  const subject = tt(L, 'digest.subject');
  const cta = tt(L, 'digest.cta');
  const footer = tt(L, 'digest.footer');
  const recentHeading = tt(L, 'digest.recent_heading');
  const wishHeading = tt(L, 'digest.wishlist_heading');
  const noRecent = tt(L, 'digest.no_recent');
  const noWish = tt(L, 'digest.no_wishlist');
  const recentHtml = stats.recentCards.length > 0
    ? stats.recentCards.map((c) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid ${COLORS.border};">
          <div style="font-size:14px;font-weight:600;color:${COLORS.text};">${esc(c.name)}</div>
          <div style="font-size:12px;color:${COLORS.muted};">${esc(c.setValue)}</div>
        </td>
      </tr>`).join('')
    : `<tr><td style="padding:12px 0;font-size:14px;color:${COLORS.muted};">${esc(noRecent)}</td></tr>`;

  const wishHtml = stats.wishlist.length > 0
    ? stats.wishlist.map((w) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid ${COLORS.border};">
          <div style="font-size:14px;font-weight:600;color:${COLORS.text};">${esc(w.name)}</div>
          ${w.maxPrice ? `<div style="font-size:12px;color:${COLORS.muted};">Max: ${esc(w.maxPrice)}</div>` : ''}
        </td>
      </tr>`).join('')
    : `<tr><td style="padding:12px 0;font-size:14px;color:${COLORS.muted};">${esc(noWish)}</td></tr>`;

  const bodyHtml = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:${COLORS.text};">${esc(heading)}</h1>
    <p style="margin:0 0 24px;font-size:15px;color:${COLORS.muted};line-height:1.7;">
      ${esc(body)}
    </p>
    ${statRow([
      { label: tt(L, 'digest.stat_cards'), value: String(stats.cardCount), icon: 'collection' },
      { label: tt(L, 'digest.stat_portfolio'), value: stats.portfolioValue, icon: 'market' },
      { label: tt(L, 'digest.stat_trades'), value: String(stats.openTrades), icon: 'trade' },
    ])}
    <h2 style="margin:28px 0 12px;font-size:16px;font-weight:700;color:${COLORS.text};">${esc(recentHeading)}</h2>
    <table width="100%" cellpadding="0" cellspacing="0">${recentHtml}</table>
    <h2 style="margin:24px 0 12px;font-size:16px;font-weight:700;color:${COLORS.text};">${esc(wishHeading)}</h2>
    <table width="100%" cellpadding="0" cellspacing="0">${wishHtml}</table>`;

  const recentText = stats.recentCards.length > 0
    ? stats.recentCards.map((c) => `  • ${c.name}, ${c.setValue}`).join('\n')
    : `  ${noRecent}`;
  const wishText = stats.wishlist.length > 0
    ? stats.wishlist.map((w) => `  • ${w.name}${w.maxPrice ? ' (max ' + w.maxPrice + ')' : ''}`).join('\n')
    : `  ${noWish}`;

  return {
    subject,
    html: buildBrandedHtml({
      subject,
      preheader: `${tt(L, 'digest.stat_cards')}: ${stats.cardCount} · ${tt(L, 'digest.stat_portfolio')}: ${stats.portfolioValue} · ${tt(L, 'digest.stat_trades')}: ${stats.openTrades}`,
      bodyHtml,
      ctaLink: `${APP_URL}/collection`,
      ctaLabel: cta,
      accentColor: COLORS.primary,
      footerReason: footer,
    }),
    text: buildPlainText(
      subject,
      [
        body,
        '',
        `${tt(L, 'digest.stat_cards')}: ${stats.cardCount}`,
        `${tt(L, 'digest.stat_portfolio')}: ${stats.portfolioValue}`,
        `${tt(L, 'digest.stat_trades')}: ${stats.openTrades}`,
        '',
        recentHeading,
        recentText,
        '',
        wishHeading,
        wishText,
        '',
        footer,
      ],
      `${APP_URL}/collection`,
      cta,
    ),
  };
}