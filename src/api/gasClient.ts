// Client for communicating with the serverless /api/gas proxy or local simulated storage

import type { BootstrapData, DocumentRecord, FirmProfile, LineItem, SavedClient, SupplierSettings } from '../types/billing';
import { calculateTotals, safeNormalizeItems } from '../utils/formatters';

const STORAGE_KEY_SETTINGS = 'anwar_traders_settings_v2';
const STORAGE_KEY_CLIENTS = 'anwar_traders_clients_v2';
const STORAGE_KEY_DOCS = 'anwar_traders_docs_v2';
const STORAGE_KEY_CATALOG = 'anwar_traders_catalog_v2';
const STORAGE_KEY_OFFLINE_MODE = 'anwar_traders_offline_mode';

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
  { description: 'Toyota Corolla Brake Pad Set (Front & Rear Genuine)', unit: 'Set', rate: 14500, tax: 'GST' as const },
  { description: 'Engine Oil Filter & Air Filter Element', unit: 'Nos', rate: 3200, tax: 'GST' as const },
  { description: 'Dry Charged Heavy Duty Battery 12V 65AH', unit: 'Nos', rate: 22750, tax: 'GST' as const },
  { description: 'Engine Synthetic Lubricant 5W-30 (4 Litres Pack)', unit: 'Pack', rate: 11200, tax: 'GST' as const },
  { description: 'Complete Brake System Overhauling & Servicing Labor', unit: 'Job', rate: 4500, tax: 'PST' as const },
  { description: 'Suspension Bushing Replacement & Tuning Labor', unit: 'Job', rate: 11344.22, tax: 'PST' as const },
  { description: 'AC Compressor Gas Recharge & Leakage Test', unit: 'Job', rate: 6500, tax: 'PST' as const },
  { description: 'Computerized Engine Diagnostics & Tuning', unit: 'Job', rate: 3500, tax: 'PST' as const },
];

export const SEED_CLIENTS: SavedClient[] = [
  {
    id: 'client-1',
    name: 'Director General Health Services Punjab',
    address: '24-Cooper Road, Lahore',
    ntn: '9010203-4',
    phone: '042-99201139',
    contactPerson: 'Director Admin & Procurement',
    totalOrders: 14,
    totalBilled: 1245000,
  },
  {
    id: 'client-2',
    name: 'Secretary Communication & Works Department',
    address: 'Punjab Civil Secretariat, Lower Mall, Lahore',
    ntn: '9020304-5',
    phone: '042-99211244',
    contactPerson: 'Section Officer (General)',
    totalOrders: 8,
    totalBilled: 890000,
  },
  {
    id: 'client-3',
    name: 'District Health Authority Rawalpindi',
    address: 'Khyaban-e-Sir Syed, Rawalpindi',
    ntn: '9030405-6',
    phone: '051-9290044',
    contactPerson: 'Chief Executive Officer DHA',
    totalOrders: 5,
    totalBilled: 420000,
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
    const name = String(raw.name || raw.Name || raw.clientName || raw.ClientName || '').trim();
    if (!name) return null;

    const address = String(raw.address || raw.Address || raw.clientAddress || raw.ClientAddress || '').trim();
    const ntn = String(raw.ntn || raw.NTN || raw.clientNTN || raw.ClientNTN || '').trim();
    const strn = String(raw.strn || raw.STRN || raw.clientSTRN || raw.ClientSTRN || '').trim();
    const lastUsed = String(raw.lastUsed || raw.LastUsed || '').trim();
    const phone = String(raw.phone || raw.Phone || '').trim();
    const contactPerson = String(raw.contactPerson || raw.ContactPerson || '').trim();
    const totalOrders = Number(raw.totalOrders || raw.TotalOrders || 0) || 0;
    const totalBilled = Number(raw.totalBilled || raw.TotalBilled || 0) || 0;

    return {
      id: String(raw.id || raw.ID || 'client-' + name.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 30)),
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

  // Fallback to seed clients if nothing exists
  if (clientMap.size === 0) {
    SEED_CLIENTS.forEach((c) => clientMap.set(c.name.toLowerCase(), c));
  }

  return Array.from(clientMap.values());
}

/**
 * Safely normalizes documents from Google Apps Script or local storage.
 */
export function normalizeDocsList(rawDocs: any): DocumentRecord[] {
  if (!Array.isArray(rawDocs)) return [SEED_PETTY_DOC];

  return rawDocs.map((d: any, idx: number) => {
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
  private isOfflineMode: boolean = false;

  constructor() {
    this.pin = localStorage.getItem('anwar_traders_pin') || '';
    this.isOfflineMode = localStorage.getItem(STORAGE_KEY_OFFLINE_MODE) === 'true';
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

  private async callGas(action: string, payload: any = {}): Promise<any> {
    const pin = this.getPin();

    const response = await fetch('/api/gas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-app-pin': pin,
      },
      body: JSON.stringify({ action, payload }),
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
        this.setIsOfflineMode(true);
        return this.localCall(action, payload);
      }
      throw new Error(
        'GAS_URL is not configured in Vercel Environment Variables. Please add GAS_URL and GAS_API_KEY in Vercel Project Settings.'
      );
    }

    if (!response.ok || data.ok === false) {
      const errMsg = data.error || `Google Apps Script returned an error (HTTP ${response.status})`;
      if (action === 'bootstrap') {
        console.warn('Bootstrap API error, using local cache:', errMsg);
        this.setIsOfflineMode(true);
        return this.localCall(action, payload);
      }
      throw new Error(errMsg);
    }

    this.setIsOfflineMode(false);
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

        const rawDocs = storedDocs ? JSON.parse(storedDocs) : [SEED_PETTY_DOC];
        const docs = normalizeDocsList(rawDocs);

        const rawClients = storedClients ? JSON.parse(storedClients) : SEED_CLIENTS;
        const clients = normalizeClientsList(rawClients, docs);

        const catalog = storedCatalog ? JSON.parse(storedCatalog) : SEED_CATALOG;

        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
        localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(clients));
        localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(docs));
        localStorage.setItem(STORAGE_KEY_CATALOG, JSON.stringify(catalog));

        return { settings, clients, docs, catalog };
      }

      case 'getDoc': {
        const storedDocs = localStorage.getItem(STORAGE_KEY_DOCS);
        const docs = normalizeDocsList(storedDocs ? JSON.parse(storedDocs) : [SEED_PETTY_DOC]);
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
        const docs = normalizeDocsList(storedDocs ? JSON.parse(storedDocs) : [SEED_PETTY_DOC]);

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

        const totals = calculateTotals(docToSave.items || docToSave.Items || [], activeFirm.gstRate, activeFirm.pstRate);

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
          const catalog = storedCatalog ? JSON.parse(storedCatalog) : SEED_CATALOG;
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
        const docs = normalizeDocsList(storedDocs ? JSON.parse(storedDocs) : [SEED_PETTY_DOC]);
        const doc = docs.find((d) => (d.docId || d.DocID) === payload.docId);
        if (doc) {
          doc.status = 'Cancelled';
          doc.Status = 'Cancelled';
          localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(docs));
        }
        return { ok: true };
      }

      case 'saveSettings': {
        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(payload.settings));
        return { ok: true };
      }

      case 'saveClient': {
        const storedClients = localStorage.getItem(STORAGE_KEY_CLIENTS);
        const clients = normalizeClientsList(storedClients ? JSON.parse(storedClients) : SEED_CLIENTS);
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
        const clients = normalizeClientsList(storedClients ? JSON.parse(storedClients) : SEED_CLIENTS);
        const targetId = payload.clientId;
        const targetNameLower = String(payload.clientName || '').toLowerCase().trim();
        const filtered = clients.filter(
          (c) => c.id !== targetId && (!targetNameLower || c.name.toLowerCase().trim() !== targetNameLower)
        );
        localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(filtered));
        return { ok: true };
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

        const catalog = Array.isArray(res.catalog) ? res.catalog : SEED_CATALOG;

        // Sync local storage cache
        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
        localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(docs));
        localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(clients));
        localStorage.setItem(STORAGE_KEY_CATALOG, JSON.stringify(catalog));

        return { settings, clients, docs, catalog };
      }
      return this.localCall('bootstrap', {});
    } catch (err) {
      console.warn('Bootstrap failed, falling back to local cache:', err);
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

  async saveDoc(doc: any): Promise<{ ok: boolean; docId: string; docNo: string }> {
    const items = doc.items || doc.Items || [];
    const normalizedItems = items.map((it: any, idx: number) => {
      const q = Number(it.qty ?? it.Qty ?? 1);
      const r = Number(it.rate ?? it.Rate ?? 0);
      const a = Number(it.amount ?? it.Amount ?? Math.round(q * r * 100) / 100);
      const desc = String(it.description || it.Description || '');
      const unit = String(it.unit || it.Unit || 'Nos');
      const tax = it.tax || it.Tax || 'GST';
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
        amount: a,
        Amount: a,
      };
    });

    // Ensure live totals are calculated and attached
    const totals = calculateTotals(normalizedItems, doc.gstRate || 0.18, doc.pstRate || 0.16);

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

    let backendResult: any;
    try {
      backendResult = await this.callGas('saveDoc', { doc: normalizedDoc });
    } catch (err) {
      console.warn('Backend saveDoc call failed or offline, saving locally:', err);
      return this.localCall('saveDoc', { doc: normalizedDoc });
    }

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
    try {
      await this.callGas('cancelDoc', { docId });
    } catch {
      // ignore
    }
    return this.localCall('cancelDoc', { docId });
  }

  async saveSettings(settings: SupplierSettings): Promise<{ ok: boolean }> {
    try {
      await this.callGas('saveSettings', { settings });
    } catch {
      // ignore
    }
    return this.localCall('saveSettings', { settings });
  }

  async saveClient(client: SavedClient): Promise<{ ok: boolean; client?: SavedClient }> {
    const norm = normalizeSingleClient(client) || client;
    try {
      // Try calling backend GAS if supported
      await this.callGas('saveClient', { client: norm });
    } catch {
      // Backend may not have explicit saveClient action, which is normal
    }
    return this.localCall('saveClient', { client: norm });
  }

  async deleteClient(clientId: string, clientName?: string): Promise<{ ok: boolean }> {
    try {
      await this.callGas('deleteClient', { clientId, clientName });
    } catch {
      // ignore
    }
    return this.localCall('deleteClient', { clientId, clientName });
  }

  async checkBackendStatus(): Promise<{
    ok: boolean;
    gasConfigured: boolean;
    gasApiKeyConfigured: boolean;
    appPinConfigured: boolean;
    message: string;
  }> {
    try {
      const pin = this.getPin();
      const response = await fetch('/api/gas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-app-pin': pin,
        },
        body: JSON.stringify({ action: 'checkConfig' }),
      });

      if (response.status === 401) {
        return {
          ok: false,
          gasConfigured: false,
          gasApiKeyConfigured: false,
          appPinConfigured: false,
          message: 'PIN rejected by server. Check that your device PIN matches APP_PIN in Vercel.',
        };
      }

      const data = await response.json();
      const config = data?.config || {};

      if (!config.gasUrlConfigured) {
        return {
          ok: false,
          gasConfigured: false,
          gasApiKeyConfigured: !!config.gasApiKeyConfigured,
          appPinConfigured: !!config.appPinConfigured,
          message: 'GAS_URL is missing in Vercel Environment Variables. Add GAS_URL in Vercel Settings > Environment Variables.',
        };
      }

      try {
        const testRes = await this.callGas('bootstrap', {});
        if (testRes) {
          return {
            ok: true,
            gasConfigured: true,
            gasApiKeyConfigured: !!config.gasApiKeyConfigured,
            appPinConfigured: !!config.appPinConfigured,
            message: 'Connected to Google Sheet successfully! Reading and writing live data.',
          };
        }
      } catch (err: any) {
        return {
          ok: false,
          gasConfigured: true,
          gasApiKeyConfigured: !!config.gasApiKeyConfigured,
          appPinConfigured: !!config.appPinConfigured,
          message: `Google Apps Script returned an error: ${err.message}`,
        };
      }

      return {
        ok: true,
        gasConfigured: true,
        gasApiKeyConfigured: !!config.gasApiKeyConfigured,
        appPinConfigured: !!config.appPinConfigured,
        message: 'Google Apps Script proxy is active.',
      };
    } catch (err: any) {
      return {
        ok: false,
        gasConfigured: false,
        gasApiKeyConfigured: false,
        appPinConfigured: false,
        message: `Failed to reach server: ${err.message}`,
      };
    }
  }

  async verifyPin(pin: string): Promise<boolean> {
    try {
      this.setPin(pin);
      await this.bootstrap();
      return true;
    } catch (err: any) {
      if (err.message && err.message.includes('Incorrect PIN')) {
        this.clearPin();
        return false;
      }
      if (pin && pin.length >= 4) {
        return true;
      }
      return false;
    }
  }
}

export const gasApi = new GasClient();
