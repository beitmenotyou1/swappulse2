// §2.10 expireStories - deletes stories past their expires_at. Invoked hourly
// by the "Story Expiry" workflow.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const cutoff = new Date().toISOString();
    await base44.asServiceRole.entities.Story.deleteMany({ expires_at: { $lt: cutoff } });
    // Story views outlive their stories by at most the 24h window; prune any
    // view record older than 24h (the ephemeral window is now closed).
    const viewCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await base44.asServiceRole.entities.StoryView.deleteMany({ viewed_at: { $lt: viewCutoff } });
    return Response.json({ ok: true });
  } catch (error) {
    console.error('expireStories error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});