import React from 'react';
import type { DocumentRecord, SupplierSettings } from '../../types/billing';
import { calculateTotals, formatCurrency, formatDateDisplay } from '../../utils/formatters';
import { numberToWordsPakistani } from '../../utils/numberToWords';

interface Props {
  doc: DocumentRecord;
  settings: SupplierSettings;
  printOnLetterhead: boolean;
}

export const QuotationPrintLayout: React.FC<Props> = ({ doc, settings, printOnLetterhead }) => {
  const items = doc.items || doc.Items || [];
  const goodsItems = items.filter((i) => i.tax === 'GST' || (i as any).Tax === 'GST');
  const serviceItems = items.filter((i) => i.tax === 'PST' || (i as any).Tax === 'PST');
  const otherItems = items.filter((i) => i.tax === 'None' || (i as any).Tax === 'None' || (!i.tax && !(i as any).Tax));

  const gstRate = settings.gstRate || 0.18;
  const pstRate = settings.pstRate || 0.16;
  const gstPercent = Math.round(gstRate * 100);
  const pstPercent = Math.round(pstRate * 100);

  // Dynamic live calculation fallback
  const computed = calculateTotals(items as any, gstRate, pstRate);

  const goodsSub = (doc.goodsSub && doc.goodsSub > 0) ? doc.goodsSub : (doc.GoodsSub && doc.GoodsSub > 0) ? doc.GoodsSub : computed.goodsSub;
  const gst = (doc.gst && doc.gst > 0) ? doc.gst : (doc.GST && doc.GST > 0) ? doc.GST : computed.gst;
  const serviceSub = (doc.serviceSub && doc.serviceSub > 0) ? doc.serviceSub : (doc.ServiceSub && doc.ServiceSub > 0) ? doc.ServiceSub : computed.serviceSub;
  const pst = (doc.pst && doc.pst > 0) ? doc.pst : (doc.PST && doc.PST > 0) ? doc.PST : computed.pst;
  const otherSub = (doc.otherSub && doc.otherSub > 0) ? doc.otherSub : (doc.OtherSub && doc.OtherSub > 0) ? doc.OtherSub : computed.otherSub;
  const grandTotal = (doc.grandTotal && doc.grandTotal > 0) ? doc.grandTotal : (doc.GrandTotal && doc.GrandTotal > 0) ? doc.GrandTotal : computed.grandTotal;

  const isCompact = items.length > 7;
  const pyClass = isCompact ? 'py-0.5' : 'py-1';

  let currentSr = 1;
  const firmName = doc.firmName || settings.supplierName || 'ANWAR TRADERS';

  return (
    <div className="quotation-sheet font-sans text-black text-[10.5pt] leading-normal mx-auto bg-white w-full">
      {/* If Letterhead OFF: Show Supplier Header */}
      {!printOnLetterhead && (
        <div className="border-b-2 border-black pb-2 mb-2.5 text-center">
          <h1 className="text-2xl font-black uppercase tracking-wide text-black">{firmName}</h1>
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

      {/* Quotation Title & Meta Info */}
      <div className="flex justify-between items-baseline border-b border-black pb-1.5 mb-2.5">
        <div>
          <span className="text-2xl font-black uppercase tracking-wider text-black">QUOTATION</span>
        </div>
        <div className="text-right text-[10pt] space-y-0.5">
          <div>
            <span className="font-bold">Quotation No: </span>
            <span className="font-bold font-mono px-2 py-0.5 bg-gray-100 border border-black rounded">
              {doc.docNo || doc.DocNo || '—'}
            </span>
          </div>
          <div>
            <span className="font-bold">Date: </span>
            <span className="font-semibold">{formatDateDisplay(doc.date || doc.Date)}</span>
          </div>
          {(doc.validUntil || doc.ValidUntil) && (
            <div>
              <span className="font-bold">Valid Until: </span>
              <span className="font-semibold">{formatDateDisplay(doc.validUntil || doc.ValidUntil)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Client & Reference Block */}
      <div className="mb-2.5 space-y-1 text-[10pt] border border-black p-2 rounded bg-gray-50/50">
        <div className="flex items-start">
          <span className="font-bold w-16 shrink-0">Name:</span>
          <span className="font-semibold text-black">
            M/s {doc.clientName || doc.ClientName}
            {(doc.clientAddress || doc.ClientAddress) ? `, ${doc.clientAddress || doc.ClientAddress}` : ''}
          </span>
        </div>
        {(doc.clientNTN || doc.ClientNTN) && (
          <div className="flex items-start">
            <span className="font-bold w-16 shrink-0">NTN:</span>
            <span>{doc.clientNTN || doc.ClientNTN}</span>
          </div>
        )}
        {(doc.refText || doc.RefText) && (
          <div className="flex items-start">
            <span className="font-bold w-16 shrink-0">Ref:</span>
            <span className="font-medium text-gray-900">{doc.refText || doc.RefText}</span>
          </div>
        )}
      </div>

      {/* Items Table */}
      <table className="w-full border-collapse border border-black text-[10pt] mb-2.5">
        <thead>
          <tr className="bg-gray-200 border-b border-black text-center font-bold">
            <th className="border-r border-black py-1 px-2 w-12">Sr.#</th>
            <th className="border-r border-black py-1 px-2 text-left">Description</th>
            <th className="border-r border-black py-1 px-2 w-24">Qty</th>
            <th className="border-r border-black py-1 px-2 w-24 text-right">Rate</th>
            <th className="py-1 px-2 w-28 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {/* SECTION A: GOODS */}
          {goodsItems.length > 0 && (
            <>
              <tr className="bg-gray-100 border-t border-b border-black font-bold text-xs uppercase tracking-wide">
                <td colSpan={5} className="py-1 px-2 text-black">
                  A. GOODS (General Sales Tax - GST @ {gstPercent}%)
                </td>
              </tr>
              {goodsItems.map((item) => {
                const sr = currentSr++;
                const qty = Number(item.qty ?? (item as any).Qty ?? 1);
                const rate = Number(item.rate ?? (item as any).Rate ?? 0);
                const amount = Number(item.amount ?? (item as any).Amount ?? Math.round(qty * rate * 100) / 100);
                const unit = item.unit || (item as any).Unit || 'Nos';
                return (
                  <tr key={sr} className="border-b border-gray-400">
                    <td className={`border-r border-black text-center ${pyClass} px-1.5`}>{sr}</td>
                    <td className={`border-r border-black text-left ${pyClass} px-2 font-medium`}>{item.description || (item as any).Description}</td>
                    <td className={`border-r border-black text-center ${pyClass} px-1.5 whitespace-nowrap`}>
                      {qty} {unit}
                    </td>
                    <td className={`border-r border-black text-right ${pyClass} px-2 whitespace-nowrap font-mono`}>
                      {formatCurrency(rate)}
                    </td>
                    <td className={`text-right ${pyClass} px-2 font-bold whitespace-nowrap font-mono`}>
                      {formatCurrency(amount)}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-black bg-gray-50 text-[9.5pt]">
                <td colSpan={4} className="border-r border-black text-right py-1 px-2 font-bold">
                  Sub Total (Goods):
                </td>
                <td className="text-right py-1 px-2 font-bold whitespace-nowrap font-mono">
                  {formatCurrency(goodsSub)}
                </td>
              </tr>
              <tr className="border-b border-black bg-gray-50 text-[9.5pt]">
                <td colSpan={4} className="border-r border-black text-right py-1 px-2 font-bold">
                  {gstPercent}% GST on Goods:
                </td>
                <td className="text-right py-1 px-2 font-bold whitespace-nowrap font-mono">
                  {formatCurrency(gst)}
                </td>
              </tr>
            </>
          )}

          {/* SECTION B: SERVICES / LABOUR */}
          {serviceItems.length > 0 && (
            <>
              <tr className="bg-gray-100 border-t border-b border-black font-bold text-xs uppercase tracking-wide">
                <td colSpan={5} className="py-1 px-2 text-black">
                  B. SERVICES / LABOUR (Punjab Sales Tax on Services - PST @ {pstPercent}%)
                </td>
              </tr>
              {serviceItems.map((item) => {
                const sr = currentSr++;
                const qty = Number(item.qty ?? (item as any).Qty ?? 1);
                const rate = Number(item.rate ?? (item as any).Rate ?? 0);
                const amount = Number(item.amount ?? (item as any).Amount ?? Math.round(qty * rate * 100) / 100);
                const unit = item.unit || (item as any).Unit || 'Job';
                return (
                  <tr key={sr} className="border-b border-gray-400">
                    <td className={`border-r border-black text-center ${pyClass} px-1.5`}>{sr}</td>
                    <td className={`border-r border-black text-left ${pyClass} px-2 font-medium`}>{item.description || (item as any).Description}</td>
                    <td className={`border-r border-black text-center ${pyClass} px-1.5 whitespace-nowrap`}>
                      {qty} {unit}
                    </td>
                    <td className={`border-r border-black text-right ${pyClass} px-2 whitespace-nowrap font-mono`}>
                      {formatCurrency(rate)}
                    </td>
                    <td className={`text-right ${pyClass} px-2 font-bold whitespace-nowrap font-mono`}>
                      {formatCurrency(amount)}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-black bg-gray-50 text-[9.5pt]">
                <td colSpan={4} className="border-r border-black text-right py-1 px-2 font-bold">
                  Sub Total (Services):
                </td>
                <td className="text-right py-1 px-2 font-bold whitespace-nowrap font-mono">
                  {formatCurrency(serviceSub)}
                </td>
              </tr>
              <tr className="border-b border-black bg-gray-50 text-[9.5pt]">
                <td colSpan={4} className="border-r border-black text-right py-1 px-2 font-bold">
                  {pstPercent}% PST on Services:
                </td>
                <td className="text-right py-1 px-2 font-bold whitespace-nowrap font-mono">
                  {formatCurrency(pst)}
                </td>
              </tr>
            </>
          )}

          {/* SECTION C: OTHER */}
          {otherItems.length > 0 && (
            <>
              <tr className="bg-gray-100 border-t border-b border-black font-bold text-xs uppercase tracking-wide">
                <td colSpan={5} className="py-1 px-2 text-black">
                  C. OTHER
                </td>
              </tr>
              {otherItems.map((item) => {
                const sr = currentSr++;
                const qty = Number(item.qty ?? (item as any).Qty ?? 1);
                const rate = Number(item.rate ?? (item as any).Rate ?? 0);
                const amount = Number(item.amount ?? (item as any).Amount ?? Math.round(qty * rate * 100) / 100);
                const unit = item.unit || (item as any).Unit || 'Nos';
                return (
                  <tr key={sr} className="border-b border-gray-400">
                    <td className={`border-r border-black text-center ${pyClass} px-1.5`}>{sr}</td>
                    <td className={`border-r border-black text-left ${pyClass} px-2 font-medium`}>{item.description || (item as any).Description}</td>
                    <td className={`border-r border-black text-center ${pyClass} px-1.5 whitespace-nowrap`}>
                      {qty} {unit}
                    </td>
                    <td className={`border-r border-black text-right ${pyClass} px-2 whitespace-nowrap font-mono`}>
                      {formatCurrency(rate)}
                    </td>
                    <td className={`text-right ${pyClass} px-2 font-bold whitespace-nowrap font-mono`}>
                      {formatCurrency(amount)}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-b border-black bg-gray-50 text-[9.5pt]">
                <td colSpan={4} className="border-r border-black text-right py-1 px-2 font-bold">
                  Sub Total (Other):
                </td>
                <td className="text-right py-1 px-2 font-bold whitespace-nowrap font-mono">
                  {formatCurrency(otherSub)}
                </td>
              </tr>
            </>
          )}

          {/* GRAND TOTAL */}
          <tr className="bg-gray-200 border-t-2 border-black border-b-[3px] border-b-black text-[11pt] font-black">
            <td colSpan={4} className="border-r border-black text-right py-2 px-3 tracking-wide">
              GRAND TOTAL (PKR):
            </td>
            <td className="text-right py-2 px-3 whitespace-nowrap font-mono text-black underline decoration-double">
              Rs. {formatCurrency(grandTotal)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Quotation standard terms & conditions */}
      <div className="border border-black p-2 mb-2 rounded bg-gray-50 text-[9.5pt] space-y-0.5">
        <p className="font-bold text-black">
          Rates are as per above. Taxes as applicable. Delivery as per PO / agreed schedule.
        </p>
        <p className="text-gray-800 text-[9pt]">
          Payment terms: 100% on delivery and inspection as per government financial rules.
        </p>
      </div>

      {/* Amount in words */}
      <div className="border border-black p-2 mb-4 rounded bg-gray-50 text-[10pt]">
        <span className="font-bold">In Words: </span>
        <span className="font-semibold italic text-black">{numberToWordsPakistani(grandTotal)}</span>
      </div>

      {/* Bottom Signature & Stamp */}
      <div className="flex justify-between items-end pt-4 mt-2">
        <div className="text-[9pt] text-gray-600">
          Valid for 7 days unless specified
        </div>
        <div className="text-center w-64">
          <div className="border-b border-black mb-1 w-full"></div>
          <p className="text-[10pt] font-black uppercase tracking-wider text-black">For {firmName}</p>
          <p className="text-[8.5pt] text-gray-700">Authorised Signatory</p>
        </div>
      </div>
    </div>
  );
};
