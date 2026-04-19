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

const ITEMS_KEY = 'cyprus-valley_standardItems';
const QUANTITIES_KEY = 'cyprus-valley_apartmentTypeQuantities';
const LEGACY_KEY = 'cyprus-valley_apartmentStandards';
const MIGRATION_FLAG = 'cyprus-valley_standardItems_migrated_v1';

export function genItemId(): string {
  return `sitm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
export function genQtyId(): string {
  return `qty_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

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
export function saveStandardItems(rows: StandardItem[]) {
  localStorage.setItem(ITEMS_KEY, JSON.stringify(rows));
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
export function saveApartmentTypeQuantities(rows: ApartmentTypeQuantity[]) {
  localStorage.setItem(QUANTITIES_KEY, JSON.stringify(rows));
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
