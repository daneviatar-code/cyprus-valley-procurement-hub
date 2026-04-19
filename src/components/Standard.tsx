/**
 * Standard — top-level tab.
 * Per-apartment-type procurement standard list, organized by category.
 *
 * Data layer: reuses roomStandardsData store (procurementCategories +
 * roomStandards + suppliers) so every change here propagates to Room
 * Standards, By Room Size, By Item, dashboards, etc.
 *
 * Scope: residential apartment types only (studio / 1br / 2br / 3br / 4br).
 * Hebrew is the primary label; English shown as secondary.
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ProcurementCategory, CategoryScope, loadCategories, saveCategories, genCategoryId,
  RoomStandard, StandardStatus, STANDARD_STATUSES, loadStandards, saveStandards,
  emptyStandard, computeStandard, eur,
} from '@/data/roomStandardsData';
import {
  RoomSize, RESIDENTIAL_ROOM_SIZES, ROOM_SIZE_LABELS, countUnitsByRoomSize,
} from '@/data/masterData';
import { Supplier, loadSuppliers } from '@/data/supplierData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Copy, Trash2, Download, HelpCircle, ChevronRight, ChevronDown, Pencil } from 'lucide-react';

type SubView = 'byApartment' | 'byCategory' | 'hotelTotals';

const APARTMENT_LABELS_HE: Record<string, string> = {
  studio: 'סטודיו',
  '1br': 'דירת חדר',
  '2br': 'דירת 2 חדרים',
  '3br': 'דירת 3 חדרים',
  '4br': 'דירת 4 חדרים',
};

const STATUS_COLORS: Record<StandardStatus, string> = {
  Planned: 'bg-muted text-muted-foreground',
  Quoted: 'bg-accent/20 text-accent-foreground',
  Ordered: 'bg-primary/15 text-primary',
  'Partially Delivered': 'bg-yellow-100 text-yellow-800',
  Delivered: 'bg-green-100 text-green-800',
  Cancelled: 'bg-destructive/10 text-destructive',
};

const SCOPE_LABELS: Record<CategoryScope, string> = {
  apartments: 'Apartments',
  public: 'Public',
  both: 'Both',
};

export default function Standard() {
  const [categories, setCategories] = useState<ProcurementCategory[]>(loadCategories);
  const [standards, setStandards] = useState<RoomStandard[]>(loadStandards);
  const [suppliers] = useState<Supplier[]>(loadSuppliers);

  const [selectedType, setSelectedType] = useState<RoomSize>('studio');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [subView, setSubView] = useState<SubView>('byApartment');
  const [copyOpen, setCopyOpen] = useState(false);
  const [byCategoryPick, setByCategoryPick] = useState<string>('');

  const unitCounts = useMemo(() => countUnitsByRoomSize(), [standards]);

  const visibleCategories = useMemo(
    () => categories
      .filter(c => !c.archived && (c.scope === 'apartments' || c.scope === 'both'))
      .sort((a, b) => a.order - b.order),
    [categories],
  );

  // Default selected category once
  useEffect(() => {
    if (!selectedCategoryId && visibleCategories[0]) setSelectedCategoryId(visibleCategories[0].id);
    if (!byCategoryPick && visibleCategories[0]) setByCategoryPick(visibleCategories[0].id);
  }, [visibleCategories, selectedCategoryId, byCategoryPick]);

  // ── persistence helpers ──
  const persistCategories = (next: ProcurementCategory[]) => {
    setCategories(next); saveCategories(next);
  };
  const persistStandards = (next: RoomStandard[]) => {
    setStandards(next); saveStandards(next);
  };

  // ── Category CRUD ──
  const addCategory = () => {
    const nameEn = prompt('English name?')?.trim();
    if (!nameEn) return;
    const nameHe = prompt('שם בעברית?')?.trim() || nameEn;
    const next: ProcurementCategory = {
      id: genCategoryId(), nameEn, nameHe, scope: 'apartments',
      order: (categories.reduce((m, c) => Math.max(m, c.order), 0) || 0) + 1,
    };
    persistCategories([...categories, next]);
  };
  const renameCategory = (id: string) => {
    const c = categories.find(x => x.id === id); if (!c) return;
    const nameHe = prompt('שם בעברית?', c.nameHe)?.trim();
    if (!nameHe) return;
    const nameEn = prompt('English name?', c.nameEn)?.trim() || c.nameEn;
    persistCategories(categories.map(x => x.id === id ? { ...x, nameEn, nameHe } : x));
  };
  const setCategoryScope = (id: string, scope: CategoryScope) => {
    persistCategories(categories.map(x => x.id === id ? { ...x, scope } : x));
  };
  const deleteCategory = (id: string) => {
    if (!confirm('Delete this category? Items inside it will also be removed.')) return;
    persistCategories(categories.filter(x => x.id !== id));
    persistStandards(standards.filter(s => s.categoryId !== id));
    if (selectedCategoryId === id) setSelectedCategoryId('');
  };

  // ── Standards CRUD ──
  const standardsForCell = useMemo(
    () => standards.filter(s => s.roomSize === selectedType && s.categoryId === selectedCategoryId),
    [standards, selectedType, selectedCategoryId],
  );

  const addStandard = () => {
    if (!selectedCategoryId) return;
    persistStandards([...standards, emptyStandard(selectedType, selectedCategoryId)]);
  };
  const updateStandard = (id: string, patch: Partial<RoomStandard>) => {
    persistStandards(standards.map(s =>
      s.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s,
    ));
  };
  const deleteStandard = (id: string) => persistStandards(standards.filter(s => s.id !== id));
  const duplicateStandard = (id: string) => {
    const src = standards.find(s => s.id === id); if (!src) return;
    persistStandards([...standards, { ...src, id: emptyStandard(selectedType, selectedCategoryId).id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]);
  };
  const clearCategory = () => {
    if (!confirm(`Clear all items for ${ROOM_SIZE_LABELS[selectedType]} × this category?`)) return;
    persistStandards(standards.filter(s => !(s.roomSize === selectedType && s.categoryId === selectedCategoryId)));
  };

  const copyFromType = (sourceType: RoomSize, categoryIds: string[]) => {
    const src = standards.filter(s =>
      s.roomSize === sourceType && categoryIds.includes(s.categoryId),
    );
    const now = new Date().toISOString();
    const cloned = src.map(s => ({
      ...s,
      id: `std_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      roomSize: selectedType,
      orderedQty: 0, deliveredQty: 0, status: 'Planned' as StandardStatus,
      createdAt: now, updatedAt: now,
    }));
    persistStandards([...standards, ...cloned]);
  };

  // ── Apartment-type summary ──
  const typeSummary = useMemo(() => {
    const scoped = standards.filter(s => s.roomSize === selectedType);
    const computed = scoped.map(computeStandard);
    const cats = new Set(scoped.map(s => s.categoryId));
    const qtyPerSingle = scoped.reduce((sum, s) => sum + (s.qtyPerUnit || 0) + (s.sparePerUnit || 0), 0);
    const totalHotelQty = computed.reduce((sum, c) => sum + c.hotelQtyNeeded, 0);
    const totalPackageCost = scoped.reduce((sum, s) => sum + ((s.qtyPerUnit || 0) + (s.sparePerUnit || 0)) * (s.unitPriceEur || 0), 0);
    const totalHotelCost = computed.reduce((sum, c) => sum + c.lineCost, 0);
    const orderedValue = scoped.reduce((sum, s) => sum + (s.unitPriceEur || 0) * (s.orderedQty || 0), 0);
    const deliveredValue = scoped.reduce((sum, s) => sum + (s.unitPriceEur || 0) * (s.deliveredQty || 0), 0);
    return {
      units: unitCounts[selectedType] || 0,
      numCategories: cats.size, numItems: scoped.length,
      qtyPerSingle, totalHotelQty,
      totalPackageCost, totalHotelCost,
      orderedValue, deliveredValue,
      outstandingValue: Math.max(0, totalHotelCost - deliveredValue),
    };
  }, [standards, selectedType, unitCounts]);

  // ── Per-(type,category) tiny totals ──
  const cellTotals = useCallback((cid: string) => {
    const scoped = standards.filter(s => s.roomSize === selectedType && s.categoryId === cid);
    const qtyPerPackage = scoped.reduce((sum, s) => sum + (s.qtyPerUnit || 0) + (s.sparePerUnit || 0), 0);
    const hotelQty = qtyPerPackage * (unitCounts[selectedType] || 0);
    return { count: scoped.length, qtyPerPackage, hotelQty };
  }, [standards, selectedType, unitCounts]);

  // ── CSV exports ──
  const exportEditorCsv = () => {
    const rows: string[] = [];
    const cat = categories.find(c => c.id === selectedCategoryId);
    rows.push(`Apartment Standard - ${ROOM_SIZE_LABELS[selectedType]} - ${cat?.nameEn || ''}`);
    rows.push('Item,Spec,Qty/Pkg,Spare/Pkg,Total/Pkg,Units,Hotel Qty,Supplier,€/Unit,Pkg Cost,Hotel Cost,Status,Ordered,Delivered,Outstanding,Notes');
    standardsForCell.forEach(std => {
      const c = computeStandard(std);
      const supplier = suppliers.find(s => s.id === std.supplierId)?.name || '';
      const pkgCost = ((std.qtyPerUnit || 0) + (std.sparePerUnit || 0)) * (std.unitPriceEur || 0);
      rows.push([
        std.itemName, std.spec, std.qtyPerUnit, std.sparePerUnit, c.totalPerUnit,
        c.unitsInHotel, c.hotelQtyNeeded, supplier, std.unitPriceEur || 0,
        pkgCost, c.lineCost, std.status, std.orderedQty, std.deliveredQty,
        c.outstandingQty, (std.notes || '').replace(/,/g, ';'),
      ].map(v => `"${v}"`).join(','));
    });
    downloadCsv(rows.join('\n'), `standard-${selectedType}-${cat?.nameEn || 'cat'}.csv`);
  };

  const exportPoPerSupplier = (scope: 'type' | 'all') => {
    const subset = scope === 'type'
      ? standards.filter(s => s.roomSize === selectedType)
      : standards;
    const grouped = new Map<string, RoomStandard[]>();
    subset.forEach(s => {
      const k = s.supplierId || '__unassigned__';
      if (!grouped.has(k)) grouped.set(k, []);
      grouped.get(k)!.push(s);
    });
    const rows: string[] = [];
    rows.push('Supplier,Apartment Type,Category,Item,Spec,Hotel Qty,€/Unit,Line Cost,Status');
    grouped.forEach((items, sid) => {
      const sname = suppliers.find(s => s.id === sid)?.name || (sid === '__unassigned__' ? 'Unassigned' : 'Unknown');
      items.forEach(std => {
        const c = computeStandard(std);
        const cat = categories.find(cc => cc.id === std.categoryId)?.nameEn || '';
        rows.push([
          sname, ROOM_SIZE_LABELS[std.roomSize], cat, std.itemName, std.spec,
          c.hotelQtyNeeded, std.unitPriceEur || 0, c.lineCost, std.status,
        ].map(v => `"${v}"`).join(','));
      });
    });
    downloadCsv(rows.join('\n'),
      scope === 'type' ? `po-per-supplier-${selectedType}.csv` : 'po-per-supplier-hotel.csv');
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              סטנדרט <span className="text-sm text-muted-foreground font-normal">· Standard per Apartment Type</span>
            </h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-muted-foreground hover:text-foreground"><HelpCircle className="w-4 h-4" /></button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Define, per apartment type, exactly what each unit gets — the system auto-calculates
                hotel-wide quantities, package cost, total cost, and outstanding orders per category and per supplier.
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
            {([
              ['byApartment', 'By Apartment Type'],
              ['byCategory', 'By Category'],
              ['hotelTotals', 'Hotel Totals'],
            ] as [SubView, string][]).map(([k, label]) => (
              <button key={k} onClick={() => setSubView(k)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  subView === k ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {subView === 'byApartment' && (
          <>
            {/* Top summary */}
            <SummaryBar s={typeSummary} typeLabel={`${APARTMENT_LABELS_HE[selectedType]} · ${ROOM_SIZE_LABELS[selectedType]}`} />

            {/* 3-pane */}
            <div className="grid grid-cols-12 gap-4">
              {/* Left: apartment types */}
              <aside className="col-span-2 bg-card rounded-lg border p-3 space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 px-1">סוג דירה / Type</div>
                {RESIDENTIAL_ROOM_SIZES.map(t => (
                  <button key={t} onClick={() => setSelectedType(t)}
                    className={`w-full text-right px-3 py-2 rounded-md text-sm transition-colors ${
                      selectedType === t ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-foreground'
                    }`} dir="rtl">
                    <div className="font-semibold">{APARTMENT_LABELS_HE[t]}</div>
                    <div className={`text-[10px] ${selectedType === t ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {ROOM_SIZE_LABELS[t]} · {unitCounts[t] || 0} units
                    </div>
                  </button>
                ))}
              </aside>

              {/* Center: categories */}
              <section className="col-span-4 bg-card rounded-lg border p-3 space-y-1">
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">קטגוריות / Categories</div>
                  <Button size="sm" variant="ghost" onClick={addCategory} className="h-6 text-xs">
                    <Plus className="w-3 h-3" /> Add
                  </Button>
                </div>
                <div className="max-h-[600px] overflow-y-auto space-y-1">
                  {visibleCategories.map(c => {
                    const t = cellTotals(c.id);
                    const active = selectedCategoryId === c.id;
                    return (
                      <div key={c.id}
                        className={`group rounded-md border px-2 py-1.5 cursor-pointer transition-colors ${
                          active ? 'bg-accent/10 border-accent' : 'border-transparent hover:bg-muted'
                        }`}
                        onClick={() => setSelectedCategoryId(c.id)}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1" dir="rtl">
                            <div className="text-sm font-semibold text-foreground truncate">{c.nameHe}</div>
                            <div className="text-[10px] text-muted-foreground truncate" dir="ltr">{c.nameEn}</div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                            <button onClick={e => { e.stopPropagation(); renameCategory(c.id); }} className="p-1 text-muted-foreground hover:text-foreground" title="Rename"><Pencil className="w-3 h-3" /></button>
                            <button onClick={e => { e.stopPropagation(); deleteCategory(c.id); }} className="p-1 text-muted-foreground hover:text-destructive" title="Delete"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-1 text-[10px]">
                          <select value={c.scope} onClick={e => e.stopPropagation()}
                            onChange={e => setCategoryScope(c.id, e.target.value as CategoryScope)}
                            className="text-[10px] bg-transparent border rounded px-1 py-0.5 text-muted-foreground">
                            {(['apartments', 'public', 'both'] as CategoryScope[]).map(s => (
                              <option key={s} value={s}>{SCOPE_LABELS[s]}</option>
                            ))}
                          </select>
                          <div className="flex items-center gap-2 font-mono text-muted-foreground">
                            <span title="Items">📦 {t.count}</span>
                            <span title="Qty/Package">/ {t.qtyPerPackage}</span>
                            <span title="Hotel Qty" className="font-semibold text-foreground">= {t.hotelQty}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Right: items editor */}
              <section className="col-span-6 bg-card rounded-lg border p-3">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {APARTMENT_LABELS_HE[selectedType]} × {categories.find(c => c.id === selectedCategoryId)?.nameHe || '—'}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {ROOM_SIZE_LABELS[selectedType]} × {categories.find(c => c.id === selectedCategoryId)?.nameEn || ''}
                      {' · '}{unitCounts[selectedType] || 0} units in hotel
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" onClick={() => setCopyOpen(true)} className="h-7 text-xs">
                      <Copy className="w-3 h-3" /> Copy from…
                    </Button>
                    <Button size="sm" variant="outline" onClick={clearCategory} className="h-7 text-xs">Clear</Button>
                    <Button size="sm" variant="outline" onClick={exportEditorCsv} className="h-7 text-xs">
                      <Download className="w-3 h-3" /> CSV
                    </Button>
                    <Button size="sm" onClick={addStandard} disabled={!selectedCategoryId} className="h-7 text-xs">
                      <Plus className="w-3 h-3" /> Add Item
                    </Button>
                  </div>
                </div>

                {standardsForCell.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-muted rounded-lg">
                    <p className="text-sm text-muted-foreground" dir="rtl">
                      אין עדיין פריטים ל-{APARTMENT_LABELS_HE[selectedType]} × {categories.find(c => c.id === selectedCategoryId)?.nameHe || '—'} — לחץ Add Item
                    </p>
                  </div>
                ) : (
                  <ItemEditor standards={standardsForCell} suppliers={suppliers}
                    onUpdate={updateStandard} onDelete={deleteStandard} onDuplicate={duplicateStandard} />
                )}
              </section>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => exportPoPerSupplier('type')} className="text-xs">
                <Download className="w-3 h-3" /> PO CSV — {ROOM_SIZE_LABELS[selectedType]}
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportPoPerSupplier('all')} className="text-xs">
                <Download className="w-3 h-3" /> PO CSV — Hotel-wide
              </Button>
            </div>
          </>
        )}

        {subView === 'byCategory' && (
          <ByCategoryView categories={visibleCategories} selectedId={byCategoryPick}
            onSelect={setByCategoryPick} standards={standards} suppliers={suppliers} unitCounts={unitCounts} />
        )}

        {subView === 'hotelTotals' && (
          <HotelTotalsView categories={visibleCategories} standards={standards} unitCounts={unitCounts} />
        )}
      </div>

      <CopyDialog open={copyOpen} onOpenChange={setCopyOpen}
        currentType={selectedType} categories={visibleCategories}
        standards={standards} onCopy={copyFromType} />
    </TooltipProvider>
  );
}

// ───────────────────────────── Summary Bar ─────────────────────────────
function SummaryBar({ s, typeLabel }: { s: TypeSummary; typeLabel: string }) {
  const cells = [
    ['Units in Hotel', s.units.toLocaleString()],
    ['# Categories', s.numCategories.toLocaleString()],
    ['# Items', s.numItems.toLocaleString()],
    ['Qty / Apartment', s.qtyPerSingle.toLocaleString()],
    ['Hotel Qty (this type)', s.totalHotelQty.toLocaleString()],
    ['Package Cost', eur(s.totalPackageCost)],
    ['Hotel Cost', eur(s.totalHotelCost)],
    ['Ordered', eur(s.orderedValue)],
    ['Delivered', eur(s.deliveredValue)],
    ['Outstanding', eur(s.outstandingValue)],
  ] as const;
  return (
    <div className="bg-card border rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Summary · {typeLabel}</div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cells.map(([label, val]) => (
          <div key={label}>
            <div className="text-[10px] text-muted-foreground">{label}</div>
            <div className="text-sm font-semibold text-foreground font-mono">{val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
// helper type alias
type TypeSummary = {
  units: number; numCategories: number; numItems: number; qtyPerSingle: number;
  totalHotelQty: number; totalPackageCost: number; totalHotelCost: number;
  orderedValue: number; deliveredValue: number; outstandingValue: number;
};


// ───────────────────────────── Item Editor Table ─────────────────────────────
function ItemEditor({
  standards, suppliers, onUpdate, onDelete, onDuplicate,
}: {
  standards: RoomStandard[]; suppliers: Supplier[];
  onUpdate: (id: string, patch: Partial<RoomStandard>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}) {
  const inputCls = 'w-full h-7 px-2 text-xs border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary';
  const th = 'text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-2 py-1.5 whitespace-nowrap';
  const td = 'px-2 py-1.5 align-middle';

  return (
    <div className="overflow-x-auto -mx-3">
      <table className="w-full text-xs">
        <thead className="bg-muted/50 border-y">
          <tr>
            <th className={th}>Item</th>
            <th className={th}>Spec</th>
            <th className={`${th} text-right`}>Qty/Pkg</th>
            <th className={`${th} text-right`}>Spare</th>
            <th className={`${th} text-right`}>Total/Pkg</th>
            <th className={`${th} text-right`}>Units</th>
            <th className={`${th} text-right`}>Hotel Qty</th>
            <th className={th}>Supplier</th>
            <th className={`${th} text-right`}>€/Unit</th>
            <th className={`${th} text-right`}>Pkg Cost</th>
            <th className={`${th} text-right`}>Hotel Cost</th>
            <th className={th}>Status</th>
            <th className={`${th} text-right`}>Ord</th>
            <th className={`${th} text-right`}>Del</th>
            <th className={`${th} text-right`}>Outstd</th>
            <th className={th}>Notes</th>
            <th className={th}></th>
          </tr>
        </thead>
        <tbody>
          {standards.map(std => {
            const c = computeStandard(std);
            const pkgCost = ((std.qtyPerUnit || 0) + (std.sparePerUnit || 0)) * (std.unitPriceEur || 0);
            return (
              <tr key={std.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className={td}><Input className={inputCls + ' min-w-[140px]'} value={std.itemName}
                  onChange={e => onUpdate(std.id, { itemName: e.target.value })} placeholder="Item name…" /></td>
                <td className={td}><Input className={inputCls + ' min-w-[120px]'} value={std.spec}
                  onChange={e => onUpdate(std.id, { spec: e.target.value })} placeholder="Spec/model" /></td>
                <td className={td}><Input type="number" className={inputCls + ' text-right w-16'} value={std.qtyPerUnit}
                  onChange={e => onUpdate(std.id, { qtyPerUnit: Math.max(0, +e.target.value) })} /></td>
                <td className={td}><Input type="number" className={inputCls + ' text-right w-14'} value={std.sparePerUnit}
                  onChange={e => onUpdate(std.id, { sparePerUnit: Math.max(0, +e.target.value) })} /></td>
                <td className={`${td} text-right font-mono`}>{c.totalPerUnit}</td>
                <td className={`${td} text-right font-mono text-muted-foreground`}>{c.unitsInHotel}</td>
                <td className={`${td} text-right font-mono font-semibold`}>{c.hotelQtyNeeded.toLocaleString()}</td>
                <td className={td}>
                  <select className={inputCls + ' min-w-[110px]'} value={std.supplierId || ''}
                    onChange={e => onUpdate(std.id, { supplierId: e.target.value || undefined })}>
                    <option value="">—</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </td>
                <td className={td}><Input type="number" className={inputCls + ' text-right w-20'} value={std.unitPriceEur ?? ''}
                  onChange={e => onUpdate(std.id, { unitPriceEur: e.target.value === '' ? undefined : Math.max(0, +e.target.value) })} /></td>
                <td className={`${td} text-right font-mono`}>{eur(pkgCost)}</td>
                <td className={`${td} text-right font-mono font-semibold`}>{eur(c.lineCost)}</td>
                <td className={td}>
                  <select className={`${inputCls} ${STATUS_COLORS[std.status]} font-medium`} value={std.status}
                    onChange={e => onUpdate(std.id, { status: e.target.value as StandardStatus })}>
                    {STANDARD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className={td}><Input type="number" className={inputCls + ' text-right w-14'} value={std.orderedQty}
                  onChange={e => onUpdate(std.id, { orderedQty: Math.max(0, +e.target.value) })} /></td>
                <td className={td}><Input type="number" className={inputCls + ' text-right w-14'} value={std.deliveredQty}
                  onChange={e => onUpdate(std.id, { deliveredQty: Math.max(0, +e.target.value) })} /></td>
                <td className={`${td} text-right font-mono ${c.outstandingQty > 0 ? 'text-yellow-700' : 'text-muted-foreground'}`}>
                  {c.outstandingQty.toLocaleString()}
                </td>
                <td className={td}><Input className={inputCls + ' min-w-[100px]'} value={std.notes}
                  onChange={e => onUpdate(std.id, { notes: e.target.value })} /></td>
                <td className={td}>
                  <div className="flex items-center gap-1">
                    <button onClick={() => onDuplicate(std.id)} className="p-1 text-muted-foreground hover:text-foreground" title="Duplicate"><Copy className="w-3 h-3" /></button>
                    <button onClick={() => onDelete(std.id)} className="p-1 text-muted-foreground hover:text-destructive" title="Delete"><Trash2 className="w-3 h-3" /></button>
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

// ───────────────────────────── By Category View ─────────────────────────────
function ByCategoryView({
  categories, selectedId, onSelect, standards, suppliers, unitCounts,
}: {
  categories: ProcurementCategory[]; selectedId: string;
  onSelect: (id: string) => void;
  standards: RoomStandard[]; suppliers: Supplier[];
  unitCounts: Record<RoomSize, number>;
}) {
  const cat = categories.find(c => c.id === selectedId);
  // Aggregate items by name across all apartment types within the category
  const grouped = useMemo(() => {
    const map = new Map<string, {
      name: string; spec: string; supplierId?: string; status: StandardStatus;
      perType: Record<RoomSize, number>;
      grandQty: number; grandCost: number; unitPrice: number;
    }>();
    standards.filter(s => s.categoryId === selectedId).forEach(s => {
      const key = s.itemName.trim().toLowerCase() || `__${s.id}`;
      let entry = map.get(key);
      if (!entry) {
        entry = {
          name: s.itemName || '(unnamed)', spec: s.spec, supplierId: s.supplierId,
          status: s.status, unitPrice: s.unitPriceEur || 0,
          perType: { studio: 0, '1br': 0, '2br': 0, '3br': 0, '4br': 0, public: 0 },
          grandQty: 0, grandCost: 0,
        };
        map.set(key, entry);
      }
      const c = computeStandard(s);
      entry.perType[s.roomSize] += c.hotelQtyNeeded;
      entry.grandQty += c.hotelQtyNeeded;
      entry.grandCost += c.lineCost;
      if (s.unitPriceEur) entry.unitPrice = s.unitPriceEur;
      if (!entry.supplierId && s.supplierId) entry.supplierId = s.supplierId;
    });
    return Array.from(map.values()).sort((a, b) => b.grandQty - a.grandQty);
  }, [standards, selectedId]);

  const totalQty = grouped.reduce((s, g) => s + g.grandQty, 0);
  const totalCost = grouped.reduce((s, g) => s + g.grandCost, 0);

  return (
    <div className="space-y-3">
      <div className="bg-card border rounded-lg p-3 flex items-center gap-3">
        <span className="text-xs text-muted-foreground">קטגוריה / Category:</span>
        <select className="border rounded px-2 py-1 text-sm bg-background min-w-[280px]"
          value={selectedId} onChange={e => onSelect(e.target.value)} dir="rtl">
          {categories.map(c => <option key={c.id} value={c.id}>{c.nameHe} · {c.nameEn}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-4 text-xs">
          <div><span className="text-muted-foreground">Items:</span> <span className="font-semibold">{grouped.length}</span></div>
          <div><span className="text-muted-foreground">Total Hotel Qty:</span> <span className="font-semibold font-mono">{totalQty.toLocaleString()}</span></div>
          <div><span className="text-muted-foreground">Total Cost:</span> <span className="font-semibold font-mono">{eur(totalCost)}</span></div>
        </div>
      </div>

      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Item</th>
              <th className="text-left px-3 py-2 font-medium">Spec</th>
              {RESIDENTIAL_ROOM_SIZES.map(t => (
                <th key={t} className="text-right px-3 py-2 font-medium">{ROOM_SIZE_LABELS[t]}<br /><span className="text-[9px] text-muted-foreground">({unitCounts[t] || 0} units)</span></th>
              ))}
              <th className="text-right px-3 py-2 font-medium">Grand Qty</th>
              <th className="text-right px-3 py-2 font-medium">Grand Cost</th>
              <th className="text-left px-3 py-2 font-medium">Supplier</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((g, i) => (
              <tr key={i} className="border-t hover:bg-muted/30">
                <td className="px-3 py-2 font-medium">{g.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{g.spec}</td>
                {RESIDENTIAL_ROOM_SIZES.map(t => (
                  <td key={t} className="px-3 py-2 text-right font-mono">{g.perType[t] || '—'}</td>
                ))}
                <td className="px-3 py-2 text-right font-mono font-semibold">{g.grandQty.toLocaleString()}</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{eur(g.grandCost)}</td>
                <td className="px-3 py-2 text-muted-foreground">{suppliers.find(s => s.id === g.supplierId)?.name || '—'}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[g.status]}`}>{g.status}</span>
                </td>
              </tr>
            ))}
            {grouped.length === 0 && (
              <tr><td colSpan={7 + RESIDENTIAL_ROOM_SIZES.length} className="px-3 py-8 text-center text-muted-foreground">
                No items defined yet for {cat?.nameEn || 'this category'}.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ───────────────────────────── Hotel Totals View ─────────────────────────────
function HotelTotalsView({
  categories, standards, unitCounts,
}: {
  categories: ProcurementCategory[]; standards: RoomStandard[]; unitCounts: Record<RoomSize, number>;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setOpen(o => ({ ...o, [id]: !o[id] }));

  const rows = useMemo(() => categories.map(cat => {
    const scoped = standards.filter(s => s.categoryId === cat.id);
    const computed = scoped.map(computeStandard);
    const totalQty = computed.reduce((s, c) => s + c.hotelQtyNeeded, 0);
    const totalCost = computed.reduce((s, c) => s + c.lineCost, 0);
    const perType: Record<RoomSize, { qty: number; cost: number; items: number }> = {
      studio: { qty: 0, cost: 0, items: 0 },
      '1br': { qty: 0, cost: 0, items: 0 },
      '2br': { qty: 0, cost: 0, items: 0 },
      '3br': { qty: 0, cost: 0, items: 0 },
      '4br': { qty: 0, cost: 0, items: 0 },
      public: { qty: 0, cost: 0, items: 0 },
    };
    scoped.forEach(s => {
      const c = computeStandard(s);
      perType[s.roomSize].qty += c.hotelQtyNeeded;
      perType[s.roomSize].cost += c.lineCost;
      perType[s.roomSize].items += 1;
    });
    return { cat, totalQty, totalCost, items: scoped.length, perType };
  }), [categories, standards]);

  const grandQty = rows.reduce((s, r) => s + r.totalQty, 0);
  const grandCost = rows.reduce((s, r) => s + r.totalCost, 0);

  return (
    <div className="space-y-3">
      <div className="bg-card border rounded-lg p-3 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div><div className="text-[10px] text-muted-foreground uppercase">Categories</div><div className="text-sm font-semibold">{rows.length}</div></div>
        <div><div className="text-[10px] text-muted-foreground uppercase">Total Items Defined</div><div className="text-sm font-semibold">{rows.reduce((s, r) => s + r.items, 0)}</div></div>
        <div><div className="text-[10px] text-muted-foreground uppercase">Hotel-wide Qty</div><div className="text-sm font-semibold font-mono">{grandQty.toLocaleString()}</div></div>
        <div><div className="text-[10px] text-muted-foreground uppercase">Hotel-wide Cost</div><div className="text-sm font-semibold font-mono">{eur(grandCost)}</div></div>
      </div>

      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2 w-8"></th>
              <th className="text-right px-3 py-2 font-medium" dir="rtl">קטגוריה / Category</th>
              <th className="text-right px-3 py-2 font-medium">Items</th>
              <th className="text-right px-3 py-2 font-medium">Hotel Qty</th>
              <th className="text-right px-3 py-2 font-medium">Hotel Cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <>
                <tr key={r.cat.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => toggle(r.cat.id)}>
                  <td className="px-3 py-2">
                    {open[r.cat.id] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </td>
                  <td className="px-3 py-2" dir="rtl">
                    <div className="font-semibold">{r.cat.nameHe}</div>
                    <div className="text-[10px] text-muted-foreground" dir="ltr">{r.cat.nameEn}</div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{r.items}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">{r.totalQty.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">{eur(r.totalCost)}</td>
                </tr>
                {open[r.cat.id] && (
                  <tr className="bg-muted/20">
                    <td></td>
                    <td colSpan={4} className="px-3 py-2">
                      <div className="grid grid-cols-5 gap-2">
                        {RESIDENTIAL_ROOM_SIZES.map(t => (
                          <div key={t} className="border rounded p-2 bg-background">
                            <div className="text-[10px] text-muted-foreground">{ROOM_SIZE_LABELS[t]}</div>
                            <div className="text-xs font-mono">{r.perType[t].qty.toLocaleString()} qty</div>
                            <div className="text-[10px] font-mono text-muted-foreground">{eur(r.perType[t].cost)}</div>
                            <div className="text-[9px] text-muted-foreground">{r.perType[t].items} items · {unitCounts[t] || 0} units</div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ───────────────────────────── Copy From Dialog ─────────────────────────────
function CopyDialog({
  open, onOpenChange, currentType, categories, standards, onCopy,
}: {
  open: boolean; onOpenChange: (b: boolean) => void;
  currentType: RoomSize; categories: ProcurementCategory[];
  standards: RoomStandard[];
  onCopy: (sourceType: RoomSize, categoryIds: string[]) => void;
}) {
  const otherTypes = RESIDENTIAL_ROOM_SIZES.filter(t => t !== currentType);
  const [source, setSource] = useState<RoomSize>(otherTypes[0] || 'studio');
  const [picked, setPicked] = useState<Record<string, boolean>>({});

  const sourceCats = useMemo(() => {
    const ids = new Set(standards.filter(s => s.roomSize === source).map(s => s.categoryId));
    return categories.filter(c => ids.has(c.id));
  }, [standards, source, categories]);

  useEffect(() => {
    if (open) setPicked(Object.fromEntries(sourceCats.map(c => [c.id, true])));
  }, [open, sourceCats]);

  const submit = () => {
    const ids = Object.entries(picked).filter(([, v]) => v).map(([k]) => k);
    if (ids.length) onCopy(source, ids);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Copy Standard From Another Apartment Type</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Source apartment type</label>
            <select value={source} onChange={e => setSource(e.target.value as RoomSize)}
              className="w-full mt-1 border rounded px-2 py-1.5 text-sm bg-background">
              {otherTypes.map(t => <option key={t} value={t}>{ROOM_SIZE_LABELS[t]} · {APARTMENT_LABELS_HE[t]}</option>)}
            </select>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Categories to copy</div>
            <div className="max-h-64 overflow-y-auto border rounded p-2 space-y-1">
              {sourceCats.length === 0 && <div className="text-xs text-muted-foreground">Source has no items yet.</div>}
              {sourceCats.map(c => (
                <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={!!picked[c.id]}
                    onChange={e => setPicked(p => ({ ...p, [c.id]: e.target.checked }))} />
                  <span dir="rtl">{c.nameHe}</span>
                  <span className="text-muted-foreground" dir="ltr">· {c.nameEn}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={sourceCats.length === 0}>Copy</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────────── helpers ─────────────────────────────
function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  a.click(); URL.revokeObjectURL(url);
}
