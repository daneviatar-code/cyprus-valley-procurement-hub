/**
 * Public Areas — Hierarchical structure: Building → Zone → Items.
 * Independent collections persisted in localStorage. All computed
 * fields (totals, costs, outstanding) live in selectors.
 */

import { StandardStatus } from './roomStandardsData';

// ── Types ─────────────────────────────────────────────────────────────────
export interface PublicAreaBuilding {
  id: string;
  name: string;
  nameHe?: string;
  order: number;
  archived?: boolean;
}

export interface PublicAreaZone {
  id: string;
  buildingId: string;
  name: string;
  nameHe?: string;
  order: number;
  archived?: boolean;
}

export interface PublicAreaItem {
  id: string;
  zoneId: string;
  itemName: string;
  spec: string;
  categoryId: string;
  qty: number;
  spare: number;
  supplierId?: string;
  unitPriceEur?: number;
  status: StandardStatus;
  orderedQty: number;
  deliveredQty: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// ── Storage Keys ──────────────────────────────────────────────────────────
const BUILDINGS_KEY = 'cyprus-valley_publicAreaBuildings';
const ZONES_KEY = 'cyprus-valley_publicAreaZones';
const ITEMS_KEY = 'cyprus-valley_publicAreaItems';

// ── ID generators ─────────────────────────────────────────────────────────
export const genBuildingId = () => `pab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
export const genZoneId     = () => `paz_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
export const genItemId     = () => `pai_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// ── Seed data ─────────────────────────────────────────────────────────────
interface SeedZone { name: string; nameHe?: string }
interface SeedBuilding { name: string; nameHe?: string; zones: SeedZone[] }

const SEED: SeedBuilding[] = [
  { name: 'Building C1', zones: [] },
  {
    name: 'Building C2',
    zones: [
      { name: 'goujeanddaniel' },
      { name: 'Morning Garden', nameHe: 'גן בוקר' },
      { name: 'Reception', nameHe: 'קבלה' },
      { name: 'Pools', nameHe: 'בריכות' },
      { name: 'Pool Restaurant & Bar + Roof', nameHe: 'מסעדה ובר בריכה + גג' },
    ],
  },
  {
    name: 'Lobbies', nameHe: 'לוביים',
    zones: [
      { name: 'Lobby A2' }, { name: 'Lobby A3' }, { name: 'Lobby A4' },
      { name: 'Lobby A5' }, { name: 'Lobby A6' },
      { name: 'Lobby B1' }, { name: 'Lobby B2' },
    ],
  },
];

function buildSeed(): { buildings: PublicAreaBuilding[]; zones: PublicAreaZone[] } {
  const buildings: PublicAreaBuilding[] = [];
  const zones: PublicAreaZone[] = [];
  SEED.forEach((b, bi) => {
    const bid = genBuildingId();
    buildings.push({ id: bid, name: b.name, nameHe: b.nameHe, order: bi });
    b.zones.forEach((z, zi) => {
      zones.push({ id: genZoneId(), buildingId: bid, name: z.name, nameHe: z.nameHe, order: zi });
    });
  });
  return { buildings, zones };
}

// ── Loaders / Savers ──────────────────────────────────────────────────────
export function loadBuildings(): PublicAreaBuilding[] {
  try {
    const raw = localStorage.getItem(BUILDINGS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p) && p.length > 0) return p;
    }
  } catch {}
  const seed = buildSeed();
  saveBuildings(seed.buildings);
  saveZones(seed.zones);
  return seed.buildings;
}

export function loadZones(): PublicAreaZone[] {
  try {
    const raw = localStorage.getItem(ZONES_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) return p;
    }
  } catch {}
  return [];
}

export function loadItems(): PublicAreaItem[] {
  try {
    const raw = localStorage.getItem(ITEMS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) return p;
    }
  } catch {}
  return [];
}

export const saveBuildings = (d: PublicAreaBuilding[]) =>
  localStorage.setItem(BUILDINGS_KEY, JSON.stringify(d));
export const saveZones = (d: PublicAreaZone[]) =>
  localStorage.setItem(ZONES_KEY, JSON.stringify(d));
export const saveItems = (d: PublicAreaItem[]) =>
  localStorage.setItem(ITEMS_KEY, JSON.stringify(d));

// ── Factory ───────────────────────────────────────────────────────────────
export function emptyItem(zoneId: string, categoryId = ''): PublicAreaItem {
  const now = new Date().toISOString();
  return {
    id: genItemId(),
    zoneId,
    itemName: '',
    spec: '',
    categoryId,
    qty: 1,
    spare: 0,
    status: 'Planned',
    orderedQty: 0,
    deliveredQty: 0,
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
}

// ── Computed selectors ────────────────────────────────────────────────────
export interface ComputedItem {
  item: PublicAreaItem;
  totalQty: number;
  lineCost: number;
  outstandingQty: number;
}

export function computeItem(item: PublicAreaItem): ComputedItem {
  const totalQty = (item.qty || 0) + (item.spare || 0);
  const lineCost = (item.unitPriceEur || 0) * totalQty;
  const outstandingQty = Math.max(0, totalQty - (item.deliveredQty || 0));
  return { item, totalQty, lineCost, outstandingQty };
}

export interface ScopeSummary {
  numZones: number;
  numItems: number;
  totalQty: number;
  totalBudget: number;
  orderedValue: number;
  deliveredValue: number;
  outstandingValue: number;
}

export function summarizeScope(items: PublicAreaItem[], zoneCount: number): ScopeSummary {
  const computed = items.map(computeItem);
  const totalBudget = computed.reduce((s, c) => s + c.lineCost, 0);
  const orderedValue = items.reduce((s, i) => s + (i.unitPriceEur || 0) * (i.orderedQty || 0), 0);
  const deliveredValue = items.reduce((s, i) => s + (i.unitPriceEur || 0) * (i.deliveredQty || 0), 0);
  return {
    numZones: zoneCount,
    numItems: items.length,
    totalQty: computed.reduce((s, c) => s + c.totalQty, 0),
    totalBudget,
    orderedValue,
    deliveredValue,
    outstandingValue: Math.max(0, totalBudget - deliveredValue),
  };
}
