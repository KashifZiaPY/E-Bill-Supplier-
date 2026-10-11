import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, X, AlertTriangle, Building2, Check } from 'lucide-react';
import type { DocumentRecord, FirmProfile } from '../types/billing';
import { formatCurrency, formatDateDisplay } from '../utils/formatters';

interface Props {
  isOpen: boolean;
  doc: DocumentRecord | null;
  firms: FirmProfile[];
  onClose: () => void;
  onConfirm: (doc: DocumentRecord, targetFirmId: string) => Promise<void>;
  isSwitching: boolean;
}

/**
 * Moves a document to the other firm.
 * Drafts: free move, no number involved.
 * Issued: re-issued under the target firm's next number; the old number
 * is left vacant (a gap, which is allowed — duplicates are not).
 */
export const SwitchFirmModal: React.FC<Props> = ({
  isOpen,
  doc,
  firms,
  onClose,
  onConfirm,
  isSwitching,
}) => {
  const [targetFirmId, setTargetFirmId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen && doc) {
      const currentId = String(doc.firmId || '');
      const other = firms.find((f) => String(f.id) !== currentId);
      setTargetFirmId(other ? String(other.id) : '');
      setErrorMsg('');
    }
  }, [isOpen, doc, firms]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSwitching) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, isSwitching]);

  if (!isOpen || !doc) return null;

  const docType = String(doc.type || doc.Type || 'BILL').toUpperCase();
  const docNo = String(doc.docNo || doc.DocNo || '—');
  const clientName = String(doc.clientName || doc.ClientName || 'Client');
  const dateStr = formatDateDisplay(doc.date || doc.Date);
  const grandTotal = Number(doc.grandTotal ?? (doc as any).GrandTotal ?? 0);
  const isDraft = String((doc as any).status || 'Active').toUpperCase() === 'DRAFT';
  const currentFirmId = String(doc.firmId || '');
  const currentFirm = firms.find((f) => String(f.id) === currentFirmId);
  const targetFirm = firms.find((f) => String(f.id) === targetFirmId);
  const nextNo = targetFirm
    ? docType === 'BILL'
      ? targetFirm.nextBillNo
      : targetFirm.nextQuoteNo
    : '—';

  const handleConfirm = async () => {
    if (!targetFirmId) {
      setErrorMsg('Please choose the firm to move this document to.');
      return;
    }
    if (targetFirmId === currentFirmId) {
      setErrorMsg('This document is already under the selected firm.');
      return;
    }
    setErrorMsg('');
    try {
      await onConfirm(doc, targetFirmId);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not switch firm. Please retry.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-navy-950/70 backdrop-blur-[2px]"
      onClick={() => { if (!isSwitching) onClose(); }}
    >
      <div
        className="w-full max-w-sm sm:max-w-md bg-white rounded-2xl shadow-2xl border border-line overflow-hidden flex flex-col my-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-navy-950 px-4 py-3.5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-gold-500/20 border border-gold-500/40 flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5 text-gold-300" />
            </span>
            <div>
              <h2 className="text-[15px] font-extrabold tracking-tight">Switch Firm</h2>
              <p className="text-[11px] text-navy-200">{docType} #{docNo} · {dateStr}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSwitching}
            className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <div className="corp-card p-3.5">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className={`corp-chip ${docType === 'BILL' ? 'bg-navy-900 text-white' : 'bg-gold-100 text-gold-700 border border-gold-200'}`}>
                {docType} #{docNo}
              </span>
              {isDraft && (
                <span className="corp-chip bg-navy-50 text-navy-700 border border-navy-100">DRAFT</span>
              )}
            </div>
            <div className="flex items-baseline justify-between gap-2 pt-2 border-t border-line">
              <span className="font-bold text-[13px] text-ink-900 truncate" title={clientName}>{clientName}</span>
              <span className="font-mono font-extrabold text-navy-900 whitespace-nowrap">Rs. {formatCurrency(grandTotal)}</span>
            </div>
            <p className="text-[11px] text-ink-500 mt-1.5">
              Currently under <strong className="text-ink-800">{currentFirm?.name || doc.firmName || '—'}</strong> · {doc.items?.length ?? 0} item(s) move with it — nothing to retype.
            </p>
          </div>

          <div>
            <label className="text-[11px] font-bold text-ink-500 uppercase tracking-wider block mb-1.5">
              Move to firm
            </label>
            <div className="space-y-2">
              {firms
                .filter((f) => String(f.id) !== currentFirmId)
                .map((f) => {
                  const fid = String(f.id);
                  const selected = targetFirmId === fid;
                  return (
                    <button
                      key={fid}
                      onClick={() => setTargetFirmId(fid)}
                      className={`w-full text-left px-3.5 py-3 rounded-xl border-2 transition flex items-center gap-3 ${
                        selected
                          ? 'border-navy-800 bg-navy-50'
                          : 'border-line bg-white hover:border-navy-200'
                      }`}
                    >
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        selected ? 'bg-navy-900 text-white' : 'bg-paper text-ink-500'
                      }`}>
                        {selected ? <Check className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                      </span>
                      <span>
                        <span className="block font-bold text-[13px] text-ink-900">{f.name}</span>
                        <span className="block text-[11px] text-ink-500">
                          Next {docType === 'BILL' ? 'bill' : 'quotation'} number: <strong className="text-ink-800 font-mono">{docType === 'BILL' ? f.nextBillNo : f.nextQuoteNo}</strong>
                        </span>
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>

          {targetFirm && (
            <div className="px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span className="leading-snug">
                {isDraft ? (
                  <>This is a draft, so it moves freely with <strong>no number change</strong>. It will take {targetFirm.name}'s next number when finalized.</>
                ) : (
                  <>This issued {docType.toLowerCase()} will be <strong>re-numbered as {targetFirm.name} #{nextNo}</strong>. The old number ({currentFirm?.name} #{docNo}) stays vacant — a gap, never a duplicate. If the old copy was already printed or shared, that paper copy becomes stale.</>
                )}
              </span>
            </div>
          )}

          {errorMsg && (
            <p className="text-[12px] font-semibold text-[#b3372f] bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
              {errorMsg}
            </p>
          )}
        </div>

        <div className="px-4 py-3 border-t border-line bg-paper/60 flex gap-2 shrink-0">
          <button
            onClick={onClose}
            disabled={isSwitching}
            className="flex-1 px-4 py-2.5 rounded-xl border border-line bg-white font-bold text-[13px] text-ink-700 hover:bg-paper transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSwitching || !targetFirmId}
            className="flex-1 px-4 py-2.5 rounded-xl bg-navy-900 text-white font-bold text-[13px] hover:bg-navy-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSwitching ? (
              <>Moving…</>
            ) : (
              <><ArrowRightLeft className="w-4 h-4" /> Move to {targetFirm ? targetFirm.name.split(' ')[0] : 'firm'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
