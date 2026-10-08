import React, { useState } from 'react';
import { Lock, Delete, ArrowRight, ShieldCheck } from 'lucide-react';

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
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-slate-200 p-6 md:p-8 flex flex-col items-center">
        {/* Header Icon */}
        <div className="w-16 h-16 rounded-2xl bg-[#1F3A5F]/10 flex items-center justify-center text-[#1F3A5F] mb-4">
          <ShieldCheck className="w-9 h-9" />
        </div>

        <h1 className="text-2xl font-black text-slate-800 tracking-tight text-center">
          Anwar Traders
        </h1>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest text-center mt-1">
          Billing & Invoicing Portal
        </p>

        {/* PIN Input representation */}
        <div className="my-6 w-full">
          <div className="flex justify-center gap-3 mb-3">
            {[0, 1, 2, 3].map((idx) => {
              const hasDigit = pin.length > idx;
              return (
                <div
                  key={idx}
                  className={`w-12 h-14 rounded-xl border-2 flex items-center justify-center text-xl font-bold transition-all ${
                    hasDigit
                      ? 'border-[#1F3A5F] bg-[#1F3A5F]/5 text-[#1F3A5F]'
                      : 'border-slate-300 bg-slate-50 text-transparent'
                  }`}
                >
                  {hasDigit ? '●' : '—'}
                </div>
              );
            })}
          </div>

          {/* Form for physical keyboard typing */}
          <form onSubmit={handleSubmit} className="relative">
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
              placeholder="Type PIN here"
              className="w-full text-center tracking-widest text-lg font-bold border border-slate-200 rounded-xl py-2 px-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]"
              maxLength={8}
            />
          </form>
        </div>

        {/* Error message */}
        {displayedError && (
          <div className="w-full mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium text-center animate-in fade-in">
            {displayedError}
          </div>
        )}

        {/* Touch keypad */}
        <div className="grid grid-cols-3 gap-3 w-full mb-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              disabled={isLoading}
              onClick={() => handleKeyPress(String(num))}
              className="h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-xl font-bold text-slate-800 flex items-center justify-center transition shadow-sm cursor-pointer select-none"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            disabled={isLoading || pin.length === 0}
            onClick={handleClear}
            className="h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center justify-center transition shadow-sm cursor-pointer select-none disabled:opacity-40"
          >
            Clear
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => handleKeyPress('0')}
            className="h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-xl font-bold text-slate-800 flex items-center justify-center transition shadow-sm cursor-pointer select-none"
          >
            0
          </button>
          <button
            type="button"
            disabled={isLoading || pin.length === 0}
            onClick={handleDelete}
            className="h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 flex items-center justify-center transition shadow-sm cursor-pointer select-none disabled:opacity-40"
            aria-label="Delete"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Submit button */}
        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={isLoading || pin.length < 4}
          className="w-full py-3.5 px-4 rounded-xl bg-[#1F3A5F] hover:bg-[#162a45] active:scale-[0.99] text-white font-bold flex items-center justify-center gap-2 shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Verifying PIN...</span>
            </div>
          ) : (
            <>
              <span>Unlock App</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        <p className="text-[11px] text-slate-500 mt-4 text-center">
          Default PIN is <strong>1234</strong> (or the PIN configured in your environment).
        </p>
      </div>

      <div className="mt-6 text-center text-xs text-slate-500">
        Developed by MKZ
      </div>
    </div>
  );
};
