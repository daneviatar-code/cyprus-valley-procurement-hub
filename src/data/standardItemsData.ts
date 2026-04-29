/**
 * Standard tab — master template + per-apartment-type quantities.
 *
 * Source of truth: standardItems (one row per master FF&E item).
 * apartmentTypeQuantities holds per-(item × apartment type) values.
 *
 * Migrated on first load from legacy `cyprus-valley_apartmentStandards`
 * (RoomStandard rows from roomStandardsData) — no data loss.
 */

import { RoomSize, RESIDENTIAL_ROOM_SIZES, countUnitsByRoomSize } from './masterData';
import { RoomStandard, StandardStatus, loadStandards as loadLegacyStandards } from './roomStandardsData';

export type ApartmentType = 'studio' | '1br' | '2br' | '3br' | '4br';
export const APARTMENT_TYPES: ApartmentType[] = ['studio', '1br', '2br', '3br', '4br'];

export interface StandardItem {
  id: string;
  categoryId: string;
  itemName: string;
  spec: string;
  dimensions?: string;
  unitPriceEur?: number;
  supplierId?: string;
  order: number;
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApartmentTypeQuantity {
  id: string;
  standardItemId: string;
  apartmentType: ApartmentType;
  qtyPerPackage: number;
  sparePerPackage: number;
  status: StandardStatus;
  orderedQty: number;
  deliveredQty: number;
  notes: string;
  updatedAt: string;
}

import { supabase } from '@/integrations/supabase/client';

const ITEMS_KEY = 'cyprus-valley_standardItems';
const QUANTITIES_KEY = 'cyprus-valley_apartmentTypeQuantities';
const LEGACY_KEY = 'cyprus-valley_apartmentStandards';
const MIGRATION_FLAG = 'cyprus-valley_standardItems_migrated_v1';
const HYDRATED_FLAG = 'cyprus-valley_standardItems_hydrated';

export function genItemId(): string {
  return `sitm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
export function genQtyId(): string {
  return `qty_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── Listeners ──────────────────────────────────────────────────────────
type ItemsListener = (rows: StandardItem[]) => void;
type QtysListener = (rows: ApartmentTypeQuantity[]) => void;
const itemListeners = new Set<ItemsListener>();
const qtyListeners = new Set<QtysListener>();

export function subscribeStandardItems(fn: ItemsListener): () => void {
  itemListeners.add(fn); return () => itemListeners.delete(fn);
}
export function subscribeApartmentTypeQuantities(fn: QtysListener): () => void {
  qtyListeners.add(fn); return () => qtyListeners.delete(fn);
}

// ── Sync cache reads ────────────────────────────────────────────────────
export function loadStandardItems(): StandardItem[] {
  maybeMigrate();
  try {
    const raw = localStorage.getItem(ITEMS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

let lastItemsSnap = '';
export function saveStandardItems(rows: StandardItem[]) {
  const json = JSON.stringify(rows);
  if (json === lastItemsSnap) return;
  lastItemsSnap = json;
  localStorage.setItem(ITEMS_KEY, json);
  void pushItemsToCloud(rows);
}

export function loadApartmentTypeQuantities(): ApartmentTypeQuantity[] {
  maybeMigrate();
  try {
    const raw = localStorage.getItem(QUANTITIES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

let lastQtysSnap = '';
export function saveApartmentTypeQuantities(rows: ApartmentTypeQuantity[]) {
  const json = JSON.stringify(rows);
  if (json === lastQtysSnap) return;
  lastQtysSnap = json;
  localStorage.setItem(QUANTITIES_KEY, json);
  void pushQtysToCloud(rows);
}

// ── Cloud push ──────────────────────────────────────────────────────────
function itemToDb(i: StandardItem): any {
  return {
    id: i.id,
    category_id: i.categoryId,
    item_name: i.itemName,
    spec: i.spec,
    dimensions: i.dimensions ?? null,
    unit_price_eur: i.unitPriceEur ?? null,
    supplier_id: i.supplierId ?? null,
    order: i.order,
    archived: !!i.archived,
    created_at: i.createdAt,
    updated_at: i.updatedAt,
  };
}
function itemFromDb(r: any): StandardItem {
  return {
    id: r.id,
    categoryId: r.category_id ?? '',
    itemName: r.item_name ?? '',
    spec: r.spec ?? '',
    dimensions: r.dimensions ?? undefined,
    unitPriceEur: r.unit_price_eur ?? undefined,
    supplierId: r.supplier_id ?? undefined,
    order: r.order ?? 0,
    archived: !!r.archived,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
function qtyToDb(q: ApartmentTypeQuantity): any {
  return {
    id: q.id,
    standard_item_id: q.standardItemId,
    apartment_type: q.apartmentType,
    qty_per_package: q.qtyPerPackage,
    spare_per_package: q.sparePerPackage,
    status: q.status,
    ordered_qty: q.orderedQty,
    delivered_qty: q.deliveredQty,
    notes: q.notes,
    updated_at: q.updatedAt,
  };
}
function qtyFromDb(r: any): ApartmentTypeQuantity {
  return {
    id: r.id,
    standardItemId: r.standard_item_id,
    apartmentType: r.apartment_type,
    qtyPerPackage: r.qty_per_package ?? 0,
    sparePerPackage: r.spare_per_package ?? 0,
    status: r.status ?? 'Planned',
    orderedQty: r.ordered_qty ?? 0,
    deliveredQty: r.delivered_qty ?? 0,
    notes: r.notes ?? '',
    updatedAt: r.updated_at,
  };
}

async function pushItemsToCloud(rows: StandardItem[]) {
  try {
    const { data: existing } = await supabase.from('standard_items').select('id');
    const cloudIds = new Set((existing ?? []).map(r => r.id));
    const localIds = new Set(rows.map(r => r.id));
    const toDelete = [...cloudIds].filter(id => !localIds.has(id));
    if (toDelete.length > 0) {
      await supabase.from('standard_items').delete().in('id', toDelete);
    }
    if (rows.length > 0) {
      await supabase.from('standard_items').upsert(rows.map(itemToDb));
    }
  } catch (err) {
    console.error('[standard_items] cloud sync failed', err);
  }
}
async function pushQtysToCloud(rows: ApartmentTypeQuantity[]) {
  try {
    const { data: existing } = await supabase.from('apartment_type_quantities').select('id');
    const cloudIds = new Set((existing ?? []).map(r => r.id));
    const localIds = new Set(rows.map(r => r.id));
    const toDelete = [...cloudIds].filter(id => !localIds.has(id));
    if (toDelete.length > 0) {
      await supabase.from('apartment_type_quantities').delete().in('id', toDelete);
    }
    if (rows.length > 0) {
      await supabase.from('apartment_type_quantities').upsert(rows.map(qtyToDb));
    }
  } catch (err) {
    console.error('[apartment_type_quantities] cloud sync failed', err);
  }
}

// ── Hydrate from cloud ──────────────────────────────────────────────────
export async function hydrateStandardItemsFromCloud(): Promise<void> {
  try {
    const [itemsRes, qtysRes] = await Promise.all([
      supabase.from('standard_items').select('*').order('order', { ascending: true }),
      supabase.from('apartment_type_quantities').select('*'),
    ]);
    if (itemsRes.error) throw itemsRes.error;
    if (qtysRes.error) throw qtysRes.error;
    const items = (itemsRes.data ?? []).map(itemFromDb);
    const qtys = (qtysRes.data ?? []).map(qtyFromDb);

    const cachedItems = loadStandardItems();
    const cachedQtys = loadApartmentTypeQuantities();
    const firstHydrate = !localStorage.getItem(HYDRATED_FLAG);

    if (firstHydrate && items.length === 0 && cachedItems.length > 0) {
      // First sync on this device: push local data up.
      await pushItemsToCloud(cachedItems);
      await pushQtysToCloud(cachedQtys);
      localStorage.setItem(HYDRATED_FLAG, '1');
      return;
    }

    lastItemsSnap = JSON.stringify(items);
    lastQtysSnap = JSON.stringify(qtys);
    localStorage.setItem(ITEMS_KEY, lastItemsSnap);
    localStorage.setItem(QUANTITIES_KEY, lastQtysSnap);
    localStorage.setItem(HYDRATED_FLAG, '1');
    itemListeners.forEach(l => { try { l(items); } catch {} });
    qtyListeners.forEach(l => { try { l(qtys); } catch {} });
  } catch (err) {
    console.error('[standardItems] hydrate failed', err);
  }
}

// ── Migration from legacy roomStandards ─────────────────────────────────
function maybeMigrate() {
  if (localStorage.getItem(MIGRATION_FLAG)) return;
  try {
    // Only migrate if we don't already have new data
    const existingItems = localStorage.getItem(ITEMS_KEY);
    if (existingItems) {
      localStorage.setItem(MIGRATION_FLAG, '1');
      return;
    }
    const legacy: RoomStandard[] = loadLegacyStandards().filter(s =>
      RESIDENTIAL_ROOM_SIZES.includes(s.roomSize),
    );
    if (legacy.length === 0) {
      localStorage.setItem(MIGRATION_FLAG, '1');
      return;
    }

    // Group by categoryId + itemName (case-insensitive)
    const groups = new Map<string, RoomStandard[]>();
    legacy.forEach(s => {
      const k = `${s.categoryId}::${(s.itemName || '').trim().toLowerCase()}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(s);
    });

    const items: StandardItem[] = [];
    const qtys: ApartmentTypeQuantity[] = [];
    let order = 1;
    const now = new Date().toISOString();

    groups.forEach(group => {
      // Pick most common non-null unit price & supplier
      const priceCounts = new Map<number, number>();
      const supplierCounts = new Map<string, number>();
      group.forEach(g => {
        if (g.unitPriceEur != null) priceCounts.set(g.unitPriceEur, (priceCounts.get(g.unitPriceEur) || 0) + 1);
        if (g.supplierId) supplierCounts.set(g.supplierId, (supplierCounts.get(g.supplierId) || 0) + 1);
      });
      const unitPriceEur = mostFrequent(priceCounts);
      const supplierId = mostFrequent(supplierCounts);
      const sample = group[0];
      const itemId = genItemId();
      items.push({
        id: itemId,
        categoryId: sample.categoryId,
        itemName: sample.itemName,
        spec: sample.spec,
        unitPriceEur,
        supplierId,
        order: order++,
        createdAt: now,
        updatedAt: now,
      });
      // For each apartment type, find a legacy row or create empty
      APARTMENT_TYPES.forEach(at => {
        const src = group.find(g => g.roomSize === at);
        qtys.push({
          id: genQtyId(),
          standardItemId: itemId,
          apartmentType: at,
          qtyPerPackage: src?.qtyPerUnit ?? 0,
          sparePerPackage: src?.sparePerUnit ?? 0,
          status: src?.status ?? 'Planned',
          orderedQty: src?.orderedQty ?? 0,
          deliveredQty: src?.deliveredQty ?? 0,
          notes: src?.notes ?? '',
          updatedAt: now,
        });
      });
    });

    saveStandardItems(items);
    saveApartmentTypeQuantities(qtys);
    localStorage.setItem(MIGRATION_FLAG, '1');
  } catch {
    localStorage.setItem(MIGRATION_FLAG, '1');
  }
}

function mostFrequent<T>(counts: Map<T, number>): T | undefined {
  let best: T | undefined; let max = 0;
  counts.forEach((v, k) => { if (v > max) { max = v; best = k; } });
  return best;
}

// ── Computed ────────────────────────────────────────────────────────────
export interface ComputedQuantity {
  qty: ApartmentTypeQuantity;
  item: StandardItem;
  totalPerPkg: number;
  units: number;
  hotelQty: number;
  packageCost: number;
  hotelCost: number;
  outstandingQty: number;
}

export function computeQuantity(
  qty: ApartmentTypeQuantity,
  item: StandardItem,
  unitCounts: Record<RoomSize, number>,
): ComputedQuantity {
  const totalPerPkg = (qty.qtyPerPackage || 0) + (qty.sparePerPackage || 0);
  const units = unitCounts[qty.apartmentType] || 0;
  const hotelQty = totalPerPkg * units;
  const price = item.unitPriceEur || 0;
  const packageCost = totalPerPkg * price;
  const hotelCost = hotelQty * price;
  const outstandingQty = Math.max(0, hotelQty - (qty.deliveredQty || 0));
  return { qty, item, totalPerPkg, units, hotelQty, packageCost, hotelCost, outstandingQty };
}

export { countUnitsByRoomSize };
