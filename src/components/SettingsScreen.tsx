import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Save,
  Printer,
  Building2,
  FileSpreadsheet,
  Percent,
  Sliders,
  ShieldCheck,
  Check,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Plus,
  Trash2,
  User,
  Lock,
  RotateCcw,
  FileCode,
} from 'lucide-react';
import type { FirmProfile, SupplierSettings, DocumentRecord } from '../types/billing';
import { MarginTestPrintLayout } from './print/MarginTestPrintLayout';
import { gasApi } from '../api/gasClient';
import { formatCurrency } from '../utils/formatters';
import { getLastDocLIFO } from '../utils/lifoHelper';
import { LifoDeleteModal } from './LifoDeleteModal';
import { GoogleAppsScriptModal } from './GoogleAppsScriptModal';

interface Props {
  settings: SupplierSettings;
  docs?: DocumentRecord[];
  onBack: () => void;
  onSave: (newSettings: SupplierSettings) => Promise<void>;
  onDeleteDoc?: (doc: DocumentRecord, authorityPin?: string) => Promise<void>;
  deletePinRequired?: boolean;
  onRefreshData?: () => Promise<void>;
  isSaving: boolean;
}

export const SettingsScreen: React.FC<Props> = ({
  settings,
  docs = [],
  onBack,
  onSave,
  onDeleteDoc,
  deletePinRequired,
  onRefreshData,
  isSaving,
}) => {
  const [formData, setFormData] = useState<SupplierSettings>({ ...settings });
  const [selectedFirmIndex, setSelectedFirmIndex] = useState<number>(0);
  const [isTestingMargins, setIsTestingMargins] = useState(false);

  // Google Apps Script Connection configuration state
  const [gasUrlInput, setGasUrlInput] = useState<string>(gasApi.getGasUrl());
  const [gasApiKeyInput, setGasApiKeyInput] = useState<string>(gasApi.getGasApiKey());
  const [isSavingGasConfig, setIsSavingGasConfig] = useState<boolean>(false);
  const [gasFeedback, setGasFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isWipingCache, setIsWipingCache] = useState<boolean>(false);

  useEffect(() => {
    setFormData({ ...settings });
  }, [settings]);

  // LIFO deletion state
  const [docToDeleteLifo, setDocToDeleteLifo] = useState<DocumentRecord | null>(null);
  const [isLifoModalOpen, setIsLifoModalOpen] = useState(false);
  const [isDeletingLifo, setIsDeletingLifo] = useState(false);
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);

  const handleOpenLifoDelete = (doc: DocumentRecord) => {
    setDocToDeleteLifo(doc);
    setIsLifoModalOpen(true);
  };

  const handleConfirmLifoDelete = async (doc: DocumentRecord, authorityPin?: string) => {
    setIsDeletingLifo(true);
    try {
      if (onDeleteDoc) {
        await onDeleteDoc(doc, authorityPin);
      }
      setIsLifoModalOpen(false);
      setDocToDeleteLifo(null);
    } finally {
      setIsDeletingLifo(false);
    }
  };

  // Keyboard navigation: Escape key exits settings screen or margin tester
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isTestingMargins) {
          setIsTestingMargins(false);
        } else {
          onBack();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTestingMargins, onBack]);

  // Backend connection status state
  const [isCheckingBackend, setIsCheckingBackend] = useState(false);
  const [backendStatus, setBackendStatus] = useState<{
    tested: boolean;
    ok: boolean;
    gasConfigured: boolean;
    gasApiKeyConfigured: boolean;
    appPinConfigured: boolean;
    message: string;
  }>({
    tested: false,
    ok: false,
    gasConfigured: false,
    gasApiKeyConfigured: false,
    appPinConfigured: false,
    message: '',
  });

  const testBackend = async () => {
    setIsCheckingBackend(true);
    try {
      const res = await gasApi.checkBackendStatus();
      setBackendStatus({
        tested: true,
        ok: res.ok,
        gasConfigured: res.gasConfigured,
        gasApiKeyConfigured: res.gasApiKeyConfigured,
        appPinConfigured: res.appPinConfigured,
        message: res.message,
      });
    } catch (err: any) {
      setBackendStatus({
        tested: true,
        ok: false,
        gasConfigured: false,
        gasApiKeyConfigured: false,
        appPinConfigured: false,
        message: err.message || 'Connection test failed',
      });
    } finally {
      setIsCheckingBackend(false);
    }
  };

  const handleSaveGasConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingGasConfig(true);
    setGasFeedback(null);
    try {
      const trimmedUrl = gasUrlInput.trim();
      const trimmedKey = gasApiKeyInput.trim();
      await gasApi.saveGasConfig(trimmedUrl, trimmedKey);
      const testRes = await gasApi.checkBackendStatus();
      setBackendStatus({
        tested: true,
        ok: testRes.ok,
        gasConfigured: testRes.gasConfigured,
        gasApiKeyConfigured: testRes.gasApiKeyConfigured,
        appPinConfigured: testRes.appPinConfigured,
        message: testRes.message,
      });

      if (testRes.ok) {
        setGasFeedback({
          type: 'success',
          message: 'Connected to Google Sheet successfully! Real-time synchronization active.',
        });
        if (onRefreshData) {
          await onRefreshData();
        }
      } else {
        setGasFeedback({
          type: 'error',
          message: testRes.message || 'Configuration saved, but could not reach Google Sheet. Check URL and access permissions.',
        });
      }
    } catch (err: any) {
      setGasFeedback({
        type: 'error',
        message: err.message || 'Failed to save Google Sheet configuration.',
      });
    } finally {
      setIsSavingGasConfig(false);
    }
  };

  const handleWipeCacheAndSync = async () => {
    if (!window.confirm('Pull fresh, live records directly from Google Sheet?')) {
      return;
    }
    setIsWipingCache(true);
    try {
      if (onRefreshData) {
        await onRefreshData();
      }
      await testBackend();
      setGasFeedback({
        type: 'success',
        message: 'Local cache wiped clean. Clean Google Sheet records synchronized.',
      });
    } catch (err: any) {
      setGasFeedback({
        type: 'error',
        message: err.message || 'Failed to re-sync.',
      });
    } finally {
      setIsWipingCache(false);
    }
  };

  useEffect(() => {
    testBackend();
  }, []);

  const firms = formData.firms && formData.firms.length > 0 ? formData.firms : [
    {
      id: 'firm-anwar-traders',
      name: formData.supplierName || 'Anwar Traders',
      tagline: formData.supplierTagline || 'General Order Suppliers & Govt Contractors',
      address: formData.supplierAddress,
      phone: formData.supplierPhone,
      ntn: formData.supplierNTN,
      gst: formData.supplierGST,
      vendorNo: formData.vendorNo,
      gstRate: formData.gstRate || 0.18,
      pstRate: formData.pstRate || 0.16,
      letterheadTop: formData.letterheadTop || 2.5,
      letterheadBottom: formData.letterheadBottom || 1.5,
      nextBillNo: formData.nextBillNo || '101',
      nextQuoteNo: formData.nextQuoteNo || 'Q-201',
    }
  ];

  const currentFirm = firms[selectedFirmIndex] || firms[0];

  const handleFirmChange = (field: keyof FirmProfile, value: any) => {
    setFormData((prev) => {
      const updatedFirms = [...(prev.firms || firms)];
      updatedFirms[selectedFirmIndex] = {
        ...updatedFirms[selectedFirmIndex],
        [field]: value,
      };

      // Also sync top-level fields if modifying the active firm
      const updated = {
        ...prev,
        firms: updatedFirms,
      };

      if (updatedFirms[selectedFirmIndex].id === prev.activeFirmId) {
        if (field === 'name') updated.supplierName = value;
        if (field === 'tagline') updated.supplierTagline = value;
        if (field === 'address') updated.supplierAddress = value;
        if (field === 'phone') updated.supplierPhone = value;
        if (field === 'ntn') updated.supplierNTN = value;
        if (field === 'gst') updated.supplierGST = value;
        if (field === 'vendorNo') updated.vendorNo = value;
        if (field === 'gstRate') updated.gstRate = value;
        if (field === 'pstRate') updated.pstRate = value;
        if (field === 'letterheadTop') updated.letterheadTop = value;
        if (field === 'letterheadBottom') updated.letterheadBottom = value;
        if (field === 'nextBillNo') updated.nextBillNo = value;
        if (field === 'nextQuoteNo') updated.nextQuoteNo = value;
      }

      return updated;
    });
  };

  const handleAddNewFirm = () => {
    const newId = 'firm-' + Date.now();
    const newFirm: FirmProfile = {
      id: newId,
      name: 'New Commercial Firm',
      tagline: 'Govt Contractor & Suppliers',
      address: 'Rawalpindi, Pakistan',
      phone: '0300-0000000',
      ntn: '',
      gst: '',
      vendorNo: '',
      gstRate: 0.18,
      pstRate: 0.16,
      letterheadTop: 2.5,
      letterheadBottom: 1.5,
      nextBillNo: '101',
      nextQuoteNo: 'Q-101',
    };

    setFormData((prev) => ({
      ...prev,
      firms: [...(prev.firms || firms), newFirm],
    }));
    setSelectedFirmIndex(firms.length);
  };

  const handleRemoveFirm = (index: number) => {
    if (firms.length <= 1) {
      alert('You must have at least one firm registered.');
      return;
    }
    const updated = firms.filter((_, idx) => idx !== index);
    setFormData((prev) => ({
      ...prev,
      firms: updated,
      activeFirmId: prev.activeFirmId === firms[index].id ? updated[0].id : prev.activeFirmId,
    }));
    setSelectedFirmIndex(0);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  const handleTestPrintMargins = () => {
    setIsTestingMargins(true);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {isTestingMargins && (
        <div className="fixed inset-0 z-50 bg-white overflow-auto p-4 flex flex-col">
          <div className="no-print mb-4 flex items-center justify-between corp-card p-3.5">
            <div>
              <p className="font-bold text-ink-900 text-sm">Margin test · {currentFirm.name}</p>
              <p className="text-xs text-ink-400">Top {currentFirm.letterheadTop}″ · Bottom {currentFirm.letterheadBottom}″</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => window.print()} className="corp-btn-primary !py-2 text-xs">Print Test</button>
              <button onClick={() => setIsTestingMargins(false)} className="corp-btn-ghost !py-2 text-xs">Close</button>
            </div>
          </div>
          <div
            className="print-container mx-auto bg-white border border-line shadow-md"
            style={{ width: '100%', maxWidth: '8.27in', minHeight: '11.69in', padding: '0.5in' }}
          >
            <MarginTestPrintLayout settings={{ ...formData, letterheadTop: currentFirm.letterheadTop, letterheadBottom: currentFirm.letterheadBottom }} />
          </div>
        </div>
      )}

      <header className="bg-navy-950 text-white sticky top-0 z-30 shadow-[0_2px_12px_rgba(12,28,51,0.35)]">
        <div className="h-0.5 bg-gradient-to-r from-gold-700 via-gold-400 to-gold-700" />
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onBack} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition shrink-0" aria-label="Back">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-[17px] font-extrabold tracking-tight truncate">Settings &amp; Profiles</h1>
              <p className="text-xs text-navy-200 truncate">{formData.ownerName || 'MIAN FARHAN ANWAR'} Enterprise Systems</p>
            </div>
          </div>
          <button onClick={handleSave} disabled={isSaving} className="corp-btn-gold shrink-0">
            {isSaving ? <span className="w-4 h-4 border-2 border-navy-950 border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save All</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5 w-full flex-1">
        <form onSubmit={handleSave} className="space-y-5">
          {/* Owner */}
          <section className="corp-card p-5">
            <div className="flex items-center gap-3 pb-4 border-b border-line mb-4">
              <span className="w-10 h-10 rounded-xl bg-navy-50 flex items-center justify-center"><User className="w-5 h-5 text-navy-700" /></span>
              <div>
                <h2 className="text-[15px] font-extrabold text-ink-900">Business Owner</h2>
                <p className="text-xs text-ink-400">Master heading across all firms</p>
              </div>
            </div>
            <div>
              <label className="corp-label">Owner full name</label>
              <input
                type="text"
                value={formData.ownerName || 'MIAN FARHAN ANWAR'}
                onChange={(e) => setFormData((prev) => ({ ...prev, ownerName: e.target.value }))}
                className="corp-input font-bold text-[15px]"
              />
            </div>
          </section>

          {/* Firms */}
          <section className="corp-card p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-line mb-4 gap-3">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-navy-50 flex items-center justify-center"><Building2 className="w-5 h-5 text-navy-700" /></span>
                <div>
                  <h2 className="text-[15px] font-extrabold text-ink-900">Supplier Firms</h2>
                  <p className="text-xs text-ink-400">Manage billing entities &amp; their profiles</p>
                </div>
              </div>
              <button type="button" onClick={handleAddNewFirm} className="corp-btn-primary !py-2 text-xs self-start sm:self-auto">
                <Plus className="w-3.5 h-3.5" /><span>Add Firm</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mb-5">
              {firms.map((firm, idx) => (
                <button
                  key={firm.id || idx}
                  type="button"
                  onClick={() => setSelectedFirmIndex(idx)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                    selectedFirmIndex === idx ? 'bg-navy-900 text-white shadow-sm' : 'bg-paper border border-line text-ink-500 hover:border-navy-200'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{firm.name}</span>
                  {firm.id === formData.activeFirmId && <span className="corp-chip bg-gold-500 text-navy-950 !text-[9px]">Active</span>}
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-line bg-paper/60 p-4 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-line">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-400">Editing</span>
                  <span className="font-extrabold text-ink-900">{currentFirm.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, activeFirmId: currentFirm.id }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      formData.activeFirmId === currentFirm.id
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-white border border-line hover:border-navy-200 text-ink-700'
                    }`}
                  >
                    {formData.activeFirmId === currentFirm.id ? '✓ Default firm' : 'Set as default'}
                  </button>
                  {firms.length > 1 && (
                    <button type="button" onClick={() => handleRemoveFirm(selectedFirmIndex)} className="p-2 text-ink-400 hover:text-[#b3372f] rounded-xl hover:bg-red-50 transition" title="Remove firm">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {([
                  ['Firm trading name', 'name', currentFirm.name, false, ''],
                  ['Tagline / specialization', 'tagline', currentFirm.tagline, false, ''],
                  ['Registered office address', 'address', currentFirm.address, false, 'sm:col-span-2'],
                  ['Phone numbers', 'phone', currentFirm.phone, false, ''],
                  ['Vendor registration no.', 'vendorNo', currentFirm.vendorNo, false, ''],
                  ['National Tax Number (NTN)', 'ntn', currentFirm.ntn, true, ''],
                  ['GST registration no.', 'gst', currentFirm.gst, true, ''],
                  ['Next bill no.', 'nextBillNo', currentFirm.nextBillNo, true, ''],
                  ['Next quotation no.', 'nextQuoteNo', currentFirm.nextQuoteNo, true, ''],
                ] as const).map(([label, field, value, mono, span]) => (
                  <div key={field} className={span}>
                    <label className="corp-label">{label}</label>
                    <input
                      type="text"
                      value={value || ''}
                      onChange={(e) => handleFirmChange(field as keyof FirmProfile, e.target.value)}
                      className={`corp-input ${mono ? 'font-mono font-bold' : ''} ${field === 'name' ? 'font-bold' : ''}`}
                    />
                  </div>
                ))}

                <div>
                  <label className="corp-label">Default GST rate (goods)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" step="0.5" min="0" max="100"
                      value={Math.round((currentFirm.gstRate || 0.18) * 100)}
                      onChange={(e) => handleFirmChange('gstRate', (parseFloat(e.target.value) || 0) / 100)}
                      className="corp-input font-mono font-bold"
                    />
                    <span className="text-sm font-bold text-ink-500">%</span>
                  </div>
                  <span className="text-[10px] text-ink-400 mt-1 block">Customizable per bill · Standard 18%</span>
                </div>
                <div>
                  <label className="corp-label">Punjab PST rate (services)</label>
                  <div className="corp-input flex items-center gap-2 bg-paper font-mono font-bold text-ink-700">
                    <Lock className="w-3.5 h-3.5 text-emerald-700" /><span>16.0% · Legally fixed</span>
                  </div>
                  <span className="text-[10px] text-ink-400 mt-1 block">Punjab Revenue Authority statutory schedule</span>
                </div>
              </div>

              <div className="pt-4 border-t border-line">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-ink-700 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" /> Letterhead margins · {currentFirm.name}
                  </label>
                  <button type="button" onClick={handleTestPrintMargins} className="text-xs font-bold text-navy-700 hover:underline flex items-center gap-1">
                    <Printer className="w-3.5 h-3.5" /><span>Test print</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="corp-label">Top margin (inches)</label>
                    <input
                      type="number" step="0.1" min="0.5" max="5"
                      value={currentFirm.letterheadTop}
                      onChange={(e) => handleFirmChange('letterheadTop', parseFloat(e.target.value) || 2.5)}
                      className="corp-input font-mono font-bold"
                    />
                    <span className="text-[10px] text-ink-400 mt-1 block">Space for pre-printed header · default 2.5″</span>
                  </div>
                  <div>
                    <label className="corp-label">Bottom margin (inches)</label>
                    <input
                      type="number" step="0.1" min="0.5" max="4"
                      value={currentFirm.letterheadBottom}
                      onChange={(e) => handleFirmChange('letterheadBottom', parseFloat(e.target.value) || 1.5)}
                      className="corp-input font-mono font-bold"
                    />
                    <span className="text-[10px] text-ink-400 mt-1 block">Space for signature / stamp · default 1.5″</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Security */}
          <section className="corp-card p-5">
            <div className="flex items-center justify-between pb-4 border-b border-line mb-4">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-navy-50 flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-navy-700" /></span>
                <div>
                  <h2 className="text-[15px] font-extrabold text-ink-900">Security &amp; LIFO Deletion</h2>
                  <p className="text-xs text-ink-400">App PIN and last-entry deletion control</p>
                </div>
              </div>
              <span className="corp-chip bg-navy-50 text-navy-800 border border-navy-100"><Lock className="w-3 h-3" /> PIN protected</span>
            </div>

            <div className="p-4 rounded-xl bg-paper border border-line mb-4">
              <span className="text-[13px] font-bold text-ink-900 block mb-2">How the PINs work</span>
              <div className="space-y-2.5 text-[12px] text-ink-700 leading-relaxed">
                <p>
                  <strong className="text-ink-900">Portal PIN</strong> — set in Vercel as <code className="px-1.5 py-0.5 rounded bg-navy-50 border border-navy-100 font-mono text-[11px]">APP_PIN</code>.
                  Required on <strong>every browser refresh</strong>; nothing is remembered on the device.
                  To change it: Vercel dashboard → your project → Settings → Environment Variables → edit <code className="px-1 py-0.5 rounded bg-navy-50 border border-navy-100 font-mono text-[11px]">APP_PIN</code> → Save → redeploy.
                  Every device then asks for the new PIN on its next refresh.
                </p>
                <p>
                  <strong className="text-ink-900">Deletion PIN</strong> (optional) — set in Vercel as <code className="px-1.5 py-0.5 rounded bg-navy-50 border border-navy-100 font-mono text-[11px]">DELETE_PIN</code>.
                  When set, deleting or cancelling a bill needs this <em>separate</em> PIN, so day-to-day bill creators can't destroy records.
                  When not set, the portal PIN authorizes deletions. {deletePinRequired ? (<strong className="text-emerald-700">Currently active.</strong>) : (<span className="text-ink-400">Currently not set.</span>)}
                </p>
                <p className="text-ink-400 text-[11px]">
                  The app itself can never change these PINs — they live on the server, never in the browser. That is deliberate.
                </p>
              </div>
            </div>

            <div className="px-4 py-3.5 rounded-xl bg-gold-100/60 border border-gold-200 text-xs text-ink-700 mb-4 flex gap-2.5">
              <RotateCcw className="w-4 h-4 text-gold-700 shrink-0 mt-0.5" />
              <p className="leading-relaxed"><strong>LIFO protocol:</strong> only the latest bill or quotation may be deleted. Numbering continues from the next free number afterwards.</p>
            </div>

            {(() => {
              const lastBill = docs.length > 0 ? getLastDocLIFO(docs, 'BILL', currentFirm.id) : null;
              const lastQuotation = docs.length > 0 ? getLastDocLIFO(docs, 'QUOTATION', currentFirm.id) : null;
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([
                    ['Last bill', lastBill, 'BILL'],
                    ['Last quotation', lastQuotation, 'QUOTATION'],
                  ] as const).map(([label, lastDoc, type]) => (
                    <div key={type} className="rounded-xl border border-line p-4 flex flex-col justify-between gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="corp-chip bg-navy-900 text-white">{label}</span>
                          {lastDoc && <span className="corp-chip bg-gold-100 text-gold-700 border border-gold-200">Deletable</span>}
                        </div>
                        {lastDoc ? (
                          <div className="text-xs space-y-1">
                            <div className="font-mono font-extrabold text-ink-900 text-sm">{type} #{(lastDoc as any).docNo || (lastDoc as any).DocNo}</div>
                            <p className="text-ink-500 font-medium truncate">{(lastDoc as any).clientName || (lastDoc as any).ClientName}</p>
                            <p className="text-ink-400 font-mono">Rs. {formatCurrency((lastDoc as any).grandTotal || (lastDoc as any).GrandTotal)} · {(lastDoc as any).date || (lastDoc as any).Date}</p>
                          </div>
                        ) : (
                          <p className="text-xs text-ink-400 italic py-2">Nothing recorded for this firm.</p>
                        )}
                      </div>
                      {lastDoc && (
                        <button
                          type="button"
                          onClick={() => handleOpenLifoDelete(lastDoc as DocumentRecord)}
                          className="w-full py-2.5 px-3 rounded-xl bg-red-50 hover:bg-red-100 text-[#b3372f] border border-red-200 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" /><span>Delete (PIN required)</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </section>

          {/* Backend sync */}
          <section className="corp-card p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-line mb-4 gap-3">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center"><FileSpreadsheet className="w-5 h-5 text-emerald-700" /></span>
                <div>
                  <h2 className="text-[15px] font-extrabold text-ink-900">Google Sheets Sync</h2>
                  <p className="text-xs text-ink-400">Live sync via Google Apps Script web app</p>
                </div>
              </div>
              <button type="button" onClick={testBackend} disabled={isCheckingBackend} className="corp-btn-ghost !py-2 text-xs self-start sm:self-auto disabled:opacity-50">
                <RefreshCw className={`w-3.5 h-3.5 ${isCheckingBackend ? 'animate-spin' : ''}`} /><span>Test Connection</span>
              </button>
            </div>

            <div className="mb-4">
              {backendStatus.ok ? (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="corp-label !text-emerald-800 !mb-1">Connected &amp; synced</span>
                    <p className="text-xs text-emerald-900">{backendStatus.message || 'Reading and writing live rows.'}</p>
                  </div>
                  <span className="corp-chip bg-emerald-600 text-white">Live</span>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-gold-100/60 border border-gold-200 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-gold-700 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="corp-label !text-gold-700 !mb-1">Not connected</span>
                    <p className="text-xs text-ink-700">{backendStatus.message || 'Paste your Apps Script web app URL below to activate live sync.'}</p>
                  </div>
                  <span className="corp-chip bg-gold-500 text-navy-950">Setup</span>
                </div>
              )}
            </div>

            <div className="space-y-4 bg-paper p-4 rounded-xl border border-line mb-4">
              <div>
                <label className="corp-label">Web app URL <span className="normal-case font-medium text-ink-400">(must end with /exec)</span></label>
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/AKfycb…/exec"
                  value={gasUrlInput}
                  onChange={(e) => setGasUrlInput(e.target.value)}
                  className="corp-input font-mono text-xs font-bold"
                />
              </div>
              <div>
                <label className="corp-label">API key <span className="normal-case font-medium text-ink-400">(optional)</span></label>
                <input
                  type="password"
                  placeholder="Leave blank if no API_KEY is set in Apps Script"
                  value={gasApiKeyInput}
                  onChange={(e) => setGasApiKeyInput(e.target.value)}
                  className="corp-input font-mono text-xs"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button type="button" onClick={handleSaveGasConfig} disabled={isSavingGasConfig} className="corp-btn-primary !py-2.5 text-xs !bg-emerald-700 hover:!bg-emerald-800 disabled:opacity-50">
                  {isSavingGasConfig ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Save &amp; Connect</span>
                </button>
                <button
                  type="button"
                  onClick={handleWipeCacheAndSync}
                  disabled={isWipingCache}
                  className="corp-btn-ghost !py-2.5 text-xs disabled:opacity-50"
                  title="Pull fresh live data from the sheet"
                >
                  {isWipingCache ? <span className="w-3.5 h-3.5 border-2 border-navy-700 border-t-transparent rounded-full animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  <span>Re-sync Live Data</span>
                </button>
              </div>
              {gasFeedback && (
                <div className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${gasFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-red-50 text-[#96291f] border border-red-200'}`}>
                  {gasFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{gasFeedback.message}</span>
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-navy-50 border border-navy-100 text-xs text-ink-700 space-y-1.5 mb-4">
              <span className="font-extrabold text-navy-900 block">Connect your sheet in 4 steps</span>
              <ol className="list-decimal list-inside space-y-1 text-[11px]">
                <li>Open your Google Sheet → <strong>Extensions → Apps Script</strong>.</li>
                <li>Paste the <strong>Code.gs v2.6.4</strong> script (button below) and save.</li>
                <li><strong>Deploy → New deployment → Web app</strong> · Execute as <strong>Me</strong>, access <strong>Anyone</strong>.</li>
                <li>Paste the web app URL above and hit <strong>Save &amp; Connect</strong>.</li>
              </ol>
            </div>

            <button
              type="button"
              onClick={() => setIsScriptModalOpen(true)}
              className="corp-btn-primary w-full !py-3 text-xs"
            >
              <FileCode className="w-4 h-4 text-gold-400" />
              <span>View &amp; Copy Apps Script (Code.gs v2.6.4)</span>
            </button>
          </section>
        </form>
      </main>

      <footer className="py-4 text-center text-[11px] text-ink-400 font-medium">
        {formData.ownerName || 'MIAN FARHAN ANWAR'} Enterprise Systems
      </footer>

      <GoogleAppsScriptModal isOpen={isScriptModalOpen} onClose={() => setIsScriptModalOpen(false)} />
      <LifoDeleteModal
        isOpen={isLifoModalOpen}
        doc={docToDeleteLifo}
        onClose={() => { setIsLifoModalOpen(false); setDocToDeleteLifo(null); }}
        onConfirmDelete={handleConfirmLifoDelete}
        isDeleting={isDeletingLifo}
        deletePinRequired={deletePinRequired}
      />
    </div>
  );
};
