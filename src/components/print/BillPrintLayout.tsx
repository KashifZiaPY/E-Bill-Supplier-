import React from 'react';
import type { DocumentRecord, SupplierSettings } from '../../types/billing';
import { calculateTotals, formatCurrency, formatDateDisplay, safeNormalizeItems } from '../../utils/formatters';
import { numberToWordsPakistani } from '../../utils/numberToWords';

interface Props {
  doc: DocumentRecord;
  settings: SupplierSettings;
  printOnLetterhead: boolean;
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

export const BillPrintLayout: React.FC<Props> = ({ doc, settings, printOnLetterhead }) => {
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
  const clientName = doc.clientName || doc.ClientName || 'Client';
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

  // Intelligent Multi-Page Pagination
  const pageChunks: ItemRowWithSr[][] = [];
  if (sequentialItems.length <= 8) {
    pageChunks.push(sequentialItems);
  } else {
    pageChunks.push(sequentialItems.slice(0, 7));
    let remaining = sequentialItems.slice(7);
    while (remaining.length > 0) {
      if (remaining.length <= 8) {
        pageChunks.push(remaining);
        break;
      } else {
        pageChunks.push(remaining.slice(0, 12));
        remaining = remaining.slice(12);
      }
    }
  }

  const totalPages = pageChunks.length;

  return (
    <div
      className={`bill-sheet-wrapper w-full mx-auto text-black text-[10.5pt] leading-normal ${
        isHashirStyle ? 'font-sans' : 'font-serif'
      }`}
    >
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
            {/* Page 1 Full Header OR Subsequent Pages Running Header */}
            {isFirstPage ? (
              <>
                {/* 1. HASHIR TRADERS: Modern Split Corporate Header */}
                {isHashirStyle ? (
                  <>
                    {!printOnLetterhead && (
                      <div className="border-b-2 border-slate-900 pb-3 mb-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        {/* Left: Brand Monogram & Corporate Identity */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2.5 mb-1">
                            <div className="w-10 h-10 rounded-lg bg-slate-900 text-white font-black text-base flex items-center justify-center font-sans tracking-tight shrink-0 shadow-sm">
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
                        <div className="text-right sm:w-56 shrink-0 bg-slate-50 border border-slate-300 rounded-xl p-2.5">
                          <span className="inline-block text-[9px] font-black uppercase tracking-wider bg-slate-900 text-white px-2 py-0.5 rounded">
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
                            <span className="font-bold text-slate-800">{docDate}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Letterhead ON: Modern Minimal Header Row for Hashir Traders */}
                    {printOnLetterhead && (
                      <div className="flex justify-between items-center border-b-2 border-slate-800 pb-2 mb-3">
                        <span className="text-sm font-black uppercase tracking-widest text-slate-900">
                          COMMERCIAL TAX INVOICE
                        </span>
                        <div className="text-right font-mono text-sm font-bold">
                          <span>BILL #{docNo} · {docDate}</span>
                        </div>
                      </div>
                    )}

                    {/* Client & Reference Info Box: Modern Styled Card */}
                    <div className="mb-3 p-3 rounded-xl border border-slate-300 bg-slate-50/80 text-[10pt] border-l-4 border-l-slate-900">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="sm:col-span-2">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">
                            BILLED TO (CLIENT PARTICULARS)
                          </span>
                          <div className="font-black text-slate-950 text-[11pt]">
                            M/s {clientName}
                          </div>
                          {clientAddress && (
                            <p className="text-slate-700 text-[9.5pt] mt-0.5">{clientAddress}</p>
                          )}
                        </div>
                        <div className="text-left sm:text-right space-y-0.5">
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
                        <p className="text-xs font-bold text-gray-800 tracking-wider uppercase font-serif mt-0.5">
                          {firmTagline}
                        </p>
                        <p className="text-xs text-gray-800 mt-0.5">{firmAddress}</p>
                        <div className="flex flex-wrap justify-center gap-x-4 text-xs font-semibold text-gray-900 mt-1">
                          <span>Ph: {firmPhone}</span>
                          <span>NTN: {firmNTN}</span>
                          <span>GST No: {firmGST}</span>
                          {firmVendor && <span>Vendor No: {firmVendor}</span>}
                        </div>
                      </div>
                    )}

                    {/* Classic Title & Bill No Header */}
                    <div className="flex justify-between items-baseline border-b border-black pb-1.5 mb-2.5">
                      <div className="flex items-baseline gap-3">
                        <span className="text-2xl font-black uppercase tracking-wider text-black font-serif">
                          BILL
                        </span>
                      </div>
                      <div className="text-right text-[10pt] space-y-0.5">
                        <div>
                          <span className="font-bold">Bill No: </span>
                          <span className="font-bold font-mono px-2 py-0.5 bg-white border border-black rounded">
                            {docNo}
                          </span>
                        </div>
                        <div>
                          <span className="font-bold">Date: </span>
                          <span className="font-semibold">{docDate}</span>
                        </div>
                      </div>
                    </div>

                    {/* Traditional Boxed Client & Reference Block */}
                    <div className="mb-2.5 space-y-1 text-[10pt] border border-black p-2.5 rounded bg-white">
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
                          <span className="font-medium text-gray-900">{refText}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            ) : (
              /* Subsequent Pages Running Header */
              <div className="flex justify-between items-center border-b-2 border-black pb-1.5 mb-2.5 pt-1">
                <div>
                  <span className="font-black text-sm uppercase tracking-wide">
                    BILL #{docNo} · <strong className="font-black">{firmName}</strong>
                  </span>
                  <p className="text-[9.5pt] text-gray-700 font-medium">M/s {clientName} (Continued)</p>
                </div>
                <div className="text-right text-xs font-bold">
                  <div>Date: {docDate}</div>
                </div>
              </div>
            )}

            {/* Items Table */}
            <table className={`w-full border-collapse text-[10pt] mb-2 bg-white ${
              isHashirStyle ? 'border border-slate-400' : 'border border-black'
            }`}>
              <thead>
                <tr className={`${
                  isHashirStyle
                    ? 'bg-slate-900 text-white font-bold text-center text-[9.5pt] uppercase tracking-wider'
                    : 'bg-white border-b-2 border-black text-center font-bold font-serif'
                }`}>
                  <th className={`py-1.5 px-2 w-12 ${isHashirStyle ? 'border-r border-slate-700' : 'border-r border-black'}`}>Sr.#</th>
                  <th className={`py-1.5 px-2 text-left ${isHashirStyle ? 'border-r border-slate-700' : 'border-r border-black'}`}>Description of Supplies / Services</th>
                  <th className={`py-1.5 px-2 w-24 ${isHashirStyle ? 'border-r border-slate-700' : 'border-r border-black'}`}>Qty</th>
                  <th className={`py-1.5 px-2 w-24 text-right ${isHashirStyle ? 'border-r border-slate-700' : 'border-r border-black'}`}>Rate (Rs.)</th>
                  <th className="py-1.5 px-2 w-28 text-right">Amount (Rs.)</th>
                </tr>
              </thead>
              <tbody>
                {chunk.map((it, idx) => {
                  return (
                    <React.Fragment key={it.sr}>
                      {it.sectionHeader && (
                        <tr className={`${
                          isHashirStyle
                            ? 'bg-slate-100 border-t border-b border-slate-300 font-bold text-xs uppercase tracking-wide text-slate-900'
                            : 'bg-white border-t border-b border-black font-bold text-xs uppercase tracking-wide text-black'
                        }`}>
                          <td colSpan={5} className="py-1.5 px-2.5">
                            {it.sectionHeader}
                          </td>
                        </tr>
                      )}
                      <tr className={`border-b-2 ${isHashirStyle ? 'border-slate-400' : 'border-gray-500'} ${
                        idx % 2 === 1 ? (isHashirStyle ? 'bg-slate-50/70' : 'bg-gray-100/90') : 'bg-white'
                      }`}>
                        <td className={`text-center py-1.5 px-1.5 font-mono font-bold text-xs ${
                          isHashirStyle ? 'border-r border-slate-300' : 'border-r border-black'
                        }`}>
                          {it.sr}
                        </td>
                        <td className={`text-left py-1.5 px-2 font-medium ${
                          isHashirStyle ? 'border-r border-slate-300' : 'border-r border-black'
                        }`}>
                          {it.description}
                        </td>
                        <td className={`text-center py-1.5 px-1.5 whitespace-nowrap ${
                          isHashirStyle ? 'border-r border-slate-300' : 'border-r border-black'
                        }`}>
                          {it.qty} {it.unit}
                        </td>
                        <td className={`text-right py-1.5 px-2 whitespace-nowrap font-mono ${
                          isHashirStyle ? 'border-r border-slate-300' : 'border-r border-black'
                        }`}>
                          {formatCurrency(it.rate)}
                        </td>
                        <td className="text-right py-1.5 px-2 font-bold whitespace-nowrap font-mono">
                          {formatCurrency(it.amount)}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}

                {/* Subtotals & Grand Totals only on the LAST page */}
                {isLastPage && (
                  <>
                    {goodsSub > 0 && (
                      <>
                        <tr className={`border-t-2 ${isHashirStyle ? 'border-slate-800 bg-slate-100/80' : 'border-black bg-gray-100/90'} text-[10pt]`}>
                          <td colSpan={4} className={`text-right py-1.5 px-2.5 font-bold ${
                            isHashirStyle ? 'border-r border-slate-400 text-slate-900' : 'border-r border-black text-gray-900'
                          }`}>
                            Sub Total (Goods):
                          </td>
                          <td className="text-right py-1.5 px-2.5 font-bold whitespace-nowrap font-mono text-black">
                            {formatCurrency(goodsSub)}
                          </td>
                        </tr>
                        {computed.gstBreakdown && computed.gstBreakdown.length > 1 ? (
                          <>
                            {computed.gstBreakdown.map((b) => (
                              <tr key={b.ratePercent} className={`border-b ${isHashirStyle ? 'border-slate-300 bg-slate-50' : 'border-gray-400 bg-gray-100/70'} text-[9.5pt]`}>
                                <td colSpan={4} className={`text-right py-1 px-2.5 font-semibold ${
                                  isHashirStyle ? 'border-r border-slate-300 text-slate-800' : 'border-r border-black text-gray-800'
                                }`}>
                                  GST @ {b.ratePercent}% (on Rs. {formatCurrency(b.taxableAmount)}):
                                </td>
                                <td className="text-right py-1 px-2.5 font-semibold whitespace-nowrap font-mono text-black">
                                  {formatCurrency(b.taxAmount)}
                                </td>
                              </tr>
                            ))}
                            <tr className={`border-b ${isHashirStyle ? 'border-slate-800 bg-slate-100/80' : 'border-black bg-gray-100/90'} text-[10pt]`}>
                              <td colSpan={4} className={`text-right py-1.5 px-2.5 font-bold ${
                                isHashirStyle ? 'border-r border-slate-400 text-slate-900' : 'border-r border-black text-gray-900'
                              }`}>
                                Total GST on Goods:
                              </td>
                              <td className="text-right py-1.5 px-2.5 font-bold whitespace-nowrap font-mono text-black">
                                {formatCurrency(gst)}
                              </td>
                            </tr>
                          </>
                        ) : (
                          <tr className={`border-b ${isHashirStyle ? 'border-slate-800 bg-slate-100/80' : 'border-black bg-gray-100/90'} text-[10pt]`}>
                            <td colSpan={4} className={`text-right py-1.5 px-2.5 font-bold ${
                              isHashirStyle ? 'border-r border-slate-400 text-slate-900' : 'border-r border-black text-gray-900'
                            }`}>
                              {(computed.gstBreakdown?.[0]?.ratePercent ?? (isUniformGoodsRate ? uniformRate : gstPercent))}% GST on Goods:
                            </td>
                            <td className="text-right py-1.5 px-2.5 font-bold whitespace-nowrap font-mono text-black">
                              {formatCurrency(gst)}
                            </td>
                          </tr>
                        )}
                      </>
                    )}

                    {serviceSub > 0 && (
                      <>
                        <tr className={`border-t ${isHashirStyle ? 'border-slate-800 bg-slate-100/80' : 'border-black bg-gray-100/90'} text-[10pt]`}>
                          <td colSpan={4} className={`text-right py-1.5 px-2.5 font-bold ${
                            isHashirStyle ? 'border-r border-slate-400 text-slate-900' : 'border-r border-black text-gray-900'
                          }`}>
                            Sub Total (Services):
                          </td>
                          <td className="text-right py-1.5 px-2.5 font-bold whitespace-nowrap font-mono text-black">
                            {formatCurrency(serviceSub)}
                          </td>
                        </tr>
                        <tr className={`border-b ${isHashirStyle ? 'border-slate-800 bg-slate-100/80' : 'border-black bg-gray-100/90'} text-[10pt]`}>
                          <td colSpan={4} className={`text-right py-1.5 px-2.5 font-bold ${
                            isHashirStyle ? 'border-r border-slate-400 text-slate-900' : 'border-r border-black text-gray-900'
                          }`}>
                            {pstPercent}% PST on Services:
                          </td>
                          <td className="text-right py-1.5 px-2.5 font-bold whitespace-nowrap font-mono text-black">
                            {formatCurrency(pst)}
                          </td>
                        </tr>
                      </>
                    )}

                    {/* GRAND TOTAL ROW: Distinctive Firm Presentation */}
                    {isHashirStyle ? (
                      /* Hashir Modern Corporate Style Grand Total */
                      <tr className="bg-slate-900 text-white border-t-2 border-slate-950 text-[12pt] font-black">
                        <td colSpan={4} className="border-r border-slate-700 text-right py-3 px-3.5 tracking-wider uppercase">
                          TOTAL PAYABLE INVOICE AMOUNT (PKR):
                        </td>
                        <td className="text-right py-3 px-3.5 whitespace-nowrap font-mono text-[13pt] font-black text-amber-300">
                          Rs. {formatCurrency(grandTotal)}
                        </td>
                      </tr>
                    ) : (
                      /* Anwar Traders Classic Govt Style Grand Total */
                      <tr className="bg-gray-200 border-t-2 border-black border-b-[3px] border-b-black text-[12pt] sm:text-[12.5pt] font-black">
                        <td colSpan={4} className="border-r border-black text-right py-2.5 px-3 tracking-wider uppercase text-black font-black font-serif">
                          GRAND TOTAL (PKR):
                        </td>
                        <td className="text-right py-2.5 px-3 whitespace-nowrap font-mono text-[13pt] font-black text-black underline decoration-double">
                          Rs. {formatCurrency(grandTotal)}
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>

            {!isLastPage && (
              <div className="text-right text-xs italic font-bold text-gray-700 py-1">
                (Continued on next sheet...)
              </div>
            )}

            {/* Amount in words & Signatures on Final Page */}
            {isLastPage && (
              <>
                <div className={`p-2.5 mb-3 rounded text-[10pt] ${
                  isHashirStyle
                    ? 'bg-slate-50 border border-slate-300 font-sans'
                    : 'border border-black bg-white font-serif'
                }`}>
                  <span className="font-bold">In Words: </span>
                  <span className="font-semibold italic text-black">
                    {numberToWordsPakistani(grandTotal)}
                  </span>
                </div>

                {isHashirStyle ? (
                  /* Hashir Traders Modern Corporate Signatures */
                  <div className="flex justify-between items-end pt-3 mt-1 font-sans">
                    <div className="text-[9pt] text-slate-500 max-w-sm">
                      <p className="font-bold text-slate-700 uppercase tracking-wider text-[8.5pt]">Terms &amp; Certification</p>
                      <p className="text-[8pt] text-slate-600 mt-0.5">
                        Computer generated commercial tax invoice for supplies delivered in accordance with purchase order.
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
                  <div className="flex justify-between items-end pt-3 mt-1 font-serif">
                    <div className="text-[9pt] text-gray-700 max-w-md">
                      <p className="italic text-[8.5pt]">
                        Certified that the rates charged and quality of goods/services are as per Govt approved specifications.
                      </p>
                      <span className="text-[8.5pt] text-gray-500 block mt-1">E. &amp; O.E.</span>
                    </div>
                    <div className="text-center w-64">
                      <div className="border-b border-black mb-1 w-full"></div>
                      <p className="text-[10pt] font-black uppercase tracking-wider text-black">
                        For <span className="font-black">{firmName}</span>
                      </p>
                      <p className="text-[8.5pt] text-gray-700">Proprietor / Signature &amp; Stamp</p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Bottom Page Footer on EVERY Sheet */}
            <div className="flex justify-between items-center border-t border-gray-300 pt-1.5 mt-3 text-[8.5pt] text-gray-600">
              <span>{firmName} · Bill #{docNo} · {clientName}</span>
              <span className="font-bold text-gray-800">
                Page {currentPageNum} of {totalPages}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
