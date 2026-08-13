// send-branded-email — general-purpose branded HTML email sender via SMTP.
// Accepts { to, subject, html, text } and sends through the shared SMTP transporter.
// Used by test-welcome-email and callable from other functions that pre-render content.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendBrandedEmail } from '../../shared/smtpSender.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { to, subject, html, text } = body;
    if (!to || !subject || !html || !text) {
      return Response.json({ error: 'to, subject, html, and text are required' }, { status: 400 });
    }

    const result = await sendBrandedEmail({ to, subject, html, text });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error('send-branded-email error', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});