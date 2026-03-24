/**
 * Supplier Data — centralized supplier directory.
 * Persisted in localStorage.
 */

export interface SupplierItem {
  itemName: string;
  unitPrice: number;
  leadTimeDays: number;
  status: 'quoted' | 'ordered' | 'delivered' | 'cancelled';
  notes: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  website: string;
  country: string;
  address: string;
  paymentTerms: string;
  currency: string;
  notes: string;
  category: string;
  items: SupplierItem[];
  createdAt: string;
}

const STORAGE_KEY = 'cyprus-valley-suppliers';

export function loadSuppliers(): Supplier[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveSuppliers(data: Supplier[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function generateSupplierId(): string {
  return `sup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
