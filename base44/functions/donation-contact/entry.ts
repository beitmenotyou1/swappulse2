// donation-contact — handles the contact form on the /help/donations page.
// Validates the fields, verifies a Turnstile token, and sends the message to
// contact@swappulse.org via SMTP (the built-in SendEmail only reaches
// registered app users, so the shared SMTP sender is used instead). Public.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { verifyTurnstile } from '../../shared/payments.ts';
import { sendBrandedEmail } from '../../shared/smtpSender.ts';

export default async function(req) {
  try {
    createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || '').slice(0, 100);
    const email = String(body.email || '').slice(0, 200);
    const message = String(body.message || '').slice(0, 2000);

    if (!name || !email || !message) {
      return Response.json({ error: 'Name, email, and message are required.' }, { status: 400 });
    }

    const turnstileOk = await verifyTurnstile(body.turnstileToken);
    if (!turnstileOk) {
      return Response.json({ error: 'Bot verification failed.' }, { status: 403 });
    }

    const subject = 'Donation enquiry from ' + name;
    const text = `Name: ${name}\nEmail: ${email}\n\n${message}`;
    const html = `<p><b>Name:</b> ${name}</p><p><b>Email:</b> ${email}</p><p>${message.replace(/\n/g, '<br>')}</p>`;
    await sendBrandedEmail({ to: 'contact@swappulse.org', subject, html, text });
    return Response.json({ ok: true });
  } catch (error) {
    console.error('donation-contact error', error?.message || error);
    return Response.json({ error: 'Could not send your message. Please try again later.' }, { status: 500 });
  }
}