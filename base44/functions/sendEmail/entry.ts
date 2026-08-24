import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const payload = await req.json().catch(() => ({}));
    const { to, subject, html, text } = payload;
    if (!to || !subject) return Response.json({ error: 'to and subject are required' }, { status: 400 });

    // Validate recipient email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (typeof to !== 'string' || !emailRegex.test(to)) {
      return Response.json({ error: 'Invalid recipient email format' }, { status: 400 });
    }

    // Validate recipient is a registered app user (prevent arbitrary external emailing)
    const normalizedTo = to.toLowerCase().trim();
    const users = await base44.asServiceRole.entities.User.list(1000).catch(() => []);
    const isRegistered = users.some((u: any) => (u.email || '').toLowerCase().trim() === normalizedTo);
    if (!isRegistered) {
      return Response.json({ error: 'Recipient is not a registered app user' }, { status: 403 });
    }

    // Sanitize content: strip all HTML tags and decode entities to produce safe plain text
    const decodeEntities = (s: string) =>
      s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
       .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'");
    const stripHtml = (s: string) => decodeEntities(
      s.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
       .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
       .replace(/<[^>]+>/g, ' ')
       .replace(/\s+/g, ' ')
       .trim()
    );
    const rawBody = text || (html ? stripHtml(html) : "");
    const safeSubject = String(subject).slice(0, 200);
    const safeBody = String(rawBody).slice(0, 10000);

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: normalizedTo,
      subject: safeSubject,
      body: safeBody,
      from_name: "SwapPulse",
    });
    return Response.json({ ok: true, to: normalizedTo });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});