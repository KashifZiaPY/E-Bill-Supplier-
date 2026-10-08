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
  ExternalLink,
} from 'lucide-react';
import type { SupplierSettings } from '../types/billing';
import { MarginTestPrintLayout } from './print/MarginTestPrintLayout';
import { gasApi } from '../api/gasClient';

interface Props {
  settings: SupplierSettings;
  onBack: () => void;
  onSave: (newSettings: SupplierSettings) => Promise<void>;
  isSaving: boolean;
}

export const SettingsScreen: React.FC<Props> = ({
  settings,
  onBack,
  onSave,
  isSaving,
}) => {
  const [formData, setFormData] = useState<SupplierSettings>({ ...settings });
  const [isTestingMargins, setIsTestingMargins] = useState(false);

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

  const handleChange = (field: keyof SupplierSettings, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* If testing margins, show dedicated printable margin test layout */}
      {isTestingMargins && (
        <div className="fixed inset-0 z-50 bg-white overflow-auto p-4 flex flex-col justify-between">
          <div className="no-print mb-4 flex items-center justify-between bg-slate-100 p-3 rounded-xl border border-slate-300">
            <div>
              <p className="font-bold text-slate-800 text-sm">
                Test Print Margin Mode
              </p>
              <p className="text-xs text-slate-500">
                Click Print or cancel when done to return to settings.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-[#1F3A5F] text-white text-xs font-bold rounded-lg"
              >
                Print Test
              </button>
              <button
                onClick={() => setIsTestingMargins(false)}
                className="px-4 py-2 bg-slate-200 text-slate-800 text-xs font-bold rounded-lg"
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
              padding: '0.6in',
            }}
          >
            <MarginTestPrintLayout settings={formData} />
          </div>
        </div>
      )}

      {/* Screen Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900">App Settings</h1>
              <p className="text-xs text-slate-500">Configure Supplier Info & Print Margins</p>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#1F3A5F] hover:bg-[#162a45] text-white font-bold text-sm shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Save Settings</span>
          </button>
        </div>
      </header>

      {/* Settings Form Body */}
      <main className="max-w-4xl mx-auto px-4 py-6 w-full flex-1">
        <form onSubmit={handleSave} className="space-y-6">
          {/* Backend / Google Sheets Status Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-[#1F3A5F]" />
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Google Sheets & Backend Connection
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

            {/* Status pills & message */}
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
                      <CheckCircle2 className="w-4 h-4" /> Live & Connected
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
                  {!backendStatus.gasConfigured && (
                    <p className="mt-1.5 text-slate-700">
                      <strong>How to connect:</strong> Open your project in Vercel &gt; <strong>Settings</strong> &gt; <strong>Environment Variables</strong> &gt; add <code className="bg-amber-200/60 px-1 py-0.5 rounded font-mono">GAS_URL</code> (your Apps Script Web App <code className="bg-amber-200/60 px-1 py-0.5 rounded font-mono">.../exec</code> URL) and <code className="bg-amber-200/60 px-1 py-0.5 rounded font-mono">GAS_API_KEY</code>, then redeploy.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Supplier Business Particulars */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6">
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 mb-4">
              <Building2 className="w-5 h-5 text-[#1F3A5F]" />
              <h2 className="text-base font-bold text-slate-900">
                Supplier Profile (Anwar Traders)
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Supplier Business Name
                </label>
                <input
                  type="text"
                  value={formData.supplierName}
                  onChange={(e) => handleChange('supplierName', e.target.value)}
                  className="w-full px-3 py-2 text-sm font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Tagline / Business Nature
                </label>
                <input
                  type="text"
                  value={formData.supplierTagline}
                  onChange={(e) => handleChange('supplierTagline', e.target.value)}
                  className="w-full px-3 py-2 text-sm font-medium bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Business Address
                </label>
                <input
                  type="text"
                  value={formData.supplierAddress}
                  onChange={(e) => handleChange('supplierAddress', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Contact Phone(s)
                </label>
                <input
                  type="text"
                  value={formData.supplierPhone}
                  onChange={(e) => handleChange('supplierPhone', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Vendor No (if applicable)
                </label>
                <input
                  type="text"
                  value={formData.vendorNo}
                  onChange={(e) => handleChange('vendorNo', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  National Tax Number (NTN)
                </label>
                <input
                  type="text"
                  value={formData.supplierNTN}
                  onChange={(e) => handleChange('supplierNTN', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  GST Registration No.
                </label>
                <input
                  type="text"
                  value={formData.supplierGST}
                  onChange={(e) => handleChange('supplierGST', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]"
                />
              </div>
            </div>
          </div>

          {/* Letterhead Margins & Printing */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <Sliders className="w-5 h-5 text-[#1F3A5F]" />
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Pre-Printed Letterhead Margins
                  </h2>
                  <p className="text-xs text-slate-500">
                    Reserved empty space (in inches) when printing on your pre-printed stationery
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleTestPrintMargins}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition cursor-pointer"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                <span>Test Print Margins</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Top Margin (Inches)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="6"
                  value={formData.letterheadTop}
                  onChange={(e) => handleChange('letterheadTop', parseFloat(e.target.value) || 2.5)}
                  className="w-full px-3 py-2 text-sm font-bold font-mono bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Default: 2.5 inches (leaves space for your printed company header)
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Bottom Margin (Inches)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="5"
                  value={formData.letterheadBottom}
                  onChange={(e) => handleChange('letterheadBottom', parseFloat(e.target.value) || 1.5)}
                  className="w-full px-3 py-2 text-sm font-bold font-mono bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Default: 1.5 inches (leaves space for your footer & stamp area)
                </span>
              </div>
            </div>
          </div>

          {/* Tax Rates & Auto numbering */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6">
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 mb-4">
              <Percent className="w-5 h-5 text-[#1F3A5F]" />
              <h2 className="text-base font-bold text-slate-900">
                Tax Rates & Document Numbering
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  GST Rate on Goods (e.g. 0.18 = 18%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={formData.gstRate}
                  onChange={(e) => handleChange('gstRate', parseFloat(e.target.value) || 0.18)}
                  className="w-full px-3 py-2 text-sm font-bold font-mono bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Current: {Math.round((formData.gstRate || 0.18) * 100)}%
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  PST Rate on Services (e.g. 0.16 = 16%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={formData.pstRate}
                  onChange={(e) => handleChange('pstRate', parseFloat(e.target.value) || 0.16)}
                  className="w-full px-3 py-2 text-sm font-bold font-mono bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Current: {Math.round((formData.pstRate || 0.16) * 100)}%
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Next Bill Number
                </label>
                <input
                  type="text"
                  value={formData.nextBillNo}
                  onChange={(e) => handleChange('nextBillNo', e.target.value)}
                  className="w-full px-3 py-2 text-sm font-bold font-mono bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Next Quotation Number
                </label>
                <input
                  type="text"
                  value={formData.nextQuoteNo}
                  onChange={(e) => handleChange('nextQuoteNo', e.target.value)}
                  className="w-full px-3 py-2 text-sm font-bold font-mono bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]"
                />
              </div>
            </div>
          </div>
        </form>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-400 font-medium">
        Developed by MKZ
      </footer>
    </div>
  );
};
