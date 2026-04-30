/**
 * Catalog Products — central library of FF&E products.
 * Persisted to Lovable Cloud (with localStorage cache for instant reads).
 */

import { supabase } from '@/integrations/supabase/client';
import { enqueue } from '@/lib/cloudWriteQueue';

export const DISCIPLINES = [
  'Furniture',
  'Outdoor Furniture',
  'Linens',
  'Appliances',
  'Lighting',
  'Air Conditioner',
  'Television',
  'Door Lock',
  'Apartment Safe',
  'Mobile Furniture',
  'Art & Decor',
  'Accessories',
  'Bathroom Accessories',
  'Tableware Sets',
  'Rugs',
  'Curtains',
  'Mirrors',
] as const;

export type Discipline = typeof DISCIPLINES[number];
export type Area = 'Indoor' | 'Outdoor';

export interface CatalogProduct {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  unitPriceEur: number | null;
  supplierId: string | null;
  supplierName: string;
  discipline: string;
  area: Area;
  sku: string;
  createdAt?: string;
}

const CACHE_KEY = 'cyprus-valley-catalog-products';
const HYDRATED_FLAG = 'cyprus-valley-catalog-products-hydrated';

type Listener = (data: CatalogProduct[]) => void;
const listeners = new Set<Listener>();

export function subscribeCatalog(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function notify(data: CatalogProduct[]) {
  listeners.forEach(l => { try { l(data); } catch {} });
}

function fromDb(r: any): CatalogProduct {
  return {
    id: r.id,
    name: r.name ?? '',
    description: r.description ?? '',
    imageUrl: r.image_url ?? '',
    unitPriceEur: r.unit_price_eur != null ? Number(r.unit_price_eur) : null,
    supplierId: r.supplier_id ?? null,
    supplierName: r.supplier_name ?? '',
    discipline: r.discipline ?? '',
    area: (r.area === 'Outdoor' ? 'Outdoor' : 'Indoor') as Area,
    sku: r.sku ?? '',
    createdAt: r.created_at,
  };
}

function toDb(p: CatalogProduct) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    image_url: p.imageUrl || null,
    unit_price_eur: p.unitPriceEur,
    supplier_id: p.supplierId,
    supplier_name: p.supplierName,
    discipline: p.discipline,
    area: p.area,
    sku: p.sku,
  };
}

export function loadCatalog(): CatalogProduct[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

let lastSnapshot = JSON.stringify(loadCatalog());

function writeCache(data: CatalogProduct[]) {
  const json = JSON.stringify(data);
  if (json === lastSnapshot) return;
  lastSnapshot = json;
  localStorage.setItem(CACHE_KEY, json);
}

export function saveCatalog(data: CatalogProduct[]): void {
  writeCache(data);
  void enqueue('catalog_products', () => pushAllToCloud(data));
}

async function pushAllToCloud(data: CatalogProduct[]): Promise<void> {
  try {
    const { data: existing } = await supabase.from('catalog_products').select('id');
    const cloudIds = new Set((existing ?? []).map((r: any) => r.id));
    const localIds = new Set(data.map(p => p.id));
    const toDelete = [...cloudIds].filter(id => !localIds.has(id));
    if (toDelete.length > 0) {
      await supabase.from('catalog_products').delete().in('id', toDelete);
    }
    if (data.length > 0) {
      await supabase.from('catalog_products').upsert(data.map(toDb));
    }
  } catch (err) {
    console.error('[catalog] cloud sync failed', err);
  }
}

export async function hydrateCatalogFromCloud(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('catalog_products')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    const rows = (data ?? []).map(fromDb);
    const cached = loadCatalog();
    if (rows.length === 0 && cached.length > 0 && !localStorage.getItem(HYDRATED_FLAG)) {
      await pushAllToCloud(cached);
      localStorage.setItem(HYDRATED_FLAG, '1');
      return;
    }
    writeCache(rows);
    localStorage.setItem(HYDRATED_FLAG, '1');
    notify(rows);
  } catch (err) {
    console.error('[catalog] hydrate failed', err);
  }
}

export function generateProductId(): string {
  return `prd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function uploadCatalogImage(file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('catalog-images').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('catalog-images').getPublicUrl(path);
  return data.publicUrl;
}
