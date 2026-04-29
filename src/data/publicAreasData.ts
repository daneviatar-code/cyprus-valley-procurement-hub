/**
 * Public Areas — Generic node tree (building / group / area) → Items.
 * Top-level nodes have parentId=null. Children link via parentId.
 * Items attach to any node (typically leaf nodes).
 * Persisted in localStorage with one-time migration from the old
 * buildings+zones schema. Computed totals live in selectors.
 */

import { StandardStatus } from './roomStandardsData';

// ── Types ─────────────────────────────────────────────────────────────────
export type NodeType = 'building' | 'group' | 'area';

export interface PublicAreaNode {
  id: string;
  name: string;
  nameHe?: string;
  type: NodeType;
  parentId: string | null;
  order: number;
  archived?: boolean;
}

export interface PublicAreaItem {
  id: string;
  /** Node this item is attached to. Replaces legacy `zoneId`. */
  nodeId: string;
  /** Legacy field kept readable; use nodeId going forward. */
  zoneId?: string;
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
const NODES_KEY = 'cyprus-valley_publicAreaNodes';
const ITEMS_KEY = 'cyprus-valley_publicAreaItems';
// Legacy keys (read-only, used only for one-time migration)
const LEGACY_BUILDINGS_KEY = 'cyprus-valley_publicAreaBuildings';
const LEGACY_ZONES_KEY = 'cyprus-valley_publicAreaZones';

// ── ID generators ─────────────────────────────────────────────────────────
export const genNodeId = () => `pan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
export const genItemId = () => `pai_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// ── Seed ──────────────────────────────────────────────────────────────────
interface SeedNode {
  name: string;
  nameHe?: string;
  type: NodeType;
  children?: SeedNode[];
}

const SEED: SeedNode[] = [
  { name: 'Building C1', type: 'building' },
  { name: 'Building C2', type: 'building', children: [
    { name: 'goujeanddaniel', type: 'area' },
  ]},
  { name: 'Morning Garden',                   nameHe: 'גן בוקר',                    type: 'area' },
  { name: 'Reception',                        nameHe: 'קבלה',                       type: 'area' },
  { name: 'Pools',                            nameHe: 'בריכות',                     type: 'area' },
  { name: 'Pool Restaurant & Bar + Roof',     nameHe: 'מסעדה ובר בריכה + גג',        type: 'area' },
  { name: 'Lobbies', nameHe: 'לוביים', type: 'group', children: [
    { name: 'Lobby A2', type: 'area' }, { name: 'Lobby A3', type: 'area' },
    { name: 'Lobby A4', type: 'area' }, { name: 'Lobby A5', type: 'area' },
    { name: 'Lobby A6', type: 'area' },
    { name: 'Lobby B1', type: 'area' }, { name: 'Lobby B2', type: 'area' },
  ]},
];

function buildSeed(): PublicAreaNode[] {
  const out: PublicAreaNode[] = [];
  const walk = (nodes: SeedNode[], parentId: string | null) => {
    nodes.forEach((n, idx) => {
      const id = genNodeId();
      out.push({
        id, name: n.name, nameHe: n.nameHe, type: n.type,
        parentId, order: idx,
      });
      if (n.children?.length) walk(n.children, id);
    });
  };
  walk(SEED, null);
  return out;
}

// ── Migration ─────────────────────────────────────────────────────────────
/**
 * Migrate legacy { buildings, zones } + items.zoneId schema into the
 * new node tree. Specifically:
 *   - Each legacy building → top-level node (building or group).
 *     "Lobbies" becomes type 'group'; everything else 'building'.
 *   - Each legacy zone → child node (type 'area') under its building.
 *   - Then: detach the 4 standalone areas (Morning Garden, Reception,
 *     Pools, Pool Restaurant & Bar + Roof) from Building C2 → top-level.
 *     Keep "goujeanddaniel" under C2.
 *   - Items keep their original zone linkage via nodeId = original zone id.
 */
function migrateFromLegacy(): PublicAreaNode[] | null {
  try {
    const rawB = localStorage.getItem(LEGACY_BUILDINGS_KEY);
    const rawZ = localStorage.getItem(LEGACY_ZONES_KEY);
    if (!rawB && !rawZ) return null;
    const legacyBuildings: Array<{ id: string; name: string; nameHe?: string; order: number }> =
      rawB ? JSON.parse(rawB) : [];
    const legacyZones: Array<{ id: string; buildingId: string; name: string; nameHe?: string; order: number }> =
      rawZ ? JSON.parse(rawZ) : [];
    if (legacyBuildings.length === 0 && legacyZones.length === 0) return null;

    const nodes: PublicAreaNode[] = [];
    legacyBuildings.forEach(b => {
      const isGroup = b.name.toLowerCase().includes('lobb');
      nodes.push({
        id: b.id, name: b.name, nameHe: b.nameHe,
        type: isGroup ? 'group' : 'building',
        parentId: null, order: b.order,
      });
    });
    legacyZones.forEach(z => {
      nodes.push({
        id: z.id, name: z.name, nameHe: z.nameHe,
        type: 'area', parentId: z.buildingId, order: z.order,
      });
    });

    // Detach the 4 standalone areas from Building C2 → top-level.
    const standaloneNames = new Set([
      'morning garden', 'reception', 'pools', 'pool restaurant & bar + roof',
    ]);
    const c2 = nodes.find(n => n.type === 'building' && n.name.toLowerCase().replace(/\s+/g, '') === 'buildingc2');
    let topOrder = nodes.filter(n => n.parentId === null).length;
    nodes.forEach(n => {
      if (c2 && n.parentId === c2.id && standaloneNames.has(n.name.toLowerCase())) {
        n.parentId = null;
        n.order = topOrder++;
      }
    });

    // Persist + clear legacy keys
    saveNodes(nodes);
    localStorage.removeItem(LEGACY_BUILDINGS_KEY);
    localStorage.removeItem(LEGACY_ZONES_KEY);
    return nodes;
  } catch {
    return null;
  }
}

// ── Loaders / Savers ──────────────────────────────────────────────────────
import { supabase } from '@/integrations/supabase/client';

const HYDRATED_FLAG = 'cyprus-valley_publicAreas_hydrated';
type NodesListener = (rows: PublicAreaNode[]) => void;
type ItemsListener = (rows: PublicAreaItem[]) => void;
const nodeListeners = new Set<NodesListener>();
const itemListeners = new Set<ItemsListener>();
export function subscribePublicAreaNodes(fn: NodesListener) { nodeListeners.add(fn); return () => nodeListeners.delete(fn); }
export function subscribePublicAreaItems(fn: ItemsListener) { itemListeners.add(fn); return () => itemListeners.delete(fn); }

export function loadNodes(): PublicAreaNode[] {
  try {
    const raw = localStorage.getItem(NODES_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p) && p.length > 0) return p;
    }
  } catch {}
  // Try migration from legacy schema first
  const migrated = migrateFromLegacy();
  if (migrated && migrated.length > 0) return migrated;
  // Fresh seed
  const seeded = buildSeed();
  saveNodes(seeded);
  return seeded;
}

let lastNodesSnap = '';
export function saveNodes(d: PublicAreaNode[]) {
  const json = JSON.stringify(d);
  if (json === lastNodesSnap) return;
  lastNodesSnap = json;
  localStorage.setItem(NODES_KEY, json);
  void pushNodesToCloud(d);
}

export function loadItems(): PublicAreaItem[] {
  try {
    const raw = localStorage.getItem(ITEMS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) {
        // Migrate legacy items: zoneId → nodeId
        return p.map((i: PublicAreaItem) =>
          i.nodeId ? i : { ...i, nodeId: i.zoneId || '' }
        );
      }
    }
  } catch {}
  return [];
}

let lastItemsSnap = '';
export function saveItems(d: PublicAreaItem[]) {
  const json = JSON.stringify(d);
  if (json === lastItemsSnap) return;
  lastItemsSnap = json;
  localStorage.setItem(ITEMS_KEY, json);
  void pushItemsToCloud(d);
}

// ── Cloud sync ────────────────────────────────────────────────────────────
function nodeToDb(n: PublicAreaNode): any {
  return {
    id: n.id, name: n.name, name_he: n.nameHe ?? null, type: n.type,
    parent_id: n.parentId, order: n.order, archived: !!n.archived,
  };
}
function nodeFromDb(r: any): PublicAreaNode {
  return {
    id: r.id, name: r.name ?? '', nameHe: r.name_he ?? undefined,
    type: r.type, parentId: r.parent_id ?? null, order: r.order ?? 0,
    archived: !!r.archived,
  };
}
function itemToDb(i: PublicAreaItem): any {
  return {
    id: i.id, node_id: i.nodeId, zone_id: i.zoneId ?? null,
    item_name: i.itemName, spec: i.spec, category_id: i.categoryId,
    qty: i.qty, spare: i.spare, supplier_id: i.supplierId ?? null,
    unit_price_eur: i.unitPriceEur ?? null, status: i.status,
    ordered_qty: i.orderedQty, delivered_qty: i.deliveredQty,
    notes: i.notes, created_at: i.createdAt, updated_at: i.updatedAt,
  };
}
function itemFromDb(r: any): PublicAreaItem {
  return {
    id: r.id, nodeId: r.node_id, zoneId: r.zone_id ?? undefined,
    itemName: r.item_name ?? '', spec: r.spec ?? '',
    categoryId: r.category_id ?? '', qty: r.qty ?? 0, spare: r.spare ?? 0,
    supplierId: r.supplier_id ?? undefined,
    unitPriceEur: r.unit_price_eur ?? undefined,
    status: r.status ?? 'Planned',
    orderedQty: r.ordered_qty ?? 0, deliveredQty: r.delivered_qty ?? 0,
    notes: r.notes ?? '',
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

async function pushNodesToCloud(rows: PublicAreaNode[]) {
  try {
    const { data: existing } = await supabase.from('public_area_nodes').select('id');
    const cloudIds = new Set((existing ?? []).map(r => r.id));
    const localIds = new Set(rows.map(r => r.id));
    const toDelete = [...cloudIds].filter(id => !localIds.has(id));
    if (toDelete.length > 0) await supabase.from('public_area_nodes').delete().in('id', toDelete);
    if (rows.length > 0) await supabase.from('public_area_nodes').upsert(rows.map(nodeToDb));
  } catch (err) { console.error('[public_area_nodes] sync failed', err); }
}
async function pushItemsToCloud(rows: PublicAreaItem[]) {
  try {
    const { data: existing } = await supabase.from('public_area_items').select('id');
    const cloudIds = new Set((existing ?? []).map(r => r.id));
    const localIds = new Set(rows.map(r => r.id));
    const toDelete = [...cloudIds].filter(id => !localIds.has(id));
    if (toDelete.length > 0) await supabase.from('public_area_items').delete().in('id', toDelete);
    if (rows.length > 0) await supabase.from('public_area_items').upsert(rows.map(itemToDb));
  } catch (err) { console.error('[public_area_items] sync failed', err); }
}

export async function hydratePublicAreasFromCloud(): Promise<void> {
  try {
    const [nRes, iRes] = await Promise.all([
      supabase.from('public_area_nodes').select('*').order('order', { ascending: true }),
      supabase.from('public_area_items').select('*'),
    ]);
    if (nRes.error) throw nRes.error;
    if (iRes.error) throw iRes.error;
    const nodes = (nRes.data ?? []).map(nodeFromDb);
    const items = (iRes.data ?? []).map(itemFromDb);

    const cachedNodes = loadNodes();
    const cachedItems = loadItems();
    const firstHydrate = !localStorage.getItem(HYDRATED_FLAG);

    if (firstHydrate && nodes.length === 0 && cachedNodes.length > 0) {
      await pushNodesToCloud(cachedNodes);
      await pushItemsToCloud(cachedItems);
      localStorage.setItem(HYDRATED_FLAG, '1');
      return;
    }

    if (nodes.length === 0) {
      // Cloud is empty AND no local cache → seed locally + push.
      const seeded = buildSeed();
      lastNodesSnap = JSON.stringify(seeded);
      localStorage.setItem(NODES_KEY, lastNodesSnap);
      await pushNodesToCloud(seeded);
      localStorage.setItem(HYDRATED_FLAG, '1');
      nodeListeners.forEach(l => { try { l(seeded); } catch {} });
      return;
    }

    lastNodesSnap = JSON.stringify(nodes);
    lastItemsSnap = JSON.stringify(items);
    localStorage.setItem(NODES_KEY, lastNodesSnap);
    localStorage.setItem(ITEMS_KEY, lastItemsSnap);
    localStorage.setItem(HYDRATED_FLAG, '1');
    nodeListeners.forEach(l => { try { l(nodes); } catch {} });
    itemListeners.forEach(l => { try { l(items); } catch {} });
  } catch (err) {
    console.error('[publicAreas] hydrate failed', err);
  }
}

// ── Factory ───────────────────────────────────────────────────────────────
export function emptyItem(nodeId: string, categoryId = ''): PublicAreaItem {
  const now = new Date().toISOString();
  return {
    id: genItemId(),
    nodeId,
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

// ── Tree helpers ──────────────────────────────────────────────────────────
export function getChildren(nodes: PublicAreaNode[], parentId: string | null): PublicAreaNode[] {
  return nodes
    .filter(n => n.parentId === parentId && !n.archived)
    .sort((a, b) => a.order - b.order);
}

export function getDescendants(nodes: PublicAreaNode[], rootId: string): PublicAreaNode[] {
  const out: PublicAreaNode[] = [];
  const walk = (pid: string) => {
    nodes.filter(n => n.parentId === pid).forEach(c => {
      out.push(c);
      walk(c.id);
    });
  };
  walk(rootId);
  return out;
}

/**
 * Returns the set of node ids whose items count toward the given root's scope.
 * Includes the root itself plus all descendants.
 */
export function getScopeNodeIds(nodes: PublicAreaNode[], rootId: string): Set<string> {
  const ids = new Set<string>([rootId]);
  getDescendants(nodes, rootId).forEach(d => ids.add(d.id));
  return ids;
}

export function getNodeBreadcrumb(nodes: PublicAreaNode[], nodeId: string): PublicAreaNode[] {
  const map = new Map(nodes.map(n => [n.id, n]));
  const trail: PublicAreaNode[] = [];
  let cur = map.get(nodeId);
  while (cur) {
    trail.unshift(cur);
    cur = cur.parentId ? map.get(cur.parentId) : undefined;
  }
  return trail;
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

// ── Backwards-compat type aliases (no longer used by new UI) ──────────────
export type PublicAreaBuilding = PublicAreaNode;
export type PublicAreaZone = PublicAreaNode;
