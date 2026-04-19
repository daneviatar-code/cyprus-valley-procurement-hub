/**
 * Public Areas — Hierarchical Building → Zone → Items.
 * Three top-level views: Editor (tree + items table), By Supplier, By Category.
 * Synchronizes with the central public-areas localStorage store.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown, ChevronRight, Plus, Pencil, Trash2, Copy, Download, Search, X, FolderTree,
} from 'lucide-react';
import {
  PublicAreaBuilding, PublicAreaZone, PublicAreaItem,
  loadBuildings, loadZones, loadItems,
  saveBuildings, saveZones, saveItems,
  genBuildingId, genZoneId, emptyItem, computeItem, summarizeScope,
} from '@/data/publicAreasData';
import {
  ProcurementCategory, loadCategories,
  STANDARD_STATUSES, StandardStatus, eur,
} from '@/data/roomStandardsData';
import { Supplier, loadSuppliers } from '@/data/supplierData';

type View = 'editor' | 'bySupplier' | 'byCategory';

export default function PublicAreas(_: { masterData?: unknown; userData?: unknown; onUpdateItem?: unknown }) {
  const [buildings, setBuildings] = useState<PublicAreaBuilding[]>(() => loadBuildings());
  const [zones, setZones] = useState<PublicAreaZone[]>(() => loadZones());
  const [items, setItems] = useState<PublicAreaItem[]>(() => loadItems());
  const [categories] = useState<ProcurementCategory[]>(() => loadCategories());
  const [suppliers] = useState<Supplier[]>(() => loadSuppliers());

  const [view, setView] = useState<View>('editor');
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    loadBuildings().forEach(b => { init[b.id] = true; });
    return init;
  });
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [byCategoryFilter, setByCategoryFilter] = useState<string>('all');

  // Persist
  useEffect(() => { saveBuildings(buildings); }, [buildings]);
  useEffect(() => { saveZones(zones); }, [zones]);
  useEffect(() => { saveItems(items); }, [items]);

  // Auto-select first zone
  useEffect(() => {
    if (!selectedZoneId && !selectedBuildingId && zones.length > 0) {
      setSelectedZoneId(zones[0].id);
    }
  }, [selectedZoneId, selectedBuildingId, zones]);

  const selectedZone = zones.find(z => z.id === selectedZoneId) || null;
  const selectedBuilding = selectedZone
    ? buildings.find(b => b.id === selectedZone.buildingId)
    : buildings.find(b => b.id === selectedBuildingId) || null;

  const zoneItems = useMemo(
    () => selectedZoneId ? items.filter(i => i.zoneId === selectedZoneId) : [],
    [items, selectedZoneId],
  );

  // Scope summary: items based on view selection
  const summaryItems = useMemo(() => {
    if (view !== 'editor') return items;
    if (selectedZoneId) return zoneItems;
    if (selectedBuildingId) {
      const zIds = new Set(zones.filter(z => z.buildingId === selectedBuildingId).map(z => z.id));
      return items.filter(i => zIds.has(i.zoneId));
    }
    return items;
  }, [view, items, selectedZoneId, zoneItems, selectedBuildingId, zones]);

  const summaryZoneCount = useMemo(() => {
    if (view !== 'editor') return zones.length;
    if (selectedZoneId) return 1;
    if (selectedBuildingId) return zones.filter(z => z.buildingId === selectedBuildingId).length;
    return zones.length;
  }, [view, selectedZoneId, selectedBuildingId, zones]);

  const summary = summarizeScope(summaryItems, summaryZoneCount);

  // ── Tree filter ──
  const filteredZones = useMemo(() => {
    if (!search.trim()) return zones;
    const q = search.toLowerCase();
    return zones.filter(z =>
      z.name.toLowerCase().includes(q) || (z.nameHe || '').includes(q),
    );
  }, [zones, search]);

  // ── Building/Zone CRUD ──
  const addBuilding = () => {
    const name = prompt('Building name (English):');
    if (!name?.trim()) return;
    const nameHe = prompt('Hebrew name (optional):') || undefined;
    setBuildings([...buildings, {
      id: genBuildingId(), name: name.trim(), nameHe: nameHe?.trim() || undefined,
      order: buildings.length,
    }]);
  };
  const renameBuilding = (b: PublicAreaBuilding) => {
    const name = prompt('Rename building:', b.name);
    if (!name?.trim()) return;
    const nameHe = prompt('Hebrew name (optional):', b.nameHe || '') || undefined;
    setBuildings(buildings.map(x => x.id === b.id
      ? { ...x, name: name.trim(), nameHe: nameHe?.trim() || undefined } : x));
  };
  const deleteBuilding = (b: PublicAreaBuilding) => {
    const zIds = zones.filter(z => z.buildingId === b.id).map(z => z.id);
    if (!confirm(`Delete "${b.name}" and its ${zIds.length} zone(s)?`)) return;
    setBuildings(buildings.filter(x => x.id !== b.id));
    setZones(zones.filter(z => z.buildingId !== b.id));
    setItems(items.filter(i => !zIds.includes(i.zoneId)));
    if (selectedZone && zIds.includes(selectedZone.id)) setSelectedZoneId(null);
  };

  const addZone = (buildingId: string) => {
    const name = prompt('Zone name (English):');
    if (!name?.trim()) return;
    const nameHe = prompt('Hebrew name (optional):') || undefined;
    const order = zones.filter(z => z.buildingId === buildingId).length;
    const newZone: PublicAreaZone = {
      id: genZoneId(), buildingId, name: name.trim(),
      nameHe: nameHe?.trim() || undefined, order,
    };
    setZones([...zones, newZone]);
    setSelectedZoneId(newZone.id);
  };
  const renameZone = (z: PublicAreaZone) => {
    const name = prompt('Rename zone:', z.name);
    if (!name?.trim()) return;
    const nameHe = prompt('Hebrew name (optional):', z.nameHe || '') || undefined;
    setZones(zones.map(x => x.id === z.id
      ? { ...x, name: name.trim(), nameHe: nameHe?.trim() || undefined } : x));
  };
  const deleteZone = (z: PublicAreaZone) => {
    const count = items.filter(i => i.zoneId === z.id).length;
    if (!confirm(`Delete zone "${z.name}" and its ${count} item(s)?`)) return;
    setZones(zones.filter(x => x.id !== z.id));
    setItems(items.filter(i => i.zoneId !== z.id));
    if (selectedZoneId === z.id) setSelectedZoneId(null);
  };
  const duplicateZone = (z: PublicAreaZone) => {
    const newId = genZoneId();
    const newZone: PublicAreaZone = {
      ...z, id: newId, name: `${z.name} (copy)`,
      order: zones.filter(zz => zz.buildingId === z.buildingId).length,
    };
    const newItems = items
      .filter(i => i.zoneId === z.id)
      .map(i => ({ ...i, id: `pai_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, zoneId: newId }));
    setZones([...zones, newZone]);
    setItems([...items, ...newItems]);
    setSelectedZoneId(newId);
  };

  const moveZone = (z: PublicAreaZone, dir: -1 | 1) => {
    const sib = zones.filter(x => x.buildingId === z.buildingId).sort((a, b) => a.order - b.order);
    const idx = sib.findIndex(x => x.id === z.id);
    const swap = sib[idx + dir];
    if (!swap) return;
    setZones(zones.map(x => {
      if (x.id === z.id) return { ...x, order: swap.order };
      if (x.id === swap.id) return { ...x, order: z.order };
      return x;
    }));
  };

  // ── Item CRUD ──
  const addItem = () => {
    if (!selectedZoneId) return;
    setItems([...items, emptyItem(selectedZoneId)]);
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

  // ── CSV Export helpers ──
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
  const zoneName = (id: string) => {
    const z = zones.find(zz => zz.id === id);
    if (!z) return '';
    const b = buildings.find(bb => bb.id === z.buildingId);
    return `${b?.name || '?'} › ${z.name}`;
  };

  const exportZoneCsv = (z: PublicAreaZone) => {
    const rows: (string | number)[][] = [
      ['Item Name', 'Spec', 'Category', 'Qty', 'Spare', 'Total', 'Supplier', 'Unit Price €',
       'Line Cost €', 'Status', 'Ordered', 'Delivered', 'Outstanding', 'Notes'],
    ];
    items.filter(i => i.zoneId === z.id).forEach(i => {
      const c = computeItem(i);
      rows.push([
        i.itemName, i.spec, categoryName(i.categoryId), i.qty, i.spare, c.totalQty,
        supplierName(i.supplierId), i.unitPriceEur ?? '', c.lineCost, i.status,
        i.orderedQty, i.deliveredQty, c.outstandingQty, i.notes,
      ]);
    });
    downloadCsv(`public-area_${z.name.replace(/\s+/g,'-')}.csv`, rows);
  };
  const exportBuildingCsv = (b: PublicAreaBuilding) => {
    const zs = zones.filter(z => z.buildingId === b.id);
    const rows: (string | number)[][] = [
      ['Zone', 'Item Name', 'Spec', 'Category', 'Qty', 'Spare', 'Total', 'Supplier',
       'Unit Price €', 'Line Cost €', 'Status', 'Ordered', 'Delivered', 'Outstanding', 'Notes'],
    ];
    zs.forEach(z => {
      items.filter(i => i.zoneId === z.id).forEach(i => {
        const c = computeItem(i);
        rows.push([z.name, i.itemName, i.spec, categoryName(i.categoryId), i.qty, i.spare,
          c.totalQty, supplierName(i.supplierId), i.unitPriceEur ?? '', c.lineCost,
          i.status, i.orderedQty, i.deliveredQty, c.outstandingQty, i.notes]);
      });
    });
    downloadCsv(`public-area_${b.name.replace(/\s+/g,'-')}.csv`, rows);
  };
  const exportSupplierPo = (sup: Supplier, supItems: PublicAreaItem[]) => {
    const rows: (string | number)[][] = [
      ['PURCHASE ORDER'], ['Supplier', sup.name], ['Contact', sup.contactPerson],
      ['Email', sup.email], ['Date', new Date().toISOString().slice(0, 10)], [''],
      ['Zone', 'Item', 'Spec', 'Category', 'Qty Needed', 'Ordered', 'Delivered',
       'Outstanding', 'Unit Price €', 'Line Cost €', 'Status'],
    ];
    let total = 0;
    supItems.forEach(i => {
      const c = computeItem(i);
      total += c.lineCost;
      rows.push([zoneName(i.zoneId), i.itemName, i.spec, categoryName(i.categoryId),
        c.totalQty, i.orderedQty, i.deliveredQty, c.outstandingQty,
        i.unitPriceEur ?? '', c.lineCost, i.status]);
    });
    rows.push([''], ['', '', '', '', '', '', '', '', 'TOTAL €', total]);
    downloadCsv(`PO_${sup.name.replace(/\s+/g,'-')}_public-areas.csv`, rows);
  };

  // ── Layout ──
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <FolderTree className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold text-foreground">
            Public Areas <span className="text-muted-foreground text-sm font-normal">— שטחים ציבוריים</span>
          </h2>
          <span className="text-xs text-muted-foreground hidden md:inline">
            Building → Zone → Items hierarchy. Synced with the central procurement store.
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

      {/* Top summary bar */}
      <SummaryBar summary={summary} label={
        view !== 'editor' ? 'All Public Areas' :
        selectedZone ? `Zone: ${selectedZone.name}` :
        selectedBuilding ? `Building: ${selectedBuilding.name}` :
        'All Public Areas'
      } />

      {view === 'editor' && (
        <div className="grid grid-cols-12 gap-4">
          {/* Tree */}
          <div className="col-span-12 lg:col-span-3 bg-card border rounded-lg p-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Filter zones..."
                className="w-full h-8 rounded border bg-background pl-7 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent/50" />
            </div>
            <div className="space-y-0.5 max-h-[600px] overflow-y-auto">
              {buildings.sort((a, b) => a.order - b.order).map(b => {
                const bZones = filteredZones.filter(z => z.buildingId === b.id).sort((a, b) => a.order - b.order);
                const isExpanded = expanded[b.id] ?? true;
                return (
                  <div key={b.id} className="text-sm">
                    <div className="group flex items-center gap-1 px-1.5 py-1 rounded hover:bg-muted/60">
                      <button onClick={() => setExpanded({ ...expanded, [b.id]: !isExpanded })}
                        className="text-muted-foreground hover:text-foreground">
                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={() => { setSelectedBuildingId(b.id); setSelectedZoneId(null); }}
                        className="flex-1 text-left font-semibold text-foreground truncate">
                        {b.name}
                        {b.nameHe && <span className="ml-1 text-[10px] text-muted-foreground" dir="rtl">{b.nameHe}</span>}
                      </button>
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
                        <IconBtn title="Add Zone" onClick={() => addZone(b.id)}><Plus className="h-3 w-3" /></IconBtn>
                        <IconBtn title="Rename" onClick={() => renameBuilding(b)}><Pencil className="h-3 w-3" /></IconBtn>
                        <IconBtn title="Export CSV" onClick={() => exportBuildingCsv(b)}><Download className="h-3 w-3" /></IconBtn>
                        <IconBtn title="Delete" onClick={() => deleteBuilding(b)}><Trash2 className="h-3 w-3 text-destructive" /></IconBtn>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="ml-5 space-y-0.5 border-l pl-2">
                        {bZones.length === 0 && (
                          <div className="text-[11px] text-muted-foreground italic px-1.5 py-1">No zones</div>
                        )}
                        {bZones.map(z => {
                          const itemCount = items.filter(i => i.zoneId === z.id).length;
                          const isSel = selectedZoneId === z.id;
                          return (
                            <div key={z.id} className={`group flex items-center gap-1 px-1.5 py-1 rounded ${
                              isSel ? 'bg-accent/15 text-accent' : 'hover:bg-muted/60'
                            }`}>
                              <button onClick={() => { setSelectedZoneId(z.id); setSelectedBuildingId(null); }}
                                className="flex-1 text-left truncate text-xs">
                                {z.name}
                                {z.nameHe && <span className="ml-1 text-[10px] opacity-70" dir="rtl">{z.nameHe}</span>}
                                <span className="ml-1 text-[10px] text-muted-foreground">({itemCount})</span>
                              </button>
                              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
                                <IconBtn title="Move up" onClick={() => moveZone(z, -1)}>↑</IconBtn>
                                <IconBtn title="Move down" onClick={() => moveZone(z, 1)}>↓</IconBtn>
                                <IconBtn title="Duplicate" onClick={() => duplicateZone(z)}><Copy className="h-3 w-3" /></IconBtn>
                                <IconBtn title="Rename" onClick={() => renameZone(z)}><Pencil className="h-3 w-3" /></IconBtn>
                                <IconBtn title="Delete" onClick={() => deleteZone(z)}><Trash2 className="h-3 w-3 text-destructive" /></IconBtn>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={addBuilding}
              className="w-full inline-flex items-center justify-center gap-1 h-8 rounded border border-dashed text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <Plus className="h-3 w-3" /> Add Building
            </button>
          </div>

          {/* Right pane */}
          <div className="col-span-12 lg:col-span-9">
            {selectedZone ? (
              <ZoneItemsTable
                zone={selectedZone}
                building={selectedBuilding}
                items={zoneItems}
                categories={categories}
                suppliers={suppliers}
                onAdd={addItem}
                onUpdate={updateItem}
                onDelete={deleteItem}
                onDuplicateItem={duplicateItem}
                onExport={() => exportZoneCsv(selectedZone)}
                onRename={() => renameZone(selectedZone)}
                onDuplicateZone={() => duplicateZone(selectedZone)}
                onDeleteZone={() => deleteZone(selectedZone)}
              />
            ) : (
              <div className="bg-card border rounded-lg p-12 text-center text-muted-foreground">
                <FolderTree className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Select a zone from the tree, or click a building to see its summary.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'bySupplier' && (
        <BySupplierView
          items={items} suppliers={suppliers} categories={categories}
          zones={zones} buildings={buildings} onExport={exportSupplierPo}
        />
      )}

      {view === 'byCategory' && (
        <ByCategoryView
          items={items} categories={categories} suppliers={suppliers}
          zones={zones} buildings={buildings}
          filter={byCategoryFilter} setFilter={setByCategoryFilter}
        />
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────
function IconBtn({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...p}
      className="inline-flex items-center justify-center h-5 w-5 rounded text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground text-[10px]">
      {children}
    </button>
  );
}

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
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">{label}</div>
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

interface ZoneItemsTableProps {
  zone: PublicAreaZone;
  building: PublicAreaBuilding | null | undefined;
  items: PublicAreaItem[];
  categories: ProcurementCategory[];
  suppliers: Supplier[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<PublicAreaItem>) => void;
  onDelete: (id: string) => void;
  onDuplicateItem: (item: PublicAreaItem) => void;
  onExport: () => void;
  onRename: () => void;
  onDuplicateZone: () => void;
  onDeleteZone: () => void;
}
function ZoneItemsTable(p: ZoneItemsTableProps) {
  const th = 'px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-left whitespace-nowrap';
  const td = 'px-2 py-1.5 text-xs';
  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between gap-2 p-3 border-b bg-muted/30 flex-wrap">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">
            {p.building?.name} <span className="text-muted-foreground">›</span> {p.zone.name}
            {p.zone.nameHe && <span className="ml-2 text-xs text-muted-foreground" dir="rtl">{p.zone.nameHe}</span>}
          </div>
          <div className="text-[11px] text-muted-foreground">{p.items.length} item(s)</div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={p.onAdd} className="inline-flex items-center gap-1 h-7 px-2 rounded bg-accent text-accent-foreground text-xs font-medium hover:bg-accent/90">
            <Plus className="h-3 w-3" /> Add Item
          </button>
          <button onClick={p.onRename} className="inline-flex items-center gap-1 h-7 px-2 rounded border text-xs hover:bg-muted"><Pencil className="h-3 w-3" /> Rename</button>
          <button onClick={p.onDuplicateZone} className="inline-flex items-center gap-1 h-7 px-2 rounded border text-xs hover:bg-muted"><Copy className="h-3 w-3" /> Duplicate</button>
          <button onClick={p.onExport} className="inline-flex items-center gap-1 h-7 px-2 rounded border text-xs hover:bg-muted"><Download className="h-3 w-3" /> CSV</button>
          <button onClick={p.onDeleteZone} className="inline-flex items-center gap-1 h-7 px-2 rounded border text-xs text-destructive hover:bg-destructive/10"><Trash2 className="h-3 w-3" /> Delete</button>
        </div>
      </div>
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
                  <td className={td}><Num v={it.orderedQty} onChange={v => p.onUpdate(it.id, { orderedQty: Number(v) })} /></td>
                  <td className={td}><Num v={it.deliveredQty} onChange={v => p.onUpdate(it.id, { deliveredQty: Number(v) })} /></td>
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

// ── By Supplier ───────────────────────────────────────────────────────────
function BySupplierView({ items, suppliers, categories, zones, buildings, onExport }: {
  items: PublicAreaItem[]; suppliers: Supplier[]; categories: ProcurementCategory[];
  zones: PublicAreaZone[]; buildings: PublicAreaBuilding[];
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
  const zname = (zid: string) => {
    const z = zones.find(zz => zz.id === zid);
    const b = buildings.find(bb => bb.id === z?.buildingId);
    return `${b?.name || '?'} › ${z?.name || '?'}`;
  };
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
                      <th className="px-2 py-1.5 text-left text-[10px] uppercase text-muted-foreground">Zone</th>
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
                          <td className="px-2 py-1.5">{zname(i.zoneId)}</td>
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

// ── By Category ───────────────────────────────────────────────────────────
function ByCategoryView({ items, categories, suppliers, zones, buildings, filter, setFilter }: {
  items: PublicAreaItem[]; categories: ProcurementCategory[]; suppliers: Supplier[];
  zones: PublicAreaZone[]; buildings: PublicAreaBuilding[];
  filter: string; setFilter: (s: string) => void;
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
  const zname = (zid: string) => {
    const z = zones.find(zz => zz.id === zid);
    const b = buildings.find(bb => bb.id === z?.buildingId);
    return `${b?.name || '?'} › ${z?.name || '?'}`;
  };
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
                    <th className="px-2 py-1.5 text-left text-[10px] uppercase text-muted-foreground">Zone</th>
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
                        <td className="px-2 py-1.5">{zname(i.zoneId)}</td>
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
