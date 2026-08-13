import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));
    // Shared-secret gate — temporary protection on public app (revert when issues are fixed)
    const expectedSecret = Deno.env.get('BACKEND_FUNCTION_SECRET');
    const providedSecret = req.headers.get('X-Function-Secret') || payload.secret;
    if (!expectedSecret || providedSecret !== expectedSecret) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { to, subject, html, text } = payload;
    if (!to || !subject) return Response.json({ error: 'to and subject are required' }, { status: 400 });
    const body = text || (html ? html.replace(/<[^>]+>/g, " ") : "");
    await base44.asServiceRole.integrations.Core.SendEmail({ to, subject, body, from_name: "SwapPulse" });
    return Response.json({ ok: true, to });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});