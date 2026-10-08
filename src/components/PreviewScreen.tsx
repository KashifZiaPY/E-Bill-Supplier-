import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Edit,
  Printer,
  CheckCircle,
  FileText,
  FileCheck2,
} from 'lucide-react';
import type { DocumentRecord, SupplierSettings } from '../types/billing';
import { BillPrintLayout } from './print/BillPrintLayout';
import { GstInvoicePrintLayout } from './print/GstInvoicePrintLayout';
import { QuotationPrintLayout } from './print/QuotationPrintLayout';

const STORAGE_KEY_LETTERHEAD = 'anwar_traders_print_letterhead';

interface Props {
  doc: DocumentRecord;
  settings: SupplierSettings;
  onBack: () => void;
  onEdit: () => void;
}

export const PreviewScreen: React.FC<Props> = ({
  doc,
  settings,
  onBack,
  onEdit,
}) => {
  const docType = doc.type || doc.Type || 'BILL';
  const items = doc.items || [];
  const hasGstItems = items.some((i) => i.tax === 'GST') || (doc.goodsSub ?? doc.GoodsSub ?? 0) > 0;

  // Active tab: 'BILL' | 'GST' | 'QUOTATION'
  const [activeTab, setActiveTab] = useState<'BILL' | 'GST' | 'QUOTATION'>(() => {
    return docType === 'BILL' ? 'BILL' : 'QUOTATION';
  });

  // Remember "Print on my letterhead" switch (default ON = true)
  const [printOnLetterhead, setPrintOnLetterhead] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_LETTERHEAD);
    return saved !== null ? saved === 'true' : true;
  });

  const handleToggleLetterhead = (val: boolean) => {
    setPrintOnLetterhead(val);
    localStorage.setItem(STORAGE_KEY_LETTERHEAD, String(val));
  };

  const handlePrint = () => {
    window.print();
  };

  // Top and bottom margin calculation in inches
  const topMargin = printOnLetterhead ? (settings.letterheadTop || 2.5) : 0.5;
  const bottomMargin = printOnLetterhead ? (settings.letterheadBottom || 1.5) : 0.5;

  return (
    <div className="min-h-screen bg-slate-200">
      {/* Injected Print CSS for exact A4 Margins and Single-Page fit */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: ${topMargin}in 0.6in ${bottomMargin}in 0.6in;
        }
        @media print {
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .print-container {
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Top Action & Navigation Bar (Screen Only - no-print) */}
      <div className="no-print bg-white border-b border-slate-300 sticky top-0 z-40 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Back & Doc Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 text-base">
                  {docType} #{doc.docNo || doc.DocNo}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {doc.clientName || doc.ClientName}
                </span>
              </div>
            </div>
          </div>

          {/* Right action controls */}
          <div className="flex items-center gap-3">
            {/* Letterhead toggle switch */}
            <label className="flex items-center gap-2.5 cursor-pointer bg-slate-100 hover:bg-slate-200/80 px-3 py-1.5 rounded-xl transition select-none">
              <input
                type="checkbox"
                checked={printOnLetterhead}
                onChange={(e) => handleToggleLetterhead(e.target.checked)}
                className="w-4 h-4 text-[#1F3A5F] rounded focus:ring-0 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-800">
                Print on my letterhead
              </span>
            </label>

            <button
              onClick={onEdit}
              className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <Edit className="w-4 h-4 text-slate-500" />
              <span>Edit</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-5 py-2 rounded-xl bg-[#1F3A5F] hover:bg-[#162a45] text-white font-bold text-sm flex items-center gap-2 shadow-md transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Layout Switch Tabs (Screen Only) */}
        <div className="max-w-5xl mx-auto px-4 flex gap-2 border-t border-slate-200 pt-2 pb-2">
          {docType === 'BILL' ? (
            <>
              <button
                onClick={() => setActiveTab('BILL')}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                  activeTab === 'BILL'
                    ? 'bg-[#1F3A5F] text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Bill Layout</span>
              </button>

              {hasGstItems && (
                <button
                  onClick={() => setActiveTab('GST')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                    activeTab === 'GST'
                      ? 'bg-[#1F3A5F] text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <FileCheck2 className="w-4 h-4" />
                  <span>GST Sales Tax Invoice</span>
                </button>
              )}
            </>
          ) : (
            <button
              onClick={() => setActiveTab('QUOTATION')}
              className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 bg-[#1F3A5F] text-white"
            >
              <FileText className="w-4 h-4" />
              <span>Quotation Layout</span>
            </button>
          )}
        </div>
      </div>

      {/* Sheet Simulation Preview Container */}
      <div className="max-w-4xl mx-auto py-6 px-4">
        {/* On-screen letterhead mode explanation note */}
        <div className="no-print mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center justify-between">
          <div>
            <strong>Mode: </strong>
            {printOnLetterhead ? (
              <span>
                <strong>&quot;Print on my letterhead&quot; is ON</strong>. Top {settings.letterheadTop}in and bottom {settings.letterheadBottom}in are left blank to avoid overlapping your pre-printed letterhead.
              </span>
            ) : (
              <span>
                <strong>&quot;Print on my letterhead&quot; is OFF</strong>. Plain A4 paper mode with {settings.supplierName} header included.
              </span>
            )}
          </div>
        </div>

        {/* A4 Sheet Paper Mockup */}
        <div
          className="print-container bg-white shadow-xl mx-auto rounded-sm border border-slate-300"
          style={{
            minHeight: '11.69in',
            width: '100%',
            maxWidth: '8.27in',
            paddingTop: `${topMargin}in`,
            paddingBottom: `${bottomMargin}in`,
            paddingLeft: '0.6in',
            paddingRight: '0.6in',
          }}
        >
          {activeTab === 'BILL' && (
            <BillPrintLayout
              doc={doc}
              settings={settings}
              printOnLetterhead={printOnLetterhead}
            />
          )}

          {activeTab === 'GST' && (
            <GstInvoicePrintLayout
              doc={doc}
              settings={settings}
              printOnLetterhead={printOnLetterhead}
            />
          )}

          {activeTab === 'QUOTATION' && (
            <QuotationPrintLayout
              doc={doc}
              settings={settings}
              printOnLetterhead={printOnLetterhead}
            />
          )}
        </div>
      </div>
    </div>
  );
};
