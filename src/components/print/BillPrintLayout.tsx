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

  const firmName = doc.firmName || settings.supplierName || 'ANWAR TRADERS';
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

  // Intelligent Multi-Page Pagination:
  // If items <= 8: fits perfectly on a single page with all totals and signatures.
  // If items > 8: Page 1 holds 7 items, middle pages hold 12 items, and the final page holds remaining items + totals & signatures.
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
    <div className="bill-sheet-wrapper w-full mx-auto font-sans text-black text-[10.5pt] leading-normal">
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
                {/* Supplier Header Block (Letterhead OFF only) */}
                {!printOnLetterhead && (
                  <div className="border-b-2 border-black pb-2 mb-3 text-center">
                    <h1 className="text-2xl font-black tracking-wide uppercase text-black">{firmName}</h1>
                    <p className="text-xs font-semibold text-gray-700 tracking-wider uppercase">{settings.supplierTagline}</p>
                    <p className="text-xs text-gray-800 mt-0.5">{settings.supplierAddress}</p>
                    <div className="flex flex-wrap justify-center gap-x-4 text-xs font-semibold text-gray-900 mt-1">
                      <span>Ph: {settings.supplierPhone}</span>
                      <span>NTN: {settings.supplierNTN}</span>
                      <span>GST No: {settings.supplierGST}</span>
                      {settings.vendorNo && <span>Vendor No: {settings.vendorNo}</span>}
                    </div>
                  </div>
                )}

                {/* Title & Bill No Header */}
                <div className="flex justify-between items-baseline border-b border-black pb-1.5 mb-2.5">
                  <div className="flex items-baseline gap-3">
                    <span className="text-2xl font-black uppercase tracking-wider text-black">BILL</span>
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

                {/* Client & Reference Info Box */}
                <div className="mb-2.5 space-y-1 text-[10pt] border border-black p-2 rounded bg-white">
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

            {/* Items Table for this page */}
            <table className="w-full border-collapse border border-black text-[10pt] mb-2 bg-white">
              <thead>
                <tr className="bg-white border-b-2 border-black text-center font-bold">
                  <th className="border-r border-black py-1 px-2 w-12">Sr.#</th>
                  <th className="border-r border-black py-1 px-2 text-left">Description</th>
                  <th className="border-r border-black py-1 px-2 w-24">Qty</th>
                  <th className="border-r border-black py-1 px-2 w-24 text-right">Rate</th>
                  <th className="py-1 px-2 w-28 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {chunk.map((it, idx) => {
                  return (
                    <React.Fragment key={it.sr}>
                      {it.sectionHeader && (
                        <tr className="bg-white border-t border-b border-black font-bold text-xs uppercase tracking-wide">
                          <td colSpan={5} className="py-1 px-2 text-black">
                            {it.sectionHeader}
                          </td>
                        </tr>
                      )}
                      {/* Print-friendly subtle alternating row shading for comfortable visual reading */}
                      <tr className={`border-b border-gray-400 ${idx % 2 === 1 ? 'bg-gray-100/90 print:bg-gray-100' : 'bg-white'}`}>
                        <td className="border-r border-black text-center py-1 px-1.5 font-mono font-bold text-xs">{it.sr}</td>
                        <td className="border-r border-black text-left py-1 px-2 font-medium">{it.description}</td>
                        <td className="border-r border-black text-center py-1 px-1.5 whitespace-nowrap">
                          {it.qty} {it.unit}
                        </td>
                        <td className="border-r border-black text-right py-1 px-2 whitespace-nowrap font-mono">
                          {formatCurrency(it.rate)}
                        </td>
                        <td className="text-right py-1 px-2 font-bold whitespace-nowrap font-mono">
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
                        <tr className="border-t-2 border-black bg-gray-100/90 print:bg-gray-100 text-[10pt]">
                          <td colSpan={4} className="border-r border-black text-right py-1.5 px-2.5 font-bold text-gray-900">
                            Sub Total (Goods):
                          </td>
                          <td className="text-right py-1.5 px-2.5 font-bold whitespace-nowrap font-mono text-black">
                            {formatCurrency(goodsSub)}
                          </td>
                        </tr>
                        {computed.gstBreakdown && computed.gstBreakdown.length > 1 ? (
                          <>
                            {computed.gstBreakdown.map((b) => (
                              <tr key={b.ratePercent} className="border-b border-gray-400 bg-gray-100/70 print:bg-gray-100 text-[9.5pt]">
                                <td colSpan={4} className="border-r border-black text-right py-1 px-2.5 font-semibold text-gray-800">
                                  GST @ {b.ratePercent}% (on Rs. {formatCurrency(b.taxableAmount)}):
                                </td>
                                <td className="text-right py-1 px-2.5 font-semibold whitespace-nowrap font-mono text-black">
                                  {formatCurrency(b.taxAmount)}
                                </td>
                              </tr>
                            ))}
                            <tr className="border-b border-black bg-gray-100/90 print:bg-gray-100 text-[10pt]">
                              <td colSpan={4} className="border-r border-black text-right py-1.5 px-2.5 font-bold text-gray-900">
                                Total GST on Goods:
                              </td>
                              <td className="text-right py-1.5 px-2.5 font-bold whitespace-nowrap font-mono text-black">
                                {formatCurrency(gst)}
                              </td>
                            </tr>
                          </>
                        ) : (
                          <tr className="border-b border-black bg-gray-100/90 print:bg-gray-100 text-[10pt]">
                            <td colSpan={4} className="border-r border-black text-right py-1.5 px-2.5 font-bold text-gray-900">
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
                        <tr className="border-t border-black bg-gray-100/90 print:bg-gray-100 text-[10pt]">
                          <td colSpan={4} className="border-r border-black text-right py-1.5 px-2.5 font-bold text-gray-900">
                            Sub Total (Services):
                          </td>
                          <td className="text-right py-1.5 px-2.5 font-bold whitespace-nowrap font-mono text-black">
                            {formatCurrency(serviceSub)}
                          </td>
                        </tr>
                        <tr className="border-b border-black bg-gray-100/90 print:bg-gray-100 text-[10pt]">
                          <td colSpan={4} className="border-r border-black text-right py-1.5 px-2.5 font-bold text-gray-900">
                            {pstPercent}% PST on Services:
                          </td>
                          <td className="text-right py-1.5 px-2.5 font-bold whitespace-nowrap font-mono text-black">
                            {formatCurrency(pst)}
                          </td>
                        </tr>
                      </>
                    )}

                    {/* GRAND TOTAL ROW - Prominent with Grey Highlight and Distinct Font Size/Style */}
                    <tr className="bg-gray-200 print:bg-gray-200 border-t-2 border-black border-b-[3px] border-b-black text-[12pt] sm:text-[12.5pt] font-black">
                      <td colSpan={4} className="border-r border-black text-right py-2.5 px-3 tracking-wider uppercase text-black font-black">
                        GRAND TOTAL (PKR):
                      </td>
                      <td className="text-right py-2.5 px-3 whitespace-nowrap font-mono text-[13pt] font-black text-black underline decoration-double">
                        Rs. {formatCurrency(grandTotal)}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>

            {/* Continuation indicator if not last page (strictly NO page number here; page numbers appear at bottom only) */}
            {!isLastPage && (
              <div className="text-right text-xs italic font-bold text-gray-700 py-1">
                (Continued on next sheet...)
              </div>
            )}

            {/* Amount in words & Signatures on Final Page */}
            {isLastPage && (
              <>
                <div className="border border-black p-2 mb-3 rounded bg-white text-[10pt]">
                  <span className="font-bold">In Words: </span>
                  <span className="font-semibold italic text-black">{numberToWordsPakistani(grandTotal)}</span>
                </div>

                <div className="flex justify-between items-end pt-3 mt-1">
                  <div className="text-[9pt] text-gray-600">
                    E. & O.E.
                  </div>
                  <div className="text-center w-64">
                    <div className="border-b border-black mb-1 w-full"></div>
                    <p className="text-[10pt] font-black uppercase tracking-wider text-black">For <span className="font-black">{firmName}</span></p>
                    <p className="text-[8.5pt] text-gray-700">Signature & Stamp</p>
                  </div>
                </div>
              </>
            )}

            {/* Bottom Page Footer on EVERY Sheet */}
            <div className="flex justify-between items-center border-t border-gray-300 pt-1.5 mt-3 text-[8.5pt] text-gray-600">
              <span>Bill No: {docNo} · {clientName}</span>
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
