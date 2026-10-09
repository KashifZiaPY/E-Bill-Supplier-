import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  Building2,
  Users,
  CreditCard,
  Briefcase,
  ChevronDown,
  Plus,
  ShieldCheck,
  TrendingUp,
  Receipt,
  Printer,
  Sparkles,
  X,
} from 'lucide-react';
import type { DocumentRecord, SavedClient, SupplierSettings } from '../types/billing';
import { formatCurrency, formatDateDisplay, safeNormalizeItems } from '../utils/formatters';

interface Props {
  docs: DocumentRecord[];
  settings: SupplierSettings;
  clients: SavedClient[];
  isOfflineMode: boolean;
  activeFirmId: string;
  onSelectFirm: (firmId: string) => void;
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
  onOpenAddClient: () => void;
  onEditClient: (client: SavedClient) => void;
  onDeleteClient: (clientId: string, clientName: string) => void;
}

export const HomeScreen: React.FC<Props> = ({
  docs,
  settings,
  clients,
  isOfflineMode,
  activeFirmId,
  onSelectFirm,
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
  onOpenAddClient,
  onEditClient,
  onDeleteClient,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'DOCUMENTS' | 'CLIENTS'>('DOCUMENTS');
  const [docFilter, setDocFilter] = useState<'ALL' | 'BILL' | 'QUOTATION'>('ALL');
  const [activeMenuDocId, setActiveMenuDocId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global Keyboard shortcuts: '/' focuses main search box, 'Escape' clears search / closes dropdown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        if (activeMenuDocId) {
          setActiveMenuDocId(null);
        } else if (searchQuery && document.activeElement === searchInputRef.current) {
          setSearchQuery('');
          searchInputRef.current?.blur();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeMenuDocId, searchQuery]);

  const firms = settings.firms && settings.firms.length > 0 ? settings.firms : [
    {
      id: 'firm-anwar-traders',
      name: settings.supplierName || 'Anwar Traders',
      tagline: settings.supplierTagline || 'General Order Suppliers & Govt Contractors',
      address: settings.supplierAddress,
      phone: settings.supplierPhone,
      ntn: settings.supplierNTN,
      gst: settings.supplierGST,
      vendorNo: settings.vendorNo,
      gstRate: settings.gstRate || 0.18,
      pstRate: settings.pstRate || 0.16,
      letterheadTop: settings.letterheadTop || 2.5,
      letterheadBottom: settings.letterheadBottom || 1.5,
      nextBillNo: settings.nextBillNo || '101',
      nextQuoteNo: settings.nextQuoteNo || 'Q-201',
    }
  ];

  const currentFirm = firms.find((f) => f.id === activeFirmId) || firms[0];

  // Comprehensive Omnisearch Document Filtering (Search anything: Doc#, Bill#, Value, Client, Item, Ref, Date, Status, Firm)
  const filteredDocs = useMemo(() => {
    const rawQ = String(searchQuery || '').trim();
    if (!rawQ && docFilter === 'ALL') return docs;

    const q = rawQ.toLowerCase();
    const cleanNum = rawQ.replace(/[^0-9.]/g, '');

    return docs.filter((d) => {
      const type = String(d.type || d.Type || 'BILL').toUpperCase();
      const matchesType = docFilter === 'ALL' || type === docFilter;
      if (!matchesType) return false;

      if (!q) return true;

      // 1. Doc number, type, bill #
      const docNo = String(d.docNo ?? d.DocNo ?? '').toLowerCase();
      const typeStr = type.toLowerCase();
      if (docNo.includes(q)) return true;
      if (`#${docNo}`.includes(q)) return true;
      if (`${typeStr} ${docNo}`.includes(q)) return true;
      if (`${typeStr} #${docNo}`.includes(q)) return true;
      if (q.startsWith('bill') && type === 'BILL') {
        const afterBill = q.replace(/^bill\s*#?/, '').trim();
        if (!afterBill || docNo.includes(afterBill)) return true;
      }
      if (q.startsWith('quote') || q.startsWith('quotation')) {
        const afterQuote = q.replace(/^(quotation|quote)\s*#?/, '').trim();
        if (!afterQuote || docNo.includes(afterQuote)) return true;
      }

      // 2. Client Details (name, address, NTN)
      const client = String(d.clientName ?? d.ClientName ?? '').toLowerCase();
      const clientAddress = String(d.clientAddress ?? d.ClientAddress ?? '').toLowerCase();
      const clientNTN = String(d.clientNTN ?? d.ClientNTN ?? '').toLowerCase();
      if (client.includes(q) || clientAddress.includes(q) || clientNTN.includes(q)) return true;

      // 3. Values & Currency Amounts (Grand total, GST, PST, Goods sub, Service sub)
      const grandTotal = Number(d.grandTotal ?? d.GrandTotal ?? 0);
      const grandStr = String(grandTotal);
      const grandFormatted = formatCurrency(grandTotal).toLowerCase();
      if (grandStr.includes(q) || grandFormatted.includes(q) || `rs. ${grandFormatted}`.includes(q) || `rs ${grandFormatted}`.includes(q)) {
        return true;
      }
      if (cleanNum && cleanNum.length >= 2 && grandStr.includes(cleanNum)) {
        return true;
      }

      const goodsSub = Number(d.goodsSub ?? d.GoodsSub ?? 0);
      const gst = Number(d.gst ?? d.GST ?? 0);
      const pst = Number(d.pst ?? d.PST ?? 0);
      if (cleanNum && cleanNum.length >= 3) {
        if (String(goodsSub).includes(cleanNum) || String(gst).includes(cleanNum) || String(pst).includes(cleanNum)) {
          return true;
        }
      }

      // 4. Reference & Firm Name
      const ref = String(d.refText ?? d.RefText ?? '').toLowerCase();
      const firm = String(d.firmName ?? '').toLowerCase();
      if (ref.includes(q) || firm.includes(q)) return true;

      // 5. Date & Status
      const status = String(d.status ?? d.Status ?? 'Active').toLowerCase();
      const dateRaw = String(d.date ?? d.Date ?? '').toLowerCase();
      const dateDisplay = formatDateDisplay(d.date ?? d.Date).toLowerCase();
      if (status.includes(q) || dateRaw.includes(q) || dateDisplay.includes(q)) return true;

      // 6. Line Items (description, units)
      const items = safeNormalizeItems(d.items ?? d.Items);
      if (items.some((it) => {
        const desc = String(it.description || '').toLowerCase();
        const unit = String(it.unit || '').toLowerCase();
        return desc.includes(q) || unit.includes(q);
      })) {
        return true;
      }

      return false;
    });
  }, [docs, searchQuery, docFilter]);

  // Comprehensive Safe Client Filtering matching Google Sheet schema
  const filteredClients = useMemo(() => {
    if (!clients || !Array.isArray(clients)) return [];
    const q = String(searchQuery || '').toLowerCase().trim();
    if (!q) return clients;

    return clients.filter((c: any) => {
      if (!c) return false;
      const name = String(c?.name || c?.Name || c?.clientName || c?.ClientName || (typeof c === 'string' ? c : '')).toLowerCase();
      const ntn = String(c?.ntn || c?.NTN || c?.clientNTN || c?.ClientNTN || '').toLowerCase();
      const strn = String(c?.strn || c?.STRN || '').toLowerCase();
      const addr = String(c?.address || c?.Address || c?.clientAddress || c?.ClientAddress || '').toLowerCase();
      return name.includes(q) || ntn.includes(q) || strn.includes(q) || addr.includes(q);
    });
  }, [clients, searchQuery]);

  // KPI Analytics Computations
  const analytics = useMemo(() => {
    let totalBilled = 0;
    let totalGst = 0;
    let totalPst = 0;
    let billCount = 0;
    let quoteCount = 0;

    for (const d of docs) {
      const isCancelled = String(d.status || d.Status || '').toLowerCase() === 'cancelled';
      if (isCancelled) continue;

      const type = String(d.type || d.Type || 'BILL').toUpperCase();
      const grandTotal = Number(d.grandTotal ?? d.GrandTotal ?? 0);
      const gst = Number(d.gst ?? d.GST ?? 0);
      const pst = Number(d.pst ?? d.PST ?? 0);

      if (type === 'BILL') {
        totalBilled += grandTotal;
        totalGst += gst;
        totalPst += pst;
        billCount++;
      } else {
        quoteCount++;
      }
    }

    return { totalBilled, totalGst, totalPst, billCount, quoteCount };
  }, [docs]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between">
      {/* Executive Enterprise Header */}
      <header className="bg-gradient-to-r from-[#0F2544] via-[#163866] to-[#0F2544] text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Owner & Group Brand */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center font-black text-xl text-amber-300 shadow-inner">
              FA
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-wide text-white">
                  {settings.ownerName || 'MIAN FARHAN ANWAR'}
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 uppercase tracking-wider">
                  Enterprise Group
                </span>
              </div>
              <p className="text-xs text-blue-200 font-medium">
                Govt Contractors &amp; General Order Suppliers · Billing Portal
              </p>
            </div>
          </div>

          {/* Firm Switcher & Top Actions */}
          <div className="flex items-center gap-2.5">
            {/* Firm Selector Dropdown */}
            <div className="relative">
              <select
                value={activeFirmId}
                onChange={(e) => onSelectFirm(e.target.value)}
                className="appearance-none bg-white/15 hover:bg-white/20 border border-white/25 rounded-xl px-3.5 py-1.5 pr-8 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-300 cursor-pointer transition"
              >
                {firms.map((firm) => (
                  <option key={firm.id} value={firm.id} className="text-slate-900 font-bold">
                    🏢 {firm.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-white/80 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Local / Live Status */}
            {isOfflineMode ? (
              <button
                onClick={onOpenSettings}
                className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-400 text-slate-950 flex items-center gap-1.5 shadow-sm hover:bg-amber-300 transition cursor-pointer"
                title="Tap to verify Google Sheet connection"
              >
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></span>
                <span className="hidden md:inline">Connect Sheet</span>
              </button>
            ) : (
              <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Sheet Connected</span>
              </span>
            )}

            <button
              onClick={onRefresh}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
              title="Refresh Records"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={onLock}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
              title="Lock Portal"
            >
              <Lock className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 py-5 w-full flex-1">
        {/* KPI Analytics Cards: Separated GST & PST display */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 mb-6">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Active Entity
            </span>
            <div className="text-base sm:text-lg font-black text-[#0F2544] truncate mt-0.5">
              {currentFirm.name}
            </div>
            <div className="text-[11px] text-slate-500 truncate mt-0.5 font-medium">
              NTN: {currentFirm.ntn || '—'}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Total Billed (PKR)
            </span>
            <div className="text-base sm:text-lg font-black font-mono text-emerald-700 truncate mt-0.5">
              Rs. {formatCurrency(analytics.totalBilled)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
              Across active orders
            </div>
          </div>

          {/* Separated Card: Federal GST Total */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/70 to-white border border-blue-200/80 shadow-xs hover:border-blue-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-900 block">
                Federal GST (18%)
              </span>
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            </div>
            <div className="text-base sm:text-lg font-black font-mono text-blue-900 truncate mt-0.5">
              Rs. {formatCurrency(analytics.totalGst)}
            </div>
            <div className="text-[11px] text-blue-700/80 mt-0.5 font-medium">
              Sales Tax on Goods
            </div>
          </div>

          {/* Separated Card: Punjab PST Total */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/70 to-white border border-emerald-200/80 shadow-xs hover:border-emerald-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-900 block">
                Punjab PST (16%)
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
            </div>
            <div className="text-base sm:text-lg font-black font-mono text-emerald-800 truncate mt-0.5">
              Rs. {formatCurrency(analytics.totalPst)}
            </div>
            <div className="text-[11px] text-emerald-700/80 mt-0.5 font-medium">
              Sales Tax on Services
            </div>
          </div>

          <div className="col-span-2 lg:col-span-1 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Documents Register
            </span>
            <div className="text-base sm:text-lg font-black text-slate-800 mt-0.5">
              {analytics.billCount} Bills <span className="text-slate-400 font-normal">/</span> {analytics.quoteCount} Quotes
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
              {clients.length} Saved Clients
            </div>
          </div>
        </div>

        {/* Big Action Launchers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-6">
          <button
            onClick={onNewBill}
            className="group p-5 rounded-2xl bg-[#0F2544] hover:bg-[#163866] active:scale-[0.99] text-white flex flex-col justify-between shadow-md transition cursor-pointer text-left h-28"
          >
            <div className="flex justify-between items-start">
              <span className="p-2 rounded-xl bg-white/15 text-white">
                <FilePlus className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-md">
                Next #{currentFirm.nextBillNo || '101'}
              </span>
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight">Create New Bill</div>
              <p className="text-xs text-blue-200 font-medium">Under {currentFirm.name}</p>
            </div>
          </button>

          <button
            onClick={onNewQuotation}
            className="group p-5 rounded-2xl bg-slate-800 hover:bg-slate-900 active:scale-[0.99] text-white flex flex-col justify-between shadow-md transition cursor-pointer text-left h-28"
          >
            <div className="flex justify-between items-start">
              <span className="p-2 rounded-xl bg-white/15 text-white">
                <FileText className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-md">
                Next #{currentFirm.nextQuoteNo || 'Q-201'}
              </span>
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight">New Quotation</div>
              <p className="text-xs text-slate-300 font-medium">Rate estimate with 7-day validity</p>
            </div>
          </button>

          <button
            onClick={onOpenSettings}
            className="group p-5 rounded-2xl bg-white hover:bg-slate-50 active:scale-[0.99] text-slate-800 border border-slate-200 flex flex-col justify-between shadow-xs transition cursor-pointer text-left h-28"
          >
            <div className="flex justify-between items-start">
              <span className="p-2 rounded-xl bg-slate-100 text-[#0F2544]">
                <Settings className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold text-slate-500">
                {firms.length} Firms Active
              </span>
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight text-slate-900">Enterprise Settings</div>
              <p className="text-xs text-slate-500 font-medium">Firms, Margins, Taxes &amp; Backend</p>
            </div>
          </button>
        </div>

        {/* Workspace Card (Tabs: Documents vs Clients) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Header Controls */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Primary Tab Switcher */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('DOCUMENTS')}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                  activeTab === 'DOCUMENTS'
                    ? 'bg-[#0F2544] text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Documents Register</span>
              </button>

              <button
                onClick={() => setActiveTab('CLIENTS')}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                  activeTab === 'CLIENTS'
                    ? 'bg-[#0F2544] text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Clients Directory ({clients.length})</span>
              </button>
            </div>

            {/* Right side: Search & Filter Controls */}
            <div className="flex items-center gap-2">
              {activeTab === 'DOCUMENTS' && (
                <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-bold">
                  {(['ALL', 'BILL', 'QUOTATION'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setDocFilter(filter)}
                      className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                        docFilter === filter
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              )}

              {activeTab === 'CLIENTS' && (
                <button
                  onClick={onOpenAddClient}
                  className="px-3 py-1.5 rounded-xl bg-[#0F2544] text-white text-xs font-bold flex items-center gap-1.5 hover:bg-[#163866] transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Client</span>
                </button>
              )}

              {/* Omnisearch Box */}
              <div className="relative w-full sm:w-64 md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    activeTab === 'DOCUMENTS'
                      ? 'Search Doc#, Bill#, Value, Client, Item...'
                      : 'Search client name, NTN, STRN, address...'
                  }
                  className="w-full pl-9 pr-8 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#0F2544] focus:outline-none text-slate-800 placeholder:text-slate-400 transition"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <span className="hidden lg:inline-block absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 bg-slate-200/60 px-1.5 py-0.5 rounded font-mono pointer-events-none">
                    /
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* TAB 1: DOCUMENTS REGISTER */}
          {activeTab === 'DOCUMENTS' && (
            <>
              {filteredDocs.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="font-bold text-slate-700">No documents found</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {searchQuery
                      ? 'No documents match your search criteria.'
                      : 'Create your first Bill or Quotation above.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredDocs.map((doc) => {
                    const docId = String(doc.docId || doc.DocID || '');
                    const docNo = String(doc.docNo || doc.DocNo || '—');
                    const docType = String(doc.type || doc.Type || 'BILL');
                    const date = formatDateDisplay(doc.date || doc.Date);
                    const client = String(doc.clientName || doc.ClientName || 'Client');
                    const total = Number(doc.grandTotal ?? doc.GrandTotal ?? 0);
                    const status = String(doc.status || doc.Status || 'Active');
                    const isCancelled = status.toLowerCase() === 'cancelled';
                    const isMenuOpen = activeMenuDocId === docId;
                    const firmName = String(doc.firmName || currentFirm.name);

                    return (
                      <div
                        key={docId}
                        className={`p-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative cursor-default ${
                          isCancelled
                            ? 'bg-slate-50/80 text-slate-400 opacity-60'
                            : 'hover:bg-slate-50/70 text-slate-900'
                        }`}
                      >
                        {/* Left Details - Standard text without hover hand sign */}
                        <div className="flex-1 min-w-0 cursor-default select-text">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                docType === 'BILL'
                                  ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                  : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                              }`}
                            >
                              {docType}
                            </span>
                            <span className="text-xs font-mono font-bold text-slate-500">
                              #{docNo}
                            </span>
                            <span className="text-xs text-slate-500 font-medium">
                              {date}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                              {firmName}
                            </span>
                            {isCancelled && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-700">
                                Cancelled
                              </span>
                            )}
                          </div>

                          <div className="text-sm sm:text-base font-bold text-slate-900 truncate">
                            {client}
                          </div>

                          {(doc.refText || doc.RefText) && (
                            <div className="text-xs text-slate-500 truncate mt-0.5 font-medium">
                              {String(doc.refText || doc.RefText)}
                            </div>
                          )}
                        </div>

                        {/* Right: Grand Total & Actions */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100 cursor-default">
                          <div className="text-right cursor-default">
                            <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
                              Grand Total
                            </span>
                            <span className="text-base sm:text-lg font-black text-slate-900 font-mono">
                              Rs. {formatCurrency(total)}
                            </span>
                          </div>

                          {/* Quick Action buttons */}
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectDoc(doc);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer"
                              title="View & Print Document"
                            >
                              <Printer className="w-3.5 h-3.5 text-slate-600" />
                              <span>View</span>
                            </button>

                            {!isCancelled && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditDoc(doc);
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-[#0F2544]/10 hover:bg-[#0F2544]/20 active:bg-[#0F2544]/30 text-[#0F2544] text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer"
                                title="Edit Document"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                            )}

                            {/* Menu button */}
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuDocId(isMenuOpen ? null : docId);
                                }}
                                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                aria-label="Actions"
                              >
                                <MoreVertical className="w-5 h-5" />
                              </button>

                            {/* Dropdown Menu */}
                            {isMenuOpen && (
                              <>
                                <div
                                  className="fixed inset-0 z-40"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuDocId(null);
                                  }}
                                />
                                <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl border border-slate-200 z-50 py-1.5 text-xs font-semibold animate-in fade-in">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveMenuDocId(null);
                                      onDuplicateDoc(doc);
                                    }}
                                    className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700 cursor-pointer"
                                  >
                                    <Copy className="w-4 h-4 text-slate-400" />
                                    <span>Duplicate Record</span>
                                  </button>

                                  {docType === 'QUOTATION' && !isCancelled && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenuDocId(null);
                                        onMakeBillFromQuotation(doc);
                                      }}
                                      className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center gap-2 text-[#0F2544] font-bold cursor-pointer"
                                    >
                                      <FilePlus className="w-4 h-4 text-[#0F2544]" />
                                      <span>Convert into Bill</span>
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
                                      className="w-full px-3 py-2 text-left hover:bg-rose-50 text-rose-600 flex items-center gap-2 cursor-pointer border-t border-slate-100"
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
                    </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* TAB 2: CLIENT DIRECTORY & MANAGEMENT */}
          {activeTab === 'CLIENTS' && (
            <div className="divide-y divide-slate-100">
              <div className="p-3 bg-blue-50/60 border-b border-blue-100 flex items-center justify-between text-xs text-blue-900 px-4">
                <span className="font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  Clients are automatically remembered and synced from Bills and the Google Sheet Clients registry.
                </span>
                <span className="text-[11px] font-bold text-blue-700">
                  {clients.length} Total Registered
                </span>
              </div>

              {filteredClients.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="font-bold text-slate-700">No clients registered</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Clients are saved automatically when creating bills, or you can add them manually above.
                  </p>
                </div>
              ) : (
                filteredClients.map((client: any, idx) => {
                  const cName = String(client?.name || client?.Name || client?.clientName || client?.ClientName || (typeof client === 'string' ? client : 'Unnamed Client'));
                  const cNtn = String(client?.ntn || client?.NTN || client?.clientNTN || client?.ClientNTN || '');
                  const cStrn = String(client?.strn || client?.STRN || '');
                  const cAddr = String(client?.address || client?.Address || client?.clientAddress || client?.ClientAddress || '');
                  const cLastUsed = String(client?.lastUsed || client?.LastUsed || '');

                  return (
                    <div
                      key={client?.id || cName + idx}
                      className="p-4 hover:bg-slate-50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm sm:text-base text-slate-900">
                            {cName}
                          </span>
                          {cNtn && (
                            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                              NTN: {cNtn}
                            </span>
                          )}
                          {cStrn && (
                            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                              STRN: {cStrn}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 truncate">
                          {cAddr || 'No office address specified'}
                        </p>
                        {cLastUsed && (
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Last active: {cLastUsed}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button
                          onClick={() => onEditClient(client)}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Remove client ${cName}?`)) {
                              onDeleteClient(client?.id || '', cName);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                          title="Delete Client"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer Credit Line */}
      <footer className="py-4 text-center text-xs text-slate-400 font-medium">
        Developed by MKZ · {settings.ownerName || 'MIAN FARHAN ANWAR'} Enterprise Systems
      </footer>
    </div>
  );
};
