import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

interface Props {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<Props> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] pointer-events-none no-print">
      {toasts.map((toast) => {
        let accent = 'border-navy-600';
        let Icon = Info;
        let iconWrap = 'bg-navy-50 text-navy-700';
        if (toast.type === 'success') {
          accent = 'border-emerald-600';
          Icon = CheckCircle2;
          iconWrap = 'bg-emerald-50 text-emerald-700';
        } else if (toast.type === 'error') {
          accent = 'border-[#b3372f]';
          Icon = AlertCircle;
          iconWrap = 'bg-red-50 text-[#b3372f]';
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto bg-white border border-line border-l-4 ${accent} rounded-xl shadow-[0_8px_30px_-6px_rgba(12,28,51,0.25)] px-4 py-3 flex items-start gap-3 animate-in fade-in slide-in-from-top-3 duration-200`}
          >
            <span className={`w-8 h-8 rounded-lg ${iconWrap} flex items-center justify-center shrink-0`}>
              <Icon className="w-4.5 h-4.5" />
            </span>
            <div className="flex-1 text-[13px] font-medium leading-snug text-ink-900 pt-1">
              {toast.message}
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-ink-400 hover:text-ink-900 p-1 rounded-lg hover:bg-slate-100 transition"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
