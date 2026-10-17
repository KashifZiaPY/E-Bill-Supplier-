import React, { useMemo, useRef, useState } from 'react';
import { X, FileUp, Loader2, CheckCircle2, AlertTriangle, Trash2, Building2 } from 'lucide-react';
import type { SavedClient } from '../types/billing';
import {
  buildPoRefText,
  validatePo,
  type PoData,
  type PoItem,
} from '../utils/poImport';
import { extractPoFromPdf } from '../utils/poExtract';

export interface PoApplyPayload {
  clientName: string;
  clientAddress: string;
  clientNTN: string;
  refText: string;
  gstRatePercent: number | null;
  items: { description: string; unit: string; qty: number; rate: number; tax: 'GST' | 'PST' | 'None'; gstRate?: number }[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clients: SavedClient[];
  activeFirmName: string;
  onApply: (payload: PoApplyPayload) => void;
}

type Phase = 'pick' | 'reading' | 'review' | 'error';

const fmt = (n: number) => n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const normName = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

/** Best token-overlap match of the PO's institute name against saved clients. */
function matchClient(name: string, clients: SavedClient[]): SavedClient | null {
  const target = new Set(normName(name).split(' ').filter((t) => t.length > 2));
  if (target.size === 0) return null;
  let best: SavedClient | null = null;
  let bestScore = 0;
  for (const c of clients || []) {
    const cn = normName(String((c as any)?.name || (c as any)?.Name || ''));
    if (!cn) continue;
    const toks = new Set(cn.split(' ').filter((t) => t.length > 2));
    let hit = 0;
    for (const t of toks) if (target.has(t)) hit++;
    const score = toks.size ? hit / toks.size : 0;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return bestScore >= 0.6 ? best : null;
}

export const PoImportModal: React.FC<Props> = ({ isOpen, onClose, clients, activeFirmName, onApply }) => {
  const [phase, setPhase] = useState<Phase>('pick');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [po, setPo] = useState<PoData | null>(null);
  const [rows, setRows] = useState<PoItem[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPhase('pick');
    setProgress('');
    setError('');
    setPo(null);
    setRows([]);
    setFileName('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (f: File | undefined) => {
    if (!f) return;
    if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') {
      setError('Please choose a PDF file — the Purchase Order must be a PDF.');
      setPhase('error');
      return;
    }
    setFileName(f.name);
    setPhase('reading');
    setProgress('Reading PDF…');
    try {
      const data = await extractPoFromPdf(f, setProgress);
      if (!data.items || data.items.length === 0) {
        setError('No item table could be read from this PDF. Check that it is a Purchase Order with an items table (Description / Quantity / Price / Amount columns), then try again — or enter the bill manually.');
        setPhase('error');
        return;
      }
      setPo(data);
      setRows(data.items.map((it) => ({ ...it })));
      setPhase('review');
    } catch (e: any) {
      setError(e?.message || 'Could not read this PDF.');
      setPhase('error');
    }
  };

  const editedPo: PoData | null = useMemo(() => (po ? { ...po, items: rows } : null), [po, rows]);
  const validation = useMemo(() => (editedPo ? validatePo(editedPo) : null), [editedPo]);
  const matchedClient = useMemo(
    () => (po ? matchClient(po.clientName, clients) : null),
    [po, clients]
  );

  const supplierMismatch = useMemo(() => {
    if (!po?.supplier || !activeFirmName) return false;
    const a = normName(po.supplier);
    const b = normName(activeFirmName);
    return !!a && !!b && !a.includes(b) && !b.includes(a);
  }, [po, activeFirmName]);

  if (!isOpen) return null;

  const updateRow = (i: number, patch: Partial<PoItem>) => {
    setRows((prev) => prev.map((r, idx) => {
      if (idx !== i) return r;
      const next = { ...r, ...patch };
      // Keep the printed amount in step when qty/rate are corrected by hand,
      // unless the user is editing the amount itself.
      if ((patch.qty !== undefined || patch.rate !== undefined) && patch.amount === undefined) {
        next.amount = Math.round((Number(next.qty) || 0) * (Number(next.rate) || 0) * 100) / 100;
        // If this row's tax cell was never read (0), estimate it at the PO's
        // dominant rate so the footing check can go green once fixed.
        if (!next.taxAmount && validation?.dominantRatePercent) {
          next.taxAmount = Math.round(next.amount * (validation.dominantRatePercent / 100) * 100) / 100;
        }
      }
      return next;
    }));
  };

  const handleApply = () => {
    if (!po || !validation) return;
    const clientNameOut = matchedClient
      ? String((matchedClient as any).name || (matchedClient as any).Name || po.clientName)
      : po.clientName;
    const payload: PoApplyPayload = {
      clientName: clientNameOut || '',
      clientAddress: matchedClient
        ? String((matchedClient as any).address || (matchedClient as any).Address || '')
        : po.clientAddress || '',
      clientNTN: matchedClient
        ? String((matchedClient as any).ntn || (matchedClient as any).NTN || '')
        : '',
      refText: buildPoRefText(po),
      gstRatePercent: validation.dominantRatePercent,
      items: rows.map((r, i) => {
        const rc = validation.rowChecks[i];
        return {
          description: r.description,
          unit: r.unit || 'Nos',
          qty: Number(r.qty) || 0,
          rate: Number(r.rate) || 0,
          tax: 'GST' as const,
          gstRate: rc?.derivedRatePercent ? rc.derivedRatePercent / 100 : undefined,
        };
      }),
    };
    onApply(payload);
    reset();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-navy-950/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full max-w-3xl max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-navy-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileUp className="w-5 h-5 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-extrabold text-[15px] leading-tight">Import Purchase Order (PDF)</h2>
              <p className="text-[11px] text-white/60 truncate">{fileName || 'Reads the PO and fills the bill form — nothing is saved until you review it.'}</p>
            </div>
          </div>
          <button type="button" onClick={handleClose} className="p-1.5 hover:bg-white/10 rounded-lg transition shrink-0" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4">
          {phase === 'pick' && (
            <div className="py-6">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-navy-200 hover:border-navy-400 rounded-2xl py-10 px-4 flex flex-col items-center gap-2 transition bg-navy-50/50"
              >
                <FileUp className="w-9 h-9 text-navy-700" />
                <span className="font-bold text-navy-900 text-sm">Choose the Purchase Order PDF</span>
                <span className="text-xs text-ink-500 text-center">Text PDFs read instantly. Picture/scanned PDFs are read with OCR<br className="hidden sm:block" /> and every figure is cross-checked against the PO's own totals.</span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
              />
            </div>
          )}

          {phase === 'reading' && (
            <div className="py-12 flex flex-col items-center gap-3">
              <Loader2 className="w-9 h-9 text-navy-700 animate-spin" />
              <p className="text-sm font-semibold text-ink-700 text-center">{progress}</p>
              <p className="text-xs text-ink-400">Keep this open — OCR of a picture PDF can take up to a minute.</p>
            </div>
          )}

          {phase === 'error' && (
            <div className="py-8 flex flex-col items-center gap-3 text-center">
              <AlertTriangle className="w-9 h-9 text-amber-500" />
              <p className="text-sm font-semibold text-ink-800 max-w-md">{error}</p>
              <button type="button" onClick={reset} className="corp-btn-gold !py-2 mt-1">Try another file</button>
            </div>
          )}

          {phase === 'review' && po && validation && (
            <div>
              {/* Header fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-[13px]">
                <div className="bg-paper rounded-xl border border-line px-3.5 py-2.5">
                  <span className="corp-label !mb-0.5">Client (from PO)</span>
                  <div className="font-bold text-ink-900">{po.clientName || '—'}</div>
                  {matchedClient ? (
                    <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3.5 h-3.5" /> Matched with your saved client — its address &amp; NTN will be used.
                    </div>
                  ) : (
                    <div className="text-[11px] text-amber-700 font-semibold mt-0.5">Not matched with a saved client — name/address from the PO will be used.</div>
                  )}
                </div>
                <div className="bg-paper rounded-xl border border-line px-3.5 py-2.5">
                  <span className="corp-label !mb-0.5">Reference that will be filled</span>
                  <div className="font-bold text-ink-900">{buildPoRefText(po) || '—'}</div>
                  <div className="text-[11px] text-ink-500 mt-0.5">
                    Supplier on PO: <strong>{po.supplier || '—'}</strong> · Read via {po.source === 'text' ? 'PDF text (exact)' : 'OCR — please verify flagged rows'}
                  </div>
                </div>
              </div>

              {supplierMismatch && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-[13px] font-semibold flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>This PO is issued to <strong>{po.supplier}</strong>, but you are billing under <strong>{activeFirmName}</strong>. Switch the firm first if this is the wrong one — the items will still be filled if you continue.</span>
                </div>
              )}

              {/* Validation banner */}
              {validation.totalsMatch === true && validation.issueCount === 0 ? (
                <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[13px] font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  All checks pass — every row's Qty × Rate matches, and the rows foot exactly to the PO totals ({fmt(validation.sumExclusive)} + tax {fmt(validation.sumTax)} = {fmt(validation.sumInclusive)}).
                </div>
              ) : (
                <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-[13px] font-semibold flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    {validation.rowChecks.filter((r) => !r.amountOk).length > 0 && <>Some rows are flagged below — their Qty × Rate does not match the PO amount. Correct them against the printed PO before filling. </>}
                    {validation.totalsMatch === false && <>Row totals ({fmt(validation.sumExclusive)} excl. / {fmt(validation.sumTax)} tax) do not match the PO's printed totals ({po.totalExclusive !== null ? fmt(po.totalExclusive) : '—'} / {po.totalTax !== null ? fmt(po.totalTax) : '—'}) — a figure was probably mis-read. </>}
                    {validation.totalsMatch === null && validation.issueCount === 0 && <>The PO's printed totals were not read, so footing could not be cross-checked — row checks only. </>}
                  </span>
                </div>
              )}

              {/* Items table (editable) */}
              <div className="border border-line rounded-xl overflow-x-auto">
                <table className="w-full text-xs min-w-[560px]">
                  <thead>
                    <tr className="bg-navy-50 text-left text-ink-600">
                      <th className="px-2 py-2 font-bold w-8">#</th>
                      <th className="px-2 py-2 font-bold">Description</th>
                      <th className="px-2 py-2 font-bold w-16">Unit</th>
                      <th className="px-2 py-2 font-bold w-16 text-right">Qty</th>
                      <th className="px-2 py-2 font-bold w-24 text-right">Rate</th>
                      <th className="px-2 py-2 font-bold w-24 text-right">Amount</th>
                      <th className="px-2 py-2 font-bold w-20 text-right">Tax</th>
                      <th className="px-2 py-2 font-bold w-14 text-right">GST%</th>
                      <th className="px-1 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const rc = validation.rowChecks[i];
                      const bad = rc && !rc.amountOk;
                      return (
                        <tr key={i} className={`border-t border-line ${bad ? 'bg-red-50' : ''}`}>
                          <td className="px-2 py-1.5 text-ink-400 font-semibold">{i + 1}</td>
                          <td className="px-1 py-1">
                            <input value={r.description} onChange={(e) => updateRow(i, { description: e.target.value })} className="corp-input !py-1.5 !px-2 text-xs" />
                          </td>
                          <td className="px-1 py-1">
                            <input value={r.unit} onChange={(e) => updateRow(i, { unit: e.target.value })} className="corp-input !py-1.5 !px-2 text-xs" />
                          </td>
                          <td className="px-1 py-1">
                            <input type="number" value={r.qty || ''} onChange={(e) => updateRow(i, { qty: Number(e.target.value) || 0 })} className="corp-input !py-1.5 !px-2 text-xs text-right" />
                          </td>
                          <td className="px-1 py-1">
                            <input type="number" value={r.rate || ''} onChange={(e) => updateRow(i, { rate: Number(e.target.value) || 0 })} className="corp-input !py-1.5 !px-2 text-xs text-right" />
                          </td>
                          <td className={`px-2 py-1.5 text-right font-semibold ${bad ? 'text-[#b3372f]' : 'text-ink-800'}`} title={bad ? `Qty × Rate = ${fmt(r.qty * r.rate)} — differs by ${fmt(rc.amountDiff)}` : ''}>
                            {fmt(r.amount)}
                          </td>
                          <td className="px-2 py-1.5 text-right text-ink-600">{r.taxAmount ? fmt(r.taxAmount) : '—'}</td>
                          <td className="px-2 py-1.5 text-right text-ink-600">{rc?.derivedRatePercent !== null && rc?.derivedRatePercent !== undefined ? rc.derivedRatePercent : '—'}</td>
                          <td className="px-1 py-1 text-right">
                            <button type="button" onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))} className="p-1 text-ink-300 hover:text-[#b3372f] transition" aria-label="Remove row">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-line bg-paper font-bold text-ink-900">
                      <td colSpan={5} className="px-2 py-2 text-right">Totals (excl. / tax / incl.)</td>
                      <td className="px-2 py-2 text-right">{fmt(validation.sumExclusive)}</td>
                      <td className="px-2 py-2 text-right">{fmt(validation.sumTax)}</td>
                      <td className="px-2 py-2 text-right" colSpan={2}>{fmt(validation.sumInclusive)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="text-[11px] text-ink-400 mt-2">All items are filled as Goods (GST) — a services row can be switched to PST in the bill form after filling. The bill date stays today; the PO date goes in the reference.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {phase === 'review' && (
          <div className="border-t border-line px-5 py-3.5 flex items-center justify-between gap-3 shrink-0 bg-white">
            <button type="button" onClick={handleClose} className="px-4 py-2.5 rounded-xl border border-line font-bold text-sm text-ink-600 hover:bg-paper transition">Cancel</button>
            <button type="button" onClick={handleApply} disabled={rows.length === 0} className="corp-btn-gold disabled:opacity-50">
              <CheckCircle2 className="w-4 h-4" />
              <span>Fill bill form ({rows.length} items)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
