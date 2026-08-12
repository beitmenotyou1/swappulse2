// status-monitor — automated monitoring worker called by the Status Monitoring
// workflow every 5 minutes. Runs health checks, creates incidents when services
// go down, resolves them when they recover, and notifies subscribers.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { checkTcgdex, checkDatabase, checkSmtp, checkVapid, checkBase44 } from '../../shared/healthChecks.ts';
import { notifyStatusSubscribers } from '../../shared/statusNotifications.ts';

const SERVICE_MAP = {
  base44: { name: 'SwapPulse Platform', criticality: 'critical' },
  database: { name: 'Database', criticality: 'critical' },
  tcgdex: { name: 'TCGDex Catalog', criticality: 'high' },
  smtp: { name: 'Email Service', criticality: 'medium' },
  vapid: { name: 'Push Notifications', criticality: 'medium' },
};

function slugify(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    // Run all health checks
    const [tcgdex, database] = await Promise.all([
      checkTcgdex(),
      checkDatabase(base44).catch((e) => ({ status: 'down', error: e?.message || String(e) })),
    ]);
    const services = {
      base44: checkBase44(),
      database,
      tcgdex,
      smtp: checkSmtp(),
      vapid: checkVapid(),
    };

    // Fetch open incidents
    const allIncidents = await svc.entities.StatusIncident.list('-started_at', 100);
    const openIncidents = allIncidents.filter((i) => i.status !== 'resolved');

    const created = [];
    const resolved = [];

    for (const [key, result] of Object.entries(services)) {
      const svcInfo = SERVICE_MAP[key];
      if (!svcInfo) continue;
      const serviceName = svcInfo.name;
      const isDown = result.status === 'down';

      // Find open incident affecting this service
      const openForService = openIncidents.find((inc) =>
        (inc.affected_services || []).includes(serviceName)
      );

      if (isDown && !openForService) {
        // Create new incident
        const now = new Date().toISOString();
        const incident = await svc.entities.StatusIncident.create({
          title: `${serviceName} Experiencing Issues`,
          slug: slugify(serviceName) + '-' + Date.now().toString(36),
          status: 'investigating',
          severity: svcInfo.criticality === 'critical' ? 'critical' : svcInfo.criticality === 'high' ? 'major' : 'minor',
          affected_services: [serviceName],
          started_at: now,
          updates: [{
            text: `Automated monitoring detected ${serviceName} is down${result.error ? ': ' + result.error : ''}.`,
            status: 'investigating',
            authored_by: 'system-monitor',
            created_at: now,
          }],
          auto_created: true,
        });
        created.push(incident);
        await notifyStatusSubscribers(base44, incident, 'incident_created');
      }

      if (!isDown && openForService) {
        // Resolve the incident
        const now = new Date().toISOString();
        const updates = [...(openForService.updates || []), {
          text: `${serviceName} has recovered. Automated monitoring confirms the service is operational.`,
          status: 'resolved',
          authored_by: 'system-monitor',
          created_at: now,
        }];
        const updated = await svc.entities.StatusIncident.update(openForService.id, {
          status: 'resolved',
          resolved_at: now,
          updates,
        });
        resolved.push(updated);
        await notifyStatusSubscribers(base44, updated, 'incident_resolved');
      }
    }

    return Response.json({
      ok: true,
      services,
      created: created.length,
      resolved: resolved.length,
    });
  } catch (error) {
    console.error('status-monitor error', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}