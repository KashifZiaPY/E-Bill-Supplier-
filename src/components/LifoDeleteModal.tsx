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
  onConfirmDelete: (doc: DocumentRecord, authorityPin: string) => Promise<void>;
  /** When true, the entered PIN is sent as the deletion authority PIN and verified by the server. */
  deletePinRequired?: boolean;
  /** 'cancel' reuses this PIN gate to void a document instead of deleting it. */
  mode?: 'delete' | 'cancel';
  onConfirmCancel?: (doc: DocumentRecord, authorityPin: string) => Promise<void>;
  isDeleting: boolean;
}

export const LifoDeleteModal: React.FC<Props> = ({
  isOpen,
  doc,
  onClose,
  onConfirmDelete,
  onConfirmCancel,
  isDeleting,
  deletePinRequired,
  mode = 'delete',
}) => {
  const [pin, setPin] = useState('');
  const maxPinLen = deletePinRequired ? 8 : 4;
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

  const verifyAndProceed = async (pinToTest: string) => {
    if (pinToTest.length < 4) {
      setErrorMsg('Please enter the 4-digit PIN.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg('');

    try {
      if (deletePinRequired || mode === 'cancel') {
        // The server verifies the authority PIN; a wrong one throws
        // DeletePinRequiredError up through the confirm handler and we stay open.
        if (doc) {
          if (mode === 'cancel' && onConfirmCancel) await onConfirmCancel(doc, pinToTest);
          else await onConfirmDelete(doc, pinToTest);
        }
        return;
      }
      // No separate deletion PIN configured: the portal (session) PIN authorizes.
      const sessionPin = gasApi.getPin();
      if (!sessionPin || pinToTest !== sessionPin) {
        setErrorMsg('Incorrect PIN. Deletion not authorized.');
        setIsVerifying(false);
        return;
      }
      if (doc) {
        await onConfirmDelete(doc, pinToTest);
      }
    } catch (err: any) {
      const msg = String(err?.message || '');
      setErrorMsg(
        /delete authority pin/i.test(msg)
          ? 'Wrong deletion PIN. The document was NOT deleted.'
          : (msg || 'PIN authorization failed.')
      );
      setIsVerifying(false);
    }
  };

  // Full physical keyboard & num keypad event listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isDeleting || isVerifying) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Backspace' || e.key === 'Delete' || e.code === 'NumpadDecimal') {
        e.preventDefault();
        setPin((prev) => prev.slice(0, -1));
        setErrorMsg('');
        return;
      }

      if (e.key === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        if (pin.length >= 4) {
          verifyAndProceed(pin);
        } else {
          setErrorMsg('Please enter the 4-digit PIN.');
        }
        return;
      }

      // Capture all numeric keys (0-9 from top row and Numpad0-Numpad9 regardless of NumLock state)
      let digit: string | null = null;
      if (/^[0-9]$/.test(e.key)) {
        digit = e.key;
      } else if (/^Numpad([0-9])$/i.test(e.code)) {
        const match = e.code.match(/^Numpad([0-9])$/i);
        if (match) digit = match[1];
      } else if (/^Digit([0-9])$/i.test(e.code)) {
        const match = e.code.match(/^Digit([0-9])$/i);
        if (match) digit = match[1];
      }

      if (digit !== null) {
        e.preventDefault();
        setPin((prev) => {
          if (prev.length >= maxPinLen) return prev;
          const next = prev + digit;
          setErrorMsg('');
          if (!deletePinRequired && next.length === 4) {
            setTimeout(() => {
              verifyAndProceed(next);
            }, 60);
          }
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, pin, isDeleting, isVerifying, doc, maxPinLen, deletePinRequired]);

  if (!isOpen || !doc) return null;

  const docType = String(doc.type || doc.Type || 'BILL').toUpperCase();
  const docNo = String(doc.docNo || doc.DocNo || '—');
  const clientName = String(doc.clientName || doc.ClientName || 'Client');
  const dateStr = formatDateDisplay(doc.date || doc.Date);
  const grandTotal = Number(doc.grandTotal ?? doc.GrandTotal ?? 0);
  const firmName = String(doc.firmName || 'Anwar Traders');

  const handleKeypadPress = (digit: string) => {
    if (pin.length < maxPinLen) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setErrorMsg('');
      if (!deletePinRequired && nextPin.length === 4) {
        setTimeout(() => verifyAndProceed(nextPin), 60);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyAndProceed(pin);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-navy-950/70 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm sm:max-w-md bg-white rounded-2xl shadow-2xl border border-line overflow-hidden flex flex-col my-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-navy-950 px-4 py-3.5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-[#b3372f]/20 border border-[#b3372f]/40 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-red-300" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-extrabold tracking-tight">{mode === 'cancel' ? 'Cancel Document' : 'Delete Last Entry'}</h2>
                <span className="corp-chip bg-[#b3372f]/20 text-red-200 border border-[#b3372f]/40">LIFO · PIN</span>
              </div>
              <p className="text-[11px] text-navy-200">{mode === 'cancel' ? 'Void (kept for audit)' : 'Permanent deletion'} · {docType} #{docNo}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition" title="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <div className="corp-card !border-red-200 p-3.5 bg-red-50/40">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className={`corp-chip ${docType === 'BILL' ? 'bg-navy-900 text-white' : 'bg-gold-100 text-gold-700 border border-gold-200'}`}>
                  {docType} #{docNo}
                </span>
                <span className="text-[11px] text-ink-400 font-medium">{dateStr}</span>
              </div>
              <span className="text-[10px] font-bold text-ink-500">{firmName}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2 pt-2 border-t border-red-100">
              <span className="font-bold text-[13px] text-ink-900 truncate" title={clientName}>{clientName}</span>
              <span className="font-mono font-extrabold text-[#b3372f] whitespace-nowrap">Rs. {formatCurrency(grandTotal)}</span>
            </div>
          </div>

          <div className="px-3.5 py-2.5 rounded-xl bg-navy-50 border border-navy-100 text-[11px] text-navy-900 flex items-center gap-2">
            <RotateCcw className="w-3.5 h-3.5 text-navy-700 shrink-0" />
            <span className="leading-snug">
              <strong>LIFO protocol:</strong> numbering continues from the next free number, so no two bills ever share a number.
            </span>
          </div>

          <div>
            <div className="text-center mb-2">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-ink-700 uppercase tracking-[0.1em]">
                <Lock className="w-3 h-3 text-ink-400" />
                <span>{deletePinRequired ? 'Enter Deletion PIN' : 'Enter 4-digit PIN'}</span>
              </div>
            </div>

            <div className="flex justify-center gap-2.5 mb-2.5">
              {Array.from({ length: Math.max(4, pin.length) }).map((_, idx) => {
                const hasDigit = pin.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-10 h-11 rounded-xl border-2 flex items-center justify-center text-base font-bold transition-all ${
                      hasDigit ? 'border-navy-700 bg-navy-50 text-navy-800' : 'border-line bg-paper text-transparent'
                    }`}
                  >
                    {hasDigit ? '●' : '–'}
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleSubmit} className="relative">
              <input
                ref={pinInputRef}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="current-password"
                value={pin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, maxPinLen);
                  setPin(val);
                  setErrorMsg('');
                  if (!deletePinRequired && val.length === 4) verifyAndProceed(val);
                }}
                className="opacity-0 absolute inset-0 w-full h-full cursor-default"
                tabIndex={0}
              />
            </form>

            {errorMsg && (
              <div className="px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-[#96291f] text-[11px] font-bold flex items-center justify-center gap-1.5 mb-2.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="max-w-[248px] mx-auto grid grid-cols-3 gap-1.5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeypadPress(digit)}
                  disabled={isDeleting || isVerifying}
                  className="h-10 rounded-xl bg-paper hover:bg-navy-50 text-ink-900 font-bold text-[15px] border border-transparent hover:border-navy-100 transition disabled:opacity-50"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClearPin}
                disabled={isDeleting || isVerifying || pin.length === 0}
                className="h-10 rounded-xl bg-paper hover:bg-navy-50 text-ink-500 font-bold text-[11px] uppercase tracking-wide transition disabled:opacity-30"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('0')}
                disabled={isDeleting || isVerifying}
                className="h-10 rounded-xl bg-paper hover:bg-navy-50 text-ink-900 font-bold text-[15px] border border-transparent hover:border-navy-100 transition disabled:opacity-50"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleDeleteDigit}
                disabled={isDeleting || isVerifying || pin.length === 0}
                className="h-10 rounded-xl bg-paper hover:bg-navy-50 text-ink-700 transition disabled:opacity-30 flex items-center justify-center"
                title="Backspace"
              >
                <Delete className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 bg-paper border-t border-line flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting || isVerifying}
            className="corp-btn-ghost !py-2 text-xs disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => verifyAndProceed(pin)}
            disabled={isDeleting || isVerifying || pin.length < 4}
            className="corp-btn-danger !py-2 text-xs disabled:opacity-40"
          >
            {isDeleting || isVerifying ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Deleting…</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>{mode === 'cancel' ? 'Confirm & Cancel' : 'Confirm & Delete'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
