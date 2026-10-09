import React, { useState } from 'react';
import { Delete, ArrowRight, ShieldCheck } from 'lucide-react';

interface Props {
  onSuccess: (pin: string) => void;
  isLoading: boolean;
  errorMessage?: string;
}

export const PinScreen: React.FC<Props> = ({ onSuccess, isLoading, errorMessage }) => {
  const [pin, setPin] = useState('');
  const [localError, setLocalError] = useState('');

  const handleKeyPress = (num: string) => {
    if (pin.length < 8) {
      const nextPin = pin + num;
      setPin(nextPin);
      setLocalError('');
      if (nextPin.length === 4) {
        onSuccess(nextPin);
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setLocalError('');
  };

  const handleClear = () => {
    setPin('');
    setLocalError('');
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pin) {
      setLocalError('Please enter your 4-digit security PIN');
      return;
    }
    onSuccess(pin);
  };

  const displayedError = errorMessage || localError;

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Subtle corporate backdrop */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute -top-40 -right-40 w-[480px] h-[480px] rounded-full bg-navy-700/40 blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 w-[480px] h-[480px] rounded-full bg-gold-600/10 blur-[120px]" />
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600" />
      </div>

      <div className="relative w-full max-w-sm corp-card p-6 md:p-8 flex flex-col items-center">
        {/* Brand mark */}
        <div className="w-16 h-16 rounded-2xl bg-navy-900 text-gold-400 shadow-md flex items-center justify-center mb-4 ring-1 ring-gold-500/40">
          <ShieldCheck className="w-8 h-8" />
        </div>

        <h1 className="text-lg font-extrabold text-ink-900 tracking-tight text-center">
          MIAN FARHAN ANWAR
        </h1>
        <p className="text-[11px] font-semibold text-ink-500 uppercase tracking-[0.14em] text-center mt-1">
          Enterprise Billing Portal
        </p>
        <span className="corp-chip bg-navy-50 text-navy-800 border border-navy-100 mt-2.5">
          Anwar Traders · Hashir Traders
        </span>

        {/* PIN dots */}
        <div className="mt-7 mb-4 w-full">
          <div className="flex justify-center gap-3">
            {[0, 1, 2, 3].map((idx) => {
              const hasDigit = pin.length > idx;
              return (
                <div
                  key={idx}
                  className={`w-12 h-14 rounded-xl border-2 flex items-center justify-center text-xl font-bold transition-all ${
                    hasDigit
                      ? 'border-navy-700 bg-navy-50 text-navy-800'
                      : 'border-line bg-paper text-transparent'
                  }`}
                >
                  {hasDigit ? '●' : '–'}
                </div>
              );
            })}
          </div>

          {/* Physical keyboard entry */}
          <form onSubmit={handleSubmit} className="mt-4">
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoFocus
              autoComplete="current-password"
              value={pin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setPin(val);
                setLocalError('');
                if (val.length === 4) {
                  onSuccess(val);
                }
              }}
              placeholder="Type PIN on keyboard"
              className="corp-input text-center tracking-[0.3em] font-bold"
              maxLength={8}
            />
          </form>
        </div>

        {displayedError && (
          <div className="w-full mb-4 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200 text-[#96291f] text-xs font-semibold text-center">
            {displayedError}
          </div>
        )}

        {/* Touch keypad */}
        <div className="grid grid-cols-3 gap-2.5 w-full mb-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              disabled={isLoading}
              onClick={() => handleKeyPress(String(num))}
              className="h-13 py-3 rounded-xl bg-paper hover:bg-navy-50 active:bg-navy-100 text-lg font-bold text-ink-900 border border-transparent hover:border-navy-100 flex items-center justify-center transition select-none disabled:opacity-40"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            disabled={isLoading || pin.length === 0}
            onClick={handleClear}
            className="py-3 rounded-xl bg-paper hover:bg-navy-50 text-[11px] font-bold uppercase tracking-wider text-ink-500 flex items-center justify-center transition select-none disabled:opacity-40"
          >
            Clear
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => handleKeyPress('0')}
            className="py-3 rounded-xl bg-paper hover:bg-navy-50 active:bg-navy-100 text-lg font-bold text-ink-900 border border-transparent hover:border-navy-100 flex items-center justify-center transition select-none disabled:opacity-40"
          >
            0
          </button>
          <button
            type="button"
            disabled={isLoading || pin.length === 0}
            onClick={handleDelete}
            className="py-3 rounded-xl bg-paper hover:bg-navy-50 text-ink-700 flex items-center justify-center transition select-none disabled:opacity-40"
            aria-label="Delete digit"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={isLoading || pin.length < 4}
          className="corp-btn-primary w-full py-3.5"
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Verifying…</span>
            </>
          ) : (
            <>
              <span>Unlock Portal</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        <p className="text-[11px] text-ink-400 mt-4 text-center">
          Default PIN is <strong className="text-ink-700">1234</strong>
        </p>
      </div>

      <p className="relative mt-6 text-[11px] font-medium tracking-wide text-navy-200/70">
        MIAN FARHAN ANWAR Enterprise Systems
      </p>
    </div>
  );
};
