// Client for communicating with the serverless /api/gas proxy or local simulated storage
// Client for the serverless /api/gas proxy -> Google Apps Script -> Google Sheet.
// Pure sheet sync: this client keeps NOTHING in the browser. No cached documents,
// no stored PIN, no tombstones. Every read hits the live sheet; if the sheet is
// unreachable the call fails loudly instead of showing stale data.

import type { BootstrapData, DocumentRecord, FirmProfile, LineItem, SavedClient, SupplierSettings, DocType } from '../types/billing';
import { calculateTotals, safeNormalizeItems } from '../utils/formatters';
import { calculateRolledBackNextDocNo } from '../utils/lifoHelper';

/** Thrown when a destructive action needs the separate deletion PIN. UI catches this to prompt. */
export class DeletePinRequiredError extends Error {
  constructor(msg: string) { super(msg); this.name = 'DeletePinRequiredError'; }
}


export const DEFAULT_FIRMS: FirmProfile[] = [
  {
    id: 'firm-anwar-traders',
    name: 'Anwar Traders',
    tagline: 'Govt. Contractor & General Order Supplier',
    address: 'Mohalla Punj Peer, Khawaja Street, Jhang Road, Faisalabad.',
    phone: '0300-6642775',
    ntn: '4821279-6',
    gst: '3277876217254',
    vendorNo: '31086205',
    gstRate: 0.18,
    pstRate: 0.16,
    letterheadTop: 2.5,
    letterheadBottom: 1.5,
    nextBillNo: '101',
    nextQuoteNo: 'Q-201',
  },
  {
    id: 'firm-hashir-traders',
    name: 'Hashir Traders',
    tagline: 'Govt. Contractor & General Order Supplier',
    address: 'Kabaar Market, Jhang Road, Faisalabad',
    phone: '0345-7759459',
    ntn: '8637356-3',
    gst: '3277876326317',
    vendorNo: '31241288',
    gstRate: 0.18,
    pstRate: 0.16,
    letterheadTop: 2.5,
    letterheadBottom: 1.5,
    nextBillNo: '201',
    nextQuoteNo: 'HQ-101',
  },
];

export const DEFAULT_SETTINGS: SupplierSettings = {
  ownerName: 'MIAN FARHAN ANWAR',
  activeFirmId: 'firm-anwar-traders',
  firms: DEFAULT_FIRMS,
  supplierName: DEFAULT_FIRMS[0].name,
  supplierTagline: DEFAULT_FIRMS[0].tagline,
  supplierAddress: DEFAULT_FIRMS[0].address,
  supplierPhone: DEFAULT_FIRMS[0].phone,
  supplierNTN: DEFAULT_FIRMS[0].ntn,
  supplierGST: DEFAULT_FIRMS[0].gst,
  vendorNo: DEFAULT_FIRMS[0].vendorNo,
  gstRate: DEFAULT_FIRMS[0].gstRate,
  pstRate: DEFAULT_FIRMS[0].pstRate,
  letterheadTop: DEFAULT_FIRMS[0].letterheadTop,
  letterheadBottom: DEFAULT_FIRMS[0].letterheadBottom,
  nextBillNo: DEFAULT_FIRMS[0].nextBillNo,
  nextQuoteNo: DEFAULT_FIRMS[0].nextQuoteNo,
};

export const SEED_PETTY_DOC: DocumentRecord = {
  docId: 'doc-petty-187365',
  DocID: 'doc-petty-187365',
  firmId: 'firm-anwar-traders',
  firmName: 'Anwar Traders',
  type: 'BILL',
  Type: 'BILL',
  docNo: '100',
  DocNo: '100',
  date: '2026-10-06',
  Date: '2026-10-06',
  clientName: 'Director General Health Services Punjab',
  ClientName: 'Director General Health Services Punjab',
  clientAddress: '24-Cooper Road, Lahore',
  ClientAddress: '24-Cooper Road, Lahore',
  clientNTN: '9010203-4',
  ClientNTN: '9010203-4',
  refText: 'PO # Petty-187365 dated 06-Oct-2026 - Supply of Official Vehicles parts repair and maintenance',
  RefText: 'PO # Petty-187365 dated 06-Oct-2026 - Supply of Official Vehicles parts repair and maintenance',
  goodsSub: 64550,
  GoodsSub: 64550,
  gst: 11619,
  GST: 11619,
  serviceSub: 20344.22,
  ServiceSub: 20344.22,
  pst: 3255.08,
  PST: 3255.08,
  otherSub: 0,
  OtherSub: 0,
  grandTotal: 99768.30,
  GrandTotal: 99768.30,
  status: 'Active',
  Status: 'Active',
  items: [
    {
      sr: 1,
      description: 'Toyota Corolla Brake Pad Set (Front & Rear Genuine)',
      unit: 'Set',
      qty: 2,
      rate: 14500,
      tax: 'GST',
      amount: 29000,
    },
    {
      sr: 2,
      description: 'Engine Oil Filter & Air Filter Element',
      unit: 'Nos',
      qty: 4,
      rate: 3200,
      tax: 'GST',
      amount: 12800,
    },
    {
      sr: 3,
      description: 'Dry Charged Heavy Duty Battery 12V 65AH',
      unit: 'Nos',
      qty: 1,
      rate: 22750,
      tax: 'GST',
      amount: 22750,
    },
    {
      sr: 4,
      description: 'Complete Brake System Overhauling & Servicing Labor',
      unit: 'Job',
      qty: 2,
      rate: 4500,
      tax: 'PST',
      amount: 9000,
    },
    {
      sr: 5,
      description: 'Suspension Bushing Replacement & Tuning Labor',
      unit: 'Job',
      qty: 1,
      rate: 11344.22,
      tax: 'PST',
      amount: 11344.22,
    },
  ],
};

export const SEED_CATALOG = [
  { description: 'Official Vehicles Maintenance & Repair Services', unit: 'Job', rate: 14500, tax: 'PST' as const },
  { description: 'General Order Supplies & Consumables', unit: 'Set', rate: 8500, tax: 'GST' as const },
  { description: 'Electrical & Hardware Materials Supply', unit: 'Nos', rate: 4200, tax: 'GST' as const },
  { description: 'Computer & IT Hardware Peripherals Supply', unit: 'Nos', rate: 18500, tax: 'GST' as const },
  { description: 'Technical Maintenance & Overhauling Services', unit: 'Job', rate: 9500, tax: 'PST' as const },
  { description: 'Office Equipment Repair & Maintenance Services', unit: 'Job', rate: 6500, tax: 'PST' as const },
  { description: 'Stationery & Printing Consumables', unit: 'Pack', rate: 3200, tax: 'GST' as const },
  { description: 'Facility Maintenance & Technical Support', unit: 'Job', rate: 12000, tax: 'PST' as const },
];

export const SEED_CLIENTS: SavedClient[] = [
  {
    id: 'client-1',
    name: 'Director General Health Services Punjab',
    address: '24-Cooper Road, Lahore',
    ntn: '9010203-4',
    phone: '042-99201139',
    contactPerson: 'Director Admin & Procurement',
  },
  {
    id: 'client-2',
    name: 'Secretary Communication & Works Department',
    address: 'Punjab Civil Secretariat, Lower Mall, Lahore',
    ntn: '9020304-5',
    phone: '042-99211244',
    contactPerson: 'Section Officer (General)',
  },
  {
    id: 'client-3',
    name: 'District Health Authority Rawalpindi',
    address: 'Khyaban-e-Sir Syed, Rawalpindi',
    ntn: '9030405-6',
    phone: '051-9290044',
    contactPerson: 'Chief Executive Officer DHA',
  },
];

/**
 * Universal Client Normalizer:
 * Safely extracts client details from objects, strings, or sheet row arrays.
 * Guarantees every returned field is a primitive string to prevent any React render crash.
 */
export function normalizeSingleClient(raw: any, index: number = 0): SavedClient | null {
  if (!raw) return null;

  // 1. Case: raw is a plain string e.g. "Director General Health Services"
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    return {
      id: 'client-' + trimmed.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 30),
      name: trimmed,
      Name: trimmed,
      address: '',
      Address: '',
      ntn: '',
      NTN: '',
      strn: '',
      STRN: '',
      lastUsed: '',
      LastUsed: '',
    };
  }

  // 2. Case: raw is an array (raw Google Sheet row e.g. [Name, Address, NTN, STRN])
  if (Array.isArray(raw)) {
    const col0 = String(raw[0] || '').trim();
    // Skip header row
    if (!col0 || col0.toLowerCase() === 'name' || col0.toLowerCase() === 'client name') {
      return null;
    }
    const name = col0;
    const address = String(raw[1] || '').trim();
    const ntn = String(raw[2] || '').trim();
    const strn = String(raw[3] || '').trim();
    return {
      id: 'client-row-' + index + '-' + name.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 20),
      name,
      Name: name,
      address,
      Address: address,
      ntn,
      NTN: ntn,
      strn,
      STRN: strn,
      lastUsed: '',
      LastUsed: '',
    };
  }

  // 3. Case: raw is an object
  if (typeof raw === 'object') {
    let name = String(raw.name || raw.Name || raw.clientName || raw.ClientName || '').trim();
    let id = String(raw.id || raw.ID || '').trim();
    let address = String(raw.address || raw.Address || raw.clientAddress || raw.ClientAddress || '').trim();

    // Intelligent column alignment: In many Google Sheets, Column A contains the full institution/client title
    // (e.g. "Principal GTTC, Bhowana") and Column B contains the Station/City (e.g. "Bhowana").
    // If id contains a real institution name (not a technical 'client-xxx' key) and name is a short city/station:
    if (id && !id.startsWith('client-') && (id.length > name.length || !address)) {
      if (!address && name) {
        address = name;
      }
      name = id;
      id = 'client-' + name.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 30);
    }

    if (!name) return null;

    const ntn = String(raw.ntn || raw.NTN || raw.clientNTN || raw.ClientNTN || '').trim();
    const strn = String(raw.strn || raw.STRN || raw.clientSTRN || raw.ClientSTRN || '').trim();
    const lastUsed = String(raw.lastUsed || raw.LastUsed || '').trim();
    const phone = String(raw.phone || raw.Phone || '').trim();
    const contactPerson = String(raw.contactPerson || raw.ContactPerson || '').trim();
    const totalOrders = Number(raw.totalOrders || raw.TotalOrders || 0) || 0;
    const totalBilled = Number(raw.totalBilled || raw.TotalBilled || 0) || 0;

    return {
      id: id || ('client-' + name.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 30)),
      name,
      Name: name,
      address,
      Address: address,
      ntn,
      NTN: ntn,
      strn,
      STRN: strn,
      lastUsed,
      LastUsed: lastUsed,
      phone,
      contactPerson,
      totalOrders,
      totalBilled,
    };
  }

  return null;
}

/**
 * Normalizes client list AND augments clients with any unique clients found in documents.
 * This guarantees that even if the backend 'Clients' sheet is missing or empty,
 * all clients ever used in past bills are instantly available in typeaheads!
 */
export function normalizeClientsList(rawClients: any, docs: any[] = []): SavedClient[] {
  const clientMap = new Map<string, SavedClient>();

  // 1. Process explicit clients
  if (Array.isArray(rawClients)) {
    rawClients.forEach((raw, i) => {
      const norm = normalizeSingleClient(raw, i);
      if (norm && norm.name) {
        clientMap.set(norm.name.toLowerCase().trim(), norm);
      }
    });
  }

  // 2. Scan past documents for clients
  if (Array.isArray(docs)) {
    docs.forEach((d) => {
      const docClientName = String(d.clientName || d.ClientName || '').trim();
      if (!docClientName) return;

      const key = docClientName.toLowerCase();
      const existing = clientMap.get(key);

      const docAddress = String(d.clientAddress || d.ClientAddress || '').trim();
      const docNTN = String(d.clientNTN || d.ClientNTN || '').trim();
      const docDate = String(d.date || d.Date || '').trim();
      const docTotal = Number(d.grandTotal ?? d.GrandTotal ?? 0) || 0;

      if (!existing) {
        clientMap.set(key, {
          id: 'client-doc-' + key.replace(/[^a-z0-9]/g, '-').substring(0, 30),
          name: docClientName,
          Name: docClientName,
          address: docAddress,
          Address: docAddress,
          ntn: docNTN,
          NTN: docNTN,
          strn: '',
          STRN: '',
          lastUsed: docDate,
          LastUsed: docDate,
          totalOrders: 1,
          totalBilled: docTotal,
        });
      } else {
        // Augment missing details if document has them
        if (!existing.address && docAddress) {
          existing.address = docAddress;
          existing.Address = docAddress;
        }
        if (!existing.ntn && docNTN) {
          existing.ntn = docNTN;
          existing.NTN = docNTN;
        }
        if (!existing.lastUsed && docDate) {
          existing.lastUsed = docDate;
          existing.LastUsed = docDate;
        }
        existing.totalOrders = (existing.totalOrders || 0) + 1;
        existing.totalBilled = (existing.totalBilled || 0) + docTotal;
      }
    });
  }

  // Return real registered and referenced clients without fabricated mock fallbacks
  return Array.from(clientMap.values());
}

/**
 * Safely normalizes documents from Google Apps Script or local storage.
 * Strictly guarantees no fabricated mock documents are injected.
 */
export function normalizeDocsList(rawDocs: any): DocumentRecord[] {
  if (!Array.isArray(rawDocs)) {
    return [];
  }

  return rawDocs
    .filter((d: any) => {
      // Permanently filter out any legacy fabricated petty doc
      const docId = String(d?.docId || d?.DocID || '');
      const ref = String(d?.refText || d?.RefText || '');
      return docId !== 'doc-petty-187365' && !ref.includes('Petty-187365');
    })
    .map((d: any, idx: number) => {
    const docId = String(d.docId || d.DocID || 'doc-' + idx);
    const docNo = String(d.docNo || d.DocNo || '');
    const type = (d.type || d.Type || 'BILL').toUpperCase() === 'QUOTATION' ? 'QUOTATION' : 'BILL';
    const date = String(d.date || d.Date || '');
    const validUntil = d.validUntil || d.ValidUntil ? String(d.validUntil || d.ValidUntil) : undefined;
    const clientName = String(d.clientName || d.ClientName || 'Unnamed Client');
    const clientAddress = String(d.clientAddress || d.ClientAddress || '');
    const clientNTN = String(d.clientNTN || d.ClientNTN || '');
    const clientSTRN = String(d.clientSTRN || d.ClientSTRN || '');
    const refText = String(d.refText || d.RefText || '');
    const requestId = String(d.requestId || d.RequestId || '');
    const firmId = String(d.firmId || '');
    const firmName = String(d.firmName || '');
    const status = String(d.status || d.Status || 'Active');

    const items: LineItem[] = safeNormalizeItems(d.items || d.Items || d.itemsJson || d.ItemsJson);

    const goodsSub = Number(d.goodsSub ?? d.GoodsSub ?? 0);
    const gst = Number(d.gst ?? d.GST ?? 0);
    const serviceSub = Number(d.serviceSub ?? d.ServiceSub ?? 0);
    const pst = Number(d.pst ?? d.PST ?? 0);
    const otherSub = Number(d.otherSub ?? d.OtherSub ?? 0);
    const grandTotal = Number(d.grandTotal ?? d.GrandTotal ?? 0);

    return {
      docId,
      DocID: docId,
      firmId,
      firmName,
      type,
      Type: type,
      docNo,
      DocNo: docNo,
      date,
      Date: date,
      validUntil,
      ValidUntil: validUntil,
      clientName,
      ClientName: clientName,
      clientAddress,
      ClientAddress: clientAddress,
      clientNTN,
      ClientNTN: clientNTN,
      clientSTRN,
      ClientSTRN: clientSTRN,
      refText,
      RefText: refText,
      requestId,
      RequestId: requestId,
      goodsSub,
      GoodsSub: goodsSub,
      gst,
      GST: gst,
      serviceSub,
      ServiceSub: serviceSub,
      pst,
      PST: pst,
      otherSub,
      OtherSub: otherSub,
      grandTotal,
      GrandTotal: grandTotal,
      status,
      Status: status,
      items,
      Items: items,
    };
  });
}

class GasClient {
  // Session-only credentials. Nothing here is ever written to browser storage:
  // refresh the page and the PIN must be entered again.
  private pin: string = '';
  private deletePin: string = '';
  private gasUrl: string = '';
  private gasApiKey: string = '';

  constructor() {}

  getGasUrl(): string {
    // Priority: in-memory > build-time Vercel env (VITE_GAS_URL).
    // The Vercel env fallback means the sheet connects on every device/browser with zero manual setup.
    const envUrl = (import.meta as any)?.env?.VITE_GAS_URL || '';
    return this.gasUrl || envUrl || '';
  }

  setGasUrl(url: string) {
    this.gasUrl = (url || '').trim();
  }

  getGasApiKey(): string {
    return this.gasApiKey || '';
  }

  setGasApiKey(key: string) {
    this.gasApiKey = (key || '').trim();
  }

  async saveGasConfig(url: string, key?: string): Promise<{ ok: boolean; message: string }> {
    try {
      this.setGasUrl(url || '');
      if (typeof key === 'string') this.setGasApiKey(key);
      // Persist server-side (proxy writes .gas_config.json); nothing stays in this browser.
      await this.callGas('saveGasConfig', { gasUrl: this.gasUrl, gasApiKey: this.gasApiKey });
      return { ok: true, message: 'Configuration saved on the server.' };
    } catch {
      return { ok: true, message: 'Configuration saved for this session.' };
    }
  }

  /** Portal PIN — kept in memory only. A page refresh wipes it, so the PIN screen returns. */
  setPin(pin: string) {
    this.pin = pin || '';
  }

  getPin(): string {
    return this.pin || '';
  }

  clearPin() {
    this.pin = '';
    this.deletePin = '';
  }

  /** Deletion authority PIN — in memory only, never stored. Sent as x-delete-pin. */
  setDeletePin(pin: string) {
    this.deletePin = pin || '';
  }

  getDeletePin(): string {
    return this.deletePin || '';
  }

  /**
   * Back-compat stub: offline/cache mode no longer exists (pure sheet sync).
   * Always online; failures throw instead of falling back to stale data.
   */
  private enterOfflineMode(_reason: string): void {}

  /**
   * Mutation wrapper. Pure sheet sync: the call either succeeds against the
   * live sheet or throws. Nothing is ever faked locally.
   */
  private async mutateOrThrow(action: string, payload: any): Promise<any> {
    return this.callGas(action, payload);
  }

  private async callGas(action: string, payload: any = {}): Promise<any> {
    const pin = this.getPin();
    const gasUrl = this.getGasUrl();
    const gasApiKey = this.getGasApiKey();
    const deletePin = this.getDeletePin();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-app-pin': pin,
      'x-gas-url': gasUrl,
      'x-gas-api-key': gasApiKey,
    };
    if (deletePin) headers['x-delete-pin'] = deletePin;

    let response: Response;
    try {
      response = await fetch('/api/gas', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action, payload, gasUrl, gasApiKey }),
      });
    } catch (err: any) {
      throw new Error('Could not reach the billing server. Check your internet connection and retry.');
    }

    let data: any = null;
    const responseText = await response.text();
    try {
      data = JSON.parse(responseText);
    } catch {
      // non-JSON (proxy already guards HTML); fall through to status handling
    }

    if (response.status === 401) {
      if (data && (data as any).deletePinRequired) {
        throw new DeletePinRequiredError('Delete authority PIN required. Enter the deletion PIN to continue.');
      }
      throw new Error('Incorrect PIN. Please re-enter your 4-digit PIN.');
    }

    if (data && (data as any).notConfigured) {
      throw new Error(
        'Google Apps Script Web App URL is not configured. Set GAS_URL in Vercel or paste your Apps Script URL in Settings > Google Sheets Connection.'
      );
    }

    if (!response.ok || (data && data.ok === false)) {
      const errMsg = (data && data.error) || `Google Apps Script returned an error (HTTP ${response.status})`;
      throw new Error(errMsg);
    }

    return (data && (data.data || data)) || data;
  }

  // --- Local Storage Sync & Simulation ---
  async bootstrap(): Promise<BootstrapData & { drafts?: DocumentRecord[] }> {
    const res = await this.callGas('bootstrap', {});
    if (!res) throw new Error('Empty response from the billing server.');
    const rawSettings = res.settings;
    let settings: SupplierSettings = rawSettings || DEFAULT_SETTINGS;
    if (!settings.firms || settings.firms.length === 0) {
      settings.firms = DEFAULT_FIRMS;
      settings.ownerName = settings.ownerName || 'MIAN FARHAN ANWAR';
      settings.activeFirmId = settings.activeFirmId || DEFAULT_FIRMS[0].id;
    }

    const rawDocs = res.docs || [];
    const docs = normalizeDocsList(rawDocs);

    const rawDrafts = res.drafts || [];
    const drafts = normalizeDocsList(rawDrafts);

    const rawClients = res.clients || [];
    const clients = normalizeClientsList(rawClients, docs);

    const catalog = Array.isArray(res.catalog) ? res.catalog : [];

    return { settings, clients, docs, catalog, drafts };
  }

  async getDoc(docId: string): Promise<{ doc: DocumentRecord; items: LineItem[] }> {
    const res = await this.callGas('getDoc', { docId });
    const rawItems = res.items || res.Items || res.data?.items || res.doc?.items || res.doc?.Items || [];
    const normItems = safeNormalizeItems(rawItems);
    const docObj = res.doc || res.data?.doc || res;
    return { doc: { ...docObj, items: normItems }, items: normItems };
  }

  async saveDoc(doc: any): Promise<{ ok: boolean; docId: string; docNo: string; docNoCorrected?: boolean }> {
    const items = doc.items || doc.Items || [];
    const normalizedItems = items.map((it: any, idx: number) => {
      const q = Number(it.qty ?? it.Qty ?? 1);
      const r = Number(it.rate ?? it.Rate ?? 0);
      const a = Number(it.amount ?? it.Amount ?? Math.round(q * r * 100) / 100);
      const desc = String(it.description || it.Description || '');
      const unit = String(it.unit || it.Unit || 'Nos');
      const tax = it.tax || it.Tax || 'GST';
      const itemGst = it.gstRate ?? it.GstRate ?? it.taxRate ?? it.TaxRate;
      return {
        sr: it.sr || it.Sr || idx + 1,
        Sr: it.sr || it.Sr || idx + 1,
        description: desc,
        Description: desc,
        unit: unit,
        Unit: unit,
        qty: q,
        Qty: q,
        rate: r,
        Rate: r,
        tax: tax,
        Tax: tax,
        gstRate: itemGst,
        GstRate: itemGst,
        taxRate: itemGst,
        TaxRate: itemGst,
        amount: a,
        Amount: a,
      };
    });

    // Ensure live totals are calculated and attached
    const docGstRate = (doc.gstRate !== undefined && doc.gstRate !== null && !isNaN(Number(doc.gstRate)))
      ? Number(doc.gstRate)
      : ((doc as any).GstRate !== undefined && !isNaN(Number((doc as any).GstRate)))
      ? Number((doc as any).GstRate)
      : 0.18;
    const totals = calculateTotals(normalizedItems, docGstRate, 0.16);

    const clientNameStr = String(doc.clientName || doc.ClientName || '').trim();
    const clientAddressStr = String(doc.clientAddress || doc.ClientAddress || '').trim();
    const clientNTNStr = String(doc.clientNTN || doc.ClientNTN || '').trim();

    const normalizedDoc = {
      ...doc,
      docId: doc.docId || doc.DocID || '',
      DocID: doc.docId || doc.DocID || '',
      firmId: doc.firmId || '',
      firmName: doc.firmName || '',
      type: doc.type || doc.Type || 'BILL',
      Type: doc.type || doc.Type || 'BILL',
      docNo: doc.docNo || doc.DocNo || '',
      DocNo: doc.docNo || doc.DocNo || '',
      date: doc.date || doc.Date || '',
      Date: doc.date || doc.Date || '',
      validUntil: doc.validUntil || doc.ValidUntil || '',
      ValidUntil: doc.validUntil || doc.ValidUntil || '',
      clientName: clientNameStr,
      ClientName: clientNameStr,
      clientAddress: clientAddressStr,
      ClientAddress: clientAddressStr,
      clientNTN: clientNTNStr,
      ClientNTN: clientNTNStr,
      refText: String(doc.refText || doc.RefText || '').trim(),
      RefText: String(doc.refText || doc.RefText || '').trim(),
      requestId: doc.requestId || doc.RequestId || '',
      RequestId: doc.requestId || doc.RequestId || '',
      goodsSub: totals.goodsSub,
      GoodsSub: totals.goodsSub,
      gst: totals.gst,
      GST: totals.gst,
      serviceSub: totals.serviceSub,
      ServiceSub: totals.serviceSub,
      pst: totals.pst,
      PST: totals.pst,
      otherSub: totals.otherSub,
      OtherSub: totals.otherSub,
      grandTotal: totals.grandTotal,
      GrandTotal: totals.grandTotal,
      items: normalizedItems,
      Items: normalizedItems,
    };

    // Backend contract (Code.gs handleSaveDoc) reads payload.docData.
    // Sending any other key silently produces a blank record, so keep this exact.
    const backendResult: any = await this.mutateOrThrow('saveDoc', { docData: normalizedDoc });
    return backendResult;
  }

  /**
   * Autosaves the in-progress bill/quotation as a server-side draft (status='Draft').
   * Drafts hold no number and never touch counters; the draft row becomes the
   * real document when finally saved (same docId).
   */
  async saveDraft(doc: any): Promise<{ ok: boolean; docId: string }> {
    const draft = { ...(doc || {}), status: 'Draft', Status: 'Draft', docNo: '', DocNo: '' };
    const res: any = await this.mutateOrThrow('saveDoc', { docData: draft });
    return { ok: true, docId: res?.docId || draft.docId || draft.DocID || '' };
  }

  /**
   * Best-effort draft save that survives page refresh/close: a keepalive POST
   * can't be cancelled by the unloading page. Used by the pagehide handler.
   */
  async flushDraft(doc: any): Promise<void> {
    try {
      const pin = this.getPin();
      if (!pin) return;
      const draft = { ...(doc || {}), status: 'Draft', Status: 'Draft', docNo: '', DocNo: '' };
      await fetch('/api/gas', {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', 'x-app-pin': pin },
        body: JSON.stringify({ action: 'saveDoc', payload: { docData: draft } }),
      });
    } catch {
      /* best effort only */
    }
  }

  /** Permanently discards an unfinished draft (no counter impact). */
  async discardDraft(docId: string): Promise<{ ok: boolean }> {
    await this.mutateOrThrow('discardDraft', { docId });
    return { ok: true };
  }

  async cancelDoc(docId: string): Promise<{ ok: boolean }> {
    await this.mutateOrThrow('cancelDoc', { docId });
    return { ok: true };
  }

  async saveSettings(settings: SupplierSettings): Promise<{ ok: boolean }> {
    await this.mutateOrThrow('saveSettings', { settings });
    return { ok: true };
  }

  async saveClient(client: SavedClient): Promise<{ ok: boolean; client?: SavedClient }> {
    const norm = normalizeSingleClient(client) || client;
    const res: any = await this.mutateOrThrow('saveClient', { client: norm });
    return { ok: true, client: res?.client };
  }

  async deleteClient(clientId: string, clientName?: string): Promise<{ ok: boolean }> {
    await this.mutateOrThrow('deleteClient', { clientId, clientName });
    return { ok: true };
  }

  /**
   * Permanently deletes a document (LIFO rule) and rolls back sequence number.
   */
  /**
   * Permanently deletes a document (LIFO rule) and rolls back sequence number.
   * The authority PIN is sent as x-delete-pin when provided; the server enforces
   * it only when DELETE_PIN is configured.
   */
  async deleteDoc(
    docId: string,
    docType?: string,
    docNo?: string,
    firmId?: string
  ): Promise<{
    ok: boolean;
    deletedDocId?: string;
    remainingDocs?: DocumentRecord[];
    settings?: SupplierSettings;
    rolledBackNextNo?: string;
  }> {
    const res: any = await this.mutateOrThrow('deleteDoc', { docId, docType, docNo, firmId });
    return { ok: true, ...(res || {}) };
  }

  async checkBackendStatus(): Promise<{
    tested: boolean;
    ok: boolean;
    gasConfigured: boolean;
    gasApiKeyConfigured: boolean;
    appPinConfigured: boolean;
    deletePinConfigured: boolean;
    gasUrl?: string;
    message: string;
  }> {
    try {
      const pin = this.getPin();
      const localUrl = this.getGasUrl();
      const localApiKey = this.getGasApiKey();

      const response = await fetch('/api/gas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-app-pin': pin,
          'x-gas-url': localUrl,
          'x-gas-api-key': localApiKey,
        },
        body: JSON.stringify({ action: 'checkConfig' }),
      });

      if (response.status === 401) {
        return {
          tested: true,
          ok: false,
          gasConfigured: false,
          gasApiKeyConfigured: false,
          appPinConfigured: true,
          deletePinConfigured: false,
          message: 'PIN rejected by server. Check that your device PIN matches APP_PIN.',
        };
      }

      const data = await response.json();
      const config = data?.config || {};
      const effectiveUrl = localUrl || config.gasUrl || '';
      const isConfigured = !!(localUrl || config.gasUrlConfigured);

      if (!isConfigured) {
        return {
          tested: true,
          ok: false,
          gasConfigured: false,
          gasApiKeyConfigured: !!(localApiKey || config.gasApiKeyConfigured),
          appPinConfigured: !!config.appPinConfigured,
          deletePinConfigured: !!config.deletePinConfigured,
          gasUrl: '',
          message: 'Google Apps Script Web App URL is not set. Enter your Web App URL below and click "Connect & Sync".',
        };
      }

      try {
        const testRes = await this.callGas('bootstrap', {});
        if (testRes) {
          const docCount = Array.isArray(testRes.docs) ? testRes.docs.length : 0;
          const clientCount = Array.isArray(testRes.clients) ? testRes.clients.length : 0;
          return {
            tested: true,
            ok: true,
            gasConfigured: true,
            gasApiKeyConfigured: !!(localApiKey || config.gasApiKeyConfigured),
            appPinConfigured: !!config.appPinConfigured,
          deletePinConfigured: !!config.deletePinConfigured,
            gasUrl: effectiveUrl,
            message: `Connected to Google Sheet successfully! Sync active (${docCount} documents, ${clientCount} clients in database).`,
          };
        }
      } catch (err: any) {
        return {
          tested: true,
          ok: false,
          gasConfigured: true,
          gasApiKeyConfigured: !!(localApiKey || config.gasApiKeyConfigured),
          appPinConfigured: !!config.appPinConfigured,
          deletePinConfigured: !!config.deletePinConfigured,
          gasUrl: effectiveUrl,
          message: `Google Apps Script returned an error: ${err.message}`,
        };
      }

      return {
        tested: true,
        ok: true,
        gasConfigured: true,
        gasApiKeyConfigured: !!(localApiKey || config.gasApiKeyConfigured),
        appPinConfigured: !!config.appPinConfigured,
          deletePinConfigured: !!config.deletePinConfigured,
        gasUrl: effectiveUrl,
        message: 'Google Apps Script proxy is active.',
      };
    } catch (err: any) {
      return {
        tested: true,
        ok: false,
        gasConfigured: false,
        gasApiKeyConfigured: false,
        appPinConfigured: false,
        deletePinConfigured: false,
        message: `Failed to reach server: ${err.message}`,
      };
    }
  }

  /**
   * Verifies the PIN against the live backend (server enforces APP_PIN when set).
   * A wrong PIN is rejected even if the sheet is unreachable for other reasons —
   * the old implementation accepted ANY pin because bootstrap() swallowed the 401.
   */
  async verifyPin(pin: string): Promise<boolean> {
    // Pure server check: the PIN is verified against APP_PIN at the proxy.
    // Nothing is stored anywhere - a page refresh always returns to the PIN screen.
    // A wrong PIN returns false; an unreachable server throws (the UI shows
    // "can't reach server" instead of letting anyone in).
    const prevPin = this.getPin();
    this.setPin(pin);
    try {
      await this.callGas('ping', {});
      return true;
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (/incorrect pin/i.test(msg)) {
        this.setPin(prevPin);
        return false;
      }
      this.setPin(prevPin);
      throw new Error('Could not reach the billing server. Check your connection and try again.');
    }
  }
}

export const gasApi = new GasClient();
