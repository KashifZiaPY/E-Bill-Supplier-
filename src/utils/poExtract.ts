// ─────────────────────────────────────────────────────────────────────────────
// PO PDF extraction (browser). Three engines, in order of preference:
//   1. TEXT LAYER — pdf.js reads the PDF's embedded text with positions.
//      Exact and instant when the PO system generated a real text PDF.
//   2. GEMINI VISION — many PO systems (e.g. the e-procurement portal this
//      app's sample came from) export the PO as a picture inside a PDF:
//      the text layer is empty. The page image is then read by Google's
//      Gemini vision model, which understands the table as a whole and is
//      far more accurate than character OCR (see poGemini.ts).
//   3. TESSERACT OCR — no-key fallback for picture PDFs. Slower (~30–60s)
//      and imperfect.
// Whichever engine produced the data, it always passes through
// validatePo() and a mandatory review screen before anything reaches the
// bill form. All libraries are dynamic-imported so they never weigh down
// the app's normal bundle.
// ─────────────────────────────────────────────────────────────────────────────

import type { PoWord } from './poImport';
import { parsePoWords, type PoData } from './poImport';

export type ProgressFn = (msg: string) => void;

async function openPdf(file: File): Promise<any> {
  const pdfjs: any = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const buf = await file.arrayBuffer();
  return pdfjs.getDocument({ data: buf }).promise;
}

/** Render one PDF page to a canvas at the requested pixel width. */
export async function renderPdfPageCanvas(pdf: any, pageNo: number, targetWidth: number): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(pageNo);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(5, targetWidth / base.width);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare the page image.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return canvas;
}

/** Split one pdf.js text item into positioned word tokens. */
function splitItemWords(str: string, x: number, y: number, w: number, h: number, page: number): PoWord[] {
  const out: PoWord[] = [];
  const tokens = str.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return out;
  const totalChars = str.length || 1;
  let cursor = 0;
  for (const tk of tokens) {
    const idx = str.indexOf(tk, cursor);
    const start = idx >= 0 ? idx : cursor;
    cursor = start + tk.length;
    out.push({
      text: tk,
      x: x + (start / totalChars) * w,
      y,
      w: (tk.length / totalChars) * w,
      h,
      page,
    });
  }
  return out;
}

/**
 * Pass 1 — embedded text layer. Returns parsed data when the PDF carries a
 * real text layer, or null when it is a picture-only PDF.
 */
export async function extractPoTextLayer(file: File, onProgress: ProgressFn): Promise<PoData | null> {
  onProgress('Reading PDF…');
  const pdf = await openPdf(file);
  const textWords: PoWord[] = [];
  let textChars = 0;
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    for (const item of tc.items as any[]) {
      if (!item || typeof item.str !== 'string') continue;
      const str = item.str;
      textChars += str.replace(/\s+/g, '').length;
      const [, , , d, e, f] = item.transform || [1, 0, 0, 1, 0, 0];
      const h = Math.abs(item.height || d || 10);
      // pdf.js text space is bottom-up; flip y so larger = lower on page,
      // matching OCR's top-down boxes.
      textWords.push(...splitItemWords(str, e || 0, -(f || 0), item.width || 0, h, p));
    }
  }
  if (textChars < 120) return null;
  onProgress('Text found in PDF — reading it directly…');
  return parsePoWords(textWords, 'text');
}

function parseTsvWords(tsv: string, page: number): PoWord[] {
  const out: PoWord[] = [];
  const rows = tsv.split('\n');
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i].split('\t');
    if (cols.length < 12) continue;
    if (cols[0] !== '5') continue; // word level only
    const text = (cols[11] || '').trim();
    if (!text) continue;
    const conf = Number(cols[10]);
    if (Number.isFinite(conf) && conf < 25) continue; // drop near-garbage tokens
    out.push({
      text,
      x: Number(cols[6]) || 0,
      y: Number(cols[7]) || 0,
      w: Number(cols[8]) || 0,
      h: Number(cols[9]) || 10,
      page,
    });
  }
  return out;
}

/** Pass 3 — Tesseract OCR fallback for picture PDFs (no Gemini key). */
export async function extractPoWithOcr(file: File, onProgress: ProgressFn): Promise<PoData> {
  onProgress('Starting OCR — this can take up to a minute…');
  const pdf = await openPdf(file);
  const Tesseract: any = await import('tesseract.js');
  const worker = await Tesseract.createWorker('eng');
  try {
    await worker.setParameters({ tessedit_pageseg_mode: '6' });
    const ocrWords: PoWord[] = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      onProgress(`Reading page ${p} of ${pdf.numPages} with OCR…`);
      // ~4600px wide: OCR digit accuracy on these portal POs collapses at
      // lower resolutions (verified on the sample — "1,350.00" reads as
      // garbage at 3300px, cleanly at ~4900px).
      const canvas = await renderPdfPageCanvas(pdf, p, 4600);
      const { data } = await worker.recognize(canvas, {}, { tsv: true, text: true });
      if (data?.tsv) ocrWords.push(...parseTsvWords(data.tsv, p));
      else if (data?.text) {
        // Fallback if TSV is unavailable: synthesize word boxes line by line
        // (column assignment will be rough; the review screen still applies).
        const lines = String(data.text).split('\n');
        lines.forEach((ln: string, li: number) => {
          ln.split(/\s+/).filter(Boolean).forEach((tk: string, ti: number) => {
            ocrWords.push({ text: tk, x: ti * 60, y: li * 24, w: 55, h: 12, page: p });
          });
        });
      }
    }
    if (ocrWords.length === 0) {
      throw new Error('OCR found no readable text in this PDF. Try a clearer scan, or enter the bill manually.');
    }
    return parsePoWords(ocrWords, 'ocr');
  } finally {
    try { await worker.terminate(); } catch { /* noop */ }
  }
}
