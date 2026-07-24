import React, { useRef, useState } from 'react';
import { Download, Upload, Loader2, FileJson, FileSpreadsheet } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';

const COLLECTION_FIELDS = [
  'card_id', 'card_name', 'card_image', 'set_id', 'set_name', 'local_id',
  'rarity', 'category', 'condition', 'variant', 'acquisition_date',
  'purchase_price', 'market_value', 'notes',
];

function toCsv(rows) {
  const header = COLLECTION_FIELDS.join(',');
  const body = rows.map((r) =>
    COLLECTION_FIELDS.map((f) => {
      const v = r[f];
      if (v == null) return '';
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    }).join(',')
  );
  return [header, ...body].join('\n');
}

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BulkImportExport({ items, onImported }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const exportJson = async () => {
    setBusy(true);
    try {
      const all = items.length ? items : await base44.entities.CollectionEntry.list('-updated_date', 1000);
      download('swappulse-collection.json', JSON.stringify(all, null, 2), 'application/json');
      setMsg({ type: 'ok', text: `Exported ${all.length} cards to JSON.` });
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    setBusy(true);
    try {
      const all = items.length ? items : await base44.entities.CollectionEntry.list('-updated_date', 1000);
      download('swappulse-collection.csv', toCsv(all), 'text/csv');
      setMsg({ type: 'ok', text: `Exported ${all.length} cards to CSV.` });
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const jsonSchema = {
        type: 'object',
        properties: Object.fromEntries(
          COLLECTION_FIELDS.map((f) => {
            const numeric = ['purchase_price', 'market_value'].includes(f);
            return [f, { type: numeric ? 'number' : 'string' }];
          })
        ),
      };
      const extracted = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: { type: 'array', items: jsonSchema },
      });
      const rows = Array.isArray(extracted.output) ? extracted.output : extracted.output ? [extracted.output] : [];
      if (!rows.length) {
        setMsg({ type: 'err', text: 'No rows detected in the uploaded file.' });
        setBusy(false);
        return;
      }
      const { did, signingKey } = await ensureUserDid();
      const stamped = [];
      for (const r of rows) {
        if (!r.card_id && !r.card_name) continue;
        const entry = {
          card_id: r.card_id || '',
          card_name: r.card_name || '',
          card_image: r.card_image || '',
          set_id: r.set_id || '',
          set_name: r.set_name || '',
          local_id: r.local_id || '',
          rarity: r.rarity || '',
          category: r.category || '',
          condition: ['mint', 'near_mint', 'excellent', 'good', 'damaged'].includes(r.condition) ? r.condition : 'near_mint',
          variant: ['normal', 'holo', 'reverse_holo'].includes(r.variant) ? r.variant : 'normal',
          acquisition_date: r.acquisition_date || new Date().toISOString().slice(0, 10),
          purchase_price: r.purchase_price ? Math.round(Number(r.purchase_price)) : null,
          market_value: r.market_value ? Math.round(Number(r.market_value)) : null,
          notes: r.notes || '',
        };
        stamped.push(await stampRecord(entry, NSID.COLLECTION_ENTRY, did, signingKey));
      }
      const created = await base44.entities.CollectionEntry.bulkCreate(stamped);
      setMsg({ type: 'ok', text: `Imported ${created.length} cards.` });
      onImported?.();
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-1 font-bold">Export</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Download your collection for backup or transfer.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportJson}
            disabled={busy}
            className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            <FileJson className="h-4 w-4" /> Export JSON
          </button>
          <button
            onClick={exportCsv}
            disabled={busy}
            className="flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-2 text-sm font-bold hover:bg-secondary/80 disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-1 font-bold">Import (CSV)</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Upload a CSV with columns: {COLLECTION_FIELDS.join(', ')}. Prices in pence.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-bold hover:bg-secondary/80 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {busy ? 'Processing…' : 'Choose CSV file'}
        </button>
      </div>

      {msg && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            msg.type === 'ok'
              ? 'border-success/40 bg-success/10 text-success'
              : 'border-destructive/40 bg-destructive/10 text-destructive'
          }`}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}