// submit-feedback - stores collector feedback (category, title, rating, page
// snapshot + comment) and best-effort emails it to the team inbox. The Feedback
// record is the reliable capture; the email is secondary and may be rejected
// if the recipient is not a registered app user.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const TEAM_INBOX = 'feedback@swappulse.org';

const CATEGORY_LABELS = {
  suggestion: 'Feature Suggestion',
  bug: 'Bug Report',
  comment: 'General Comment',
};

const CATEGORY_EMOJI = {
  suggestion: '💡',
  bug: '🐛',
  comment: '💬',
};

function starBar(rating) {
  if (!rating) return '(no rating)';
  const n = Math.max(1, Math.min(5, Number(rating)));
  return '★'.repeat(n) + '☆'.repeat(5 - n) + ` (${n}/5)`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      category,
      title,
      comment,
      rating,
      page,
      screenshotUrl,
      userAgent,
      viewport,
    } = await req.json().catch(() => ({}));

    if (!comment || !String(comment).trim()) {
      return Response.json({ error: 'Please add a comment describing your feedback.' }, { status: 400 });
    }

    const validCategories = ['suggestion', 'bug', 'comment'];
    const cat = validCategories.includes(category) ? category : 'comment';
    const cleanTitle = title ? String(title).trim().slice(0, 200) : '';
    const numRating = rating ? Math.max(1, Math.min(5, Math.round(Number(rating)))) : null;

    const record = await base44.entities.Feedback.create({
      category: cat,
      title: cleanTitle,
      comment: String(comment).slice(0, 5000),
      rating: numRating,
      page: page || '',
      screenshot_url: screenshotUrl || '',
      user_agent: userAgent || '',
      viewport: viewport || '',
      status: 'new',
    });

    const catLabel = CATEGORY_LABELS[cat] || 'Feedback';
    const catEmoji = CATEGORY_EMOJI[cat] || '💬';
    const subject = `${catEmoji} SwapPulse ${catLabel}${cleanTitle ? ', ' + cleanTitle : ''}`;

    const body = [
      `New ${catLabel.toLowerCase()} from ${user.full_name || user.email || 'a collector'}.`,
      '',
      cleanTitle ? `Title: ${cleanTitle}` : '',
      `Rating: ${starBar(numRating)}`,
      '',
      '--- Feedback ---',
      comment,
      '',
      '--- Context ---',
      `Page: ${page || '(unknown)'}`,
      `Viewport: ${viewport || '(unknown)'}`,
      `Screenshot: ${screenshotUrl || '(none attached)'}`,
      `User agent: ${userAgent || '(unknown)'}`,
    ].filter(Boolean).join('\n');

    let emailed = false;
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: TEAM_INBOX,
        subject,
        body,
        from_name: 'SwapPulse Feedback',
      });
      emailed = true;
    } catch (e) {
      console.error('submit-feedback: email send failed', e?.message || String(e));
    }

    return Response.json({ ok: true, id: record.id, emailed });
  } catch (error) {
    console.error('submit-feedback error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});