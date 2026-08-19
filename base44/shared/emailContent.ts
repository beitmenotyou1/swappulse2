// Content builders for all 6 SwapPulse email types.
// Each returns { subject, html, text } — html is full branded HTML, text is plain-text alternative.
import { buildBrandedHtml, buildPlainText, stepCard, featureCard, statRow, COLORS, esc } from './emailTemplate.ts';
export { COLORS, esc };

const APP_URL = 'https://swappulse.org';

// 1. Activation link email (send-activation)
export function buildActivationEmail(name: string, link: string) {
  const bodyHtml = `
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:800;color:${COLORS.text};">Welcome to SwapPulse!</h1>
    <p style="margin:0 0 16px;font-size:15px;color:${COLORS.muted};line-height:1.7;">
      Hi ${esc(name || 'collector')}, activate your account to join the collector community. Click the button below to verify your email, the link is valid for 48 hours.
    </p>
    <p style="margin:0 0 8px;font-size:14px;color:${COLORS.muted};line-height:1.7;">
      After activating, enter the 6-digit code from your verification email on the activation page.
    </p>`;
  return {
    subject: 'Activate your SwapPulse account',
    html: buildBrandedHtml({
      subject: 'Activate your SwapPulse account',
      preheader: 'Welcome to SwapPulse, activate your account to join the collector community.',
      bodyHtml,
      ctaLink: link,
      ctaLabel: 'Activate Account',
      accentColor: COLORS.primary,
      footerReason: "You're receiving this because you created a SwapPulse account. If you didn't, you can safely ignore this email.",
    }),
    text: buildPlainText(
      'Activate your SwapPulse account',
      [
        `Welcome to SwapPulse, ${name || 'collector'}!`,
        '',
        'Activate your account to join the collector community.',
        'Open this link (valid for 48 hours):',
        link,
        '',
        'Then enter the 6-digit code from your verification email on the activation page.',
        '',
        "If you didn't create an account, you can ignore this email.",
      ],
    ),
  };
}

// 2. Activation warning email (activation-lifecycle)
export function buildActivationWarningEmail(name: string, link: string) {
  const bodyHtml = `
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:800;color:${COLORS.danger};">Action required: activate your account</h1>
    <p style="margin:0 0 16px;font-size:15px;color:${COLORS.muted};line-height:1.7;">
      Hi ${esc(name || 'there')}, your SwapPulse account is still not activated. Accounts that remain unactivated are permanently deleted 90 days after sign-up.
    </p>
    <p style="margin:0 0 8px;font-size:14px;color:${COLORS.muted};line-height:1.7;">
      Activate now to keep your collection, trades, and profile. After activating, enter the 6-digit code from your verification email.
    </p>`;
  return {
    subject: 'Activate your SwapPulse account, action required',
    html: buildBrandedHtml({
      subject: 'Activate your SwapPulse account, action required',
      preheader: 'Your account will be deleted if not activated. Activate now.',
      bodyHtml,
      ctaLink: link,
      ctaLabel: 'Activate Now',
      accentColor: COLORS.danger,
      footerReason: "You're receiving this because your SwapPulse account is not yet activated. If you didn't create this account, ignore this email.",
    }),
    text: buildPlainText(
      'Activate your SwapPulse account, action required',
      [
        `Hi ${name || 'there'},`,
        '',
        'Your SwapPulse account is still not activated.',
        'Accounts that remain unactivated are permanently deleted 90 days after sign-up.',
        '',
        'Activate now:',
        link,
        '',
        'Then enter the 6-digit code from your verification email on the activation page.',
        '',
        "If you didn't create this account, ignore this email.",
      ],
    ),
  };
}

// 3. Onboarding Day 1 — "Your first 3 steps"
export function buildDay1Email(name: string) {
  const bodyHtml = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:${COLORS.text};">Three steps to get started</h1>
    <p style="margin:0 0 24px;font-size:15px;color:${COLORS.muted};line-height:1.7;">
      Hi ${esc(name || 'collector')}, you're in. Now let's make SwapPulse yours. Here are the three things every collector does on day one.
    </p>
    ${stepCard(1, 'collection', 'Add cards to your collection', 'Search for any Pokemon TCG card, pick the condition and variant, and add it. Your collection is stored in your AT Protocol repository, so you own it completely.', `${APP_URL}/collection`)}
    ${stepCard(2, 'scanner', 'Scan a card with AI', 'Point your phone camera at any card and the AI scanner identifies it automatically. Corrections you submit train the model.', `${APP_URL}/scan`)}
    ${stepCard(3, 'feed', 'Check your feed', 'The Fresh Pulls feed shows pack openings in real time. The Trade Floor surfaces active listings, with wishlist matches bumped to the top for you.', `${APP_URL}/`)}
    <p style="margin:20px 0 0;font-size:14px;color:${COLORS.muted};line-height:1.7;">
      <strong style="color:${COLORS.gold};">Tip:</strong> Install SwapPulse as a PWA on your phone's home screen for the full app experience, including offline access and push notifications.
    </p>`;
  return {
    subject: 'Your first 3 steps on SwapPulse',
    html: buildBrandedHtml({
      subject: 'Your first 3 steps on SwapPulse',
      preheader: 'Three things every collector does on day one, add cards, scan, check your feed.',
      bodyHtml,
      ctaLink: `${APP_URL}/`,
      ctaLabel: 'Open SwapPulse',
      accentColor: COLORS.primary,
      footerReason: "You're receiving this because you joined SwapPulse. Visit your settings to manage email preferences.",
    }),
    text: buildPlainText(
      'Your first 3 steps on SwapPulse',
      [
        `Three steps to get started, ${name || 'collector'}`,
        '',
        "You're in. Now let's make SwapPulse yours.",
        '',
        '1. Add cards to your collection',
        `   Search for any Pokemon TCG card, pick the condition and variant, and add it.`,
        `   -> ${APP_URL}/collection`,
        '',
        '2. Scan a card with AI',
        '   Point your phone camera at any card and the AI scanner identifies it automatically.',
        `   -> ${APP_URL}/scan`,
        '',
        '3. Check your feed',
        '   The Fresh Pulls feed shows pack openings in real time. The Trade Floor surfaces active listings.',
        `   -> ${APP_URL}/`,
        '',
        'Tip: Install SwapPulse as a PWA for offline access and push notifications.',
      ],
      `${APP_URL}/`,
      'Open SwapPulse',
    ),
  };
}

// 4. Onboarding Day 3 — "Ready to trade?"
export function buildDay3Email(name: string, matches: number) {
  const banner = matches > 0
    ? `<div style="margin-bottom:20px;padding:14px 18px;border-radius:10px;background:${COLORS.gold}22;border:1px solid ${COLORS.gold}55;">
         <div style="font-size:14px;color:${COLORS.gold};font-weight:600;">${matches} trade match${matches === 1 ? '' : 'es'} found</div>
         <div style="font-size:13px;color:${COLORS.muted};margin-top:2px;">Someone wants what you have. Check the Trade Floor now.</div>
       </div>`
    : '';
  const bodyHtml = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:${COLORS.text};">Ready to trade?</h1>
    <p style="margin:0 0 24px;font-size:15px;color:${COLORS.muted};line-height:1.7;">
      Hi ${esc(name || 'collector')}, here's how trading works on SwapPulse.
    </p>
    ${banner}
    ${featureCard('trade', 'List what you have and want', 'Set visibility to public, wishlist-only, or scoped to a circle. Smart matchmaking finds matches automatically.', `${APP_URL}/trades`)}
    ${featureCard('binder', 'Show off your binder', 'Ten pages, six slots each, six themes. Drag and drop your best pulls and publish it to the community.', `${APP_URL}/binders`)}
    <p style="margin:20px 0 0;font-size:14px;color:${COLORS.muted};line-height:1.7;">
      When your offer matches someone's want, both parties get notified. Negotiate privately, check the fairness meter, and leave trading feedback to build your trust score.
    </p>`;
  return {
    subject: 'Ready to trade? Explore the Trade Floor',
    html: buildBrandedHtml({
      subject: 'Ready to trade? Explore the Trade Floor',
      preheader: matches > 0 ? `${matches} trade matches waiting for you` : 'How trading works on SwapPulse',
      bodyHtml,
      ctaLink: `${APP_URL}/trades`,
      ctaLabel: 'Open Trade Floor',
      accentColor: COLORS.primary,
      footerReason: "You're receiving this because you joined SwapPulse. Visit your settings to manage email preferences.",
    }),
    text: buildPlainText(
      'Ready to trade? Explore the Trade Floor',
      [
        `Ready to trade, ${name || 'collector'}?`,
        '',
        ...(matches > 0 ? [`${matches} trade match${matches === 1 ? '' : 'es'} found, someone wants what you have.`, ''] : []),
        'How trading works on SwapPulse:',
        '  1. List what you offer and what you want (public, wishlist-only, or circle-scoped).',
        '  2. Smart matchmaking finds matches, both parties get notified.',
        '  3. Negotiate privately in the trade thread.',
        '  4. Check the fairness meter to balance card values and conditions.',
        '  5. Leave trading feedback to build your trust score.',
        '',
        'Show off your binder, ten pages, six slots each, six themes.',
        `  -> Binders: ${APP_URL}/binders`,
        `  -> Trade Floor: ${APP_URL}/trades`,
      ],
      `${APP_URL}/trades`,
      'Open Trade Floor',
    ),
  };
}

// 5. Onboarding Day 7 — "Level up"
export function buildDay7Email(name: string) {
  const bodyHtml = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:${COLORS.text};">Level up your experience</h1>
    <p style="margin:0 0 24px;font-size:15px;color:${COLORS.muted};line-height:1.7;">
      Hi ${esc(name || 'collector')}, you've got the basics down. Here are four features most collectors haven't discovered yet.
    </p>
    ${featureCard('market', 'Market Watch', 'Track your collection value in real time, set price alerts, and vote in community sentiment polls. Pricing syncs from TCGDex every 30 minutes.', `${APP_URL}/market`)}
    ${featureCard('journal', 'Collector Journals', 'Write long-form articles about your collecting journey, embed card stats, and tag your pieces.', `${APP_URL}/profile`)}
    ${featureCard('meetup', 'Local Meetups', 'Find collectors near you. Meetups are trust-gated, with pre-meetup trade matching to connect you with attendees who have cards you want.', `${APP_URL}/meetups`)}
    ${featureCard('live', 'Go Live', 'Paste your stream URL, set a duration, and go live. A red ring appears around your profile picture. Recordings can become podcast episodes.', `${APP_URL}/spaces`)}
    <p style="margin:20px 0 0;font-size:14px;color:${COLORS.muted};line-height:1.7;">
      <strong style="color:${COLORS.gold};">Bonus:</strong> Claim a custom domain handle like @yourbrand.com via DNS verification for a verification badge and portable identity.
    </p>`;
  return {
    subject: 'Level up your SwapPulse experience',
    html: buildBrandedHtml({
      subject: 'Level up your SwapPulse experience',
      preheader: 'Four features most collectors haven\'t discovered yet, market watch, journals, meetups, go live.',
      bodyHtml,
      ctaLink: `${APP_URL}/`,
      ctaLabel: 'Explore SwapPulse',
      accentColor: COLORS.gold,
      footerReason: "You're receiving this because you joined SwapPulse. We'd love your feedback, hit the Feedback button in the app.",
    }),
    text: buildPlainText(
      'Level up your SwapPulse experience',
      [
        `Go deeper, ${name || 'collector'}`,
        '',
        "You've got the basics down. Here are four features most collectors haven't discovered yet.",
        '',
        'Market Watch, track collection value, set price alerts, vote in sentiment polls.',
        `  -> ${APP_URL}/market`,
        '',
        'Collector Journals, write long-form articles, embed card stats, tag your pieces.',
        `  -> ${APP_URL}/profile`,
        '',
        'Local Meetups, find collectors near you. Trust-gated with pre-meetup trade matching.',
        `  -> ${APP_URL}/meetups`,
        '',
        'Go Live, paste your stream URL, set a duration, go live. Recordings become podcasts.',
        `  -> ${APP_URL}/spaces`,
        '',
        'Bonus: claim a custom domain handle like @yourbrand.com via DNS verification.',
        '',
        "We'd love your feedback, hit the Feedback button in the app.",
      ],
      `${APP_URL}/`,
      'Explore SwapPulse',
    ),
  };
}

// 7. Donation thank-you email (stripe-webhook / nowpayments-ipn)
export function buildDonationThankYouEmail(amount: number, currency: string, method: string, donorName: string) {
  const cur = currency.toUpperCase();
  const symbol = cur === 'GBP' ? '£' : cur === 'USD' ? '$' : '€';
  const amt = `${symbol}${Number(amount).toFixed(2)}`;
  const methodLabel = method === 'card' ? 'card' : 'cryptocurrency';
  const bodyHtml = `
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:800;color:${COLORS.text};">Thank you for supporting SwapPulse!</h1>
    <p style="margin:0 0 16px;font-size:15px;color:${COLORS.muted};line-height:1.7;">
      Hi ${esc(donorName || 'collector')}, we've received your ${methodLabel} donation of <strong style="color:${COLORS.gold};">${esc(amt)}</strong>. Your generosity keeps SwapPulse free and open-source for every collector.
    </p>
    <p style="margin:0 0 8px;font-size:14px;color:${COLORS.muted};line-height:1.7;">
      Every contribution goes back into hosting, the TCGDex catalogue, and the AT Protocol infrastructure that keeps your collection self-sovereign.
    </p>`;
  return {
    subject: 'Thank you for your SwapPulse donation!',
    html: buildBrandedHtml({
      subject: 'Thank you for your SwapPulse donation!',
      preheader: `We received your ${methodLabel} donation of ${amt}. Thank you for keeping SwapPulse free.`,
      bodyHtml,
      ctaLink: `${APP_URL}/`,
      ctaLabel: 'Back to SwapPulse',
      accentColor: COLORS.gold,
      footerReason: "You're receiving this because you made a donation to SwapPulse. We don't send marketing emails.",
    }),
    text: buildPlainText(
      'Thank you for your SwapPulse donation!',
      [
        `Hi ${donorName || 'collector'},`,
        '',
        `Thank you for your ${methodLabel} donation of ${amt}.`,
        'Your generosity keeps SwapPulse free and open-source for every collector.',
        '',
        "We don't send marketing emails.",
      ],
      `${APP_URL}/`,
      'Back to SwapPulse',
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
}) {
  const recentHtml = stats.recentCards.length > 0
    ? stats.recentCards.map((c) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid ${COLORS.border};">
          <div style="font-size:14px;font-weight:600;color:${COLORS.text};">${esc(c.name)}</div>
          <div style="font-size:12px;color:${COLORS.muted};">${esc(c.setValue)}</div>
        </td>
      </tr>`).join('')
    : `<tr><td style="padding:12px 0;font-size:14px;color:${COLORS.muted};">No new cards this week.</td></tr>`;

  const wishHtml = stats.wishlist.length > 0
    ? stats.wishlist.map((w) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid ${COLORS.border};">
          <div style="font-size:14px;font-weight:600;color:${COLORS.text};">${esc(w.name)}</div>
          ${w.maxPrice ? `<div style="font-size:12px;color:${COLORS.muted};">Max: ${esc(w.maxPrice)}</div>` : ''}
        </td>
      </tr>`).join('')
    : `<tr><td style="padding:12px 0;font-size:14px;color:${COLORS.muted};">Your wishlist is empty.</td></tr>`;

  const bodyHtml = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:${COLORS.text};">Your week in cards</h1>
    <p style="margin:0 0 24px;font-size:15px;color:${COLORS.muted};line-height:1.7;">
      Hi ${esc(name || 'collector')}, here's your SwapPulse weekly digest.
    </p>
    ${statRow([
      { label: 'Cards', value: String(stats.cardCount), icon: 'collection' },
      { label: 'Portfolio', value: stats.portfolioValue, icon: 'market' },
      { label: 'Open Trades', value: String(stats.openTrades), icon: 'trade' },
    ])}
    <h2 style="margin:28px 0 12px;font-size:16px;font-weight:700;color:${COLORS.text};">Recently added</h2>
    <table width="100%" cellpadding="0" cellspacing="0">${recentHtml}</table>
    <h2 style="margin:24px 0 12px;font-size:16px;font-weight:700;color:${COLORS.text};">Your wishlist</h2>
    <table width="100%" cellpadding="0" cellspacing="0">${wishHtml}</table>`;

  const recentText = stats.recentCards.length > 0
    ? stats.recentCards.map((c) => `  • ${c.name}, ${c.setValue}`).join('\n')
    : '  No new cards this week.';
  const wishText = stats.wishlist.length > 0
    ? stats.wishlist.map((w) => `  • ${w.name}${w.maxPrice ? ' (max ' + w.maxPrice + ')' : ''}`).join('\n')
    : '  Your wishlist is empty.';

  return {
    subject: 'Your SwapPulse Weekly Digest',
    html: buildBrandedHtml({
      subject: 'Your SwapPulse Weekly Digest',
      preheader: `Cards: ${stats.cardCount} · Portfolio: ${stats.portfolioValue} · Open trades: ${stats.openTrades}`,
      bodyHtml,
      ctaLink: `${APP_URL}/collection`,
      ctaLabel: 'View Collection',
      accentColor: COLORS.primary,
      footerReason: "You're receiving this because you enabled the weekly digest in your SwapPulse settings. Visit your profile to turn it off any time.",
    }),
    text: buildPlainText(
      'Your SwapPulse Weekly Digest',
      [
        `Hi ${name || 'collector'}, here's your week in cards.`,
        '',
        `Cards: ${stats.cardCount}`,
        `Portfolio: ${stats.portfolioValue}`,
        `Open Trades: ${stats.openTrades}`,
        '',
        'Recently added cards:',
        recentText,
        '',
        'Your wishlist:',
        wishText,
        '',
        "You're receiving this because you enabled the weekly digest in your settings.",
        'Visit your profile to turn it off any time.',
      ],
      `${APP_URL}/collection`,
      'View Collection',
    ),
  };
}