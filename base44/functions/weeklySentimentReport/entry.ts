import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendBrandedEmail } from '../../shared/smtpSender.ts';

function isPlatformInternalCall(req: Request): boolean {
  const authz = req.headers.get('base44-service-authorization') || '';
  if (!authz.startsWith('Bearer ')) return false;
  const token = authz.slice(7);
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    const isInternal = payload?.internal_service_token === true || payload?.internal_service_token === 'true';
    return isInternal && payload?.caller === 'backend_functions';
  } catch {
    return false;
  }
}

export default async function(req) {
  if (!isPlatformInternalCall(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    // 1. Fetch all SentimentVote data for the past week
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const votes = await svc.entities.SentimentVote.filter(
      { created_date: { $gte: oneWeekAgo } },
      '-created_date',
      1000
    );

    const bullish = votes.filter(v => v.vote === 'bullish').length;
    const bearish = votes.filter(v => v.vote === 'bearish').length;
    const neutral = votes.filter(v => v.vote === 'neutral').length;
    const total = votes.length;
    const pct = (n) => total > 0 ? Math.round(n / total * 100) : 0;

    // 2. Call syncPricing to update current valuations (best effort — it may
    //    require admin auth context, so we log failures but continue)
    let pricingResult = null;
    let pricingSynced = false;
    try {
      pricingResult = await svc.functions.invoke('syncPricing', {});
      pricingSynced = true;
    } catch (e) {
      console.error('weeklySentimentReport: syncPricing call failed:', e?.message || e);
    }

    // 3. Compile a summary using the market_watch agent persona via InvokeLLM
    const pricingLine = pricingSynced
      ? 'Pricing sync completed successfully — card valuations refreshed.'
      : 'Pricing sync was attempted but could not complete this cycle.';

    const summaryPrompt =
      'You are the SwapPulse Market Watch agent. Compile a weekly market sentiment report for the Pokémon TCG collector community.\n\n' +
      'This week\'s sentiment vote data:\n' +
      '- Total votes: ' + total + '\n' +
      '- Bullish: ' + bullish + ' (' + pct(bullish) + '%)\n' +
      '- Bearish: ' + bearish + ' (' + pct(bearish) + '%)\n' +
      '- Neutral: ' + neutral + ' (' + pct(neutral) + '%)\n\n' +
      pricingLine + '\n\n' +
      'Write a concise, engaging summary (3-4 paragraphs) covering:\n' +
      '1. Overall market sentiment trend this week\n' +
      '2. What the bullish/bearish split suggests for collectors\n' +
      '3. Pricing observations and market direction\n' +
      '4. Recommendations for the coming week\n' +
      'IMPORTANT: Write in plain text only. Do NOT use any markdown formatting — no asterisks, no bold markers, no bullet point dashes, no hash headers. Use simple paragraph breaks and numbered lists written as plain text (e.g. "1. " on its own line). Keep it friendly and community-focused.';

    const summary = await svc.integrations.Core.InvokeLLM({
      prompt: summaryPrompt,
    });

    const summaryText = typeof summary === 'string' ? summary : JSON.stringify(summary);

    // 4. Build email content (inline CSS, Midnight Vault palette)
    const subject = 'SwapPulse Weekly Market Sentiment Report';
    const textVersion =
      'Weekly Market Sentiment Report\n\n' +
      'Sentiment Votes This Week:\n' +
      '- Total: ' + total + '\n' +
      '- Bullish: ' + bullish + ' (' + pct(bullish) + '%)\n' +
      '- Bearish: ' + bearish + ' (' + pct(bearish) + '%)\n' +
      '- Neutral: ' + neutral + ' (' + pct(neutral) + '%)\n\n' +
      'Market Watch Summary:\n' + summaryText + '\n\n' +
      '— The SwapPulse Team';

    const htmlVersion =
      '<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#0F1117;color:#e2e8f0;">' +
      '<h1 style="color:#6d4aff;font-size:24px;margin-bottom:16px;">Weekly Market Sentiment Report</h1>' +
      '<div style="background:#1a1d2e;border-radius:12px;padding:20px;margin-bottom:20px;">' +
      '<h2 style="color:#fbbf24;font-size:18px;margin-bottom:12px;">Sentiment Votes This Week</h2>' +
      '<p style="margin:4px 0;">Total Votes: <strong>' + total + '</strong></p>' +
      '<p style="margin:4px 0;color:#10b981;">Bullish: <strong>' + bullish + ' (' + pct(bullish) + '%)</strong></p>' +
      '<p style="margin:4px 0;color:#ef4444;">Bearish: <strong>' + bearish + ' (' + pct(bearish) + '%)</strong></p>' +
      '<p style="margin:4px 0;color:#94a3b8;">Neutral: <strong>' + neutral + ' (' + pct(neutral) + '%)</strong></p>' +
      '</div>' +
      '<div style="background:#1a1d2e;border-radius:12px;padding:20px;">' +
      '<h2 style="color:#6d4aff;font-size:18px;margin-bottom:12px;">Market Watch Summary</h2>' +
      '<div style="line-height:1.6;white-space:pre-wrap;">' + summaryText + '</div>' +
      '</div>' +
      '<p style="color:#64748b;font-size:12px;margin-top:24px;text-align:center;">— The SwapPulse Team</p>' +
      '</div>';

    // 5. Email the report to all active (non-restricted) community members
    const allUsers = await svc.entities.User.list('-created_date', 500);
    const activeUsers = allUsers.filter(u => u.email && !u.restricted);

    // Parallelize all email sends (independent SMTP calls).
    const results = await Promise.allSettled(activeUsers.map((u) =>
      sendBrandedEmail({ to: u.email, subject, html: htmlVersion, text: textVersion }),
    ));
    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;
    for (const r of results) {
      if (r.status === 'rejected') console.error('weeklySentimentReport: send failed', r.reason?.message || r.reason);
    }

    return Response.json({
      success: true,
      votes_analyzed: total,
      bullish,
      bearish,
      neutral,
      pricing_synced: pricingSynced,
      emails_sent: sent,
      emails_failed: failed,
      active_members: activeUsers.length,
    });
  } catch (error) {
    console.error('weeklySentimentReport error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}