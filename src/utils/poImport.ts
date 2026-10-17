// ─────────────────────────────────────────────────────────────────────────────
// Purchase Order (PO) PDF import — pure parsing & validation logic.
//
// Input is a flat list of positioned words (from the PDF text layer via
// pdf.js, or from OCR word boxes via Tesseract TSV — see poExtract.ts).
// The parser is column-driven: it finds the table's header row, derives
// column x-bands from the header words, then assigns every body word to a
// column by position. That survives different PO generators whose column
// widths differ, and both text and OCR sources.
//
// Nothing here trusts the extraction blindly: validatePo() re-checks the
// PO's own arithmetic (Qty × Price = Amount per row, rows foot to the
// printed totals, tax rate derived per row) so the review screen can flag
// any mis-read digit before the bill form is filled.
// ─────────────────────────────────────────────────────────────────────────────

export interface PoWord {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  page: number;
}

export interface PoItem {
  itemName: string;
  specification: string;
  description: string;
  unit: string;
  qty: number;
  rate: number;
  amount: number; // as printed/derived on the PO (exclusive of tax)
  taxAmount: number; // as printed on the PO (0 when the PO has no tax column)
}

export interface PoData {
  clientName: string;
  clientAddress: string;
  poNo: string;
  poDate: string; // display form as printed, e.g. "18 Nov, 2025"
  supplier: string;
  terms: string;
  items: PoItem[];
  totalExclusive: number | null;
  totalTax: number | null;
  totalInclusive: number | null;
  source: 'text' | 'ocr' | 'gemini';
}

/** A raw extracted row, before shared finalizing (used by every engine). */
export interface PoRawItem {
  itemName: string;
  specification: string;
  unitRaw: string;
  qty: number;
  rate: number;
  amount: number;
  taxAmount: number;
}

/**
 * Shared finalize for all extraction engines (text parser, OCR, Gemini):
 * derive any one missing figure from the other two, repair a lost-decimal
 * tax figure, combine description and normalize the unit.
 */
export function buildPoItems(raw: PoRawItem[]): PoItem[] {
  const items: PoItem[] = [];
  for (const r of raw) {
    const itemName = (r.itemName || '').replace(/\s+/g, ' ').trim();
    const specification = (r.specification || '').replace(/\s+/g, ' ').trim();
    let qty = Number(r.qty) || 0;
    let rate = Number(r.rate) || 0;
    let amount = Number(r.amount) || 0;
    if (!amount && qty && rate) amount = Math.round(qty * rate * 100) / 100;
    if (!rate && qty && amount) rate = Math.round((amount / qty) * 100) / 100;
    if (!qty && rate && amount) qty = Math.round((amount / rate) * 100) / 100;
    if (!itemName && !specification && !amount && !qty) continue;
    let taxAmount = Number(r.taxAmount) || 0;
    // Classic reading slip: the decimal point of the tax figure is lost
    // ("45.00" → "4500", an impossible 1800% rate). One shift repairs it.
    if (amount > 0 && taxAmount > amount * 0.5 && taxAmount / 100 <= amount * 0.35) {
      taxAmount = Math.round((taxAmount / 100) * 100) / 100;
    }
    items.push({
      itemName,
      specification,
      description: combinePoDescription(itemName, specification),
      unit: normalizePoUnit(r.unitRaw || ''),
      qty,
      rate,
      amount,
      taxAmount,
    });
  }
  return items;
}

interface PoLine {
  page: number;
  y: number;
  words: PoWord[];
  text: string;
}

/** Parse a money/number token: "PKR. 1,350.00" / "1,350.00" / OCR noise. */
export function parsePoNumber(raw: string): number | null {
  if (!raw) return null;
  let s = String(raw).replace(/PKR\.?/gi, '').replace(/Rs\.?/gi, '').replace(/,/g, '').trim();
  if (!s) return null;
  // A bare run of zeros with no decimal point ("000") is OCR garbage for a
  // digit group it could not read — never a real printed figure.
  if (/^0+$/.test(s)) return null;
  // A token with no real digit at all is never a number — OCR turns table
  // rules into "|" and unreadable digit groups into "ooo"; repairing those
  // would invent figures (the "|" became a phantom 1 in testing).
  if (!/[0-9]/.test(s)) return null;
  // In a purely numeric context, common OCR confusions are safe to repair.
  if (/^[0-9OolI|.]+$/.test(s)) {
    s = s.replace(/[Oo]/g, '0').replace(/[lI|]/g, '1');
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const isNumericToken = (t: string): boolean => parsePoNumber(t) !== null;

/** Group positioned words into visual lines, page by page. */
export function groupPoLines(words: PoWord[]): PoLine[] {
  const lines: PoLine[] = [];
  const sorted = [...words].sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
  for (const w of sorted) {
    const last = lines[lines.length - 1];
    const tol = Math.max(5, (w.h || 10) * 0.55);
    if (last && last.page === w.page && Math.abs(w.y - last.y) <= tol) {
      last.words.push(w);
      last.y = (last.y * (last.words.length - 1) + w.y) / last.words.length;
    } else {
      lines.push({ page: w.page, y: w.y, words: [w], text: '' });
    }
  }
  for (const l of lines) {
    l.words.sort((a, b) => a.x - b.x);
    l.text = l.words.map((w) => w.text).join(' ');
  }
  return lines;
}

type ColKey = 'desc' | 'spec' | 'unit' | 'pack' | 'price' | 'qty' | 'amount' | 'tax';

const COL_ORDER: ColKey[] = ['desc', 'spec', 'unit', 'pack', 'price', 'qty', 'amount', 'tax'];

/** Drop OCR punctuation debris ("~~", stray ".") from a description fragment. */
const cleanFragment = (s: string): string =>
  (s || '')
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter((tk) => /[A-Za-z0-9]/.test(tk))
    .join(' ')
    .trim();

/** Combine the PO's generic item name + specification into one bill description. */
export function combinePoDescription(itemName: string, specification: string): string {
  const a = cleanFragment(itemName || '');
  const b = cleanFragment(specification || '');
  if (!a) return b;
  if (!b) return a;
  const al = a.toLowerCase();
  const bl = b.toLowerCase();
  if (al === bl) return a;
  if (bl.includes(al)) return b;
  if (al.includes(bl)) return a;
  return `${a} ${b}`;
}

/** Normalize PO unit-of-measure text to the short forms used on bills. */
export function normalizePoUnit(raw: string): string {
  const s = (raw || '').toUpperCase();
  if (!s.trim()) return 'Nos';
  if (s.includes('PACK') || s.includes('(PAK')) return 'Pack';
  if (s.includes('EACH')) return 'Each';
  if (s.includes('PIECE') || s.includes('PEICE') || s.includes('(PC') || s.includes('PCE')) return 'Pcs';
  if (s.includes('NOS') || s.includes('NO.')) return 'Nos';
  if (s.includes('KG') || s.includes('KILOGRAM')) return 'Kg';
  if (s.includes('LITRE') || s.includes('LITER') || s.includes('LTR')) return 'Litre';
  if (s.includes('REAM')) return 'Ream';
  if (s.includes('SET')) return 'Set';
  if (s.includes('BOX')) return 'Box';
  if (s.includes('DOZEN')) return 'Dozen';
  const first = (raw || '').replace(/[^A-Za-z]/g, ' ').trim().split(/\s+/)[0] || 'Nos';
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function findHeaderBand(lines: PoLine[], page: number): { cols: Partial<Record<ColKey, number>>; bandBottom: number; headerY: number; rightCapX?: number } | null {
  const pageLines = lines.filter((l) => l.page === page);
  for (let i = 0; i < pageLines.length; i++) {
    const t = pageLines[i].text.toLowerCase();
    if (!(t.includes('description') && (t.includes('quantity') || t.includes('qty')))) continue;
    // Header labels may wrap onto the next visual line ("Unit of Measure",
    // "Tax Amount") — absorb following lines that carry header keywords and
    // sit within ~2 line heights.
    const band: PoLine[] = [pageLines[i]];
    const lineH = Math.max(...pageLines[i].words.map((w) => w.h || 10));
    for (let j = i + 1; j < pageLines.length; j++) {
      const nl = pageLines[j];
      if (nl.y - pageLines[i].y > lineH * 2.2) break;
      const nt = nl.text.toLowerCase();
      if (/measure|size|amount|date|specification|description|price|quantity|pack|unit|tax/.test(nt) && !/\d{3,}/.test(nt)) {
        band.push(nl);
      } else break;
    }
    const bandWords = band.flatMap((l) => l.words);
    const cx = (w: PoWord) => w.x + (w.w || 0) / 2;
    const find = (re: RegExp) => bandWords.find((w) => re.test(w.text));
    const cols: Partial<Record<ColKey, number>> = {};
    const desc = find(/^description/i);
    if (desc) cols.desc = cx(desc);
    const spec = find(/^specification/i);
    if (spec) cols.spec = cx(spec);
    const unit = find(/^unit/i);
    if (unit) cols.unit = cx(unit);
    const pack = find(/^pack/i);
    if (pack) cols.pack = cx(pack);
    const price = find(/^price/i) || find(/^rate/i);
    if (price) cols.price = cx(price);
    const qty = find(/^quantity/i) || find(/^qty/i);
    if (qty) cols.qty = cx(qty);
    // Tolerate a truncated final letter ("Amoun") — pdf.js sometimes splits
    // a kerned header word mid-way.
    const amountWords = bandWords.filter((w) => /^amoun/i.test(w.text)).sort((a, b) => a.x - b.x);
    if (amountWords.length >= 1) cols.amount = cx(amountWords[0]);
    if (amountWords.length >= 2) cols.tax = cx(amountWords[1]);
    if (cols.qty === undefined || (cols.price === undefined && cols.amount === undefined)) return null;
    const bandBottom = Math.max(...band.map((l) => l.y + Math.max(...l.words.map((w) => w.h || 10))));
    // First header word right of the last numeric column (Delivery, Date,
    // Quoted…) — used to cap that column so date figures cannot leak in.
    const lastNumericC = Math.max(cols.tax ?? 0, cols.amount ?? 0, cols.qty ?? 0);
    const rightWord = bandWords
      .filter((w) => cx(w) > lastNumericC + 10)
      .sort((a, b) => a.x - b.x)[0];
    return { cols, bandBottom, headerY: pageLines[i].y, rightCapX: rightWord ? cx(rightWord) : undefined };
  }
  return null;
}

function colBoundaries(
  cols: Partial<Record<ColKey, number>>,
  rightCapX?: number
): { key: ColKey; from: number; to: number }[] {
  const present = COL_ORDER.filter((k) => cols[k] !== undefined)
    .map((k) => ({ key: k, c: cols[k]! }))
    .sort((a, b) => a.c - b.c);
  return present.map((p, i) => {
    let to = i === present.length - 1 ? Infinity : (p.c + present[i + 1].c) / 2;
    // The rightmost column must not run to infinity: PO tables continue with
    // date columns ("18,2025" reads as the number 182025) that would leak
    // into Amount/Tax. Cap it at the next header word (Delivery/Date…) when
    // known, else at one column-width past its own centre.
    if (i === present.length - 1) {
      const prevC = i > 0 ? present[i - 1].c : p.c - 100;
      const widthCap = p.c + Math.abs(p.c - prevC) * 0.75;
      to = rightCapX !== undefined ? Math.min((p.c + rightCapX) / 2, widthCap) : widthCap;
    }
    return { key: p.key, from: i === 0 ? -Infinity : (present[i - 1].c + p.c) / 2, to };
  });
}

interface RawRow {
  desc: string[];
  spec: string[];
  unit: string[];
  qty: number | null;
  rate: number | null;
  amount: number | null;
  tax: number | null;
}

function emptyRow(): RawRow {
  return { desc: [], spec: [], unit: [], qty: null, rate: null, amount: null, tax: null };
}

function parsePageRows(lines: PoLine[], page: number): PoItem[] {
  const band = findHeaderBand(lines, page);
  if (!band) return [];
  const bounds = colBoundaries(band.cols, band.rightCapX);
  const pageLines = lines.filter((l) => l.page === page && l.y > band.bandBottom - 2);

  const colOf = (w: PoWord): ColKey | null => {
    const c = w.x + (w.w || 0) / 2;
    const b = bounds.find((bb) => c >= bb.from && c < bb.to);
    return b ? b.key : null;
  };

  // A table row is a CLUSTER of visual lines: wrapped cells scatter a row's
  // words over 2–3 tightly-spaced lines (digits may sit a line above or
  // below the description), then a visibly larger gap precedes the next
  // row. Cluster by that gap, scaled to the page's own word height.
  const heights = pageLines.flatMap((l) => l.words.map((w) => w.h || 10)).sort((a, b) => a - b);
  const medianH = heights.length ? heights[Math.floor(heights.length / 2)] : 12;
  const gapThreshold = medianH * 1.55;
  const clusters: PoLine[][] = [];
  for (const line of pageLines) {
    const lt = line.text.toLowerCase();
    if (/total\s+(exclusive|inclusive)|total\s+tax|system generated/.test(lt)) break;
    if (/^page\s+\d+/.test(lt)) continue;
    const prev = clusters[clusters.length - 1];
    const prevLast = prev ? prev[prev.length - 1] : null;
    if (!prev || !prevLast || line.y - prevLast.y > gapThreshold) clusters.push([line]);
    else prev.push(line);
  }

  const rows: RawRow[] = [];
  for (const cluster of clusters) {
    const cells: Partial<Record<ColKey, string[]>> = {};
    for (const line of cluster) {
      for (const w of line.words) {
        const col = colOf(w);
        if (!col) continue;
        (cells[col] = cells[col] || []).push(w.text);
      }
    }
    const numIn = (k: ColKey): number | null => {
      for (const tk of cells[k] || []) {
        const n = parsePoNumber(tk);
        if (n !== null) return n;
        // Two figures fused into one token by the PDF text layer
        // ("154,000.0027,720.00") — this column takes the first.
        const fused = tk.replace(/,/g, '').match(/^(\d+\.\d{2})(\d+\.\d{2})$/);
        if (fused) {
          const first = Number(fused[1]);
          if (Number.isFinite(first)) return first;
        }
      }
      return null;
    };
    const row = emptyRow();
    const descText = (cells.desc || []).join(' ').trim();
    const specText = (cells.spec || []).join(' ').trim();
    if (descText) row.desc.push(descText);
    if (specText) row.spec.push(specText);
    const unitText = (cells.unit || []).join(' ').trim();
    if (unitText) row.unit.push(unitText);
    row.qty = numIn('qty');
    row.rate = numIn('price');
    row.amount = numIn('amount');
    row.tax = numIn('tax');
    if (!descText && !specText && row.qty === null && row.rate === null && row.amount === null) continue;
    rows.push(row);
  }

  return buildPoItems(rows.map((r) => ({
    itemName: r.desc.join(' '),
    specification: r.spec.join(' '),
    unitRaw: r.unit.join(' '),
    qty: r.qty ?? 0,
    rate: r.rate ?? 0,
    amount: r.amount ?? 0,
    taxAmount: r.tax ?? 0,
  })));
}

function lastNumberIn(line: PoLine): number | null {
  for (let i = line.words.length - 1; i >= 0; i--) {
    const n = parsePoNumber(line.words[i].text);
    if (n !== null) return n;
  }
  return null;
}

/** Parse positioned words (any page count) into structured PO data. */
export function parsePoWords(words: PoWord[], source: PoData['source']): PoData {
  const lines = groupPoLines(words);
  const pages = Array.from(new Set(words.map((w) => w.page))).sort((a, b) => a - b);
  const allText = lines.map((l) => l.text).join('\n');

  const items: PoItem[] = [];
  for (const p of pages) items.push(...parsePageRows(lines, p));

  // Totals (printed summary block, usually on the last page).
  let totalExclusive: number | null = null;
  let totalTax: number | null = null;
  let totalInclusive: number | null = null;
  for (const l of lines) {
    const t = l.text.toLowerCase();
    if (t.includes('exclusive')) totalExclusive = lastNumberIn(l) ?? totalExclusive;
    else if (t.includes('inclusive')) totalInclusive = lastNumberIn(l) ?? totalInclusive;
    else if (/total\s+tax/.test(t)) totalTax = lastNumberIn(l) ?? totalTax;
  }

  // Header fields come from page 1, above the table.
  const firstPageLines = lines.filter((l) => l.page === (pages[0] ?? 1));
  const clientName = firstPageLines.length ? firstPageLines[0].text.trim() : '';
  const clientAddress = firstPageLines.length > 1 ? firstPageLines[1].text.trim() : '';

  const poNoMatch = allText.match(/PO\s*#\s*:?\s*([0-9][0-9-]*)/i) || allText.match(/PO\s*No\.?\s*:?\s*([0-9][0-9-]*)/i);
  const poDateMatch = allText.match(/PO Date:\s*([0-9]{1,2}\s+[A-Za-z]{3,9},?\s+[0-9]{4})/i);
  let supplier = '';
  let terms = '';
  for (let i = 0; i < firstPageLines.length; i++) {
    const lt = firstPageLines[i].text;
    const sm = lt.match(/Supplier:\s*(.+)/i);
    if (sm) {
      supplier = sm[1].replace(/\s*(Generated|Validity|Mobile|Email).*$/i, '').trim();
    }
    if (/term\(s\)\s*and\s*condition/i.test(lt)) {
      const after = lt.split(/condition\(s\):?/i)[1]?.trim();
      if (after) terms = after;
      else if (firstPageLines[i + 1]) terms = firstPageLines[i + 1].text.trim();
    }
  }

  return {
    clientName,
    clientAddress,
    poNo: poNoMatch ? poNoMatch[1] : '',
    poDate: poDateMatch ? poDateMatch[1].replace(/\s+/g, ' ') : '',
    supplier,
    terms,
    items,
    totalExclusive,
    totalTax,
    totalInclusive,
    source,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation — the PO's own arithmetic is the ground truth. Any extraction
// error almost always breaks one of these checks, which is what makes the
// review screen trustworthy.
// ─────────────────────────────────────────────────────────────────────────────

export interface PoRowCheck {
  index: number;
  amountOk: boolean;
  amountDiff: number;
  derivedRatePercent: number | null;
}

export interface PoValidation {
  rowChecks: PoRowCheck[];
  sumExclusive: number;
  sumTax: number;
  sumInclusive: number;
  totalsMatch: boolean | null; // null when the PO printed no totals block
  dominantRatePercent: number | null; // rate shared by most rows, if any
  issueCount: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function validatePo(po: PoData): PoValidation {
  const rowChecks: PoRowCheck[] = po.items.map((it, index) => {
    const computed = round2(it.qty * it.rate);
    const amountDiff = round2(computed - it.amount);
    return {
      index,
      // A row whose rate/amount could not be read at all (both collapse to
      // 0 and trivially "agree") is a failed row, not a passing one.
      amountOk: Math.abs(amountDiff) <= 0.51 && it.amount > 0 && it.rate > 0,
      amountDiff,
      derivedRatePercent: it.amount > 0 && it.taxAmount > 0 ? round2((it.taxAmount / it.amount) * 100) : null,
    };
  });
  const sumExclusive = round2(po.items.reduce((s, it) => s + it.amount, 0));
  const sumTax = round2(po.items.reduce((s, it) => s + it.taxAmount, 0));
  const sumInclusive = round2(sumExclusive + sumTax);
  let totalsMatch: boolean | null = null;
  if (po.totalExclusive !== null || po.totalTax !== null || po.totalInclusive !== null) {
    totalsMatch =
      (po.totalExclusive === null || Math.abs(sumExclusive - po.totalExclusive) <= 1) &&
      (po.totalTax === null || Math.abs(sumTax - po.totalTax) <= 1) &&
      (po.totalInclusive === null || Math.abs(sumInclusive - po.totalInclusive) <= 1);
  }
  const rateCounts = new Map<number, number>();
  for (const rc of rowChecks) {
    if (rc.derivedRatePercent !== null) {
      rateCounts.set(rc.derivedRatePercent, (rateCounts.get(rc.derivedRatePercent) || 0) + 1);
    }
  }
  let dominantRatePercent: number | null = null;
  let best = 0;
  for (const [r, c] of rateCounts) if (c > best) { best = c; dominantRatePercent = r; }

  const issueCount =
    rowChecks.filter((rc) => !rc.amountOk).length + (totalsMatch === false ? 1 : 0);
  return { rowChecks, sumExclusive, sumTax, sumInclusive, totalsMatch, dominantRatePercent, issueCount };
}

/** "18 Nov, 2025" → "18-Nov-2025" for the bill's PO/reference line. */
export function formatPoDateForRef(poDate: string): string {
  const m = (poDate || '').match(/([0-9]{1,2})\s+([A-Za-z]{3,9}),?\s+([0-9]{4})/);
  if (!m) return (poDate || '').trim();
  const mon = m[2].slice(0, 3);
  return `${m[1]}-${mon.charAt(0).toUpperCase() + mon.slice(1).toLowerCase()}-${m[3]}`;
}

/** Build the bill's RefText from the PO header, in the app's house format. */
export function buildPoRefText(po: PoData): string {
  const parts: string[] = [];
  if (po.poNo) parts.push(`PO #${po.poNo}`);
  const d = formatPoDateForRef(po.poDate);
  if (d) parts.push(`dated ${d}`);
  let ref = parts.join(' ');
  if (po.terms) ref = ref ? `${ref} — ${po.terms}` : po.terms;
  return ref;
}
