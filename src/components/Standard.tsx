/**
 * Standard tab — master "Standard Apartment" template + 5 real apartment types.
 * Items are CRUD'd only in the Standard Apartment view; per-type values
 * (qty/spare/status/ord/del/notes) are edited in each apartment-type view.
 */
import { useState, useMemo, useCallback, useEffect, Fragment } from 'react';
import {
  ProcurementCategory, CategoryScope, loadCategories, saveCategories, genCategoryId,
  StandardStatus, STANDARD_STATUSES, eur,
} from '@/data/roomStandardsData';
import {
  RoomSize, RESIDENTIAL_ROOM_SIZES, ROOM_SIZE_LABELS, countUnitsByRoomSize,
} from '@/data/masterData';
import {
  StandardItem, ApartmentType, APARTMENT_TYPES,
  loadStandardItems, saveStandardItems, genItemId,
  ApartmentTypeQuantity, loadApartmentTypeQuantities, saveApartmentTypeQuantities, genQtyId,
  computeQuantity,
} from '@/data/standardItemsData';
import { Supplier, loadSuppliers } from '@/data/supplierData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover, PopoverTrigger, PopoverContent,
} from '@/components/ui/popover';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus, Trash2, Download, HelpCircle, ChevronRight, ChevronDown, Pencil,
  Star, Lock, ExternalLink, Check, Save, ArrowUp, ArrowDown, GripVertical,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const FragmentRow = Fragment;

type SubView = 'byApartment' | 'byCategory' | 'hotelTotals';
type View = 'standard' | ApartmentType; // 'standard' = master

const APARTMENT_LABELS_HE: Record<ApartmentType, string> = {
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
  apartments: 'Apartments', public: 'Public', both: 'Both',
};

export default function Standard() {
  const [categories, setCategories] = useState<ProcurementCategory[]>(loadCategories);
  const [items, setItems] = useState<StandardItem[]>(loadStandardItems);
  const [qtys, setQtys] = useState<ApartmentTypeQuantity[]>(loadApartmentTypeQuantities);
  const [suppliers] = useState<Supplier[]>(loadSuppliers);

  const [view, setView] = useState<View>('standard');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [subView, setSubView] = useState<SubView>('byApartment');
  const [byCategoryPick, setByCategoryPick] = useState<string>('');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const handleManualSave = useCallback(() => {
    saveCategories(categories);
    saveStandardItems(items);
    saveApartmentTypeQuantities(qtys);
    const now = new Date();
    setLastSavedAt(now);
    setJustSaved(true);
    toast.success('הנתונים נשמרו בהצלחה · Saved successfully', {
      description: `${now.toLocaleTimeString('he-IL')} — ${items.length} פריטים`,
    });
    setTimeout(() => setJustSaved(false), 2000);
  }, [categories, items, qtys]);

  const unitCounts = useMemo(() => countUnitsByRoomSize(), [items, qtys]);

  const visibleCategories = useMemo(
    () => categories
      .filter(c => !c.archived && (c.scope === 'apartments' || c.scope === 'both'))
      .sort((a, b) => a.order - b.order),
    [categories],
  );

  useEffect(() => {
    if (!selectedCategoryId && visibleCategories[0]) setSelectedCategoryId(visibleCategories[0].id);
    if (!byCategoryPick && visibleCategories[0]) setByCategoryPick(visibleCategories[0].id);
  }, [visibleCategories, selectedCategoryId, byCategoryPick]);

  const persistCategories = (next: ProcurementCategory[]) => { setCategories(next); saveCategories(next); };
  const persistItems = (next: StandardItem[]) => { setItems(next); saveStandardItems(next); };
  const persistQtys = (next: ApartmentTypeQuantity[]) => { setQtys(next); saveApartmentTypeQuantities(next); };

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
  const setCategoryScope = (id: string, scope: CategoryScope) =>
    persistCategories(categories.map(x => x.id === id ? { ...x, scope } : x));
  const deleteCategory = (id: string) => {
    if (!confirm('Delete this category? Items inside it will also be removed from all apartment types.')) return;
    persistCategories(categories.filter(x => x.id !== id));
    const droppedItemIds = new Set(items.filter(i => i.categoryId === id).map(i => i.id));
    persistItems(items.filter(i => i.categoryId !== id));
    persistQtys(qtys.filter(q => !droppedItemIds.has(q.standardItemId)));
    if (selectedCategoryId === id) setSelectedCategoryId('');
  };

  // ── Master Item CRUD (only allowed when view === 'standard') ──
  const addMasterItem = () => {
    if (!selectedCategoryId) return;
    const now = new Date().toISOString();
    const newItem: StandardItem = {
      id: genItemId(),
      categoryId: selectedCategoryId,
      itemName: '',
      spec: '',
      order: (items.reduce((m, i) => Math.max(m, i.order), 0) || 0) + 1,
      createdAt: now, updatedAt: now,
    };
    const newQtys: ApartmentTypeQuantity[] = APARTMENT_TYPES.map(at => ({
      id: genQtyId(),
      standardItemId: newItem.id,
      apartmentType: at,
      qtyPerPackage: 0, sparePerPackage: 0,
      status: 'Planned', orderedQty: 0, deliveredQty: 0, notes: '',
      updatedAt: now,
    }));
    persistItems([...items, newItem]);
    persistQtys([...qtys, ...newQtys]);
  };

  const updateMasterItem = (id: string, patch: Partial<StandardItem>) => {
    persistItems(items.map(i =>
      i.id === id ? { ...i, ...patch, updatedAt: new Date().toISOString() } : i,
    ));
  };

  const deleteMasterItem = (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    if (!confirm(`Delete "${item.itemName || '(unnamed)'}" from ALL 5 apartment types? This cannot be undone.`)) return;
    persistItems(items.filter(i => i.id !== id));
    persistQtys(qtys.filter(q => q.standardItemId !== id));
  };

  const updateQty = (id: string, patch: Partial<ApartmentTypeQuantity>) => {
    persistQtys(qtys.map(q =>
      q.id === id ? { ...q, ...patch, updatedAt: new Date().toISOString() } : q,
    ));
  };

  // Reorder a master item up/down within its category
  const moveMasterItem = (id: string, direction: -1 | 1) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const siblings = items
      .filter(i => i.categoryId === item.categoryId && !i.archived)
      .sort((a, b) => a.order - b.order);
    const idx = siblings.findIndex(i => i.id === id);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= siblings.length) return;
    const a = siblings[idx];
    const b = siblings[swapIdx];
    const now = new Date().toISOString();
    persistItems(items.map(i => {
      if (i.id === a.id) return { ...i, order: b.order, updatedAt: now };
      if (i.id === b.id) return { ...i, order: a.order, updatedAt: now };
      return i;
    }));
  };

  // Reorder via drag: receives the new ordered list of ids within a category
  const reorderMasterItems = (categoryId: string, orderedIds: string[]) => {
    const now = new Date().toISOString();
    const orderMap = new Map(orderedIds.map((id, i) => [id, i + 1]));
    persistItems(items.map(i => {
      if (i.categoryId !== categoryId) return i;
      const newOrder = orderMap.get(i.id);
      if (newOrder == null || newOrder === i.order) return i;
      return { ...i, order: newOrder, updatedAt: now };
    }));
  };

  // helpers
  const itemsForCategory = useMemo(
    () => items.filter(i => !i.archived && i.categoryId === selectedCategoryId)
      .sort((a, b) => a.order - b.order),
    [items, selectedCategoryId],
  );

  const qtysByItem = useMemo(() => {
    const m = new Map<string, Record<ApartmentType, ApartmentTypeQuantity | undefined>>();
    items.forEach(i => {
      m.set(i.id, { studio: undefined, '1br': undefined, '2br': undefined, '3br': undefined, '4br': undefined });
    });
    qtys.forEach(q => {
      const row = m.get(q.standardItemId);
      if (row) row[q.apartmentType] = q;
    });
    return m;
  }, [items, qtys]);

  // Per-(view,category) cell totals for sidebar
  const cellTotals = useCallback((cid: string) => {
    const list = items.filter(i => !i.archived && i.categoryId === cid);
    let qtyPerPackage = 0;
    let hotelQty = 0;
    list.forEach(i => {
      const row = qtysByItem.get(i.id); if (!row) return;
      if (view === 'standard') {
        APARTMENT_TYPES.forEach(at => {
          const q = row[at]; if (!q) return;
          const total = (q.qtyPerPackage || 0) + (q.sparePerPackage || 0);
          hotelQty += total * (unitCounts[at] || 0);
        });
      } else {
        const q = row[view]; if (!q) return;
        const total = (q.qtyPerPackage || 0) + (q.sparePerPackage || 0);
        qtyPerPackage += total;
        hotelQty += total * (unitCounts[view] || 0);
      }
    });
    return { count: list.length, qtyPerPackage, hotelQty };
  }, [items, qtysByItem, view, unitCounts]);

  // Apartment-type / master summary
  const typeSummary = useMemo(() => {
    if (view === 'standard') {
      // master: aggregate across all 5 types
      let totalHotelQty = 0, totalHotelCost = 0, totalPackageCost = 0;
      let orderedValue = 0, deliveredValue = 0;
      const cats = new Set<string>();
      items.forEach(i => {
        cats.add(i.categoryId);
        const row = qtysByItem.get(i.id); if (!row) return;
        APARTMENT_TYPES.forEach(at => {
          const q = row[at]; if (!q) return;
          const c = computeQuantity(q, i, unitCounts);
          totalHotelQty += c.hotelQty;
          totalHotelCost += c.hotelCost;
          totalPackageCost += c.packageCost;
          orderedValue += (i.unitPriceEur || 0) * (q.orderedQty || 0);
          deliveredValue += (i.unitPriceEur || 0) * (q.deliveredQty || 0);
        });
      });
      const totalUnits = APARTMENT_TYPES.reduce((s, at) => s + (unitCounts[at] || 0), 0);
      return {
        units: totalUnits, numCategories: cats.size, numItems: items.length,
        qtyPerSingle: 0, totalHotelQty, totalPackageCost, totalHotelCost,
        orderedValue, deliveredValue,
        outstandingValue: Math.max(0, totalHotelCost - deliveredValue),
      };
    }
    // real apartment type
    const at = view;
    let qtyPerSingle = 0, totalHotelQty = 0, totalPackageCost = 0, totalHotelCost = 0;
    let orderedValue = 0, deliveredValue = 0;
    const cats = new Set<string>();
    items.forEach(i => {
      const row = qtysByItem.get(i.id); if (!row) return;
      const q = row[at]; if (!q) return;
      cats.add(i.categoryId);
      const c = computeQuantity(q, i, unitCounts);
      qtyPerSingle += c.totalPerPkg;
      totalHotelQty += c.hotelQty;
      totalPackageCost += c.packageCost;
      totalHotelCost += c.hotelCost;
      orderedValue += (i.unitPriceEur || 0) * (q.orderedQty || 0);
      deliveredValue += (i.unitPriceEur || 0) * (q.deliveredQty || 0);
    });
    return {
      units: unitCounts[at] || 0, numCategories: cats.size, numItems: items.length,
      qtyPerSingle, totalHotelQty, totalPackageCost, totalHotelCost,
      orderedValue, deliveredValue,
      outstandingValue: Math.max(0, totalHotelCost - deliveredValue),
    };
  }, [view, items, qtysByItem, unitCounts]);

  // ── CSV ──
  const exportEditorCsv = () => {
    const cat = categories.find(c => c.id === selectedCategoryId);
    const rows: string[] = [];
    const viewLabel = view === 'standard' ? 'Standard Apartment (master)' : ROOM_SIZE_LABELS[view];
    rows.push(`Standard - ${viewLabel} - ${cat?.nameEn || ''}`);
    if (view === 'standard') {
      rows.push('Item,Spec,Category,Unit Price €,Supplier,Studio,1BR,2BR,3BR,4BR');
      itemsForCategory.forEach(i => {
        const row = qtysByItem.get(i.id);
        const supplier = suppliers.find(s => s.id === i.supplierId)?.name || '';
        const fmt = (at: ApartmentType) => {
          const q = row?.[at]; if (!q) return '0';
          return `${q.qtyPerPackage}+${q.sparePerPackage}`;
        };
        rows.push([
          i.itemName, i.spec, cat?.nameEn || '', (i.unitPriceEur || 0).toFixed(2), supplier,
          fmt('studio'), fmt('1br'), fmt('2br'), fmt('3br'), fmt('4br'),
        ].map(v => `"${v}"`).join(','));
      });
    } else {
      rows.push('Item,Spec,Qty/Pkg,€/Unit,Spare,Total/Pkg,Units,Hotel Qty,Supplier,Pkg Cost,Hotel Cost,Status,Ordered,Delivered,Outstanding,Notes');
      itemsForCategory.forEach(i => {
        const q = qtysByItem.get(i.id)?.[view]; if (!q) return;
        const c = computeQuantity(q, i, unitCounts);
        const supplier = suppliers.find(s => s.id === i.supplierId)?.name || '';
        rows.push([
          i.itemName, i.spec, q.qtyPerPackage, (i.unitPriceEur || 0).toFixed(2),
          q.sparePerPackage, c.totalPerPkg, c.units, c.hotelQty, supplier,
          c.packageCost.toFixed(2), c.hotelCost.toFixed(2), q.status, q.orderedQty, q.deliveredQty,
          c.outstandingQty, (q.notes || '').replace(/,/g, ';'),
        ].map(v => `"${v}"`).join(','));
      });
    }
    downloadCsv(rows.join('\n'), `standard-${view}-${cat?.nameEn || 'cat'}.csv`);
  };

  const viewLabel = view === 'standard'
    ? 'דירת סטנדרט · Standard Apartment (Master)'
    : `${APARTMENT_LABELS_HE[view]} · ${ROOM_SIZE_LABELS[view]}`;

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
                Define the master FF&E list once in "Standard Apartment". Item Name / Spec /
                Category / Unit Price / Supplier are shared across all apartment types.
                Per-type Qty, Spare, Status, Ord/Del and Notes are edited in each apartment view.
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-center gap-3">
            {lastSavedAt && (
              <span className="text-[11px] text-muted-foreground" dir="rtl">
                נשמר לאחרונה · {lastSavedAt.toLocaleTimeString('he-IL')}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleManualSave}
              className={`gap-2 px-4 font-medium tracking-wide transition-all duration-300 ${
                justSaved
                  ? 'bg-green-50 border-green-500 text-green-700 hover:bg-green-50'
                  : 'border-primary/30 hover:border-primary hover:bg-primary/5'
              }`}
            >
              {justSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              <span className="text-xs uppercase">{justSaved ? 'Saved' : 'Update'}</span>
            </Button>
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
        </div>

        {subView === 'byApartment' && (
          <>
            <SummaryBar s={typeSummary} typeLabel={viewLabel} isMaster={view === 'standard'} />

            <div className="grid grid-cols-12 gap-4">
              {/* Left: master + apartment types */}
              <aside className="col-span-2 bg-card rounded-lg border p-3 space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 px-1">תצוגה / View</div>

                {/* Master pinned at top */}
                <button onClick={() => setView('standard')}
                  className={`w-full text-right px-3 py-2 rounded-md text-sm transition-colors border-2 ${
                    view === 'standard'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-primary/40 bg-primary/5 hover:bg-primary/10 text-foreground'
                  }`} dir="rtl">
                  <div className="flex items-center justify-end gap-1.5 font-semibold">
                    <span>דירת סטנדרט</span>
                    <Star className="w-3.5 h-3.5 fill-current" />
                  </div>
                  <div className={`text-[10px] ${view === 'standard' ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                    Standard Apartment · Master
                  </div>
                </button>

                <div className="h-px bg-border my-2" />

                {APARTMENT_TYPES.map(t => (
                  <button key={t} onClick={() => setView(t)}
                    className={`w-full text-right px-3 py-2 rounded-md text-sm transition-colors ${
                      view === t ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-foreground'
                    }`} dir="rtl">
                    <div className="font-semibold">{APARTMENT_LABELS_HE[t]}</div>
                    <div className={`text-[10px] ${view === t ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
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
                            {view !== 'standard' && <span title="Qty/Package">/ {t.qtyPerPackage}</span>}
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
                    <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      {view === 'standard' && <Star className="w-3.5 h-3.5 fill-primary text-primary" />}
                      {view === 'standard' ? 'דירת סטנדרט' : APARTMENT_LABELS_HE[view as ApartmentType]} ×{' '}
                      {categories.find(c => c.id === selectedCategoryId)?.nameHe || '—'}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {view === 'standard' ? 'Master Template' : ROOM_SIZE_LABELS[view as ApartmentType]} ×{' '}
                      {categories.find(c => c.id === selectedCategoryId)?.nameEn || ''}
                      {view !== 'standard' && ` · ${unitCounts[view as ApartmentType] || 0} units in hotel`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" onClick={exportEditorCsv} className="h-7 text-xs">
                      <Download className="w-3 h-3" /> CSV
                    </Button>
                    {view === 'standard' && (
                      <Button size="sm" onClick={addMasterItem} disabled={!selectedCategoryId} className="h-7 text-xs">
                        <Plus className="w-3 h-3" /> Add Item
                      </Button>
                    )}
                  </div>
                </div>

                {itemsForCategory.length === 0 ? (
                  view === 'standard' ? (
                    <div className="text-center py-12 border-2 border-dashed border-primary/30 rounded-lg bg-primary/5">
                      <p className="text-sm text-foreground mb-3" dir="rtl">
                        אין עדיין פריטים ל-{categories.find(c => c.id === selectedCategoryId)?.nameHe || '—'}
                      </p>
                      <p className="text-xs text-muted-foreground mb-4">
                        Define items here and they'll appear in all 5 apartment types.
                      </p>
                      <Button size="sm" onClick={addMasterItem} disabled={!selectedCategoryId}>
                        <Plus className="w-3 h-3" /> הוסף פריט חדש · Add Item
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-12 border-2 border-dashed border-muted rounded-lg">
                      <p className="text-sm text-muted-foreground mb-3" dir="rtl">
                        אין פריטים מוגדרים — נהל פריטים בדירת סטנדרט
                      </p>
                      <p className="text-xs text-muted-foreground mb-4">Manage items in Standard Apartment</p>
                      <Button size="sm" variant="outline" onClick={() => setView('standard')}>
                        <Star className="w-3 h-3" /> Open Standard Apartment
                      </Button>
                    </div>
                  )
                ) : view === 'standard' ? (
                  <MasterEditor
                    items={itemsForCategory}
                    qtysByItem={qtysByItem}
                    suppliers={suppliers}
                    onUpdateItem={updateMasterItem}
                    onDeleteItem={deleteMasterItem}
                    onUpdateQty={updateQty}
                    onMoveItem={moveMasterItem}
                    onReorder={(ids) => reorderMasterItems(selectedCategoryId, ids)}
                    unitCounts={unitCounts}
                  />
                ) : (
                  <TypeEditor
                    items={itemsForCategory}
                    qtysByItem={qtysByItem}
                    suppliers={suppliers}
                    apartmentType={view}
                    unitCounts={unitCounts}
                    onUpdateQty={updateQty}
                    onJumpToMaster={() => setView('standard')}
                  />
                )}
              </section>
            </div>
          </>
        )}

        {subView === 'byCategory' && (
          <ByCategoryView categories={visibleCategories} selectedId={byCategoryPick}
            onSelect={setByCategoryPick} items={items} qtysByItem={qtysByItem}
            suppliers={suppliers} unitCounts={unitCounts} />
        )}

        {subView === 'hotelTotals' && (
          <HotelTotalsView categories={visibleCategories} items={items}
            qtysByItem={qtysByItem} unitCounts={unitCounts} />
        )}
      </div>
    </TooltipProvider>
  );
}

// ───────────────────────────── Summary Bar ─────────────────────────────
type TypeSummary = {
  units: number; numCategories: number; numItems: number; qtyPerSingle: number;
  totalHotelQty: number; totalPackageCost: number; totalHotelCost: number;
  orderedValue: number; deliveredValue: number; outstandingValue: number;
};
function SummaryBar({ s, typeLabel, isMaster }: { s: TypeSummary; typeLabel: string; isMaster: boolean }) {
  const cells = [
    [isMaster ? 'Units (all types)' : 'Units in Hotel', s.units.toLocaleString()],
    ['# Categories', s.numCategories.toLocaleString()],
    ['# Items', s.numItems.toLocaleString()],
    ...(isMaster ? [] : [['Qty / Apartment', s.qtyPerSingle.toLocaleString()] as const]),
    ['Hotel Qty', s.totalHotelQty.toLocaleString()],
    ['Package Cost', eur(s.totalPackageCost)],
    ['Hotel Cost', eur(s.totalHotelCost)],
    ['Ordered', eur(s.orderedValue)],
    ['Delivered', eur(s.deliveredValue)],
    ['Outstanding', eur(s.outstandingValue)],
  ] as const;
  return (
    <div className={`bg-card border rounded-lg p-3 ${isMaster ? 'border-primary/40' : ''}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
        {isMaster && <Star className="w-3 h-3 fill-primary text-primary" />}
        Summary · {typeLabel}
      </div>
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

// ───────────────────────────── Master Editor ─────────────────────────────
function MasterEditor({
  items, qtysByItem, suppliers, onUpdateItem, onDeleteItem, onUpdateQty, onMoveItem, onReorder, unitCounts,
}: {
  items: StandardItem[];
  qtysByItem: Map<string, Record<ApartmentType, ApartmentTypeQuantity | undefined>>;
  suppliers: Supplier[];
  onUpdateItem: (id: string, patch: Partial<StandardItem>) => void;
  onDeleteItem: (id: string) => void;
  onUpdateQty: (id: string, patch: Partial<ApartmentTypeQuantity>) => void;
  onMoveItem: (id: string, direction: -1 | 1) => void;
  onReorder: (orderedIds: string[]) => void;
  unitCounts: Record<RoomSize, number>;
}) {
  const th = 'text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-2 py-1.5 whitespace-nowrap';

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = items.map(i => i.id);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const newOrder = arrayMove(ids, oldIndex, newIndex);
    onReorder(newOrder);
  };

  return (
    <div className="overflow-x-auto -mx-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <table className="w-full text-xs">
          <thead className="bg-primary/5 border-y">
            <tr>
              <th className={`${th} w-10 text-center`} title="Drag to reorder"></th>
              <th className={th}>Item</th>
              <th className={th}>Spec</th>
              <th className={`${th} text-right`}>Unit Price €</th>
              <th className={th}>Supplier</th>
              <th className={th}>Per-Type Quantities</th>
              <th className={th}></th>
            </tr>
          </thead>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <tbody>
              {items.map((it, idx) => (
                <SortableItemRow
                  key={it.id}
                  it={it}
                  idx={idx}
                  isLast={idx === items.length - 1}
                  qtysByItem={qtysByItem}
                  suppliers={suppliers}
                  onUpdateItem={onUpdateItem}
                  onDeleteItem={onDeleteItem}
                  onUpdateQty={onUpdateQty}
                  onMoveItem={onMoveItem}
                />
              ))}
            </tbody>
          </SortableContext>
        </table>
      </DndContext>
    </div>
  );
}

// One sortable row inside MasterEditor
function SortableItemRow({
  it, idx, isLast, qtysByItem, suppliers, onUpdateItem, onDeleteItem, onUpdateQty, onMoveItem,
}: {
  it: StandardItem;
  idx: number;
  isLast: boolean;
  qtysByItem: Map<string, Record<ApartmentType, ApartmentTypeQuantity | undefined>>;
  suppliers: Supplier[];
  onUpdateItem: (id: string, patch: Partial<StandardItem>) => void;
  onDeleteItem: (id: string) => void;
  onUpdateQty: (id: string, patch: Partial<ApartmentTypeQuantity>) => void;
  onMoveItem: (id: string, direction: -1 | 1) => void;
}) {
  const inputCls = 'w-full h-7 px-2 text-xs border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary';
  const td = 'px-2 py-1.5 align-middle';
  const isFirst = idx === 0;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: it.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: isDragging ? 'hsl(var(--accent) / 0.15)' : undefined,
  };

  const row = qtysByItem.get(it.id);
  const summary = APARTMENT_TYPES.map(at => {
    const q = row?.[at];
    const total = q ? (q.qtyPerPackage || 0) + (q.sparePerPackage || 0) : 0;
    return { at, total };
  });

  return (
    <tr ref={setNodeRef} style={style} className="border-b last:border-0 hover:bg-muted/30">
      <td className={`${td} text-center`}>
        <div className="flex items-center justify-center gap-1">
          <button
            ref={undefined}
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-primary touch-none"
            title="גרור לסידור · Drag to reorder"
            aria-label="Drag handle"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <button
              onClick={() => onMoveItem(it.id, -1)}
              disabled={isFirst}
              className="text-muted-foreground hover:text-primary disabled:opacity-20 disabled:cursor-not-allowed"
              title="Move up"
            >
              <ArrowUp className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={() => onMoveItem(it.id, 1)}
              disabled={isLast}
              className="text-muted-foreground hover:text-primary disabled:opacity-20 disabled:cursor-not-allowed"
              title="Move down"
            >
              <ArrowDown className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      </td>
      <td className={td}>
        <Input className={inputCls + ' min-w-[160px] font-medium'} value={it.itemName}
          onChange={e => onUpdateItem(it.id, { itemName: e.target.value })}
          placeholder="Item name…" />
      </td>
      <td className={td}>
        <Input className={inputCls + ' min-w-[140px]'} value={it.spec}
          onChange={e => onUpdateItem(it.id, { spec: e.target.value })}
          placeholder="Spec/model" />
      </td>
      <td className={td}>
        <Input type="number" step="0.01" className={inputCls + ' text-right w-24'}
          value={it.unitPriceEur ?? ''}
          onChange={e => onUpdateItem(it.id, { unitPriceEur: e.target.value === '' ? undefined : Math.max(0, +e.target.value) })} />
      </td>
      <td className={td}>
        <select className={inputCls + ' min-w-[120px]'} value={it.supplierId || ''}
          onChange={e => onUpdateItem(it.id, { supplierId: e.target.value || undefined })}>
          <option value="">—</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </td>
      <td className={td}>
        <Popover>
          <PopoverTrigger asChild>
            <button className="font-mono text-[11px] px-2 py-1 rounded bg-muted hover:bg-accent/30 transition-colors whitespace-nowrap">
              {summary.map(s => `${labelShort(s.at)}:${s.total}`).join(' · ')}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3" align="end">
            <div className="text-xs font-semibold mb-2">Quick-edit per apartment type</div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left py-1">Type</th>
                  <th className="text-right py-1">Qty/Pkg</th>
                  <th className="text-right py-1">Spare</th>
                  <th className="text-right py-1">Total</th>
                </tr>
              </thead>
              <tbody>
                {APARTMENT_TYPES.map(at => {
                  const q = row?.[at];
                  if (!q) return null;
                  const total = (q.qtyPerPackage || 0) + (q.sparePerPackage || 0);
                  return (
                    <tr key={at} className="border-t">
                      <td className="py-1 pr-2">{labelShort(at)}</td>
                      <td className="py-1">
                        <Input type="number" className={inputCls + ' text-right w-16'}
                          value={q.qtyPerPackage}
                          onChange={e => onUpdateQty(q.id, { qtyPerPackage: Math.max(0, +e.target.value) })} />
                      </td>
                      <td className="py-1">
                        <Input type="number" className={inputCls + ' text-right w-16'}
                          value={q.sparePerPackage}
                          onChange={e => onUpdateQty(q.id, { sparePerPackage: Math.max(0, +e.target.value) })} />
                      </td>
                      <td className="py-1 text-right font-mono font-semibold">{total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </PopoverContent>
        </Popover>
      </td>
      <td className={td}>
        <button onClick={() => onDeleteItem(it.id)}
          className="p-1 text-muted-foreground hover:text-destructive" title="Delete from all types">
          <Trash2 className="w-3 h-3" />
        </button>
      </td>
    </tr>
  );
}

function labelShort(at: ApartmentType): string {
  return at === 'studio' ? 'Studio' : at.toUpperCase();
}

// ───────────────────────────── Type Editor (real apartment) ─────────────────────────────
function TypeEditor({
  items, qtysByItem, suppliers, apartmentType, unitCounts, onUpdateQty, onJumpToMaster,
}: {
  items: StandardItem[];
  qtysByItem: Map<string, Record<ApartmentType, ApartmentTypeQuantity | undefined>>;
  suppliers: Supplier[];
  apartmentType: ApartmentType;
  unitCounts: Record<RoomSize, number>;
  onUpdateQty: (id: string, patch: Partial<ApartmentTypeQuantity>) => void;
  onJumpToMaster: () => void;
}) {
  const inputCls = 'w-full h-7 px-2 text-xs border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary';
  const readOnlyCls = 'inline-flex items-center gap-1 text-muted-foreground italic';
  const th = 'text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-2 py-1.5 whitespace-nowrap';
  const td = 'px-2 py-1.5 align-middle';

  const ReadOnlyChip = ({ children }: { children: React.ReactNode }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button onClick={onJumpToMaster} className={readOnlyCls + ' hover:text-primary cursor-pointer'}>
          <Lock className="w-2.5 h-2.5" /> {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>Edit in Standard Apartment</TooltipContent>
    </Tooltip>
  );

  return (
    <div className="overflow-x-auto -mx-3">
      <table className="w-full text-xs">
        <thead className="bg-muted/50 border-y">
          <tr>
            <th className={th}>Item</th>
            <th className={th}>Spec</th>
            <th className={`${th} text-right`}>Qty/Pkg</th>
            <th className={`${th} text-right`}>€/Unit</th>
            <th className={`${th} text-right`}>Spare</th>
            <th className={`${th} text-right`}>Total/Pkg</th>
            <th className={`${th} text-right`}>Units</th>
            <th className={`${th} text-right`}>Hotel Qty</th>
            <th className={th}>Supplier</th>
            <th className={`${th} text-right`}>Pkg Cost</th>
            <th className={`${th} text-right`}>Hotel Cost</th>
            <th className={th}>Status</th>
            <th className={`${th} text-right`}>Ord</th>
            <th className={`${th} text-right`}>Del</th>
            <th className={`${th} text-right`}>Outstd</th>
            <th className={th}>Notes</th>
          </tr>
        </thead>
        <tbody>
          {items.map(it => {
            const q = qtysByItem.get(it.id)?.[apartmentType];
            if (!q) return null;
            const c = computeQuantity(q, it, unitCounts);
            const supplierName = suppliers.find(s => s.id === it.supplierId)?.name || '—';
            return (
              <tr key={it.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className={td}><ReadOnlyChip>{it.itemName || '(unnamed)'}</ReadOnlyChip></td>
                <td className={td}><ReadOnlyChip>{it.spec || '—'}</ReadOnlyChip></td>
                <td className={td}>
                  <Input type="number" className={inputCls + ' text-right w-16'} value={q.qtyPerPackage}
                    onChange={e => onUpdateQty(q.id, { qtyPerPackage: Math.max(0, +e.target.value) })} />
                </td>
                <td className={`${td} text-right font-mono`}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button onClick={onJumpToMaster} className="text-muted-foreground italic hover:text-primary">
                        {(it.unitPriceEur || 0).toFixed(2)}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Edit in Standard Apartment</TooltipContent>
                  </Tooltip>
                </td>
                <td className={td}>
                  <Input type="number" className={inputCls + ' text-right w-14'} value={q.sparePerPackage}
                    onChange={e => onUpdateQty(q.id, { sparePerPackage: Math.max(0, +e.target.value) })} />
                </td>
                <td className={`${td} text-right font-mono`}>{c.totalPerPkg}</td>
                <td className={`${td} text-right font-mono text-muted-foreground`}>{c.units}</td>
                <td className={`${td} text-right font-mono font-semibold`}>{c.hotelQty.toLocaleString()}</td>
                <td className={td}><ReadOnlyChip>{supplierName}</ReadOnlyChip></td>
                <td className={`${td} text-right font-mono`}>{eur(c.packageCost)}</td>
                <td className={`${td} text-right font-mono font-semibold`}>{eur(c.hotelCost)}</td>
                <td className={td}>
                  <select className={`${inputCls} ${STATUS_COLORS[q.status]} font-medium`} value={q.status}
                    onChange={e => onUpdateQty(q.id, { status: e.target.value as StandardStatus })}>
                    {STANDARD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className={td}>
                  <Input type="number" className={inputCls + ' text-right w-14'} value={q.orderedQty}
                    onChange={e => onUpdateQty(q.id, { orderedQty: Math.max(0, +e.target.value) })} />
                </td>
                <td className={td}>
                  <Input type="number" className={inputCls + ' text-right w-14'} value={q.deliveredQty}
                    onChange={e => onUpdateQty(q.id, { deliveredQty: Math.max(0, +e.target.value) })} />
                </td>
                <td className={`${td} text-right font-mono ${c.outstandingQty > 0 ? 'text-yellow-700' : 'text-muted-foreground'}`}>
                  {c.outstandingQty.toLocaleString()}
                </td>
                <td className={td}>
                  <Input className={inputCls + ' min-w-[100px]'} value={q.notes}
                    onChange={e => onUpdateQty(q.id, { notes: e.target.value })} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="text-[10px] text-muted-foreground mt-2 px-3 flex items-center gap-1">
        <Lock className="w-2.5 h-2.5" />
        Item / Spec / Unit Price / Supplier are managed in
        <button onClick={onJumpToMaster} className="text-primary hover:underline inline-flex items-center gap-0.5">
          Standard Apartment <ExternalLink className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  );
}

// ───────────────────────────── By Category View ─────────────────────────────
function ByCategoryView({
  categories, selectedId, onSelect, items, qtysByItem, suppliers, unitCounts,
}: {
  categories: ProcurementCategory[]; selectedId: string;
  onSelect: (id: string) => void;
  items: StandardItem[];
  qtysByItem: Map<string, Record<ApartmentType, ApartmentTypeQuantity | undefined>>;
  suppliers: Supplier[]; unitCounts: Record<RoomSize, number>;
}) {
  const cat = categories.find(c => c.id === selectedId);
  const rows = useMemo(() => {
    return items.filter(i => i.categoryId === selectedId).map(it => {
      const row = qtysByItem.get(it.id);
      const perType: Record<ApartmentType, number> = { studio: 0, '1br': 0, '2br': 0, '3br': 0, '4br': 0 };
      let grandQty = 0, grandCost = 0;
      APARTMENT_TYPES.forEach(at => {
        const q = row?.[at]; if (!q) return;
        const c = computeQuantity(q, it, unitCounts);
        perType[at] = c.hotelQty;
        grandQty += c.hotelQty;
        grandCost += c.hotelCost;
      });
      return { it, perType, grandQty, grandCost };
    }).sort((a, b) => b.grandQty - a.grandQty);
  }, [items, qtysByItem, selectedId, unitCounts]);

  const totalQty = rows.reduce((s, g) => s + g.grandQty, 0);
  const totalCost = rows.reduce((s, g) => s + g.grandCost, 0);

  return (
    <div className="space-y-3">
      <div className="bg-card border rounded-lg p-3 flex items-center gap-3">
        <span className="text-xs text-muted-foreground">קטגוריה / Category:</span>
        <select className="border rounded px-2 py-1 text-sm bg-background min-w-[280px]"
          value={selectedId} onChange={e => onSelect(e.target.value)} dir="rtl">
          {categories.map(c => <option key={c.id} value={c.id}>{c.nameHe} · {c.nameEn}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-4 text-xs">
          <div><span className="text-muted-foreground">Items:</span> <span className="font-semibold">{rows.length}</span></div>
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
              {APARTMENT_TYPES.map(t => (
                <th key={t} className="text-right px-3 py-2 font-medium">{ROOM_SIZE_LABELS[t]}<br /><span className="text-[9px] text-muted-foreground">({unitCounts[t] || 0} units)</span></th>
              ))}
              <th className="text-right px-3 py-2 font-medium">Grand Qty</th>
              <th className="text-right px-3 py-2 font-medium">Unit Price €</th>
              <th className="text-right px-3 py-2 font-medium">Grand Cost</th>
              <th className="text-left px-3 py-2 font-medium">Supplier</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(g => (
              <tr key={g.it.id} className="border-t hover:bg-muted/30">
                <td className="px-3 py-2 font-medium">{g.it.itemName || '(unnamed)'}</td>
                <td className="px-3 py-2 text-muted-foreground">{g.it.spec}</td>
                {APARTMENT_TYPES.map(t => (
                  <td key={t} className="px-3 py-2 text-right font-mono">{g.perType[t] || '—'}</td>
                ))}
                <td className="px-3 py-2 text-right font-mono font-semibold">{g.grandQty.toLocaleString()}</td>
                <td className="px-3 py-2 text-right font-mono">{(g.it.unitPriceEur || 0).toFixed(2)}</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{eur(g.grandCost)}</td>
                <td className="px-3 py-2 text-muted-foreground">{suppliers.find(s => s.id === g.it.supplierId)?.name || '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7 + APARTMENT_TYPES.length} className="px-3 py-8 text-center text-muted-foreground">
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
  categories, items, qtysByItem, unitCounts,
}: {
  categories: ProcurementCategory[];
  items: StandardItem[];
  qtysByItem: Map<string, Record<ApartmentType, ApartmentTypeQuantity | undefined>>;
  unitCounts: Record<RoomSize, number>;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setOpen(o => ({ ...o, [id]: !o[id] }));

  const rows = useMemo(() => categories.map(cat => {
    const scoped = items.filter(i => i.categoryId === cat.id);
    let totalQty = 0, totalCost = 0;
    const perType: Record<ApartmentType, { qty: number; cost: number; items: number }> = {
      studio: { qty: 0, cost: 0, items: 0 },
      '1br': { qty: 0, cost: 0, items: 0 },
      '2br': { qty: 0, cost: 0, items: 0 },
      '3br': { qty: 0, cost: 0, items: 0 },
      '4br': { qty: 0, cost: 0, items: 0 },
    };
    scoped.forEach(it => {
      const row = qtysByItem.get(it.id); if (!row) return;
      APARTMENT_TYPES.forEach(at => {
        const q = row[at]; if (!q) return;
        const c = computeQuantity(q, it, unitCounts);
        perType[at].qty += c.hotelQty;
        perType[at].cost += c.hotelCost;
        if (c.hotelQty > 0) perType[at].items += 1;
        totalQty += c.hotelQty;
        totalCost += c.hotelCost;
      });
    });
    return { cat, totalQty, totalCost, items: scoped.length, perType };
  }), [categories, items, qtysByItem, unitCounts]);

  const grandQty = rows.reduce((s, r) => s + r.totalQty, 0);
  const grandCost = rows.reduce((s, r) => s + r.totalCost, 0);

  return (
    <div className="space-y-3">
      <div className="bg-card border rounded-lg p-3 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div><div className="text-[10px] text-muted-foreground uppercase">Categories</div><div className="text-sm font-semibold">{rows.length}</div></div>
        <div><div className="text-[10px] text-muted-foreground uppercase">Total Items Defined</div><div className="text-sm font-semibold">{items.length}</div></div>
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
              <FragmentRow key={r.cat.id}>
                <tr className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => toggle(r.cat.id)}>
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
                        {APARTMENT_TYPES.map(t => (
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
              </FragmentRow>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ───────────────────────────── helpers ─────────────────────────────
function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  a.click(); URL.revokeObjectURL(url);
}
