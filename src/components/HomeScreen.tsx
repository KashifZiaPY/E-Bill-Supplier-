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
  BarChart3,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  Trash2,
  ShieldAlert,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import type { DocumentRecord, SavedClient, SupplierSettings } from '../types/billing';
import { formatCurrency, formatDateDisplay, safeNormalizeItems } from '../utils/formatters';
import { isLastDocLIFO } from '../utils/lifoHelper';
import { LifoDeleteModal } from './LifoDeleteModal';
import {
  exportDocumentsToExcel,
  exportClientReportToExcel,
  type ClientReportSummary,
} from '../utils/excelExport';

interface Props {
  docs: DocumentRecord[];
  settings: SupplierSettings;
  clients: SavedClient[];
  onRetryConnection?: () => void;
  activeFirmId: string;
  onSelectFirm: (firmId: string) => void;
  onNewBill: () => void;
  onNewQuotation: () => void;
  onOpenSettings: () => void;
  onSelectDoc: (doc: DocumentRecord) => void;
  onEditDoc: (doc: DocumentRecord) => void;
  onDuplicateDoc: (doc: DocumentRecord) => void;
  onMakeBillFromQuotation: (doc: DocumentRecord) => void;
  onCancelDoc: (docId: string, authorityPin?: string) => Promise<void>;
  onDeleteDoc?: (doc: DocumentRecord, authorityPin?: string) => Promise<void>;
  deletePinRequired?: boolean;
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
  onRetryConnection,
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
  onDeleteDoc,
  deletePinRequired,
  onRefresh,
  onLock,
  onOpenAddClient,
  onEditClient,
  onDeleteClient,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'DOCUMENTS' | 'CLIENTS' | 'REPORTS'>('DOCUMENTS');
  const [docFilter, setDocFilter] = useState<'ALL' | 'BILL' | 'QUOTATION'>('ALL');
  const [activeMenuDocId, setActiveMenuDocId] = useState<string | null>(null);
  const [drillDownClient, setDrillDownClient] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // LIFO Deletion state
  const [docToDeleteLifo, setDocToDeleteLifo] = useState<DocumentRecord | null>(null);
  const [lifoMode, setLifoMode] = useState<'delete' | 'cancel'>('delete');
  const [isLifoModalOpen, setIsLifoModalOpen] = useState(false);
  const [isDeletingLifo, setIsDeletingLifo] = useState(false);

  const handleOpenLifoDelete = (doc: DocumentRecord) => {
    setDocToDeleteLifo(doc);
    setLifoMode('delete');
    setIsLifoModalOpen(true);
  };

  const handleConfirmLifoCancel = async (doc: DocumentRecord, authorityPin?: string) => {
    setIsDeletingLifo(true);
    try {
      const id = String(doc.docId || doc.DocID || '');
      if (onCancelDoc) await onCancelDoc(id, authorityPin);
      setIsLifoModalOpen(false);
      setDocToDeleteLifo(null);
    } finally {
      setIsDeletingLifo(false);
    }
  };
  const handleConfirmLifoDelete = async (doc: DocumentRecord, authorityPin?: string) => {
    setIsDeletingLifo(true);
    try {
      setActiveMenuDocId(null);
      if (onDeleteDoc) {
        await onDeleteDoc(doc, authorityPin);
      }
      setIsLifoModalOpen(false);
      setDocToDeleteLifo(null);
    } finally {
      setIsDeletingLifo(false);
    }
  };

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

  // Consolidated Client-Wise Billing Report Summaries
  const clientReportSummaries = useMemo<ClientReportSummary[]>(() => {
    const summaryMap = new Map<string, ClientReportSummary>();

    // Aggregate from all active documents in register
    (docs || []).forEach((d) => {
      const isCancelled = String(d.status || d.Status || '').toLowerCase() === 'cancelled';
      if (isCancelled) return;

      const docClient = String(d.clientName || d.ClientName || '').trim();
      if (!docClient) return;

      const key = docClient.toLowerCase();
      let entry = summaryMap.get(key);
      if (!entry) {
        entry = {
          clientName: docClient,
          clientNTN: String(d.clientNTN || d.ClientNTN || ''),
          clientAddress: String(d.clientAddress || d.ClientAddress || ''),
          billCount: 0,
          quoteCount: 0,
          goodsTotal: 0,
          gstTotal: 0,
          serviceTotal: 0,
          pstTotal: 0,
          grandTotal: 0,
          lastBillDate: '',
          lastBillNo: '',
          lastBillAmount: 0,
        };
        summaryMap.set(key, entry);
      } else {
        if (!entry.clientNTN && d.clientNTN) entry.clientNTN = String(d.clientNTN);
        if (!entry.clientAddress && d.clientAddress) entry.clientAddress = String(d.clientAddress);
      }

      const docType = String(d.type || d.Type || 'BILL').toUpperCase();
      const docDate = String(d.date || d.Date || '');
      const docNo = String(d.docNo || d.DocNo || '');
      const docTotal = Number(d.grandTotal ?? d.GrandTotal ?? 0);

      if (docType === 'BILL') {
        entry.billCount += 1;
        entry.goodsTotal += Number(d.goodsSub ?? d.GoodsSub ?? 0);
        entry.gstTotal += Number(d.gst ?? d.GST ?? 0);
        entry.serviceTotal += Number(d.serviceSub ?? d.ServiceSub ?? 0);
        entry.pstTotal += Number(d.pst ?? d.PST ?? 0);
        entry.grandTotal += docTotal;

        if (docDate && (!entry.lastBillDate || docDate >= entry.lastBillDate)) {
          entry.lastBillDate = docDate;
          entry.lastBillNo = docNo;
          entry.lastBillAmount = docTotal;
        }
      } else {
        entry.quoteCount += 1;
      }
    });

    // Requirement: in client report (no need to display with zero value)
    const activeList = Array.from(summaryMap.values()).filter(
      (r) => r.grandTotal > 0
    );

    // Sort by grandTotal descending (highest revenue client first)
    return activeList.sort((a, b) => b.grandTotal - a.grandTotal);
  }, [docs]);

  // Filtered Client Report matching search query
  const filteredClientReport = useMemo(() => {
    const q = String(searchQuery || '').toLowerCase().trim();
    if (!q) return clientReportSummaries;

    return clientReportSummaries.filter((r) => {
      const name = r.clientName.toLowerCase();
      const ntn = r.clientNTN.toLowerCase();
      const addr = r.clientAddress.toLowerCase();
      const totalStr = String(r.grandTotal);
      const totalFmt = formatCurrency(r.grandTotal).toLowerCase();
      return name.includes(q) || ntn.includes(q) || addr.includes(q) || totalStr.includes(q) || totalFmt.includes(q);
    });
  }, [clientReportSummaries, searchQuery]);

  // Totals across filtered client report
  const reportTotals = useMemo(() => {
    let totalBills = 0;
    let totalQuotes = 0;
    let totalGoods = 0;
    let totalGst = 0;
    let totalServices = 0;
    let totalPst = 0;
    let totalGrand = 0;

    for (const r of filteredClientReport) {
      totalBills += r.billCount;
      totalQuotes += r.quoteCount;
      totalGoods += r.goodsTotal;
      totalGst += r.gstTotal;
      totalServices += r.serviceTotal;
      totalPst += r.pstTotal;
      totalGrand += r.grandTotal;
    }

    return { totalBills, totalQuotes, totalGoods, totalGst, totalServices, totalPst, totalGrand };
  }, [filteredClientReport]);

  const drillDownDocs = useMemo(() => {
    if (!drillDownClient) return [];
    const clientKey = drillDownClient.toLowerCase().trim();
    return docs.filter(
      (d) => String(d.clientName || d.ClientName || '').toLowerCase().trim() === clientKey
    );
  }, [docs, drillDownClient]);

  const drillDownSummary = useMemo(() => {
    if (!drillDownClient) return null;
    return clientReportSummaries.find(
      (r) => r.clientName.toLowerCase().trim() === drillDownClient.toLowerCase().trim()
    );
  }, [clientReportSummaries, drillDownClient]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Corporate header */}
      <header className="bg-navy-950 text-white sticky top-0 z-30 shadow-[0_2px_12px_rgba(12,28,51,0.35)]">
        <div className="h-0.5 bg-gradient-to-r from-gold-700 via-gold-400 to-gold-700" />
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/5 border border-gold-500/50 flex items-center justify-center font-extrabold text-lg text-gold-400">
              FA
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[17px] font-extrabold tracking-tight text-white">
                  {settings.ownerName || 'MIAN FARHAN ANWAR'}
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gold-500/15 text-gold-400 border border-gold-500/40 uppercase tracking-wider">
                  Enterprise Group
                </span>
              </div>
              <p className="text-xs text-navy-200 font-medium">
                Govt Contractors &amp; General Order Suppliers · Billing Portal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={activeFirmId}
                onChange={(e) => onSelectFirm(e.target.value)}
                className="appearance-none bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl pl-3.5 pr-9 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-gold-400/60 cursor-pointer transition"
              >
                {firms.map((firm) => (
                  <option key={firm.id} value={firm.id} className="text-ink-900 font-semibold">
                    {firm.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-white/70 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <button
              onClick={onRefresh}
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-400/10 text-emerald-300 border border-emerald-400/30 hover:bg-emerald-400/20 transition"
              title="Google Sheet live connected · Click to refresh records"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Synced · {docs.length} docs</span>
            </button>

            <button
              onClick={onRefresh}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition"
              title="Refresh records"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onLock}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition"
              title="Lock portal"
            >
              <Lock className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>


      <main className="max-w-6xl mx-auto px-4 py-5 w-full flex-1">
        {/* KPI cards — restrained corporate */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
          <div className="corp-card p-4">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-lg bg-navy-900 text-gold-400 flex items-center justify-center shrink-0">
                <Building2 className="w-4.5 h-4.5" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500 leading-tight">Active<br />Entity</span>
            </div>
            <div className="text-[15px] font-extrabold text-ink-900 truncate mt-2.5">{currentFirm.name}</div>
            <div className="text-[11px] text-ink-500 font-mono font-semibold mt-0.5">NTN: {currentFirm.ntn || '—'}</div>
          </div>

          <div className="corp-card p-4">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4.5 h-4.5" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500 leading-tight">Total<br />Billed</span>
            </div>
            <div className="text-[15px] font-extrabold font-mono text-ink-900 truncate mt-2.5">Rs. {formatCurrency(analytics.totalBilled)}</div>
            <div className="text-[11px] text-ink-400 mt-0.5">Across active orders</div>
          </div>

          <div className="corp-card p-4">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-lg bg-navy-50 text-navy-700 flex items-center justify-center shrink-0">
                <Receipt className="w-4.5 h-4.5" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500 leading-tight">Federal<br />GST 18%</span>
            </div>
            <div className="text-[15px] font-extrabold font-mono text-ink-900 truncate mt-2.5">Rs. {formatCurrency(analytics.totalGst)}</div>
            <div className="text-[11px] text-ink-400 mt-0.5">Sales tax on goods</div>
          </div>

          <div className="corp-card p-4">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-lg bg-gold-100 text-gold-700 flex items-center justify-center shrink-0">
                <CreditCard className="w-4.5 h-4.5" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500 leading-tight">Punjab<br />PST 16%</span>
            </div>
            <div className="text-[15px] font-extrabold font-mono text-ink-900 truncate mt-2.5">Rs. {formatCurrency(analytics.totalPst)}</div>
            <div className="text-[11px] text-ink-400 mt-0.5">Sales tax on services</div>
          </div>

          <div className="corp-card p-4 col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-lg bg-navy-50 text-navy-700 flex items-center justify-center shrink-0">
                <FileText className="w-4.5 h-4.5" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500 leading-tight">Documents<br />Register</span>
            </div>
            <div className="text-[15px] font-extrabold text-ink-900 mt-2.5">
              {analytics.billCount} <span className="font-semibold text-ink-400 text-xs">Bills</span>
              <span className="text-ink-400 mx-1">·</span>
              {analytics.quoteCount} <span className="font-semibold text-ink-400 text-xs">Quotes</span>
            </div>
            <div className="text-[11px] text-ink-400 mt-0.5">{clients.length} saved clients</div>
          </div>
        </div>

        {/* Primary actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <button
            onClick={onNewBill}
            className="group p-5 rounded-2xl bg-navy-900 hover:bg-navy-950 active:scale-[0.99] text-white flex items-center justify-between shadow-[0_8px_20px_-8px_rgba(12,28,51,0.5)] transition text-left"
          >
            <div>
              <div className="text-[17px] font-extrabold tracking-tight">Create New Bill</div>
              <p className="text-xs text-navy-200 font-medium mt-0.5">Under {currentFirm.name}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="corp-chip bg-gold-500 text-navy-950">Next #{currentFirm.nextBillNo || '101'}</span>
              <span className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center group-hover:bg-white/15 transition">
                <FilePlus className="w-5 h-5 text-gold-400" />
              </span>
            </div>
          </button>

          <button
            onClick={onNewQuotation}
            className="group corp-card p-5 hover:border-gold-500/60 active:scale-[0.99] flex items-center justify-between transition text-left"
          >
            <div>
              <div className="text-[17px] font-extrabold tracking-tight text-ink-900">New Quotation</div>
              <p className="text-xs text-ink-500 font-medium mt-0.5">Rate estimate · 7-day validity</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="corp-chip bg-navy-50 text-navy-800 border border-navy-100">Next #{currentFirm.nextQuoteNo || 'Q-201'}</span>
              <span className="w-10 h-10 rounded-xl bg-gold-100 flex items-center justify-center">
                <FileText className="w-5 h-5 text-gold-700" />
              </span>
            </div>
          </button>

          <button
            onClick={onOpenSettings}
            className="group corp-card p-5 hover:border-navy-200 active:scale-[0.99] flex items-center justify-between transition text-left"
          >
            <div>
              <div className="text-[17px] font-extrabold tracking-tight text-ink-900">Manage Profiles</div>
              <p className="text-xs text-ink-500 font-medium mt-0.5">Print margins, NTN &amp; settings</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="corp-chip bg-navy-50 text-navy-800 border border-navy-100">{firms.length} firms active</span>
              <span className="w-10 h-10 rounded-xl bg-navy-50 flex items-center justify-center">
                <Settings className="w-5 h-5 text-navy-700" />
              </span>
            </div>
          </button>
        </div>

        {/* Workspace */}
        <div className="corp-card overflow-hidden">
          <div className="p-4 border-b border-line flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 bg-paper p-1 rounded-xl self-start">
              {([
                ['DOCUMENTS', FileText, `Documents`],
                ['CLIENTS', Users, `Clients (${clients.length})`],
                ['REPORTS', BarChart3, `Reports (${clientReportSummaries.length})`],
              ] as const).map(([tab, Icon, label]) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as typeof activeTab)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${
                    activeTab === tab
                      ? 'bg-navy-900 text-white shadow-sm'
                      : 'text-ink-500 hover:text-ink-900 hover:bg-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {activeTab === 'DOCUMENTS' && (
                <>
                  <div className="flex items-center bg-paper p-1 rounded-xl text-xs font-bold border border-line">
                    {(['ALL', 'BILL', 'QUOTATION'] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setDocFilter(filter)}
                        className={`px-3 py-1.5 rounded-lg transition ${
                          docFilter === filter ? 'bg-white text-ink-900 shadow-sm border border-line' : 'text-ink-500 hover:text-ink-900'
                        }`}
                      >
                        {filter === 'QUOTATION' ? 'QUOTES' : filter}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => exportDocumentsToExcel(filteredDocs, currentFirm.name)}
                    className="corp-btn-ghost !py-2 text-emerald-700 !border-emerald-200 hover:!bg-emerald-50 text-xs"
                    title="Export register to Excel (.xlsx)"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span className="hidden sm:inline">Excel</span>
                  </button>
                </>
              )}
              {activeTab === 'CLIENTS' && (
                <button onClick={onOpenAddClient} className="corp-btn-primary !py-2 text-xs">
                  <Plus className="w-4 h-4" />
                  <span>Add Client</span>
                </button>
              )}
              {activeTab === 'REPORTS' && (
                <button
                  onClick={() => exportClientReportToExcel(filteredClientReport, currentFirm.name)}
                  className="corp-btn-ghost !py-2 text-emerald-700 !border-emerald-200 hover:!bg-emerald-50 text-xs"
                  title="Export client-wise report to Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Export Report</span>
                </button>
              )}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={activeTab === 'DOCUMENTS' ? 'Search bill #, client, amount…' : activeTab === 'CLIENTS' ? 'Search name, NTN, address…' : 'Search report…'}
                  className="corp-input !py-2 pl-9 pr-9 text-xs"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-900 p-0.5 rounded"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <kbd className="hidden lg:block absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-ink-400 bg-paper border border-line px-1.5 py-0.5 rounded font-mono pointer-events-none">/</kbd>
                )}
              </div>
            </div>
          </div>

          {/* DOCUMENTS */}
          {activeTab === 'DOCUMENTS' && (
            <>
              {filteredDocs.length === 0 ? (
                <div className="p-14 text-center">
                  <span className="w-14 h-14 rounded-2xl bg-navy-50 text-navy-300 flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-7 h-7" />
                  </span>
                  <p className="font-bold text-ink-900">No documents found</p>
                  <p className="text-xs text-ink-400 mt-1">{searchQuery ? 'Nothing matches your search.' : 'Create your first bill or quotation above.'}</p>
                </div>
              ) : (
                <div className="divide-y divide-line pb-28 sm:pb-6">
                  {filteredDocs.map((doc, docIdx) => {
                    const docId = String(doc.docId || doc.DocID || '');
                    const docNo = String(doc.docNo || doc.DocNo || '—');
                    const docType = String(doc.type || doc.Type || 'BILL');
                    const date = formatDateDisplay(doc.date || doc.Date);
                    const client = String(doc.clientName || doc.ClientName || 'Client');
                    const total = Number(doc.grandTotal ?? doc.GrandTotal ?? 0);
                    const status = String(doc.status || doc.Status || 'Active');
                    const isCancelled = status.toLowerCase() === 'cancelled';
                    const isMenuOpen = activeMenuDocId === docId;
                    const docFirmId = doc.firmId || (String(doc.firmName || '').toLowerCase().includes('hashir') ? 'firm-hashir-traders' : 'firm-anwar-traders');
                    const firmName = String(doc.firmName || (docFirmId === 'firm-hashir-traders' ? 'Hashir Traders' : 'Anwar Traders'));
                    const isLastLIFO = isLastDocLIFO(doc, docs, docFirmId);
                    const isBottomEntry = docIdx >= filteredDocs.length - 1 || (filteredDocs.length > 2 && docIdx >= filteredDocs.length - 2);

                    return (
                      <div
                        key={docId}
                        className={`px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                          isMenuOpen ? 'relative z-20 bg-navy-50/60' : 'relative'
                        } ${isCancelled ? 'opacity-55 bg-paper/60' : 'hover:bg-navy-50/40'}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className={`corp-chip ${docType === 'BILL' ? 'bg-navy-900 text-white' : 'bg-gold-100 text-gold-700 border border-gold-200'}`}>
                              {docType} #{docNo}
                            </span>
                            <span className="text-xs text-ink-400 font-medium">{date}</span>
                            <span className="text-[11px] font-semibold text-ink-500">{firmName}</span>
                            {isLastLIFO && (
                              <span className="corp-chip bg-gold-100 text-gold-700 border border-gold-300" title="Latest entry — eligible for PIN-protected deletion">
                                Latest (LIFO)
                              </span>
                            )}
                            {isCancelled && (
                              <span className="corp-chip bg-red-50 text-[#b3372f] border border-red-200">Cancelled</span>
                            )}
                          </div>
                          <div className="text-[15px] font-bold text-ink-900 truncate">{client}</div>
                          {(doc.refText || doc.RefText) && (
                            <div className="text-xs text-ink-400 truncate mt-0.5">{String(doc.refText || doc.RefText)}</div>
                          )}
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-line">
                          <div className="text-right">
                            <span className="text-[10px] text-ink-400 block uppercase font-bold tracking-wider">Grand Total</span>
                            <span className="text-[17px] font-extrabold text-ink-900 font-mono">Rs. {formatCurrency(total)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); onSelectDoc(doc); }}
                              className="corp-btn-ghost !px-3 !py-2 text-xs"
                              title="View & print"
                            >
                              <Eye className="w-3.5 h-3.5" /><span>View</span>
                            </button>
                            {!isCancelled && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onEditDoc(doc); }}
                                className="corp-btn-ghost !px-3 !py-2 text-xs !text-navy-800 !border-navy-200"
                                title="Edit document"
                              >
                                <Edit className="w-3.5 h-3.5" /><span>Edit</span>
                              </button>
                            )}
                            <div className="relative">
                              <button
                                onClick={(e) => { e.stopPropagation(); setActiveMenuDocId(isMenuOpen ? null : docId); }}
                                className="p-2 text-ink-400 hover:text-ink-900 hover:bg-paper rounded-xl transition min-w-[36px] min-h-[36px] flex items-center justify-center"
                                aria-label="More actions"
                              >
                                <MoreVertical className="w-5 h-5" />
                              </button>
                              {isMenuOpen && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setActiveMenuDocId(null); }} />
                                  <div className={`absolute right-0 ${isBottomEntry ? 'bottom-full mb-2' : 'top-full mt-1.5'} w-56 bg-white rounded-xl shadow-[0_16px_40px_-8px_rgba(12,28,51,0.3)] border border-line z-50 py-1.5 text-[13px] font-medium`}>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setActiveMenuDocId(null); onDuplicateDoc(doc); }}
                                      className="w-full px-3.5 py-2.5 text-left hover:bg-paper flex items-center gap-2.5 text-ink-700"
                                    >
                                      <Copy className="w-4 h-4 text-ink-400" /><span>Duplicate record</span>
                                    </button>
                                    {docType === 'QUOTATION' && !isCancelled && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setActiveMenuDocId(null); onMakeBillFromQuotation(doc); }}
                                        className="w-full px-3.5 py-2.5 text-left hover:bg-navy-50 flex items-center gap-2.5 text-navy-800 font-semibold"
                                      >
                                        <FilePlus className="w-4 h-4" /><span>Convert into bill</span>
                                      </button>
                                    )}
                                    {!isCancelled && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setActiveMenuDocId(null); const d = filteredDocs.find((x) => String(x.docId || x.DocID) === docId); if (deletePinRequired && d) { setDocToDeleteLifo(d); setLifoMode('cancel'); setIsLifoModalOpen(true); } else if (confirm(`Cancel ${docType} #${docNo}?`)) { void onCancelDoc(docId); } }}
                                        className="w-full px-3.5 py-2.5 text-left hover:bg-red-50 text-[#b3372f] flex items-center gap-2.5 border-t border-line"
                                      >
                                        <Ban className="w-4 h-4" /><span>Cancel document</span>
                                      </button>
                                    )}
                                    {isLastLIFO && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setActiveMenuDocId(null); handleOpenLifoDelete(doc); }}
                                        className="w-full px-3.5 py-2.5 text-left hover:bg-red-50 text-[#b3372f] flex items-center gap-2.5 border-t border-red-100 font-semibold"
                                        title="Only the last recorded entry may be deleted under PIN authorization"
                                      >
                                        <Trash2 className="w-4 h-4" /><span>Delete record (LIFO)</span>
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

          {/* CLIENTS */}
          {activeTab === 'CLIENTS' && (
            <div className="divide-y divide-line">
              <div className="px-4 py-3 bg-navy-50/60 border-b border-line flex items-center justify-between text-xs">
                <span className="font-semibold text-navy-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-navy-600" />
                  Synced automatically from bills &amp; the Google Sheet registry
                </span>
                <span className="text-[11px] font-bold text-navy-700">{clients.length} registered</span>
              </div>
              {filteredClients.length === 0 ? (
                <div className="p-14 text-center">
                  <span className="w-14 h-14 rounded-2xl bg-navy-50 text-navy-300 flex items-center justify-center mx-auto mb-4">
                    <Users className="w-7 h-7" />
                  </span>
                  <p className="font-bold text-ink-900">No clients found</p>
                  <p className="text-xs text-ink-400 mt-1">Add one manually, or save a bill to register a client.</p>
                </div>
              ) : (
                filteredClients.map((client: any, idx) => {
                  const cName = String(client?.name || client?.Name || client?.clientName || client?.ClientName || (typeof client === 'string' ? client : 'Unnamed Client'));
                  const cNtn = String(client?.ntn || client?.NTN || client?.clientNTN || client?.ClientNTN || '');
                  const cStrn = String(client?.strn || client?.STRN || '');
                  const cAddr = String(client?.address || client?.Address || client?.clientAddress || client?.ClientAddress || '');
                  const cLastUsed = String(client?.lastUsed || client?.LastUsed || '');
                  return (
                    <div key={client?.id || cName + idx} className="px-4 py-3.5 hover:bg-navy-50/40 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-[15px] text-ink-900">{cName}</span>
                          {cNtn && <span className="corp-chip bg-navy-50 text-navy-800 border border-navy-100 font-mono">NTN {cNtn}</span>}
                          {cStrn && <span className="corp-chip bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">STRN {cStrn}</span>}
                        </div>
                        <p className="text-xs text-ink-400 mt-1 truncate">{cAddr || 'No office address specified'}</p>
                        {cLastUsed && <p className="text-[10px] text-ink-400 mt-0.5">Last active · {cLastUsed}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        <button onClick={() => onEditClient(client)} className="corp-btn-ghost !px-3 !py-2 text-xs">
                          <Edit className="w-3.5 h-3.5" /><span>Edit</span>
                        </button>
                        <button
                          onClick={() => { if (confirm(`Remove client ${cName}?`)) onDeleteClient(client?.id || '', cName); }}
                          className="p-2 text-ink-400 hover:text-[#b3372f] rounded-xl hover:bg-red-50 transition"
                          title="Delete client"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* REPORTS */}
          {activeTab === 'REPORTS' && (
            <div>
              <div className="px-4 sm:px-5 py-4 bg-navy-950 text-white flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-white/5 border border-gold-500/40 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-gold-400" />
                  </span>
                  <div>
                    <h2 className="text-[15px] font-extrabold tracking-tight">Client-Wise Billing &amp; Tax Report</h2>
                    <p className="text-xs text-navy-200">Bills, goods value, GST &amp; PST per client</p>
                  </div>
                </div>
                <button
                  onClick={() => exportClientReportToExcel(filteredClientReport, currentFirm.name)}
                  className="corp-btn-gold !py-2 text-xs self-start md:self-auto"
                >
                  <FileSpreadsheet className="w-4 h-4" /><span>Export .xlsx</span>
                </button>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-paper border-b border-line">
                {[
                  ['Clients in report', `${filteredClientReport.length}`, `${reportTotals.totalBills} bills · ${reportTotals.totalQuotes} quotes`, 'text-ink-900'],
                  ['Total billed (PKR)', `Rs. ${formatCurrency(reportTotals.totalGrand)}`, 'All active invoices', 'text-ink-900'],
                  ['Federal GST 18%', `Rs. ${formatCurrency(reportTotals.totalGst)}`, `Goods Rs. ${formatCurrency(reportTotals.totalGoods)}`, 'text-navy-800'],
                  ['Punjab PST 16%', `Rs. ${formatCurrency(reportTotals.totalPst)}`, `Services Rs. ${formatCurrency(reportTotals.totalServices)}`, 'text-emerald-800'],
                ].map(([label, value, sub, cls]) => (
                  <div key={label as string} className="corp-card p-3.5">
                    <span className="corp-label !mb-1">{label}</span>
                    <div className={`text-[16px] font-extrabold font-mono ${cls}`}>{value}</div>
                    <div className="text-[11px] text-ink-400 mt-0.5">{sub}</div>
                  </div>
                ))}
              </div>

              {filteredClientReport.length === 0 ? (
                <div className="p-14 text-center">
                  <span className="w-14 h-14 rounded-2xl bg-navy-50 text-navy-300 flex items-center justify-center mx-auto mb-4">
                    <BarChart3 className="w-7 h-7" />
                  </span>
                  <p className="font-bold text-ink-900">No billed clients</p>
                  <p className="text-xs text-ink-400 mt-1">{searchQuery ? `No client matches "${searchQuery}".` : 'Clients with active bills will appear here.'}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-navy-900 text-white uppercase text-[10px] font-bold tracking-wider">
                        <th className="py-3 px-3 w-10 text-center">Sr</th>
                        <th className="py-3 px-3">Client</th>
                        <th className="py-3 px-2.5 text-center">Bills</th>
                        <th className="py-3 px-2.5 text-center">Quotes</th>
                        <th className="py-3 px-3 text-right">Goods</th>
                        <th className="py-3 px-3 text-right">GST 18%</th>
                        <th className="py-3 px-3 text-right">Services</th>
                        <th className="py-3 px-3 text-right">PST 16%</th>
                        <th className="py-3 px-3 text-right">Grand Total</th>
                        <th className="py-3 px-3 text-center">Last Bill</th>
                        <th className="py-3 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {filteredClientReport.map((c, i) => (
                        <tr
                          key={c.clientName + i}
                          onClick={() => setDrillDownClient(c.clientName)}
                          className={`hover:bg-navy-50/50 transition cursor-pointer ${i % 2 ? 'bg-paper/60' : 'bg-white'}`}
                          title="Click for client ledger"
                        >
                          <td className="py-3 px-3 text-center font-bold text-ink-400">{i + 1}</td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-ink-900 text-[13px]">{c.clientName}</div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {c.clientNTN && <span className="corp-chip bg-navy-50 text-navy-800 border border-navy-100 font-mono">NTN {c.clientNTN}</span>}
                              {c.clientAddress && <span className="text-[11px] text-ink-400 truncate max-w-[220px]">{c.clientAddress}</span>}
                            </div>
                          </td>
                          <td className="py-3 px-2.5 text-center"><span className={`corp-chip ${c.billCount ? 'bg-navy-900 text-white' : 'bg-paper text-ink-400'}`}>{c.billCount}</span></td>
                          <td className="py-3 px-2.5 text-center"><span className={`corp-chip ${c.quoteCount ? 'bg-gold-100 text-gold-700 border border-gold-200' : 'bg-paper text-ink-400'}`}>{c.quoteCount}</span></td>
                          <td className="py-3 px-3 text-right font-mono text-ink-700">{c.goodsTotal > 0 ? `Rs. ${formatCurrency(c.goodsTotal)}` : <span className="text-line">—</span>}</td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-navy-700">{c.gstTotal > 0 ? `Rs. ${formatCurrency(c.gstTotal)}` : <span className="text-line">—</span>}</td>
                          <td className="py-3 px-3 text-right font-mono text-ink-700">{c.serviceTotal > 0 ? `Rs. ${formatCurrency(c.serviceTotal)}` : <span className="text-line">—</span>}</td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-700">{c.pstTotal > 0 ? `Rs. ${formatCurrency(c.pstTotal)}` : <span className="text-line">—</span>}</td>
                          <td className="py-3 px-3 text-right font-mono font-extrabold text-ink-900">Rs. {formatCurrency(c.grandTotal)}</td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            {c.lastBillNo ? (
                              <div>
                                <span className="corp-chip bg-navy-50 text-navy-800 border border-navy-100 font-mono">#{c.lastBillNo}</span>
                                <div className="text-[10px] text-ink-400 mt-1">{formatDateDisplay(c.lastBillDate)} · Rs. {formatCurrency(c.lastBillAmount)}</div>
                              </div>
                            ) : <span className="text-line">—</span>}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={(e) => { e.stopPropagation(); setDrillDownClient(c.clientName); }}
                              className="corp-btn-primary !py-1.5 !px-3 text-[11px]"
                            >
                              <Eye className="w-3.5 h-3.5" /><span>Ledger</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-navy-950 text-white font-bold text-xs">
                        <td colSpan={2} className="py-3 px-3 uppercase tracking-wide">Total · {filteredClientReport.length} clients</td>
                        <td className="py-3 px-2.5 text-center">{reportTotals.totalBills}</td>
                        <td className="py-3 px-2.5 text-center">{reportTotals.totalQuotes}</td>
                        <td className="py-3 px-3 text-right font-mono">Rs. {formatCurrency(reportTotals.totalGoods)}</td>
                        <td className="py-3 px-3 text-right font-mono text-navy-200">Rs. {formatCurrency(reportTotals.totalGst)}</td>
                        <td className="py-3 px-3 text-right font-mono">Rs. {formatCurrency(reportTotals.totalServices)}</td>
                        <td className="py-3 px-3 text-right font-mono text-emerald-300">Rs. {formatCurrency(reportTotals.totalPst)}</td>
                        <td className="py-3 px-3 text-right font-mono font-extrabold text-gold-400">Rs. {formatCurrency(reportTotals.totalGrand)}</td>
                        <td colSpan={2} className="py-3 px-3 text-center text-xs text-navy-200 font-medium">Consolidated</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Mobile action dock */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-line px-3 py-2 flex items-center justify-between gap-2 no-print">
        <div className="flex items-center gap-0.5">
          {([
            ['DOCUMENTS', FileText, 'Docs'],
            ['CLIENTS', Users, 'Clients'],
            ['REPORTS', BarChart3, 'Reports'],
          ] as const).map(([tab, Icon, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as typeof activeTab)}
              className={`px-2.5 py-1.5 rounded-xl flex flex-col items-center gap-0.5 ${activeTab === tab ? 'text-navy-800 bg-navy-50' : 'text-ink-400'}`}
            >
              <Icon className="w-4.5 h-4.5" />
              <span className="text-[10px] font-bold">{label}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={onNewQuotation} className="corp-btn-ghost !py-2 !px-3 text-xs">+ Quote</button>
          <button onClick={onNewBill} className="corp-btn-primary !py-2 !px-3.5 text-xs">+ New Bill</button>
        </div>
      </div>

      <footer className="py-4 pb-24 sm:pb-5 text-center text-[11px] text-ink-400 font-medium">
        {settings.ownerName || 'MIAN FARHAN ANWAR'} Enterprise Systems
      </footer>

      {/* Client ledger drill-down */}
      {drillDownClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-navy-950/70 backdrop-blur-[2px]" onClick={() => setDrillDownClient(null)}>
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-line overflow-hidden flex flex-col my-auto max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 sm:px-5 py-4 bg-navy-950 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded-xl bg-white/5 border border-gold-500/40 flex items-center justify-center shrink-0">
                  <Briefcase className="w-5 h-5 text-gold-400" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-[16px] font-extrabold truncate">{drillDownClient}</h2>
                    <span className="corp-chip bg-emerald-400/10 text-emerald-300 border border-emerald-400/30">Client Ledger</span>
                  </div>
                  <p className="text-xs text-navy-200 truncate">
                    {drillDownSummary?.clientAddress ? drillDownSummary.clientAddress + ' · ' : ''}
                    {drillDownSummary?.clientNTN ? 'NTN ' + drillDownSummary.clientNTN : 'No NTN recorded'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => exportDocumentsToExcel(drillDownDocs, `${drillDownClient}_Bills`)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition"
                >
                  <Download className="w-3.5 h-3.5" /><span>Export</span>
                </button>
                <button type="button" onClick={() => setDrillDownClient(null)} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {drillDownSummary && (
              <div className="p-3 sm:p-4 bg-paper border-b border-line grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
                {[
                  ['Total invoiced', `Rs. ${formatCurrency(drillDownSummary.grandTotal)}`, `${drillDownDocs.length} documents`],
                  ['Federal GST', `Rs. ${formatCurrency(drillDownSummary.gstTotal)}`, `Goods Rs. ${formatCurrency(drillDownSummary.goodsTotal)}`],
                  ['Punjab PST', `Rs. ${formatCurrency(drillDownSummary.pstTotal)}`, `Services Rs. ${formatCurrency(drillDownSummary.serviceTotal)}`],
                  ['Latest bill', drillDownSummary.lastBillNo ? `#${drillDownSummary.lastBillNo}` : '—', drillDownSummary.lastBillDate ? formatDateDisplay(drillDownSummary.lastBillDate) : 'No bill yet'],
                ].map(([label, value, sub]) => (
                  <div key={label as string} className="corp-card p-3">
                    <span className="corp-label !mb-1">{label}</span>
                    <div className="font-mono font-extrabold text-ink-900 text-[15px]">{value}</div>
                    <div className="text-[10px] text-ink-400 mt-0.5">{sub}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="p-3 sm:p-4 overflow-y-auto flex-1">
              {drillDownDocs.length === 0 ? (
                <div className="p-10 text-center text-ink-400">
                  <FileText className="w-10 h-10 mx-auto mb-2 text-line" />
                  <p className="font-bold text-ink-700">No documents for this client</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-line">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-navy-900 text-white uppercase text-[10px] font-bold tracking-wider">
                        <th className="py-2.5 px-2.5 text-center">Sr</th>
                        <th className="py-2.5 px-2.5">Date</th>
                        <th className="py-2.5 px-2.5">Doc</th>
                        <th className="py-2.5 px-3">Reference</th>
                        <th className="py-2.5 px-2.5 text-right">Goods</th>
                        <th className="py-2.5 px-2.5 text-right">GST</th>
                        <th className="py-2.5 px-2.5 text-right">Services</th>
                        <th className="py-2.5 px-2.5 text-right">PST</th>
                        <th className="py-2.5 px-2.5 text-right">Total</th>
                        <th className="py-2.5 px-2.5 text-center">Open</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {drillDownDocs.map((d, idx) => {
                        const dType = String(d.type || d.Type || 'BILL');
                        const dNo = String(d.docNo || d.DocNo || '—');
                        const isCancelled = String(d.status || d.Status || '').toLowerCase() === 'cancelled';
                        const total = Number(d.grandTotal ?? d.GrandTotal ?? 0);
                        return (
                          <tr key={String(d.docId || d.DocID || idx)} className={`hover:bg-navy-50/50 transition ${isCancelled ? 'opacity-55' : ''}`}>
                            <td className="py-2.5 px-2.5 text-center font-bold text-ink-400">{idx + 1}</td>
                            <td className="py-2.5 px-2.5 whitespace-nowrap text-ink-500 font-medium">{formatDateDisplay(d.date || d.Date)}</td>
                            <td className="py-2.5 px-2.5 whitespace-nowrap">
                              <span className={`corp-chip ${dType === 'BILL' ? 'bg-navy-900 text-white' : 'bg-gold-100 text-gold-700 border border-gold-200'}`}>{dType} #{dNo}</span>
                            </td>
                            <td className="py-2.5 px-3 text-ink-700 max-w-[220px] truncate" title={String(d.refText || d.RefText || '')}>
                              {String(d.refText || d.RefText || '') || <span className="text-line italic">No reference</span>}
                            </td>
                            <td className="py-2.5 px-2.5 text-right font-mono text-ink-500">{formatCurrency(Number(d.goodsSub ?? d.GoodsSub ?? 0))}</td>
                            <td className="py-2.5 px-2.5 text-right font-mono text-navy-700">{formatCurrency(Number(d.gst ?? d.GST ?? 0))}</td>
                            <td className="py-2.5 px-2.5 text-right font-mono text-ink-500">{formatCurrency(Number(d.serviceSub ?? d.ServiceSub ?? 0))}</td>
                            <td className="py-2.5 px-2.5 text-right font-mono text-emerald-700">{formatCurrency(Number(d.pst ?? d.PST ?? 0))}</td>
                            <td className="py-2.5 px-2.5 text-right font-mono font-extrabold text-ink-900">Rs. {formatCurrency(total)}</td>
                            <td className="py-2.5 px-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => { setDrillDownClient(null); onSelectDoc(d); }}
                                className="corp-btn-ghost !py-1.5 !px-3 text-[11px]"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="px-4 py-3 bg-paper border-t border-line flex items-center justify-between text-xs text-ink-400 shrink-0">
              <span className="font-medium hidden sm:inline">Complete billing history for this client</span>
              <button type="button" onClick={() => setDrillDownClient(null)} className="corp-btn-ghost !py-2 text-xs ml-auto">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* LIFO delete modal */}
      <LifoDeleteModal
        isOpen={isLifoModalOpen}
        doc={docToDeleteLifo}
        onClose={() => { setIsLifoModalOpen(false); setDocToDeleteLifo(null); setLifoMode('delete'); }}
        onConfirmDelete={handleConfirmLifoDelete}
        onConfirmCancel={handleConfirmLifoCancel}
        mode={lifoMode}
        isDeleting={isDeletingLifo}
        deletePinRequired={deletePinRequired}
      />
    </div>
  );
};
