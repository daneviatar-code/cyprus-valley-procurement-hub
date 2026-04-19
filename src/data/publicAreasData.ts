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

export const saveNodes = (d: PublicAreaNode[]) =>
  localStorage.setItem(NODES_KEY, JSON.stringify(d));

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

export const saveItems = (d: PublicAreaItem[]) =>
  localStorage.setItem(ITEMS_KEY, JSON.stringify(d));

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
