// §2.10 expireStories - deletes stories past their expires_at. Invoked hourly
// by the "Story Expiry" workflow.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
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
});