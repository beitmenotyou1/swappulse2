// status-monitor — automated monitoring worker called by the Status Monitoring
// workflow every 5 minutes. Runs health checks, updates StatusService records,
// creates StatusUpdate records on status changes, creates/resolves incidents,
// and notifies subscribers.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { checkTcgdex, checkDatabase, checkSmtp, checkVapid, checkBase44, checkAtProtoRelay } from '../../shared/healthChecks.ts';
import { notifyStatusSubscribers } from '../../shared/statusNotifications.ts';

// Maps health-check keys to StatusService slugs
const SLUG_MAP = {
  base44: 'web-app',
  database: 'postgresql',
  tcgdex: 'tcgdex-api',
  'atproto-relay': 'atproto-relay',
};

const SERVICE_NAMES = {
  'web-app': 'SwapPulse Web App',
  'postgresql': 'PostgreSQL Database',
  'tcgdex-api': 'TCGDex API',
  'atproto-relay': 'AT Protocol Relay (Firehose)',
};

function slugify(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const svc = base44.asServiceRole;

    // Run all health checks
    const [tcgdex, database, relay] = await Promise.all([
      checkTcgdex(),
      checkDatabase(base44).catch((e) => ({ status: 'down', error: e?.message || String(e) })),
      checkAtProtoRelay(),
    ]);
    const services = {
      base44: checkBase44(),
      database,
      tcgdex,
      'atproto-relay': relay,
      smtp: checkSmtp(),
      vapid: checkVapid(),
    };

    // Parallelize the two independent initial fetches.
    const [allServiceRecords, allIncidents] = await Promise.all([
      svc.entities.StatusService.list('-created_date', 100),
      svc.entities.StatusIncident.list('-started_at', 100),
    ]);
    const serviceBySlug = new Map(allServiceRecords.map((s) => [s.slug, s]));
    const openIncidents = allIncidents.filter((i) => i.status !== 'resolved');

    const created = [];
    const resolved = [];
    let updatesCreated = 0;

    for (const [key, result] of Object.entries(services)) {
      const slug = SLUG_MAP[key];
      if (!slug) continue; // Skip smtp/vapid — no StatusService mapping

      const serviceName = SERVICE_NAMES[slug] || slug;
      const isDown = result.status === 'down';
      const newStatus = isDown ? 'outage' : 'operational';
      const now = new Date().toISOString();

      const serviceRecord = serviceBySlug.get(slug);
      const oldStatus = serviceRecord?.current_status || 'operational';

      // Update StatusService + create StatusUpdate if status changed
      if (serviceRecord) {
        if (newStatus !== oldStatus) {
          await svc.entities.StatusService.update(serviceRecord.id, {
            current_status: newStatus,
            last_checked_at: now,
          });
          await svc.entities.StatusUpdate.create({
            service_slug: slug,
            status: newStatus,
            message: isDown
              ? `Automated monitoring detected ${serviceName} is down${result.error ? ': ' + result.error : ''}.`
              : `${serviceName} has recovered. Automated monitoring confirms the service is operational.`,
            type: 'automated',
            authored_by: 'system-monitor',
          });
          updatesCreated++;
        } else {
          await svc.entities.StatusService.update(serviceRecord.id, { last_checked_at: now });
        }
      }

      // Incident management
      const openForService = openIncidents.find((inc) =>
        (inc.affected_services || []).includes(serviceName)
      );

      if (isDown && !openForService) {
        const incident = await svc.entities.StatusIncident.create({
          title: `${serviceName} Experiencing Issues`,
          slug: slugify(serviceName) + '-' + Date.now().toString(36),
          status: 'investigating',
          severity: serviceRecord?.criticality === 'critical' ? 'critical' : serviceRecord?.criticality === 'high' ? 'major' : 'minor',
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
        const updatesArr = [...(openForService.updates || []), {
          text: `${serviceName} has recovered. Automated monitoring confirms the service is operational.`,
          status: 'resolved',
          authored_by: 'system-monitor',
          created_at: now,
        }];
        const updated = await svc.entities.StatusIncident.update(openForService.id, {
          status: 'resolved',
          resolved_at: now,
          updates: updatesArr,
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
      updates: updatesCreated,
    });
  } catch (error) {
    console.error('status-monitor error', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}