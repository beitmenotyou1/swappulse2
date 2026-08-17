import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildAdminAlertEmail, COLORS, esc } from '../../shared/emailContent.ts';
import { sendBrandedEmail } from '../../shared/smtpSender.ts';

// Weekly SEO audit. Runs as the service role (invoked by the Weekly SEO Audit
// workflow — no user session). Audits the public surface, auto-fixes what it
// can, computes an overall score, persists one SeoAudit record, and emails
// every admin a summary. The admin dashboard SeoAuditSection reads the records.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const svc = base44.asServiceRole;
    const origin = getAppUrl(req);

    const staticPages = [
      '/', '/explore', '/sets', '/trades', '/packs', '/market', '/help', '/status',
      '/challenges', '/meetups', '/circles', '/spaces', '/binders', '/donate',
    ];

    const [posts, binders, circles, meetups, challenges, spaces] = await Promise.all([
      svc.entities.Post.list('-created_date', 500).catch(() => []),
      svc.entities.Binder.list('-created_date', 500).catch(() => []),
      svc.entities.Circle.list('-created_date', 500).catch(() => []),
      svc.entities.Meetup.list('-created_date', 500).catch(() => []),
      svc.entities.Challenge.list('-created_date', 500).catch(() => []),
      svc.entities.VoiceSpace.list('-created_date', 500).catch(() => []),
    ]);

    // Sitemap entry count = static routes + dynamic entity pages + distinct
    // member profiles. Computed directly from the entity lists (the /sitemap.xml
    // route is client-rendered, so fetching it from the backend returns HTML).
    const dids = new Set<string>();
    for (const p of posts) {
      if (p.did) dids.add(p.did);
    }
    const dynamicPages = posts.length + binders.length + circles.length + meetups.length + challenges.length + spaces.length;
    const sitemapEntryCount = staticPages.length + dynamicPages + dids.size;
    const pagesAudited = staticPages.length + dynamicPages;

    // Heuristic checks — the app renders meta tags client-side via useSEO, so
    // the backend audit checks structural completeness rather than live DOM.
    const autoFixedItems: any[] = [];
    const manualActionItems: any[] = [];
    const brokenCanonicals: string[] = [];
    const missingOgImages: string[] = [];
    const missingJsonld: string[] = [];
    const thinContentPages: string[] = [];
    let issuesFound = 0;

    // 1. Sitemap reachable?
    if (sitemapEntryCount === 0) {
      issuesFound++;
      manualActionItems.push({ severity: 'critical', page: '/sitemap.xml', issue: 'Sitemap is empty or unreachable', recommendation: 'Ensure the seo-sitemap function and /sitemap.xml route are deployed.' });
    }

    // 2. Thin content: posts with empty or very short bodies.
    for (const p of posts.slice(0, 200)) {
      const text = (p.content || '').trim();
      if (text.length > 0 && text.length < 20) {
        thinContentPages.push(`/post/${p.id}`);
      }
    }
    if (thinContentPages.length > 0) {
      issuesFound += thinContentPages.length;
      manualActionItems.push({ severity: 'warning', page: '/post/*', issue: `${thinContentPages.length} posts have very short content (<20 chars)`, recommendation: 'Encourage richer post bodies for better indexing.' });
    }

    // 3. Pages missing OG images — dynamic entity pages without an image field.
    for (const c of circles.slice(0, 100)) {
      if (!c.image_url) missingOgImages.push(`/circles/${c.id}`);
    }
    for (const ch of challenges.slice(0, 100)) {
      if (!ch.image_url) missingOgImages.push(`/challenges/${ch.id}`);
    }
    if (missingOgImages.length > 0) {
      issuesFound += missingOgImages.length;
      manualActionItems.push({ severity: 'warning', page: '/circles/*, /challenges/*', issue: `${missingOgImages.length} entity pages have no banner image for OG previews`, recommendation: 'Upload banner images so social shares render a preview.' });
    }

    // 4. Auto-fix: nothing structural to fix from the backend (meta tags are
    //    client-rendered), so we record zero auto-fixes but keep the field for
    //    future automated repairs (e.g. generating missing OG images).
    const issuesFixed = autoFixedItems.length;

    // Score: start at 100, deduct per issue category weight.
    let score = 100;
    if (sitemapEntryCount === 0) score -= 25;
    score -= Math.min(20, Math.floor(thinContentPages.length / 5));
    score -= Math.min(15, Math.floor(missingOgImages.length / 5));
    if (pagesAudited < 10) score -= 10;
    score = Math.max(0, Math.min(100, score));

    // 8-week trend from prior audits.
    const prior = await svc.entities.SeoAudit.list('-audit_date', 8).catch(() => []);
    const trendData: Record<string, number> = {};
    const trend = [...(prior || [])].reverse().map((a) => a.overall_score || 0);
    trend.forEach((s, i) => { trendData[`week_${i + 1}`] = s; });

    const audit = await svc.entities.SeoAudit.create({
      audit_date: new Date().toISOString(),
      overall_score: score,
      pages_audited: pagesAudited,
      issues_found: issuesFound,
      issues_fixed: issuesFixed,
      manual_action_items: manualActionItems,
      auto_fixed_items: autoFixedItems,
      sitemap_entry_count: sitemapEntryCount,
      broken_canonicals: brokenCanonicals,
      missing_og_images: missingOgImages,
      missing_jsonld: missingJsonld,
      thin_content_pages: thinContentPages,
      trend_data: trendData,
    });

    // Email every admin a summary — urgent branded email.
    try {
      const users = await svc.entities.User.list().catch(() => []);
      const admins = (users || []).filter((u) => u.role === 'admin');
      const scoreColor = score >= 80 ? COLORS.success : score >= 50 ? COLORS.warning : COLORS.danger;
      const itemsHtml = manualActionItems.length
        ? manualActionItems.map((m) => {
            const sevColor = m.severity === 'critical' ? COLORS.danger : m.severity === 'warning' ? COLORS.warning : COLORS.muted;
            return `<tr><td style="padding:10px 0;border-bottom:1px solid ${COLORS.border};">
              <div style="font-size:12px;font-weight:700;color:${sevColor};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">${esc(m.severity)}</div>
              <div style="font-size:14px;font-weight:600;color:${COLORS.text};">${esc(m.page)}</div>
              <div style="font-size:13px;color:${COLORS.muted};line-height:1.5;">${esc(m.issue)}</div>
            </td></tr>`;
          }).join('')
        : `<tr><td style="padding:12px 0;font-size:14px;color:${COLORS.muted};">No manual action items this week.</td></tr>`;
      const emailObj = buildAdminAlertEmail({
        subject: `Weekly SEO Audit, Score ${score}/100`,
        preheader: `SEO audit complete: ${issuesFound} issues found, ${issuesFixed} auto-fixed.`,
        heading: 'Weekly SEO audit complete',
        bodyHtml: `
          <table width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.cardHover};border-radius:10px;border:1px solid ${COLORS.border};margin-bottom:16px;">
            <tr><td style="padding:18px;text-align:center;">
              <div style="font-size:40px;font-weight:800;color:${scoreColor};line-height:1;">${score}<span style="font-size:18px;color:${COLORS.muted};">/100</span></div>
              <div style="font-size:12px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;">Overall Score</div>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
            <tr>
              <td style="padding:0 4px;text-align:center;width:33%;"><div style="font-size:20px;font-weight:800;color:${COLORS.text};">${pagesAudited}</div><div style="font-size:11px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.5px;">Pages</div></td>
              <td style="padding:0 4px;text-align:center;width:33%;"><div style="font-size:20px;font-weight:800;color:${COLORS.text};">${sitemapEntryCount}</div><div style="font-size:11px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.5px;">Sitemap</div></td>
              <td style="padding:0 4px;text-align:center;width:33%;"><div style="font-size:20px;font-weight:800;color:${issuesFound > 0 ? COLORS.warning : COLORS.success};">${issuesFound}</div><div style="font-size:11px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.5px;">Issues</div></td>
            </tr>
          </table>
          <h2 style="margin:0 0 10px;font-size:15px;font-weight:700;color:${COLORS.text};">Manual action items</h2>
          <table width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table>`,
        ctaLink: 'https://swappulse.org/admin',
        ctaLabel: 'View Full Trend',
        footerReason: "You're receiving this admin alert because the weekly SEO audit ran automatically. View the admin dashboard for the 8-week trend.",
      });
      for (const a of admins) {
        if (a.email) {
          await sendBrandedEmail({ to: a.email, ...emailObj }).catch((e) => {
            console.error('seo-audit: admin email failed', a.email, e?.message || e);
          });
        }
      }
    } catch (e) {
      console.error('seo-audit: admin email failed', e?.message || e);
    }

    return Response.json({ ok: true, audit_id: audit?.id, score, pages_audited: pagesAudited, issues_found: issuesFound, sitemap_entries: sitemapEntryCount });
  } catch (error) {
    console.error('seo-audit error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function getAppUrl(req: Request): string {
  const custom = req.headers.get('X-Base44-App-Url');
  if (custom) return custom.replace(/\/$/, '');
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}