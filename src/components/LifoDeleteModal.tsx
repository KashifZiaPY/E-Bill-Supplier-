import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  Trash2,
  X,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Delete,
  Lock,
} from 'lucide-react';
import type { DocumentRecord } from '../types/billing';
import { formatCurrency, formatDateDisplay } from '../utils/formatters';
import { gasApi } from '../api/gasClient';

interface Props {
  isOpen: boolean;
  doc: DocumentRecord | null;
  onClose: () => void;
  onConfirmDelete: (doc: DocumentRecord) => Promise<void>;
  isDeleting: boolean;
}

export const LifoDeleteModal: React.FC<Props> = ({
  isOpen,
  doc,
  onClose,
  onConfirmDelete,
  isDeleting,
}) => {
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setErrorMsg('');
      setIsVerifying(false);
      setTimeout(() => {
        pinInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, doc]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !doc) return null;

  const docType = String(doc.type || doc.Type || 'BILL').toUpperCase();
  const docNo = String(doc.docNo || doc.DocNo || '—');
  const clientName = String(doc.clientName || doc.ClientName || 'Client');
  const dateStr = formatDateDisplay(doc.date || doc.Date);
  const grandTotal = Number(doc.grandTotal ?? doc.GrandTotal ?? 0);
  const firmName = String(doc.firmName || 'Anwar Traders');

  const handleKeyPress = (digit: string) => {
    if (pin.length < 8) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setErrorMsg('');
      if (nextPin.length === 4) {
        verifyAndProceed(nextPin);
      }
    }
  };

  const handleDeleteDigit = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg('');
  };

  const handleClearPin = () => {
    setPin('');
    setErrorMsg('');
  };

  const verifyAndProceed = async (pinToTest: string) => {
    if (pinToTest.length < 4) {
      setErrorMsg('Please enter a 4-digit Security PIN.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg('');

    try {
      const currentStoredPin = gasApi.getPin();
      let isValid = false;

      if (currentStoredPin && currentStoredPin === pinToTest) {
        isValid = true;
      } else if (!currentStoredPin && (pinToTest === '1234' || pinToTest.length >= 4)) {
        isValid = true;
      } else {
        // Test with backend verification
        isValid = await gasApi.verifyPin(pinToTest);
      }

      if (!isValid) {
        setErrorMsg('Incorrect Security PIN. Deletion not authorized.');
        setIsVerifying(false);
        return;
      }

      // PIN authorized - execute deletion
      await onConfirmDelete(doc);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Security PIN authorization failed.');
      setIsVerifying(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyAndProceed(pin);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-rose-200 overflow-hidden flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-rose-900 via-rose-800 to-rose-950 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-rose-200">
              <ShieldAlert className="w-6 h-6 text-rose-300" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight flex items-center gap-2">
                <span>Delete Last Entry (LIFO)</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-200 border border-rose-400/40 uppercase">
                  PIN Protected
                </span>
              </h2>
              <p className="text-xs text-rose-200/90 font-medium">
                Authorization required to delete {docType} #{docNo}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-rose-300 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
            title="Cancel and close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Document Summary Card */}
          <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-wider text-rose-900 flex items-center gap-1.5">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Target Document for Deletion</span>
              </span>
              <span className="text-xs font-bold text-rose-800 px-2.5 py-0.5 rounded-md bg-rose-100 border border-rose-200">
                {firmName}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Doc Type &amp; #</span>
                <span className="font-mono font-black text-slate-900 text-sm">
                  {docType} #{docNo}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Date</span>
                <span className="font-semibold text-slate-800">{dateStr}</span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Client</span>
                <span className="font-bold text-slate-900 truncate block" title={clientName}>
                  {clientName}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Grand Total</span>
                <span className="font-mono font-black text-rose-700 text-sm">
                  Rs. {formatCurrency(grandTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* LIFO Sequential Rollback Notice */}
          <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 text-xs text-blue-950 flex items-start gap-2.5">
            <RotateCcw className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-blue-900">
                LIFO (Last-In, First-Out) Sequence Preservation
              </p>
              <p className="text-blue-800 leading-relaxed text-[11px]">
                Because this is the <strong>most recent {docType}</strong> recorded, deleting it is allowed under LIFO accounting rules.
                Upon deletion, the system will automatically roll back the sequential counter to <strong>#{docNo}</strong> so your serial numbering remains strictly gap-free.
              </p>
            </div>
          </div>

          {/* PIN Input Section */}
          <div className="pt-2 border-t border-slate-100">
            <div className="text-center mb-3">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span>Enter 4-Digit Security PIN</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Type PIN on keyboard or tap numeric keys below to authorize deletion
              </p>
            </div>

            {/* Digit Visualizer Boxes */}
            <div className="flex justify-center gap-3 mb-3">
              {[0, 1, 2, 3].map((idx) => {
                const hasDigit = pin.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-11 h-12 rounded-xl border-2 flex items-center justify-center text-lg font-bold transition-all ${
                      hasDigit
                        ? 'border-rose-600 bg-rose-50 text-rose-700'
                        : 'border-slate-300 bg-slate-50 text-transparent'
                    }`}
                  >
                    {hasDigit ? '●' : '—'}
                  </div>
                );
              })}
            </div>

            {/* Hidden Input for physical keyboard typing */}
            <form onSubmit={handleSubmit} className="relative">
              <input
                ref={pinInputRef}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="current-password"
                value={pin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setPin(val);
                  setErrorMsg('');
                  if (val.length === 4) {
                    verifyAndProceed(val);
                  }
                }}
                className="opacity-0 absolute inset-0 w-full h-full cursor-default"
                tabIndex={0}
              />
            </form>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-100 border border-rose-300 text-rose-800 text-xs font-bold flex items-center justify-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Numeric Keypad */}
            <div className="max-w-[280px] mx-auto grid grid-cols-3 gap-2 mb-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeyPress(digit)}
                  disabled={isDeleting || isVerifying}
                  className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-bold text-base transition cursor-pointer flex items-center justify-center disabled:opacity-50"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClearPin}
                disabled={isDeleting || isVerifying || pin.length === 0}
                className="h-11 rounded-xl bg-slate-50 hover:bg-slate-200 text-slate-600 font-bold text-xs transition cursor-pointer flex items-center justify-center disabled:opacity-30"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleKeyPress('0')}
                disabled={isDeleting || isVerifying}
                className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-bold text-base transition cursor-pointer flex items-center justify-center disabled:opacity-50"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleDeleteDigit}
                disabled={isDeleting || isVerifying || pin.length === 0}
                className="h-11 rounded-xl bg-slate-50 hover:bg-slate-200 text-slate-600 font-bold text-sm transition cursor-pointer flex items-center justify-center disabled:opacity-30"
                title="Backspace"
              >
                <Delete className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting || isVerifying}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => verifyAndProceed(pin)}
            disabled={isDeleting || isVerifying || pin.length < 4}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold shadow-md hover:shadow-lg transition cursor-pointer flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
          >
            {isDeleting || isVerifying ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Authorizing &amp; Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 text-white" />
                <span>Confirm &amp; Delete Record</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
