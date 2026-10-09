import React from 'react';
import type { DocumentRecord, SupplierSettings } from '../../types/billing';
import { calculateTotals, formatCurrency, formatDateDisplay, safeNormalizeItems } from '../../utils/formatters';
import { numberToWordsPakistani } from '../../utils/numberToWords';

interface Props {
  doc: DocumentRecord;
  settings: SupplierSettings;
  printOnLetterhead: boolean;
}

export const GstInvoicePrintLayout: React.FC<Props> = ({ doc, settings, printOnLetterhead }) => {
  const items = safeNormalizeItems(doc.items || doc.Items);
  const gstRate = (doc.gstRate !== undefined && doc.gstRate !== null && Number(doc.gstRate) >= 0)
    ? Number(doc.gstRate)
    : ((doc as any).GstRate !== undefined && Number((doc as any).GstRate) >= 0)
    ? Number((doc as any).GstRate)
    : (settings.gstRate || 0.18);
  const gstPercent = Math.round(gstRate * 100);

  // Dynamic live calculation fallback
  const computed = calculateTotals(items, gstRate, 0.16);

  const goodsSub = (doc.goodsSub && doc.goodsSub > 0) ? doc.goodsSub : (doc.GoodsSub && doc.GoodsSub > 0) ? doc.GoodsSub : computed.goodsSub;
  const gst = (doc.gst && doc.gst > 0) ? doc.gst : (doc.GST && doc.GST > 0) ? doc.GST : computed.gst;
  const valueIncTax = Math.round((goodsSub + gst) * 100) / 100;

  const docNo = doc.docNo || doc.DocNo || '—';
  const docDate = formatDateDisplay(doc.date || doc.Date);
  const clientName = doc.clientName || doc.ClientName || '';
  const clientAddress = doc.clientAddress || doc.ClientAddress || '';
  const clientNTN = doc.clientNTN || doc.ClientNTN || '';
  const refText = doc.refText || doc.RefText || '';
  const firmObj = settings.firms?.find((f) => f.id === doc.firmId) ||
    settings.firms?.find((f) => f.name?.toLowerCase().trim() === (doc.firmName || '').toLowerCase().trim());
  const isHashirStyle = doc.firmId === 'firm-hashir-traders' ||
    (doc.firmName || '').toLowerCase().includes('hashir') ||
    firmObj?.styleTheme === 'MODERN_CORPORATE';

  const firmName = doc.firmName || firmObj?.name || settings.supplierName || 'ANWAR TRADERS';
  const firmTagline = firmObj?.tagline || settings.supplierTagline;
  const firmAddress = firmObj?.address || settings.supplierAddress;
  const firmPhone = firmObj?.phone || settings.supplierPhone;
  const firmNTN = firmObj?.ntn || settings.supplierNTN;
  const firmGST = firmObj?.gst || settings.supplierGST;
  const firmVendor = firmObj?.vendorNo || settings.vendorNo;

  // 4 empty rows for authentic Pakistani government sales tax format
  const emptyRows = [1, 2, 3, 4];

  return (
    <div className={`gst-invoice-sheet text-black text-[10pt] leading-tight mx-auto bg-white w-full print:bg-white print:text-black ${
      isHashirStyle ? 'font-sans' : 'font-serif'
    }`}>
      {/* If Letterhead OFF: Show Supplier Header */}
      {!printOnLetterhead && (
        <div className={`border-b-2 ${isHashirStyle ? 'border-slate-900 pb-3 mb-3' : 'border-black pb-2 mb-2.5'} text-center`}>
          <h1 className="text-2xl font-black uppercase tracking-wide text-black">{firmName}</h1>
          <p className="text-xs font-semibold text-gray-700 tracking-wider uppercase">{firmTagline}</p>
          <p className="text-xs text-gray-800 mt-0.5">{firmAddress}</p>
          <div className="flex flex-wrap justify-center gap-x-4 text-xs font-semibold text-gray-900 mt-1">
            <span>Ph: {firmPhone}</span>
            <span>NTN: {firmNTN}</span>
            <span>GST No: {firmGST}</span>
            {firmVendor && <span>Vendor No: {firmVendor}</span>}
          </div>
        </div>
      )}

      {/* Main Title & Invoice Number */}
      <div className="flex justify-between items-center border-b-2 border-black pb-1 mb-2">
        <div className="flex items-center gap-3">
          <div className="text-xl font-black uppercase tracking-wider text-black">
            SALES TAX INVOICE
          </div>
        </div>
        <div className="text-right text-[10pt] font-bold">
          <div>Invoice #: <span className="underline font-mono">{docNo}</span></div>
          <div>Date: <span className="font-semibold">{docDate}</span></div>
        </div>
      </div>

      {/* Supplier & Buyer Two-Column Detail Box (Pure white, crisp black borders) */}
      <div className="border border-black rounded p-2 mb-2.5 text-[9.5pt] grid grid-cols-2 gap-3 bg-white">
        {/* Supplier details */}
        <div className="border-r border-gray-400 pr-2 space-y-0.5">
          <div className="font-bold text-xs uppercase text-gray-800 tracking-wider border-b border-gray-300 pb-0.5 mb-1">
            Supplier&apos;s Particulars
          </div>
          <div><span className="font-bold">M/s: </span><strong className="font-black text-black uppercase tracking-wide">{firmName}</strong></div>
          <div className="text-xs text-gray-800 truncate"><span className="font-bold">Address: </span>{settings.supplierAddress}</div>
          <div className="text-xs grid grid-cols-2 gap-1 pt-0.5">
            <div><span className="font-bold">NTN: </span>{settings.supplierNTN}</div>
            <div><span className="font-bold">GST Reg: </span>{settings.supplierGST}</div>
          </div>
          {settings.vendorNo && (
            <div className="text-xs"><span className="font-bold">Vendor #: </span>{settings.vendorNo}</div>
          )}
        </div>

        {/* Buyer details */}
        <div className="space-y-0.5">
          <div className="font-bold text-xs uppercase text-gray-800 tracking-wider border-b border-gray-300 pb-0.5 mb-1">
            Buyer&apos;s Particulars
          </div>
          <div><span className="font-bold">M/s: </span>{clientName}</div>
          <div className="text-xs text-gray-800 truncate"><span className="font-bold">Address: </span>{clientAddress || '—'}</div>
          <div className="text-xs"><span className="font-bold">NTN #: </span>{clientNTN || '................................'}</div>
          <div className="text-xs"><span className="font-bold">ST Reg #: </span>................................</div>
          <div className="text-xs pt-0.5 truncate"><span className="font-bold">Terms: </span>{refText || 'As per Purchase Order'}</div>
        </div>
      </div>

      {/* Main GST Table (Pure white, zero grey highlights) */}
      <table className="w-full border-collapse border border-black text-[9.5pt] mb-2.5 bg-white">
        <thead>
          <tr className="bg-white border-b-2 border-black text-center font-bold">
            <th className="border-r border-black py-1.5 px-1 w-16">Quantity</th>
            <th className="border-r border-black py-1.5 px-2 text-left">Description Of Goods</th>
            <th className="border-r border-black py-1.5 px-1.5 w-20 text-right">Rate</th>
            <th className="border-r border-black py-1.5 px-1.5 w-24 text-right">Value Exclusive Sales Tax</th>
            <th className="border-r border-black py-1.5 px-1 w-16">Rate of S.T</th>
            <th className="border-r border-black py-1.5 px-1.5 w-24 text-right">Total Sales Tax Payable</th>
            <th className="py-1.5 px-1.5 w-24 text-right">Value Including Sales Tax</th>
          </tr>
        </thead>
        <tbody>
          {/* GST Item Rows: Displays breakdown for multiple rates or standard row for uniform rate */}
          {computed.gstBreakdown && computed.gstBreakdown.length > 1 ? (
            computed.gstBreakdown.map((b) => (
              <tr key={b.ratePercent} className="border-b border-black font-medium bg-white text-[9.5pt]">
                <td className="border-r border-black py-2 px-1 text-center font-bold">1 Job</td>
                <td className="border-r border-black py-2 px-2">
                  <span className="font-bold">AS PER BILL NO. {docNo}</span>
                  <span className="text-[8.5pt] text-gray-700 block">Goods subject to {b.ratePercent}% Sales Tax</span>
                </td>
                <td className="border-r border-black py-2 px-1.5 text-right font-mono">{formatCurrency(b.taxableAmount)}</td>
                <td className="border-r border-black py-2 px-1.5 text-right font-bold font-mono">{formatCurrency(b.taxableAmount)}</td>
                <td className="border-r border-black py-2 px-1 text-center font-bold">{b.ratePercent}%</td>
                <td className="border-r border-black py-2 px-1.5 text-right font-bold font-mono">{formatCurrency(b.taxAmount)}</td>
                <td className="py-2 px-1.5 text-right font-black font-mono">{formatCurrency(b.taxableAmount + b.taxAmount)}</td>
              </tr>
            ))
          ) : (
            <tr className="border-b border-black font-medium bg-white">
              <td className="border-r border-black py-2 px-1 text-center font-bold">1 Job</td>
              <td className="border-r border-black py-2 px-2">
                <span className="font-bold">AS PER BILL NO. {docNo}</span>
              </td>
              <td className="border-r border-black py-2 px-1.5 text-right font-mono">{formatCurrency(goodsSub)}</td>
              <td className="border-r border-black py-2 px-1.5 text-right font-bold font-mono">{formatCurrency(goodsSub)}</td>
              <td className="border-r border-black py-2 px-1 text-center font-bold">
                {computed.gstBreakdown?.[0]?.ratePercent ?? gstPercent}%
              </td>
              <td className="border-r border-black py-2 px-1.5 text-right font-bold font-mono">{formatCurrency(gst)}</td>
              <td className="py-2 px-1.5 text-right font-black font-mono">{formatCurrency(valueIncTax)}</td>
            </tr>
          )}

          {/* 4 Empty Form Rows for standard paper format */}
          {emptyRows.map((n) => (
            <tr key={n} className="border-b border-gray-400 h-5 bg-white">
              <td className="border-r border-black"></td>
              <td className="border-r border-black"></td>
              <td className="border-r border-black"></td>
              <td className="border-r border-black"></td>
              <td className="border-r border-black"></td>
              <td className="border-r border-black"></td>
              <td></td>
            </tr>
          ))}

          {/* TOTAL ROW - Prominent with Grey Highlight and Distinct Bold Font */}
          <tr className="bg-gray-200 print:bg-gray-200 border-t-2 border-b-[3px] border-black text-[11pt] font-black">
            <td colSpan={3} className="border-r border-black py-2 px-2 text-right uppercase tracking-wider text-black">
              TOTAL:
            </td>
            <td className="border-r border-black py-2 px-1.5 text-right font-mono font-bold text-black">
              {formatCurrency(goodsSub)}
            </td>
            <td className="border-r border-black py-2 px-1 text-center"></td>
            <td className="border-r border-black py-2 px-1.5 text-right font-mono font-bold text-black">
              {formatCurrency(gst)}
            </td>
            <td className="py-2 px-1.5 text-right font-black font-mono text-[11.5pt] text-black underline decoration-double">
              {formatCurrency(valueIncTax)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Tax Summary Block (Pure white, no grey highlight) */}
      <div className="flex justify-between items-start mb-2.5 border border-black p-2 rounded bg-white">
        <div className="space-y-0.5 text-[9.5pt] w-full">
          <div>
            <span className="font-bold">Sale Tax Rs: </span>
            <span className="font-bold font-mono underline decoration-dotted">{formatCurrency(gst)}</span>
          </div>
          <div>
            <span className="font-bold">Sale Tax Inclusive Value Rs: </span>
            <span className="font-black font-mono underline decoration-double">{formatCurrency(valueIncTax)}</span>
          </div>
          <div className="pt-0.5 text-[9pt] italic text-gray-800">
            <span className="font-bold not-italic">In Words: </span>
            {numberToWordsPakistani(valueIncTax)}
          </div>
        </div>
      </div>

      {/* Bottom Signatures */}
      <div className="flex justify-between items-end pt-6 mt-4">
        <div className="text-center w-52">
          <div className="border-b border-black mb-1 w-full"></div>
          <p className="text-xs text-gray-700">Buyer&apos;s Signature / Stamp</p>
        </div>
        <div className="text-center w-56">
          <div className="border-b border-black mb-1 w-full"></div>
          <p className="text-xs font-black uppercase tracking-wider text-black">For {firmName}</p>
          <p className="text-xs text-gray-700">Authorised Signatory & Stamp</p>
        </div>
      </div>

      {/* Bottom Page Footer */}
      <div className="flex justify-between items-center border-t border-gray-300 pt-1.5 mt-3 text-[8.5pt] text-gray-600">
        <span>Sales Tax Invoice #{docNo} · {clientName}</span>
        <span className="font-bold text-gray-800">
          Page 1 of 1
        </span>
      </div>
    </div>
  );
};
