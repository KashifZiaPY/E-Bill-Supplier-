import React, { useState } from 'react';
import {
  ArrowLeft,
  Edit,
  Printer,
  FileText,
  FileCheck2,
  Building,
} from 'lucide-react';
import type { DocumentRecord, SupplierSettings } from '../types/billing';
import { BillPrintLayout } from './print/BillPrintLayout';
import { GstInvoicePrintLayout } from './print/GstInvoicePrintLayout';
import { QuotationPrintLayout } from './print/QuotationPrintLayout';

const STORAGE_KEY_LETTERHEAD = 'anwar_traders_print_letterhead_v2';

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
  const items = doc.items || doc.Items || [];
  const hasGstItems = items.some((i) => i.tax === 'GST' || (i as any).Tax === 'GST') || (doc.goodsSub ?? doc.GoodsSub ?? 0) > 0;

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

  // Top and bottom margins (in inches)
  const topMargin = printOnLetterhead ? (settings.letterheadTop || 2.5) : 0.4;
  const bottomMargin = printOnLetterhead ? (settings.letterheadBottom || 1.5) : 0.4;

  const currentFirmName = doc.firmName || settings.supplierName || 'Anwar Traders';

  return (
    <div className="min-h-screen bg-slate-200">
      {/* Strict Print CSS: Ensures ZERO double padding and ZERO 2-page spill */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: ${topMargin}in 0.45in ${bottomMargin}in 0.45in;
        }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            width: 100% !important;
            height: auto !important;
            font-family: Arial, Helvetica, sans-serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .preview-outer-wrap {
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .print-container {
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            min-height: auto !important;
            height: auto !important;
            width: 100% !important;
            max-width: 100% !important;
            background: #ffffff !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Top Action & Navigation Bar (Screen Only) */}
      <div className="no-print bg-white border-b border-slate-300 sticky top-0 z-40 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Back & Doc Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 text-base">
                  {docType} #{doc.docNo || doc.DocNo}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                  {currentFirmName}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium truncate max-w-sm">
                {doc.clientName || doc.ClientName}
              </p>
            </div>
          </div>

          {/* Right action controls */}
          <div className="flex items-center gap-2.5">
            {/* Letterhead toggle switch */}
            <label className="flex items-center gap-2 cursor-pointer bg-slate-100 hover:bg-slate-200/90 px-3 py-1.5 rounded-xl transition select-none">
              <input
                type="checkbox"
                checked={printOnLetterhead}
                onChange={(e) => handleToggleLetterhead(e.target.checked)}
                className="w-4 h-4 text-[#1F3A5F] rounded focus:ring-0 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-800">
                Pre-printed letterhead
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
              className="px-5 py-2 rounded-xl bg-[#0F2544] hover:bg-[#1E3A8A] text-white font-bold text-sm flex items-center gap-2 shadow-md transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Document</span>
            </button>
          </div>
        </div>

        {/* Layout Switch Tabs (Screen Only) */}
        <div className="max-w-5xl mx-auto px-4 flex gap-2 border-t border-slate-200 pt-2 pb-2">
          {docType === 'BILL' ? (
            <>
              <button
                onClick={() => setActiveTab('BILL')}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                  activeTab === 'BILL'
                    ? 'bg-[#0F2544] text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Bill Layout</span>
              </button>

              {hasGstItems && (
                <button
                  onClick={() => setActiveTab('GST')}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                    activeTab === 'GST'
                      ? 'bg-[#0F2544] text-white shadow-xs'
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
              className="px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 bg-[#0F2544] text-white"
            >
              <FileText className="w-4 h-4" />
              <span>Quotation Layout</span>
            </button>
          )}
        </div>
      </div>

      {/* Screen Preview Canvas */}
      <div className="preview-outer-wrap max-w-4xl mx-auto py-5 px-4">
        {/* On-screen letterhead mode indicator note */}
        <div className="no-print mb-3 p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <strong>Print Mode: </strong>
            {printOnLetterhead ? (
              <span>
                <strong>&quot;Pre-printed letterhead&quot; is ON</strong>. Top <strong>{settings.letterheadTop}in</strong> &amp; bottom <strong>{settings.letterheadBottom}in</strong> are left blank so your physical letterhead header and footer fit cleanly.
              </span>
            ) : (
              <span>
                <strong>Plain A4 Paper Mode (Letterhead OFF)</strong>. Official header for <strong>{currentFirmName}</strong> will be printed automatically.
              </span>
            )}
          </div>
          <span className="text-[11px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded self-start sm:self-auto shrink-0">
            A4 Single-Page Fit Guaranteed
          </span>
        </div>

        {/* Paper Sheet Preview */}
        <div
          className="print-container bg-white shadow-xl mx-auto rounded-sm border border-slate-300"
          style={{
            minHeight: '11in',
            width: '100%',
            maxWidth: '8.27in',
            paddingTop: printOnLetterhead ? `${topMargin}in` : '0.45in',
            paddingBottom: printOnLetterhead ? `${bottomMargin}in` : '0.45in',
            paddingLeft: '0.45in',
            paddingRight: '0.45in',
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
