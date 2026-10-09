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
  onDeleteDoc?: (doc: DocumentRecord) => Promise<void>;
  isSaving: boolean;
}

export const SettingsScreen: React.FC<Props> = ({
  settings,
  docs = [],
  onBack,
  onSave,
  onDeleteDoc,
  isSaving,
}) => {
  const [formData, setFormData] = useState<SupplierSettings>({ ...settings });
  const [selectedFirmIndex, setSelectedFirmIndex] = useState<number>(0);
  const [isTestingMargins, setIsTestingMargins] = useState(false);

  useEffect(() => {
    setFormData({ ...settings });
  }, [settings]);

  // Security PIN management & LIFO deletion state
  const [pinInput, setPinInput] = useState('');
  const [pinSuccessMsg, setPinSuccessMsg] = useState('');
  const [docToDeleteLifo, setDocToDeleteLifo] = useState<DocumentRecord | null>(null);
  const [isLifoModalOpen, setIsLifoModalOpen] = useState(false);
  const [isDeletingLifo, setIsDeletingLifo] = useState(false);
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);

  const handleUpdatePin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pinInput || pinInput.length < 4) {
      alert('Please enter a 4-digit Security PIN.');
      return;
    }
    gasApi.updatePin(pinInput);
    setPinSuccessMsg('Security PIN updated successfully!');
    setPinInput('');
    setTimeout(() => setPinSuccessMsg(''), 4000);
  };

  const handleOpenLifoDelete = (doc: DocumentRecord) => {
    setDocToDeleteLifo(doc);
    setIsLifoModalOpen(true);
  };

  const handleConfirmLifoDelete = async (doc: DocumentRecord) => {
    setIsDeletingLifo(true);
    try {
      if (onDeleteDoc) {
        await onDeleteDoc(doc);
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
    <div className="min-h-screen bg-[#F4F6F9] flex flex-col justify-between">
      {/* If testing margins, show dedicated printable margin test layout */}
      {isTestingMargins && (
        <div className="fixed inset-0 z-50 bg-white overflow-auto p-4 flex flex-col justify-between">
          <div className="no-print mb-4 flex items-center justify-between bg-slate-100 p-3 rounded-xl border border-slate-300">
            <div>
              <p className="font-bold text-slate-800 text-sm">
                Test Print Margin Mode for {currentFirm.name}
              </p>
              <p className="text-xs text-slate-500">
                Top margin: {currentFirm.letterheadTop}in · Bottom margin: {currentFirm.letterheadBottom}in
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-[#0F2544] text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                Print Test
              </button>
              <button
                onClick={() => setIsTestingMargins(false)}
                className="px-4 py-2 bg-slate-200 text-slate-800 text-xs font-bold rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>

          <div
            className="print-container mx-auto bg-white border border-slate-300 shadow-md"
            style={{
              width: '100%',
              maxWidth: '8.27in',
              minHeight: '11.69in',
              padding: '0.5in',
            }}
          >
            <MarginTestPrintLayout settings={{ ...formData, letterheadTop: currentFirm.letterheadTop, letterheadBottom: currentFirm.letterheadBottom }} />
          </div>
        </div>
      )}

      {/* Screen Header */}
      <header className="bg-gradient-to-r from-[#0B1E36] via-[#103158] to-[#0B1E36] text-white border-b border-blue-900/80 sticky top-0 z-30 shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-black text-white">Enterprise Architecture Settings</h1>
              <p className="text-xs text-blue-200">
                {formData.ownerName || 'MIAN FARHAN ANWAR'} Enterprise Systems
              </p>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm shadow-md transition cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Save All Settings</span>
          </button>
        </div>
      </header>

      {/* Settings Form Body */}
      <main className="max-w-5xl mx-auto px-4 py-6 w-full flex-1">
        <form onSubmit={handleSave} className="space-y-6">
          {/* Business Owner Header Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6">
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 mb-4">
              <User className="w-5 h-5 text-[#0F2544]" />
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Business Owner / Enterprise Head
                </h2>
                <p className="text-xs text-slate-500">
                  Master owner heading for all commercial and government contractor firms
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Owner Full Name
              </label>
              <input
                type="text"
                value={formData.ownerName || 'MIAN FARHAN ANWAR'}
                onChange={(e) => setFormData((prev) => ({ ...prev, ownerName: e.target.value }))}
                className="w-full px-3.5 py-2.5 text-base font-bold font-serif bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F2544] text-slate-900"
              />
            </div>
          </div>

          {/* Multi-Firm Manager Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 mb-4 gap-3">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-[#0F2544]" />
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Multiple Supplier Firms Management
                  </h2>
                  <p className="text-xs text-slate-500">
                    Switch, edit, or add supplier entities (Anwar Traders, Hashir Traders, etc.)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddNewFirm}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0F2544] text-white text-xs font-bold hover:bg-[#163866] transition cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Another Firm</span>
              </button>
            </div>

            {/* Firm Selector Pills */}
            <div className="flex flex-wrap gap-2 mb-6">
              {firms.map((firm, idx) => (
                <button
                  key={firm.id || idx}
                  type="button"
                  onClick={() => setSelectedFirmIndex(idx)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    selectedFirmIndex === idx
                      ? 'bg-[#0F2544] text-white shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <span>🏢 {firm.name}</span>
                  {firm.id === formData.activeFirmId && (
                    <span className="text-[10px] bg-amber-400 text-slate-900 px-1.5 py-0.2 rounded font-black">
                      ACTIVE
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Firm Detail Editor */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase text-slate-500 tracking-wider">
                    Editing Entity:
                  </span>
                  <span className="text-sm font-bold text-slate-900">{currentFirm.name}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, activeFirmId: currentFirm.id }));
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      formData.activeFirmId === currentFirm.id
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-white border border-slate-300 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    {formData.activeFirmId === currentFirm.id ? '✓ Default Active Firm' : 'Set as Default'}
                  </button>

                  {firms.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveFirm(selectedFirmIndex)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                      title="Delete Firm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Firm Trading Name
                  </label>
                  <input
                    type="text"
                    value={currentFirm.name}
                    onChange={(e) => handleFirmChange('name', e.target.value)}
                    className="w-full px-3 py-2 text-sm font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F2544]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Tagline / Specialization
                  </label>
                  <input
                    type="text"
                    value={currentFirm.tagline}
                    onChange={(e) => handleFirmChange('tagline', e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F2544]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Registered Office Address
                  </label>
                  <input
                    type="text"
                    value={currentFirm.address}
                    onChange={(e) => handleFirmChange('address', e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F2544]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Phone Numbers
                  </label>
                  <input
                    type="text"
                    value={currentFirm.phone}
                    onChange={(e) => handleFirmChange('phone', e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F2544]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Vendor Registration No.
                  </label>
                  <input
                    type="text"
                    value={currentFirm.vendorNo}
                    onChange={(e) => handleFirmChange('vendorNo', e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F2544]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    National Tax Number (NTN)
                  </label>
                  <input
                    type="text"
                    value={currentFirm.ntn}
                    onChange={(e) => handleFirmChange('ntn', e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F2544]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    GST Registration No.
                  </label>
                  <input
                    type="text"
                    value={currentFirm.gst}
                    onChange={(e) => handleFirmChange('gst', e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F2544]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Next Bill No.
                  </label>
                  <input
                    type="text"
                    value={currentFirm.nextBillNo}
                    onChange={(e) => handleFirmChange('nextBillNo', e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F2544]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Next Quotation No.
                  </label>
                  <input
                    type="text"
                    value={currentFirm.nextQuoteNo}
                    onChange={(e) => handleFirmChange('nextQuoteNo', e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F2544]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Default GST Rate (Goods)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      value={Math.round((currentFirm.gstRate || 0.18) * 100)}
                      onChange={(e) => handleFirmChange('gstRate', (parseFloat(e.target.value) || 0) / 100)}
                      className="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F2544]"
                    />
                    <span className="text-sm font-bold text-slate-600">%</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Customizable per bill (Standard: 18%)
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Punjab PST Rate (Services)
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-slate-700 font-mono font-bold text-sm">
                    <Lock className="w-3.5 h-3.5 text-emerald-700" />
                    <span>16.0% (Legally Fixed)</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Fixed under Punjab Revenue Authority statutory schedule
                  </span>
                </div>
              </div>

              {/* Margins for this firm */}
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Letterhead Margins for {currentFirm.name}</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleTestPrintMargins}
                    className="text-xs font-bold text-[#0F2544] hover:underline flex items-center gap-1"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Test Print Margins</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-0.5">
                      Top Margin (Inches)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="5"
                      value={currentFirm.letterheadTop}
                      onChange={(e) => handleFirmChange('letterheadTop', parseFloat(e.target.value) || 2.5)}
                      className="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-slate-300 rounded-xl"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Default: 2.5 in (leaves space for firm&apos;s pre-printed header)
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-0.5">
                      Bottom Margin (Inches)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="4"
                      value={currentFirm.letterheadBottom}
                      onChange={(e) => handleFirmChange('letterheadBottom', parseFloat(e.target.value) || 1.5)}
                      className="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-slate-300 rounded-xl"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Default: 1.5 in (leaves space for signature/stamp footer)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Security, PIN & LIFO Document Management Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-[#0F2544] flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-[#0F2544]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Security, PIN &amp; LIFO Document Management
                  </h2>
                  <p className="text-xs text-slate-500">
                    App PIN security &amp; last bill / quotation deletion under LIFO protocol
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>PIN Protected</span>
              </span>
            </div>

            <div className="space-y-4">
              {/* PIN Configuration Box */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Security PIN Configuration</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Standard 4-digit PIN required on app launch and for critical actions like last entry deletion.
                  </p>
                  {pinSuccessMsg && (
                    <span className="text-xs font-bold text-emerald-600 block mt-1">
                      ✓ {pinSuccessMsg}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    maxLength={8}
                    placeholder="New 4-digit PIN"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                    className="w-36 px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#0F2544] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleUpdatePin}
                    className="px-3.5 py-2 bg-[#0F2544] hover:bg-[#163866] text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Update PIN
                  </button>
                </div>
              </div>

              {/* LIFO Sequential Deletion Policy */}
              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950 space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold">
                  <RotateCcw className="w-4 h-4 text-amber-700" />
                  <span>LIFO (Last-In, First-Out) Deletion Protocol</span>
                </div>
                <p className="text-[11px] text-amber-900 leading-relaxed">
                  Under tax audit compliance and sequence integrity, <strong>only the latest recorded Bill or Quotation</strong> may be deleted.
                  Deleting the last entry automatically rolls back the sequence counter (Next #) so the next document uses the freed sequence number without numbering gaps.
                </p>
              </div>

              {/* Live LIFO Status & Quick Deletion Actions under PIN */}
              {(() => {
                const lastBill = docs.length > 0 ? getLastDocLIFO(docs, 'BILL', currentFirm.id) : null;
                const lastQuotation = docs.length > 0 ? getLastDocLIFO(docs, 'QUOTATION', currentFirm.id) : null;

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Last Bill Card */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-900">
                            Last Bill in Stack
                          </span>
                          {lastBill && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                              Eligible for LIFO Deletion
                            </span>
                          )}
                        </div>
                        {lastBill ? (
                          <div className="space-y-1 text-xs">
                            <div className="font-mono font-black text-slate-900 text-sm">
                              BILL #{lastBill.docNo || lastBill.DocNo}
                            </div>
                            <p className="text-slate-600 font-medium truncate">
                              Client: {lastBill.clientName || lastBill.ClientName}
                            </p>
                            <p className="text-slate-500 font-mono">
                              Amount: Rs. {formatCurrency(lastBill.grandTotal || lastBill.GrandTotal)} · Date: {lastBill.date || lastBill.Date}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic py-2">No bills recorded for this firm.</p>
                        )}
                      </div>

                      {lastBill && (
                        <div className="pt-3 mt-3 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => handleOpenLifoDelete(lastBill)}
                            className="w-full py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            <span>Delete Last Bill (PIN Required)</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Last Quotation Card */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">
                            Last Quotation in Stack
                          </span>
                          {lastQuotation && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                              Eligible for LIFO Deletion
                            </span>
                          )}
                        </div>
                        {lastQuotation ? (
                          <div className="space-y-1 text-xs">
                            <div className="font-mono font-black text-slate-900 text-sm">
                              QUOTATION #{lastQuotation.docNo || lastQuotation.DocNo}
                            </div>
                            <p className="text-slate-600 font-medium truncate">
                              Client: {lastQuotation.clientName || lastQuotation.ClientName}
                            </p>
                            <p className="text-slate-500 font-mono">
                              Amount: Rs. {formatCurrency(lastQuotation.grandTotal || lastQuotation.GrandTotal)} · Date: {lastQuotation.date || lastQuotation.Date}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic py-2">No quotations recorded for this firm.</p>
                        )}
                      </div>

                      {lastQuotation && (
                        <div className="pt-3 mt-3 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => handleOpenLifoDelete(lastQuotation)}
                            className="w-full py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            <span>Delete Last Quotation (PIN Required)</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Backend / Google Sheets Status Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-[#0F2544]" />
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Google Sheets &amp; Backend Connection
                  </h2>
                  <p className="text-xs text-slate-500">
                    Verifies connection to Apps Script Web App (Code.gs)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={testBackend}
                disabled={isCheckingBackend}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCheckingBackend ? 'animate-spin' : ''}`} />
                <span>Test Connection</span>
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70">
                  <span className="text-slate-500 block mb-1">Vercel GAS_URL:</span>
                  {backendStatus.gasConfigured ? (
                    <span className="font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Configured
                    </span>
                  ) : (
                    <span className="font-bold text-amber-700 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> Not Configured
                    </span>
                  )}
                </div>

                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70">
                  <span className="text-slate-500 block mb-1">Vercel GAS_API_KEY:</span>
                  {backendStatus.gasApiKeyConfigured ? (
                    <span className="font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Configured
                    </span>
                  ) : (
                    <span className="font-bold text-slate-500">Optional / Blank</span>
                  )}
                </div>

                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70">
                  <span className="text-slate-500 block mb-1">Google Sheet Link:</span>
                  {backendStatus.ok ? (
                    <span className="font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Live &amp; Connected
                    </span>
                  ) : (
                    <span className="font-bold text-rose-700 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> Disconnected
                    </span>
                  )}
                </div>
              </div>

              {backendStatus.message && (
                <div
                  className={`p-3.5 rounded-xl text-xs font-medium ${
                    backendStatus.ok
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                      : 'bg-amber-50 border border-amber-200 text-amber-900'
                  }`}
                >
                  <p className="font-semibold">{backendStatus.message}</p>
                </div>
              )}

              {/* View & Copy Full Google Apps Script Code */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsScriptModalOpen(true)}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                >
                  <FileCode className="w-4 h-4 text-emerald-400" />
                  <span>View &amp; Copy Google Apps Script (Code.gs v2.5)</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-400 font-medium">
        Developed by MKZ · {formData.ownerName || 'MIAN FARHAN ANWAR'} Enterprise Systems
      </footer>

      {/* Google Apps Script Modal */}
      <GoogleAppsScriptModal
        isOpen={isScriptModalOpen}
        onClose={() => setIsScriptModalOpen(false)}
      />

      {/* LIFO PIN Protected Delete Modal */}
      <LifoDeleteModal
        isOpen={isLifoModalOpen}
        doc={docToDeleteLifo}
        onClose={() => {
          setIsLifoModalOpen(false);
          setDocToDeleteLifo(null);
        }}
        onConfirmDelete={handleConfirmLifoDelete}
        isDeleting={isDeletingLifo}
      />
    </div>
  );
};
