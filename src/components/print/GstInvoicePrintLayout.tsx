import React from 'react';
import type { DocumentRecord, SupplierSettings } from '../../types/billing';
import { formatCurrency, formatDateDisplay } from '../../utils/formatters';
import { numberToWordsPakistani } from '../../utils/numberToWords';

interface Props {
  doc: DocumentRecord;
  settings: SupplierSettings;
  printOnLetterhead: boolean;
}

export const GstInvoicePrintLayout: React.FC<Props> = ({ doc, settings, printOnLetterhead }) => {
  const gstPercent = Math.round((settings.gstRate || 0.18) * 100);
  const goodsSub = doc.goodsSub ?? doc.GoodsSub ?? 0;
  const gst = doc.gst ?? doc.GST ?? Math.round(goodsSub * (settings.gstRate || 0.18) * 100) / 100;
  const valueIncTax = Math.round((goodsSub + gst) * 100) / 100;

  const docNo = doc.docNo || doc.DocNo || '—';
  const docDate = formatDateDisplay(doc.date || doc.Date);
  const clientName = doc.clientName || doc.ClientName || '';
  const clientAddress = doc.clientAddress || doc.ClientAddress || '';
  const clientNTN = doc.clientNTN || doc.ClientNTN || '';
  const refText = doc.refText || doc.RefText || '';

  // 4 empty rows for authentic Pakistani government sales tax format
  const emptyRows = [1, 2, 3, 4];

  return (
    <div className="gst-invoice-sheet font-sans text-black text-[10.5pt] leading-tight mx-auto bg-white">
      {/* If Letterhead OFF: Show Supplier Header */}
      {!printOnLetterhead && (
        <div className="border-b-2 border-black pb-2 mb-3 text-center">
          <h1 className="text-2xl font-bold uppercase tracking-wide text-black">{settings.supplierName}</h1>
          <p className="text-xs font-semibold text-gray-700 tracking-wider uppercase">{settings.supplierTagline}</p>
          <p className="text-xs text-gray-800 mt-0.5">{settings.supplierAddress}</p>
          <div className="flex flex-wrap justify-center gap-x-4 text-xs font-medium text-gray-900 mt-1">
            <span>Ph: {settings.supplierPhone}</span>
            <span>NTN: {settings.supplierNTN}</span>
            <span>GST No: {settings.supplierGST}</span>
            {settings.vendorNo && <span>Vendor No: {settings.vendorNo}</span>}
          </div>
        </div>
      )}

      {/* Main Title & Invoice Number */}
      <div className="flex justify-between items-center border-b-2 border-black pb-1.5 mb-2.5">
        <div className="text-xl font-black uppercase tracking-wider text-black">
          SALES TAX INVOICE
        </div>
        <div className="text-right text-[10pt] font-bold">
          <div>Invoice #: <span className="underline">{docNo}</span></div>
          <div>Date: <span className="font-semibold">{docDate}</span></div>
        </div>
      </div>

      {/* Supplier & Buyer Two-Column Detail Box */}
      <div className="border border-black rounded p-2 mb-3 text-[10pt] grid grid-cols-2 gap-4 bg-gray-50/40">
        {/* Supplier details */}
        <div className="border-r border-gray-400 pr-3 space-y-1">
          <div className="font-bold text-xs uppercase text-gray-800 tracking-wider border-b border-gray-300 pb-0.5">
            Supplier&apos;s Particulars
          </div>
          <div><span className="font-bold">M/s: </span>{settings.supplierName}</div>
          <div className="text-xs"><span className="font-bold">Address: </span>{settings.supplierAddress}</div>
          <div className="text-xs grid grid-cols-2 gap-1 pt-0.5">
            <div><span className="font-bold">NTN: </span>{settings.supplierNTN}</div>
            <div><span className="font-bold">GST Reg: </span>{settings.supplierGST}</div>
          </div>
          {settings.vendorNo && (
            <div className="text-xs"><span className="font-bold">Vendor #: </span>{settings.vendorNo}</div>
          )}
        </div>

        {/* Buyer details */}
        <div className="space-y-1">
          <div className="font-bold text-xs uppercase text-gray-800 tracking-wider border-b border-gray-300 pb-0.5">
            Buyer&apos;s Particulars
          </div>
          <div><span className="font-bold">M/s: </span>{clientName}</div>
          <div className="text-xs"><span className="font-bold">Address: </span>{clientAddress || '—'}</div>
          <div className="text-xs"><span className="font-bold">NTN #: </span>{clientNTN || '................................'}</div>
          <div className="text-xs"><span className="font-bold">ST Reg #: </span>................................</div>
          <div className="text-xs pt-0.5 truncate"><span className="font-bold">Terms of Sale: </span>{refText || 'As per Purchase Order'}</div>
        </div>
      </div>

      {/* Main GST Table */}
      <table className="w-full border-collapse border border-black text-[9.5pt] mb-3">
        <thead>
          <tr className="bg-gray-200 border-b border-black text-center font-bold">
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
          {/* Main Single Summary Row */}
          <tr className="border-b border-black font-medium">
            <td className="border-r border-black py-2 px-1 text-center font-semibold">1 Job</td>
            <td className="border-r border-black py-2 px-2">
              <span className="font-bold">AS PER BILL NO. {docNo}</span> (Vehicle Parts - Goods)
            </td>
            <td className="border-r border-black py-2 px-1.5 text-right">{formatCurrency(goodsSub)}</td>
            <td className="border-r border-black py-2 px-1.5 text-right font-semibold">{formatCurrency(goodsSub)}</td>
            <td className="border-r border-black py-2 px-1 text-center font-bold">{gstPercent}%</td>
            <td className="border-r border-black py-2 px-1.5 text-right font-semibold">{formatCurrency(gst)}</td>
            <td className="py-2 px-1.5 text-right font-bold">{formatCurrency(valueIncTax)}</td>
          </tr>

          {/* 4 Empty Form Rows for standard paper format */}
          {emptyRows.map((n) => (
            <tr key={n} className="border-b border-gray-400 h-6">
              <td className="border-r border-black"></td>
              <td className="border-r border-black"></td>
              <td className="border-r border-black"></td>
              <td className="border-r border-black"></td>
              <td className="border-r border-black"></td>
              <td className="border-r border-black"></td>
              <td></td>
            </tr>
          ))}

          {/* TOTAL ROW */}
          <tr className="bg-gray-100 border-t-2 border-b-2 border-black font-bold">
            <td colSpan={3} className="border-r border-black py-1.5 px-2 text-right uppercase">
              TOTAL:
            </td>
            <td className="border-r border-black py-1.5 px-1.5 text-right">
              {formatCurrency(goodsSub)}
            </td>
            <td className="border-r border-black py-1.5 px-1 text-center"></td>
            <td className="border-r border-black py-1.5 px-1.5 text-right">
              {formatCurrency(gst)}
            </td>
            <td className="py-1.5 px-1.5 text-right">
              {formatCurrency(valueIncTax)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Tax Summary Block */}
      <div className="flex justify-between items-start mb-3 border border-black p-2 rounded bg-gray-50/50">
        <div className="space-y-1 text-[10pt] w-2/3">
          <div>
            <span className="font-bold">Sale Tax Rs: </span>
            <span className="font-bold underline decoration-dotted">{formatCurrency(gst)}</span>
          </div>
          <div>
            <span className="font-bold">Sale Tax Inclusive Value Rs: </span>
            <span className="font-black underline decoration-double">{formatCurrency(valueIncTax)}</span>
          </div>
          <div className="pt-1 text-[9.5pt] italic text-gray-800">
            <span className="font-bold not-italic">In Words: </span>
            {numberToWordsPakistani(valueIncTax)}
          </div>
        </div>
        <div className="w-1/3 text-right text-[8.5pt] text-gray-500 italic pr-2">
          Note: Punjab Sales Tax (Services/Labour) is excluded from this Federal GST Invoice.
        </div>
      </div>

      {/* Bottom Signatures */}
      <div className="flex justify-between items-end pt-10 mt-6">
        <div className="text-center w-52">
          <div className="border-b border-black mb-1 w-full"></div>
          <p className="text-xs text-gray-700">Buyer&apos;s Signature / Stamp</p>
        </div>
        <div className="text-center w-56">
          <div className="border-b border-black mb-1 w-full"></div>
          <p className="text-xs font-bold uppercase tracking-wider text-black">For {settings.supplierName}</p>
          <p className="text-xs text-gray-700">Authorised Signatory & Stamp</p>
        </div>
      </div>
    </div>
  );
};
