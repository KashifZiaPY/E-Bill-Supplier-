import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Edit,
  Printer,
  FileText,
  FileCheck2,
  Building,
  FileSpreadsheet,
} from 'lucide-react';
import type { DocumentRecord, SupplierSettings } from '../types/billing';
import { safeNormalizeItems } from '../utils/formatters';
import { exportDocLineItemsToExcel } from '../utils/excelExport';
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
  const safeDoc = {
    ...doc,
    items: safeNormalizeItems(doc?.items || doc?.Items),
    Items: safeNormalizeItems(doc?.items || doc?.Items),
  };
  const docType = safeDoc.type || safeDoc.Type || 'BILL';
  const items = safeDoc.items;
  const hasGstItems = items.some((i) => i.tax === 'GST' || (i as any).Tax === 'GST') || (safeDoc.goodsSub ?? safeDoc.GoodsSub ?? 0) > 0;

  // Active tab: 'BILL' | 'GST' | 'QUOTATION'
  const [activeTab, setActiveTab] = useState<'BILL' | 'GST' | 'QUOTATION'>(() => {
    return docType === 'BILL' ? 'BILL' : 'QUOTATION';
  });

  // Keyboard navigation: Escape key closes/exits preview immediately; Ctrl+P prints
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onBack();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);

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
    <div className="min-h-screen bg-[#EAEFF6]">
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

      {/* Top Action & Navigation Bar: Executive Navy & Sapphire Header */}
      <div className="no-print bg-gradient-to-r from-[#0B1E36] via-[#103158] to-[#0B1E36] text-white border-b border-blue-900/80 sticky top-0 z-40 shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Back & Doc Title */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={onBack}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer flex items-center gap-1.5"
              title="Return to Dashboard (or press Escape)"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
              <span className="hidden sm:inline-block text-[10px] font-mono font-bold text-blue-200 bg-white/10 border border-white/20 px-1.5 py-0.5 rounded shadow-2xs">
                ESC
              </span>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-white text-base tracking-wide">
                  {docType} #{doc.docNo || doc.DocNo}
                </span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/40 uppercase tracking-wider">
                  {currentFirmName}
                </span>
              </div>
              <p className="text-xs text-blue-200/90 font-medium truncate max-w-sm">
                {doc.clientName || doc.ClientName}
              </p>
            </div>
          </div>

          {/* Right action controls */}
          <div className="flex items-center gap-2.5">
            {/* Letterhead toggle switch */}
            <label className="flex items-center gap-2 cursor-pointer bg-white/10 hover:bg-white/15 border border-white/20 px-3 py-1.5 rounded-xl transition select-none">
              <input
                type="checkbox"
                checked={printOnLetterhead}
                onChange={(e) => handleToggleLetterhead(e.target.checked)}
                className="w-4 h-4 text-amber-400 rounded focus:ring-0 cursor-pointer accent-amber-400"
              />
              <span className="text-xs font-bold text-white">
                Pre-printed letterhead
              </span>
            </label>

            <button
              onClick={() => exportDocLineItemsToExcel(doc)}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm hover:shadow transition cursor-pointer border border-emerald-400/30"
              title="Export Line Items to Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
              <span className="hidden sm:inline">Export Excel</span>
            </button>

            <button
              onClick={onEdit}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-white/20"
            >
              <Edit className="w-4 h-4 text-blue-200" />
              <span>Edit</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-sm flex items-center gap-2 shadow-lg hover:shadow-xl transition cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4 text-slate-950" />
              <span>Print Document</span>
            </button>
          </div>
        </div>

        {/* Layout Switch Tabs (Screen Only) */}
        <div className="bg-[#0B1E36] border-t border-blue-900/60">
          <div className="max-w-5xl mx-auto px-4 flex gap-2 pt-2.5 pb-2.5">
            {docType === 'BILL' ? (
              <>
                <button
                  onClick={() => setActiveTab('BILL')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                    activeTab === 'BILL'
                      ? 'bg-blue-600 text-white shadow-md ring-1 ring-blue-400/60'
                      : 'text-blue-200/80 hover:text-white hover:bg-white/10'
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
                        ? 'bg-blue-600 text-white shadow-md ring-1 ring-blue-400/60'
                        : 'text-blue-200/80 hover:text-white hover:bg-white/10'
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
                className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 bg-blue-600 text-white shadow-md ring-1 ring-blue-400/60"
              >
                <FileText className="w-4 h-4" />
                <span>Quotation Layout</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Screen Preview Canvas: Executive drafting workspace */}
      <div className="preview-outer-wrap max-w-4xl mx-auto py-6 px-4">
        {/* On-screen letterhead mode indicator note */}
        <div className="no-print mb-4 p-3.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
          <div>
            <strong className="text-slate-900">Print Mode: </strong>
            {printOnLetterhead ? (
              <span>
                <strong className="text-blue-900">&quot;Pre-printed letterhead&quot; is ON</strong>. Top <strong>{settings.letterheadTop}in</strong> &amp; bottom <strong>{settings.letterheadBottom}in</strong> are left blank so your physical letterhead header and footer fit cleanly.
              </span>
            ) : (
              <span>
                <strong className="text-emerald-700">Plain A4 Paper Mode (Letterhead OFF)</strong>. Official header for <strong>{currentFirmName}</strong> will be printed automatically.
              </span>
            )}
          </div>
          <span className="text-[11px] font-bold text-blue-900 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md self-start sm:self-auto shrink-0">
            A4 Single-Page Fit Guaranteed
          </span>
        </div>

        {/* Paper Sheet Preview */}
        <div
          className="print-container bg-white shadow-xl mx-auto rounded-xs border border-slate-300 ring-1 ring-slate-400/30"
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
