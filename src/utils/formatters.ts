// Formatters for Pakistani Currency, Dates, and Calculation helpers

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
 * Calculates live totals given line items and tax rates
 */
export function calculateTotals(
  items: Array<{ qty: number; rate: number; tax: 'GST' | 'PST' | 'None' }>,
  gstRate: number = 0.18,
  pstRate: number = 0.16
) {
  let goodsSub = 0;
  let serviceSub = 0;
  let otherSub = 0;

  for (const item of items) {
    const amount = (Number(item.qty) || 0) * (Number(item.rate) || 0);
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

  const gst = Math.round(goodsSubRounded * gstRate * 100) / 100;
  const pst = Math.round(serviceSubRounded * pstRate * 100) / 100;

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
