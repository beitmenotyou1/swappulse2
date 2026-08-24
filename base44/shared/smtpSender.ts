// Shared SMTP sender using Nodemailer. All branded email functions import this.
// Reads SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_TOKEN from environment.
import nodemailer from 'npm:nodemailer@6.9.9';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendBrandedEmail(input: SendEmailInput): Promise<{ messageId: string; response: string }> {
  const host = Deno.env.get('SMTP_HOST');
  const portStr = Deno.env.get('SMTP_PORT') || '587';
  const port = parseInt(portStr, 10);
  const user = Deno.env.get('SMTP_USERNAME');
  const pass = Deno.env.get('SMTP_TOKEN');

  if (!host || !user || !pass) {
    throw new Error('SMTP not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_TOKEN secrets.');
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 8000,
  });

  const info = await transporter.sendMail({
    from: `"SwapPulse" <${user}>`,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  return { messageId: info.messageId, response: info.response };
}