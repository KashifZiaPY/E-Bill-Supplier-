import * as XLSX from 'xlsx';
import type { DocumentRecord, LineItem } from '../types/billing';
import { formatCurrency, safeNormalizeItems, calculateTotals } from './formatters';

export interface ClientReportSummary {
  clientName: string;
  clientNTN: string;
  clientAddress: string;
  billCount: number;
  quoteCount: number;
  goodsTotal: number;
  gstTotal: number;
  serviceTotal: number;
  pstTotal: number;
  grandTotal: number;
  lastBillDate: string;
  lastBillNo?: string;
  lastBillAmount?: number;
}

/**
 * Exports all documents in the register to a professionally formatted Excel spreadsheet (.xlsx)
 */
export function exportDocumentsToExcel(docs: DocumentRecord[], firmName: string = 'Enterprise') {
  const wb = XLSX.utils.book_new();

  const titleRow = [`${firmName.toUpperCase()} - DOCUMENTS REGISTER`];
  const dateRow = [`Exported on: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`];
  const blankRow: string[] = [];

  const headers = [
    'Type',
    'Doc / Bill #',
    'Date',
    'Client Name',
    'Client NTN',
    'Client Address',
    'Reference / PO #',
    'Goods Subtotal (PKR)',
    'Federal GST (PKR)',
    'Services Subtotal (PKR)',
    'Punjab PST (PKR)',
    'Other / Exempt (PKR)',
    'Grand Total (PKR)',
    'Status',
  ];

  let totalGoods = 0;
  let totalGst = 0;
  let totalServices = 0;
  let totalPst = 0;
  let totalGrand = 0;

  const dataRows = docs.map((d) => {
    const isCancelled = String(d.status || d.Status || '').toLowerCase() === 'cancelled';
    const goods = Number(d.goodsSub ?? d.GoodsSub ?? 0);
    const gst = Number(d.gst ?? d.GST ?? 0);
    const services = Number(d.serviceSub ?? d.ServiceSub ?? 0);
    const pst = Number(d.pst ?? d.PST ?? 0);
    const other = Number(d.otherSub ?? d.OtherSub ?? 0);
    const grand = Number(d.grandTotal ?? d.GrandTotal ?? 0);

    if (!isCancelled) {
      totalGoods += goods;
      totalGst += gst;
      totalServices += services;
      totalPst += pst;
      totalGrand += grand;
    }

    return [
      String(d.type || d.Type || 'BILL'),
      String(d.docNo || d.DocNo || '—'),
      String(d.date || d.Date || ''),
      String(d.clientName || d.ClientName || ''),
      String(d.clientNTN || d.ClientNTN || ''),
      String(d.clientAddress || d.ClientAddress || ''),
      String(d.refText || d.RefText || ''),
      goods,
      gst,
      services,
      pst,
      other,
      grand,
      isCancelled ? 'Cancelled' : 'Active',
    ];
  });

  const summaryRow = [
    'TOTAL ACTIVE',
    `${docs.filter((d) => String(d.status || d.Status || '').toLowerCase() !== 'cancelled').length} Docs`,
    '',
    '',
    '',
    '',
    '',
    totalGoods,
    totalGst,
    totalServices,
    totalPst,
    0,
    totalGrand,
    '',
  ];

  const wsData = [titleRow, dateRow, blankRow, headers, ...dataRows, blankRow, summaryRow];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths for clean readability
  ws['!cols'] = [
    { wch: 12 }, // Type
    { wch: 14 }, // Doc#
    { wch: 12 }, // Date
    { wch: 35 }, // Client Name
    { wch: 16 }, // NTN
    { wch: 30 }, // Address
    { wch: 30 }, // Reference
    { wch: 20 }, // Goods
    { wch: 18 }, // GST
    { wch: 22 }, // Services
    { wch: 18 }, // PST
    { wch: 18 }, // Other
    { wch: 22 }, // Grand Total
    { wch: 12 }, // Status
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Documents Register');
  const safeFirm = firmName.replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `${safeFirm}_Documents_Register_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Exports Client-Wise Billing Report to an Excel spreadsheet (.xlsx)
 */
export function exportClientReportToExcel(clientSummaries: ClientReportSummary[], firmName: string = 'Enterprise') {
  const wb = XLSX.utils.book_new();

  // Exclude zero-value clients from the professional report
  const validSummaries = clientSummaries.filter(
    (c) => c.grandTotal > 0 || c.billCount > 0 || c.goodsTotal > 0 || c.serviceTotal > 0
  );

  const titleRow = [`${firmName.toUpperCase()} - CLIENT-WISE BILLING REPORT`];
  const dateRow = [`Generated on: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`];
  const blankRow: string[] = [];

  const headers = [
    'Sr.#',
    'Client Name',
    'Client NTN',
    'Office Address',
    'Total Bills',
    'Quotations',
    'Goods Value (PKR)',
    'Federal GST (PKR)',
    'Services Value (PKR)',
    'Punjab PST (PKR)',
    'Grand Total Billed (PKR)',
    'Last Bill #',
    'Last Bill Date',
    'Last Bill Amount (PKR)',
  ];

  let sumBills = 0;
  let sumQuotes = 0;
  let sumGoods = 0;
  let sumGst = 0;
  let sumServices = 0;
  let sumPst = 0;
  let sumGrand = 0;

  const dataRows = validSummaries.map((c, i) => {
    sumBills += c.billCount;
    sumQuotes += c.quoteCount;
    sumGoods += c.goodsTotal;
    sumGst += c.gstTotal;
    sumServices += c.serviceTotal;
    sumPst += c.pstTotal;
    sumGrand += c.grandTotal;

    return [
      i + 1,
      c.clientName,
      c.clientNTN || '—',
      c.clientAddress || '—',
      c.billCount,
      c.quoteCount,
      c.goodsTotal,
      c.gstTotal,
      c.serviceTotal,
      c.pstTotal,
      c.grandTotal,
      c.lastBillNo || '—',
      c.lastBillDate || '—',
      c.lastBillAmount !== undefined && c.lastBillAmount > 0 ? c.lastBillAmount : '—',
    ];
  });

  const summaryRow = [
    'TOTAL',
    `${validSummaries.length} Active Clients`,
    '',
    '',
    sumBills,
    sumQuotes,
    sumGoods,
    sumGst,
    sumServices,
    sumPst,
    sumGrand,
    '',
    '',
    '',
  ];

  const wsData = [titleRow, dateRow, blankRow, headers, ...dataRows, blankRow, summaryRow];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws['!cols'] = [
    { wch: 6 },  // Sr
    { wch: 38 }, // Client Name
    { wch: 16 }, // NTN
    { wch: 32 }, // Address
    { wch: 12 }, // Bills
    { wch: 12 }, // Quotes
    { wch: 20 }, // Goods
    { wch: 20 }, // GST
    { wch: 20 }, // Services
    { wch: 20 }, // PST
    { wch: 24 }, // Grand Total
    { wch: 14 }, // Last Bill #
    { wch: 14 }, // Last Bill Date
    { wch: 22 }, // Last Bill Amount
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Client Wise Report');
  const safeFirm = firmName.replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `${safeFirm}_Client_Wise_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Exports line items of a specific Bill/Quotation to an Excel spreadsheet (.xlsx)
 */
export function exportDocLineItemsToExcel(doc: DocumentRecord) {
  const wb = XLSX.utils.book_new();
  const items = safeNormalizeItems(doc.items || doc.Items);

  const docType = String(doc.type || doc.Type || 'BILL');
  const docNo = String(doc.docNo || doc.DocNo || '—');
  const client = String(doc.clientName || doc.ClientName || 'Client');
  const ntn = String(doc.clientNTN || doc.ClientNTN || '—');
  const date = String(doc.date || doc.Date || '');

  const titleRow = [`${docType} #${docNo} - LINE ITEMS SPECIFICATION`];
  const clientRow = [`Client: ${client}`, `NTN: ${ntn}`, `Date: ${date}`];
  const blankRow: string[] = [];

  const gstRate = (doc.gstRate !== undefined && doc.gstRate !== null && Number(doc.gstRate) >= 0)
    ? Number(doc.gstRate)
    : ((doc as any).GstRate !== undefined && Number((doc as any).GstRate) >= 0)
    ? Number((doc as any).GstRate)
    : 0.18;
  const gstPercent = Math.round(gstRate * 100);
  const computed = calculateTotals(items, gstRate, 0.16);

  const headers = ['Sr.#', 'Item Description', 'Unit', 'Quantity', 'Rate (PKR)', 'Tax Category', 'Amount (PKR)'];

  const dataRows = items.map((it, idx) => {
    const itemGst = (it.gstRate !== undefined && it.gstRate !== null && !isNaN(Number(it.gstRate)))
      ? Number(it.gstRate)
      : (it.taxRate !== undefined && it.taxRate !== null && !isNaN(Number(it.taxRate)))
      ? Number(it.taxRate)
      : gstRate;
    const itemGstPct = Math.round(itemGst * 100);
    const taxDisplay = it.tax === 'GST' ? `Goods (GST ${itemGstPct}%)` : it.tax === 'PST' ? 'Service (PST 16%)' : 'No Tax (0%)';

    return [
      idx + 1,
      String(it.description || ''),
      String(it.unit || 'Nos'),
      Number(it.qty) || 0,
      Number(it.rate) || 0,
      taxDisplay,
      Number(it.amount) || Math.round((Number(it.qty) || 0) * (Number(it.rate) || 0) * 100) / 100,
    ];
  });

  const grandTotal = Number(doc.grandTotal ?? doc.GrandTotal ?? computed.grandTotal);
  const gst = Number(doc.gst ?? doc.GST ?? computed.gst);
  const pst = Number(doc.pst ?? doc.PST ?? computed.pst);

  const gstBreakdownRows = (computed.gstBreakdown && computed.gstBreakdown.length > 1)
    ? computed.gstBreakdown.map((b) => [
        '', '', '', '', '', `Sales Tax GST (${b.ratePercent}% on Rs. ${b.taxableAmount}):`, b.taxAmount
      ])
    : [['', '', '', '', '', `Sales Tax GST (${computed.gstBreakdown?.[0]?.ratePercent ?? gstPercent}%):`, gst]];

  const totalRows = [
    blankRow,
    ...gstBreakdownRows,
    ['', '', '', '', '', 'Provincial Tax PST (16%):', pst],
    ['', '', '', '', '', 'GRAND TOTAL (PKR):', grandTotal],
  ];

  const wsData = [titleRow, clientRow, blankRow, headers, ...dataRows, ...totalRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws['!cols'] = [
    { wch: 6 },  // Sr
    { wch: 45 }, // Description
    { wch: 10 }, // Unit
    { wch: 12 }, // Qty
    { wch: 15 }, // Rate
    { wch: 20 }, // Tax
    { wch: 20 }, // Amount
  ];

  XLSX.utils.book_append_sheet(wb, ws, `${docType}_${docNo}`);
  XLSX.writeFile(wb, `${docType}_${docNo}_Items_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
