/**
 * Selection Data — tracks product selections per concept + unitCode + item line.
 * Persisted in localStorage.
 */

import { Concept } from './masterData';

export interface Selection {
  productName: string;
  supplier: string;
  unitPrice: number;
  notes: string;
  imageUrl?: string;
  productUrl?: string;
}

export type SelectionMap = Record<string, Selection>; // key = itemName

const STORAGE_PREFIX = 'cyprus-valley-selections';

function storageKey(concept: Concept, unitCode: string): string {
  return `${STORAGE_PREFIX}_${concept}_${unitCode}`;
}

export function loadSelections(concept: Concept, unitCode: string): SelectionMap {
  try {
    const raw = localStorage.getItem(storageKey(concept, unitCode));
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

export function saveSelections(concept: Concept, unitCode: string, data: SelectionMap): void {
  localStorage.setItem(storageKey(concept, unitCode), JSON.stringify(data));
}

/**
 * Load all selections across every concept+unit combo.
 * Returns a map: itemName → Selection (first match wins).
 */
export function loadAllSelections(): Record<string, Selection> {
  const result: Record<string, Selection> = {};
  const concepts: Concept[] = ['A', 'B', 'C'];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
    try {
      const map: SelectionMap = JSON.parse(localStorage.getItem(key) || '{}');
      for (const [itemName, sel] of Object.entries(map)) {
        if (!result[itemName]) {
          result[itemName] = sel;
        }
      }
    } catch {}
  }
  return result;
}
