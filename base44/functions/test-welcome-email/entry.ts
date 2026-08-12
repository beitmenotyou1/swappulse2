// test-welcome-email — admin-only endpoint to send the redesigned Day 1 welcome
// email to the caller's own address for review. Bypasses OnboardingEmail dedupe.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildDay1Email } from '../../shared/emailContent.ts';
import { sendBrandedEmail } from '../../shared/smtpSender.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    if (!user.email) return Response.json({ error: 'No email on your account' }, { status: 400 });

    const email = buildDay1Email(user.full_name || 'collector');
    const result = await sendBrandedEmail({
      to: user.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    return Response.json({ ok: true, to: user.email, ...result });
  } catch (error) {
    console.error('test-welcome-email error', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});