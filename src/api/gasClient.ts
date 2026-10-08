// Client for communicating with the serverless /api/gas proxy or local simulated storage

import type { BootstrapData, DocumentRecord, LineItem, SupplierSettings } from '../types/billing';
import { calculateTotals } from '../utils/formatters';

const STORAGE_KEY_SETTINGS = 'anwar_traders_settings';
const STORAGE_KEY_CLIENTS = 'anwar_traders_clients';
const STORAGE_KEY_DOCS = 'anwar_traders_docs';
const STORAGE_KEY_CATALOG = 'anwar_traders_catalog';
const STORAGE_KEY_OFFLINE_MODE = 'anwar_traders_offline_mode';

export const DEFAULT_SETTINGS: SupplierSettings = {
  supplierName: 'Anwar Traders',
  supplierTagline: 'General Order Suppliers & Govt Contractors',
  supplierAddress: 'Suit # 14, 2nd Floor, Al-Rehman Centre, Bank Road, Rawalpindi',
  supplierPhone: '0300-5123456 / 051-5551234',
  supplierNTN: '1428392-7',
  supplierGST: '07-01-9876-543-21',
  vendorNo: 'V-40892',
  gstRate: 0.18,
  pstRate: 0.16,
  letterheadTop: 2.5,
  letterheadBottom: 1.5,
  nextBillNo: '101',
  nextQuoteNo: 'Q-201',
};

// Seed sample PO Petty-187365 (Grand total 99,768.30) for testing
// Goods: 64,550 + 18% GST (11,619.00) = 76,169.00
// Services: 20,344.22 + 16% PST (3,255.08) = 23,599.30
// Total = 99,768.30
export const SEED_PETTY_DOC: DocumentRecord = {
  docId: 'doc-petty-187365',
  DocID: 'doc-petty-187365',
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

export const SEED_CLIENTS = [
  {
    name: 'Director General Health Services Punjab',
    address: '24-Cooper Road, Lahore',
    ntn: '9010203-4',
  },
  {
    name: 'Secretary Communication & Works Department',
    address: 'Punjab Civil Secretariat, Lower Mall, Lahore',
    ntn: '9020304-5',
  },
  {
    name: 'District Health Authority Rawalpindi',
    address: 'Khyaban-e-Sir Syed, Rawalpindi',
    ntn: '9030405-6',
  },
];

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

    try {
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

      const data = await response.json();

      // If backend indicates GAS_URL is not configured yet, fallback to local storage
      if (data && data.notConfigured) {
        this.setIsOfflineMode(true);
        return this.localCall(action, payload);
      }

      if (!response.ok || data.ok === false) {
        throw new Error(data.error || `Server error (${response.status})`);
      }

      this.setIsOfflineMode(false);
      return data.data || data;
    } catch (err: any) {
      if (err.message && err.message.includes('Incorrect PIN')) {
        throw err;
      }
      // If network fails (e.g. offline or no GAS server), use local store
      console.warn('API error, falling back to local store:', err);
      this.setIsOfflineMode(true);
      return this.localCall(action, payload);
    }
  }

  // --- Local Simulated Storage Fallback ---
  private localCall(action: string, payload: any): any {
    switch (action) {
      case 'bootstrap': {
        const storedSettings = localStorage.getItem(STORAGE_KEY_SETTINGS);
        const storedClients = localStorage.getItem(STORAGE_KEY_CLIENTS);
        const storedDocs = localStorage.getItem(STORAGE_KEY_DOCS);
        const storedCatalog = localStorage.getItem(STORAGE_KEY_CATALOG);

        const settings: SupplierSettings = storedSettings ? JSON.parse(storedSettings) : DEFAULT_SETTINGS;
        const clients = storedClients ? JSON.parse(storedClients) : SEED_CLIENTS;
        const docs: DocumentRecord[] = storedDocs ? JSON.parse(storedDocs) : [SEED_PETTY_DOC];
        const catalog = storedCatalog ? JSON.parse(storedCatalog) : SEED_CATALOG;

        // Ensure defaults are saved if empty
        if (!storedSettings) localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
        if (!storedClients) localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(clients));
        if (!storedDocs) localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(docs));
        if (!storedCatalog) localStorage.setItem(STORAGE_KEY_CATALOG, JSON.stringify(catalog));

        return { settings, clients, docs, catalog };
      }

      case 'getDoc': {
        const storedDocs = localStorage.getItem(STORAGE_KEY_DOCS);
        const docs: DocumentRecord[] = storedDocs ? JSON.parse(storedDocs) : [SEED_PETTY_DOC];
        const doc = docs.find((d) => (d.docId || d.DocID) === payload.docId);
        if (!doc) throw new Error('Document not found');
        return { doc, items: doc.items || [] };
      }

      case 'saveDoc': {
        const storedDocs = localStorage.getItem(STORAGE_KEY_DOCS);
        const docs: DocumentRecord[] = storedDocs ? JSON.parse(storedDocs) : [SEED_PETTY_DOC];

        const storedSettings = localStorage.getItem(STORAGE_KEY_SETTINGS);
        const settings: SupplierSettings = storedSettings ? JSON.parse(storedSettings) : DEFAULT_SETTINGS;

        const docToSave = payload.doc;
        const isNew = !docToSave.docId;
        const docId = docToSave.docId || 'doc-' + Date.now();

        let docNo = docToSave.docNo;
        if (!docNo) {
          if (docToSave.type === 'BILL') {
            docNo = settings.nextBillNo;
            const next = String(Number(settings.nextBillNo || '100') + 1);
            settings.nextBillNo = next;
          } else {
            docNo = settings.nextQuoteNo;
            const numPart = settings.nextQuoteNo.replace(/\D/g, '') || '200';
            const prefix = settings.nextQuoteNo.replace(/\d/g, '') || 'Q-';
            settings.nextQuoteNo = `${prefix}${Number(numPart) + 1}`;
          }
          localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
        }

        // Calculate totals
        const totals = calculateTotals(docToSave.items || [], settings.gstRate, settings.pstRate);

        const fullRecord: DocumentRecord = {
          ...docToSave,
          docId,
          DocID: docId,
          docNo,
          DocNo: docNo,
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

        // Update clients auto-save
        if (docToSave.clientName) {
          const storedClients = localStorage.getItem(STORAGE_KEY_CLIENTS);
          const clients = storedClients ? JSON.parse(storedClients) : SEED_CLIENTS;
          const existing = clients.find((c: any) => c.name.toLowerCase() === docToSave.clientName.toLowerCase());
          if (!existing) {
            clients.push({
              name: docToSave.clientName,
              address: docToSave.clientAddress || '',
              ntn: docToSave.clientNTN || '',
            });
            localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(clients));
          }
        }

        // Update catalog auto-save
        if (docToSave.items && docToSave.items.length > 0) {
          const storedCatalog = localStorage.getItem(STORAGE_KEY_CATALOG);
          const catalog = storedCatalog ? JSON.parse(storedCatalog) : SEED_CATALOG;
          for (const item of docToSave.items) {
            if (item.description && !catalog.find((c: any) => c.description.toLowerCase() === item.description.toLowerCase())) {
              catalog.push({
                description: item.description,
                unit: item.unit || 'Nos',
                rate: item.rate || 0,
                tax: item.tax || 'GST',
              });
            }
          }
          localStorage.setItem(STORAGE_KEY_CATALOG, JSON.stringify(catalog));
        }

        return { ok: true, docId, docNo };
      }

      case 'cancelDoc': {
        const storedDocs = localStorage.getItem(STORAGE_KEY_DOCS);
        const docs: DocumentRecord[] = storedDocs ? JSON.parse(storedDocs) : [SEED_PETTY_DOC];
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

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  // --- Public API methods ---

  async bootstrap(): Promise<BootstrapData> {
    const res = await this.callGas('bootstrap', {});
    return res;
  }

  async getDoc(docId: string): Promise<{ doc: DocumentRecord; items: LineItem[] }> {
    const res = await this.callGas('getDoc', { docId });
    return res;
  }

  async saveDoc(doc: any): Promise<{ ok: boolean; docId: string; docNo: string }> {
    const res = await this.callGas('saveDoc', { doc });
    return res;
  }

  async cancelDoc(docId: string): Promise<{ ok: boolean }> {
    const res = await this.callGas('cancelDoc', { docId });
    return res;
  }

  async saveSettings(settings: SupplierSettings): Promise<{ ok: boolean }> {
    const res = await this.callGas('saveSettings', { settings });
    return res;
  }

  // Verify PIN against backend
  async verifyPin(pin: string): Promise<boolean> {
    try {
      this.setPin(pin);
      // Attempt bootstrap to verify PIN
      await this.bootstrap();
      return true;
    } catch (err: any) {
      if (err.message && err.message.includes('Incorrect PIN')) {
        this.clearPin();
        return false;
      }
      // If it's a network error or offline mode, accept PIN if non-empty
      if (pin && pin.length >= 4) {
        return true;
      }
      return false;
    }
  }
}

export const gasApi = new GasClient();
