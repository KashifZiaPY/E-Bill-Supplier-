import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Printer,
  ChevronDown,
  Building,
  Calendar,
  FileCheck,
  Lock,
  X,
} from 'lucide-react';
import type {
  CatalogItem,
  DocumentRecord,
  DocType,
  LineItem,
  SavedClient,
  SupplierSettings,
  TaxType,
} from '../types/billing';
import {
  addDaysISO,
  calculateTotals,
  formatCurrency,
  formatDateISO,
  generateUUID,
  safeNormalizeItems,
} from '../utils/formatters';
import { getSuggestedNextNo } from '../utils/lifoHelper';

interface Props {
  initialDoc?: Partial<DocumentRecord> | null;
  docType: DocType;
  settings: SupplierSettings;
  clients: SavedClient[];
  catalog: CatalogItem[];
  docs?: DocumentRecord[];
  onBack: () => void;
  onSave: (doc: any, previewAfter: boolean) => Promise<void>;
  isSaving: boolean;
}

export const EntryFormScreen: React.FC<Props> = ({
  initialDoc,
  docType,
  settings,
  clients,
  catalog,
  docs,
  onBack,
  onSave,
  isSaving,
}) => {
  // Generate or reuse requestId for idempotency
  const requestIdRef = useRef<string>(initialDoc?.requestId || initialDoc?.RequestId || generateUUID());

  // Firm Selection (Multi-firm for MIAN FARHAN ANWAR)
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

  const [selectedFirmId, setSelectedFirmId] = useState<string>(() => {
    return initialDoc?.firmId || settings.activeFirmId || firms[0].id;
  });

  const activeFirm = useMemo(() => {
    const f = firms.find((f) => f.id === selectedFirmId) || firms[0];
    // Numbering must never duplicate: suggest one past the highest existing
    // number for this firm. For the active firm the backend's top-level
    // counters are authoritative; other firms use their own stored counter.
    if (f) {
      const isActive = f.id === settings.activeFirmId;
      const baseBill = (isActive ? settings.nextBillNo : undefined) || (f as any).nextBillNo || '101';
      const baseQuote = (isActive ? settings.nextQuoteNo : undefined) || (f as any).nextQuoteNo || 'Q-201';
      return {
        ...f,
        nextBillNo: getSuggestedNextNo(docs, baseBill, f.id, 'BILL'),
        nextQuoteNo: getSuggestedNextNo(docs, baseQuote, f.id, 'QUOTATION'),
      };
    }
    return f;
  }, [firms, selectedFirmId, docs, settings.activeFirmId, settings.nextBillNo, settings.nextQuoteNo]);

  // Form states
  const [docNoManuallyEdited, setDocNoManuallyEdited] = useState(false);
  const [docNo, setDocNo] = useState<string>(() => {
    if (initialDoc?.docNo || initialDoc?.DocNo) {
      return String(initialDoc.docNo || initialDoc.DocNo || '');
    }
    return docType === 'BILL' ? activeFirm.nextBillNo || '101' : activeFirm.nextQuoteNo || 'Q-201';
  });

  const [date, setDate] = useState<string>(() => {
    return String(initialDoc?.date || initialDoc?.Date || formatDateISO());
  });

  const [validUntil, setValidUntil] = useState<string>(() => {
    return String(initialDoc?.validUntil || initialDoc?.ValidUntil || addDaysISO(formatDateISO(), 7));
  });

  const [clientName, setClientName] = useState<string>(() => {
    return String(initialDoc?.clientName || initialDoc?.ClientName || '');
  });

  const [clientAddress, setClientAddress] = useState<string>(() => {
    return String(initialDoc?.clientAddress || initialDoc?.ClientAddress || '');
  });

  const [clientNTN, setClientNTN] = useState<string>(() => {
    return String(initialDoc?.clientNTN || initialDoc?.ClientNTN || '');
  });

  const [refText, setRefText] = useState<string>(() => {
    return String(initialDoc?.refText || initialDoc?.RefText || '');
  });

  const [formError, setFormError] = useState<string>('');
  const [attemptedSubmit, setAttemptedSubmit] = useState<boolean>(false);

  // Dropdown states & Outside-click Refs
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [activeCatalogRowIndex, setActiveCatalogRowIndex] = useState<number | null>(null);
  const [highlightedClientIndex, setHighlightedClientIndex] = useState<number>(0);
  const [highlightedCatalogIndex, setHighlightedCatalogIndex] = useState<number>(0);

  const clientDropdownRef = useRef<HTMLDivElement>(null);
  const catalogContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHighlightedClientIndex(0);
  }, [clientName, showClientDropdown]);

  useEffect(() => {
    setHighlightedCatalogIndex(0);
  }, [activeCatalogRowIndex]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target as Node)) {
        setShowClientDropdown(false);
      }
      if (catalogContainerRef.current && !catalogContainerRef.current.contains(event.target as Node)) {
        setActiveCatalogRowIndex(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Safe client filtering
  const filteredClients = useMemo(() => {
    if (!clients || !Array.isArray(clients)) return [];
    const query = String(clientName || '').toLowerCase().trim();

    if (!query) {
      return clients.slice(0, 10);
    }

    return clients.filter((c: any) => {
      if (!c) return false;
      const name = String(c.name || c.Name || c.clientName || c.ClientName || (typeof c === 'string' ? c : '')).toLowerCase();
      const ntn = String(c.ntn || c.NTN || c.clientNTN || c.ClientNTN || '').toLowerCase();
      const strn = String(c.strn || c.STRN || c.clientSTRN || c.ClientSTRN || '').toLowerCase();
      const addr = String(c.address || c.Address || c.clientAddress || c.ClientAddress || '').toLowerCase();
      return name.includes(query) || ntn.includes(query) || strn.includes(query) || addr.includes(query);
    }).slice(0, 10);
  }, [clients, clientName]);

  // Line items state
  const [items, setItems] = useState<LineItem[]>(() => {
    const rawItems = initialDoc?.items || (initialDoc as any)?.Items;
    const normalized = safeNormalizeItems(rawItems);
    if (normalized.length > 0) {
      return normalized;
    }
    // Default 1 blank row
    return [
      {
        id: 'item-0-' + Date.now(),
        sr: 1,
        description: '',
        unit: 'Nos',
        qty: 1,
        rate: 0,
        tax: 'GST',
        amount: 0,
      },
    ];
  });

  // Tax Rates State: Custom GST rate per bill, while Punjab PST is legally fixed at 16%
  const PST_FIXED_RATE = 0.16;
  const pstPercent = 16;

  const [gstRatePercent, setGstRatePercent] = useState<number>(() => {
    if (initialDoc?.gstRate && initialDoc.gstRate > 0) {
      return Math.round(initialDoc.gstRate * 100);
    }
    if ((initialDoc as any)?.GstRate && (initialDoc as any).GstRate > 0) {
      return Math.round((initialDoc as any).GstRate * 100);
    }
    return Math.round((activeFirm.gstRate || 0.18) * 100);
  });

  const [isCustomGstInput, setIsCustomGstInput] = useState<boolean>(() => {
    const r = initialDoc?.gstRate ?? (initialDoc as any)?.GstRate ?? (activeFirm.gstRate || 0.18);
    const pct = Math.round(r * 100);
    return ![18, 17, 15, 12, 5, 0].includes(pct);
  });

  const gstRateDecimal = (Number(gstRatePercent) || 0) / 100;
  const gstPercent = Math.round(gstRatePercent);

  // Live Totals calculation using custom GST rate and statutory 16% PST rate
  const totals = useMemo(() => {
    return calculateTotals(items, gstRateDecimal, PST_FIXED_RATE);
  }, [items, gstRateDecimal]);

  // Handlers for Items
  const handleItemChange = (
    index: number,
    field: keyof LineItem,
    value: any
  ) => {
    setItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      if (field === 'qty' || field === 'rate') {
        const q = field === 'qty' ? Number(value) || 0 : Number(item.qty) || 0;
        const r = field === 'rate' ? Number(value) || 0 : Number(item.rate) || 0;
        item.amount = Math.round(q * r * 100) / 100;
      }
      updated[index] = item;
      return updated;
    });
    setFormError('');
  };

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        id: 'item-' + prev.length + '-' + Date.now(),
        sr: prev.length + 1,
        description: '',
        unit: 'Nos',
        qty: 1,
        rate: 0,
        tax: 'GST',
        gstRate: gstRateDecimal,
        amount: 0,
      },
    ]);
  };

  const handleApplyGstRateToAllGoods = (targetRateDecimal: number) => {
    setItems((prev) =>
      prev.map((it) => (it.tax === 'GST' ? { ...it, gstRate: targetRateDecimal } : it))
    );
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) {
      setItems([
        {
          id: 'item-0-' + Date.now(),
          sr: 1,
          description: '',
          unit: 'Nos',
          qty: 1,
          rate: 0,
          tax: 'GST',
          gstRate: gstRateDecimal,
          amount: 0,
        },
      ]);
      return;
    }
    setItems((prev) => {
      const filtered = prev.filter((_, idx) => idx !== index);
      return filtered.map((it, idx) => ({ ...it, sr: idx + 1 }));
    });
  };

  const handleSelectCatalogItem = (index: number, cat: CatalogItem) => {
    setItems((prev) => {
      const updated = [...prev];
      const currentQty = Number(updated[index].qty) || 1;
      const rate = Number(cat.rate || 0);
      const amount = Math.round(currentQty * rate * 100) / 100;
      updated[index] = {
        ...updated[index],
        description: String(cat.description || ''),
        unit: String(cat.unit || 'Nos'),
        rate: rate,
        tax: cat.tax || 'GST',
        amount,
      };
      return updated;
    });
    setActiveCatalogRowIndex(null);
  };

  const handleSelectClient = (c: any) => {
    const selectedName = String(c?.name || c?.Name || c?.clientName || c?.ClientName || (typeof c === 'string' ? c : '')).trim();
    const selectedAddress = String(c?.address || c?.Address || c?.clientAddress || c?.ClientAddress || '').trim();
    const selectedNTN = String(c?.ntn || c?.NTN || c?.clientNTN || c?.ClientNTN || '').trim();

    setClientName(selectedName);
    if (selectedAddress) setClientAddress(selectedAddress);
    if (selectedNTN) setClientNTN(selectedNTN);
    setShowClientDropdown(false);
    setFormError('');
  };

  // Submit Handler
  const handleSubmit = async (previewAfter: boolean) => {
    setAttemptedSubmit(true);
    const trimmedClient = clientName.trim();
    if (!trimmedClient) {
      setFormError('Client Name is required. Please type or select a client.');
      return;
    }

    if (!items || items.length === 0) {
      setFormError('Please add at least one line item.');
      return;
    }

    // All line item fields are strictly mandatory
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const desc = String(it.description || '').trim();
      const unit = String(it.unit || '').trim();
      const q = Number(it.qty);
      const r = Number(it.rate);

      const missing: string[] = [];
      if (!desc) missing.push('Description');
      if (!unit) missing.push('Unit');
      if (!(q > 0) || isNaN(q)) missing.push('Quantity (> 0)');
      if (!(r > 0) || isNaN(r)) missing.push('Rate (> 0)');

      if (missing.length > 0) {
        setFormError(`Line Item #${i + 1} is incomplete: ${missing.join(', ')} are mandatory.`);
        return;
      }
    }

    const liveTotals = calculateTotals(items, gstRateDecimal, PST_FIXED_RATE);

    const docPayload: any = {
      docId: initialDoc?.docId || initialDoc?.DocID,
      DocID: initialDoc?.docId || initialDoc?.DocID,
      firmId: activeFirm.id,
      firmName: activeFirm.name,
      type: docType,
      Type: docType,
      docNo: docNo.trim(),
      DocNo: docNo.trim(),
      docNoManual: docNoManuallyEdited,
      date,
      Date: date,
      validUntil: docType === 'QUOTATION' ? validUntil : undefined,
      ValidUntil: docType === 'QUOTATION' ? validUntil : undefined,
      clientName: trimmedClient,
      ClientName: trimmedClient,
      clientAddress: clientAddress.trim(),
      ClientAddress: clientAddress.trim(),
      clientNTN: clientNTN.trim(),
      ClientNTN: clientNTN.trim(),
      refText: refText.trim(),
      RefText: refText.trim(),
      requestId: requestIdRef.current,
      RequestId: requestIdRef.current,
      gstRate: gstRateDecimal,
      GstRate: gstRateDecimal,
      pstRate: PST_FIXED_RATE,
      PstRate: PST_FIXED_RATE,
      gstBreakdown: liveTotals.gstBreakdown,
      GstBreakdown: liveTotals.gstBreakdown,
      goodsSub: liveTotals.goodsSub,
      GoodsSub: liveTotals.goodsSub,
      gst: liveTotals.gst,
      GST: liveTotals.gst,
      serviceSub: liveTotals.serviceSub,
      ServiceSub: liveTotals.serviceSub,
      pst: liveTotals.pst,
      PST: liveTotals.pst,
      otherSub: liveTotals.otherSub,
      OtherSub: liveTotals.otherSub,
      grandTotal: liveTotals.grandTotal,
      GrandTotal: liveTotals.grandTotal,
      items: items.map((it, idx) => {
        const q = Number(it.qty) || 0;
        const r = Number(it.rate) || 0;
        const a = Math.round(q * r * 100) / 100;
        const itemGst = (it.gstRate !== undefined && it.gstRate !== null && !isNaN(Number(it.gstRate)))
          ? Number(it.gstRate)
          : gstRateDecimal;
        return {
          sr: idx + 1,
          Sr: idx + 1,
          description: String(it.description).trim(),
          Description: String(it.description).trim(),
          unit: String(it.unit || 'Nos').trim(),
          Unit: String(it.unit || 'Nos').trim(),
          qty: q,
          Qty: q,
          rate: r,
          Rate: r,
          tax: it.tax,
          Tax: it.tax,
          gstRate: it.tax === 'GST' ? itemGst : undefined,
          GstRate: it.tax === 'GST' ? itemGst : undefined,
          taxRate: it.tax === 'GST' ? itemGst : it.tax === 'PST' ? PST_FIXED_RATE : 0,
          TaxRate: it.tax === 'GST' ? itemGst : it.tax === 'PST' ? PST_FIXED_RATE : 0,
          amount: a,
          Amount: a,
        };
      }),
    };

    await onSave(docPayload, previewAfter);
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col pb-28 sm:pb-10">
      {/* Corporate top bar */}
      <header className="bg-navy-950 text-white sticky top-0 z-30 shadow-[0_2px_12px_rgba(12,28,51,0.35)]">
        <div className="h-0.5 bg-gradient-to-r from-gold-700 via-gold-400 to-gold-700" />
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={onBack}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition shrink-0"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className={`corp-chip shrink-0 ${docType === 'BILL' ? 'bg-navy-700 text-white border border-navy-600' : 'bg-gold-500 text-navy-950'}`}>
              {docType}
            </span>
            <h1 className="text-[17px] font-extrabold tracking-tight truncate">
              {initialDoc?.docId || initialDoc?.DocID ? 'Edit' : 'New'} {docType === 'BILL' ? 'Supplier Bill' : 'Quotation'}
            </h1>
          </div>
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSubmit(false)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-sm transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>Save</span>
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSubmit(true)}
              className="corp-btn-gold"
            >
              {isSaving ? (
                <span className="w-4 h-4 border-2 border-navy-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Printer className="w-4 h-4" />
              )}
              <span>Save &amp; Preview</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6 w-full flex-1">
        {formError && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-[#96291f] text-[13px] font-semibold flex items-center justify-between gap-3">
            <span>{formError}</span>
            <button type="button" onClick={() => setFormError('')} className="p-1 hover:bg-red-100 rounded-lg transition shrink-0" aria-label="Dismiss error">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Document header */}
        <section className="corp-card p-4 sm:p-6 mb-4">
          <div className="mb-5 pb-4 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="corp-label !mb-1">Billing firm</span>
              <span className="text-xs text-ink-500">Owner · <strong className="text-ink-900">{settings.ownerName || 'MIAN FARHAN ANWAR'}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-navy-700" />
              <select
                value={selectedFirmId}
                onChange={(e) => {
                  setSelectedFirmId(e.target.value);
                  const selected = firms.find((f) => f.id === e.target.value);
                  if (selected && (!initialDoc?.docNo && !initialDoc?.DocNo)) {
                    const isActiveSel = selected.id === settings.activeFirmId;
                    const baseB = (isActiveSel ? settings.nextBillNo : undefined) || (selected as any).nextBillNo || '101';
                    const baseQ = (isActiveSel ? settings.nextQuoteNo : undefined) || (selected as any).nextQuoteNo || 'Q-201';
                    setDocNo(docType === 'BILL'
                      ? getSuggestedNextNo(docs, baseB, selected.id, 'BILL')
                      : getSuggestedNextNo(docs, baseQ, selected.id, 'QUOTATION'));
                  }
                }}
                className="corp-input !w-auto !py-2 text-xs font-bold cursor-pointer"
              >
                {firms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}{f.ntn ? ` · NTN ${f.ntn}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <div>
              <label className="corp-label">{docType === 'BILL' ? 'Bill no.' : 'Quotation no.'}</label>
              <input
                type="text"
                value={docNo}
                onChange={(e) => { setDocNoManuallyEdited(true); setDocNo(e.target.value); }}
                placeholder="Auto-numbered"
                className="corp-input font-mono font-bold text-[15px] bg-paper focus:bg-white"
              />
              <span className="text-[11px] text-ink-400 mt-1 block">Auto-suggested, editable if needed</span>
            </div>
            <div>
              <label className="corp-label">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="corp-input font-semibold"
              />
            </div>
            {docType === 'QUOTATION' ? (
              <div>
                <label className="corp-label">Valid until</label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="corp-input font-semibold"
                />
              </div>
            ) : (
              <div className="hidden sm:flex items-center">
                <div className="px-3.5 py-2.5 bg-navy-50 rounded-xl border border-navy-100 text-xs text-navy-800">
                  <span className="font-bold block mb-0.5">Official PO Bill</span>
                  Items split automatically into Goods (GST) and Services (PST).
                </div>
              </div>
            )}
          </div>

          {/* Client */}
          <div className="border-t border-line pt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div ref={clientDropdownRef} className="sm:col-span-2 relative">
              <label className="corp-label">Client name <span className="text-[#b3372f]">*</span></label>
              <div className="relative">
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => { setClientName(e.target.value); setShowClientDropdown(true); }}
                  onFocus={() => setShowClientDropdown(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      if (!showClientDropdown) { setShowClientDropdown(true); setHighlightedClientIndex(0); }
                      else if (filteredClients.length > 0) setHighlightedClientIndex((prev) => (prev + 1) % filteredClients.length);
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      if (!showClientDropdown) { setShowClientDropdown(true); setHighlightedClientIndex(Math.max(0, filteredClients.length - 1)); }
                      else if (filteredClients.length > 0) setHighlightedClientIndex((prev) => (prev - 1 + filteredClients.length) % filteredClients.length);
                    } else if (e.key === 'Enter') {
                      if (showClientDropdown && filteredClients.length > 0) {
                        e.preventDefault();
                        const targetClient = filteredClients[highlightedClientIndex] || filteredClients[0];
                        if (targetClient) handleSelectClient(targetClient);
                      }
                    } else if (e.key === 'Escape') {
                      if (showClientDropdown) { e.preventDefault(); setShowClientDropdown(false); }
                    }
                  }}
                  placeholder="Start typing to search 32 registered clients…"
                  className="corp-input font-semibold pr-10"
                />
                {clients && clients.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowClientDropdown((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-900 p-1.5 rounded-lg hover:bg-paper transition"
                    aria-label="Browse clients"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                )}
              </div>
              {showClientDropdown && filteredClients.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-line rounded-xl shadow-[0_16px_40px_-8px_rgba(12,28,51,0.3)] z-50 max-h-60 overflow-y-auto divide-y divide-line">
                  {filteredClients.map((c: any, i) => {
                    const cName = String(c?.name || c?.Name || c?.clientName || c?.ClientName || (typeof c === 'string' ? c : 'Unnamed Client'));
                    const cAddress = String(c?.address || c?.Address || c?.clientAddress || c?.ClientAddress || '');
                    const cNtn = String(c?.ntn || c?.NTN || c?.clientNTN || c?.ClientNTN || '');
                    const isHighlighted = highlightedClientIndex === i;
                    return (
                      <button
                        key={c?.id || i}
                        ref={(el) => { if (isHighlighted && el) el.scrollIntoView({ block: 'nearest' }); }}
                        type="button"
                        onClick={() => handleSelectClient(c)}
                        onMouseEnter={() => setHighlightedClientIndex(i)}
                        className={`w-full text-left px-4 py-2.5 transition flex items-center justify-between gap-3 ${isHighlighted ? 'bg-navy-50' : 'hover:bg-paper'}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-ink-900 truncate">{cName}</div>
                          {cAddress && <div className="text-xs text-ink-400 truncate">{cAddress}</div>}
                        </div>
                        {cNtn && <span className="corp-chip bg-paper text-ink-500 border border-line font-mono shrink-0">NTN {cNtn}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <label className="corp-label">Client NTN</label>
              <input
                type="text"
                value={clientNTN}
                onChange={(e) => setClientNTN(e.target.value)}
                placeholder="e.g. 9010203-4"
                className="corp-input font-mono"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="corp-label">Client address</label>
              <input
                type="text"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                placeholder="e.g. 24-Cooper Road, Lahore"
                className="corp-input"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="corp-label">PO / reference</label>
              <input
                type="text"
                value={refText}
                onChange={(e) => setRefText(e.target.value)}
                placeholder="e.g. PO #187365 dated 06-Oct-2026 — Supply of lab consumables"
                className="corp-input"
              />
            </div>
          </div>
        </section>

        {/* Line items */}
        <section ref={catalogContainerRef} className="corp-card p-4 sm:p-6 mb-4">
          <div className="mb-4">
            <h2 className="text-[15px] font-extrabold text-ink-900">Line Items <span className="text-ink-400 font-bold">({items.length})</span></h2>
            <p className="text-xs text-ink-400 mt-0.5">Description, unit, quantity and rate are mandatory for every row</p>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => {
              const isCatalogOpen = activeCatalogRowIndex === index;
              const itemDescLower = String(item.description || '').toLowerCase();
              const matchingCatalog = catalog.filter((c) => {
                const catDescLower = String(c?.description || '').toLowerCase();
                return itemDescLower ? catDescLower.includes(itemDescLower) : true;
              }).slice(0, 6);

              return (
                <div key={item.id || index} className="rounded-xl border border-line bg-paper/60 hover:border-navy-200 transition relative">
                  <div className="flex items-start gap-2.5 p-3 sm:p-4 pb-2">
                    <span className="w-7 h-7 rounded-lg bg-navy-900 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-6">
                      {index + 1}
                    </span>
                    <div className="flex-1 relative min-w-0">
                      <label className="corp-label">Description <span className="text-[#b3372f]">*</span></label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => { handleItemChange(index, 'description', e.target.value); setActiveCatalogRowIndex(index); }}
                        onFocus={() => setActiveCatalogRowIndex(index)}
                        onKeyDown={(e) => {
                          if (isCatalogOpen && matchingCatalog.length > 0) {
                            if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedCatalogIndex((prev) => (prev + 1) % matchingCatalog.length); }
                            else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedCatalogIndex((prev) => (prev - 1 + matchingCatalog.length) % matchingCatalog.length); }
                            else if (e.key === 'Enter') { e.preventDefault(); const selected = matchingCatalog[highlightedCatalogIndex] || matchingCatalog[0]; if (selected) handleSelectCatalogItem(index, selected); }
                            else if (e.key === 'Escape') { e.preventDefault(); setActiveCatalogRowIndex(null); }
                          }
                        }}
                        placeholder="Enter item description…"
                        className={`corp-input font-semibold ${attemptedSubmit && !String(item.description || '').trim() ? '!border-[#b3372f] !ring-2 !ring-red-100' : ''}`}
                      />
                      {isCatalogOpen && matchingCatalog.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-line rounded-xl shadow-[0_16px_40px_-8px_rgba(12,28,51,0.3)] z-50 max-h-52 overflow-y-auto divide-y divide-line">
                          {matchingCatalog.map((cat, ci) => {
                            const isHighlighted = highlightedCatalogIndex === ci;
                            return (
                              <button
                                key={ci}
                                type="button"
                                onClick={() => handleSelectCatalogItem(index, cat)}
                                onMouseEnter={() => setHighlightedCatalogIndex(ci)}
                                className={`w-full text-left px-3.5 py-2.5 transition flex items-center justify-between gap-3 ${isHighlighted ? 'bg-navy-50' : 'hover:bg-paper'}`}
                              >
                                <div className="min-w-0">
                                  <div className="text-[13px] font-bold text-ink-900 truncate">{cat.description}</div>
                                  <div className="text-[11px] text-ink-400">{cat.unit} · {cat.tax === 'GST' ? 'Goods (GST)' : cat.tax === 'PST' ? 'Service (PST)' : 'No tax'}</div>
                                </div>
                                <span className="text-xs font-mono font-bold text-ink-900 shrink-0">Rs. {formatCurrency(cat.rate)}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItemRow(index)}
                      className="p-2 mt-6 text-ink-400 hover:text-[#b3372f] rounded-xl hover:bg-red-50 transition shrink-0"
                      title="Remove row"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-12 gap-2.5 px-3 sm:px-4 pb-3 sm:pb-4 items-end">
                    <div className="col-span-1 sm:col-span-2">
                      <label className="corp-label">Unit <span className="text-[#b3372f]">*</span></label>
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                        placeholder="Nos"
                        className={`corp-input !px-2.5 !py-2 text-xs ${attemptedSubmit && !String(item.unit || '').trim() ? '!border-[#b3372f]' : ''}`}
                      />
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                      <label className="corp-label">Qty <span className="text-[#b3372f]">*</span></label>
                      <input
                        type="number" inputMode="decimal" step="any"
                        value={item.qty === 0 ? '' : item.qty}
                        onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                        placeholder="1"
                        className={`corp-input !px-2.5 !py-2 text-xs font-mono font-bold ${attemptedSubmit && !(Number(item.qty) > 0) ? '!border-[#b3372f]' : ''}`}
                      />
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                      <label className="corp-label">Rate (Rs) <span className="text-[#b3372f]">*</span></label>
                      <input
                        type="number" inputMode="decimal" step="any"
                        value={item.rate === 0 ? '' : item.rate}
                        onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                        placeholder="0.00"
                        className={`corp-input !px-2.5 !py-2 text-xs font-mono font-bold ${attemptedSubmit && !(Number(item.rate) > 0) ? '!border-[#b3372f]' : ''}`}
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-4">
                      {(() => {
                        const itemGstRateNum = (item.gstRate !== undefined && item.gstRate !== null && !isNaN(Number(item.gstRate)))
                          ? Number(item.gstRate) : gstRateDecimal;
                        const itemGstPct = Math.round(itemGstRateNum * 100);
                        const isPreset = [18, 10, 17, 15, 12, 5, 0].includes(itemGstPct);
                        return (
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="corp-label !mb-0">Tax type</label>
                              {item.tax === 'GST' && (
                                <span className="corp-chip bg-navy-50 text-navy-800 border border-navy-100 font-mono">GST {itemGstPct}%</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <select
                                value={item.tax}
                                onChange={(e) => {
                                  const newTax = e.target.value as TaxType;
                                  handleItemChange(index, 'tax', newTax);
                                  if (newTax === 'GST' && (item.gstRate === undefined || item.gstRate === null)) {
                                    handleItemChange(index, 'gstRate', gstRateDecimal);
                                  }
                                }}
                                className="corp-input !px-2.5 !py-2 text-xs font-bold cursor-pointer flex-1 min-w-0"
                              >
                                <option value="GST">Goods · GST</option>
                                <option value="PST">Service · PST 16%</option>
                                <option value="None">No tax</option>
                              </select>
                              {item.tax === 'GST' && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <select
                                    value={isPreset ? String(itemGstPct) : 'custom'}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === 'custom') handleItemChange(index, 'gstRate', isPreset ? 0.08 : itemGstRateNum);
                                      else handleItemChange(index, 'gstRate', Number(val) / 100);
                                    }}
                                    className="corp-input !px-2 !py-2 text-xs font-bold cursor-pointer !w-auto"
                                    title="GST rate for this item"
                                  >
                                    <option value="18">18%</option>
                                    <option value="10">10%</option>
                                    <option value="17">17%</option>
                                    <option value="15">15%</option>
                                    <option value="12">12%</option>
                                    <option value="5">5%</option>
                                    <option value="0">0%</option>
                                    <option value="custom">Custom</option>
                                  </select>
                                  {!isPreset && (
                                    <span className="flex items-center">
                                      <input
                                        type="number" min="0" max="100" step="0.5"
                                        value={itemGstPct}
                                        onChange={(e) => { const val = Math.max(0, Math.min(100, Number(e.target.value) || 0)); handleItemChange(index, 'gstRate', val / 100); }}
                                        className="corp-input !w-14 !px-1 !py-2 text-xs font-mono font-bold text-center"
                                      />
                                      <span className="text-[10px] font-bold text-ink-500 ml-0.5">%</span>
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="col-span-1 sm:col-span-2 text-right">
                      <label className="corp-label">Amount</label>
                      <div className="text-[15px] font-extrabold font-mono text-ink-900 py-2">Rs. {formatCurrency(item.amount)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={addItemRow}
            className="mt-3 w-full py-3 rounded-xl border-2 border-dashed border-navy-200 text-navy-700 text-sm font-bold flex items-center justify-center gap-2 hover:border-gold-500 hover:text-navy-900 hover:bg-gold-100/40 active:scale-[0.995] transition"
          >
            <Plus className="w-4 h-4" /><span>Add Row</span>
          </button>
        </section>

        {/* Tax summary */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-ink-700">Tax Summary &amp; Totals</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-3.5">
            {/* GST card */}
            <div className="corp-card p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-navy-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-navy-700" />
                  Federal GST · Goods ({gstPercent}%)
                </span>
                <button
                  type="button"
                  onClick={() => handleApplyGstRateToAllGoods(gstRateDecimal)}
                  className="text-[11px] font-bold text-navy-700 hover:text-navy-900 hover:underline"
                  title="Apply this rate to all goods rows"
                >
                  Apply {gstPercent}% to all goods
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mb-4">
                {[18, 10, 17, 15, 12, 5, 0].map((rate) => {
                  const isSelected = !isCustomGstInput && gstPercent === rate;
                  return (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => { setIsCustomGstInput(false); setGstRatePercent(rate); }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${isSelected ? 'bg-navy-900 text-white shadow-sm' : 'bg-paper border border-line text-ink-700 hover:border-navy-200'}`}
                    >
                      {rate === 18 ? '18% Std' : rate === 10 ? '10% Red' : `${rate}%`}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setIsCustomGstInput(true)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${isCustomGstInput ? 'bg-navy-900 text-white shadow-sm' : 'bg-paper border border-line text-ink-700 hover:border-navy-200'}`}
                >
                  Custom
                </button>
                {isCustomGstInput && (
                  <span className="flex items-center gap-1">
                    <input
                      type="number" min="0" max="100" step="0.5"
                      value={gstRatePercent}
                      onChange={(e) => setGstRatePercent(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                      className="corp-input !w-16 !px-2 !py-1.5 text-xs font-mono font-bold text-center"
                      autoFocus
                    />
                    <span className="text-xs font-bold text-ink-500">%</span>
                  </span>
                )}
              </div>
              <div className="space-y-1.5 text-[13px] pt-3 border-t border-line">
                <div className="flex justify-between text-ink-500">
                  <span>Goods subtotal (excl. tax)</span>
                  <span className="font-mono font-bold text-ink-900">Rs. {formatCurrency(totals.goodsSub)}</span>
                </div>
                {totals.gstBreakdown && totals.gstBreakdown.length > 1 && (
                  <div className="bg-paper rounded-xl p-2.5 border border-line space-y-1">
                    <div className="text-[10px] font-bold text-ink-500 uppercase tracking-wide">Multi-rate breakdown</div>
                    {totals.gstBreakdown.map((b) => (
                      <div key={b.ratePercent} className="flex justify-between text-[11px] text-ink-700">
                        <span><strong className="text-navy-800">{b.ratePercent}%</strong> on Rs. {formatCurrency(b.taxableAmount)}</span>
                        <span className="font-mono font-bold">Rs. {formatCurrency(b.taxAmount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between font-bold text-[15px] text-navy-900 pt-1">
                  <span>Total GST</span>
                  <span className="font-mono">Rs. {formatCurrency(totals.gst)}</span>
                </div>
              </div>
            </div>

            {/* PST card */}
            <div className="corp-card p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                  Punjab PST · Services (16%)
                </span>
                <span className="corp-chip bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <Lock className="w-3 h-3" /> Statutory fixed
                </span>
              </div>
              <p className="text-[11px] text-ink-400 mb-4">16% fixed under Punjab Sales Tax on Services Act — applied automatically to service rows.</p>
              <div className="space-y-1.5 text-[13px] pt-3 border-t border-line">
                <div className="flex justify-between text-ink-500">
                  <span>Services subtotal</span>
                  <span className="font-mono font-bold text-ink-900">Rs. {formatCurrency(totals.serviceSub)}</span>
                </div>
                <div className="flex justify-between font-bold text-[15px] text-emerald-900 pt-1">
                  <span>PST payable (16%)</span>
                  <span className="font-mono">Rs. {formatCurrency(totals.pst)}</span>
                </div>
              </div>
            </div>
          </div>

          {totals.otherSub > 0 && (
            <div className="corp-card px-4 py-3 mb-3.5 flex justify-between items-center text-[13px]">
              <span className="font-bold text-ink-500">Non-taxed items</span>
              <span className="font-mono font-bold text-ink-900">Rs. {formatCurrency(totals.otherSub)}</span>
            </div>
          )}

          {/* Grand total */}
          <div className="rounded-2xl bg-navy-950 text-white p-4 sm:p-5 shadow-[0_12px_32px_-12px_rgba(12,28,51,0.6)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-navy-200 block">Total payable</span>
              <div className="text-[28px] sm:text-[32px] font-extrabold font-mono text-gold-400 mt-0.5 leading-none">
                Rs. {formatCurrency(totals.grandTotal)}
              </div>
            </div>
            <div className="text-xs text-navy-200 sm:text-right">
              <span className="block font-medium">
                GST {totals.gstBreakdown && totals.gstBreakdown.length > 1 ? totals.gstBreakdown.map((b) => `${b.ratePercent}%`).join(' + ') : `${gstPercent}%`} · PST 16%
              </span>
              <span className="text-[11px] text-navy-200/70 font-mono">{items.length} line item{items.length === 1 ? '' : 's'}</span>
            </div>
          </div>
        </section>
      </main>

      {/* Mobile sticky bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-line px-4 py-3 z-40 flex items-center justify-between gap-3 no-print">
        <div>
          <span className="corp-label !mb-0.5">Total</span>
          <span className="text-[17px] font-extrabold font-mono text-navy-900">Rs. {formatCurrency(totals.grandTotal)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" disabled={isSaving} onClick={() => handleSubmit(false)} className="corp-btn-ghost !py-2.5 text-xs">Save</button>
          <button type="button" disabled={isSaving} onClick={() => handleSubmit(true)} className="corp-btn-primary !py-2.5 text-xs">
            {isSaving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            <span>Preview</span>
          </button>
        </div>
      </div>
    </div>
  );
};
