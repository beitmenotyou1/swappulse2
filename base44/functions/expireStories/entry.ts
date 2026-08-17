// §2.10 expireStories - deletes stories past their expires_at. Invoked hourly
// by the "Story Expiry" workflow.
//
// Security: this maintenance endpoint deletes records via the service role, so
// it must not be callable by arbitrary internet callers. The app is public (no
// signed-in user to check), so the caller is verified via the platform's
// internal service token: the `base44-service-authorization` JWT that the
// platform injects on internal calls (workflow runtime, function-to-function).
// We decode the payload and require `internal_service_token === "true"` and
// `caller === "backend_functions"`. A public internet caller has no such
// token and is rejected with 403.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

function isPlatformInternalCall(req: Request): boolean {
  const authz = req.headers.get('base44-service-authorization') || '';
  if (!authz.startsWith('Bearer ')) return false;
  const token = authz.slice(7);
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    const isInternal = payload?.internal_service_token === true || payload?.internal_service_token === 'true';
    return isInternal
      && payload?.caller === 'backend_functions'
      && payload?.backend_function_name === 'expireStories';
  } catch {
    return false;
  }
}

export default async function (req: Request): Promise<Response> {
  try {
    if (!isPlatformInternalCall(req)) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const base44 = createClientFromRequest(req);
    const cutoff = new Date().toISOString();
    const viewCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    // Parallelize the two independent deleteMany calls.
    await Promise.all([
      base44.asServiceRole.entities.Story.deleteMany({ expires_at: { $lt: cutoff } }),
      base44.asServiceRole.entities.StoryView.deleteMany({ viewed_at: { $lt: viewCutoff } }),
    ]);
    return Response.json({ ok: true });
  } catch (error) {
    console.error('expireStories error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}