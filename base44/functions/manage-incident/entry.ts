// manage-incident — admin-only function to create incidents, post updates, and
// resolve them. Notifies confirmed status subscribers on each change.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { notifyStatusSubscribers } from '../../shared/statusNotifications.ts';

function slugify(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }
    const svc = base44.asServiceRole;
    const body = await req.json();
    const action = String(body.action || '');

    if (action === 'create') {
      const title = String(body.title || '').trim();
      if (!title) return Response.json({ error: 'title required' }, { status: 400 });
      const now = new Date().toISOString();
      const incident = await svc.entities.StatusIncident.create({
        title,
        slug: slugify(title) + '-' + Date.now().toString(36),
        status: body.status || 'investigating',
        severity: body.severity || 'minor',
        affected_services: body.affected_services || [],
        started_at: now,
        updates: [{
          text: body.initial_update || 'We are investigating this issue.',
          status: body.status || 'investigating',
          authored_by: user.full_name || user.email || 'admin',
          created_at: now,
        }],
        auto_created: false,
      });
      await notifyStatusSubscribers(base44, incident, 'incident_created');
      return Response.json({ incident });
    }

    if (action === 'update') {
      const incident = await svc.entities.StatusIncident.get(body.incident_id);
      if (!incident) return Response.json({ error: 'Incident not found' }, { status: 404 });
      const now = new Date().toISOString();
      const updates = [...(incident.updates || []), {
        text: String(body.text || ''),
        status: body.status || incident.status,
        authored_by: user.full_name || user.email || 'admin',
        created_at: now,
      }];
      const updateData = { updates };
      let eventType = 'incident_updated';
      if (body.status && body.status !== incident.status) {
        updateData.status = body.status;
        if (body.status === 'resolved') {
          updateData.resolved_at = now;
          eventType = 'incident_resolved';
        }
      }
      const updated = await svc.entities.StatusIncident.update(body.incident_id, updateData);
      await notifyStatusSubscribers(base44, updated, eventType);
      return Response.json({ incident: updated });
    }

    if (action === 'delete') {
      await svc.entities.StatusIncident.delete(body.incident_id);
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Unknown action: ' + action }, { status: 400 });
  } catch (error) {
    console.error('manage-incident error', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}