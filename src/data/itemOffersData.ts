/**
 * Item Offers — multiple supplier offers per Standard Item.
 *
 * Mirrors the supplierData pattern: localStorage cache + cloud sync via
 * cloudWriteQueue + subscribe listeners.
 */
import { supabase } from '@/integrations/supabase/client';
import { enqueue } from '@/lib/cloudWriteQueue';
import { toEur } from '@/lib/fxRates';
import { loadStandardItems, saveStandardItems } from '@/data/standardItemsData';

// Mirror a selected offer's product info onto its Standard item so the
// Standard tab shows exactly what the user picked.
function syncSelectedToStandardItem(offer: ItemOffer): void {
  const items = loadStandardItems();
  const idx = items.findIndex(i => i.id === offer.standardItemId);
  if (idx < 0) return;
  const cur = items[idx];
  const next = {
    ...cur,
    itemName: offer.productName?.trim() || cur.itemName,
    spec: offer.spec ?? cur.spec,
    dimensions: offer.dimensions ?? cur.dimensions,
    supplierId: offer.supplierId ?? cur.supplierId,
    unitPriceEur: offer.priceEur ?? cur.unitPriceEur,
    updatedAt: new Date().toISOString(),
  };
  const copy = items.slice();
  copy[idx] = next;
  saveStandardItems(copy);
}

export interface ItemOffer {
  id: string;
  standardItemId: string;
  supplierId?: string | null;
  productName: string;
  productSku?: string | null;
  spec?: string | null;
  dimensions?: string | null;
  imageUrl?: string | null;
  price: number;
  currency: string;
  priceEur?: number | null;
  leadTimeDays?: number | null;
  moq?: number | null;
  validUntil?: string | null; // YYYY-MM-DD
  notes?: string | null;
  isSelected: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ItemOfferHistoryRow {
  historyId: number;
  offerId: string;
  standardItemId: string;
  action: 'created' | 'updated' | 'deleted' | 'selected' | 'deselected' | string;
  snapshot: any;
  changedAt: string;
}

const CACHE_KEY = 'cyprus-valley-item-offers';
const HYDRATED_FLAG = 'cyprus-valley-item-offers-hydrated';

type Listener = (rows: ItemOffer[]) => void;
const listeners = new Set<Listener>();

export function subscribeItemOffers(fn: Listener): () => void {
  listeners.add(fn); return () => { listeners.delete(fn); };
}

function notify(rows: ItemOffer[]) {
  listeners.forEach(l => { try { l(rows); } catch {} });
}

export function genOfferId(): string {
  return `off_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── DB ↔ App mapping ──────────────────────────────────────────────────
function fromDb(r: any): ItemOffer {
  return {
    id: r.id,
    standardItemId: r.standard_item_id,
    supplierId: r.supplier_id ?? null,
    productName: r.product_name ?? '',
    productSku: r.product_sku ?? null,
    spec: r.spec ?? null,
    dimensions: r.dimensions ?? null,
    imageUrl: r.image_url ?? null,
    price: Number(r.price ?? 0),
    currency: r.currency ?? 'EUR',
    priceEur: r.price_eur == null ? null : Number(r.price_eur),
    leadTimeDays: r.lead_time_days ?? null,
    moq: r.moq ?? null,
    validUntil: r.valid_until ?? null,
    notes: r.notes ?? null,
    isSelected: !!r.is_selected,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toDb(o: ItemOffer): any {
  return {
    id: o.id,
    standard_item_id: o.standardItemId,
    supplier_id: o.supplierId ?? null,
    product_name: o.productName ?? '',
    product_sku: o.productSku ?? null,
    spec: o.spec ?? null,
    dimensions: o.dimensions ?? null,
    image_url: o.imageUrl ?? null,
    price: o.price ?? 0,
    currency: o.currency ?? 'EUR',
    price_eur: o.priceEur ?? null,
    lead_time_days: o.leadTimeDays ?? null,
    moq: o.moq ?? null,
    valid_until: o.validUntil ?? null,
    notes: o.notes ?? null,
    is_selected: !!o.isSelected,
    created_at: o.createdAt,
    updated_at: o.updatedAt,
  };
}

// ── Sync cache ────────────────────────────────────────────────────────
export function loadItemOffers(): ItemOffer[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

let lastSnap = JSON.stringify(loadItemOffers());

function writeCache(rows: ItemOffer[]) {
  const json = JSON.stringify(rows);
  if (json === lastSnap) return;
  lastSnap = json;
  try { localStorage.setItem(CACHE_KEY, json); } catch {}
}

function setAllInMemory(rows: ItemOffer[]) {
  writeCache(rows);
  notify(rows);
}

// ── Mutations ─────────────────────────────────────────────────────────
export async function saveItemOffer(offer: ItemOffer): Promise<void> {
  const now = new Date().toISOString();
  const priceEur = toEur(offer.price, offer.currency);
  const o: ItemOffer = {
    ...offer,
    priceEur,
    updatedAt: now,
    createdAt: offer.createdAt || now,
  };
  const current = loadItemOffers();
  let next = current.filter(x => x.id !== o.id);
  if (o.isSelected) {
    // deselect siblings
    next = next.map(x =>
      x.standardItemId === o.standardItemId && x.isSelected
        ? { ...x, isSelected: false, updatedAt: now }
        : x,
    );
  }
  next.push(o);
  setAllInMemory(next);
  if (o.isSelected) syncSelectedToStandardItem(o);

  await enqueue(`item_offers:${o.standardItemId}`, async () => {
    try {
      if (o.isSelected) {
        // Clear selection on siblings FIRST to satisfy unique partial index.
        await supabase
          .from('item_offers')
          .update({ is_selected: false })
          .eq('standard_item_id', o.standardItemId)
          .neq('id', o.id);
      }
      const { error } = await supabase.from('item_offers').upsert(toDb(o));
      if (error) throw error;
    } catch (err) {
      console.error('[item_offers] save failed', err);
    }
  });
}

export async function deleteItemOffer(offerId: string): Promise<void> {
  const current = loadItemOffers();
  const offer = current.find(x => x.id === offerId);
  if (!offer) return;
  const next = current.filter(x => x.id !== offerId);
  setAllInMemory(next);
  await enqueue(`item_offers:${offer.standardItemId}`, async () => {
    try {
      const { error } = await supabase.from('item_offers').delete().eq('id', offerId);
      if (error) throw error;
    } catch (err) {
      console.error('[item_offers] delete failed', err);
    }
  });
}

export async function selectItemOffer(offerId: string): Promise<void> {
  const current = loadItemOffers();
  const offer = current.find(x => x.id === offerId);
  if (!offer) return;
  await saveItemOffer({ ...offer, isSelected: true });
}

// ── Hydrate from cloud ────────────────────────────────────────────────
export async function hydrateItemOffersFromCloud(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('item_offers')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    const rows = (data ?? []).map(fromDb);
    lastSnap = JSON.stringify(rows);
    try { localStorage.setItem(CACHE_KEY, lastSnap); } catch {}
    localStorage.setItem(HYDRATED_FLAG, '1');
    notify(rows);
  } catch (err) {
    console.error('[item_offers] hydrate failed', err);
  }
}

// ── Selectors ─────────────────────────────────────────────────────────
export function getOffersForItem(all: ItemOffer[], itemId: string): ItemOffer[] {
  return all.filter(o => o.standardItemId === itemId);
}

export function getCheapestOffer(offers: ItemOffer[]): ItemOffer | undefined {
  let best: ItemOffer | undefined;
  for (const o of offers) {
    const p = o.priceEur;
    if (p == null || !isFinite(p)) continue;
    if (!best || (best.priceEur ?? Infinity) > p) best = o;
  }
  return best;
}

export function getFastestOffer(offers: ItemOffer[]): ItemOffer | undefined {
  let best: ItemOffer | undefined;
  for (const o of offers) {
    const l = o.leadTimeDays;
    if (l == null || !isFinite(l)) continue;
    if (!best || (best.leadTimeDays ?? Infinity) > l) best = o;
  }
  return best;
}

// ── History ───────────────────────────────────────────────────────────
export async function fetchOfferHistory(standardItemId: string): Promise<ItemOfferHistoryRow[]> {
  try {
    const { data, error } = await supabase
      .from('item_offer_history' as any)
      .select('*')
      .eq('standard_item_id', standardItemId)
      .order('changed_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      historyId: r.history_id,
      offerId: r.offer_id,
      standardItemId: r.standard_item_id,
      action: r.action,
      snapshot: r.snapshot,
      changedAt: r.changed_at,
    }));
  } catch (err) {
    console.error('[item_offer_history] fetch failed', err);
    return [];
  }
}
