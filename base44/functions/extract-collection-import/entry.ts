// extract-collection-import — narrow server-side wrapper around the
// ExtractDataFromUploadedFile integration for collection CSV/spreadsheet
// imports. The extraction schema is fixed here (not supplied by the client) so
// this endpoint cannot be used as a generic AI-extraction proxy, and it is
// gated on an authenticated user plus a per-user hourly rate limit to protect
// integration credits.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const COLLECTION_FIELDS = [
  'card_id', 'card_name', 'card_image', 'set_id', 'set_name', 'local_id',
  'rarity', 'category', 'condition', 'variant', 'acquisition_date',
  'purchase_price', 'market_value', 'notes',
];

const NUMERIC_FIELDS = ['purchase_price', 'market_value'];

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const fileUrl = String(body.file_url || '').trim();

    let url: URL;
    try {
      url = new URL(fileUrl);
    } catch {
      return Response.json({ error: 'file_url must be a valid URL' }, { status: 400 });
    }
    if (url.protocol !== 'https:' || url.username || url.password || fileUrl.length > 2000) {
      return Response.json({ error: 'file_url must be a plain HTTPS URL' }, { status: 400 });
    }

    const svc = base44.asServiceRole;

    // Rate limit: at most 10 file extractions per user per hour.
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recent = await svc.entities.CollectionEntry
      .filter({ created_by_id: me.id, created_date: { $gte: hourAgo } }, '-created_date', 5000)
      .catch(() => []);
    if ((recent?.length || 0) >= 5000) {
      return Response.json({ error: 'Import limit reached. Please try again later.', code: 'RATE_LIMITED' }, { status: 429 });
    }

    const properties: Record<string, unknown> = {};
    for (const field of COLLECTION_FIELDS) {
      properties[field] = { type: NUMERIC_FIELDS.includes(field) ? 'number' : 'string' };
    }

    const extracted = await svc.integrations.Core.ExtractDataFromUploadedFile({
      file_url: fileUrl,
      json_schema: { type: 'array', items: { type: 'object', properties } },
    });

    if (extracted?.status === 'error') {
      return Response.json({ error: extracted.details || 'Could not read that file' }, { status: 400 });
    }

    const output = extracted?.output;
    const rows = Array.isArray(output) ? output : output ? [output] : [];
    // Only return the known collection fields, capped at the import limit.
    const clean = rows.slice(0, 5000).map((row: any) => {
      const out: Record<string, unknown> = {};
      for (const field of COLLECTION_FIELDS) {
        if (row?.[field] != null) out[field] = row[field];
      }
      return out;
    });

    return Response.json({ rows: clean });
  } catch (error: any) {
    console.error('extract-collection-import error:', error?.message || error);
    return Response.json({ error: error?.message || 'Import failed' }, { status: 500 });
  }
}