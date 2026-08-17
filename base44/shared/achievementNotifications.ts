// §2.4 Achievement notification templates — restoration hints + HTML email
// bodies for earned/revoked alerts. Shared by the on-demand and nightly
// functions so both emit identical copy.

export function buildRestorationPath(cfg: any): string {
  switch (cfg?.category) {
    case 'collection':
      return cfg?.id === 'shiny_hunter'
        ? 'Re-collect 50+ high-tier cards across multiple sets to restore Shiny Hunter.'
        : 'Re-collect the missing cards to restore set completion eligibility.';
    case 'trade':
      return cfg?.id === 'chain_weaver'
        ? 'Complete another multi-party trade chain (≥3 parties) to restore Chain Weaver.'
        : 'Complete another trade with feedback to restore this achievement.';
    case 'reputation':
      return 'Regain enough distinct vouches from trusted traders and avoid recent vouch revocations.';
    case 'contribution':
      return 'Restore the underlying contribution, scanner corrections, binder engagement, hosted events, or card reviews.';
    default:
      return 'Regain the eligibility proof defined in the achievement criteria.';
  }
}

export function buildAchievementEmailSubject(kind: string, name: string): string {
  return kind === 'earned' ? `🎉 You unlocked ${name} on SwapPulse!` : `Your ${name} achievement has been updated`;
}

export function buildAchievementEmailHtml(
  kind: 'earned' | 'revoked',
  data: { achievementName: string; tier?: string; timestamp: string; reason?: string; restorationPath?: string; viewUrl?: string; restoreUrl?: string },
): string {
  const earned = kind === 'earned';
  const banner = earned
    ? `<div class="success-banner"><strong>Congratulations!</strong><br>You've earned the <strong>${esc(data.achievementName)}</strong> badge!</div>`
    : `<div class="warning-banner"><strong>Achievement Status Changed</strong><br>Your <strong>${esc(data.achievementName)}</strong> badge has been revoked.</div>`;
  const details = earned
    ? `<ul><li>Name: <strong>${esc(data.achievementName)}</strong></li><li>Tier: <strong>${esc(data.tier || '')}</strong></li><li>Earned: <strong>${esc(data.timestamp)}</strong></li></ul>`
    : `<ul><li>Achievement: <strong>${esc(data.achievementName)}</strong></li><li>Date Revoked: <strong>${esc(data.timestamp)}</strong></li><li>Reason: <strong>${esc(data.reason || 'Eligibility criteria no longer met')}</strong></li></ul>`;
  const restore = !earned && data.restorationPath
    ? `<div class="restore"><h3>Restoration Path</h3><p>Your achievement can be restored if you regain eligibility:</p><p>${esc(data.restorationPath)}</p><p><a href="${esc(data.restoreUrl || 'https://swappulse.org/achievements')}" class="btn">Check Eligibility Status</a></p></div>`
    : '';
  const cta = earned
    ? `<p><a href="${esc(data.viewUrl || 'https://swappulse.org/achievements')}" class="btn">View Achievement Proof</a></p><p><small>You can export this achievement as a verifiable credential from your profile.</small></p>`
    : '';
  return `<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8"><title>SwapPulse Achievement Notification</title><style>
body{font-family:Inter,-apple-system,sans-serif;background:#0F1117;color:#F5F6FA;margin:0}
.container{max-width:600px;margin:0 auto;padding:40px 20px}
.header{text-align:center;margin-bottom:40px}
.badge{width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#F5B700 0%,#D49800 100%);margin:0 auto 20px}
.content{background:#1A1D28;padding:30px;border-radius:12px;margin-bottom:20px}
.warning-banner{background:rgba(239,68,68,0.15);border-left:4px solid #EF4444;padding:16px 20px;margin:20px 0;border-radius:4px}
.success-banner{background:rgba(16,185,129,0.15);border-left:4px solid #10B981;padding:16px 20px;margin:20px 0;border-radius:4px}
.restore{background:#252936;margin-top:20px;padding:20px;border-radius:8px}
.btn{display:inline-block;padding:12px 24px;background:#6d4aff;color:#fff;text-decoration:none;border-radius:6px;font-weight:600}
.footer{text-align:center;color:#6B7280;font-size:12px;margin-top:40px}
a{color:#6d4aff}
</style></head><body><div class="container">
<div class="header"><div class="badge"></div><h1>SwapPulse Achievement Update</h1></div>
<div class="content">${banner}<p>${earned ? "This achievement has been verified and added to your permanent SwapPulse profile." : "We've reviewed your achievement eligibility and found that the criteria are no longer met."}</p><h3>Details:</h3>${details}${restore}${cta}</div>
<div class="footer"><p>This notification was sent by SwapPulse. Learn more about achievements at <a href="https://swappulse.org/achievements">swappulse.org/achievements</a></p></div>
</div></body></html>`;
}

function esc(s: string): string {
  return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}