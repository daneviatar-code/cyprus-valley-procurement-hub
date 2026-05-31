/**
 * Packages — reusable furniture packages per Block (A/B/C).
 * Each package references catalog products with quantities and tags
 * compatible Room Types within its block.
 * Persisted to Lovable Cloud with a localStorage cache.
 */

import { supabase } from '@/integrations/supabase/client';
import { enqueue } from '@/lib/cloudWriteQueue';
import { Concept, ALL_BUILDINGS, isUnitCodeInBuilding } from './masterData';
import {
  buildingAUnits,
  buildingBUnits,
  buildingCUnits,
  UnitType,
} from './unitFurnitureData';

export interface PackageLineItem {
  productId: string;
  quantity: number;
}

/** Key format: `${building}::${unitCode}` -> number of physical units covered */
export type UnitCoverageMap = Record<string, number>;

export interface Package {
  id: string;
  name: string;
  description: string;
  block: Concept;
  items: PackageLineItem[];
  roomTypes: string[]; // unit codes / "floor:code" tokens within the block
  /** Specific buildings within the block this package targets (e.g. ['A1','A2']). */
  buildings: string[];
  /** How many physical instances of (building, unitCode) this package covers. Key = "B1::A". */
  unitCoverage: UnitCoverageMap;
  createdAt?: string;
}

export function coverageKey(building: string, unitCode: string): string {
  return `${building}::${unitCode}`;
}

/** Size assignment uses a reserved key prefix inside the same unitCoverage map. */
const SIZE_PREFIX = '__size__::';
export function sizeKey(building: string, size: string): string {
  return `${SIZE_PREFIX}${building}::${size}`;
}
export function isSizeKey(k: string): boolean {
  return k.startsWith(SIZE_PREFIX);
}
export function parseSizeKey(k: string): { building: string; size: string } | null {
  if (!isSizeKey(k)) return null;
  const rest = k.slice(SIZE_PREFIX.length);
  const i = rest.indexOf('::');
  if (i < 0) return null;
  return { building: rest.slice(0, i), size: rest.slice(i + 2) };
}

export interface SizeAssignment {
  building: string;
  size: string;
  quantity: number;
}

export function getSizeAssignments(p: Package): SizeAssignment[] {
  const out: SizeAssignment[] = [];
  Object.entries(p.unitCoverage ?? {}).forEach(([k, v]) => {
    const parsed = parseSizeKey(k);
    if (parsed && typeof v === 'number' && v > 0) {
      out.push({ building: parsed.building, size: parsed.size, quantity: v });
    }
  });
  return out;
}

const CACHE_KEY = 'cyprus-valley-packages';
const HYDRATED_FLAG = 'cyprus-valley-packages-hydrated';

type Listener = (data: Package[]) => void;
const listeners = new Set<Listener>();

export function subscribePackages(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function notify(data: Package[]) {
  listeners.forEach(l => { try { l(data); } catch {} });
}

function fromDb(r: any): Package {
  return {
    id: r.id,
    name: r.name ?? '',
    description: r.description ?? '',
    block: (r.block ?? 'A') as Concept,
    items: Array.isArray(r.items) ? r.items : [],
    roomTypes: Array.isArray(r.room_types) ? r.room_types : [],
    buildings: Array.isArray(r.buildings) ? r.buildings : [],
    unitCoverage: (r.unit_coverage && typeof r.unit_coverage === 'object') ? r.unit_coverage : {},
    createdAt: r.created_at,
  };
}

function toDb(p: Package) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    block: p.block,
    items: p.items,
    room_types: p.roomTypes,
    buildings: p.buildings ?? [],
    unit_coverage: p.unitCoverage ?? {},
  };
}

export function loadPackages(): Package[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

let lastSnapshot = JSON.stringify(loadPackages());

function writeCache(data: Package[]) {
  const json = JSON.stringify(data);
  if (json === lastSnapshot) return;
  lastSnapshot = json;
  localStorage.setItem(CACHE_KEY, json);
}

export function savePackages(data: Package[]): void {
  writeCache(data);
  notify(data);
  void enqueue('packages', () => pushAllToCloud(data));
}

async function pushAllToCloud(data: Package[]): Promise<void> {
  try {
    const { data: existing } = await supabase.from('packages').select('id');
    const cloudIds = new Set((existing ?? []).map((r: any) => r.id));
    const localIds = new Set(data.map(p => p.id));
    const toDelete = [...cloudIds].filter(id => !localIds.has(id));
    if (toDelete.length > 0) {
      await supabase.from('packages').delete().in('id', toDelete);
    }
    if (data.length > 0) {
      await supabase.from('packages').upsert(data.map(toDb) as any);
    }
  } catch (err) {
    console.error('[packages] cloud sync failed', err);
  }
}

export async function hydratePackagesFromCloud(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('packages')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    const rows = (data ?? []).map(fromDb);
    const cached = loadPackages();
    if (rows.length === 0 && cached.length > 0 && !localStorage.getItem(HYDRATED_FLAG)) {
      await pushAllToCloud(cached);
      localStorage.setItem(HYDRATED_FLAG, '1');
      return;
    }
    writeCache(rows);
    localStorage.setItem(HYDRATED_FLAG, '1');
    notify(rows);
  } catch (err) {
    console.error('[packages] hydrate failed', err);
  }
}

export function generatePackageId(): string {
  return `pkg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Room Types for a block = the unit types available in that block (excluding zones).
// We expose them as { code, description } so UI can render readable labels.
export interface BlockRoomType {
  code: string;
  description: string;
}

function getUnitsForBlock(block: Concept): UnitType[] {
  switch (block) {
    case 'A': return buildingAUnits;
    case 'B': return buildingBUnits;
    case 'C': return buildingCUnits;
  }
}

export function getRoomTypesForBlock(block: Concept): BlockRoomType[] {
  const seen = new Set<string>();
  const out: BlockRoomType[] = [];
  getUnitsForBlock(block).forEach(u => {
    if (u.isZone) return;
    if (seen.has(u.code)) return;
    seen.add(u.code);
    out.push({ code: u.code, description: u.description });
  });
  return out;
}

export interface BlockRoomTypeByFloor {
  floor: number;
  code: string;
  description: string;
  /** Stable token used in package.roomTypes — format "floor:code" */
  token: string;
}

/** Floor-aware room type list for a block. Same code on multiple floors = multiple entries. */
export function getRoomTypesByFloorForBlock(block: Concept): BlockRoomTypeByFloor[] {
  const out: BlockRoomTypeByFloor[] = [];
  getUnitsForBlock(block).forEach(u => {
    if (u.isZone) return;
    u.floors.forEach(f => {
      out.push({ floor: f, code: u.code, description: u.description, token: `${f}:${u.code}` });
    });
  });
  // sort by floor, then code
  out.sort((a, b) => a.floor - b.floor || a.code.localeCompare(b.code));
  return out;
}

export function floorLabel(floor: number): string {
  if (floor === 0) return 'Floor 1 (Ground)';
  return `Floor ${floor + 1}`;
}

/** Extract bare unit code from a roomTypes token ("floor:code" or just "code"). */
export function unitCodeFromToken(token: string): string {
  const i = token.indexOf(':');
  return i >= 0 ? token.slice(i + 1) : token;
}

/** Total physical instances of a given unitCode inside a specific building. */
export function totalUnitsInBuilding(block: Concept, building: string, unitCode: string): number {
  if (!isUnitCodeInBuilding(block, unitCode, building)) return 0;
  const unit = getUnitsForBlock(block).find(u => u.code === unitCode);
  if (!unit) return 0;
  let total = 0;
  unit.floors.forEach(f => { total += unit.unitsPerFloor[f] || 0; });
  return total;
}

export interface BuildingUnitTypeSummary {
  building: string;
  unitCode: string;
  description: string;
  totalUnits: number;
}

/** All residential (non-zone) unit-types per building inside a block. */
export function getBuildingUnitTypes(block: Concept): BuildingUnitTypeSummary[] {
  const out: BuildingUnitTypeSummary[] = [];
  const seen = new Set<string>();
  ALL_BUILDINGS[block].forEach(building => {
    getUnitsForBlock(block).forEach(u => {
      if (u.isZone) return;
      if (!isUnitCodeInBuilding(block, u.code, building)) return;
      const key = `${building}::${u.code}`;
      if (seen.has(key)) return;
      seen.add(key);
      const totalUnits = totalUnitsInBuilding(block, building, u.code);
      if (totalUnits > 0) {
        out.push({ building, unitCode: u.code, description: u.description, totalUnits });
      }
    });
  });
  return out;
}
