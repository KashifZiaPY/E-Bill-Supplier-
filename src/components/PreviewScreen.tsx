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
    <div className="min-h-screen">
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
          .no-print { display: none !important; }
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
          table { border-collapse: collapse !important; width: 100% !important; }
          tr { break-inside: avoid !important; page-break-inside: avoid !important; }
        }
      `}</style>

      {/* Corporate action bar */}
      <div className="no-print bg-navy-950 text-white sticky top-0 z-40 shadow-[0_2px_12px_rgba(12,28,51,0.35)]">
        <div className="h-0.5 bg-gradient-to-r from-gold-700 via-gold-400 to-gold-700" />
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={onBack}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition flex items-center gap-1.5"
              title="Back (Esc)"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
              <kbd className="hidden sm:inline-block text-[10px] font-mono font-bold text-navy-200 bg-white/10 border border-white/20 px-1.5 py-0.5 rounded">ESC</kbd>
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-white text-[16px] tracking-tight">{docType} #{doc.docNo || doc.DocNo}</span>
                <span className="corp-chip bg-gold-500/15 text-gold-400 border border-gold-500/40">{currentFirmName}</span>
              </div>
              <p className="text-xs text-navy-200 font-medium truncate max-w-[280px]">{doc.clientName || doc.ClientName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer bg-white/10 hover:bg-white/15 border border-white/20 px-3 py-2 rounded-xl transition select-none">
              <input
                type="checkbox"
                checked={printOnLetterhead}
                onChange={(e) => handleToggleLetterhead(e.target.checked)}
                className="w-4 h-4 rounded accent-gold-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-white">Pre-printed letterhead</span>
            </label>
            <button
              onClick={() => exportDocLineItemsToExcel(doc)}
              className="corp-btn-ghost !py-2 !border-white/20 !bg-white/10 !text-white hover:!bg-white/15 text-xs"
              title="Export line items to Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Excel</span>
            </button>
            <button
              onClick={onEdit}
              className="corp-btn-ghost !py-2 !border-white/20 !bg-white/10 !text-white hover:!bg-white/15 text-xs"
            >
              <Edit className="w-4 h-4" /><span>Edit</span>
            </button>
            <button onClick={handlePrint} className="corp-btn-gold !py-2 text-sm">
              <Printer className="w-4 h-4" /><span>Print</span>
            </button>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="max-w-5xl mx-auto px-4 flex gap-1.5 py-2">
            {docType === 'BILL' ? (
              <>
                <button
                  onClick={() => setActiveTab('BILL')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                    activeTab === 'BILL' ? 'bg-gold-500 text-navy-950 shadow-sm' : 'text-navy-200 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <FileText className="w-4 h-4" /><span>Bill Layout</span>
                </button>
                {hasGstItems && (
                  <button
                    onClick={() => setActiveTab('GST')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                      activeTab === 'GST' ? 'bg-gold-500 text-navy-950 shadow-sm' : 'text-navy-200 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <FileCheck2 className="w-4 h-4" /><span>GST Sales Tax Invoice</span>
                  </button>
                )}
              </>
            ) : (
              <button className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 bg-gold-500 text-navy-950 shadow-sm">
                <FileText className="w-4 h-4" /><span>Quotation Layout</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Preview canvas */}
      <div className="preview-outer-wrap max-w-4xl mx-auto py-6 px-4">
        <div className="no-print mb-4 corp-card p-3.5 text-xs text-ink-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <strong className="text-ink-900">Print mode: </strong>
            {printOnLetterhead ? (
              <span><strong className="text-navy-800">Pre-printed letterhead ON</strong> — top {settings.letterheadTop}″ &amp; bottom {settings.letterheadBottom}″ left blank for your physical letterhead.</span>
            ) : (
              <span><strong className="text-emerald-700">Plain A4 mode</strong> — the official {currentFirmName} header prints automatically.</span>
            )}
          </div>
          <span className="corp-chip bg-navy-50 text-navy-800 border border-navy-100 self-start sm:self-auto shrink-0">A4 · Single page</span>
        </div>

        <div
          className="print-container bg-white shadow-[0_20px_60px_-20px_rgba(12,28,51,0.35)] mx-auto border border-line"
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
          {activeTab === 'BILL' && <BillPrintLayout doc={doc} settings={settings} printOnLetterhead={printOnLetterhead} />}
          {activeTab === 'GST' && <GstInvoicePrintLayout doc={doc} settings={settings} printOnLetterhead={printOnLetterhead} />}
          {activeTab === 'QUOTATION' && <QuotationPrintLayout doc={doc} settings={settings} printOnLetterhead={printOnLetterhead} />}
        </div>
      </div>
    </div>
  );
};
