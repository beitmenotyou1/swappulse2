import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const { to, subject, html, text } = await req.json();
    if (!to || !subject) return Response.json({ error: 'to and subject are required' }, { status: 400 });
    const body = text || (html ? html.replace(/<[^>]+>/g, " ") : "");
    await base44.asServiceRole.integrations.Core.SendEmail({ to, subject, body, from_name: "SwapPulse" });
    return Response.json({ ok: true, to });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});