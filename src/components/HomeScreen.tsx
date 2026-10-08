import React, { useState, useMemo } from 'react';
import {
  FileText,
  FilePlus,
  Settings,
  Search,
  MoreVertical,
  Copy,
  Edit,
  ArrowRight,
  Ban,
  Lock,
  RefreshCw,
} from 'lucide-react';
import type { DocumentRecord, SupplierSettings } from '../types/billing';
import { formatCurrency, formatDateDisplay } from '../utils/formatters';

interface Props {
  docs: DocumentRecord[];
  settings: SupplierSettings;
  isOfflineMode: boolean;
  onNewBill: () => void;
  onNewQuotation: () => void;
  onOpenSettings: () => void;
  onSelectDoc: (doc: DocumentRecord) => void;
  onEditDoc: (doc: DocumentRecord) => void;
  onDuplicateDoc: (doc: DocumentRecord) => void;
  onMakeBillFromQuotation: (doc: DocumentRecord) => void;
  onCancelDoc: (docId: string) => void;
  onRefresh: () => void;
  onLock: () => void;
}

export const HomeScreen: React.FC<Props> = ({
  docs,
  settings,
  isOfflineMode,
  onNewBill,
  onNewQuotation,
  onOpenSettings,
  onSelectDoc,
  onEditDoc,
  onDuplicateDoc,
  onMakeBillFromQuotation,
  onCancelDoc,
  onRefresh,
  onLock,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuDocId, setActiveMenuDocId] = useState<string | null>(null);

  // Filter docs newest first
  const filteredDocs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return docs.filter((d) => {
      if (!q) return true;
      const no = (d.docNo || d.DocNo || '').toLowerCase();
      const client = (d.clientName || d.ClientName || '').toLowerCase();
      const ref = (d.refText || d.RefText || '').toLowerCase();
      return no.includes(q) || client.includes(q) || ref.includes(q);
    });
  }, [docs, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1F3A5F] text-white flex items-center justify-center font-bold text-lg shadow-sm">
              AT
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 leading-tight">
                {settings.supplierName || 'Anwar Traders'}
              </h1>
              <p className="text-xs font-semibold text-slate-500">
                Government Order Supplier · Rawalpindi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isOfflineMode && (
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                Local / Demo Mode
              </span>
            )}
            <button
              onClick={onRefresh}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
              title="Refresh records"
              aria-label="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={onLock}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
              title="Lock app"
              aria-label="Lock App"
            >
              <Lock className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-4 py-6 w-full flex-1">
        {/* Three Big Main Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-8">
          <button
            onClick={onNewBill}
            className="group p-5 rounded-2xl bg-[#1F3A5F] hover:bg-[#162a45] active:scale-[0.99] text-white flex flex-col justify-between shadow-md transition cursor-pointer text-left h-32"
          >
            <div className="flex justify-between items-start">
              <span className="p-2.5 rounded-xl bg-white/15 text-white">
                <FilePlus className="w-6 h-6" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-md">
                Next #{settings.nextBillNo || '101'}
              </span>
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight">New Bill</div>
              <p className="text-xs text-white/80 font-medium">Create PO Bill & GST Invoice</p>
            </div>
          </button>

          <button
            onClick={onNewQuotation}
            className="group p-5 rounded-2xl bg-slate-800 hover:bg-slate-900 active:scale-[0.99] text-white flex flex-col justify-between shadow-md transition cursor-pointer text-left h-32"
          >
            <div className="flex justify-between items-start">
              <span className="p-2.5 rounded-xl bg-white/15 text-white">
                <FileText className="w-6 h-6" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-md">
                Next #{settings.nextQuoteNo || 'Q-201'}
              </span>
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight">New Quotation</div>
              <p className="text-xs text-white/80 font-medium">Generate Rate Estimate</p>
            </div>
          </button>

          <button
            onClick={onOpenSettings}
            className="group p-5 rounded-2xl bg-white hover:bg-slate-100 active:scale-[0.99] text-slate-800 border-2 border-slate-200 flex flex-col justify-between shadow-xs transition cursor-pointer text-left h-32"
          >
            <div className="flex justify-between items-start">
              <span className="p-2.5 rounded-xl bg-slate-100 text-slate-700">
                <Settings className="w-6 h-6" />
              </span>
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight text-slate-900">Settings</div>
              <p className="text-xs text-slate-500 font-medium">Margins, Taxes & Business Details</p>
            </div>
          </button>
        </div>

        {/* Recent Documents Section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Recent Documents</h2>
              <p className="text-xs text-slate-500">Tap any row to preview or print</p>
            </div>

            {/* Search Box */}
            <div className="relative max-w-xs w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Client or Doc No..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F3A5F] focus:bg-white text-slate-800"
              />
            </div>
          </div>

          {/* Document Rows */}
          {filteredDocs.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="font-semibold text-slate-700">No documents found</p>
              <p className="text-xs text-slate-400 mt-1">
                {searchQuery
                  ? 'No documents match your search criteria.'
                  : 'Start by creating your first Bill or Quotation above.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredDocs.map((doc) => {
                const docId = doc.docId || doc.DocID || '';
                const docNo = doc.docNo || doc.DocNo || '—';
                const docType = doc.type || doc.Type || 'BILL';
                const date = formatDateDisplay(doc.date || doc.Date);
                const client = doc.clientName || doc.ClientName || 'Client';
                const total = doc.grandTotal ?? doc.GrandTotal ?? 0;
                const status = doc.status || doc.Status || 'Active';
                const isCancelled = status.toLowerCase() === 'cancelled';
                const isMenuOpen = activeMenuDocId === docId;

                return (
                  <div
                    key={docId}
                    className={`p-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative ${
                      isCancelled
                        ? 'bg-slate-50/80 text-slate-400 opacity-60'
                        : 'hover:bg-slate-50/90 text-slate-900 cursor-pointer'
                    }`}
                  >
                    {/* Left details (tap to preview) */}
                    <div
                      className="flex-1 min-w-0"
                      onClick={() => onSelectDoc(doc)}
                    >
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span
                          className={`text-xs font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider ${
                            docType === 'BILL'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {docType}
                        </span>
                        <span className="text-sm font-extrabold text-slate-800 font-mono">
                          #{docNo}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          {date}
                        </span>
                        {isCancelled && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-700">
                            Cancelled
                          </span>
                        )}
                      </div>

                      <div className="text-base font-bold text-slate-900 truncate">
                        {client}
                      </div>

                      {(doc.refText || doc.RefText) && (
                        <div className="text-xs text-slate-500 truncate mt-0.5 font-medium">
                          {doc.refText || doc.RefText}
                        </div>
                      )}
                    </div>

                    {/* Right side: Grand total & Action menu */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100">
                      <div
                        className="text-right cursor-pointer"
                        onClick={() => onSelectDoc(doc)}
                      >
                        <span className="text-xs text-slate-500 block uppercase font-bold tracking-wider">
                          Grand Total
                        </span>
                        <span className="text-lg font-black text-slate-900 font-mono">
                          Rs. {formatCurrency(total)}
                        </span>
                      </div>

                      {/* Dropdown Menu Toggle */}
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuDocId(isMenuOpen ? null : docId);
                          }}
                          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                          aria-label="Actions"
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>

                        {/* Dropdown popup */}
                        {isMenuOpen && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuDocId(null);
                              }}
                            />
                            <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-xl border border-slate-200 z-50 py-1.5 text-sm font-medium animate-in fade-in">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuDocId(null);
                                  onSelectDoc(doc);
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                              >
                                <ArrowRight className="w-4 h-4 text-slate-400" />
                                <span>Preview & Print</span>
                              </button>

                              {!isCancelled && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuDocId(null);
                                    onEditDoc(doc);
                                  }}
                                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                                >
                                  <Edit className="w-4 h-4 text-slate-400" />
                                  <span>Edit Document</span>
                                </button>
                              )}

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuDocId(null);
                                  onDuplicateDoc(doc);
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                              >
                                <Copy className="w-4 h-4 text-slate-400" />
                                <span>Duplicate</span>
                              </button>

                              {docType === 'QUOTATION' && !isCancelled && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuDocId(null);
                                    onMakeBillFromQuotation(doc);
                                  }}
                                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-[#1F3A5F] font-semibold"
                                >
                                  <FilePlus className="w-4 h-4 text-[#1F3A5F]" />
                                  <span>Make Bill from this Quotation</span>
                                </button>
                              )}

                              {!isCancelled && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuDocId(null);
                                    if (confirm(`Are you sure you want to cancel ${docType} #${docNo}?`)) {
                                      onCancelDoc(docId);
                                    }
                                  }}
                                  className="w-full px-3 py-2 text-left hover:bg-rose-50 text-rose-600 flex items-center gap-2"
                                >
                                  <Ban className="w-4 h-4 text-rose-500" />
                                  <span>Cancel Document</span>
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Footer Credit Line */}
      <footer className="py-4 text-center text-xs text-slate-400 font-medium">
        Developed by MKZ
      </footer>
    </div>
  );
};
