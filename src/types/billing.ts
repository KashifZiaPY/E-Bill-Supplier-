export type DocType = 'BILL' | 'QUOTATION';
export type TaxType = 'GST' | 'PST' | 'None';

export interface LineItem {
  id?: string;
  sr?: number;
  description: string;
  unit: string;
  qty: number;
  rate: number;
  tax: TaxType;
  amount?: number;
}

export interface DocumentRecord {
  docId?: string;
  DocID?: string;
  type: DocType;
  Type?: DocType;
  docNo?: string;
  DocNo?: string;
  date: string; // YYYY-MM-DD
  Date?: string;
  validUntil?: string; // YYYY-MM-DD for quotations
  ValidUntil?: string;
  clientName: string;
  ClientName?: string;
  clientAddress: string;
  ClientAddress?: string;
  clientNTN?: string;
  ClientNTN?: string;
  refText: string;
  RefText?: string;
  requestId?: string;
  items?: LineItem[];
  // Calculated summaries
  goodsSub?: number;
  GoodsSub?: number;
  gst?: number;
  GST?: number;
  serviceSub?: number;
  ServiceSub?: number;
  pst?: number;
  PST?: number;
  otherSub?: number;
  OtherSub?: number;
  grandTotal?: number;
  GrandTotal?: number;
  status?: string;
  Status?: string;
}

export interface SupplierSettings {
  supplierName: string;
  supplierTagline: string;
  supplierAddress: string;
  supplierPhone: string;
  supplierNTN: string;
  supplierGST: string;
  vendorNo: string;
  gstRate: number; // e.g. 0.18
  pstRate: number; // e.g. 0.16
  letterheadTop: number; // in inches e.g. 2.5
  letterheadBottom: number; // in inches e.g. 1.5
  nextBillNo: string; // e.g. "101"
  nextQuoteNo: string; // e.g. "Q-201"
}

export interface SavedClient {
  name: string;
  address: string;
  ntn: string;
}

export interface CatalogItem {
  description: string;
  unit: string;
  rate: number;
  tax: TaxType;
}

export interface BootstrapData {
  settings: SupplierSettings;
  clients: SavedClient[];
  docs: DocumentRecord[];
  catalog: CatalogItem[];
}
