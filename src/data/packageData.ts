/**
 * Package Editor data layer.
 * Each Building Concept + Unit Code combo has its own independent package.
 * Persisted in localStorage with key: package_[Concept]_[UnitCode]
 */

import { Concept } from './masterData';
import {
  buildingAFurniture,
  buildingBFurniture,
  buildingCFurniture,
  FurniturePerUnit,
} from './unitFurnitureData';

export type PackageCategory = 'Dining' | 'Living Room' | 'Bedroom' | 'Outdoor';

export interface PackageItem {
  id: string;
  itemName: string;
  category: PackageCategory;
  quantity: number;
  unitPrice: number;
  supplier: string;
  notes: string;
}

export interface PackageData {
  items: PackageItem[];
}

function storageKey(concept: Concept, unitCode: string): string {
  return `package_${concept}_${unitCode}`;
}

function generateId(): string {
  return `pkg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getFurnitureForConcept(concept: Concept): FurniturePerUnit[] {
  switch (concept) {
    case 'A': return buildingAFurniture;
    case 'B': return buildingBFurniture;
    case 'C': return buildingCFurniture;
  }
}

/** Build default package items from the hardcoded furniture data */
function buildDefaultPackage(concept: Concept, unitCode: string): PackageItem[] {
  const furniture = getFurnitureForConcept(concept);
  const items: PackageItem[] = [];

  furniture.forEach(f => {
    const qty = f.quantities[unitCode] ?? 0;
    if (qty > 0) {
      items.push({
        id: generateId(),
        itemName: f.itemName,
        category: f.category as PackageCategory,
        quantity: qty,
        unitPrice: 0,
        supplier: '',
        notes: '',
      });
    }
  });

  return items;
}

export function loadPackage(concept: Concept, unitCode: string): PackageData {
  const key = storageKey(concept, unitCode);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.items)) return parsed;
    }
  } catch {}
  // Seed from defaults
  const items = buildDefaultPackage(concept, unitCode);
  const data: PackageData = { items };
  savePackage(concept, unitCode, data);
  return data;
}

export function savePackage(concept: Concept, unitCode: string, data: PackageData): void {
  localStorage.setItem(storageKey(concept, unitCode), JSON.stringify(data));
}

export function createNewItem(): PackageItem {
  return {
    id: generateId(),
    itemName: '',
    category: 'Living Room',
    quantity: 1,
    unitPrice: 0,
    supplier: '',
    notes: '',
  };
}
