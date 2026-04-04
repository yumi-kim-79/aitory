export interface ReceiptItem {
  name: string;
  price: number;
}

export interface Receipt {
  id: string;
  store_name: string;
  date: string;
  time: string;
  items: ReceiptItem[];
  total: number;
  category: string;
  memo: string;
  payment_method: string;
  created_at: string;
}

const STORAGE_KEY = "aitory_receipts";

export function getReceipts(): Receipt[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveReceipt(receipt: Receipt): void {
  const list = getReceipts();
  list.unshift(receipt);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function getReceiptsByMonth(yearMonth: string): Receipt[] {
  return getReceipts().filter((r) => r.date.startsWith(yearMonth));
}

export function getCategoryTotals(
  receipts: Receipt[],
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const r of receipts) {
    totals[r.category] = (totals[r.category] || 0) + r.total;
  }
  return totals;
}
