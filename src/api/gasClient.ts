// Client for communicating with the serverless /api/gas proxy or local simulated storage

import type { BootstrapData, DocumentRecord, FirmProfile, LineItem, SavedClient, SupplierSettings, DocType } from '../types/billing';
import { calculateTotals, safeNormalizeItems } from '../utils/formatters';
import { calculateRolledBackNextDocNo } from '../utils/lifoHelper';

const STORAGE_KEY_SETTINGS = 'anwar_traders_settings_v2';
const STORAGE_KEY_CLIENTS = 'anwar_traders_clients_v2';
const STORAGE_KEY_DOCS = 'anwar_traders_docs_v2';
const STORAGE_KEY_CATALOG = 'anwar_traders_catalog_v2';
const STORAGE_KEY_OFFLINE_MODE = 'anwar_traders_offline_mode';
const STORAGE_KEY_CACHE_TS = 'anwar_traders_cache_ts';
const STORAGE_KEY_DELETED_DOCS = 'anwar_traders_deleted_docs_v3';
const STORAGE_KEY_GAS_URL = 'anwar_traders_gas_url_v2';
const STORAGE_KEY_GAS_API_KEY = 'anwar_traders_gas_api_key_v2';

/**
 * Clears any old fabricated mock or seed documents from local storage so
 * the user's ledger only reflects real Google Sheet data and user entries.
 */
export function clearFabricatedData(): void {
  try {
    const storedDocs = localStorage.getItem(STORAGE_KEY_DOCS);
    if (storedDocs) {
      const parsed = JSON.parse(storedDocs);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter((d: any) => {
          const id = String(d?.docId || d?.DocID || '');
          const ref = String(d?.refText || d?.RefText || '');
          return id !== 'doc-petty-187365' && !ref.includes('Petty-187365');
        });
        localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(cleaned));
        try { localStorage.setItem(STORAGE_KEY_CACHE_TS, String(Date.now())); } catch { /* ignore */ }
      }
    }
    const storedClients = localStorage.getItem(STORAGE_KEY_CLIENTS);
    if (storedClients) {
      const parsed = JSON.parse(storedClients);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter((c: any) => {
          const id = String(c?.id || '');
          return id !== 'client-1' && id !== 'client-2' && id !== 'client-3';
        });
        localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(cleaned));
      }
    }
  } catch {
    // ignore
  }
}

export function getDeletedDocKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED_DOCS);
    if (!raw) return new Set();
    const list = JSON.parse(raw);
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

export function recordDeletedDocKey(docId?: string, docNo?: string, docType?: string, firmId?: string) {
  try {
    const current = getDeletedDocKeys();
    // Tombstone ONLY the exact document ID. Never record bare "TYPE-NO" keys:
    // bill numbers can repeat across history, and a number-based tombstone
    // would permanently hide innocent documents sharing that number.
    if (docId && String(docId).trim()) {
      current.add(String(docId).trim());
    }
    localStorage.setItem(STORAGE_KEY_DELETED_DOCS, JSON.stringify(Array.from(current)));
  } catch (e) {
    console.error('Failed to record deleted doc key:', e);
  }
}

export function isDocDeleted(d: any): boolean {
  if (!d) return false;
  const deletedKeys = getDeletedDocKeys();
  if (deletedKeys.size === 0) return false;

  // Match ONLY by exact document ID. Number-based matching is unsafe because
  // bill numbers may repeat across history.
  const id = String(d.docId || d.DocID || '').trim();
  if (id && deletedKeys.has(id)) return true;

  return false;
}

export const DEFAULT_FIRMS: FirmProfile[] = [
  {
    id: 'firm-anwar-traders',
    name: 'Anwar Traders',
    tagline: 'General Order Suppliers & Govt Contractors',
    address: 'Suit # 14, 2nd Floor, Al-Rehman Centre, Bank Road, Rawalpindi',
    phone: '0300-5123456 / 051-5551234',
    ntn: '1428392-7',
    gst: '07-01-9876-543-21',
    vendorNo: 'V-40892',
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
    tagline: 'Govt Order Suppliers & Mechanical/Civil Contractors',
    address: 'Office # 08, Commercial Complex, Rawalpindi',
    phone: '0300-9876543 / 051-5558899',
    ntn: '2948172-5',
    gst: '07-02-4567-890-12',
    vendorNo: 'V-51290',
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
    .filter((d: any) => !isDocDeleted(d))
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
  private pin: string = '';
  private gasUrl: string = '';
  private gasApiKey: string = '';
  private isOfflineMode: boolean = false;
  private offlineReason: string = '';

  constructor() {
    this.pin = localStorage.getItem('anwar_traders_pin') || '';
    this.gasUrl = localStorage.getItem(STORAGE_KEY_GAS_URL) || '';
    this.gasApiKey = localStorage.getItem(STORAGE_KEY_GAS_API_KEY) || '';
    this.isOfflineMode = localStorage.getItem(STORAGE_KEY_OFFLINE_MODE) === 'true';
    clearFabricatedData();
  }

  getGasUrl(): string {
    // Priority: in-memory > this browser's saved URL > build-time Vercel env (VITE_GAS_URL).
    // The Vercel env fallback means the sheet connects on every device/browser with zero manual setup.
    const envUrl = (import.meta as any)?.env?.VITE_GAS_URL || '';
    return this.gasUrl || localStorage.getItem(STORAGE_KEY_GAS_URL) || envUrl || '';
  }

  /** When the local document cache was last written (ms epoch). Used to label offline data honestly. */
  private touchCacheTs(): void {
    try { localStorage.setItem(STORAGE_KEY_CACHE_TS, String(Date.now())); } catch { /* ignore */ }
  }

  getCacheTimestamp(): number | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CACHE_TS);
      const n = raw ? Number(raw) : NaN;
      return Number.isFinite(n) && n > 0 ? n : null;
    } catch { return null; }
  }

  setGasUrl(url: string) {
    this.gasUrl = url.trim();
    localStorage.setItem(STORAGE_KEY_GAS_URL, this.gasUrl);
  }

  getGasApiKey(): string {
    return this.gasApiKey || localStorage.getItem(STORAGE_KEY_GAS_API_KEY) || '';
  }

  setGasApiKey(key: string) {
    this.gasApiKey = key.trim();
    localStorage.setItem(STORAGE_KEY_GAS_API_KEY, this.gasApiKey);
  }

  async saveGasConfig(url: string, key?: string): Promise<{ ok: boolean; message: string }> {
    this.setGasUrl(url);
    if (key !== undefined) this.setGasApiKey(key);

    try {
      const res = await fetch('/api/gas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-app-pin': this.getPin(),
          'x-gas-url': this.getGasUrl(),
          'x-gas-api-key': this.getGasApiKey(),
        },
        body: JSON.stringify({
          action: 'saveGasConfig',
          payload: { gasUrl: this.getGasUrl(), gasApiKey: this.getGasApiKey() },
        }),
      });
      const data = await res.json();
      return data;
    } catch {
      return { ok: true, message: 'Configuration saved locally.' };
    }
  }

  wipeLocalCache(): void {
    localStorage.removeItem(STORAGE_KEY_DOCS);
    localStorage.removeItem(STORAGE_KEY_CLIENTS);
    localStorage.removeItem(STORAGE_KEY_CATALOG);
    localStorage.removeItem(STORAGE_KEY_DELETED_DOCS);
  }

  setPin(pin: string) {
    this.pin = pin;
    localStorage.setItem('anwar_traders_pin', pin);
  }

  getPin(): string {
    return this.pin || localStorage.getItem('anwar_traders_pin') || '';
  }

  clearPin() {
    this.pin = '';
    localStorage.removeItem('anwar_traders_pin');
  }

  setIsOfflineMode(offline: boolean) {
    this.isOfflineMode = offline;
    localStorage.setItem(STORAGE_KEY_OFFLINE_MODE, String(offline));
  }

  getIsOfflineMode(): boolean {
    return this.isOfflineMode;
  }

  /** Human-readable reason the app fell back to offline/cached mode (empty when online). */
  getOfflineReason(): string {
    return this.offlineReason || '';
  }

  /**
   * Single choke point for entering offline mode. Cached data is never again
   * presented as live: every fallback path records WHY it fell back.
   */
  private enterOfflineMode(reason: string): void {
    this.offlineReason = reason || 'The Google Sheet could not be reached.';
    this.setIsOfflineMode(true);
  }

  /** True when a failed backend call looks like connectivity/config trouble rather than a business-rule rejection. */
  private isConnectivityError(err: any): boolean {
    const msg = String(err?.message || err || '');
    return /not configured|failed to fetch|network|load failed|timeout|econn|enotfound|socket|offline/i.test(msg);
  }

  /**
   * Honest mutation wrapper. Connectivity trouble -> enter offline mode and throw
   * a clear message (never a fake local success). A backend business-rule
   * rejection (duplicate, validation, LIFO violation) -> thrown as-is.
   */
  private async mutateOrThrow(action: string, payload: any, offlineMsg: string): Promise<any> {
    try {
      return await this.callGas(action, payload);
    } catch (err: any) {
      if (this.isConnectivityError(err)) {
        this.enterOfflineMode(String(err?.message || 'Could not reach the Google Sheet.'));
        throw new Error(offlineMsg);
      }
      throw err;
    }
  }

  private async callGas(action: string, payload: any = {}): Promise<any> {
    const pin = this.getPin();
    const gasUrl = this.getGasUrl();
    const gasApiKey = this.getGasApiKey();

    const response = await fetch('/api/gas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-app-pin': pin,
        'x-gas-url': gasUrl,
        'x-gas-api-key': gasApiKey,
      },
      body: JSON.stringify({ action, payload, gasUrl, gasApiKey }),
    });

    if (response.status === 401) {
      throw new Error('Incorrect PIN. Please re-enter your 4-digit PIN.');
    }

    let data: any;
    const responseText = await response.text();
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(
        `Server returned non-JSON response (${response.status}): ${responseText.substring(0, 150)}`
      );
    }

    if (data && data.notConfigured) {
      if (action === 'bootstrap') {
        this.enterOfflineMode('Google Sheet URL is not configured for this browser. Paste your Apps Script Web App URL in Settings → Google Sheets Sync, or set VITE_GAS_URL in Vercel.');
        return this.localCall(action, payload);
      }
      throw new Error(
        'Google Apps Script Web App URL is not configured. Please paste your Apps Script URL in Settings > Google Sheets Connection.'
      );
    }

    if (!response.ok || data.ok === false) {
      const errMsg = data.error || `Google Apps Script returned an error (HTTP ${response.status})`;
      if (action === 'bootstrap') {
        console.warn('Bootstrap API error, using local cache:', errMsg);
        this.enterOfflineMode(errMsg);
        return this.localCall(action, payload);
      }
      throw new Error(errMsg);
    }

    this.setIsOfflineMode(false);
    this.offlineReason = '';
    return data.data || data;
  }

  // --- Local Storage Sync & Simulation ---
  private localCall(action: string, payload: any): any {
    switch (action) {
      case 'bootstrap': {
        const storedSettings = localStorage.getItem(STORAGE_KEY_SETTINGS);
        const storedClients = localStorage.getItem(STORAGE_KEY_CLIENTS);
        const storedDocs = localStorage.getItem(STORAGE_KEY_DOCS);
        const storedCatalog = localStorage.getItem(STORAGE_KEY_CATALOG);

        let settings: SupplierSettings = storedSettings ? JSON.parse(storedSettings) : DEFAULT_SETTINGS;
        if (!settings.firms || settings.firms.length === 0) {
          settings.firms = DEFAULT_FIRMS;
          settings.ownerName = settings.ownerName || 'MIAN FARHAN ANWAR';
          settings.activeFirmId = settings.activeFirmId || DEFAULT_FIRMS[0].id;
        }

        const rawDocs = storedDocs ? JSON.parse(storedDocs) : [];
        const docs = normalizeDocsList(rawDocs);

        const rawClients = storedClients ? JSON.parse(storedClients) : [];
        const clients = normalizeClientsList(rawClients, docs);

        const catalog = storedCatalog ? JSON.parse(storedCatalog) : [];

        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
        localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(clients));
        localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(docs));
        this.touchCacheTs();
        localStorage.setItem(STORAGE_KEY_CATALOG, JSON.stringify(catalog));

        return { settings, clients, docs, catalog };
      }

      case 'getDoc': {
        const storedDocs = localStorage.getItem(STORAGE_KEY_DOCS);
        const docs = normalizeDocsList(storedDocs ? JSON.parse(storedDocs) : []);
        const targetId = String(payload?.docId || '');
        const found = docs.find((d) => String(d.docId || d.DocID || '') === targetId);
        if (found) {
          return { doc: found, items: safeNormalizeItems(found.items || found.Items) };
        }
        return {
          doc: { docId: targetId, type: 'BILL', docNo: '', date: '', clientName: '', refText: '', items: [] } as any,
          items: [],
        };
      }

      case 'saveDoc': {
        const storedDocs = localStorage.getItem(STORAGE_KEY_DOCS);
        const docs = normalizeDocsList(storedDocs ? JSON.parse(storedDocs) : []);

        const storedSettings = localStorage.getItem(STORAGE_KEY_SETTINGS);
        const settings: SupplierSettings = storedSettings ? JSON.parse(storedSettings) : DEFAULT_SETTINGS;

        const docToSave = payload.doc;
        const isNew = !docToSave.docId && !docToSave.DocID;
        const docId = docToSave.docId || docToSave.DocID || 'doc-' + Date.now();

        const activeFirm = (settings.firms || []).find((f) => f.id === docToSave.firmId) || settings.firms?.[0] || DEFAULT_FIRMS[0];

        let docNo = docToSave.docNo || docToSave.DocNo;
        if (!docNo) {
          if (docToSave.type === 'BILL') {
            docNo = activeFirm.nextBillNo;
            const next = String(Number(activeFirm.nextBillNo || '100') + 1);
            activeFirm.nextBillNo = next;
            settings.nextBillNo = next;
          } else {
            docNo = activeFirm.nextQuoteNo;
            const numPart = activeFirm.nextQuoteNo.replace(/\D/g, '') || '200';
            const prefix = activeFirm.nextQuoteNo.replace(/\d/g, '') || 'Q-';
            const next = `${prefix}${Number(numPart) + 1}`;
            activeFirm.nextQuoteNo = next;
            settings.nextQuoteNo = next;
          }
          localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
        }

        const gstRateToUse = (docToSave.gstRate !== undefined && docToSave.gstRate !== null && !isNaN(Number(docToSave.gstRate)))
          ? Number(docToSave.gstRate)
          : ((docToSave as any).GstRate !== undefined && !isNaN(Number((docToSave as any).GstRate)))
          ? Number((docToSave as any).GstRate)
          : (activeFirm.gstRate || 0.18);

        const totals = calculateTotals(docToSave.items || docToSave.Items || [], gstRateToUse, 0.16);

        const fullRecord: DocumentRecord = {
          ...docToSave,
          docId,
          DocID: docId,
          docNo,
          DocNo: docNo,
          firmId: activeFirm.id,
          firmName: activeFirm.name,
          Type: docToSave.type,
          Date: docToSave.date,
          ClientName: docToSave.clientName,
          ClientAddress: docToSave.clientAddress,
          ClientNTN: docToSave.clientNTN,
          RefText: docToSave.refText,
          GoodsSub: totals.goodsSub,
          goodsSub: totals.goodsSub,
          GST: totals.gst,
          gst: totals.gst,
          gstRate: gstRateToUse,
          GstRate: gstRateToUse,
          gstBreakdown: totals.gstBreakdown,
          GstBreakdown: totals.gstBreakdown,
          ServiceSub: totals.serviceSub,
          serviceSub: totals.serviceSub,
          PST: totals.pst,
          pst: totals.pst,
          OtherSub: totals.otherSub,
          otherSub: totals.otherSub,
          GrandTotal: totals.grandTotal,
          grandTotal: totals.grandTotal,
          Status: 'Active',
          status: 'Active',
        };

        if (isNew) {
          docs.unshift(fullRecord);
        } else {
          const idx = docs.findIndex((d) => (d.docId || d.DocID) === docId);
          if (idx >= 0) {
            docs[idx] = fullRecord;
          } else {
            docs.unshift(fullRecord);
          }
        }
        localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(docs));
        this.touchCacheTs();

        // Auto-save Client locally as well
        if (docToSave.clientName) {
          const storedClients = localStorage.getItem(STORAGE_KEY_CLIENTS);
          const clients = normalizeClientsList(storedClients ? JSON.parse(storedClients) : SEED_CLIENTS, docs);
          const cNameLower = String(docToSave.clientName).toLowerCase().trim();
          const existing = clients.find((c) => c.name.toLowerCase().trim() === cNameLower);
          if (!existing) {
            clients.unshift({
              id: 'client-' + Date.now(),
              name: String(docToSave.clientName).trim(),
              Name: String(docToSave.clientName).trim(),
              address: String(docToSave.clientAddress || '').trim(),
              Address: String(docToSave.clientAddress || '').trim(),
              ntn: String(docToSave.clientNTN || '').trim(),
              NTN: String(docToSave.clientNTN || '').trim(),
              lastUsed: String(docToSave.date || '').trim(),
              LastUsed: String(docToSave.date || '').trim(),
              totalOrders: 1,
              totalBilled: totals.grandTotal,
            });
          } else {
            existing.address = String(docToSave.clientAddress || existing.address).trim();
            existing.Address = existing.address;
            existing.ntn = String(docToSave.clientNTN || existing.ntn).trim();
            existing.NTN = existing.ntn;
            existing.lastUsed = String(docToSave.date || existing.lastUsed).trim();
            existing.LastUsed = existing.lastUsed;
            existing.totalOrders = (existing.totalOrders || 0) + 1;
            existing.totalBilled = (existing.totalBilled || 0) + totals.grandTotal;
          }
          localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(clients));
        }

        // Auto-save Catalog
        const rowItems = docToSave.items || docToSave.Items || [];
        if (rowItems.length > 0) {
          const storedCatalog = localStorage.getItem(STORAGE_KEY_CATALOG);
          const catalog = storedCatalog ? JSON.parse(storedCatalog) : [];
          for (const item of rowItems) {
            const desc = String(item.description || item.Description || '').trim();
            if (desc && !catalog.find((c: any) => c.description.toLowerCase() === desc.toLowerCase())) {
              catalog.push({
                description: desc,
                unit: item.unit || item.Unit || 'Nos',
                rate: Number(item.rate ?? item.Rate ?? 0),
                tax: item.tax || item.Tax || 'GST',
              });
            }
          }
          localStorage.setItem(STORAGE_KEY_CATALOG, JSON.stringify(catalog));
        }

        return { ok: true, docId, docNo };
      }

      case 'cancelDoc': {
        const storedDocs = localStorage.getItem(STORAGE_KEY_DOCS);
        const docs = normalizeDocsList(storedDocs ? JSON.parse(storedDocs) : []);
        const doc = docs.find((d) => (d.docId || d.DocID) === payload.docId);
        if (doc) {
          doc.status = 'Cancelled';
          doc.Status = 'Cancelled';
          localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(docs));
          this.touchCacheTs();
        }
        return { ok: true };
      }

      case 'saveSettings': {
        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(payload.settings));
        return { ok: true };
      }

      case 'saveClient': {
        const storedClients = localStorage.getItem(STORAGE_KEY_CLIENTS);
        const clients = normalizeClientsList(storedClients ? JSON.parse(storedClients) : []);
        const norm = normalizeSingleClient(payload.client) || payload.client;
        const normNameLower = norm.name.toLowerCase().trim();
        const idx = clients.findIndex((c) => c.id === norm.id || c.name.toLowerCase().trim() === normNameLower);
        if (idx >= 0) {
          clients[idx] = { ...clients[idx], ...norm };
        } else {
          clients.unshift(norm);
        }
        localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(clients));
        return { ok: true, client: norm };
      }

      case 'deleteClient': {
        const storedClients = localStorage.getItem(STORAGE_KEY_CLIENTS);
        const clients = normalizeClientsList(storedClients ? JSON.parse(storedClients) : []);
        const targetId = payload.clientId;
        const targetNameLower = String(payload.clientName || '').toLowerCase().trim();
        const filtered = clients.filter(
          (c) => c.id !== targetId && (!targetNameLower || c.name.toLowerCase().trim() !== targetNameLower)
        );
        localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(filtered));
        return { ok: true };
      }

      case 'deleteDoc': {
        const storedDocs = localStorage.getItem(STORAGE_KEY_DOCS);
        const docs = normalizeDocsList(storedDocs ? JSON.parse(storedDocs) : []);
        const targetId = String(payload.docId || '').trim();
        const targetNo = String(payload.docNo || '').trim();
        const docType = String(payload.docType || 'BILL').toUpperCase() as DocType;
        const firmId = payload.firmId ? String(payload.firmId).trim() : undefined;

        // Record persistent tombstone so this document is permanently purged
        recordDeletedDocKey(targetId, targetNo, docType, firmId);

        // Remove ONLY the exact document by ID. Never filter by document number:
        // numbers can repeat across history and must not cause collateral removal.
        const filtered = docs.filter((d) => {
          const dId = String(d.docId || d.DocID || '').trim();
          if (targetId && dId) return dId !== targetId;
          return true;
        });
        localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(filtered));
        this.touchCacheTs();

        // Automatic LIFO Sequence rollback: Revert nextBillNo or nextQuoteNo if applicable
        let updatedSettings: SupplierSettings | undefined;
        let rolledBack = '';
        const storedSettings = localStorage.getItem(STORAGE_KEY_SETTINGS);
        if (storedSettings) {
          try {
            const settings: SupplierSettings = JSON.parse(storedSettings);
            const activeFirm = (settings.firms || []).find((f) => f.id === firmId) || settings.firms?.[0];
            if (activeFirm) {
              const currentNext = docType === 'BILL' ? (activeFirm.nextBillNo || '101') : (activeFirm.nextQuoteNo || 'Q-201');
              rolledBack = calculateRolledBackNextDocNo(filtered, docType, activeFirm.id, currentNext);
              if (docType === 'BILL') {
                activeFirm.nextBillNo = rolledBack;
                if (settings.activeFirmId === activeFirm.id) settings.nextBillNo = rolledBack;
              } else {
                activeFirm.nextQuoteNo = rolledBack;
                if (settings.activeFirmId === activeFirm.id) settings.nextQuoteNo = rolledBack;
              }
              localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
              updatedSettings = settings;
            }
          } catch (e) {
            console.error('Error rolling back sequence counter on deleteDoc:', e);
          }
        }

        return {
          ok: true,
          deletedDocId: targetId,
          remainingDocs: filtered,
          settings: updatedSettings,
          rolledBackNextNo: rolledBack,
        };
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  // --- Public API methods ---

  async bootstrap(): Promise<BootstrapData> {
    try {
      const res = await this.callGas('bootstrap', {});
      if (res) {
        const rawSettings = res.settings;
        let settings: SupplierSettings = rawSettings || DEFAULT_SETTINGS;
        if (!settings.firms || settings.firms.length === 0) {
          settings.firms = DEFAULT_FIRMS;
          settings.ownerName = settings.ownerName || 'MIAN FARHAN ANWAR';
          settings.activeFirmId = settings.activeFirmId || DEFAULT_FIRMS[0].id;
        }

        const rawDocs = res.docs || [];
        const docs = normalizeDocsList(rawDocs);

        const rawClients = res.clients || [];
        const clients = normalizeClientsList(rawClients, docs);

        const catalog = Array.isArray(res.catalog) ? res.catalog : [];

        // Sync local storage cache
        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
        localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(docs));
        this.touchCacheTs();
        localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(clients));
        localStorage.setItem(STORAGE_KEY_CATALOG, JSON.stringify(catalog));

        return { settings, clients, docs, catalog };
      }
      return this.localCall('bootstrap', {});
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (/incorrect pin/i.test(msg)) throw err; // wrong PIN -> App forces re-login, never stale data
      console.warn('Bootstrap failed, falling back to local cache:', err);
      this.enterOfflineMode(msg || 'Could not reach the Google Sheet backend.');
      return this.localCall('bootstrap', {});
    }
  }

  async getDoc(docId: string): Promise<{ doc: DocumentRecord; items: LineItem[] }> {
    try {
      const res = await this.callGas('getDoc', { docId });
      if (res && typeof res === 'object') {
        const rawItems = res.items || res.Items || res.data?.items || res.doc?.items || res.doc?.Items || [];
        const normItems = safeNormalizeItems(rawItems);
        const docObj = res.doc || res.data?.doc || res;
        return { doc: { ...docObj, items: normItems }, items: normItems };
      }
      return this.localCall('getDoc', { docId });
    } catch {
      return this.localCall('getDoc', { docId });
    }
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
    const backendResult: any = await this.mutateOrThrow(
      'saveDoc',
      { docData: normalizedDoc },
      "You're offline \u2014 the document was NOT saved to your Google Sheet. Reconnect and try again."
    );

    // Always update local cache on successful save
    this.localCall('saveDoc', {
      doc: {
        ...normalizedDoc,
        docId: backendResult?.docId || normalizedDoc.docId,
        docNo: backendResult?.docNo || normalizedDoc.docNo,
      },
    });

    return backendResult;
  }

  async cancelDoc(docId: string): Promise<{ ok: boolean }> {
    await this.mutateOrThrow(
      'cancelDoc',
      { docId },
      "You're offline \u2014 the document was NOT cancelled. Reconnect and try again."
    );
    return this.localCall('cancelDoc', { docId });
  }

  async saveSettings(settings: SupplierSettings): Promise<{ ok: boolean }> {
    await this.mutateOrThrow(
      'saveSettings',
      { settings },
      "You're offline \u2014 settings were NOT saved. Reconnect and try again."
    );
    return this.localCall('saveSettings', { settings });
  }

  async saveClient(client: SavedClient): Promise<{ ok: boolean; client?: SavedClient }> {
    const norm = normalizeSingleClient(client) || client;
    await this.mutateOrThrow(
      'saveClient',
      { client: norm },
      "You're offline \u2014 the client was NOT saved. Reconnect and try again."
    );
    return this.localCall('saveClient', { client: norm });
  }

  async deleteClient(clientId: string, clientName?: string): Promise<{ ok: boolean }> {
    await this.mutateOrThrow(
      'deleteClient',
      { clientId, clientName },
      "You're offline \u2014 the client was NOT deleted. Reconnect and try again."
    );
    return this.localCall('deleteClient', { clientId, clientName });
  }

  /**
   * Permanently deletes a document (LIFO rule) and rolls back sequence number.
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
    await this.mutateOrThrow(
      'deleteDoc',
      { docId, docType, docNo, firmId },
      "You're offline \u2014 the document was NOT deleted from your sheet. Reconnect and try again."
    );
    // Tombstone only after the backend confirms: a failed delete must never
    // hide a document that still exists in the register.
    recordDeletedDocKey(docId, docNo, docType, firmId);
    return this.localCall('deleteDoc', { docId, docType, docNo, firmId });
  }

  /**
   * Updates or saves user PIN locally
   */
  updatePin(newPin: string): boolean {
    if (!newPin || newPin.length < 4) return false;
    this.setPin(newPin);
    return true;
  }

  async checkBackendStatus(): Promise<{
    tested: boolean;
    ok: boolean;
    gasConfigured: boolean;
    gasApiKeyConfigured: boolean;
    appPinConfigured: boolean;
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
    const prevPin = this.getPin();
    try {
      this.setPin(pin);
      await this.callGas('ping', {}); // throws on 401 Incorrect PIN; never swallowed
      this.setIsOfflineMode(false);
      this.offlineReason = '';
      return true;
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (/incorrect pin/i.test(msg)) {
        // Wrong PIN: restore previous device state and reject.
        if (prevPin) this.setPin(prevPin); else this.clearPin();
        return false;
      }
      // Backend unreachable: device-local gate. Accept when it matches the
      // previously saved PIN, or on first-ever setup (no PIN stored yet).
      if (prevPin) {
        if (pin === prevPin) { this.setPin(pin); return true; }
        this.setPin(prevPin);
        return false;
      }
      if (pin && pin.length >= 4) { this.setPin(pin); return true; }
      return false;
    }
  }
}

export const gasApi = new GasClient();
