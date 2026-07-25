import React, { useState } from 'react';
import { FileText, Loader2, Download, Shield } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { formatPrice, conditionLabel, variantLabel } from '@/lib/format';

// §4 Insurance PDF export - builds a dated, per-item valuation PDF with jsPDF,
// uploads it via the platform file store, and records a Document (insurance_report).
export default function InsuranceExport({ items }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [lastUrl, setLastUrl] = useState(null);

  const totalValue = items.reduce((s, c) => s + (c.market_value || c.purchase_price || 0), 0);
  const counted = items.filter((i) => i.market_value || i.purchase_price).length;

  const generate = async () => {
    setBusy(true);
    setStatus('Building PDF…');
    setLastUrl(null);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const today = new Date().toLocaleDateString('en-GB');

      // Header band
      doc.setFillColor(15, 17, 23);
      doc.rect(0, 0, 595, 80, 'F');
      doc.setTextColor(245, 246, 250);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('SwapPulse Collection Insurance Report', 40, 38);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(160, 166, 184);
      doc.text(`Generated ${today}  ·  ${items.length} items  ·  Total declared value ${formatPrice(totalValue)}`, 40, 58);

      // Column headers
      let y = 110;
      doc.setTextColor(15, 17, 23);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Card', 40, y);
      doc.text('Set', 230, y);
      doc.text('Cond.', 340, y);
      doc.text('Variant', 390, y);
      doc.text('Value', 500, y);
      y += 8;
      doc.setDrawColor(200);
      doc.line(40, y, 555, y);
      y += 14;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      items.forEach((it) => {
        if (y > 800) { doc.addPage(); y = 50; }
        const val = it.market_value || it.purchase_price || 0;
        doc.text(String(it.card_name || '').slice(0, 38), 40, y);
        doc.text(String(it.set_name || '').slice(0, 26), 230, y);
        doc.text(conditionLabel(it.condition), 340, y);
        doc.text(variantLabel(it.variant), 390, y);
        doc.text(formatPrice(val), 500, y);
        y += 16;
      });

      y += 6;
      doc.setDrawColor(200);
      doc.line(40, y, 555, y);
      y += 14;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Total declared value:', 410, y);
      doc.text(formatPrice(totalValue), 500, y);

      const blob = doc.output('blob');
      const file = new File([blob], `swappulse-insurance-${today.replace(/\//g, '-')}.pdf`, { type: 'application/pdf' });

      setStatus('Uploading…');
      const up = await base44.integrations.Core.UploadFile({ file });
      const file_url = up.file_url;
      await base44.entities.Document.create({
        document_type: 'insurance_report',
        blob_url: file_url,
        generated_at: new Date().toISOString(),
        metadata: { item_count: items.length, total_value_pence: totalValue },
      });
      setLastUrl(file_url);
      setStatus('Report ready and saved to your records.');
    } catch (e) {
      setStatus('Error: ' + (e.message || 'unknown'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="flex-1">
          <h2 className="text-sm font-bold">Insurance valuation report</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Generate a dated PDF of your collection - card, set, condition, variant and value per item - for insurance claims and valuations.
          </p>
          <p className="mt-2 text-xs">
            <span className="text-muted-foreground">Items with a value:</span>{' '}
            <span className="font-semibold">{counted}</span> ·{' '}
            <span className="text-muted-foreground">Total:</span>{' '}
            <span className="font-semibold">{formatPrice(totalValue)}</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={generate}
              disabled={busy || items.length === 0}
              className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Generate PDF
            </button>
            {lastUrl && (
              <a
                href={lastUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
              >
                <Download className="h-4 w-4" /> Download
              </a>
            )}
          </div>
          {status && <p className="mt-2 text-xs text-muted-foreground">{status}</p>}
        </div>
      </div>
    </div>
  );
}