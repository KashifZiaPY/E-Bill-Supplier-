import React, { useLayoutEffect, useRef, useState } from 'react';
import type { DocumentRecord, SupplierSettings } from '../../types/billing';
import { calculateTotals, formatCurrency, formatDateDisplay, safeNormalizeItems, toProperCase } from '../../utils/formatters';
import { numberToWordsPakistani } from '../../utils/numberToWords';

interface Props {
  doc: DocumentRecord;
  settings: SupplierSettings;
  printOnLetterhead: boolean;
  /** Letterhead top/bottom padding in inches (from PreviewScreen). Used to adapt page capacity. */
  topPadIn?: number;
  bottomPadIn?: number;
  /** When false, the bill date prints blank (for handwriting); the stored date is kept for records. */
  showDateOnBill?: boolean;
}

interface ItemRowWithSr {
  sr: number;
  description: string;
  unit: string;
  qty: number;
  rate: number;
  amount: number;
  tax: 'GST' | 'PST' | 'None';
  sectionHeader?: string;
}


// ───────────────────────── A4 geometry & density ladder ─────────────────────────
const PX_PER_IN = 96;
const A4_H_PX = (297 / 25.4) * PX_PER_IN;                 // A4 height  ≈ 1122.5px
const PRINT_W_PX = (210 / 25.4) * PX_PER_IN - 0.9 * PX_PER_IN; // A4 width − 2 × 0.45in side margins (@page)
const SAFETY_PX = 14;                                      // ≈ 3.7mm guard against printer/rounding variance

/** Vertical spacing only — font sizes are never changed. Level 0 = previous look. */
const DENSITY_LEVELS = [
  { py: 4, lh: 1.4 },   // comfortable
  { py: 3, lh: 1.3 },   // standard
  { py: 2, lh: 1.25 },  // compact
  { py: 1, lh: 1.2 },   // dense (maximum entries per page)
];

interface PageMetrics {
  headFirst: number; headRun: number; thead: number; grand: number;
  tableExtra: number; cont: number; lastBlock: number; footer: number;
  groups: Record<number, number>;
}

const pageUsed = (M: PageMetrics, rows: ItemRowWithSr[], isFirst: boolean, isLast: boolean): number =>
  (isFirst ? M.headFirst : M.headRun) + M.thead + M.tableExtra + M.footer +
  rows.reduce((s, r) => s + (M.groups[r.sr] || 0), 0) +
  (isLast ? M.grand + M.lastBlock : M.cont);

/** Greedy pixel fill. Pure function: easy to unit-test. */
const paginateMeasured = (M: PageMetrics, items: ItemRowWithSr[], budget: number): ItemRowWithSr[][] => {
  const fits = (rows: ItemRowWithSr[], first: boolean, last: boolean) => pageUsed(M, rows, first, last) <= budget;
  const pages: ItemRowWithSr[][] = [];
  let cur: ItemRowWithSr[] = [];
  for (const it of items) {
    if (cur.length === 0 || fits([...cur, it], pages.length === 0, false)) cur.push(it);
    else { pages.push(cur); cur = [it]; }
  }
  pages.push(cur);

  // The last page must also hold grand total + words + signature.
  const lastIdx = () => pages.length - 1;
  if (!fits(pages[lastIdx()], pages.length === 1, true) && pages[lastIdx()].length > 1) {
    const prev = pages[lastIdx()];
    const fresh: ItemRowWithSr[] = [prev.pop()!];
    pages.push(fresh);
    // Avoid a lonely 1-item last page: pull up to 2 more from the previous page while both pages still fit.
    while (fresh.length < 3 && prev.length > 3) {
      const cand = prev[prev.length - 1];
      if (!fits([cand, ...fresh], false, true)) break;
      fresh.unshift(prev.pop()!);
    }
  }
  return pages;
};

export const BillPrintLayout: React.FC<Props> = ({ doc, settings, printOnLetterhead, topPadIn, bottomPadIn, showDateOnBill = true }) => {
  const rawItems = safeNormalizeItems(doc.items || doc.Items);
  const gstRate = (doc.gstRate !== undefined && doc.gstRate !== null && Number(doc.gstRate) >= 0)
    ? Number(doc.gstRate)
    : ((doc as any).GstRate !== undefined && Number((doc as any).GstRate) >= 0)
    ? Number((doc as any).GstRate)
    : (settings.gstRate || 0.18);
  const pstRate = 0.16; // Punjab PST is fixed at 16%
  const gstPercent = Math.round(gstRate * 100);
  const pstPercent = 16;

  // Dynamic live calculation fallback guarantees accurate totals
  const computed = calculateTotals(rawItems, gstRate, pstRate);

  const goodsSub = (doc.goodsSub && doc.goodsSub > 0) ? doc.goodsSub : (doc.GoodsSub && doc.GoodsSub > 0) ? doc.GoodsSub : computed.goodsSub;
  const gst = (doc.gst && doc.gst > 0) ? doc.gst : (doc.GST && doc.GST > 0) ? doc.GST : computed.gst;
  const serviceSub = (doc.serviceSub && doc.serviceSub > 0) ? doc.serviceSub : (doc.ServiceSub && doc.ServiceSub > 0) ? doc.ServiceSub : computed.serviceSub;
  const pst = (doc.pst && doc.pst > 0) ? doc.pst : (doc.PST && doc.PST > 0) ? doc.PST : computed.pst;
  const otherSub = (doc.otherSub && doc.otherSub > 0) ? doc.otherSub : (doc.OtherSub && doc.OtherSub > 0) ? doc.OtherSub : computed.otherSub;
  const grandTotal = (doc.grandTotal && doc.grandTotal > 0) ? doc.grandTotal : (doc.GrandTotal && doc.GrandTotal > 0) ? doc.GrandTotal : computed.grandTotal;

  // Identify firm and styling personality
  const firmObj = settings.firms?.find((f) => f.id === doc.firmId) ||
    settings.firms?.find((f) => f.name?.toLowerCase().trim() === (doc.firmName || '').toLowerCase().trim());
  const isHashirStyle = doc.firmId === 'firm-hashir-traders' ||
    (doc.firmName || '').toLowerCase().includes('hashir') ||
    firmObj?.styleTheme === 'MODERN_CORPORATE';

  const firmName = doc.firmName || firmObj?.name || settings.supplierName || 'ANWAR TRADERS';
  const firmTagline = firmObj?.tagline || settings.supplierTagline || (isHashirStyle ? 'Govt. Contractor & General Order Supplier' : 'Govt. Contractor & General Order Supplier');
  const firmAddress = firmObj?.address || settings.supplierAddress;
  const firmPhone = firmObj?.phone || settings.supplierPhone;
  const firmNTN = firmObj?.ntn || settings.supplierNTN;
  const firmGST = firmObj?.gst || settings.supplierGST;
  const firmVendor = firmObj?.vendorNo || settings.vendorNo;

  const docNo = doc.docNo || doc.DocNo || '—';
  const docDate = formatDateDisplay(doc.date || doc.Date);
  // Client name always prints in CAPS, however it was typed/stored (Kashif, 2026-10-14).
  const clientName = (doc.clientName || doc.ClientName || 'Client').toUpperCase();
  const clientAddress = doc.clientAddress || doc.ClientAddress || '';
  const clientNTN = doc.clientNTN || doc.ClientNTN || '';
  const refText = doc.refText || doc.RefText || '';

  // Build sequential list with continuous Sr.# and section headers if grouped
  const goodsItems = rawItems.filter((i) => i.tax === 'GST' || (i as any).Tax === 'GST');
  const serviceItems = rawItems.filter((i) => i.tax === 'PST' || (i as any).Tax === 'PST');
  const otherItems = rawItems.filter((i) => i.tax === 'None' || (i as any).Tax === 'None' || (!i.tax && !(i as any).Tax));
  const fallbackAllGoods = goodsItems.length === 0 && serviceItems.length === 0 && otherItems.length === 0 && rawItems.length > 0;

  // Check if goods items have uniform or mixed GST rates
  const distinctGoodsRates = Array.from(
    new Set(
      goodsItems.map((it) => {
        const itemRate = (it.gstRate !== undefined && it.gstRate !== null && !isNaN(Number(it.gstRate)))
          ? Number(it.gstRate)
          : (it.taxRate !== undefined && it.taxRate !== null && !isNaN(Number(it.taxRate)))
          ? Number(it.taxRate)
          : gstRate;
        return Math.round(itemRate * 100);
      })
    )
  );
  const isUniformGoodsRate = distinctGoodsRates.length <= 1;
  const uniformRate = distinctGoodsRates.length === 1 ? distinctGoodsRates[0] : gstPercent;

  const sequentialItems: ItemRowWithSr[] = [];
  let srCounter = 1;

  if (fallbackAllGoods) {
    rawItems.forEach((it) => {
      const q = Number(it.qty ?? (it as any).Qty ?? 1);
      const r = Number(it.rate ?? (it as any).Rate ?? 0);
      sequentialItems.push({
        sr: srCounter++,
        description: String(it.description || (it as any).Description || ''),
        unit: String(it.unit || (it as any).Unit || 'Nos'),
        qty: q,
        rate: r,
        amount: Number(it.amount ?? Math.round(q * r * 100) / 100),
        tax: 'GST',
      });
    });
  } else {
    if (goodsItems.length > 0) {
      goodsItems.forEach((it, idx) => {
        const q = Number(it.qty ?? (it as any).Qty ?? 1);
        const r = Number(it.rate ?? (it as any).Rate ?? 0);
        const itemRate = (it.gstRate !== undefined && it.gstRate !== null && !isNaN(Number(it.gstRate)))
          ? Number(it.gstRate)
          : (it.taxRate !== undefined && it.taxRate !== null && !isNaN(Number(it.taxRate)))
          ? Number(it.taxRate)
          : gstRate;
        const itemRatePct = Math.round(itemRate * 100);

        let descText = String(it.description || (it as any).Description || '');
        if (!isUniformGoodsRate) {
          descText = `${descText} [GST @ ${itemRatePct}%]`;
        }

        sequentialItems.push({
          sr: srCounter++,
          sectionHeader: idx === 0
            ? (isUniformGoodsRate ? `A. GOODS (General Sales Tax - GST @ ${uniformRate}%)` : `A. GOODS (General Sales Tax - GST)`)
            : undefined,
          description: descText,
          unit: String(it.unit || (it as any).Unit || 'Nos'),
          qty: q,
          rate: r,
          amount: Number(it.amount ?? Math.round(q * r * 100) / 100),
          tax: 'GST',
        });
      });
    }

    if (serviceItems.length > 0) {
      serviceItems.forEach((it, idx) => {
        const q = Number(it.qty ?? (it as any).Qty ?? 1);
        const r = Number(it.rate ?? (it as any).Rate ?? 0);
        sequentialItems.push({
          sr: srCounter++,
          sectionHeader: idx === 0 ? `B. SERVICES / LABOUR (Punjab Sales Tax - PST @ ${pstPercent}%)` : undefined,
          description: String(it.description || (it as any).Description || ''),
          unit: String(it.unit || (it as any).Unit || 'Job'),
          qty: q,
          rate: r,
          amount: Number(it.amount ?? Math.round(q * r * 100) / 100),
          tax: 'PST',
        });
      });
    }

    if (otherItems.length > 0) {
      otherItems.forEach((it, idx) => {
        const q = Number(it.qty ?? (it as any).Qty ?? 1);
        const r = Number(it.rate ?? (it as any).Rate ?? 0);
        sequentialItems.push({
          sr: srCounter++,
          sectionHeader: idx === 0 ? 'C. EXEMPT / NON-TAXABLE SUPPLIES' : undefined,
          description: String(it.description || (it as any).Description || ''),
          unit: String(it.unit || (it as any).Unit || 'Nos'),
          qty: q,
          rate: r,
          amount: Number(it.amount ?? Math.round(q * r * 100) / 100),
          tax: 'None',
        });
      });
    }
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  MEASURED PAGINATION  (replaces the old guessed "slot" budgets — 2026-10-15)
  //
  //  Old approach: hand-calibrated item counts per firm/paper ("Anwar plain
  //  16/12 …") and ~29px rows. Any wrapped line, font change or margin change
  //  silently broke the numbers, and rows were too tall to start with.
  //
  //  New approach, 3 steps — no magic item counts anywhere:
  //   1. MEASURE  every real element (page header, table head, each item
  //      "group" = [section header + row + section totals], grand total,
  //      words+signature, footer) in a hidden probe that has the exact print
  //      width (A4 − side margins) and the same fonts/classes as the sheet.
  //   2. FILL     each A4 page greedily to the pixel: page budget =
  //      A4 height − real @page top/bottom margins − safety. A page closes
  //      only when the NEXT group genuinely does not fit.
  //   3. DENSITY  rows have 4 vertical-spacing levels (font size never
  //      changes). The most comfortable level that achieves the smallest
  //      possible page count is chosen automatically, so a 7-item bill keeps
  //      airy rows while a 20-item bill tightens itself to stay on one page.
  // ═══════════════════════════════════════════════════════════════════════
  const sectionFinalSrs = new Set<number>();
  sequentialItems.forEach((it, i) => {
    if (i === sequentialItems.length - 1 || sequentialItems[i + 1].tax !== it.tax) sectionFinalSrs.add(it.sr);
  });

  const bySr = new Map<number, ItemRowWithSr>(sequentialItems.map((it) => [it.sr, it]));
  const topIn = topPadIn ?? (printOnLetterhead ? 2.0 : 0.4);
  const bottomIn = bottomPadIn ?? (printOnLetterhead ? 1.0 : 0.4);
  const pageBudgetPx = A4_H_PX - (topIn + bottomIn) * PX_PER_IN - SAFETY_PX;

  const probeRef = useRef<HTMLDivElement>(null);
  const planKeyRef = useRef('');
  const [plan, setPlan] = useState<{ level: number; pages: number[][] } | null>(null);
  const [fontTick, setFontTick] = useState(0);

  // Re-measure once web fonts are ready (text width changes line wrapping).
  useLayoutEffect(() => {
    let alive = true;
    (document as any).fonts?.ready?.then(() => { if (alive) setFontTick((t) => t + 1); });
    return () => { alive = false; };
  }, []);

  // Runs after every render, but only commits state when the plan changes.
  useLayoutEffect(() => {
    const probe = probeRef.current;
    if (!probe || sequentialItems.length === 0) return;

    const outerH = (el: Element | null): number => {
      if (!el) return 0;
      const cs = getComputedStyle(el);
      return el.getBoundingClientRect().height + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
    };
    const q = (k: string) => probe.querySelector(`[data-m="${k}"]`);

    const measure = (lvl: { py: number; lh: number }): PageMetrics => {
      probe.style.setProperty('--brow-py', `${lvl.py}px`);
      probe.style.setProperty('--brow-lh', String(lvl.lh));
      const groups: Record<number, number> = {};
      let groupsSum = 0;
      probe.querySelectorAll('[data-g]').forEach((el) => {
        const h = el.getBoundingClientRect().height;
        groups[Number((el as HTMLElement).dataset.g)] = h;
        groupsSum += h;
      });
      const thead = (q('thead') as HTMLElement | null)?.getBoundingClientRect().height ?? 0;
      const grand = (q('grand') as HTMLElement | null)?.getBoundingClientRect().height ?? 0;
      const tableEl = q('table') as HTMLElement | null;
      const tableH = tableEl ? outerH(tableEl) : 0;
      return {
        headFirst: outerH(q('headFirst')),
        headRun: outerH(q('headRun')),
        thead, grand, groups,
        tableExtra: Math.max(0, tableH - thead - grand - groupsSum),   // borders + bottom margin
        cont: outerH(q('cont')),
        lastBlock: outerH(q('lastBlock')),
        footer: outerH(q('footer')),
      };
    };

    const pagesPerLevel = DENSITY_LEVELS.map((lvl) =>
      paginateMeasured(measure(lvl), sequentialItems, pageBudgetPx).map((pg) => pg.map((it) => it.sr))
    );
    const tightest = pagesPerLevel[pagesPerLevel.length - 1].length;
    // most comfortable level that still reaches the minimum page count
    let level = pagesPerLevel.findIndex((p) => p.length === tightest);
    if (level < 0) level = DENSITY_LEVELS.length - 1;
    const next = { level, pages: pagesPerLevel[level] };
    const key = JSON.stringify(next);
    if (key !== planKeyRef.current) {
      planKeyRef.current = key;
      setPlan(next);
    }
  });
  void fontTick;

  const density = DENSITY_LEVELS[plan?.level ?? 0];
  const pageChunks: ItemRowWithSr[][] = plan
    ? plan.pages.map((srs) => srs.map((sr) => bySr.get(sr)!).filter(Boolean))
    : [sequentialItems];
  const totalPages = pageChunks.length;

  // Section subtotal row fragments — each prints under its section's last item.
  const goodsSubtotalRows = goodsSub > 0 && (
    <>
      <tr className={`border-t-2 ${isHashirStyle ? 'border-slate-800 bg-white' : 'border-black bg-white'} text-[10pt]`}>
        <td colSpan={4} className={`text-right bill-cell px-2.5 font-bold ${
          isHashirStyle ? 'border-r border-slate-400 text-slate-900' : 'border-r border-black text-black'
        }`}>
          Sub Total (Goods):
        </td>
        <td className="text-right bill-cell px-2.5 font-bold whitespace-nowrap font-mono text-black">
          {formatCurrency(goodsSub)}
        </td>
      </tr>
      {computed.gstBreakdown && computed.gstBreakdown.length > 1 ? (
        <>
          {computed.gstBreakdown.map((b) => (
            <tr key={b.ratePercent} className={`border-b ${isHashirStyle ? 'border-slate-300 bg-white' : 'border-black bg-white'} text-[9.5pt]`}>
              <td colSpan={4} className={`text-right bill-cell px-2.5 font-semibold ${
                isHashirStyle ? 'border-r border-slate-300 text-slate-800' : 'border-r border-black text-black'
              }`}>
                GST @ {b.ratePercent}% (on Rs. {formatCurrency(b.taxableAmount)}):
              </td>
              <td className="text-right bill-cell px-2.5 font-semibold whitespace-nowrap font-mono text-black">
                {formatCurrency(b.taxAmount)}
              </td>
            </tr>
          ))}
          <tr className={`border-b ${isHashirStyle ? 'border-slate-800 bg-white' : 'border-black bg-white'} text-[10pt]`}>
            <td colSpan={4} className={`text-right bill-cell px-2.5 font-bold ${
              isHashirStyle ? 'border-r border-slate-400 text-slate-900' : 'border-r border-black text-black'
            }`}>
              Total GST on Goods:
            </td>
            <td className="text-right bill-cell px-2.5 font-bold whitespace-nowrap font-mono text-black">
              {formatCurrency(gst)}
            </td>
          </tr>
        </>
      ) : (
        <tr className={`border-b ${isHashirStyle ? 'border-slate-800 bg-white' : 'border-black bg-white'} text-[10pt]`}>
          <td colSpan={4} className={`text-right bill-cell px-2.5 font-bold ${
            isHashirStyle ? 'border-r border-slate-400 text-slate-900' : 'border-r border-black text-black'
          }`}>
            {(computed.gstBreakdown?.[0]?.ratePercent ?? (isUniformGoodsRate ? uniformRate : gstPercent))}% GST on Goods:
          </td>
          <td className="text-right bill-cell px-2.5 font-bold whitespace-nowrap font-mono text-black">
            {formatCurrency(gst)}
          </td>
        </tr>
      )}
      {/* Section total: goods inclusive of GST */}
      <tr className={`border-y-2 ${isHashirStyle ? 'border-slate-900 bg-white' : 'border-black bg-white'} text-[10.5pt]`}>
        <td colSpan={4} className={`text-right bill-cell px-2.5 font-black ${
          isHashirStyle ? 'border-r border-slate-500 text-slate-950' : 'border-r border-black text-black'
        }`}>
          Total (Goods incl. GST):
        </td>
        <td className="text-right bill-cell px-2.5 font-black whitespace-nowrap font-mono text-black">
          {formatCurrency(goodsSub + gst)}
        </td>
      </tr>
    </>
  );

  const servicesSubtotalRows = serviceSub > 0 && (
    <>
      <tr className={`border-t ${isHashirStyle ? 'border-slate-800 bg-white' : 'border-black bg-white'} text-[10pt]`}>
        <td colSpan={4} className={`text-right bill-cell px-2.5 font-bold ${
          isHashirStyle ? 'border-r border-slate-400 text-slate-900' : 'border-r border-black text-black'
        }`}>
          Sub Total (Services):
        </td>
        <td className="text-right bill-cell px-2.5 font-bold whitespace-nowrap font-mono text-black">
          {formatCurrency(serviceSub)}
        </td>
      </tr>
      <tr className={`border-b ${isHashirStyle ? 'border-slate-800 bg-white' : 'border-black bg-white'} text-[10pt]`}>
        <td colSpan={4} className={`text-right bill-cell px-2.5 font-bold ${
          isHashirStyle ? 'border-r border-slate-400 text-slate-900' : 'border-r border-black text-black'
        }`}>
          {pstPercent}% PST on Services:
        </td>
        <td className="text-right bill-cell px-2.5 font-bold whitespace-nowrap font-mono text-black">
          {formatCurrency(pst)}
        </td>
      </tr>
      {/* Section total: services inclusive of PST */}
      <tr className={`border-y-2 ${isHashirStyle ? 'border-slate-900 bg-white' : 'border-black bg-white'} text-[10.5pt]`}>
        <td colSpan={4} className={`text-right bill-cell px-2.5 font-black ${
          isHashirStyle ? 'border-r border-slate-500 text-slate-950' : 'border-r border-black text-black'
        }`}>
          Total (Services incl. PST):
        </td>
        <td className="text-right bill-cell px-2.5 font-black whitespace-nowrap font-mono text-black">
          {formatCurrency(serviceSub + pst)}
        </td>
      </tr>
    </>
  );

  const otherSubtotalRows = otherSub > 0 && (
    <tr className={`border-t border-b ${isHashirStyle ? 'border-slate-800 bg-white' : 'border-black bg-white'} text-[10pt]`}>
      <td colSpan={4} className={`text-right bill-cell px-2.5 font-bold ${
        isHashirStyle ? 'border-r border-slate-400 text-slate-900' : 'border-r border-black text-black'
      }`}>
        Sub Total (Exempt / Other):
      </td>
      <td className="text-right bill-cell px-2.5 font-bold whitespace-nowrap font-mono text-black">
        {formatCurrency(otherSub)}
      </td>
    </tr>
  );

  const tableClass = `w-full border-collapse text-[10pt] leading-[1.4] mb-2 bg-white ${
      isHashirStyle ? 'border border-slate-400' : 'border border-black'
    }`;

  const firstHead = (
    <>
              <>
                {/* 1. HASHIR TRADERS: Modern Split Corporate Header */}
                {isHashirStyle ? (
                  <>
                    {!printOnLetterhead && (
                      <div className="border-b-2 border-slate-900 pb-3 mb-3 flex flex-row items-start justify-between gap-3">
                        {/* Left: Brand Monogram & Corporate Identity */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2.5 mb-1">
                            <div className="w-10 h-10 rounded-lg bg-white text-slate-900 border-2 border-slate-900 font-black text-base flex items-center justify-center font-sans tracking-tight shrink-0 shadow-sm">
                              HT
                            </div>
                            <div>
                              <h1 className="text-2xl font-black tracking-tight text-slate-950 uppercase font-sans">
                                {firmName}
                              </h1>
                              <p className="text-[10px] font-bold text-slate-600 tracking-wider uppercase">
                                {firmTagline}
                              </p>
                            </div>
                          </div>
                          <p className="text-[9.5pt] text-slate-700 mt-1">{firmAddress}</p>
                          <div className="flex flex-wrap items-center gap-x-3 text-[9pt] font-semibold text-slate-900 mt-1">
                            <span>Ph: {firmPhone}</span>
                            <span>NTN: {firmNTN}</span>
                            <span>GST: {firmGST}</span>
                            {firmVendor && <span>Vendor: {firmVendor}</span>}
                          </div>
                        </div>

                        {/* Right: Modern Document Badge Card */}
                        <div className="text-right w-56 shrink-0 bg-white border border-slate-300 rounded-xl p-2.5">
                          <span className="inline-block text-[9px] font-black uppercase tracking-wider bg-white text-slate-900 border border-slate-900 px-2 py-0.5 rounded">
                            COMMERCIAL BILL / INVOICE
                          </span>
                          <div className="mt-1">
                            <span className="text-[9.5pt] font-bold text-slate-500 block">Bill Number</span>
                            <span className="font-mono font-black text-lg text-slate-950 block">
                              #{docNo}
                            </span>
                          </div>
                          <div className="mt-0.5 text-xs">
                            <span className="text-slate-500 font-semibold">Date: </span>
                            <span className="font-bold text-slate-800">{showDateOnBill ? docDate : '........................'}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Letterhead ON: Modern Minimal Header Row for Hashir Traders */}
                    {printOnLetterhead && (
                      <div className="flex justify-between items-stretch border-2 border-slate-800 mb-3">
                        <div className="flex items-center px-3 py-2">
                          <span className="text-[1.65rem] leading-none font-black uppercase tracking-widest text-slate-900">
                            BILL
                          </span>
                        </div>
                        <div className="flex flex-col justify-end text-right px-3 py-2 border-l-2 border-slate-800">
                          <div className="text-sm text-slate-900 mb-3">
                            <span className="font-semibold">Bill No. </span>
                            <span className="font-mono font-bold">{docNo}</span>
                          </div>
                          <div className="text-xs text-slate-500 font-semibold">
                            {showDateOnBill ? `Date: ${docDate}` : 'Date: ........................'}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Client & Reference Info Box: Modern Styled Card */}
                    <div className="mb-3 p-3 rounded-xl border border-slate-300 bg-white text-[10pt] border-l-4 border-l-slate-900">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">
                            BILLED TO
                          </span>
                          <div className="font-black text-slate-950 text-[11pt]">
                            M/s {clientName}
                          </div>
                          {clientAddress && (
                            <p className="text-slate-700 text-[9.5pt] mt-0.5">{clientAddress}</p>
                          )}
                        </div>
                        <div className="text-right space-y-0.5">
                          {clientNTN && (
                            <div>
                              <span className="text-[9px] font-bold text-slate-500 block">CLIENT NTN</span>
                              <span className="font-mono font-bold text-slate-900 text-xs bg-white px-1.5 py-0.5 rounded border border-slate-200 inline-block">
                                {clientNTN}
                              </span>
                            </div>
                          )}
                          {refText && (
                            <div className="pt-1">
                              <span className="text-[9px] font-bold text-slate-500 block">REFERENCE / PO</span>
                              <span className="text-xs font-semibold text-slate-900 block truncate" title={refText}>
                                {refText}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  /* 2. ANWAR TRADERS: Classic Government Contractor / Formal Traditional Header */
                  <>
                    {!printOnLetterhead && (
                      <div className="border-b-2 border-double border-black pb-2 mb-3 text-center">
                        <h1 className="text-2xl font-black tracking-widest uppercase text-black font-serif">
                          {firmName}
                        </h1>
                        <p className="text-xs font-bold text-black tracking-wider uppercase font-serif mt-0.5">
                          {firmTagline}
                        </p>
                        <p className="text-xs text-black mt-0.5">{firmAddress}</p>
                        <div className="flex flex-wrap justify-center gap-x-4 text-xs font-semibold text-black mt-1">
                          <span>Ph: {firmPhone}</span>
                          <span>NTN: {firmNTN}</span>
                          <span>GST No: {firmGST}</span>
                          {firmVendor && <span>Vendor No: {firmVendor}</span>}
                        </div>
                      </div>
                    )}

                    {/* Classic Title: BILL centered, Bill No left / Date right */}
                    <div className="grid grid-cols-3 items-center border-b-2 border-black pb-1.5 mb-2.5">
                      <div className="text-[10pt]">
                        <span className="font-bold">Bill No: </span>
                        <span className="font-bold font-mono px-2 py-0.5 bg-white border border-black">
                          {docNo}
                        </span>
                      </div>
                      <div className="text-center">
                        <span className="text-2xl font-black uppercase tracking-[0.25em] mr-[-0.25em] text-black font-serif">
                          BILL
                        </span>
                      </div>
                      <div className="text-[10pt] text-right">
                        <span className="font-bold">Date: </span>
                        <span className="font-semibold">{showDateOnBill ? docDate : '........................'}</span>
                      </div>
                    </div>

                    {/* Traditional Boxed Client & Reference Block */}
                    <div className="mb-2.5 space-y-1 text-[10pt] border-2 border-black p-2.5 bg-white">
                      <div className="flex items-start">
                        <span className="font-bold w-16 shrink-0">Name:</span>
                        <span className="font-semibold text-black">
                          M/s {clientName}
                          {clientAddress ? `, ${clientAddress}` : ''}
                        </span>
                      </div>
                      {clientNTN && (
                        <div className="flex items-start">
                          <span className="font-bold w-16 shrink-0">NTN:</span>
                          <span className="font-mono">{clientNTN}</span>
                        </div>
                      )}
                      {refText && (
                        <div className="flex items-start">
                          <span className="font-bold w-16 shrink-0">Ref:</span>
                          <span className="font-medium text-black">{refText}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            {isHashirStyle && !printOnLetterhead && (
              <div className="border-y-2 border-slate-900 py-1.5 mb-2.5 text-center">
                <span className="text-xl font-black uppercase tracking-[0.25em] mr-[-0.25em] text-slate-900 font-sans">
                  Bill
                </span>
              </div>
            )}
    </>
  );

  const runHead = (
              <div className="flex justify-between items-center border-b-2 border-black pb-1.5 mb-2.5 pt-1">
                <div>
                  <span className="font-black text-sm uppercase tracking-wide">
                    BILL #{docNo} · <strong className="font-black">{firmName}</strong>
                  </span>
                  <p className="text-[9.5pt] text-black font-medium">M/s {clientName} (Continued)</p>
                </div>
                <div className="text-right text-xs font-bold">
                  <div>Date: {showDateOnBill ? docDate : '........................'}</div>
                </div>
              </div>
  );

  const theadRow = (
                <tr className={`${
                  isHashirStyle
                    ? 'bg-slate-100 text-slate-900 font-bold text-center text-[9.5pt] uppercase tracking-wider border-b-2 border-slate-900'
                    : 'bg-gray-100 border-b-2 border-black text-center font-bold font-serif'
                }`}>
                  <th className={`py-1 px-2 w-12 whitespace-nowrap ${isHashirStyle ? 'border-r border-slate-700' : 'border-r border-black'}`}>{isHashirStyle ? 'S.No' : 'Sr.#'}</th>
                  <th className={`py-1 px-2 text-left whitespace-nowrap ${isHashirStyle ? 'border-r border-slate-700' : 'border-r border-black'}`}>{isHashirStyle ? 'Particulars' : 'Description of Supplies / Services'}</th>
                  <th className={`py-1 px-2 w-24 whitespace-nowrap ${isHashirStyle ? 'border-r border-slate-700' : 'border-r border-black'}`}>{isHashirStyle ? 'Quantity' : 'Qty'}</th>
                  <th className={`py-1 px-2 w-24 whitespace-nowrap text-right ${isHashirStyle ? 'border-r border-slate-700' : 'border-r border-black'}`}>{isHashirStyle ? 'Rate (PKR)' : 'Rate (Rs.)'}</th>
                  <th className="py-1 px-2 w-28 text-right whitespace-nowrap">{isHashirStyle ? 'Amount (PKR)' : 'Amount (Rs.)'}</th>
                </tr>
  );

  // One "group" = optional section header + the item row + (if it is the
  // last item of its section) that section's totals block. A group is never
  // split across pages.
  const renderGroup = (it: ItemRowWithSr) => {
    const isLastOfSection = sectionFinalSrs.has(it.sr);
    return (
      <>
                      {it.sectionHeader && (
                        <tr className={`${
                          isHashirStyle
                            ? 'bg-white border-t border-b border-slate-300 font-bold text-xs uppercase tracking-wide text-slate-900'
                            : 'bg-white border-t border-b border-black font-bold text-xs uppercase tracking-wide text-black'
                        }`}>
                          <td colSpan={5} className="bill-cell px-2.5">
                            {it.sectionHeader}
                          </td>
                        </tr>
                      )}
                      <tr className={`border-b ${isHashirStyle ? 'border-slate-400' : 'border-gray-500'} ${
                        'bg-white'
                      }`}>
                        <td className={`text-center bill-cell px-1.5 font-mono font-bold text-xs ${
                          isHashirStyle ? 'border-r border-slate-300' : 'border-r border-black'
                        }`}>
                          {it.sr}
                        </td>
                        <td className={`text-left bill-cell px-2 font-medium ${
                          isHashirStyle ? 'border-r border-slate-300' : 'border-r border-black'
                        }`}>
                          {toProperCase(it.description)}
                        </td>
                        <td className={`text-center bill-cell px-1.5 whitespace-nowrap ${
                          isHashirStyle ? 'border-r border-slate-300' : 'border-r border-black'
                        }`}>
                          {it.qty} {it.unit}
                        </td>
                        <td className={`text-right bill-cell px-2 whitespace-nowrap font-mono ${
                          isHashirStyle ? 'border-r border-slate-300' : 'border-r border-black'
                        }`}>
                          {formatCurrency(it.rate)}
                        </td>
                        <td className="text-right bill-cell px-2 font-bold whitespace-nowrap font-mono">
                          {formatCurrency(it.amount)}
                        </td>
                      </tr>
                      {isLastOfSection && it.tax === 'GST' && goodsSubtotalRows}
                      {isLastOfSection && it.tax === 'PST' && servicesSubtotalRows}
                      {isLastOfSection && it.tax === 'None' && otherSubtotalRows}
      </>
    );
  };

  const grandRow = (
                  <>
                    {/* GRAND TOTAL ROW: Distinctive Firm Presentation */}
                    {isHashirStyle ? (
                      /* Hashir Modern Corporate Style Grand Total */
                      <tr className="bg-white text-slate-900 border-t-2 border-b-[3px] border-slate-900 text-[12pt] font-black">
                        <td colSpan={4} className="border-r border-slate-700 text-right py-1.5 px-3.5 tracking-wider uppercase">
                          TOTAL PAYABLE INVOICE AMOUNT (PKR):
                        </td>
                        <td className="text-right py-1.5 px-3.5 whitespace-nowrap font-mono text-[13pt] font-black text-slate-900">
                          Rs. {formatCurrency(grandTotal)}
                        </td>
                      </tr>
                    ) : (
                      /* Anwar Traders Classic Govt Style Grand Total */
                      <tr className="bg-white border-t-2 border-black border-b-[3px] border-b-black text-[12.5pt] font-black">
                        <td colSpan={4} className="border-r border-black text-right py-1.5 px-3 tracking-wider uppercase text-black font-black font-serif">
                          GRAND TOTAL (PKR):
                        </td>
                        <td className="text-right py-1.5 px-3 whitespace-nowrap font-mono text-[13pt] font-black text-black underline decoration-double">
                          Rs. {formatCurrency(grandTotal)}
                        </td>
                      </tr>
                    )}
                  </>
  );

  const contLine = (
              <div className="text-right text-xs italic font-bold text-black py-1">
                (Continued on next sheet...)
              </div>
  );

  const lastBlockInner = (
              <>
                <div className={`p-2 mb-2 text-[10pt] ${
                  isHashirStyle
                    ? 'bg-white border border-slate-300 font-sans rounded'
                    : 'border-2 border-black bg-white font-serif'
                }`}>
                  <span className="font-bold">In Words: </span>
                  <span className="font-semibold italic text-black">
                    {numberToWordsPakistani(grandTotal)}
                  </span>
                </div>

                {isHashirStyle ? (
                  /* Hashir Traders Modern Corporate Signatures */
                  <div className="flex justify-between items-end pt-2 mt-1 font-sans">
                    <div className="text-[9pt] text-slate-500 max-w-sm">
                      <p className="font-bold text-slate-700 uppercase tracking-wider text-[8.5pt]">
                        Errors and Omissions Excepted
                      </p>
                    </div>
                    <div className="text-center w-64">
                      <div className="border-b-2 border-slate-800 mb-1 w-full"></div>
                      <p className="text-[10pt] font-black uppercase tracking-wider text-slate-900">
                        For <span className="font-black">{firmName}</span>
                      </p>
                      <p className="text-[8.5pt] font-semibold text-slate-500 uppercase tracking-wider">
                        Authorized Signatory / Seal
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Anwar Traders Classic Govt Supplier Signatures */
                  <div className="flex justify-between items-end pt-2 mt-1 font-serif">
                    <div className="text-[9pt] text-black max-w-md">
                      <span className="text-[8.5pt] text-black block">E. &amp; O.E.</span>
                    </div>
                    <div className="text-center w-64">
                      <div className="border-b border-black mb-1 w-full"></div>
                      <p className="text-[10pt] font-black uppercase tracking-wider text-black">
                        For <span className="font-black">{firmName}</span>
                      </p>
                      <p className="text-[8.5pt] text-black">Proprietor / Signature &amp; Stamp</p>
                    </div>
                  </div>
                )}
              </>
  );

  const renderFooter = (currentPageNum: number, pages: number) => (
            <div className="flex justify-between items-center border-t border-black pt-1.5 mt-2 text-[8.5pt] text-black">
              <span>{firmName} · Bill #{docNo} · {clientName}</span>
              <span className="font-bold text-black">
                Page {currentPageNum} of {pages}
              </span>
            </div>
  );

  return (
    <div
      className={`bill-sheet-wrapper w-full mx-auto text-black text-[10.5pt] leading-normal ${
        isHashirStyle ? 'font-sans' : 'font-serif firm-anwar-print'
      }`}
      style={{ ['--brow-py' as any]: `${density.py}px`, ['--brow-lh' as any]: String(density.lh) }}
    >
      {/* Hidden measuring probe: exact print width, same classes as the real sheet.
          .no-print => display:none when printing, so it never takes paper space. */}
      <div
        ref={probeRef}
        aria-hidden="true"
        className="no-print"
        style={{ position: 'absolute', left: '-10000px', top: 0, width: `${PRINT_W_PX}px`, visibility: 'hidden', pointerEvents: 'none' }}
      >
        <div data-m="headFirst" className="flow-root">{firstHead}</div>
        <div data-m="headRun" className="flow-root">{runHead}</div>
        <table data-m="table" className={tableClass}>
          <thead data-m="thead">{theadRow}</thead>
          {sequentialItems.map((it) => (
            <tbody key={it.sr} data-g={it.sr}>{renderGroup(it)}</tbody>
          ))}
          <tbody data-m="grand">{grandRow}</tbody>
        </table>
        <div data-m="cont" className="flow-root">{contLine}</div>
        <div data-m="lastBlock" className="flow-root">{lastBlockInner}</div>
        <div data-m="footer" className="flow-root">{renderFooter(1, 1)}</div>
      </div>

      {pageChunks.map((chunk, pageIndex) => {
        const isFirstPage = pageIndex === 0;
        const isLastPage = pageIndex === totalPages - 1;
        const currentPageNum = pageIndex + 1;

        return (
          <div
            key={pageIndex}
            className={`print-sheet bg-white w-full print:bg-white print:text-black mb-8 print:mb-0 ${
              !isLastPage ? 'print:break-after-page print:page-break-after-always' : ''
            }`}
          >
            {isFirstPage ? firstHead : runHead}

            {/* Items Table */}
            <table className={tableClass}>
              <thead>{theadRow}</thead>
              <tbody>
                {chunk.map((it) => (
                  <React.Fragment key={it.sr}>{renderGroup(it)}</React.Fragment>
                ))}
                {/* Grand Total on the LAST page (section subtotals are interleaved under their sections) */}
                {isLastPage && grandRow}
              </tbody>
            </table>

            {!isLastPage && contLine}

            {/* Amount in words, signatures and the page footer strip form ONE
                unbreakable block on the last page: the strip must never strand
                alone on an extra page (seen on Bill #71, 2026-10-14). */}
            <div className={isLastPage ? 'break-inside-avoid' : ''} style={isLastPage ? { pageBreakInside: 'avoid' } : undefined}>
              {isLastPage && lastBlockInner}
              {renderFooter(currentPageNum, totalPages)}
            </div>
          </div>
        );
      })}
    </div>
  );
};
