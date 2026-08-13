// manage-service — admin-only backend function for manual service status updates
// and maintenance window CRUD. Equivalent to the protected endpoints in the
// NestJS Status API scaffold.
//
// Actions:
//   update_status     — { serviceId, status, message } → updates StatusService.current_status, creates StatusUpdate
//   create_maintenance — { title, description, starts_at, ends_at, affected_services } → creates StatusMaintenanceWindow
//   delete_maintenance — { windowId } → deletes StatusMaintenanceWindow
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);

    // Verify admin
    let me = null;
    try { me = await base44.auth.me(); } catch {}
    if (!me || me.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const svc = base44.asServiceRole;
    let body = {};
    try { body = await req.json(); } catch {}
    const action = body.action;

    if (action === 'update_status') {
      const { serviceId, status, message } = body;
      if (!serviceId || !status || !message) {
        return Response.json({ error: 'serviceId, status, and message are required' }, { status: 400 });
      }
      const validStatuses = ['operational', 'degraded', 'outage', 'maintenance'];
      if (!validStatuses.includes(status)) {
        return Response.json({ error: 'Invalid status' }, { status: 400 });
      }

      const service = await svc.entities.StatusService.get(serviceId);
      if (!service) return Response.json({ error: 'Service not found' }, { status: 404 });

      const now = new Date().toISOString();
      const oldStatus = service.current_status;

      // Update service status
      await svc.entities.StatusService.update(serviceId, {
        current_status: status,
        last_checked_at: now,
      });

      // Create status update record
      await svc.entities.StatusUpdate.create({
        service_slug: service.slug,
        status,
        message,
        type: 'manual',
        authored_by: me.full_name || me.email || me.id,
      });

      // Auto-manage incidents for outages/degraded
      if (status === 'outage' || status === 'degraded') {
        const openIncidents = await svc.entities.StatusIncident.filter({ status: { $ne: 'resolved' } });
        const existing = openIncidents.find((inc) =>
          (inc.affected_services || []).includes(service.name)
        );
        if (!existing) {
          await svc.entities.StatusIncident.create({
            title: `${service.name} — Manual Status Update`,
            slug: `${service.slug}-manual-${Date.now().toString(36)}`,
            status: 'investigating',
            severity: service.criticality === 'critical' ? 'critical' : service.criticality === 'high' ? 'major' : 'minor',
            affected_services: [service.name],
            started_at: now,
            updates: [{
              text: message,
              status: 'investigating',
              authored_by: me.full_name || me.email || me.id,
              created_at: now,
            }],
            auto_created: false,
          });
        }
      }

      // Auto-resolve incidents when service returns to operational
      if (status === 'operational' && oldStatus !== 'operational') {
        const openIncidents = await svc.entities.StatusIncident.filter({ status: { $ne: 'resolved' } });
        const forService = openIncidents.filter((inc) =>
          (inc.affected_services || []).includes(service.name)
        );
        for (const inc of forService) {
          const updatesArr = [...(inc.updates || []), {
            text: `${service.name} marked operational by ${me.full_name || me.email}. ${message}`,
            status: 'resolved',
            authored_by: me.full_name || me.email || me.id,
            created_at: now,
          }];
          await svc.entities.StatusIncident.update(inc.id, {
            status: 'resolved',
            resolved_at: now,
            updates: updatesArr,
          });
        }
      }

      return Response.json({ ok: true, serviceSlug: service.slug, oldStatus, newStatus: status });
    }

    if (action === 'create_maintenance') {
      const { title, description, starts_at, ends_at, affected_services } = body;
      if (!title || !starts_at || !ends_at) {
        return Response.json({ error: 'title, starts_at, and ends_at are required' }, { status: 400 });
      }
      if (new Date(ends_at) <= new Date(starts_at)) {
        return Response.json({ error: 'ends_at must be after starts_at' }, { status: 400 });
      }

      const window = await svc.entities.StatusMaintenanceWindow.create({
        title,
        description: description || '',
        starts_at,
        ends_at,
        affected_services: affected_services || [],
        created_by: me.full_name || me.email || me.id,
      });
      return Response.json({ ok: true, window });
    }

    if (action === 'delete_maintenance') {
      const { windowId } = body;
      if (!windowId) return Response.json({ error: 'windowId is required' }, { status: 400 });
      await svc.entities.StatusMaintenanceWindow.delete(windowId);
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('manage-service error', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}