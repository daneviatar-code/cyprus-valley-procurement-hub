/**
 * Master Data Store — Single source of truth for all project quantities.
 * Each building (A1–A6, B1–B2, C1) is fully independent.
 * Rows are persisted in localStorage.
 */

import { buildingAUnits, buildingBUnits, buildingCUnits, buildingAFurniture, buildingBFurniture, buildingCFurniture, UnitType, FurniturePerUnit } from './unitFurnitureData';

export type Concept = 'A' | 'B' | 'C';
export type RoomType = 'Dining' | 'Living Room' | 'Bedroom' | 'Outdoor';

export const ALL_BUILDINGS: Record<Concept, string[]> = {
  A: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'],
  B: ['B1', 'B2'],
  C: ['C1'],
};

export const ALL_BUILDING_LIST = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'B1', 'B2', 'C1'];

export function conceptForBuilding(building: string): Concept {
  return building.charAt(0) as Concept;
}

export interface MasterRow {
  id: string;
  concept: Concept;
  building: string; // e.g. 'A1', 'B2', 'C1'
  unitCode: string;
  roomType: RoomType;
  itemName: string;
  qtyPerUnit: number;
}

const STORAGE_KEY = 'cyprus-valley-master-data-v4';

// ── Room number generation ──
export interface RoomNumberEntry {
  unitCode: string;
  floor: number;
  roomNumber: string;
}

export function generateRoomNumbers(concept: Concept): RoomNumberEntry[] {
  const units = getUnitsForConcept(concept);
  const floors = [...new Set(units.flatMap(u => u.floors))].sort((a, b) => a - b);
  const result: RoomNumberEntry[] = [];

  for (const floor of floors) {
    let seq = 1;
    for (const unit of units) {
      if (!unit.floors.includes(floor)) continue;
      const count = unit.unitsPerFloor[floor] || 0;
      for (let i = 0; i < count; i++) {
        const roomNumber = floor === 0
          ? String(seq).padStart(3, '0')
          : String(floor * 100 + seq);
        result.push({ unitCode: unit.code, floor, roomNumber });
        seq++;
      }
    }
  }
  return result;
}

export function getRoomNumbersForUnit(concept: Concept, unitCode: string): string[] {
  return generateRoomNumbers(concept)
    .filter(r => r.unitCode === unitCode)
    .map(r => r.roomNumber);
}

export function getAllRoomNumbersForBuilding(building: string): RoomNumberEntry[] {
  return generateRoomNumbers(conceptForBuilding(building));
}

// ── Seed from hardcoded data (one set of rows per building) ──
function seedFromHardcoded(): MasterRow[] {
  const rows: MasterRow[] = [];
  let counter = 0;

  const addRows = (concept: Concept, building: string, furniture: FurniturePerUnit[]) => {
    furniture.forEach(f => {
      Object.entries(f.quantities).forEach(([unitCode, qty]) => {
        if (qty > 0) {
          rows.push({
            id: `seed-${counter++}`,
            concept,
            building,
            unitCode,
            roomType: f.category,
            itemName: f.itemName,
            qtyPerUnit: qty,
          });
        }
      });
    });
  };

  ALL_BUILDINGS.A.forEach(b => addRows('A', b, buildingAFurniture));
  ALL_BUILDINGS.B.forEach(b => addRows('B', b, buildingBFurniture));
  ALL_BUILDINGS.C.forEach(b => addRows('C', b, buildingCFurniture));

  return rows;
}

// ── Load / Save ──
export function loadMasterData(): MasterRow[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].building) return parsed;
    }
  } catch {}
  const seeded = seedFromHardcoded();
  saveMasterData(seeded);
  return seeded;
}

export function saveMasterData(data: MasterRow[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ── Unit type lookup ──
function getUnitsForConcept(concept: Concept): UnitType[] {
  switch (concept) {
    case 'A': return buildingAUnits;
    case 'B': return buildingBUnits;
    case 'C': return buildingCUnits;
  }
}

/** Returns unit instances in ONE building (no building count multiplier) */
function getUnitInstancesInBuilding(concept: Concept, unitCode: string): number {
  const units = getUnitsForConcept(concept);
  const unit = units.find(u => u.code === unitCode);
  if (!unit) return 0;
  let total = 0;
  unit.floors.forEach(f => { total += unit.unitsPerFloor[f] || 0; });
  return total;
}

// ── Computed: Procurement Items ──
export interface ComputedProcurementItem {
  id: number;
  name: string;
  category: RoomType;
  qtyA: number;
  qtyB: number;
  qtyC: number;
  grandTotal: number;
  qtyByBuilding: Record<string, number>;
}

export function computeProcurementItems(masterData: MasterRow[]): ComputedProcurementItem[] {
  const map = new Map<string, { category: RoomType; qtyA: number; qtyB: number; qtyC: number; qtyByBuilding: Record<string, number> }>();

  masterData.forEach(row => {
    const instances = getUnitInstancesInBuilding(row.concept, row.unitCode);
    const totalForRow = row.qtyPerUnit * instances;

    let entry = map.get(row.itemName);
    if (!entry) {
      entry = { category: row.roomType, qtyA: 0, qtyB: 0, qtyC: 0, qtyByBuilding: {} };
      map.set(row.itemName, entry);
    }

    entry.qtyByBuilding[row.building] = (entry.qtyByBuilding[row.building] || 0) + totalForRow;

    if (row.concept === 'A') entry.qtyA += totalForRow;
    else if (row.concept === 'B') entry.qtyB += totalForRow;
    else entry.qtyC += totalForRow;
  });

  const items: ComputedProcurementItem[] = [];
  let id = 1;
  const catOrder: RoomType[] = ['Dining', 'Living Room', 'Bedroom', 'Outdoor'];
  const sorted = [...map.entries()].sort((a, b) => {
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
      qtyByBuilding: data.qtyByBuilding,
    });
  });

  return items;
}

// ── Computed: Furniture per unit (for Room Explorer & By Room Type view) ──
export function computeFurnitureForConcept(masterData: MasterRow[], concept: Concept, building?: string): FurniturePerUnit[] {
  // Use specific building to get per-unit quantities; default to first building
  const targetBuilding = building || ALL_BUILDINGS[concept][0];
  const filtered = masterData.filter(r => r.concept === concept && r.building === targetBuilding);

  const map = new Map<string, { category: RoomType; quantities: Record<string, number> }>();

  filtered.forEach(row => {
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

export function computeFurnitureForUnit(masterData: MasterRow[], concept: Concept, unitCode: string, building?: string): { itemName: string; category: string; qty: number }[] {
  const targetBuilding = building || ALL_BUILDINGS[concept][0];
  return masterData
    .filter(r => r.concept === concept && r.unitCode === unitCode && r.qtyPerUnit > 0 && r.building === targetBuilding)
    .map(r => ({ itemName: r.itemName, category: r.roomType, qty: r.qtyPerUnit }));
}

// ── Get unique item names ──
export function getUniqueItemNames(masterData: MasterRow[]): string[] {
  return [...new Set(masterData.map(r => r.itemName))].sort();
}

// ── Get unit codes for concept ──
export function getUnitCodesForConcept(masterData: MasterRow[], concept: Concept, building?: string): string[] {
  return [...new Set(
    masterData
      .filter(r => r.concept === concept && (!building || r.building === building))
      .map(r => r.unitCode)
  )].sort();
}

// ── Total items count ──
export function computeTotalItemsCount(masterData: MasterRow[]): number {
  let total = 0;
  masterData.forEach(row => {
    total += row.qtyPerUnit * getUnitInstancesInBuilding(row.concept, row.unitCode);
  });
  return total;
}

// ── ID generation ──
export function generateRowId(): string {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
