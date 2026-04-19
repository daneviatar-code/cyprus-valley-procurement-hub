/**
 * Room Standards & Procurement Categories
 * Independent collections persisted in localStorage.
 * Used by the "Room Standards" top-level tab. All computed fields
 * (totals, costs, outstanding qty) live in selectors so they always
 * reflect the latest unit counts and prices.
 */

import { RoomSize, countUnitsByRoomSize } from './masterData';

// ── Procurement Category ──────────────────────────────────────────────────
export type CategoryScope = 'apartments' | 'public' | 'both';

export interface ProcurementCategory {
  id: string;
  nameEn: string;
  nameHe: string;
  scope: CategoryScope;
  order: number;
  archived?: boolean;
}

const CATEGORIES_KEY = 'cyprus-valley_procurementCategories';

export const SEED_CATEGORIES: Omit<ProcurementCategory, 'id'>[] = [
  { nameEn: 'Linens',                nameHe: 'לובנה',                       scope: 'apartments', order: 1 },
  { nameEn: 'Appliances',            nameHe: 'מוצרי חשמל',                  scope: 'both',       order: 2 },
  { nameEn: 'Lighting',              nameHe: 'תאורה',                       scope: 'both',       order: 3 },
  { nameEn: 'Air Conditioners',      nameHe: 'מזגנים',                      scope: 'both',       order: 4 },
  { nameEn: 'Televisions',           nameHe: 'טלוויזיות',                   scope: 'both',       order: 5 },
  { nameEn: 'Door Locks',            nameHe: 'מנעולים לדלתות',              scope: 'apartments', order: 6 },
  { nameEn: 'Apartment Safes',       nameHe: 'כספות',                       scope: 'apartments', order: 7 },
  { nameEn: 'Mobile Furniture',      nameHe: 'ריהוט נייד לחלל ציבורי',      scope: 'public',     order: 8 },
  { nameEn: 'Art & Decor',           nameHe: 'אומנות ואביזרי נוי',          scope: 'both',       order: 9 },
  { nameEn: 'Accessories',           nameHe: 'אקססוריז',                    scope: 'both',       order: 10 },
  { nameEn: 'Bathroom Accessories',  nameHe: 'אביזרי אמבטיה',               scope: 'both',       order: 11 },
  { nameEn: 'Tableware Sets',        nameHe: 'מערכות כלי אוכל',             scope: 'both',       order: 12 },
  { nameEn: 'Rugs',                  nameHe: 'שטיחים',                      scope: 'both',       order: 13 },
  { nameEn: 'Curtains',              nameHe: 'וילונות',                     scope: 'both',       order: 14 },
  { nameEn: 'Mirrors',               nameHe: 'מראות ומראות גוף',            scope: 'both',       order: 15 },
];

export function genCategoryId(): string {
  return `cat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function loadCategories(): ProcurementCategory[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  const seeded = SEED_CATEGORIES.map(c => ({ ...c, id: genCategoryId() }));
  saveCategories(seeded);
  return seeded;
}

export function saveCategories(data: ProcurementCategory[]) {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(data));
}

// ── Room Standards ────────────────────────────────────────────────────────
export type StandardStatus =
  | 'Planned'
  | 'Quoted'
  | 'Ordered'
  | 'Partially Delivered'
  | 'Delivered'
  | 'Cancelled';

export const STANDARD_STATUSES: StandardStatus[] = [
  'Planned', 'Quoted', 'Ordered', 'Partially Delivered', 'Delivered', 'Cancelled',
];

export interface RoomStandard {
  id: string;
  roomSize: RoomSize;
  categoryId: string;
  itemName: string;
  spec: string;
  qtyPerUnit: number;
  sparePerUnit: number;
  supplierId?: string;
  unitPriceEur?: number;
  status: StandardStatus;
  orderedQty: number;
  deliveredQty: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

const STANDARDS_KEY = 'cyprus-valley_roomStandards';

export function genStandardId(): string {
  return `std_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function loadStandards(): RoomStandard[] {
  try {
    const raw = localStorage.getItem(STANDARDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveStandards(data: RoomStandard[]) {
  localStorage.setItem(STANDARDS_KEY, JSON.stringify(data));
}

export function emptyStandard(roomSize: RoomSize, categoryId: string): RoomStandard {
  const now = new Date().toISOString();
  return {
    id: genStandardId(),
    roomSize,
    categoryId,
    itemName: '',
    spec: '',
    qtyPerUnit: 1,
    sparePerUnit: 0,
    status: 'Planned',
    orderedQty: 0,
    deliveredQty: 0,
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
}

// ── Category Budgets ─────────────────────────────────────────────────────
const BUDGETS_KEY = 'cyprus-valley_categoryBudgets';
export type CategoryBudgets = Record<string, number>; // categoryId -> €

export function loadBudgets(): CategoryBudgets {
  try {
    const raw = localStorage.getItem(BUDGETS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}
export function saveBudgets(b: CategoryBudgets) {
  localStorage.setItem(BUDGETS_KEY, JSON.stringify(b));
}

// ── Computed Selectors ────────────────────────────────────────────────────
export interface ComputedStandard {
  std: RoomStandard;
  totalPerUnit: number;
  unitsInHotel: number;
  hotelQtyNeeded: number;
  lineCost: number;
  outstandingQty: number;
}

export function computeStandard(std: RoomStandard): ComputedStandard {
  const counts = countUnitsByRoomSize();
  const unitsInHotel = counts[std.roomSize] || 0;
  const totalPerUnit = (std.qtyPerUnit || 0) + (std.sparePerUnit || 0);
  const hotelQtyNeeded = totalPerUnit * unitsInHotel;
  const lineCost = (std.unitPriceEur || 0) * hotelQtyNeeded;
  const outstandingQty = Math.max(0, hotelQtyNeeded - (std.deliveredQty || 0));
  return { std, totalPerUnit, unitsInHotel, hotelQtyNeeded, lineCost, outstandingQty };
}

export interface RoomSizeSummary {
  numCategories: number;
  numSkus: number;
  unitsOfSize: number;
  totalQtyNeeded: number;
  totalBudget: number;
  orderedValue: number;
  deliveredValue: number;
  outstandingValue: number;
}

export function summarizeRoomSize(
  roomSize: RoomSize,
  standards: RoomStandard[],
): RoomSizeSummary {
  const scoped = standards.filter(s => s.roomSize === roomSize);
  const computed = scoped.map(computeStandard);
  const counts = countUnitsByRoomSize();
  const totalBudget = computed.reduce((s, c) => s + c.lineCost, 0);
  const orderedValue = scoped.reduce(
    (s, std) => s + (std.unitPriceEur || 0) * (std.orderedQty || 0), 0,
  );
  const deliveredValue = scoped.reduce(
    (s, std) => s + (std.unitPriceEur || 0) * (std.deliveredQty || 0), 0,
  );
  return {
    numCategories: new Set(scoped.map(s => s.categoryId)).size,
    numSkus: scoped.length,
    unitsOfSize: counts[roomSize] || 0,
    totalQtyNeeded: computed.reduce((s, c) => s + c.hotelQtyNeeded, 0),
    totalBudget,
    orderedValue,
    deliveredValue,
    outstandingValue: Math.max(0, totalBudget - deliveredValue),
  };
}

export function eur(n: number): string {
  return `€${(n || 0).toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
