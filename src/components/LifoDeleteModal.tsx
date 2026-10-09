import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  Trash2,
  X,
  AlertTriangle,
  RotateCcw,
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
      }, 50);
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
    if (pin.length < 6) {
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
    pinInputRef.current?.focus();
  };

  const verifyAndProceed = async (pinToTest: string) => {
    if (pinToTest.length < 4) {
      setErrorMsg('Please enter 4-digit Security PIN.');
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
        isValid = await gasApi.verifyPin(pinToTest);
      }

      if (!isValid) {
        setErrorMsg('Incorrect Security PIN. Deletion not authorized.');
        setIsVerifying(false);
        return;
      }

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-rose-200 overflow-hidden flex flex-col my-auto max-h-[94vh] sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact Header */}
        <div className="bg-gradient-to-r from-rose-900 via-rose-800 to-rose-950 px-4 py-3 sm:px-5 sm:py-3.5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-rose-200">
              <ShieldAlert className="w-5 h-5 text-rose-300" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm sm:text-base font-black tracking-tight leading-tight">
                  Delete Last Entry (LIFO)
                </h2>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/30 text-rose-200 border border-rose-400/40 uppercase">
                  PIN Auth
                </span>
              </div>
              <p className="text-[11px] text-rose-200/90 leading-tight">
                Permanent deletion for {docType} #{docNo}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-rose-300 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
            title="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable / Screen-fitted Body */}
        <div className="p-3.5 sm:p-4 space-y-2.5 overflow-y-auto">
          {/* Target Document Compact Chip */}
          <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200/90">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${
                    docType === 'BILL'
                      ? 'bg-blue-100 text-blue-900 border border-blue-200'
                      : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                  }`}
                >
                  {docType}
                </span>
                <span className="font-mono font-black text-slate-900 text-sm">
                  #{docNo}
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  · {dateStr}
                </span>
              </div>
              <span className="text-[10px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                {firmName}
              </span>
            </div>

            <div className="flex items-baseline justify-between gap-2 text-xs pt-0.5 border-t border-rose-100">
              <span className="font-bold text-slate-800 truncate" title={clientName}>
                {clientName}
              </span>
              <span className="font-mono font-black text-rose-700 text-sm whitespace-nowrap">
                Rs. {formatCurrency(grandTotal)}
              </span>
            </div>
          </div>

          {/* Sequential LIFO Rollback Note */}
          <div className="px-3 py-2 rounded-xl bg-blue-50/80 border border-blue-200 text-[11px] text-blue-950 flex items-center gap-2">
            <RotateCcw className="w-3.5 h-3.5 text-blue-700 shrink-0" />
            <span className="leading-snug">
              <strong>LIFO Rule:</strong> Counter automatically rolls back to <strong>#{docNo}</strong> so sequence stays gap-free.
            </span>
          </div>

          {/* PIN Input & Keypad */}
          <div className="pt-1">
            <div className="text-center mb-2">
              <div className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <Lock className="w-3 h-3 text-slate-500" />
                <span>Enter 4-Digit Security PIN</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Type on keyboard or tap numeric keys below
              </p>
            </div>

            {/* Digit Visualizer Boxes */}
            <div className="flex justify-center gap-2.5 mb-2.5">
              {[0, 1, 2, 3].map((idx) => {
                const hasDigit = pin.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center text-base font-bold transition-all ${
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

            {/* Hidden Input for Physical Keyboard typing */}
            <form onSubmit={handleSubmit} className="relative">
              <input
                ref={pinInputRef}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="current-password"
                value={pin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4);
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
              <div className="p-2 rounded-lg bg-rose-100 border border-rose-300 text-rose-800 text-[11px] font-bold flex items-center justify-center gap-1.5 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Compact Numeric Keypad */}
            <div className="max-w-[260px] mx-auto grid grid-cols-3 gap-1.5 mb-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeyPress(digit)}
                  disabled={isDeleting || isVerifying}
                  className="h-9 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-bold text-sm transition cursor-pointer flex items-center justify-center disabled:opacity-50"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClearPin}
                disabled={isDeleting || isVerifying || pin.length === 0}
                className="h-9 rounded-lg bg-slate-50 hover:bg-slate-200 text-slate-600 font-bold text-[11px] transition cursor-pointer flex items-center justify-center disabled:opacity-30"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleKeyPress('0')}
                disabled={isDeleting || isVerifying}
                className="h-9 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-bold text-sm transition cursor-pointer flex items-center justify-center disabled:opacity-50"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleDeleteDigit}
                disabled={isDeleting || isVerifying || pin.length === 0}
                className="h-9 rounded-lg bg-slate-50 hover:bg-slate-200 text-slate-600 font-bold text-xs transition cursor-pointer flex items-center justify-center disabled:opacity-30"
                title="Backspace"
              >
                <Delete className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Compact Modal Footer Actions */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting || isVerifying}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => verifyAndProceed(pin)}
            disabled={isDeleting || isVerifying || pin.length < 4}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold shadow-sm hover:shadow transition cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none"
          >
            {isDeleting || isVerifying ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5 text-white" />
                <span>Confirm &amp; Delete</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
