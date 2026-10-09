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
    return firms.find((f) => f.id === selectedFirmId) || firms[0];
  }, [firms, selectedFirmId]);

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

  // Live Totals calculation using selected firm's tax rates
  const totals = useMemo(() => {
    return calculateTotals(items, activeFirm.gstRate || 0.18, activeFirm.pstRate || 0.16);
  }, [items, activeFirm.gstRate, activeFirm.pstRate]);

  const gstPercent = Math.round((activeFirm.gstRate || 0.18) * 100);
  const pstPercent = Math.round((activeFirm.pstRate || 0.16) * 100);

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
        amount: 0,
      },
    ]);
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
    const trimmedClient = clientName.trim();
    if (!trimmedClient) {
      setFormError('Client Name is required. Please type or select a client.');
      return;
    }

    const validItems = items.filter(
      (i) => String(i.description).trim() && Number(i.qty) > 0
    );
    if (validItems.length === 0) {
      setFormError('Please add at least one line item with a description and quantity greater than 0.');
      return;
    }

    const liveTotals = calculateTotals(validItems, activeFirm.gstRate || 0.18, activeFirm.pstRate || 0.16);

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
      items: validItems.map((it, idx) => {
        const q = Number(it.qty) || 0;
        const r = Number(it.rate) || 0;
        const a = Math.round(q * r * 100) / 100;
        return {
          sr: idx + 1,
          Sr: idx + 1,
          description: String(it.description).trim(),
          Description: String(it.description).trim(),
          unit: it.unit || 'Nos',
          Unit: it.unit || 'Nos',
          qty: q,
          Qty: q,
          rate: r,
          Rate: r,
          tax: it.tax,
          Tax: it.tax,
          amount: a,
          Amount: a,
        };
      }),
    };

    await onSave(docPayload, previewAfter);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between pb-32 sm:pb-12">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
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
                <span
                  className={`text-xs font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider ${
                    docType === 'BILL'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {docType}
                </span>
                <h1 className="text-lg font-bold text-slate-900">
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
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm transition cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-slate-500" />
              <span>Save</span>
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSubmit(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1F3A5F] hover:bg-[#162a45] text-white font-bold text-sm shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Printer className="w-4 h-4" />
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
                Type item description to see saved catalog suggestions
              </p>
            </div>
            <button
              type="button"
              onClick={addItemRow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Item</span>
            </button>
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
                    <span className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 mt-1">
                      {index + 1}
                    </span>

                    {/* Description field with suggestions */}
                    <div className="flex-1 relative">
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
                        placeholder="Item description (e.g. Brake Pad Set)"
                        className="w-full px-3 py-2 text-sm font-semibold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1F3A5F] focus:outline-none"
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

                    {/* Action Group: Delete icon & Plus icon below delete icon with corporate distinguished color */}
                    <div className="flex flex-col items-center gap-1.5 shrink-0 pt-0.5">
                      <button
                        type="button"
                        onClick={() => removeItemRow(index)}
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                        title="Delete this line item"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={addItemRow}
                        className="p-2 rounded-lg bg-[#0F2544] hover:bg-[#1E3A8A] text-white shadow-xs hover:shadow-md active:scale-95 transition cursor-pointer"
                        title="Add item row"
                        aria-label="Add line item"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Second row of item: Unit, Qty, Rate, Tax, Amount */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2 pt-2 border-t border-slate-200/60 items-center">
                    {/* Unit */}
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">
                        Unit
                      </label>
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                        placeholder="Nos/Job/Set"
                        className="w-full px-2 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none"
                      />
                    </div>

                    {/* Qty */}
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">
                        Qty
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={item.qty === 0 ? '' : item.qty}
                        onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                        placeholder="1"
                        className="w-full px-2 py-1.5 text-xs font-bold font-mono bg-white border border-slate-300 rounded-lg focus:outline-none"
                      />
                    </div>

                    {/* Rate */}
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">
                        Rate (PKR)
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={item.rate === 0 ? '' : item.rate}
                        onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                        placeholder="0.00"
                        className="w-full px-2 py-1.5 text-xs font-bold font-mono bg-white border border-slate-300 rounded-lg focus:outline-none"
                      />
                    </div>

                    {/* Tax Selector */}
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">
                        Tax Category
                      </label>
                      <select
                        value={item.tax}
                        onChange={(e) => handleItemChange(index, 'tax', e.target.value as TaxType)}
                        className="w-full px-2 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:outline-none cursor-pointer"
                      >
                        <option value="GST">Goods (GST {gstPercent}%)</option>
                        <option value="PST">Service (PST {pstPercent}%)</option>
                        <option value="None">No Tax (0%)</option>
                      </select>
                    </div>

                    {/* Amount (Auto calculated) */}
                    <div className="col-span-2 sm:col-span-1 text-right">
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

          {/* Quick Add Row Action Aligned Below Column */}
          <div className="flex justify-end pt-3">
            <button
              type="button"
              onClick={addItemRow}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0F2544] hover:bg-[#1E3A8A] text-white font-bold text-xs shadow-xs hover:shadow-md transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Row</span>
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
            {/* Card 1: Federal GST Summary (Goods) */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/70 to-indigo-50/40 border border-blue-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                  Federal GST on Goods ({gstPercent}%)
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-200/80 text-blue-900">
                  Goods
                </span>
              </div>
              <div className="space-y-1.5 text-xs pt-1 border-t border-blue-200/50">
                <div className="flex justify-between text-slate-600">
                  <span>Goods Subtotal:</span>
                  <span className="font-mono font-bold text-slate-900">Rs. {formatCurrency(totals.goodsSub)}</span>
                </div>
                <div className="flex justify-between text-blue-950 font-bold text-sm">
                  <span>GST Payable ({gstPercent}%):</span>
                  <span className="font-mono text-blue-800">Rs. {formatCurrency(totals.gst)}</span>
                </div>
              </div>
            </div>

            {/* Card 2: Punjab PST Summary (Services) */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/70 to-teal-50/40 border border-emerald-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                  Punjab PST on Services ({pstPercent}%)
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-200/80 text-emerald-900">
                  Services
                </span>
              </div>
              <div className="space-y-1.5 text-xs pt-1 border-t border-emerald-200/50">
                <div className="flex justify-between text-slate-600">
                  <span>Services Subtotal:</span>
                  <span className="font-mono font-bold text-slate-900">Rs. {formatCurrency(totals.serviceSub)}</span>
                </div>
                <div className="flex justify-between text-emerald-950 font-bold text-sm">
                  <span>PST Payable ({pstPercent}%):</span>
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

          {/* Grand Total Executive Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-slate-300 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block">
                Total Bill Payable
              </span>
              <div className="text-2xl sm:text-3xl font-black font-mono text-[#0F2544] mt-0.5">
                Rs. {formatCurrency(totals.grandTotal)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={addItemRow}
                className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-4 h-4 text-slate-600" />
                <span>Add Row</span>
              </button>
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
