/**
 * Master Data Store — Single source of truth for all project quantities.
 * Each building (A1–A6, B1–B2, C1) is fully independent.
 * Rows are persisted in localStorage.
 */

import { buildingAUnits, buildingBUnits, buildingCUnits, buildingAFurniture, buildingBFurniture, buildingCFurniture, UnitType, FurniturePerUnit } from './unitFurnitureData';

export type Concept = 'A' | 'B' | 'C';
export type RoomType = 'Dining' | 'Living Room' | 'Bedroom' | 'Outdoor' | 'Bathroom' | 'Kitchen' | 'Sauna & Wellness' | 'Accessories & Decor' | 'Mirrors' | 'Electrical & Appliances' | 'In-Room Safes' | 'Cutlery & Dining Sets' | 'Curtains & Window Treatments';

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

function isMirroredBUnitCode(unitCode: string): boolean {
  return /m\d*$/i.test(unitCode);
}

export function isUnitCodeInBuilding(concept: Concept, unitCode: string, building?: string): boolean {
  if (!building || concept !== 'B' || isZoneCode(unitCode)) return true;
  if (building === 'B1') return !isMirroredBUnitCode(unitCode);
  if (building === 'B2') return isMirroredBUnitCode(unitCode);
  return true;
}

/** Returns unit instances for a specific building. For B, codes are split between B1+B2. */
export function getUnitInstancesInBuilding(concept: Concept, unitCode: string, building?: string): number {
  if (!isUnitCodeInBuilding(concept, unitCode, building)) return 0;
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
    const instances = getUnitInstancesInBuilding(row.concept, row.unitCode, row.building);
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
  const catOrder: RoomType[] = ['Dining', 'Living Room', 'Bedroom', 'Outdoor', 'Bathroom', 'Kitchen', 'Sauna & Wellness', 'Accessories & Decor', 'Mirrors', 'Electrical & Appliances', 'In-Room Safes', 'Cutlery & Dining Sets', 'Curtains & Window Treatments'];
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
  const filtered = masterData.filter(r => r.concept === concept && r.building === targetBuilding && isUnitCodeInBuilding(concept, r.unitCode, targetBuilding));

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
    .filter(r => r.concept === concept && r.unitCode === unitCode && r.qtyPerUnit > 0 && r.building === targetBuilding && isUnitCodeInBuilding(concept, r.unitCode, targetBuilding))
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
    total += row.qtyPerUnit * getUnitInstancesInBuilding(row.concept, row.unitCode, row.building);
  });
  return total;
}

// ── ID generation ──
export function generateRowId(): string {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Room Size derivation + override ──
export type RoomSize = 'studio' | '1br' | '2br' | '3br' | '4br' | 'public';
export const ROOM_SIZE_LABELS: Record<RoomSize, string> = {
  studio: 'Studio',
  '1br': '1-Bedroom',
  '2br': '2-Bedroom',
  '3br': '3-Bedroom',
  '4br': '4-Bedroom',
  public: 'Public Areas',
};
export const RESIDENTIAL_ROOM_SIZES: RoomSize[] = ['studio', '1br', '2br', '3br', '4br'];
const ROOM_SIZE_OVERRIDE_KEY = 'cyprus-valley-room-size-overrides-v1';

/** Returns true if a unit code identifies a Common Area / Zone (lobby, spa, etc.) */
export function isZoneCode(unitCode: string): boolean {
  const code = unitCode.toUpperCase();
  return ['LOBBY', 'RESTAURANT', 'SPA', 'POOL', 'MEETING', 'BOH', 'GYM', 'ROOFTOP'].includes(code);
}

/** Auto-derive room size from a unit's `description` text. */
export function deriveRoomSizeFromDescription(description: string, unitCode?: string): RoomSize {
  if (unitCode && isZoneCode(unitCode)) return 'public';
  const d = (description || '').toLowerCase();
  if (d.includes('studio')) return 'studio';
  if (d.includes('1bd') || d.includes('1br') || d.includes('1-bed')) return '1br';
  if (d.includes('2bd') || d.includes('2br') || d.includes('2-bed')) return '2br';
  if (d.includes('3bd') || d.includes('3br') || d.includes('3-bed')) return '3br';
  if (d.includes('4bd') || d.includes('4br') || d.includes('4-bed') || d.includes('penthouse')) return '4br';
  if (d.includes('public') || d.includes('lobby') || d.includes('spa') || d.includes('pool') ||
      d.includes('gym') || d.includes('restaurant') || d.includes('meeting') || d.includes('boh') ||
      d.includes('rooftop')) return 'public';
  return 'studio';
}

/** Per-(concept,unitCode) manual room-size overrides, persisted in localStorage. */
export function loadRoomSizeOverrides(): Record<string, RoomSize> {
  try {
    const raw = localStorage.getItem(ROOM_SIZE_OVERRIDE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}
export function saveRoomSizeOverrides(map: Record<string, RoomSize>) {
  localStorage.setItem(ROOM_SIZE_OVERRIDE_KEY, JSON.stringify(map));
}
export function roomSizeOverrideKey(concept: Concept, unitCode: string): string {
  return `${concept}::${unitCode}`;
}

/** Resolve effective room size (override wins, otherwise auto-derive). */
export function getRoomSize(concept: Concept, unitCode: string, description: string): RoomSize {
  const overrides = loadRoomSizeOverrides();
  const k = roomSizeOverrideKey(concept, unitCode);
  if (overrides[k]) return overrides[k];
  return deriveRoomSizeFromDescription(description, unitCode);
}

// ── Computed: Procurement aggregated by Room Size ──
export interface ComputedProcurementByRoomSize {
  id: number;
  name: string;
  category: RoomType;
  qtyByRoomSize: Record<RoomSize, number>;
  grandTotal: number;
}

export function computeProcurementByRoomSize(masterData: MasterRow[]): ComputedProcurementByRoomSize[] {
  const overrides = loadRoomSizeOverrides();
  const unitDescCache = new Map<string, string>();
  const lookupDesc = (concept: Concept, code: string) => {
    const k = `${concept}-${code}`;
    if (unitDescCache.has(k)) return unitDescCache.get(k)!;
    const u = getUnitsForConcept(concept).find(x => x.code === code);
    const d = u?.description || '';
    unitDescCache.set(k, d);
    return d;
  };

  const map = new Map<string, { category: RoomType; qty: Record<RoomSize, number> }>();

  masterData.forEach(row => {
    if (isZoneCode(row.unitCode)) return; // exclude common areas from residential sizes
    const overrideKey = roomSizeOverrideKey(row.concept, row.unitCode);
    const size: RoomSize = overrides[overrideKey] || deriveRoomSizeFromDescription(lookupDesc(row.concept, row.unitCode), row.unitCode);
    if (size === 'public') return;

    const instances = getUnitInstancesInBuilding(row.concept, row.unitCode, row.building);
    const total = row.qtyPerUnit * instances;

    let entry = map.get(row.itemName);
    if (!entry) {
      entry = { category: row.roomType, qty: { studio: 0, '1br': 0, '2br': 0, '3br': 0, '4br': 0, public: 0 } };
      map.set(row.itemName, entry);
    }
    entry.qty[size] += total;
  });

  const catOrder: RoomType[] = ['Dining', 'Living Room', 'Bedroom', 'Outdoor', 'Bathroom', 'Kitchen', 'Sauna & Wellness', 'Accessories & Decor', 'Mirrors', 'Electrical & Appliances', 'In-Room Safes', 'Cutlery & Dining Sets', 'Curtains & Window Treatments'];
  const sorted = [...map.entries()].sort((a, b) => {
    const c = catOrder.indexOf(a[1].category) - catOrder.indexOf(b[1].category);
    if (c !== 0) return c;
    return a[0].localeCompare(b[0]);
  });

  let id = 1;
  return sorted.map(([name, data]) => ({
    id: id++,
    name,
    category: data.category,
    qtyByRoomSize: data.qty,
    grandTotal: data.qty.studio + data.qty['1br'] + data.qty['2br'] + data.qty['3br'] + data.qty['4br'],
  }));
}

/** Count unit instances grouped by room size, per building. Returns { [building]: { studio, 1br, ... } }. */
export function countUnitsByRoomSizePerBuilding(): Record<string, Record<RoomSize, number>> {
  const overrides = loadRoomSizeOverrides();
  const result: Record<string, Record<RoomSize, number>> = {};
  (['A', 'B', 'C'] as Concept[]).forEach(concept => {
    ALL_BUILDINGS[concept].forEach(building => {
      const r: Record<RoomSize, number> = { studio: 0, '1br': 0, '2br': 0, '3br': 0, '4br': 0, public: 0 };
      getUnitsForConcept(concept).forEach(u => {
        if (u.isZone) return;
        if (!isUnitCodeInBuilding(concept, u.code, building)) return;
        const k = roomSizeOverrideKey(concept, u.code);
        const size = overrides[k] || deriveRoomSizeFromDescription(u.description, u.code);
        if (size === 'public') return;
        const instances = u.floors.reduce((s, f) => s + (u.unitsPerFloor[f] || 0), 0);
        r[size] += instances;
      });
      result[building] = r;
    });
  });
  return result;
}

/** Count unit instances grouped by room size, across all concepts/buildings. */
export function countUnitsByRoomSize(): Record<RoomSize, number> {
  const overrides = loadRoomSizeOverrides();
  const result: Record<RoomSize, number> = { studio: 0, '1br': 0, '2br': 0, '3br': 0, '4br': 0, public: 0 };
  (['A', 'B', 'C'] as Concept[]).forEach(concept => {
    ALL_BUILDINGS[concept].forEach(building => {
      getUnitsForConcept(concept).forEach(u => {
        if (u.isZone) return;
        if (!isUnitCodeInBuilding(concept, u.code, building)) return;
        const k = roomSizeOverrideKey(concept, u.code);
        const size = overrides[k] || deriveRoomSizeFromDescription(u.description, u.code);
        if (size === 'public') return;
        const instances = u.floors.reduce((s, f) => s + (u.unitsPerFloor[f] || 0), 0);
        result[size] += instances;
      });
    });
  });
  return result;
}

// ── Computed: Procurement scoped to Public Areas (zones) ──
export interface ComputedPublicAreaItem {
  id: number;
  name: string;
  category: RoomType;
  zone: string;        // e.g. 'LOBBY'
  building: string;    // e.g. 'A1'
  concept: Concept;
  qty: number;         // total qty of this item in this zone instance
}

export function computePublicAreaItems(masterData: MasterRow[]): ComputedPublicAreaItem[] {
  const items: ComputedPublicAreaItem[] = [];
  let id = 1;
  masterData.forEach(row => {
    if (!isZoneCode(row.unitCode)) return;
    items.push({
      id: id++,
      name: row.itemName,
      category: row.roomType,
      zone: row.unitCode,
      building: row.building,
      concept: row.concept,
      qty: row.qtyPerUnit, // zones have unitsPerFloor of 1, so per-unit == total
    });
  });
  return items;
}
