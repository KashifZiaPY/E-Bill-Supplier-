// Pakistani Number to Words Converter
// Handles: Crore (1,00,00,000), Lakh (1,00,000), Thousand (1,000), Hundred (100), Rupees and Paisa.

const ONES: string[] = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'
];

const TENS: string[] = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
];

function twoDigitsToWords(n: number): string {
  if (n === 0) return '';
  if (n < 20) return ONES[n];
  const ten = Math.floor(n / 10);
  const one = n % 10;
  return `${TENS[ten]}${one > 0 ? ' ' + ONES[one] : ''}`.trim();
}

function threeDigitsToWords(n: number): string {
  if (n === 0) return '';
  const hundred = Math.floor(n / 100);
  const remainder = n % 100;
  const hundredPart = hundred > 0 ? `${ONES[hundred]} Hundred` : '';
  const remPart = twoDigitsToWords(remainder);

  if (hundredPart && remPart) {
    return `${hundredPart} ${remPart}`;
  }
  return hundredPart || remPart;
}

export function numberToWordsPakistani(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return 'Rupees Zero Only';
  }

  const rounded = Math.round(amount * 100) / 100;
  const isNegative = rounded < 0;
  const absAmount = Math.abs(rounded);

  const integerPart = Math.floor(absAmount);
  const decimalPart = Math.round((absAmount - integerPart) * 100);

  if (integerPart === 0 && decimalPart === 0) {
    return 'Rupees Zero Only';
  }

  // Pakistani numbering splits:
  // Remainder: last 3 digits (Hundreds)
  // Thousands: next 2 digits
  // Lakhs: next 2 digits
  // Crores: remaining digits
  let num = integerPart;

  const hundreds = num % 1000;
  num = Math.floor(num / 1000);

  const thousands = num % 100;
  num = Math.floor(num / 100);

  const lakhs = num % 100;
  num = Math.floor(num / 100);

  const crores = num; // any higher value handled in crores

  const parts: string[] = [];

  if (crores > 0) {
    parts.push(`${numberToWordsPakistaniInternal(crores)} Crore`);
  }
  if (lakhs > 0) {
    parts.push(`${twoDigitsToWords(lakhs)} Lakh`);
  }
  if (thousands > 0) {
    parts.push(`${twoDigitsToWords(thousands)} Thousand`);
  }
  if (hundreds > 0) {
    parts.push(threeDigitsToWords(hundreds));
  }

  const rupeeWords = parts.filter(Boolean).join(' ').trim();
  const rupeeString = rupeeWords ? `Rupees ${rupeeWords}` : (decimalPart > 0 ? 'Rupees' : 'Rupees Zero');

  let paisaString = '';
  if (decimalPart > 0) {
    paisaString = ` and ${twoDigitsToWords(decimalPart)} Paisa`;
  }

  const result = `${isNegative ? 'Minus ' : ''}${rupeeString}${paisaString} Only`;
  return result.replace(/\s+/g, ' ').trim();
}

function numberToWordsPakistaniInternal(n: number): string {
  if (n < 100) return twoDigitsToWords(n);
  if (n < 1000) return threeDigitsToWords(n);

  const hundreds = n % 1000;
  let remaining = Math.floor(n / 1000);

  const thousands = remaining % 100;
  remaining = Math.floor(remaining / 100);

  const lakhs = remaining % 100;
  const crores = Math.floor(remaining / 100);

  const res: string[] = [];
  if (crores > 0) res.push(`${numberToWordsPakistaniInternal(crores)} Crore`);
  if (lakhs > 0) res.push(`${twoDigitsToWords(lakhs)} Lakh`);
  if (thousands > 0) res.push(`${twoDigitsToWords(thousands)} Thousand`);
  if (hundreds > 0) res.push(threeDigitsToWords(hundreds));

  return res.filter(Boolean).join(' ');
}
