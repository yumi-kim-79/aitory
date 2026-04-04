export interface InvoiceItem {
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface SenderInfo {
  companyName: string;
  bizNumber: string;
  phone: string;
  email: string;
  address: string;
}

export interface ClientInfo {
  clientName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
}

export interface InvoiceData {
  docType: string;
  sender: SenderInfo;
  client: ClientInfo;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  validUntil: string;
  paymentTerms: string;
  memo: string;
  greeting: string;
  paymentGuide: string;
  closing: string;
}

export interface SavedInvoice {
  id: string;
  type: string;
  clientName: string;
  total: number;
  createdAt: string;
  data: InvoiceData;
}

const INVOICES_KEY = "aitory_invoices";
const SENDER_KEY = "aitory_sender_info";

export function getInvoices(): SavedInvoice[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(INVOICES_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveInvoice(invoice: SavedInvoice): void {
  const list = getInvoices();
  list.unshift(invoice);
  localStorage.setItem(INVOICES_KEY, JSON.stringify(list));
}

export function deleteInvoice(id: string): void {
  const list = getInvoices().filter((i) => i.id !== id);
  localStorage.setItem(INVOICES_KEY, JSON.stringify(list));
}

export function getSenderInfo(): SenderInfo | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SENDER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function saveSenderInfo(info: SenderInfo): void {
  localStorage.setItem(SENDER_KEY, JSON.stringify(info));
}
