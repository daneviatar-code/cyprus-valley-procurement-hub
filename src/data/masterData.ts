/**
 * Master Data Store — Single source of truth for all project quantities.
 * Rows are persisted in localStorage. All procurement totals and room explorer
 * data are computed from this store.
 */

import { buildingAUnits, buildingBUnits, buildingCUnits, buildingAFurniture, buildingBFurniture, buildingCFurniture, UnitType, FurniturePerUnit } from './unitFurnitureData';

export type Concept = 'A' | 'B' | 'C';
export type RoomType = 'Dining' | 'Living Room' | 'Bedroom' | 'Outdoor';

export interface MasterRow {
  id: string;
  concept: Concept;
  unitCode: string;
  roomType: RoomType;
  itemName: string;
  qtyPerUnit: number;
}

const STORAGE_KEY = 'cyprus-valley-master-data';

// ── Seed from hardcoded data ──
function seedFromHardcoded(): MasterRow[] {
  const rows: MasterRow[] = [];
  let counter = 0;

  const addRows = (concept: Concept, furniture: FurniturePerUnit[]) => {
    furniture.forEach(f => {
      Object.entries(f.quantities).forEach(([unitCode, qty]) => {
        if (qty > 0) {
          rows.push({
            id: `seed-${counter++}`,
            concept,
            unitCode,
            roomType: f.category,
            itemName: f.itemName,
            qtyPerUnit: qty,
          });
        }
      });
    });
  };

  addRows('A', buildingAFurniture);
  addRows('B', buildingBFurniture);
  addRows('C', buildingCFurniture);

  return rows;
}

// ── Load / Save ──
export function loadMasterData(): MasterRow[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  // First time: seed from hardcoded data
  const seeded = seedFromHardcoded();
  saveMasterData(seeded);
  return seeded;
}

export function saveMasterData(data: MasterRow[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ── Unit type lookup (still from static structure data) ──
function getUnitsForConcept(concept: Concept): UnitType[] {
  switch (concept) {
    case 'A': return buildingAUnits;
    case 'B': return buildingBUnits;
    case 'C': return buildingCUnits;
  }
}

function getUnitInstances(concept: Concept, unitCode: string): number {
  const units = getUnitsForConcept(concept);
  const unit = units.find(u => u.code === unitCode);
  if (!unit) return 0;
  let total = 0;
  unit.floors.forEach(f => { total += unit.unitsPerFloor[f] || 0; });
  // Multiply by number of buildings in concept
  const buildingCount = concept === 'A' ? 6 : concept === 'B' ? 2 : 1;
  return total * buildingCount;
}

// ── Computed: Procurement Items (aggregated from master data) ──
export interface ComputedProcurementItem {
  id: number;
  name: string;
  category: RoomType;
  qtyA: number;
  qtyB: number;
  qtyC: number;
  grandTotal: number;
}

export function computeProcurementItems(masterData: MasterRow[]): ComputedProcurementItem[] {
  // Group by itemName
  const map = new Map<string, { category: RoomType; qtyA: number; qtyB: number; qtyC: number }>();

  masterData.forEach(row => {
    const instances = getUnitInstances(row.concept, row.unitCode);
    const totalForRow = row.qtyPerUnit * instances;

    let entry = map.get(row.itemName);
    if (!entry) {
      entry = { category: row.roomType, qtyA: 0, qtyB: 0, qtyC: 0 };
      map.set(row.itemName, entry);
    }

    if (row.concept === 'A') entry.qtyA += totalForRow;
    else if (row.concept === 'B') entry.qtyB += totalForRow;
    else entry.qtyC += totalForRow;
  });

  const items: ComputedProcurementItem[] = [];
  let id = 1;
  // Sort by category then name
  const sorted = [...map.entries()].sort((a, b) => {
    const catOrder: RoomType[] = ['Dining', 'Living Room', 'Bedroom', 'Outdoor'];
    const catDiff = catOrder.indexOf(a[1].category) - catOrder.indexOf(b[1].category);
    if (catDiff !== 0) return catDiff;
    return a[0].localeCompare(b[0]);
  });

  sorted.forEach(([name, data]) => {
    items.push({
      id: id++,
      name,
      category: data.category,
      qtyA: data.qtyA,
      qtyB: data.qtyB,
      qtyC: data.qtyC,
      grandTotal: data.qtyA + data.qtyB + data.qtyC,
    });
  });

  return items;
}

// ── Computed: Furniture per unit (for Room Explorer & By Room Type view) ──
export function computeFurnitureForConcept(masterData: MasterRow[], concept: Concept): FurniturePerUnit[] {
  // Group by itemName within concept
  const map = new Map<string, { category: RoomType; quantities: Record<string, number> }>();

  masterData.filter(r => r.concept === concept).forEach(row => {
    let entry = map.get(row.itemName);
    if (!entry) {
      entry = { category: row.roomType, quantities: {} };
      map.set(row.itemName, entry);
    }
    entry.quantities[row.unitCode] = (entry.quantities[row.unitCode] || 0) + row.qtyPerUnit;
  });

  return [...map.entries()].map(([itemName, data]) => ({
    itemName,
    category: data.category as FurniturePerUnit['category'],
    quantities: data.quantities,
  }));
}

export function computeFurnitureForUnit(masterData: MasterRow[], concept: Concept, unitCode: string): { itemName: string; category: string; qty: number }[] {
  return masterData
    .filter(r => r.concept === concept && r.unitCode === unitCode && r.qtyPerUnit > 0)
    .map(r => ({ itemName: r.itemName, category: r.roomType, qty: r.qtyPerUnit }));
}

// ── Get unique item names from master data ──
export function getUniqueItemNames(masterData: MasterRow[]): string[] {
  return [...new Set(masterData.map(r => r.itemName))].sort();
}

// ── Get unit codes for concept from master data ──
export function getUnitCodesForConcept(masterData: MasterRow[], concept: Concept): string[] {
  return [...new Set(masterData.filter(r => r.concept === concept).map(r => r.unitCode))].sort();
}

// ── Total items count ──
export function computeTotalItemsCount(masterData: MasterRow[]): number {
  let total = 0;
  masterData.forEach(row => {
    total += row.qtyPerUnit * getUnitInstances(row.concept, row.unitCode);
  });
  return total;
}

// ── ID generation ──
export function generateRowId(): string {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
