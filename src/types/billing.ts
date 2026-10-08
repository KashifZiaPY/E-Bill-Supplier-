export type DocType = 'BILL' | 'QUOTATION';
export type TaxType = 'GST' | 'PST' | 'None';

export interface LineItem {
  id?: string;
  sr?: number;
  Sr?: number;
  description: string;
  Description?: string;
  unit: string;
  Unit?: string;
  qty: number;
  Qty?: number;
  rate: number;
  Rate?: number;
  tax: TaxType;
  Tax?: TaxType;
  amount?: number;
  Amount?: number;
}

export interface FirmProfile {
  id: string;
  name: string; // e.g. "Anwar Traders", "Hashir Traders"
  tagline: string;
  address: string;
  phone: string;
  ntn: string;
  gst: string;
  vendorNo: string;
  gstRate: number; // default 0.18
  pstRate: number; // default 0.16
  letterheadTop: number; // default 2.5
  letterheadBottom: number; // default 1.5
  nextBillNo: string; // e.g. "101"
  nextQuoteNo: string; // e.g. "Q-201"
}

export interface DocumentRecord {
  docId?: string;
  DocID?: string;
  firmId?: string;
  firmName?: string;
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
  RequestId?: string;
  items?: LineItem[];
  Items?: LineItem[];
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
  ownerName: string; // "MIAN FARHAN ANWAR"
  activeFirmId: string;
  firms: FirmProfile[];
  // Legacy / fallback fields mapped to active firm:
  supplierName: string;
  supplierTagline: string;
  supplierAddress: string;
  supplierPhone: string;
  supplierNTN: string;
  supplierGST: string;
  vendorNo: string;
  gstRate: number;
  pstRate: number;
  letterheadTop: number;
  letterheadBottom: number;
  nextBillNo: string;
  nextQuoteNo: string;
}

export interface SavedClient {
  id?: string;
  name: string;
  address: string;
  ntn: string;
  phone?: string;
  contactPerson?: string;
  totalOrders?: number;
  totalBilled?: number;
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
