import React from 'react';
import type { DocumentRecord, SupplierSettings } from '../../types/billing';
import { formatCurrency, formatDateDisplay } from '../../utils/formatters';
import { numberToWordsPakistani } from '../../utils/numberToWords';

interface Props {
  doc: DocumentRecord;
  settings: SupplierSettings;
  printOnLetterhead: boolean;
}

export const BillPrintLayout: React.FC<Props> = ({ doc, settings, printOnLetterhead }) => {
  const items = doc.items || [];
  const goodsItems = items.filter((i) => i.tax === 'GST');
  const serviceItems = items.filter((i) => i.tax === 'PST');
  const otherItems = items.filter((i) => i.tax === 'None');

  const gstPercent = Math.round((settings.gstRate || 0.18) * 100);
  const pstPercent = Math.round((settings.pstRate || 0.16) * 100);

  const goodsSub = doc.goodsSub ?? doc.GoodsSub ?? 0;
  const gst = doc.gst ?? doc.GST ?? 0;
  const serviceSub = doc.serviceSub ?? doc.ServiceSub ?? 0;
  const pst = doc.pst ?? doc.PST ?? 0;
  const otherSub = doc.otherSub ?? doc.OtherSub ?? 0;
  const grandTotal = doc.grandTotal ?? doc.GrandTotal ?? (goodsSub + gst + serviceSub + pst + otherSub);

  // Compact spacing if items count is high to fit 1 page
  const isCompact = items.length > 8;
  const pyClass = isCompact ? 'py-0.5' : 'py-1';

  let currentSr = 1;

  return (
    <div className="bill-sheet font-sans text-black text-[11pt] leading-normal mx-auto bg-white">
      {/* If Letterhead OFF: Show Supplier Header Block */}
      {!printOnLetterhead && (
        <div className="border-b-2 border-black pb-3 mb-4 text-center">
          <h1 className="text-2xl font-bold tracking-wide uppercase text-black">{settings.supplierName}</h1>
          <p className="text-xs font-semibold text-gray-700 tracking-wider uppercase">{settings.supplierTagline}</p>
          <p className="text-xs text-gray-800 mt-1">{settings.supplierAddress}</p>
          <div className="flex flex-wrap justify-center gap-x-4 text-xs font-medium text-gray-900 mt-1">
            <span>Ph: {settings.supplierPhone}</span>
            <span>NTN: {settings.supplierNTN}</span>
            <span>GST No: {settings.supplierGST}</span>
            {settings.vendorNo && <span>Vendor No: {settings.vendorNo}</span>}
          </div>
        </div>
      )}

      {/* Bill Title & Meta Info */}
      <div className="flex justify-between items-baseline border-b border-black pb-2 mb-3">
        <div>
          <span className="text-2xl font-black uppercase tracking-wider">BILL</span>
        </div>
        <div className="text-right text-[11pt] space-y-0.5">
          <div>
            <span className="font-bold">Bill No: </span>
            <span className="font-semibold px-2 py-0.5 bg-gray-100 border border-gray-400 rounded">
              {doc.docNo || doc.DocNo || '—'}
            </span>
          </div>
          <div>
            <span className="font-bold">Date: </span>
            <span className="font-semibold">{formatDateDisplay(doc.date || doc.Date)}</span>
          </div>
        </div>
      </div>

      {/* Client & PO Reference Block */}
      <div className="mb-3 space-y-1.5 text-[11pt] border border-black p-2.5 rounded bg-gray-50/50">
        <div className="flex items-start">
          <span className="font-bold w-20 shrink-0">Name:</span>
          <span className="font-semibold">
            M/s {doc.clientName || doc.ClientName}
            {(doc.clientAddress || doc.ClientAddress) ? `, ${doc.clientAddress || doc.ClientAddress}` : ''}
          </span>
        </div>
        {(doc.clientNTN || doc.ClientNTN) && (
          <div className="flex items-start">
            <span className="font-bold w-20 shrink-0">Client NTN:</span>
            <span>{doc.clientNTN || doc.ClientNTN}</span>
          </div>
        )}
        {(doc.refText || doc.RefText) && (
          <div className="flex items-start">
            <span className="font-bold w-20 shrink-0">Ref:</span>
            <span className="font-medium text-gray-900">{doc.refText || doc.RefText}</span>
          </div>
        )}
      </div>

      {/* Items Table */}
      <table className="w-full border-collapse border border-black text-[10.5pt] mb-3">
        <thead>
          <tr className="bg-gray-200 border-b border-black text-center font-bold">
            <th className="border-r border-black py-1.5 px-2 w-12">Sr.#</th>
            <th className="border-r border-black py-1.5 px-2 text-left">Description</th>
            <th className="border-r border-black py-1.5 px-2 w-24">Qty</th>
            <th className="border-r border-black py-1.5 px-2 w-24 text-right">Rate</th>
            <th className="py-1.5 px-2 w-28 text-right">Amount</th>
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
                const amount = item.amount ?? (item.qty * item.rate);
                const unitStr = item.unit ? ` ${item.unit}` : '';
                return (
                  <tr key={sr} className="border-b border-gray-400">
                    <td className={`border-r border-black text-center ${pyClass} px-1.5`}>{sr}</td>
                    <td className={`border-r border-black text-left ${pyClass} px-2 font-medium`}>{item.description}</td>
                    <td className={`border-r border-black text-center ${pyClass} px-1.5 whitespace-nowrap`}>
                      {item.qty}{unitStr}
                    </td>
                    <td className={`border-r border-black text-right ${pyClass} px-2 whitespace-nowrap`}>
                      {formatCurrency(item.rate)}
                    </td>
                    <td className={`text-right ${pyClass} px-2 font-semibold whitespace-nowrap`}>
                      {formatCurrency(amount)}
                    </td>
                  </tr>
                );
              })}
              {/* Goods Subtotals */}
              <tr className="border-t border-black bg-gray-50 text-[10pt]">
                <td colSpan={4} className="border-r border-black text-right py-1 px-2 font-bold">
                  Sub Total (Goods):
                </td>
                <td className="text-right py-1 px-2 font-bold whitespace-nowrap">
                  {formatCurrency(goodsSub)}
                </td>
              </tr>
              <tr className="border-b border-black bg-gray-50 text-[10pt]">
                <td colSpan={4} className="border-r border-black text-right py-1 px-2 font-bold">
                  {gstPercent}% GST on Goods:
                </td>
                <td className="text-right py-1 px-2 font-bold whitespace-nowrap">
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
                const amount = item.amount ?? (item.qty * item.rate);
                const unitStr = item.unit ? ` ${item.unit}` : '';
                return (
                  <tr key={sr} className="border-b border-gray-400">
                    <td className={`border-r border-black text-center ${pyClass} px-1.5`}>{sr}</td>
                    <td className={`border-r border-black text-left ${pyClass} px-2 font-medium`}>{item.description}</td>
                    <td className={`border-r border-black text-center ${pyClass} px-1.5 whitespace-nowrap`}>
                      {item.qty}{unitStr}
                    </td>
                    <td className={`border-r border-black text-right ${pyClass} px-2 whitespace-nowrap`}>
                      {formatCurrency(item.rate)}
                    </td>
                    <td className={`text-right ${pyClass} px-2 font-semibold whitespace-nowrap`}>
                      {formatCurrency(amount)}
                    </td>
                  </tr>
                );
              })}
              {/* Service Subtotals */}
              <tr className="border-t border-black bg-gray-50 text-[10pt]">
                <td colSpan={4} className="border-r border-black text-right py-1 px-2 font-bold">
                  Sub Total (Services):
                </td>
                <td className="text-right py-1 px-2 font-bold whitespace-nowrap">
                  {formatCurrency(serviceSub)}
                </td>
              </tr>
              <tr className="border-b border-black bg-gray-50 text-[10pt]">
                <td colSpan={4} className="border-r border-black text-right py-1 px-2 font-bold">
                  {pstPercent}% PST on Services:
                </td>
                <td className="text-right py-1 px-2 font-bold whitespace-nowrap">
                  {formatCurrency(pst)}
                </td>
              </tr>
            </>
          )}

          {/* SECTION C: OTHER (Non-taxed items) */}
          {otherItems.length > 0 && (
            <>
              <tr className="bg-gray-100 border-t border-b border-black font-bold text-xs uppercase tracking-wide">
                <td colSpan={5} className="py-1 px-2 text-black">
                  C. OTHER
                </td>
              </tr>
              {otherItems.map((item) => {
                const sr = currentSr++;
                const amount = item.amount ?? (item.qty * item.rate);
                const unitStr = item.unit ? ` ${item.unit}` : '';
                return (
                  <tr key={sr} className="border-b border-gray-400">
                    <td className={`border-r border-black text-center ${pyClass} px-1.5`}>{sr}</td>
                    <td className={`border-r border-black text-left ${pyClass} px-2 font-medium`}>{item.description}</td>
                    <td className={`border-r border-black text-center ${pyClass} px-1.5 whitespace-nowrap`}>
                      {item.qty}{unitStr}
                    </td>
                    <td className={`border-r border-black text-right ${pyClass} px-2 whitespace-nowrap`}>
                      {formatCurrency(item.rate)}
                    </td>
                    <td className={`text-right ${pyClass} px-2 font-semibold whitespace-nowrap`}>
                      {formatCurrency(amount)}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-b border-black bg-gray-50 text-[10pt]">
                <td colSpan={4} className="border-r border-black text-right py-1 px-2 font-bold">
                  Sub Total (Other):
                </td>
                <td className="text-right py-1 px-2 font-bold whitespace-nowrap">
                  {formatCurrency(otherSub)}
                </td>
              </tr>
            </>
          )}

          {/* GRAND TOTAL ROW: Shaded, thick line above, double line below */}
          <tr className="bg-gray-200 border-t-2 border-black border-b-[3px] border-b-black text-[11.5pt] font-black">
            <td colSpan={4} className="border-r border-black text-right py-2 px-3 tracking-wide">
              GRAND TOTAL (PKR):
            </td>
            <td className="text-right py-2 px-3 whitespace-nowrap underline decoration-double">
              Rs. {formatCurrency(grandTotal)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Amount in words */}
      <div className="border border-black p-2.5 mb-8 rounded bg-gray-50 text-[11pt]">
        <span className="font-bold">In Words: </span>
        <span className="font-medium italic">{numberToWordsPakistani(grandTotal)}</span>
      </div>

      {/* Bottom Signature & Stamp */}
      <div className="flex justify-between items-end pt-8 mt-6">
        <div className="text-xs text-gray-500">
          E. & O.E.
        </div>
        <div className="text-center w-64">
          <div className="border-b border-black mb-1 w-full"></div>
          <p className="text-xs font-bold uppercase tracking-wider text-black">For {settings.supplierName}</p>
          <p className="text-xs text-gray-700">Signature & Stamp</p>
        </div>
      </div>
    </div>
  );
};
