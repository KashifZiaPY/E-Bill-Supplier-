// ─────────────────────────────────────────────────────────────────────────────
// PO extraction via Gemini Vision — the picture-PDF engine.
//
// The PO page image is sent to Google's Gemini vision model with a strict
// JSON schema; the model reads the table as a whole (rows, columns, totals)
// instead of guessing character-by-character like classic OCR, which is why
// it is dramatically more accurate on these portal-generated POs.
//
// The API key belongs to the user (free from Google AI Studio, no card):
// it is entered once in the import dialog and stored ONLY in this
// browser's localStorage — never in code, never sent anywhere except
// Google's API endpoint as the auth header. The PO image necessarily goes
// to Google for reading; that is disclosed in the dialog before first use.
// Results still pass through validatePo() + the review screen, unchanged.
// ─────────────────────────────────────────────────────────────────────────────

import { buildPoItems, type PoData } from './poImport';
import { renderPdfPageCanvas, type ProgressFn } from './poExtract';

const KEY_STORAGE = 'bill-gemini-api-key';
// Model availability differs per key age: Google told a brand-new key
// (2026-10-17) that gemini-2.5-flash "is no longer available to new users"
// and named gemini-3.8-flash as the current model. Try in order, falling
// through on 404 only, so both new and older keys keep working.
const MODELS = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'];

export function getGeminiKey(): string {
  try { return localStorage.getItem(KEY_STORAGE) || ''; } catch { return ''; }
}

export function setGeminiKey(key: string): void {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key);
    else localStorage.removeItem(KEY_STORAGE);
  } catch { /* storage unavailable — key simply won't persist */ }
}

const PROMPT = `You are reading a Purchase Order document image for a billing system. Extract the data EXACTLY as printed — never invent, round, or correct figures.

Return:
- clientName: the institute/organisation name printed at the very top of the page (the buyer issuing this PO).
- clientAddress: the address line printed under the client name (empty string if none).
- poNo: the purchase order number (digits after "PO#"), without the "PO#" prefix.
- poDate: the PO date exactly as printed, like "18 Nov, 2025" (date part only, no time).
- supplier: the supplier/vendor name the PO is issued to.
- terms: the purchase description line printed under "Term(s) and Condition(s):" (e.g. "Purchase of Stationary Office Use"). Empty string if none.
- totalExclusive / totalTax / totalInclusive: the three printed totals from the totals block (Total Exclusive Tax Amount / Total Tax / Total Inclusive Tax Amount). Use null for any total that is not printed.
- items: EVERY row of the items table, in order. For each row:
  - itemName: the "Item Description" column text.
  - specification: the "Specification(s)" column text.
  - unit: the "Unit of Measure" column text as printed (e.g. "EACH", "PACK (PAK)", "PIECES (PCE)").
  - qty: the Quantity column number.
  - rate: the Price column number (unit price, without "PKR.").
  - amount: the Amount column number.
  - taxAmount: the Tax Amount column number (0 if the row has no tax figure).
All numbers must be plain numbers without commas or currency symbols. If a figure is genuinely unreadable, use 0 for it — do not guess.`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    clientName: { type: 'STRING' },
    clientAddress: { type: 'STRING' },
    poNo: { type: 'STRING' },
    poDate: { type: 'STRING' },
    supplier: { type: 'STRING' },
    terms: { type: 'STRING' },
    totalExclusive: { type: 'NUMBER', nullable: true },
    totalTax: { type: 'NUMBER', nullable: true },
    totalInclusive: { type: 'NUMBER', nullable: true },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          itemName: { type: 'STRING' },
          specification: { type: 'STRING' },
          unit: { type: 'STRING' },
          qty: { type: 'NUMBER' },
          rate: { type: 'NUMBER' },
          amount: { type: 'NUMBER' },
          taxAmount: { type: 'NUMBER' },
        },
        required: ['itemName', 'specification', 'unit', 'qty', 'rate', 'amount', 'taxAmount'],
      },
    },
  },
  required: ['clientName', 'clientAddress', 'poNo', 'poDate', 'supplier', 'terms', 'items'],
};

/** Pure mapper (unit-tested): Gemini's JSON → the app's PoData shape. */
export function mapGeminiJsonToPoData(json: any): PoData {
  const num = (v: any): number => {
    const n = Number(String(v ?? '').replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  const posOrNull = (v: any): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = num(v);
    return n > 0 ? n : null;
  };
  const rawItems = Array.isArray(json?.items) ? json.items : [];
  return {
    clientName: String(json?.clientName || '').trim(),
    clientAddress: String(json?.clientAddress || '').trim(),
    poNo: String(json?.poNo || '').replace(/^PO\s*#?\s*/i, '').trim(),
    poDate: String(json?.poDate || '').trim(),
    supplier: String(json?.supplier || '').trim(),
    terms: String(json?.terms || '').trim(),
    items: buildPoItems(rawItems.map((it: any) => ({
      itemName: String(it?.itemName || ''),
      specification: String(it?.specification || ''),
      unitRaw: String(it?.unit || ''),
      qty: num(it?.qty),
      rate: num(it?.rate),
      amount: num(it?.amount),
      taxAmount: num(it?.taxAmount),
    }))),
    totalExclusive: posOrNull(json?.totalExclusive),
    totalTax: posOrNull(json?.totalTax),
    totalInclusive: posOrNull(json?.totalInclusive),
    source: 'gemini',
  };
}

export async function extractPoWithGemini(file: File, apiKey: string, onProgress: ProgressFn): Promise<PoData> {
  onProgress('Preparing PO pages for AI reading…');
  const pdfjs: any = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;

  const parts: any[] = [{ text: PROMPT }];
  for (let p = 1; p <= pdf.numPages; p++) {
    onProgress(`Preparing page ${p} of ${pdf.numPages}…`);
    const canvas = await renderPdfPageCanvas(pdf, p, 2200);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    parts.push({ inline_data: { mime_type: 'image/jpeg', data: dataUrl.split(',')[1] || '' } });
  }

  onProgress('Reading the PO with Gemini AI…');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  let res: Response | null = null;
  let body: any = null;
  try {
    for (const model of MODELS) {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              temperature: 0,
              responseMimeType: 'application/json',
              responseSchema: RESPONSE_SCHEMA,
            },
          }),
          signal: controller.signal,
        }
      );
      body = await res.json().catch(() => null);
      if (res.status !== 404) break; // 404 = model not available to this key — try the next
      res = null;
    }
  } catch (e: any) {
    throw new Error(
      e?.name === 'AbortError'
        ? 'Gemini took too long to respond (over 2 minutes). Check your internet and try again, or use OCR instead.'
        : 'Could not reach Gemini. Check your internet connection and try again, or use OCR instead.'
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res) {
    throw new Error('No Gemini model is available to this API key right now. You can try OCR instead, or check the key in AI Studio.');
  }
  if (!res.ok) {
    const gmsg = String(body?.error?.message || '');
    if (res.status === 400 && /api key/i.test(gmsg)) {
      throw new Error('That Gemini API key was not accepted. Check the key and try again.');
    }
    if (res.status === 429) {
      throw new Error('Gemini free quota is busy right now. Wait a minute and try again, or use OCR instead.');
    }
    throw new Error(`Gemini could not read this PO (${res.status}${gmsg ? `: ${gmsg}` : ''}). You can try OCR instead.`);
  }

  const text = (body?.candidates?.[0]?.content?.parts || [])
    .map((pt: any) => pt?.text || '')
    .join('');
  if (!text) throw new Error('Gemini returned no data for this PO. You can try OCR instead.');
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('Gemini returned unreadable data for this PO. You can try OCR instead.');
  }
  const data = mapGeminiJsonToPoData(json);
  if (!data.items.length) {
    throw new Error('Gemini found no item rows in this PDF. Check it is a Purchase Order, or try OCR instead.');
  }
  return data;
}
