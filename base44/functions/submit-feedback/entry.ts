// submit-feedback - stores collector feedback (page snapshot + comment) and
// best-effort emails it to the team. The Feedback record is the reliable
// capture; the email is secondary and may be rejected if the recipient is not
// a registered app user.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const TEAM_INBOX = 'feedback@swappulse.org';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { comment, page, screenshotUrl, userAgent, viewport } = await req.json().catch(() => ({}));
    if (!comment || !String(comment).trim()) {
      return Response.json({ error: 'Please add a comment describing your feedback.' }, { status: 400 });
    }

    const record = await base44.entities.Feedback.create({
      comment: String(comment).slice(0, 5000),
      page: page || '',
      screenshot_url: screenshotUrl || '',
      user_agent: userAgent || '',
      viewport: viewport || '',
      status: 'new',
    });

    let emailed = false;
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: TEAM_INBOX,
        subject: `SwapPulse feedback - ${page || 'page'}`,
        body: [
          `New feedback from ${user.full_name || user.email || 'a collector'}.`,
          '',
          comment,
          '',
          `Page: ${page || '(unknown)'}`,
          `Viewport: ${viewport || '(unknown)'}`,
          `Screenshot: ${screenshotUrl || '(none attached)'}`,
          `User agent: ${userAgent || '(unknown)'}`,
        ].join('\n'),
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