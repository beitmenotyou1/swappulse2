import { jsPDF } from 'jspdf';

/**
 * Client-side PDF generation for SwapPulse set checklists and binder
 * placeholder pages.  Uses jspdf vector APIs — no server needed.
 *
 * All PDFs use a light print theme with SwapPulse brand accents
 * (purple #6d4aff, gold #F5B700) and include footer branding.
 */

const C = {
  text: [15, 23, 42],
  textLight: [107, 114, 128],
  primary: [109, 74, 255],
  gold: [245, 183, 0],
  success: [16, 185, 129],
  danger: [239, 68, 68],
  border: [229, 231, 235],
  ownedBg: [236, 253, 245],
  headerBg: [26, 29, 40],
  headerText: [245, 246, 250],
  placeholderBg: [249, 250, 251],
  placeholderBorder: [209, 213, 219],
};

const RARITY_COLORS = {
  Common: [156, 163, 175],
  Uncommon: [192, 192, 192],
  Rare: [59, 130, 246],
  'Rare Holo': [245, 183, 0],
  'Rare EX': [139, 92, 246],
  'Rare V': [139, 92, 246],
  'Rare VMAX': [139, 92, 246],
  'Secret Rare': [139, 92, 246],
};

function rarityRGB(rarity) {
  return RARITY_COLORS[rarity] || C.textLight;
}

function setFill(doc, [r, g, b]) { doc.setFillColor(r, g, b); }
function setDraw(doc, [r, g, b]) { doc.setDrawColor(r, g, b); }
function setText(doc, [r, g, b]) { doc.setTextColor(r, g, b); }

function truncate(text, max) {
  if (!text) return '';
  return text.length <= max ? text : text.slice(0, max - 1) + '\u2026';
}

function paginate(arr, size) {
  const pages = [];
  for (let i = 0; i < arr.length; i += size) pages.push(arr.slice(i, i + size));
  return pages;
}

/* ── CHECKLIST PDF ─────────────────────────────────────────────── */

export function generateChecklistPDF({ setName, setId, totalCards, ownedLocalIds, allCards, pageSize = 'a4' }) {
  const doc = new jsPDF({ format: pageSize, unit: 'mm' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const owned = new Set(ownedLocalIds);
  const ownedCount = allCards.filter((c) => owned.has(c.localId)).length;
  const missing = allCards.filter((c) => !owned.has(c.localId));
  const pct = totalCards ? Math.round((ownedCount / totalCards) * 100) : 0;

  // ── Cover page ──
  setFill(doc, C.headerBg);
  doc.rect(0, 0, W, H * 0.35, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  setText(doc, C.headerText);
  doc.text(setName.toUpperCase(), W / 2, 55, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  setText(doc, [160, 166, 184]);
  doc.text(`Set Code: ${setId.toUpperCase()}`, W / 2, 68, { align: 'center' });

  // Completion bar
  const barW = 140, barX = (W - barW) / 2, barY = 85;
  setFill(doc, C.border);
  doc.roundedRect(barX, barY, barW, 10, 5, 5, 'F');
  setFill(doc, pct === 100 ? C.success : C.primary);
  doc.roundedRect(barX, barY, (barW * pct) / 100, 10, 5, 5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  setText(doc, C.text);
  doc.text(`${pct}% Complete`, W / 2, barY + 22, { align: 'center' });

  // Stats row
  const stats = [
    { label: 'Total', value: totalCards || allCards.length, color: C.text },
    { label: 'Owned', value: ownedCount, color: C.success },
    { label: 'Missing', value: missing.length, color: C.danger },
  ];
  const boxW = 45, gap = 12, startX = (W - (boxW * 3 + gap * 2)) / 2, statY = barY + 35;
  stats.forEach((s, i) => {
    const x = startX + i * (boxW + gap);
    setFill(doc, [248, 250, 252]);
    doc.roundedRect(x, statY, boxW, 26, 4, 4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    setText(doc, s.color);
    doc.text(String(s.value), x + boxW / 2, statY + 12, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setText(doc, C.textLight);
    doc.text(s.label, x + boxW / 2, statY + 20, { align: 'center' });
  });

  _footer(doc, W, H);

  // ── Card grid pages ──
  const perPage = 12;
  const pages = paginate(allCards, perPage);
  pages.forEach((pageCards, pi) => {
    doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    setText(doc, C.text);
    doc.text(`${setName}, Card Checklist`, 15, 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setText(doc, C.textLight);
    doc.text(`Page ${pi + 1}`, W - 25, 18, { align: 'right' });
    setDraw(doc, C.border);
    doc.setLineWidth(0.3);
    doc.line(15, 22, W - 15, 22);

    const cols = 3, slotW = 58, slotH = 52, gapX = 6, gapY = 8;
    const startX = 15, startY = 28;
    pageCards.forEach((card, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = startX + col * (slotW + gapX);
      const y = startY + row * (slotH + gapY);
      const isOwned = owned.has(card.localId);

      setFill(doc, isOwned ? C.ownedBg : [255, 255, 255]);
      doc.roundedRect(x, y, slotW, slotH, 3, 3, 'F');
      setDraw(doc, isOwned ? C.success : C.border);
      doc.setLineWidth(isOwned ? 0.8 : 0.3);
      doc.roundedRect(x, y, slotW, slotH, 3, 3, 'S');

      // Checkbox
      const cbX = x + 4, cbY = y + 4, cbS = 7;
      setDraw(doc, C.primary);
      doc.setLineWidth(0.6);
      doc.roundedRect(cbX, cbY, cbS, cbS, 1.5, 1.5, 'S');
      if (isOwned) {
        setFill(doc, C.success);
        doc.roundedRect(cbX, cbY, cbS, cbS, 1.5, 1.5, 'F');
        setDraw(doc, [255, 255, 255]);
        doc.setLineWidth(1.2);
        doc.line(cbX + 1.5, cbY + 3.5, cbX + 3, cbY + 5);
        doc.line(cbX + 3, cbY + 5, cbX + 5.5, cbY + 1.5);
      }

      // Card number
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      setText(doc, C.textLight);
      doc.text(`#${card.localId}`, cbX + cbS + 3, cbY + 5);

      // Card name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      setText(doc, isOwned ? C.success : C.text);
      doc.text(truncate(card.name, 30), x + 4, cbY + cbS + 5, { maxWidth: slotW - 8 });

      // Rarity
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      setText(doc, rarityRGB(card.rarity));
      doc.text(truncate(card.rarity || 'Unknown', 22), x + 4, y + slotH - 8);
    });

    _footer(doc, W, H);
  });

  // ── Missing cards page ──
  if (missing.length > 0) {
    doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    setText(doc, C.danger);
    doc.text(`Still Needed, ${missing.length} Cards`, 15, 20);
    setDraw(doc, C.border);
    doc.setLineWidth(0.5);
    doc.line(15, 24, W - 15, 24);

    const sorted = [...missing].sort((a, b) => {
      const na = parseInt(a.localId), nb = parseInt(b.localId);
      return (isNaN(na) ? 999 : na) - (isNaN(nb) ? 999 : nb);
    });

    let y = 32;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    sorted.forEach((card) => {
      if (y > H - 20) { doc.addPage(); y = 20; }
      setText(doc, C.text);
      doc.text(`#${card.localId}`, 18, y);
      doc.text(truncate(card.name, 35), 40, y);
      setText(doc, rarityRGB(card.rarity));
      doc.text(truncate(card.rarity || 'Unknown', 18), 120, y);
      y += 7;
    });

    _footer(doc, W, H);
  }

  // ── Notes page ──
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  setText(doc, C.text);
  doc.text('Notes & Trade Wishlist', 15, 20);
  setDraw(doc, C.border);
  doc.setLineWidth(0.5);
  doc.line(15, 24, W - 15, 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setText(doc, C.textLight);
  doc.text('Trade offers, wanted cards, condition notes:', 15, 32);

  setDraw(doc, [229, 231, 235]);
  doc.setLineWidth(0.2);
  for (let i = 0; i < 22; i++) {
    const ly = 40 + i * 11;
    if (ly > H - 20) break;
    doc.line(15, ly, W - 15, ly);
  }

  _footer(doc, W, H);

  doc.save(`${setId}-checklist.pdf`);
}

/* ── BINDER PAGES PDF ──────────────────────────────────────────── */

export function generateBinderPagesPDF({ setName, setId, totalCards, ownedLocalIds, allCards, pageSize = 'a4' }) {
  const doc = new jsPDF({ format: pageSize, unit: 'mm' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const owned = new Set(ownedLocalIds);
  const ownedCount = allCards.filter((c) => owned.has(c.localId)).length;
  const pct = totalCards ? Math.round((ownedCount / totalCards) * 100) : 0;

  // ── Cover page ──
  setFill(doc, C.placeholderBg);
  doc.rect(0, 0, W, H, 'F');
  setDraw(doc, C.primary);
  doc.setLineWidth(1.5);
  doc.roundedRect(10, 10, W - 20, H - 20, 3, 3, 'S');
  setDraw(doc, C.gold);
  doc.setLineWidth(0.4);
  doc.roundedRect(14, 14, W - 28, H - 28, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  setText(doc, C.text);
  doc.text(setName.toUpperCase(), W / 2, 50, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  setText(doc, C.textLight);
  doc.text("Collector's Binder", W / 2, 62, { align: 'center' });

  // Info box
  const infoY = 75, infoH = 42;
  setFill(doc, [255, 255, 255]);
  doc.roundedRect(30, infoY, W - 60, infoH, 4, 4, 'F');
  setDraw(doc, C.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(30, infoY, W - 60, infoH, 4, 4, 'S');

  const infoLines = [
    `Set Code: ${setId.toUpperCase()}`,
    `Total Cards: ${totalCards || allCards.length}`,
    `Completion: ${pct}% (${ownedCount}/${totalCards || allCards.length})`,
  ];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  setText(doc, C.text);
  infoLines.forEach((line, i) => {
    doc.text(line, W / 2, infoY + 12 + i * 12, { align: 'center' });
  });

  _holeGuides(doc, H);
  _footer(doc, W, H, 'Print on A4 or Letter, 3-hole punch');

  // ── Slot pages (6 per page: 2×3) ──
  const perPage = 6;
  const pages = paginate(allCards, perPage);
  pages.forEach((pageCards, pi) => {
    doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    setText(doc, C.text);
    doc.text(`${setName}, Page ${pi + 1} of ${pages.length}`, 25, 16);

    const cols = 2, rows = 3;
    const slotW = 72, slotH = 72, gapX = 10, gapY = 10;
    const usableW = W - 25 - 15;
    const usableH = H - 25 - 20;
    const gridW = cols * slotW + (cols - 1) * gapX;
    const gridH = rows * slotH + (rows - 1) * gapY;
    const gx = 25 + (usableW - gridW) / 2;
    const gy = 22 + (usableH - gridH) / 2;

    pageCards.forEach((card, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = gx + col * (slotW + gapX);
      const y = gy + row * (slotH + gapY);
      const isOwned = owned.has(card.localId);

      // Slot background
      setFill(doc, isOwned ? C.ownedBg : C.placeholderBg);
      doc.roundedRect(x, y, slotW, slotH, 4, 4, 'F');
      setDraw(doc, isOwned ? C.success : C.placeholderBorder);
      doc.setLineWidth(isOwned ? 1 : 0.5);
      doc.roundedRect(x, y, slotW, slotH, 4, 4, 'S');

      // Dashed inner frame
      setDraw(doc, C.placeholderBorder);
      doc.setLineWidth(0.3);
      doc.setLineDashPattern([2, 2], 0);
      doc.roundedRect(x + 3, y + 3, slotW - 6, slotH - 6, 3, 3, 'S');
      doc.setLineDashPattern([], 0);

      // Placeholder text
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      setText(doc, isOwned ? C.success : [156, 163, 175]);
      doc.text(isOwned ? '[ OWNED ]' : '[ PLACEHOLDER ]', x + slotW / 2, y + slotH / 2 - 4, { align: 'center' });
      doc.text(truncate(card.name, 24), x + slotW / 2, y + slotH / 2 + 6, { align: 'center' });

      // Card info bar
      const barY = y + slotH - 14;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      setText(doc, C.text);
      doc.text(`#${card.localId}`, x + 5, barY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      setText(doc, rarityRGB(card.rarity));
      doc.text(truncate(card.rarity || 'Unknown', 14), x + 18, barY);

      // QR placeholder
      const qrS = 12, qrX = x + slotW - qrS - 4, qrY = y + 4;
      setFill(doc, [255, 255, 255]);
      doc.roundedRect(qrX, qrY, qrS, qrS, 1, 1, 'F');
      setDraw(doc, C.border);
      doc.setLineWidth(0.3);
      doc.roundedRect(qrX, qrY, qrS, qrS, 1, 1, 'S');
      _qrPattern(doc, qrX + 1.5, qrY + 1.5, qrS - 3);

      // Owned badge
      if (isOwned) {
        setFill(doc, C.success);
        doc.roundedRect(x + slotW - 20, barY - 3, 16, 8, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        setText(doc, [255, 255, 255]);
        doc.text('OWNED', x + slotW - 12, barY + 2.5, { align: 'center' });
      }

      // Notes field
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      setText(doc, C.textLight);
      doc.text('Cond: ______ Acquired: ______', x + 5, barY + 6);
    });

    _holeGuides(doc, H);
    _footer(doc, W, H, `Page ${pi + 1}/${pages.length}`);
  });

  // ── Back page (notes + wishlist) ──
  doc.addPage();
  setFill(doc, C.placeholderBg);
  doc.rect(0, 0, W, H, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  setText(doc, C.text);
  doc.text('Trade Wishlist & Notes', 25, 22);
  setDraw(doc, C.border);
  doc.setLineWidth(0.5);
  doc.line(25, 26, W - 15, 26);

  // Wishlist table header
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setText(doc, C.textLight);
  doc.text('#', 30, 34);
  doc.text('Card Name', 50, 34);
  doc.text('Rarity', 120, 34);
  doc.text('Est. Value', 155, 34);
  doc.text('Priority', 185, 34);
  setDraw(doc, C.border);
  doc.setLineWidth(0.3);
  doc.line(30, 36, W - 15, 36);

  let y = 42;
  for (let i = 0; i < 12; i++) {
    if (y > H - 60) break;
    setText(doc, C.textLight);
    doc.text('____', 30, y);
    doc.text('______________________________', 50, y);
    doc.text('________', 120, y);
    doc.text('$ _______', 155, y);
    doc.setFontSize(7);
    doc.text('L  M  H', 185, y);
    doc.setFontSize(9);
    y += 9;
  }

  // Notes lines
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  setText(doc, C.text);
  doc.text('General Notes', 30, y);
  y += 8;
  setDraw(doc, [229, 231, 235]);
  doc.setLineWidth(0.2);
  for (let i = 0; i < 10; i++) {
    if (y > H - 30) break;
    doc.line(30, y, W - 15, y);
    y += 9;
  }

  _holeGuides(doc, H);
  _footer(doc, W, H, 'SwapPulse Collector\u2019s Binder');

  doc.save(`${setId}-binder-pages.pdf`);
}

/* ── Shared helpers ───────────────────────────────────────────── */

function _footer(doc, W, H, extra) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  setText(doc, C.textLight);
  const parts = ['SwapPulse  \u00b7  swappulse.org'];
  if (extra) parts.push(extra);
  doc.text(parts.join('  \u00b7  '), W / 2, H - 8, { align: 'center' });
  doc.setFontSize(6);
  setText(doc, [180, 184, 194]);
  doc.text('Card data from TCGDex. Pokemon and related characters are trademarks of Nintendo.', W / 2, H - 4, { align: 'center' });
}

function _holeGuides(doc, H) {
  const x = 8;
  const top = 80, bot = 80;
  const spacing = (H - top - bot) / 2;
  const holes = [top + spacing / 2, top + spacing, top + spacing + spacing / 2];
  holes.forEach((hy) => {
    setFill(doc, [209, 213, 219]);
    doc.circle(x, hy, 3, 'F');
    setDraw(doc, [156, 163, 175]);
    doc.setLineWidth(0.3);
    doc.circle(x, hy, 2.5, 'S');
  });
}

function _qrPattern(doc, x, y, size) {
  const cells = 5;
  const cs = size / cells;
  const pattern = ['11111', '10001', '10101', '10001', '11111'];
  setFill(doc, [15, 23, 42]);
  for (let r = 0; r < pattern.length; r++) {
    for (let c = 0; c < pattern[r].length; c++) {
      if (pattern[r][c] === '1') {
        doc.rect(x + c * cs, y + r * cs, cs, cs, 'F');
      }
    }
  }
}