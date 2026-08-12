// §2.4 Proof-snapshot verification — reconstructs an achievement's proof from
// its captured snapshot. Recomputes the SHA-256 integrity hash (detects
// tampering) and checks each captured record still resolves to a live entity
// (detects deletion). Returns a per-record validity report.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const RECORD_TYPE_TO_ENTITY: Record<string, string> = {
  'org.swappulse.collectionEntry': 'CollectionEntry',
  'org.swappulse.tradingFeedback': 'TradingFeedback',
  'org.swappulse.tradeChain': 'TradeChain',
  'org.swappulse.scannerCorrection': 'ScannerCorrection',
  'org.swappulse.binder': 'Binder',
  'org.swappulse.voiceSpace': 'VoiceSpace',
  'org.swappulse.meetup': 'Meetup',
  'org.swappulse.cardReview': 'CardReview',
};

async function sha256Hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Extracts the record id from a captured at:// URI of the form
// at://swappulse/{type}/{id}. Returns null for reference-only URIs (e.g. vouch
// references that point at a DID, not a stored record).
function recordIdFromUri(uri: string): string | null {
  const m = uri && uri.match(/^at:\/\/swappulse\/[^/]+\/(.+)$/);
  return m ? m[1] : null;
}

export default async function (req: Request): Promise<Response> {
  try {
    let snapshotId: string | null = null;
    let achievementId: string | null = null;
    let did: string | null = null;
    try {
      const body = await req.json();
      snapshotId = body?.snapshotId ?? null;
      achievementId = body?.achievementId ?? null;
      did = body?.did ?? null;
    } catch {
      const url = new URL(req.url);
      snapshotId = url.searchParams.get('snapshotId');
      achievementId = url.searchParams.get('achievementId');
      did = url.searchParams.get('did');
    }
    if (!snapshotId && !(achievementId && did)) {
      return Response.json({ error: 'Provide snapshotId, or achievementId + did' }, { status: 400 });
    }
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    let snapshot: any = null;
    if (snapshotId) {
      snapshot = await svc.entities.AchievementProofSnapshot.get(snapshotId).catch(() => null);
    } else {
      const list = await svc.entities.AchievementProofSnapshot.filter({ did, achievement_id: achievementId }, '-captured_at', 1);
      snapshot = list[0] || null;
    }
    if (!snapshot) {
      return Response.json({ valid: false, reason: 'Snapshot not found' }, { status: 404 });
    }

    const data = snapshot.snapshot_data || {};
    const { integrityHash, ...withoutHash } = data;
    const recomputed = await sha256Hex(JSON.stringify(withoutHash));
    const integrityValid = recomputed === integrityHash;

    const records = await Promise.all((data.records || []).map(async (r: any) => {
      const id = recordIdFromUri(r.uri);
      const entity = RECORD_TYPE_TO_ENTITY[r.recordType];
      if (!id || !entity) {
        return { uri: r.uri, recordType: r.recordType, exists: null, note: 'reference-only (no stored record to verify)' };
      }
      try {
        const rec = await svc.entities[entity].get(id);
        return { uri: r.uri, recordType: r.recordType, exists: !!rec, digestMatch: rec?.cid ? rec.cid === r.cid : null };
      } catch {
        return { uri: r.uri, recordType: r.recordType, exists: false, note: 'record deleted or unreachable' };
      }
    }));

    const checkedRecords = records.filter((r: any) => r.exists !== null);
    const allExisting = checkedRecords.length > 0 && checkedRecords.every((r: any) => r.exists);

    return Response.json({
      valid: integrityValid && allExisting,
      checks: { integrityValid, recordsExist: allExisting },
      snapshotId: snapshot.id,
      achievementId: data.achievementId,
      did: data.userDid,
      capturedAt: data.capturedAt,
      recordCount: records.length,
      records,
      snapshotTimestamp: data.capturedAt,
      verifiedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[verifyAchievementSnapshot] error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}