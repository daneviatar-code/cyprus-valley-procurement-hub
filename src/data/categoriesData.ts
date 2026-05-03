/**
 * Shared Categories — single source of truth for procurement categories
 * used across Suppliers, Standard, and Catalog.
 *
 * Persisted to Lovable Cloud (categories table) with localStorage cache.
 */

import { supabase } from '@/integrations/supabase/client';
import { enqueue } from '@/lib/cloudWriteQueue';

export type CategoryScope = 'apartments' | 'public' | 'both';

export interface Category {
  id: string;
  nameEn: string;
  nameHe: string;
  scope: CategoryScope;
  order: number;
  archived?: boolean;
}

const CACHE_KEY = 'cyprus-valley-shared-categories';
const HYDRATED_FLAG = 'cyprus-valley-shared-categories-hydrated';
export const UNCATEGORIZED_ID = 'cat_uncategorized';

type Listener = (data: Category[]) => void;
const listeners = new Set<Listener>();

export function subscribeCategories(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function notify(data: Category[]) {
  listeners.forEach(l => { try { l(data); } catch {} });
}

function fromDb(r: any): Category {
  return {
    id: r.id,
    nameEn: r.name_en ?? '',
    nameHe: r.name_he ?? '',
    scope: (r.scope ?? 'both') as CategoryScope,
    order: r.order ?? 0,
    archived: !!r.archived,
  };
}

function toDb(c: Category) {
  return {
    id: c.id,
    name_en: c.nameEn,
    name_he: c.nameHe,
    scope: c.scope,
    order: c.order,
    archived: !!c.archived,
  };
}

export function loadCategoriesShared(): Category[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

let lastSnapshot = JSON.stringify(loadCategoriesShared());

function writeCache(data: Category[]) {
  const json = JSON.stringify(data);
  if (json === lastSnapshot) return;
  lastSnapshot = json;
  localStorage.setItem(CACHE_KEY, json);
}

export function saveCategoriesShared(data: Category[]): void {
  writeCache(data);
  void enqueue('categories', () => pushAllToCloud(data));
  notify(data);
}

async function pushAllToCloud(data: Category[]): Promise<void> {
  try {
    const { data: existing } = await supabase.from('categories' as any).select('id');
    const cloudIds = new Set((existing ?? []).map((r: any) => r.id));
    const localIds = new Set(data.map(c => c.id));
    const toDelete = [...cloudIds].filter(id => !localIds.has(id));
    if (toDelete.length > 0) {
      await supabase.from('categories' as any).delete().in('id', toDelete);
    }
    if (data.length > 0) {
      await supabase.from('categories' as any).upsert(data.map(toDb));
    }
  } catch (err) {
    console.error('[categories] cloud sync failed', err);
  }
}

export async function hydrateCategoriesFromCloud(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('categories' as any)
      .select('*')
      .order('order', { ascending: true });
    if (error) throw error;
    const rows = (data ?? []).map(fromDb);
    writeCache(rows);
    localStorage.setItem(HYDRATED_FLAG, '1');
    notify(rows);
  } catch (err) {
    console.error('[categories] hydrate failed', err);
  }
}

export function genCategoryIdShared(): string {
  return `cat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function ensureUncategorized(list: Category[]): Promise<Category[]> {
  if (list.some(c => c.id === UNCATEGORIZED_ID)) return list;
  const next: Category = {
    id: UNCATEGORIZED_ID,
    nameEn: 'Uncategorized',
    nameHe: 'לא מסווג',
    scope: 'both',
    order: 999,
  };
  const updated = [...list, next];
  saveCategoriesShared(updated);
  return updated;
}
