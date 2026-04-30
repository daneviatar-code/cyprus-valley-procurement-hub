/**
 * Packages — reusable furniture packages per Block (A/B/C).
 * Each package references catalog products with quantities and tags
 * compatible Room Types within its block.
 * Persisted to Lovable Cloud with a localStorage cache.
 */

import { supabase } from '@/integrations/supabase/client';
import { enqueue } from '@/lib/cloudWriteQueue';
import { Concept } from './masterData';
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

export interface Package {
  id: string;
  name: string;
  description: string;
  block: Concept;
  items: PackageLineItem[];
  roomTypes: string[]; // unit codes within the block
  createdAt?: string;
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
