// Shared status notification helper — used by manage-incident and status-monitor
// to email confirmed subscribers when incidents are created, updated, or resolved.
import { sendBrandedEmail } from './smtpSender.ts';
import { signStatusCapability } from './statusSubscriptionTokens.ts';

export async function notifyStatusSubscribers(base44, incident, eventType) {
  try {
    const all = await base44.asServiceRole.entities.StatusSubscriber.list('-created_date', 500);
    const confirmed = all.filter((s) => s.confirmed_at && s.email);
    if (confirmed.length === 0) return { notified: 0 };

    const origin = 'https://swappulse.org';
    const statusUrl = `${origin}/status`;

    const subject =
      eventType === 'incident_resolved'
        ? `[Resolved] ${incident.title}`
        : eventType === 'incident_created'
          ? `[New Incident] ${incident.title}`
          : `[Update] ${incident.title}`;

    let notified = 0;
    for (const sub of confirmed) {
      if (!sub.unsubscribe_token) continue;
      const signedUnsubscribeToken = await signStatusCapability('unsubscribe', sub.unsubscribe_token);
      const unsubscribeUrl = `${statusUrl}?unsubscribe=${signedUnsubscribeToken}`;
      const html = buildIncidentEmail(incident, eventType, statusUrl, unsubscribeUrl);
      const text = `${incident.title}, Status: ${incident.status}\n\nView: ${statusUrl}\n\nUnsubscribe: ${unsubscribeUrl}`;
      try {
        await sendBrandedEmail({ to: sub.email, subject, html, text });
        notified++;
      } catch (e) {
        console.error('status notify failed for', sub.email, e?.message || e);
      }
    }
    return { notified };
  } catch (e) {
    console.error('notifyStatusSubscribers error', e?.message || e);
    return { notified: 0, error: e?.message };
  }
}

function buildIncidentEmail(incident, eventType, statusUrl, unsubscribeUrl) {
  const statusColor = incident.status === 'resolved' ? '#10b981' : incident.status === 'monitoring' ? '#3b82f6' : '#ef4444';
  const severityBadge = {
    critical: '🔴 Critical',
    major: '🟠 Major',
    minor: '🟡 Minor',
  }[incident.severity] || incident.severity;

  const lastUpdate = (incident.updates || []).slice(-1)[0];
  const updateText = lastUpdate ? lastUpdate.text : 'No details available yet.';

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0b0e14;font-family:Inter,Arial,sans-serif;color:#e6edf3">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:#111827;border-radius:16px;overflow:hidden;border:1px solid #1e293b">
      <div style="padding:24px">
        <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;text-transform:uppercase;letter-spacing:0.05em">SwapPulse Status</p>
        <h2 style="margin:0 0 12px;color:#f8fafc;font-size:22px">${incident.title}</h2>
        <div style="margin-bottom:16px">
          <span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${statusColor};color:#fff;font-size:13px;font-weight:600">${incident.status}</span>
          <span style="display:inline-block;margin-left:8px;padding:4px 12px;border-radius:999px;background:#1e293b;color:#94a3b8;font-size:13px">${severityBadge}</span>
        </div>
        <p style="margin:0 0 16px;color:#94a3b8;font-size:14px;line-height:1.6">${updateText}</p>
        ${(incident.affected_services || []).length > 0 ? `<p style="margin:0 0 16px;color:#94a3b8;font-size:13px">Affected: ${incident.affected_services.join(', ')}</p>` : ''}
        <a href="${statusUrl}" style="display:inline-block;padding:10px 24px;border-radius:999px;background:#6d4aff;color:#fff;text-decoration:none;font-size:14px;font-weight:600">View Status Page</a>
      </div>
      <div style="padding:16px 24px;background:#0b0e14;border-top:1px solid #1e293b">
        <p style="margin:0;font-size:12px;color:#64748b">You're receiving this because you subscribed to SwapPulse status updates.</p>
        <a href="${unsubscribeUrl}" style="font-size:12px;color:#64748b">Unsubscribe</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}