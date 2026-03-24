/**
 * Purchase Order Data — localStorage persistence.
 */

export interface POLineItem {
  itemName: string;
  qty: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  items: POLineItem[];
  status: 'Draft' | 'Sent' | 'Confirmed' | 'Delivered';
  expectedDelivery: string; // ISO date
  totalValue: number;
  currency: string;
  notes: string;
  createdAt: string;
}

const STORAGE_KEY = 'cyprus-valley-purchase-orders';

export function loadPurchaseOrders(): PurchaseOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function savePurchaseOrders(data: PurchaseOrder[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function generatePONumber(existing: PurchaseOrder[]): string {
  const num = existing.length + 1;
  return `PO-${String(num).padStart(3, '0')}`;
}

export function generatePOId(): string {
  return `po_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
