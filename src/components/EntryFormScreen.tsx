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

interface Props {
  initialDoc?: Partial<DocumentRecord> | null;
  docType: DocType;
  settings: SupplierSettings;
  clients: SavedClient[];
  catalog: CatalogItem[];
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
    // Prefer the authoritative top-level counters for the active firm (the backend
    // keeps these current via updateSequenceCounter), so the form never prefills
    // a stale, duplicated number.
    if (f && f.id === settings.activeFirmId) {
      return {
        ...f,
        nextBillNo: settings.nextBillNo || (f as any).nextBillNo || '101',
        nextQuoteNo: settings.nextQuoteNo || (f as any).nextQuoteNo || 'Q-201',
      };
    }
    return f;
  }, [firms, selectedFirmId, settings.activeFirmId, settings.nextBillNo, settings.nextQuoteNo]);

  // Form states
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
    <div className="min-h-screen bg-[#F4F6F9] flex flex-col justify-between pb-32 sm:pb-12">
      {/* Top Navigation: Executive Navy & Gold Corporate Header */}
      <header className="bg-gradient-to-r from-[#0B1E36] via-[#103158] to-[#0B1E36] text-white border-b border-blue-900/80 sticky top-0 z-30 shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/40 uppercase tracking-wider"
                >
                  {docType}
                </span>
                <h1 className="text-lg font-black text-white tracking-wide">
                  {initialDoc?.docId || initialDoc?.DocID ? 'Edit' : 'New'}{' '}
                  {docType === 'BILL' ? 'Supplier Bill' : 'Quotation'}
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSubmit(false)}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-sm border border-white/25 transition cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-blue-200" />
              <span>Save</span>
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSubmit(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-sm shadow-md transition cursor-pointer disabled:opacity-50 active:scale-95"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Printer className="w-4 h-4 text-slate-950" />
              )}
              <span>Save &amp; Preview</span>
            </button>
          </div>
        </div>
      </header>

      {/* Form Container */}
      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6 w-full flex-1">
        {/* Error message banner */}
        {formError && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold flex items-center justify-between">
            <span>{formError}</span>
            <button
              type="button"
              onClick={() => setFormError('')}
              className="text-rose-500 hover:text-rose-800 font-black px-1.5 cursor-pointer"
            >
              ×
            </button>
          </div>
        )}

        {/* Document Header Fields Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-6 mb-4">
          {/* Supplier Firm Switcher */}
          <div className="mb-4 pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider block">
                Billing Firm / Enterprise Entity
              </span>
              <span className="text-xs text-slate-500">
                Owner: <strong>{settings.ownerName || 'MIAN FARHAN ANWAR'}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-[#1F3A5F]" />
              <select
                value={selectedFirmId}
                onChange={(e) => {
                  setSelectedFirmId(e.target.value);
                  const selected = firms.find((f) => f.id === e.target.value);
                  if (selected && (!initialDoc?.docNo && !initialDoc?.DocNo)) {
                    setDocNo(docType === 'BILL' ? selected.nextBillNo : selected.nextQuoteNo);
                  }
                }}
                className="px-3 py-1.5 text-xs font-bold bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#1F3A5F] focus:outline-none text-slate-800 cursor-pointer"
              >
                {firms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.ntn ? `NTN: ${f.ntn}` : 'Govt Contractor'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            {/* Doc Number */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                {docType === 'BILL' ? 'Bill No.' : 'Quotation No.'}
              </label>
              <input
                type="text"
                value={docNo}
                onChange={(e) => setDocNo(e.target.value)}
                placeholder="Auto-numbered"
                className="w-full px-3 py-2 text-base font-bold font-mono bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#1F3A5F] focus:outline-none"
              />
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Pre-filled with next number, editable
              </span>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#1F3A5F] focus:outline-none"
                />
              </div>
            </div>

            {/* Valid Until (Quotation only) */}
            {docType === 'QUOTATION' ? (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Valid Until
                </label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#1F3A5F] focus:outline-none"
                />
              </div>
            ) : (
              <div className="hidden sm:block">
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-900">
                  <span className="font-bold block mb-0.5">Official PO Bill</span>
                  Line items split automatically into Goods (GST) and Services (PST).
                </div>
              </div>
            )}
          </div>

          {/* Client Details Section */}
          <div className="border-t border-slate-100 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Client Name with Typeahead (Robust Outside-Click, No Invisible Overlay) */}
            <div ref={clientDropdownRef} className="sm:col-span-2 relative">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Client Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => {
                    setClientName(e.target.value);
                    setShowClientDropdown(true);
                  }}
                  onFocus={() => setShowClientDropdown(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      if (!showClientDropdown) {
                        setShowClientDropdown(true);
                        setHighlightedClientIndex(0);
                      } else if (filteredClients.length > 0) {
                        setHighlightedClientIndex((prev) => (prev + 1) % filteredClients.length);
                      }
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      if (!showClientDropdown) {
                        setShowClientDropdown(true);
                        setHighlightedClientIndex(Math.max(0, filteredClients.length - 1));
                      } else if (filteredClients.length > 0) {
                        setHighlightedClientIndex((prev) => (prev - 1 + filteredClients.length) % filteredClients.length);
                      }
                    } else if (e.key === 'Enter') {
                      if (showClientDropdown && filteredClients.length > 0) {
                        e.preventDefault();
                        const targetClient = filteredClients[highlightedClientIndex] || filteredClients[0];
                        if (targetClient) {
                          handleSelectClient(targetClient);
                        }
                      }
                    } else if (e.key === 'Escape') {
                      if (showClientDropdown) {
                        e.preventDefault();
                        setShowClientDropdown(false);
                      }
                    }
                  }}
                  placeholder="e.g. Director General Health Services Punjab"
                  className="w-full px-3.5 py-2.5 text-base font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#1F3A5F] focus:outline-none"
                />
                {clients && clients.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowClientDropdown((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                    aria-label="Toggle client dropdown"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Type-ahead Dropdown List with Keyboard Navigation */}
              {showClientDropdown && filteredClients.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-100">
                  {filteredClients.map((c: any, i) => {
                    const cName = String(c?.name || c?.Name || c?.clientName || c?.ClientName || (typeof c === 'string' ? c : 'Unnamed Client'));
                    const cAddress = String(c?.address || c?.Address || c?.clientAddress || c?.ClientAddress || '');
                    const cNtn = String(c?.ntn || c?.NTN || c?.clientNTN || c?.ClientNTN || '');
                    const isHighlighted = highlightedClientIndex === i;

                    return (
                      <button
                        key={c?.id || i}
                        ref={(el) => {
                          if (isHighlighted && el) {
                            el.scrollIntoView({ block: 'nearest' });
                          }
                        }}
                        type="button"
                        onClick={() => handleSelectClient(c)}
                        onMouseEnter={() => setHighlightedClientIndex(i)}
                        className={`w-full text-left px-4 py-2.5 transition cursor-pointer flex items-center justify-between group ${
                          isHighlighted
                            ? 'bg-blue-100/90 text-[#0F2544] border-l-4 border-l-[#0F2544]'
                            : 'hover:bg-blue-50/80 text-slate-800'
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className={`text-sm font-bold truncate ${isHighlighted ? 'text-[#0F2544]' : 'text-slate-800'}`}>
                            {cName}
                          </div>
                          {cAddress && (
                            <div className="text-xs text-slate-500 truncate">{cAddress}</div>
                          )}
                        </div>
                        {cNtn && (
                          <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded shrink-0 ${
                            isHighlighted ? 'bg-blue-200 text-blue-900' : 'bg-slate-100 text-slate-600'
                          }`}>
                            NTN: {cNtn}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Client NTN */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Client NTN #
              </label>
              <input
                type="text"
                value={clientNTN}
                onChange={(e) => setClientNTN(e.target.value)}
                placeholder="e.g. 9010203-4"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#1F3A5F] focus:outline-none font-mono"
              />
            </div>

            {/* Client Address */}
            <div className="sm:col-span-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Client Address
              </label>
              <input
                type="text"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                placeholder="e.g. 24-Cooper Road, Lahore"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#1F3A5F] focus:outline-none"
              />
            </div>

            {/* PO / Reference Text */}
            <div className="sm:col-span-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                PO / Reference
              </label>
              <input
                type="text"
                value={refText}
                onChange={(e) => setRefText(e.target.value)}
                placeholder="e.g. PO # Petty-187365 dated 06-Oct-2026 - Supply of Official Vehicles parts repair and maintenance"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#1F3A5F] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Line Items Table Card */}
        <div ref={catalogContainerRef} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Bill Items ({items.length})
              </h2>
              <p className="text-xs text-slate-500">
                All item fields (Description, Unit, Quantity, Rate) are strictly mandatory
              </p>
            </div>
          </div>

          {/* Table Container */}
          <div className="space-y-3">
            {items.map((item, index) => {
              const isCatalogOpen = activeCatalogRowIndex === index;

              // Filter catalog suggestions safely
              const itemDescLower = String(item.description || '').toLowerCase();
              const matchingCatalog = catalog.filter((c) => {
                const catDescLower = String(c?.description || '').toLowerCase();
                return itemDescLower ? catDescLower.includes(itemDescLower) : true;
              }).slice(0, 6);

              return (
                <div
                  key={item.id || index}
                  className="p-3 sm:p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:border-slate-300 transition relative"
                >
                  <div className="flex items-start gap-2">
                    {/* Sr badge */}
                    <span className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 mt-5">
                      {index + 1}
                    </span>

                    {/* Description field with suggestions */}
                    <div className="flex-1 relative">
                      <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                        Description <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => {
                          handleItemChange(index, 'description', e.target.value);
                          setActiveCatalogRowIndex(index);
                        }}
                        onFocus={() => setActiveCatalogRowIndex(index)}
                        onKeyDown={(e) => {
                          if (isCatalogOpen && matchingCatalog.length > 0) {
                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              setHighlightedCatalogIndex((prev) => (prev + 1) % matchingCatalog.length);
                            } else if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              setHighlightedCatalogIndex((prev) => (prev - 1 + matchingCatalog.length) % matchingCatalog.length);
                            } else if (e.key === 'Enter') {
                              e.preventDefault();
                              const selected = matchingCatalog[highlightedCatalogIndex] || matchingCatalog[0];
                              if (selected) {
                                handleSelectCatalogItem(index, selected);
                              }
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              setActiveCatalogRowIndex(null);
                            }
                          }
                        }}
                        placeholder="Enter item description..."
                        className={`w-full px-3 py-2 text-sm font-semibold bg-white rounded-lg focus:ring-2 focus:ring-[#1F3A5F] focus:outline-none transition ${
                          attemptedSubmit && !String(item.description || '').trim()
                            ? 'border-2 border-rose-400 bg-rose-50/20 ring-1 ring-rose-300'
                            : 'border border-slate-300'
                        }`}
                      />

                      {/* Catalog Suggestions Dropdown */}
                      {isCatalogOpen && matchingCatalog.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-100">
                          {matchingCatalog.map((cat, ci) => {
                            const isHighlighted = highlightedCatalogIndex === ci;
                            return (
                              <button
                                key={ci}
                                type="button"
                                onClick={() => handleSelectCatalogItem(index, cat)}
                                onMouseEnter={() => setHighlightedCatalogIndex(ci)}
                                className={`w-full text-left px-3 py-2 transition cursor-pointer flex items-center justify-between ${
                                  isHighlighted ? 'bg-blue-100/90 text-blue-900 border-l-4 border-l-[#0F2544]' : 'hover:bg-slate-50'
                                }`}
                              >
                                <div>
                                  <div className={`text-xs font-bold ${isHighlighted ? 'text-[#0F2544]' : 'text-slate-800'}`}>
                                    {cat.description}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {cat.unit} · {cat.tax === 'GST' ? 'Goods (GST)' : cat.tax === 'PST' ? 'Service (PST)' : 'No Tax'}
                                  </div>
                                </div>
                                <span className={`text-xs font-mono font-bold ${isHighlighted ? 'text-blue-900' : 'text-slate-700'}`}>
                                  Rs. {formatCurrency(cat.rate)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Action: Delete line item */}
                    <div className="shrink-0 pt-5">
                      <button
                        type="button"
                        onClick={() => removeItemRow(index)}
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                        title="Delete this line item"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Second row of item: Unit, Qty, Rate, Tax & GST Rate, Amount */}
                  <div className="grid grid-cols-2 sm:grid-cols-12 gap-2 mt-2 pt-2 border-t border-slate-200/60 items-center">
                    {/* Unit */}
                    <div className="col-span-1 sm:col-span-2">
                      <label className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">
                        Unit <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                        placeholder="Nos/Job/Set"
                        className={`w-full px-2 py-1.5 text-xs font-medium bg-white rounded-lg focus:outline-none transition ${
                          attemptedSubmit && !String(item.unit || '').trim()
                            ? 'border-2 border-rose-400 bg-rose-50/20'
                            : 'border border-slate-300'
                        }`}
                      />
                    </div>

                    {/* Qty */}
                    <div className="col-span-1 sm:col-span-2">
                      <label className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">
                        Qty <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={item.qty === 0 ? '' : item.qty}
                        onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                        placeholder="1"
                        className={`w-full px-2 py-1.5 text-xs font-bold font-mono bg-white rounded-lg focus:outline-none transition ${
                          attemptedSubmit && !(Number(item.qty) > 0)
                            ? 'border-2 border-rose-400 bg-rose-50/20'
                            : 'border border-slate-300'
                        }`}
                      />
                    </div>

                    {/* Rate */}
                    <div className="col-span-1 sm:col-span-2">
                      <label className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">
                        Rate (PKR) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={item.rate === 0 ? '' : item.rate}
                        onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                        placeholder="0.00"
                        className={`w-full px-2 py-1.5 text-xs font-bold font-mono bg-white rounded-lg focus:outline-none transition ${
                          attemptedSubmit && !(Number(item.rate) > 0)
                            ? 'border-2 border-rose-400 bg-rose-50/20'
                            : 'border border-slate-300'
                        }`}
                      />
                    </div>

                    {/* Tax Selector & Per-Item GST Rate */}
                    <div className="col-span-2 sm:col-span-4">
                      {(() => {
                        const itemGstRateNum = (item.gstRate !== undefined && item.gstRate !== null && !isNaN(Number(item.gstRate)))
                          ? Number(item.gstRate)
                          : gstRateDecimal;
                        const itemGstPct = Math.round(itemGstRateNum * 100);
                        const isPreset = [18, 10, 17, 15, 12, 5, 0].includes(itemGstPct);

                        return (
                          <div>
                            <div className="flex items-center justify-between mb-0.5">
                              <label className="text-[10px] font-bold uppercase text-slate-500 block">
                                Tax &amp; Rate
                              </label>
                              {item.tax === 'GST' && (
                                <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200/60">
                                  GST @ {itemGstPct}%
                                </span>
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
                                className="flex-1 min-w-0 px-2 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:outline-none cursor-pointer"
                              >
                                <option value="GST">Goods (GST)</option>
                                <option value="PST">Services (PST 16%)</option>
                                <option value="None">No Tax (0%)</option>
                              </select>

                              {item.tax === 'GST' && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <select
                                    value={isPreset ? String(itemGstPct) : 'custom'}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === 'custom') {
                                        handleItemChange(index, 'gstRate', isPreset ? 0.08 : itemGstRateNum);
                                      } else {
                                        handleItemChange(index, 'gstRate', Number(val) / 100);
                                      }
                                    }}
                                    className="px-2 py-1.5 text-xs font-bold bg-blue-50/80 border border-blue-300 text-blue-900 rounded-lg focus:outline-none cursor-pointer"
                                    title="Set GST Rate for this item"
                                  >
                                    <option value="18">18% (Std)</option>
                                    <option value="10">10% (Reduced)</option>
                                    <option value="17">17%</option>
                                    <option value="15">15%</option>
                                    <option value="12">12%</option>
                                    <option value="5">5%</option>
                                    <option value="0">0% (Zero)</option>
                                    <option value="custom">Custom</option>
                                  </select>

                                  {!isPreset && (
                                    <div className="flex items-center">
                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.5"
                                        value={itemGstPct}
                                        onChange={(e) => {
                                          const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                                          handleItemChange(index, 'gstRate', val / 100);
                                        }}
                                        className="w-14 px-1 py-1 text-xs font-bold font-mono border border-blue-400 rounded-lg bg-white text-blue-950 focus:outline-none text-center"
                                        placeholder="%"
                                      />
                                      <span className="text-[10px] font-bold text-blue-900 ml-0.5">%</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Amount (Auto calculated) */}
                    <div className="col-span-1 sm:col-span-2 text-right">
                      <label className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">
                        Amount
                      </label>
                      <div className="text-sm font-black font-mono text-slate-900 py-1">
                        Rs. {formatCurrency(item.amount)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Single clean Add Item Row Action */}
          <div className="flex justify-start pt-3 border-t border-slate-100 mt-3">
            <button
              type="button"
              onClick={addItemRow}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F2544] hover:bg-[#1E3A8A] text-white font-bold text-xs shadow-sm hover:shadow-md transition cursor-pointer"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Add Item Row</span>
            </button>
          </div>
        </div>

        {/* Separated GST & PST Summary Cards Display */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-700">
              Tax Summary &amp; Totals
            </h3>
            <span className="text-xs font-bold text-slate-500">
              Separated GST &amp; PST Totals
            </span>
          </div>

          {/* Separated Tax Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-3.5">
            {/* Card 1: Federal GST Summary (Goods) with Custom Rate Controls */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/70 to-indigo-50/40 border border-blue-200/80 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                  Federal GST on Goods ({gstPercent}%)
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-200/80 text-blue-900">
                  Customizable Per Item &amp; Bill
                </span>
              </div>

              {/* GST Rate Selector Pill Buttons & Custom Input */}
              <div className="mb-3 pt-1">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Default Bill GST Rate:
                  </label>
                  <button
                    type="button"
                    onClick={() => handleApplyGstRateToAllGoods(gstRateDecimal)}
                    className="text-[10px] font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer"
                    title="Apply this rate to all existing goods items"
                  >
                    Apply {gstPercent}% to All Goods Rows
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[18, 10, 17, 15, 12, 5, 0].map((rate) => {
                    const isSelected = !isCustomGstInput && gstPercent === rate;
                    return (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => {
                          setIsCustomGstInput(false);
                          setGstRatePercent(rate);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          isSelected
                            ? 'bg-blue-800 text-white shadow-2xs ring-1 ring-blue-900'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-blue-50'
                        }`}
                      >
                        {rate === 18 ? '18% (Std)' : rate === 10 ? '10% (Reduced)' : `${rate}%`}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setIsCustomGstInput(true)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      isCustomGstInput
                        ? 'bg-blue-800 text-white shadow-2xs ring-1 ring-blue-900'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-blue-50'
                    }`}
                  >
                    Custom
                  </button>

                  {isCustomGstInput && (
                    <div className="flex items-center gap-1 ml-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={gstRatePercent}
                        onChange={(e) => setGstRatePercent(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                        className="w-16 px-2 py-1 text-xs font-bold font-mono bg-white border-2 border-blue-600 rounded-lg focus:outline-none text-blue-900 text-center"
                        placeholder="%"
                        autoFocus
                      />
                      <span className="text-xs font-bold text-slate-600">%</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 text-xs pt-2 border-t border-blue-200/50">
                <div className="flex justify-between text-slate-600">
                  <span>Goods Subtotal (Excl. Tax):</span>
                  <span className="font-mono font-bold text-slate-900">Rs. {formatCurrency(totals.goodsSub)}</span>
                </div>

                {/* If mixed GST rates exist (e.g. some 10%, some 18%), display breakdown */}
                {totals.gstBreakdown && totals.gstBreakdown.length > 1 ? (
                  <div className="bg-white/80 rounded-xl p-2.5 border border-blue-200 space-y-1 my-1">
                    <div className="text-[10px] font-bold text-blue-900 uppercase tracking-wide">
                      Multi-Rate GST Breakdown:
                    </div>
                    {totals.gstBreakdown.map((b) => (
                      <div key={b.ratePercent} className="flex justify-between text-[11px] text-slate-700">
                        <span>
                          <strong className="text-blue-900">{b.ratePercent}% GST</strong> on Rs. {formatCurrency(b.taxableAmount)}:
                        </span>
                        <span className="font-mono font-bold text-blue-950">Rs. {formatCurrency(b.taxAmount)}</span>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="flex justify-between text-blue-950 font-bold text-sm pt-0.5">
                  <span>Total Federal GST:</span>
                  <span className="font-mono text-blue-800">Rs. {formatCurrency(totals.gst)}</span>
                </div>
              </div>
            </div>

            {/* Card 2: Punjab PST Summary (Services - Legally Fixed 16%) */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/70 to-teal-50/40 border border-emerald-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                  Punjab PST on Services (16%)
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-200/80 text-emerald-900 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  <span>Fixed 16% (PRA)</span>
                </span>
              </div>

              <div className="mb-3 pt-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Statutory Tax Rate:
                </label>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100/70 border border-emerald-300 text-emerald-900 text-xs font-bold">
                  <Lock className="w-3 h-3 text-emerald-700" />
                  <span>16% (Fixed statutory rate under Punjab Sales Tax on Services)</span>
                </div>
              </div>

              <div className="space-y-1.5 text-xs pt-2 border-t border-emerald-200/50">
                <div className="flex justify-between text-slate-600">
                  <span>Services Subtotal:</span>
                  <span className="font-mono font-bold text-slate-900">Rs. {formatCurrency(totals.serviceSub)}</span>
                </div>
                <div className="flex justify-between text-emerald-950 font-bold text-sm">
                  <span>PST Payable (16%):</span>
                  <span className="font-mono text-emerald-800">Rs. {formatCurrency(totals.pst)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Non-tax / Other subtotal if present */}
          {totals.otherSub > 0 && (
            <div className="p-3 mb-3.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center text-xs">
              <span className="font-bold text-slate-600">Other Non-Taxed Items:</span>
              <span className="font-mono font-bold text-slate-900">Rs. {formatCurrency(totals.otherSub)}</span>
            </div>
          )}

          {/* Grand Total Executive Card (Clean, NO unnecessary Add Row button) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-[#0F2544] to-slate-900 text-white border border-slate-800 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                Total Bill Payable
              </span>
              <div className="text-2xl sm:text-3xl font-black font-mono text-amber-300 mt-0.5">
                Rs. {formatCurrency(totals.grandTotal)}
              </div>
            </div>
            <div className="text-xs text-slate-300 sm:text-right">
              <span className="block font-medium">
                Includes Goods GST ({totals.gstBreakdown && totals.gstBreakdown.length > 1 ? totals.gstBreakdown.map((b) => `${b.ratePercent}%`).join(', ') : `${gstPercent}%`}) &amp; Punjab PST (16%)
              </span>
              <span className="text-[11px] text-slate-400 font-mono">Total {items.length} line {items.length === 1 ? 'item' : 'items'} in bill</span>
            </div>
          </div>
        </div>
      </main>

      {/* Sticky Mobile Bottom Bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 shadow-lg z-40 flex items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold uppercase text-slate-500 block">Total</span>
          <span className="text-base font-black font-mono text-[#1F3A5F]">
            Rs. {formatCurrency(totals.grandTotal)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSubmit(false)}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 cursor-pointer"
          >
            Save
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSubmit(true)}
            className="px-4 py-2 rounded-xl bg-[#1F3A5F] text-white text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer"
          >
            {isSaving && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            <span>Preview &amp; Print</span>
          </button>
        </div>
      </div>
    </div>
  );
};
