/**
 * Public Areas — Generic node tree (building / group / area) → Items.
 * Top-level: 7 nodes (C1, C2, Morning Garden, Reception, Pools,
 * Pool Restaurant & Bar + Roof, Lobbies). Items attach to any node;
 * convention is that they live on leaf nodes only.
 *
 * Three sub-views: Editor (tree + items table), By Supplier, By Category.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown, ChevronRight, Plus, Pencil, Trash2, Copy, Download, Search, X,
  FolderTree, Building2, MapPin, Folder, Paperclip,
} from 'lucide-react';
import {
  PublicAreaNode, NodeType, PublicAreaItem,
  loadNodes, loadItems, saveNodes, saveItems,
  genNodeId, emptyItem, computeItem, summarizeScope,
  getChildren, getScopeNodeIds, getNodeBreadcrumb,
} from '@/data/publicAreasData';
import {
  ProcurementCategory, loadCategories,
  STANDARD_STATUSES, StandardStatus, eur,
} from '@/data/roomStandardsData';
import { Supplier, loadSuppliers } from '@/data/supplierData';
import { PublicAreaPlan, loadPlans, savePlans } from '@/data/publicAreaPlansData';
import NodePlans from './NodePlans';

type View = 'editor' | 'bySupplier' | 'byCategory';

export default function PublicAreas(_: { masterData?: unknown; userData?: unknown; onUpdateItem?: unknown }) {
  const [nodes, setNodes] = useState<PublicAreaNode[]>(() => loadNodes());
  const [items, setItems] = useState<PublicAreaItem[]>(() => loadItems());
  const [categories] = useState<ProcurementCategory[]>(() => loadCategories());
  const [suppliers] = useState<Supplier[]>(() => loadSuppliers());
  const [plans, setPlans] = useState<PublicAreaPlan[]>(() => loadPlans());

  const [view, setView] = useState<View>('editor');
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    loadNodes().filter(n => n.parentId === null).forEach(n => { init[n.id] = true; });
    return init;
  });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [byCategoryFilter, setByCategoryFilter] = useState<string>('all');

  useEffect(() => { saveNodes(nodes); }, [nodes]);
  useEffect(() => { saveItems(items); }, [items]);
  useEffect(() => { savePlans(plans); }, [plans]);

  // Auto-select first leaf
  useEffect(() => {
    if (!selectedNodeId) {
      const leaf = nodes.find(n => n.type === 'area');
      if (leaf) setSelectedNodeId(leaf.id);
    }
  }, [selectedNodeId, nodes]);

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;
  const breadcrumb = selectedNode ? getNodeBreadcrumb(nodes, selectedNode.id) : [];

  // Items in scope of the current selection (node + all descendants)
  const scopeItems = useMemo(() => {
    if (!selectedNode) return items;
    const ids = getScopeNodeIds(nodes, selectedNode.id);
    return items.filter(i => ids.has(i.nodeId));
  }, [items, nodes, selectedNode]);

  // Items directly attached to selected node (only meaningful for leaves)
  const directItems = useMemo(
    () => selectedNodeId ? items.filter(i => i.nodeId === selectedNodeId) : [],
    [items, selectedNodeId],
  );

  const summaryItems = view === 'editor' ? scopeItems : items;
  const summaryNodeCount = useMemo(() => {
    if (view !== 'editor') return nodes.filter(n => n.type !== 'group').length;
    if (!selectedNode) return nodes.filter(n => n.type !== 'group').length;
    if (selectedNode.type === 'area') return 1;
    const desc = getScopeNodeIds(nodes, selectedNode.id);
    return Array.from(desc).map(id => nodes.find(n => n.id === id)).filter(n => n && n.type !== 'group').length;
  }, [view, selectedNode, nodes]);

  const summary = summarizeScope(summaryItems, summaryNodeCount);

  // Tree filter (matches node + ancestors so context stays visible)
  const visibleNodeIds = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    const matches = nodes.filter(n =>
      n.name.toLowerCase().includes(q) || (n.nameHe || '').includes(q),
    );
    const ids = new Set<string>();
    matches.forEach(m => {
      let cur: PublicAreaNode | undefined = m;
      while (cur) {
        ids.add(cur.id);
        cur = cur.parentId ? nodes.find(n => n.id === cur!.parentId) : undefined;
      }
    });
    return ids;
  }, [nodes, search]);

  // ── Node CRUD ──
  const addTopLevel = () => {
    const name = prompt('Top-level name (English):');
    if (!name?.trim()) return;
    const nameHe = prompt('Hebrew name (optional):') || undefined;
    const typeStr = prompt('Type — "building", "group", or "area":', 'area')?.trim().toLowerCase();
    const type: NodeType = (typeStr === 'building' || typeStr === 'group') ? typeStr as NodeType : 'area';
    const order = getChildren(nodes, null).length;
    setNodes([...nodes, {
      id: genNodeId(), name: name.trim(), nameHe: nameHe?.trim() || undefined,
      type, parentId: null, order,
    }]);
  };

  const addChildNode = (parent: PublicAreaNode) => {
    const name = prompt(`Add zone under "${parent.name}" (English):`);
    if (!name?.trim()) return;
    const nameHe = prompt('Hebrew name (optional):') || undefined;
    const order = getChildren(nodes, parent.id).length;
    const newNode: PublicAreaNode = {
      id: genNodeId(), name: name.trim(), nameHe: nameHe?.trim() || undefined,
      type: 'area', parentId: parent.id, order,
    };
    setNodes([...nodes, newNode]);
    setExpanded({ ...expanded, [parent.id]: true });
    setSelectedNodeId(newNode.id);
  };

  const renameNode = (n: PublicAreaNode) => {
    const name = prompt('Rename:', n.name);
    if (!name?.trim()) return;
    const nameHe = prompt('Hebrew name (optional):', n.nameHe || '') || undefined;
    setNodes(nodes.map(x => x.id === n.id
      ? { ...x, name: name.trim(), nameHe: nameHe?.trim() || undefined } : x));
  };

  const deleteNode = (n: PublicAreaNode) => {
    const descIds = new Set<string>([n.id]);
    const collect = (pid: string) => {
      nodes.filter(c => c.parentId === pid).forEach(c => { descIds.add(c.id); collect(c.id); });
    };
    collect(n.id);
    const itemCount = items.filter(i => descIds.has(i.nodeId)).length;
    const childCount = descIds.size - 1;
    if (!confirm(`Delete "${n.name}"${childCount ? ` and ${childCount} child node(s)` : ''}${itemCount ? ` and ${itemCount} item(s)` : ''}?`)) return;
    setNodes(nodes.filter(x => !descIds.has(x.id)));
    setItems(items.filter(i => !descIds.has(i.nodeId)));
    if (selectedNodeId && descIds.has(selectedNodeId)) setSelectedNodeId(null);
  };

  const duplicateNode = (n: PublicAreaNode) => {
    // Deep clone n + descendants and remap ids; copy items too.
    const idMap = new Map<string, string>();
    const cloneTree = (src: PublicAreaNode, newParentId: string | null, order: number): PublicAreaNode[] => {
      const newId = genNodeId();
      idMap.set(src.id, newId);
      const clone: PublicAreaNode = {
        ...src, id: newId, parentId: newParentId, order,
        name: newParentId === n.parentId ? `${src.name} (copy)` : src.name,
      };
      const childClones = getChildren(nodes, src.id).flatMap((c, idx) => cloneTree(c, newId, idx));
      return [clone, ...childClones];
    };
    const siblingsOrder = getChildren(nodes, n.parentId).length;
    const newSubtree = cloneTree(n, n.parentId, siblingsOrder);
    const newItems: PublicAreaItem[] = [];
    idMap.forEach((newId, oldId) => {
      items.filter(i => i.nodeId === oldId).forEach(i => {
        newItems.push({
          ...i,
          id: `pai_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          nodeId: newId,
        });
      });
    });
    setNodes([...nodes, ...newSubtree]);
    setItems([...items, ...newItems]);
    setSelectedNodeId(newSubtree[0].id);
  };

  const moveNode = (n: PublicAreaNode, dir: -1 | 1) => {
    const sib = getChildren(nodes, n.parentId);
    const idx = sib.findIndex(x => x.id === n.id);
    const swap = sib[idx + dir];
    if (!swap) return;
    setNodes(nodes.map(x => {
      if (x.id === n.id) return { ...x, order: swap.order };
      if (x.id === swap.id) return { ...x, order: n.order };
      return x;
    }));
  };

  // ── Item CRUD ──
  const addItem = () => {
    if (!selectedNodeId) return;
    setItems([...items, emptyItem(selectedNodeId)]);
  };
  const updateItem = (id: string, patch: Partial<PublicAreaItem>) => {
    setItems(items.map(i => i.id === id ? { ...i, ...patch, updatedAt: new Date().toISOString() } : i));
  };
  const deleteItem = (id: string) => {
    if (!confirm('Delete item?')) return;
    setItems(items.filter(i => i.id !== id));
  };
  const duplicateItem = (item: PublicAreaItem) => {
    setItems([...items, { ...item, id: `pai_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, itemName: `${item.itemName} (copy)` }]);
  };

  // ── CSV helpers ──
  const csvEscape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const downloadCsv = (filename: string, rows: (string | number)[][]) => {
    const csv = rows.map(r => r.map(csvEscape).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };
  const supplierName = (id?: string) => suppliers.find(s => s.id === id)?.name || '';
  const categoryName = (id?: string) => {
    const c = categories.find(x => x.id === id); return c ? `${c.nameEn} / ${c.nameHe}` : '';
  };
  const nodePath = (id: string) =>
    getNodeBreadcrumb(nodes, id).map(n => n.name).join(' › ');

  const planFilesFor = (nodeId: string) =>
    plans.filter(p => p.nodeId === nodeId && !p.archived)
      .sort((a, b) => a.order - b.order)
      .map(p => p.fileName).join(' | ');

  const exportNodeCsv = (n: PublicAreaNode) => {
    const ids = getScopeNodeIds(nodes, n.id);
    const scope = items.filter(i => ids.has(i.nodeId));
    const rows: (string | number)[][] = [
      ['Path', 'Item Name', 'Spec', 'Category', 'Qty', 'Spare', 'Total', 'Supplier',
       'Unit Price €', 'Line Cost €', 'Status', 'Ordered', 'Delivered', 'Outstanding', 'Notes', 'Plan Files'],
    ];
    scope.forEach(i => {
      const c = computeItem(i);
      rows.push([
        nodePath(i.nodeId), i.itemName, i.spec, categoryName(i.categoryId), i.qty, i.spare,
        c.totalQty, supplierName(i.supplierId), i.unitPriceEur ?? '', c.lineCost,
        i.status, i.orderedQty, i.deliveredQty, c.outstandingQty, i.notes,
        planFilesFor(i.nodeId),
      ]);
    });
    downloadCsv(`public-area_${n.name.replace(/\s+/g, '-')}.csv`, rows);
  };

  const exportSupplierPo = (sup: Supplier, supItems: PublicAreaItem[]) => {
    const rows: (string | number)[][] = [
      ['PURCHASE ORDER'], ['Supplier', sup.name], ['Contact', sup.contactPerson],
      ['Email', sup.email], ['Date', new Date().toISOString().slice(0, 10)], [''],
      ['Path', 'Item', 'Spec', 'Category', 'Qty Needed', 'Ordered', 'Delivered',
       'Outstanding', 'Unit Price €', 'Line Cost €', 'Status'],
    ];
    let total = 0;
    supItems.forEach(i => {
      const c = computeItem(i);
      total += c.lineCost;
      rows.push([nodePath(i.nodeId), i.itemName, i.spec, categoryName(i.categoryId),
        c.totalQty, i.orderedQty, i.deliveredQty, c.outstandingQty,
        i.unitPriceEur ?? '', c.lineCost, i.status]);
    });
    rows.push([''], ['', '', '', '', '', '', '', '', 'TOTAL €', total]);
    downloadCsv(`PO_${sup.name.replace(/\s+/g, '-')}_public-areas.csv`, rows);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <FolderTree className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold text-foreground">
            Public Areas <span className="text-muted-foreground text-sm font-normal">— שטחים ציבוריים</span>
          </h2>
          <span className="text-xs text-muted-foreground hidden md:inline">
            Building / Group / Area → Items hierarchy.
          </span>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          {(['editor', 'bySupplier', 'byCategory'] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                view === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {v === 'editor' ? 'Editor' : v === 'bySupplier' ? 'By Supplier' : 'By Category'}
            </button>
          ))}
        </div>
      </div>

      <SummaryBar summary={summary} label={
        view !== 'editor' ? 'All Public Areas' :
        selectedNode ? breadcrumb.map(n => n.name).join(' › ') : 'All Public Areas'
      } />

      {view === 'editor' && (
        <div className="grid grid-cols-12 gap-4">
          {/* Tree */}
          <div className="col-span-12 lg:col-span-3 bg-card border rounded-lg p-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Filter nodes..."
                className="w-full h-8 rounded border bg-background pl-7 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent/50" />
            </div>
            <div className="space-y-0.5 max-h-[600px] overflow-y-auto">
              {getChildren(nodes, null).map(top =>
                <TreeNodeRow
                  key={top.id} node={top} depth={0}
                  nodes={nodes} items={items} plans={plans}
                  expanded={expanded} setExpanded={setExpanded}
                  selectedNodeId={selectedNodeId} setSelectedNodeId={setSelectedNodeId}
                  visibleNodeIds={visibleNodeIds}
                  onAddChild={addChildNode} onRename={renameNode} onDelete={deleteNode}
                  onDuplicate={duplicateNode} onExport={exportNodeCsv} onMove={moveNode}
                />
              )}
            </div>
            <button onClick={addTopLevel}
              className="w-full inline-flex items-center justify-center gap-1 h-8 rounded border border-dashed text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <Plus className="h-3 w-3" /> Add Top-Level
            </button>
          </div>

          {/* Right pane */}
          <div className="col-span-12 lg:col-span-9">
            {selectedNode ? (
              <NodeWorkspace
                node={selectedNode} breadcrumb={breadcrumb}
                directItems={directItems}
                categories={categories} suppliers={suppliers} nodes={nodes}
                plans={plans}
                onPlansChange={setPlans}
                onAddItem={addItem} onUpdateItem={updateItem} onDeleteItem={deleteItem}
                onDuplicateItem={duplicateItem}
                onAddChild={() => addChildNode(selectedNode)}
                onRename={() => renameNode(selectedNode)}
                onDuplicate={() => duplicateNode(selectedNode)}
                onDelete={() => deleteNode(selectedNode)}
                onExport={() => exportNodeCsv(selectedNode)}
              />
            ) : (
              <div className="bg-card border rounded-lg p-12 text-center text-muted-foreground">
                <FolderTree className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Select a node from the tree to view or edit its items.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'bySupplier' && (
        <BySupplierView
          items={items} suppliers={suppliers} categories={categories}
          nodes={nodes} onExport={exportSupplierPo}
        />
      )}

      {view === 'byCategory' && (
        <ByCategoryView
          items={items} categories={categories} suppliers={suppliers}
          nodes={nodes} filter={byCategoryFilter} setFilter={setByCategoryFilter}
        />
      )}
    </div>
  );
}

// ── Tree row ─────────────────────────────────────────────────────────────
const NODE_ICON: Record<NodeType, React.ReactNode> = {
  building: <Building2 className="h-3.5 w-3.5 text-primary" />,
  group: <Folder className="h-3.5 w-3.5 text-accent" />,
  area: <MapPin className="h-3.5 w-3.5 text-muted-foreground" />,
};

interface TreeNodeRowProps {
  node: PublicAreaNode;
  depth: number;
  nodes: PublicAreaNode[];
  items: PublicAreaItem[];
  plans: PublicAreaPlan[];
  expanded: Record<string, boolean>;
  setExpanded: (e: Record<string, boolean>) => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string) => void;
  visibleNodeIds: Set<string> | null;
  onAddChild: (n: PublicAreaNode) => void;
  onRename: (n: PublicAreaNode) => void;
  onDelete: (n: PublicAreaNode) => void;
  onDuplicate: (n: PublicAreaNode) => void;
  onExport: (n: PublicAreaNode) => void;
  onMove: (n: PublicAreaNode, dir: -1 | 1) => void;
}
function TreeNodeRow(p: TreeNodeRowProps) {
  const { node, depth, nodes, items, plans, visibleNodeIds } = p;
  if (visibleNodeIds && !visibleNodeIds.has(node.id)) return null;
  const children = getChildren(nodes, node.id);
  const isOpen = p.expanded[node.id] ?? true;
  const isSel = p.selectedNodeId === node.id;
  const itemCount = items.filter(i => i.nodeId === node.id).length;
  const planCount = plans.filter(p => p.nodeId === node.id && !p.archived).length;
  const canHaveChildren = node.type !== 'area';

  return (
    <div className="text-sm">
      <div className={`group flex items-center gap-1 px-1 py-1 rounded ${
        isSel ? 'bg-accent/15 text-accent' : 'hover:bg-muted/60'
      }`} style={{ paddingLeft: 4 + depth * 12 }}>
        {children.length > 0 ? (
          <button onClick={() => p.setExpanded({ ...p.expanded, [node.id]: !isOpen })}
            className="text-muted-foreground hover:text-foreground">
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : <span className="w-3.5" />}
        <span className="shrink-0">{NODE_ICON[node.type]}</span>
        <button onClick={() => p.setSelectedNodeId(node.id)}
          className={`flex-1 text-left truncate text-xs ${node.type !== 'area' ? 'font-semibold' : ''}`}>
          {node.name}
          {node.nameHe && <span className="ml-1 text-[10px] opacity-70" dir="rtl">{node.nameHe}</span>}
          {itemCount > 0 && <span className="ml-1 text-[10px] text-muted-foreground">({itemCount})</span>}
          {planCount > 0 && (
            <span className="ml-1 inline-flex items-center" title={`${planCount} plan(s) attached`}>
              <Paperclip className="h-3 w-3 text-accent" />
            </span>
          )}
        </button>
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
          <IconBtn title="Move up" onClick={() => p.onMove(node, -1)}>↑</IconBtn>
          <IconBtn title="Move down" onClick={() => p.onMove(node, 1)}>↓</IconBtn>
          {canHaveChildren && <IconBtn title="Add Zone" onClick={() => p.onAddChild(node)}><Plus className="h-3 w-3" /></IconBtn>}
          <IconBtn title="Duplicate" onClick={() => p.onDuplicate(node)}><Copy className="h-3 w-3" /></IconBtn>
          <IconBtn title="Rename" onClick={() => p.onRename(node)}><Pencil className="h-3 w-3" /></IconBtn>
          <IconBtn title="Export CSV" onClick={() => p.onExport(node)}><Download className="h-3 w-3" /></IconBtn>
          <IconBtn title="Delete" onClick={() => p.onDelete(node)}><Trash2 className="h-3 w-3 text-destructive" /></IconBtn>
        </div>
      </div>
      {isOpen && children.length > 0 && (
        <div>
          {children.map(c => <TreeNodeRow key={c.id} {...p} node={c} depth={depth + 1} />)}
        </div>
      )}
      {isOpen && canHaveChildren && children.length === 0 && (
        <div className="text-[11px] text-muted-foreground italic px-1.5 py-1"
          style={{ paddingLeft: 18 + depth * 12 }}>No zones</div>
      )}
    </div>
  );
}

// ── IconBtn ──
function IconBtn({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...p}
      className="inline-flex items-center justify-center h-5 w-5 rounded text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground text-[10px]">
      {children}
    </button>
  );
}

// ── Summary bar ──
function SummaryBar({ summary, label }: { summary: ReturnType<typeof summarizeScope>; label: string }) {
  const cells = [
    { k: 'Zones', v: summary.numZones.toString() },
    { k: 'Items', v: summary.numItems.toString() },
    { k: 'Total Qty', v: summary.totalQty.toLocaleString() },
    { k: 'Budget', v: eur(summary.totalBudget) },
    { k: 'Ordered', v: eur(summary.orderedValue) },
    { k: 'Delivered', v: eur(summary.deliveredValue) },
    { k: 'Outstanding', v: eur(summary.outstandingValue), highlight: summary.outstandingValue > 0 },
  ];
  return (
    <div className="bg-card border rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 truncate">{label}</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {cells.map(c => (
          <div key={c.k}>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{c.k}</div>
            <div className={`text-sm font-bold ${c.highlight ? 'text-destructive' : 'text-foreground'}`}>{c.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Node workspace ───────────────────────────────────────────────────────
interface NodeWorkspaceProps {
  node: PublicAreaNode;
  breadcrumb: PublicAreaNode[];
  directItems: PublicAreaItem[];
  categories: ProcurementCategory[];
  suppliers: Supplier[];
  nodes: PublicAreaNode[];
  onAddItem: () => void;
  onUpdateItem: (id: string, patch: Partial<PublicAreaItem>) => void;
  onDeleteItem: (id: string) => void;
  onDuplicateItem: (item: PublicAreaItem) => void;
  onAddChild: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onExport: () => void;
}
function NodeWorkspace(p: NodeWorkspaceProps) {
  const isContainer = p.node.type !== 'area';
  const childCount = getChildren(p.nodes, p.node.id).length;

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between gap-2 p-3 border-b bg-muted/30 flex-wrap">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
            {NODE_ICON[p.node.type]}
            {p.breadcrumb.map((n, i) => (
              <span key={n.id} className={i === p.breadcrumb.length - 1 ? '' : 'text-muted-foreground'}>
                {i > 0 && <span className="mx-1">›</span>}{n.name}
              </span>
            ))}
            {p.node.nameHe && <span className="ml-2 text-xs text-muted-foreground" dir="rtl">{p.node.nameHe}</span>}
            <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] uppercase font-medium bg-muted text-muted-foreground">
              {p.node.type}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {isContainer ? `${childCount} child node(s) · ` : ''}{p.directItems.length} item(s)
          </div>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {isContainer && (
            <button onClick={p.onAddChild} className="inline-flex items-center gap-1 h-7 px-2 rounded bg-accent text-accent-foreground text-xs font-medium hover:bg-accent/90">
              <Plus className="h-3 w-3" /> Add Zone
            </button>
          )}
          <button onClick={p.onAddItem} className={`inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium ${
            isContainer ? 'border hover:bg-muted' : 'bg-accent text-accent-foreground hover:bg-accent/90'
          }`}>
            <Plus className="h-3 w-3" /> Add Item
          </button>
          <button onClick={p.onRename} className="inline-flex items-center gap-1 h-7 px-2 rounded border text-xs hover:bg-muted"><Pencil className="h-3 w-3" /> Rename</button>
          <button onClick={p.onDuplicate} className="inline-flex items-center gap-1 h-7 px-2 rounded border text-xs hover:bg-muted"><Copy className="h-3 w-3" /> Duplicate</button>
          <button onClick={p.onExport} className="inline-flex items-center gap-1 h-7 px-2 rounded border text-xs hover:bg-muted"><Download className="h-3 w-3" /> CSV</button>
          <button onClick={p.onDelete} className="inline-flex items-center gap-1 h-7 px-2 rounded border text-xs text-destructive hover:bg-destructive/10"><Trash2 className="h-3 w-3" /> Delete</button>
        </div>
      </div>

      {isContainer && childCount > 0 && p.directItems.length === 0 && (
        <div className="px-4 py-3 bg-accent/5 border-b text-[11px] text-muted-foreground">
          This is a {p.node.type}. Items typically live on its child zones — select one from the tree.
        </div>
      )}

      <ItemsTable
        items={p.directItems}
        categories={p.categories}
        suppliers={p.suppliers}
        onUpdate={p.onUpdateItem}
        onDelete={p.onDeleteItem}
        onDuplicateItem={p.onDuplicateItem}
        onAdd={p.onAddItem}
      />
    </div>
  );
}

// ── Items table ──
interface ItemsTableProps {
  items: PublicAreaItem[];
  categories: ProcurementCategory[];
  suppliers: Supplier[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<PublicAreaItem>) => void;
  onDelete: (id: string) => void;
  onDuplicateItem: (item: PublicAreaItem) => void;
}
function ItemsTable(p: ItemsTableProps) {
  const th = 'px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-left whitespace-nowrap';
  const td = 'px-2 py-1.5 text-xs';
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-muted/50 border-b">
          <tr>
            <th className={th}>Item</th>
            <th className={th}>Spec</th>
            <th className={th}>Category</th>
            <th className={`${th} text-right`}>Qty</th>
            <th className={`${th} text-right`}>Spare</th>
            <th className={`${th} text-right`}>Total</th>
            <th className={th}>Supplier</th>
            <th className={`${th} text-right`}>Unit €</th>
            <th className={`${th} text-right`}>Line €</th>
            <th className={th}>Status</th>
            <th className={`${th} text-right`}>Ord.</th>
            <th className={`${th} text-right`}>Del.</th>
            <th className={`${th} text-right`}>Out.</th>
            <th className={th}>Notes</th>
            <th className={th}></th>
          </tr>
        </thead>
        <tbody>
          {p.items.length === 0 && (
            <tr><td colSpan={15} className="px-3 py-10 text-center text-muted-foreground text-sm">
              No items yet. Click <strong>Add Item</strong> to start.
            </td></tr>
          )}
          {p.items.map(it => {
            const c = computeItem(it);
            return (
              <tr key={it.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className={td}><Inp v={it.itemName} onChange={v => p.onUpdate(it.id, { itemName: v })} w="w-32" /></td>
                <td className={td}><Inp v={it.spec} onChange={v => p.onUpdate(it.id, { spec: v })} w="w-28" /></td>
                <td className={td}>
                  <select value={it.categoryId} onChange={e => p.onUpdate(it.id, { categoryId: e.target.value })}
                    className="h-6 rounded border bg-background px-1 text-xs w-32">
                    <option value="">—</option>
                    {p.categories.filter(c => !c.archived).sort((a, b) => a.order - b.order).map(c => (
                      <option key={c.id} value={c.id}>{c.nameEn}</option>
                    ))}
                  </select>
                </td>
                <td className={td}><Num v={it.qty} onChange={v => p.onUpdate(it.id, { qty: Number(v) || 0 })} /></td>
                <td className={td}><Num v={it.spare} onChange={v => p.onUpdate(it.id, { spare: Number(v) || 0 })} /></td>
                <td className={`${td} text-right font-mono font-semibold text-accent`}>{c.totalQty}</td>
                <td className={td}>
                  <select value={it.supplierId || ''} onChange={e => p.onUpdate(it.id, { supplierId: e.target.value || undefined })}
                    className="h-6 rounded border bg-background px-1 text-xs w-28">
                    <option value="">—</option>
                    {p.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </td>
                <td className={td}><Num v={it.unitPriceEur ?? ''} onChange={v => p.onUpdate(it.id, { unitPriceEur: v === '' ? undefined : Number(v) })} step="0.01" w="w-20" /></td>
                <td className={`${td} text-right font-mono`}>{c.lineCost ? eur(c.lineCost) : '—'}</td>
                <td className={td}>
                  <select value={it.status} onChange={e => p.onUpdate(it.id, { status: e.target.value as StandardStatus })}
                    className="h-6 rounded border bg-background px-1 text-xs w-32">
                    {STANDARD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className={td}><Num v={it.orderedQty} onChange={v => p.onUpdate(it.id, { orderedQty: Number(v) || 0 })} /></td>
                <td className={td}><Num v={it.deliveredQty} onChange={v => p.onUpdate(it.id, { deliveredQty: Number(v) || 0 })} /></td>
                <td className={`${td} text-right font-mono ${c.outstandingQty > 0 ? 'text-destructive' : 'text-success'}`}>{c.outstandingQty}</td>
                <td className={td}><Inp v={it.notes} onChange={v => p.onUpdate(it.id, { notes: v })} w="w-28" /></td>
                <td className={td}>
                  <div className="flex items-center gap-0.5">
                    <IconBtn title="Duplicate" onClick={() => p.onDuplicateItem(it)}><Copy className="h-3 w-3" /></IconBtn>
                    <IconBtn title="Delete" onClick={() => p.onDelete(it.id)}><Trash2 className="h-3 w-3 text-destructive" /></IconBtn>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Inp({ v, onChange, w = 'w-24' }: { v: string; onChange: (v: string) => void; w?: string }) {
  return <input value={v} onChange={e => onChange(e.target.value)}
    className={`h-6 ${w} rounded border bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent/50`} />;
}
function Num({ v, onChange, step, w = 'w-14' }: { v: number | string; onChange: (v: number | string) => void; step?: string; w?: string }) {
  return <input type="number" step={step} value={v} onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
    className={`h-6 ${w} rounded border bg-background px-1.5 text-xs text-right font-mono focus:outline-none focus:ring-1 focus:ring-accent/50`} />;
}

// ── By Supplier ──
function BySupplierView({ items, suppliers, categories, nodes, onExport }: {
  items: PublicAreaItem[]; suppliers: Supplier[]; categories: ProcurementCategory[];
  nodes: PublicAreaNode[];
  onExport: (sup: Supplier, items: PublicAreaItem[]) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const grouped = useMemo(() => {
    const map = new Map<string, PublicAreaItem[]>();
    items.forEach(i => {
      const key = i.supplierId || '__none__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(i);
    });
    return map;
  }, [items]);
  const supName = (id: string) => id === '__none__' ? '— Unassigned —' : suppliers.find(s => s.id === id)?.name || `(deleted: ${id})`;
  const path = (nid: string) => getNodeBreadcrumb(nodes, nid).map(n => n.name).join(' › ');
  const cname = (cid: string) => categories.find(c => c.id === cid)?.nameEn || '—';

  if (grouped.size === 0) return <Empty msg="No public-area items defined yet." />;

  return (
    <div className="space-y-2">
      {Array.from(grouped.entries()).map(([sid, sItems]) => {
        const isOpen = openId === sid;
        const totalCost = sItems.reduce((s, i) => s + computeItem(i).lineCost, 0);
        const totalQty = sItems.reduce((s, i) => s + computeItem(i).totalQty, 0);
        const totalDel = sItems.reduce((s, i) => s + (i.deliveredQty || 0), 0);
        const sup = suppliers.find(s => s.id === sid);
        return (
          <div key={sid} className="bg-card border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 p-3 hover:bg-muted/40 cursor-pointer" onClick={() => setOpenId(isOpen ? null : sid)}>
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <div className="flex-1">
                <div className="text-sm font-semibold">{supName(sid)}</div>
                <div className="text-[11px] text-muted-foreground">{sItems.length} items · Qty {totalQty} · Delivered {totalDel}</div>
              </div>
              <div className="text-sm font-bold text-accent">{eur(totalCost)}</div>
              {sup && (
                <button onClick={e => { e.stopPropagation(); onExport(sup, sItems); }}
                  className="inline-flex items-center gap-1 h-7 px-2 rounded border text-xs hover:bg-muted">
                  <Download className="h-3 w-3" /> Export PO
                </button>
              )}
            </div>
            {isOpen && (
              <div className="border-t overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="px-2 py-1.5 text-left text-[10px] uppercase text-muted-foreground">Path</th>
                      <th className="px-2 py-1.5 text-left text-[10px] uppercase text-muted-foreground">Item</th>
                      <th className="px-2 py-1.5 text-left text-[10px] uppercase text-muted-foreground">Category</th>
                      <th className="px-2 py-1.5 text-right text-[10px] uppercase text-muted-foreground">Qty</th>
                      <th className="px-2 py-1.5 text-right text-[10px] uppercase text-muted-foreground">Ord.</th>
                      <th className="px-2 py-1.5 text-right text-[10px] uppercase text-muted-foreground">Del.</th>
                      <th className="px-2 py-1.5 text-right text-[10px] uppercase text-muted-foreground">Line €</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sItems.map(i => {
                      const c = computeItem(i);
                      return (
                        <tr key={i.id} className="border-t">
                          <td className="px-2 py-1.5">{path(i.nodeId)}</td>
                          <td className="px-2 py-1.5 font-medium">{i.itemName || '—'}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">{cname(i.categoryId)}</td>
                          <td className="px-2 py-1.5 text-right font-mono">{c.totalQty}</td>
                          <td className="px-2 py-1.5 text-right font-mono">{i.orderedQty}</td>
                          <td className="px-2 py-1.5 text-right font-mono">{i.deliveredQty}</td>
                          <td className="px-2 py-1.5 text-right font-mono">{eur(c.lineCost)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── By Category ──
function ByCategoryView({ items, categories, suppliers, nodes, filter, setFilter }: {
  items: PublicAreaItem[]; categories: ProcurementCategory[]; suppliers: Supplier[];
  nodes: PublicAreaNode[]; filter: string; setFilter: (s: string) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, PublicAreaItem[]>();
    items.forEach(i => {
      const key = i.categoryId || '__none__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(i);
    });
    return map;
  }, [items]);
  const cname = (cid: string) => {
    if (cid === '__none__') return '— Uncategorized —';
    const c = categories.find(x => x.id === cid);
    return c ? `${c.nameEn} / ${c.nameHe}` : `(deleted)`;
  };
  const path = (nid: string) => getNodeBreadcrumb(nodes, nid).map(n => n.name).join(' › ');
  const sname = (id?: string) => suppliers.find(s => s.id === id)?.name || '—';

  const visible = filter === 'all' ? Array.from(grouped.entries()) :
    grouped.has(filter) ? [[filter, grouped.get(filter)!] as [string, PublicAreaItem[]]] : [];

  if (grouped.size === 0) return <Empty msg="No public-area items defined yet." />;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground">Filter category:</span>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="h-8 rounded border bg-background px-2 text-xs">
          <option value="all">All categories</option>
          {Array.from(grouped.keys()).map(k => <option key={k} value={k}>{cname(k)}</option>)}
        </select>
      </div>
      {visible.map(([cid, cItems]) => {
        const totalCost = cItems.reduce((s, i) => s + computeItem(i).lineCost, 0);
        const totalQty = cItems.reduce((s, i) => s + computeItem(i).totalQty, 0);
        const out = cItems.reduce((s, i) => s + computeItem(i).outstandingQty, 0);
        return (
          <div key={cid} className="bg-card border rounded-lg overflow-hidden">
            <div className="flex items-center gap-3 p-3 border-b bg-muted/30">
              <div className="flex-1">
                <div className="text-sm font-semibold">{cname(cid)}</div>
                <div className="text-[11px] text-muted-foreground">{cItems.length} items · Qty {totalQty}</div>
              </div>
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                out > 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
              }`}>
                {out > 0 ? `${out} outstanding` : 'All delivered'}
              </span>
              <div className="text-sm font-bold text-accent">{eur(totalCost)}</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/20">
                  <tr>
                    <th className="px-2 py-1.5 text-left text-[10px] uppercase text-muted-foreground">Path</th>
                    <th className="px-2 py-1.5 text-left text-[10px] uppercase text-muted-foreground">Item</th>
                    <th className="px-2 py-1.5 text-left text-[10px] uppercase text-muted-foreground">Supplier</th>
                    <th className="px-2 py-1.5 text-right text-[10px] uppercase text-muted-foreground">Qty</th>
                    <th className="px-2 py-1.5 text-right text-[10px] uppercase text-muted-foreground">Del.</th>
                    <th className="px-2 py-1.5 text-right text-[10px] uppercase text-muted-foreground">Out.</th>
                    <th className="px-2 py-1.5 text-right text-[10px] uppercase text-muted-foreground">Line €</th>
                  </tr>
                </thead>
                <tbody>
                  {cItems.map(i => {
                    const c = computeItem(i);
                    return (
                      <tr key={i.id} className="border-t">
                        <td className="px-2 py-1.5">{path(i.nodeId)}</td>
                        <td className="px-2 py-1.5 font-medium">{i.itemName || '—'}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{sname(i.supplierId)}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{c.totalQty}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{i.deliveredQty}</td>
                        <td className={`px-2 py-1.5 text-right font-mono ${c.outstandingQty > 0 ? 'text-destructive' : 'text-success'}`}>{c.outstandingQty}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{eur(c.lineCost)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="bg-card border rounded-lg p-12 text-center text-muted-foreground">
      <X className="h-8 w-8 mx-auto mb-2 opacity-30" />
      <p className="text-sm">{msg}</p>
    </div>
  );
}
