// Formatters for Pakistani Currency, Dates, and Calculation helpers
import type { LineItem, TaxType } from '../types/billing';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * Formats a number to Pakistani currency format e.g. "99,768.30"
 */
export function formatCurrency(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '0.00';
  }
  return Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formats a date string (YYYY-MM-DD or ISO) into dd-mmm-yyyy (e.g. "06-Oct-2026")
 */
export function formatDateDisplay(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  try {
    // If already in dd-mmm-yyyy format, return as is
    if (/^\d{2}-[A-Za-z]{3}-\d{4}$/.test(dateStr)) {
      return dateStr;
    }
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        const dd = String(day).padStart(2, '0');
        const mmm = MONTH_NAMES[month] || 'Jan';
        return `${dd}-${mmm}-${year}`;
      }
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mmm = MONTH_NAMES[d.getMonth()];
      const yyyy = d.getFullYear();
      return `${dd}-${mmm}-${yyyy}`;
    }
  } catch (e) {
    // fallback
  }
  return dateStr;
}

/**
 * Formats a date object to YYYY-MM-DD
 */
export function formatDateISO(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Adds days to a date string YYYY-MM-DD and returns YYYY-MM-DD
 */
export function addDaysISO(dateStr: string, days: number): string {
  try {
    const parts = dateStr.split('-');
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    d.setDate(d.getDate() + days);
    return formatDateISO(d);
  } catch {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return formatDateISO(d);
  }
}

/**
 * Generates a unique Request ID (UUID) for idempotency
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'req-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now();
}

/**
 * Safely parses and normalizes items from any backend representation
 * (array, JSON string, or nested object)
 */
export function safeNormalizeItems(raw: any): LineItem[] {
  if (!raw) return [];

  let parsed = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        parsed = [];
      }
    } else {
      return [];
    }
  }

  // If single object was returned
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    if (Array.isArray(parsed.items || parsed.Items)) {
      parsed = parsed.items || parsed.Items;
    } else {
      parsed = [parsed];
    }
  }

  if (!Array.isArray(parsed)) return [];

  return parsed.map((it: any, idx: number) => {
    if (!it || typeof it !== 'object') {
      return {
        id: 'item-' + idx,
        sr: idx + 1,
        description: String(it || ''),
        unit: 'Nos',
        qty: 1,
        rate: 0,
        tax: 'GST' as TaxType,
        amount: 0,
      };
    }

    const q = Number(it.qty ?? it.Qty ?? 1);
    const validQty = isNaN(q) ? 1 : q;
    const r = Number(it.rate ?? it.Rate ?? 0);
    const validRate = isNaN(r) ? 0 : r;
    const calcAmount = Math.round(validQty * validRate * 100) / 100;
    const a = it.amount ?? it.Amount ?? calcAmount;
    const validAmount = isNaN(Number(a)) ? calcAmount : Number(a);

    const desc = String(it.description || it.Description || '');
    const unit = String(it.unit || it.Unit || 'Nos');
    const taxRaw = String(it.tax || it.Tax || 'GST').toUpperCase();
    const tax: TaxType = taxRaw === 'PST' ? 'PST' : taxRaw === 'NONE' ? 'None' : 'GST';

    return {
      id: String(it.id || 'item-' + idx + '-' + Date.now()),
      sr: Number(it.sr ?? it.Sr ?? idx + 1),
      Sr: Number(it.sr ?? it.Sr ?? idx + 1),
      description: desc,
      Description: desc,
      unit: unit,
      Unit: unit,
      qty: validQty,
      Qty: validQty,
      rate: validRate,
      Rate: validRate,
      tax: tax,
      Tax: tax,
      amount: validAmount,
      Amount: validAmount,
    };
  });
}

/**
 * Calculates live totals given line items and tax rates (100% defensive)
 */
export function calculateTotals(
  items: any,
  gstRate: number = 0.18,
  pstRate: number = 0.16
) {
  let goodsSub = 0;
  let serviceSub = 0;
  let otherSub = 0;

  const safeList = safeNormalizeItems(items);

  for (const item of safeList) {
    const amount = Number(item.amount ?? (item.qty * item.rate)) || 0;
    if (item.tax === 'GST') {
      goodsSub += amount;
    } else if (item.tax === 'PST') {
      serviceSub += amount;
    } else {
      otherSub += amount;
    }
  }

  // Rounding according to government invoice rules
  const goodsSubRounded = Math.round(goodsSub * 100) / 100;
  const serviceSubRounded = Math.round(serviceSub * 100) / 100;
  const otherSubRounded = Math.round(otherSub * 100) / 100;

  const gst = Math.round(goodsSubRounded * (Number(gstRate) || 0.18) * 100) / 100;
  const pst = Math.round(serviceSubRounded * (Number(pstRate) || 0.16) * 100) / 100;

  const grandTotal = Math.round((goodsSubRounded + gst + serviceSubRounded + pst + otherSubRounded) * 100) / 100;

  return {
    goodsSub: goodsSubRounded,
    gst,
    serviceSub: serviceSubRounded,
    pst,
    otherSub: otherSubRounded,
    grandTotal,
  };
}
