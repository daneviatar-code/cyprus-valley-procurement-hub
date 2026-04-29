/**
 * Supplier Data — centralized supplier directory.
 * Persisted to Lovable Cloud (with localStorage cache for instant reads).
 */

import { supabase } from '@/integrations/supabase/client';

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

const CACHE_KEY = 'cyprus-valley-suppliers';
const HYDRATED_FLAG = 'cyprus-valley-suppliers-hydrated';

// Track listeners for cloud-driven updates
type Listener = (data: Supplier[]) => void;
const listeners = new Set<Listener>();

export function subscribeSuppliers(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(data: Supplier[]) {
  listeners.forEach(l => { try { l(data); } catch {} });
}

// ── DB ↔ App mapping ──────────────────────────────────────────────────────
type DbRow = {
  id: string;
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  website: string;
  country: string;
  address: string;
  payment_terms: string;
  currency: string;
  notes: string;
  category: string;
  items: SupplierItem[] | null;
  created_at: string;
};

function fromDb(r: DbRow): Supplier {
  return {
    id: r.id,
    name: r.name ?? '',
    contactPerson: r.contact_person ?? '',
    email: r.email ?? '',
    phone: r.phone ?? '',
    website: r.website ?? '',
    country: r.country ?? '',
    address: r.address ?? '',
    paymentTerms: r.payment_terms ?? '',
    currency: r.currency ?? 'EUR',
    notes: r.notes ?? '',
    category: r.category ?? 'Furniture',
    items: Array.isArray(r.items) ? r.items : [],
    createdAt: r.created_at,
  };
}

function toDb(s: Supplier) {
  return {
    id: s.id,
    name: s.name,
    contact_person: s.contactPerson,
    email: s.email,
    phone: s.phone,
    website: s.website,
    country: s.country,
    address: s.address,
    payment_terms: s.paymentTerms,
    currency: s.currency,
    notes: s.notes,
    category: s.category,
    items: s.items as unknown as object,
    created_at: s.createdAt,
  };
}

// ── Sync API (returns from cache) ─────────────────────────────────────────
export function loadSuppliers(): Supplier[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

let lastSnapshot = JSON.stringify(loadSuppliers());

function writeCache(data: Supplier[]) {
  const json = JSON.stringify(data);
  if (json === lastSnapshot) return;
  lastSnapshot = json;
  localStorage.setItem(CACHE_KEY, json);
}

export function saveSuppliers(data: Supplier[]): void {
  writeCache(data);
  // Push entire snapshot to cloud (small dataset, simple correctness).
  void pushAllToCloud(data);
}

async function pushAllToCloud(data: Supplier[]): Promise<void> {
  try {
    // Get current cloud ids → delete the ones removed locally.
    const { data: existing } = await supabase.from('suppliers').select('id');
    const cloudIds = new Set((existing ?? []).map(r => r.id));
    const localIds = new Set(data.map(s => s.id));
    const toDelete = [...cloudIds].filter(id => !localIds.has(id));
    if (toDelete.length > 0) {
      await supabase.from('suppliers').delete().in('id', toDelete);
    }
    if (data.length > 0) {
      await supabase.from('suppliers').upsert(data.map(toDb));
    }
  } catch (err) {
    console.error('[suppliers] cloud sync failed', err);
  }
}

// ── Async: hydrate from cloud on app boot ─────────────────────────────────
export async function hydrateSuppliersFromCloud(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    const rows = (data ?? []).map(fromDb);

    const cached = loadSuppliers();
    if (rows.length === 0 && cached.length > 0 && !localStorage.getItem(HYDRATED_FLAG)) {
      // First-time migration: cloud is empty but we have local data → push it up.
      await pushAllToCloud(cached);
      localStorage.setItem(HYDRATED_FLAG, '1');
      return;
    }
    writeCache(rows);
    localStorage.setItem(HYDRATED_FLAG, '1');
    notify(rows);
  } catch (err) {
    console.error('[suppliers] hydrate failed', err);
  }
}

export function generateSupplierId(): string {
  return `sup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
