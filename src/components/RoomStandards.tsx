import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Plus, Pencil, Trash2, Copy, Download, ChevronRight, ChevronDown,
  Info, X, Check, AlertCircle,
} from 'lucide-react';
import {
  ProcurementCategory, RoomStandard, StandardStatus, STANDARD_STATUSES,
  loadCategories, saveCategories, genCategoryId,
  loadStandards, saveStandards, emptyStandard, computeStandard,
  summarizeRoomSize, loadBudgets, saveBudgets, eur,
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

type SubView = 'editor' | 'bySupplier' | 'byCategory' | 'budget' | 'orderTracker';

const STATUS_COLORS: Record<StandardStatus, string> = {
  Planned: 'bg-muted text-muted-foreground',
  Quoted: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  Ordered: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  'Partially Delivered': 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
  Delivered: 'bg-green-500/15 text-green-700 dark:text-green-400',
  Cancelled: 'bg-destructive/15 text-destructive',
};

export default function RoomStandards() {
  const [categories, setCategories] = useState<ProcurementCategory[]>(loadCategories);
  const [standards, setStandards] = useState<RoomStandard[]>(loadStandards);
  const [budgets, setBudgets] = useState(loadBudgets);
  const [suppliers] = useState<Supplier[]>(loadSuppliers);

  const [selectedSize, setSelectedSize] = useState<RoomSize>('studio');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [subView, setSubView] = useState<SubView>('editor');

  // Category CRUD
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatNameEn, setEditCatNameEn] = useState('');
  const [editCatNameHe, setEditCatNameHe] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [newCatEn, setNewCatEn] = useState('');
  const [newCatHe, setNewCatHe] = useState('');

  const activeCategories = useMemo(
    () => categories.filter(c => !c.archived).sort((a, b) => a.order - b.order),
    [categories],
  );

  useEffect(() => {
    if (!selectedCategoryId && activeCategories.length > 0) {
      setSelectedCategoryId(activeCategories[0].id);
    }
  }, [activeCategories, selectedCategoryId]);

  const persistCategories = useCallback((next: ProcurementCategory[]) => {
    setCategories(next); saveCategories(next);
  }, []);
  const persistStandards = useCallback((next: RoomStandard[]) => {
    setStandards(next); saveStandards(next);
  }, []);
  const persistBudgets = useCallback((next: Record<string, number>) => {
    setBudgets(next); saveBudgets(next);
  }, []);

  // ── Category actions ──
  const addCategory = () => {
    if (!newCatEn.trim()) return;
    const next: ProcurementCategory = {
      id: genCategoryId(),
      nameEn: newCatEn.trim(),
      nameHe: newCatHe.trim() || newCatEn.trim(),
      scope: 'both',
      order: (categories.reduce((m, c) => Math.max(m, c.order), 0)) + 1,
    };
    persistCategories([...categories, next]);
    setNewCatEn(''); setNewCatHe(''); setAddingCat(false);
    setSelectedCategoryId(next.id);
  };

  const renameCategory = (id: string) => {
    if (!editCatNameEn.trim()) { setEditingCatId(null); return; }
    persistCategories(categories.map(c =>
      c.id === id ? { ...c, nameEn: editCatNameEn.trim(), nameHe: editCatNameHe.trim() || c.nameHe } : c,
    ));
    setEditingCatId(null);
  };

  const deleteCategory = (id: string) => {
    const cat = categories.find(c => c.id === id);
    const stdsInCat = standards.filter(s => s.categoryId === id).length;
    const msg = stdsInCat > 0
      ? `Delete "${cat?.nameEn}"? This will also remove ${stdsInCat} standard row(s).`
      : `Delete "${cat?.nameEn}"?`;
    if (!confirm(msg)) return;
    persistCategories(categories.filter(c => c.id !== id));
    persistStandards(standards.filter(s => s.categoryId !== id));
    if (selectedCategoryId === id) setSelectedCategoryId(null);
  };

  // ── Standard row actions ──
  const addStandard = () => {
    if (!selectedCategoryId) return;
    const std = emptyStandard(selectedSize, selectedCategoryId);
    persistStandards([...standards, std]);
  };

  const updateStandard = (id: string, patch: Partial<RoomStandard>) => {
    persistStandards(standards.map(s =>
      s.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s,
    ));
  };

  const deleteStandard = (id: string) => {
    persistStandards(standards.filter(s => s.id !== id));
  };

  const duplicateStandard = (id: string) => {
    const src = standards.find(s => s.id === id);
    if (!src) return;
    const now = new Date().toISOString();
    persistStandards([
      ...standards,
      { ...src, id: `std_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, createdAt: now, updatedAt: now },
    ]);
  };

  // Copy standard from another room size into selected (size, category)
  const [copyFromSize, setCopyFromSize] = useState<RoomSize | ''>('');
  const copyFromOtherSize = () => {
    if (!copyFromSize || !selectedCategoryId || copyFromSize === selectedSize) return;
    const src = standards.filter(s => s.roomSize === copyFromSize && s.categoryId === selectedCategoryId);
    if (src.length === 0) {
      alert(`No standards in ${ROOM_SIZE_LABELS[copyFromSize]} for this category to copy.`);
      return;
    }
    const now = new Date().toISOString();
    const cloned: RoomStandard[] = src.map(s => ({
      ...s,
      id: `std_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      roomSize: selectedSize,
      orderedQty: 0, deliveredQty: 0, status: 'Planned',
      createdAt: now, updatedAt: now,
    }));
    persistStandards([...standards, ...cloned]);
    setCopyFromSize('');
  };

  const standardsForCell = useMemo(
    () => standards.filter(s => s.roomSize === selectedSize && s.categoryId === selectedCategoryId),
    [standards, selectedSize, selectedCategoryId],
  );

  const summary = useMemo(() => summarizeRoomSize(selectedSize, standards), [selectedSize, standards]);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                Room Standards
                <span className="text-sm text-muted-foreground font-normal" dir="rtl">סטנדרט לפי סוג חדר</span>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    Define, per room type, exactly what each unit gets — the system auto-calculates
                    hotel-wide quantities, budget, and outstanding orders per category and per supplier.
                  </TooltipContent>
                </Tooltip>
              </h2>
              <p className="text-xs text-muted-foreground">Central hub for category-based procurement management</p>
            </div>
          </div>

          {/* Sub-view toggle */}
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            {([
              ['editor', 'Editor'],
              ['bySupplier', 'By Supplier'],
              ['byCategory', 'By Category'],
              ['budget', 'Budget'],
              ['orderTracker', 'Order Tracker'],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setSubView(k)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  subView === k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >{label}</button>
            ))}
          </div>
        </div>

        {/* Top summary bar */}
        <SummaryBar size={selectedSize} summary={summary} />

        {subView === 'editor' && (
          <div className="grid grid-cols-12 gap-4">
            {/* Left rail: room sizes */}
            <aside className="col-span-2 bg-card rounded-lg border shadow-sm p-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1.5">
                Room Size
              </div>
              {RESIDENTIAL_ROOM_SIZES.map(rs => {
                const counts = countUnitsByRoomSize();
                return (
                  <button
                    key={rs}
                    onClick={() => setSelectedSize(rs)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors mb-0.5 ${
                      selectedSize === rs
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <div className="font-medium">{ROOM_SIZE_LABELS[rs]}</div>
                    <div className={`text-[10px] ${selectedSize === rs ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {counts[rs]} units
                    </div>
                  </button>
                );
              })}
            </aside>

            {/* Center: categories */}
            <section className="col-span-3 bg-card rounded-lg border shadow-sm p-2">
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Categories
                </span>
                <button
                  onClick={() => setAddingCat(true)}
                  className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
                  title="Add category"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              {addingCat && (
                <div className="px-2 py-2 mb-1 border rounded-md bg-muted/30 space-y-1.5">
                  <Input
                    autoFocus value={newCatEn} onChange={e => setNewCatEn(e.target.value)}
                    placeholder="Name (English)" className="h-7 text-xs"
                  />
                  <Input
                    value={newCatHe} onChange={e => setNewCatHe(e.target.value)}
                    placeholder="שם בעברית" className="h-7 text-xs" dir="rtl"
                  />
                  <div className="flex gap-1">
                    <Button size="sm" className="h-6 text-xs flex-1" onClick={addCategory}>
                      <Check className="h-3 w-3 mr-1" />Add
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 text-xs"
                      onClick={() => { setAddingCat(false); setNewCatEn(''); setNewCatHe(''); }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="max-h-[60vh] overflow-y-auto">
                {activeCategories.map(cat => {
                  const skuCount = standards.filter(s => s.roomSize === selectedSize && s.categoryId === cat.id).length;
                  const isSelected = selectedCategoryId === cat.id;
                  const isEditing = editingCatId === cat.id;
                  return (
                    <div
                      key={cat.id}
                      onClick={() => !isEditing && setSelectedCategoryId(cat.id)}
                      className={`group px-3 py-2 rounded-md cursor-pointer mb-0.5 transition-colors ${
                        isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                      }`}
                    >
                      {isEditing ? (
                        <div className="space-y-1.5" onClick={e => e.stopPropagation()}>
                          <Input value={editCatNameEn} onChange={e => setEditCatNameEn(e.target.value)} className="h-6 text-xs" autoFocus />
                          <Input value={editCatNameHe} onChange={e => setEditCatNameHe(e.target.value)} className="h-6 text-xs" dir="rtl" />
                          <div className="flex gap-1">
                            <Button size="sm" className="h-5 text-[10px] px-2" onClick={() => renameCategory(cat.id)}>Save</Button>
                            <Button size="sm" variant="ghost" className="h-5 text-[10px] px-2" onClick={() => setEditingCatId(null)}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{cat.nameEn}</div>
                            <div className={`text-[10px] truncate ${isSelected ? 'opacity-80' : 'text-muted-foreground'}`} dir="rtl">
                              {cat.nameHe}
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className={`text-[10px] mr-1 ${isSelected ? 'opacity-80' : 'text-muted-foreground'}`}>
                              {skuCount}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingCatId(cat.id); setEditCatNameEn(cat.nameEn); setEditCatNameHe(cat.nameHe);
                              }}
                              className="h-5 w-5 rounded hover:bg-background/50 flex items-center justify-center"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteCategory(cat.id); }}
                              className="h-5 w-5 rounded hover:bg-destructive/20 hover:text-destructive flex items-center justify-center"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {activeCategories.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-6">No categories yet.</div>
                )}
              </div>
            </section>

            {/* Right: Standard editor */}
            <section className="col-span-7 bg-card rounded-lg border shadow-sm">
              <div className="flex items-center justify-between p-3 border-b flex-wrap gap-2">
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    {ROOM_SIZE_LABELS[selectedSize]} ·{' '}
                    {activeCategories.find(c => c.id === selectedCategoryId)?.nameEn || '—'}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Each row = one SKU in this category's standard for this room size
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={copyFromSize}
                    onChange={e => setCopyFromSize(e.target.value as RoomSize | '')}
                    className="h-8 rounded-md border bg-background px-2 text-xs"
                  >
                    <option value="">Copy from…</option>
                    {RESIDENTIAL_ROOM_SIZES.filter(s => s !== selectedSize).map(s => (
                      <option key={s} value={s}>{ROOM_SIZE_LABELS[s]}</option>
                    ))}
                  </select>
                  <Button size="sm" variant="outline" className="h-8" onClick={copyFromOtherSize} disabled={!copyFromSize}>
                    <Copy className="h-3 w-3 mr-1" />Clone
                  </Button>
                  <Button size="sm" className="h-8" onClick={addStandard} disabled={!selectedCategoryId}>
                    <Plus className="h-3 w-3 mr-1" />Add SKU
                  </Button>
                </div>
              </div>

              <StandardEditorTable
                standards={standardsForCell}
                suppliers={suppliers}
                onUpdate={updateStandard}
                onDelete={deleteStandard}
                onDuplicate={duplicateStandard}
              />
            </section>
          </div>
        )}

        {subView === 'bySupplier' && (
          <BySupplierView standards={standards} suppliers={suppliers} categories={categories} />
        )}
        {subView === 'byCategory' && (
          <ByCategoryView standards={standards} categories={categories} />
        )}
        {subView === 'budget' && (
          <BudgetView
            standards={standards} categories={categories}
            budgets={budgets} onUpdateBudget={persistBudgets}
          />
        )}
        {subView === 'orderTracker' && (
          <OrderTrackerView
            standards={standards} suppliers={suppliers} categories={categories}
            onUpdate={updateStandard}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

// ── Summary Bar ───────────────────────────────────────────────────────────
function SummaryBar({ size, summary }: { size: RoomSize; summary: ReturnType<typeof summarizeRoomSize> }) {
  const stats = [
    { label: 'Categories', value: summary.numCategories },
    { label: 'SKUs Defined', value: summary.numSkus },
    { label: `${ROOM_SIZE_LABELS[size]} Units`, value: summary.unitsOfSize },
    { label: 'Hotel Qty Needed', value: summary.totalQtyNeeded.toLocaleString() },
    { label: 'Total Budget', value: eur(summary.totalBudget), highlight: true },
    { label: 'Ordered', value: eur(summary.orderedValue) },
    { label: 'Delivered', value: eur(summary.deliveredValue) },
    { label: 'Outstanding', value: eur(summary.outstandingValue), warn: summary.outstandingValue > 0 },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 bg-card rounded-lg border shadow-sm p-3">
      {stats.map(s => (
        <div key={s.label} className="px-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
          <div className={`text-base font-semibold mt-0.5 ${
            s.highlight ? 'text-accent' : s.warn ? 'text-destructive' : 'text-foreground'
          }`}>
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Standard Editor Table ────────────────────────────────────────────────
function StandardEditorTable({
  standards, suppliers, onUpdate, onDelete, onDuplicate,
}: {
  standards: RoomStandard[];
  suppliers: Supplier[];
  onUpdate: (id: string, patch: Partial<RoomStandard>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}) {
  if (standards.length === 0) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground">
        No SKUs defined yet. Click <strong>Add SKU</strong> to start, or copy a standard from another room size.
      </div>
    );
  }
  const th = 'px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-left whitespace-nowrap';
  const td = 'px-2 py-1.5 align-middle';
  const inputCls = 'h-7 w-full rounded border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent/50';

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className={th}>Item Name</th>
            <th className={th}>Spec/Model</th>
            <th className={`${th} text-right`}>Qty/Unit</th>
            <th className={`${th} text-right`}>Spare</th>
            <th className={`${th} text-right`}>Total/Unit</th>
            <th className={`${th} text-right`}>Units</th>
            <th className={`${th} text-right`}>Hotel Qty</th>
            <th className={th}>Supplier</th>
            <th className={`${th} text-right`}>€/Unit</th>
            <th className={`${th} text-right`}>Line Cost</th>
            <th className={th}>Status</th>
            <th className={`${th} text-right`}>Ordered</th>
            <th className={`${th} text-right`}>Delivered</th>
            <th className={`${th} text-right`}>Outstanding</th>
            <th className={th}>Notes</th>
            <th className={th}></th>
          </tr>
        </thead>
        <tbody>
          {standards.map(std => {
            const c = computeStandard(std);
            return (
              <tr key={std.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className={td}>
                  <input className={`${inputCls} min-w-[140px]`} value={std.itemName}
                    onChange={e => onUpdate(std.id, { itemName: e.target.value })}
                    placeholder="Item name" />
                </td>
                <td className={td}>
                  <input className={`${inputCls} min-w-[120px]`} value={std.spec}
                    onChange={e => onUpdate(std.id, { spec: e.target.value })}
                    placeholder="Spec / model" />
                </td>
                <td className={td}>
                  <input type="number" min={0} className={`${inputCls} text-right w-16`} value={std.qtyPerUnit}
                    onChange={e => onUpdate(std.id, { qtyPerUnit: Number(e.target.value) || 0 })} />
                </td>
                <td className={td}>
                  <input type="number" min={0} className={`${inputCls} text-right w-16`} value={std.sparePerUnit}
                    onChange={e => onUpdate(std.id, { sparePerUnit: Number(e.target.value) || 0 })} />
                </td>
                <td className={`${td} text-right font-mono text-xs`}>{c.totalPerUnit}</td>
                <td className={`${td} text-right font-mono text-xs text-muted-foreground`}>{c.unitsInHotel}</td>
                <td className={`${td} text-right font-mono text-xs font-semibold`}>{c.hotelQtyNeeded.toLocaleString()}</td>
                <td className={td}>
                  <select className={`${inputCls} min-w-[120px]`} value={std.supplierId || ''}
                    onChange={e => onUpdate(std.id, { supplierId: e.target.value || undefined })}>
                    <option value="">—</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </td>
                <td className={td}>
                  <input type="number" min={0} step="0.01" className={`${inputCls} text-right w-20`}
                    value={std.unitPriceEur ?? ''} placeholder="—"
                    onChange={e => onUpdate(std.id, { unitPriceEur: e.target.value === '' ? undefined : Number(e.target.value) })} />
                </td>
                <td className={`${td} text-right font-mono text-xs font-semibold text-accent`}>
                  {std.unitPriceEur ? eur(c.lineCost) : '—'}
                </td>
                <td className={td}>
                  <select className={`${inputCls} min-w-[120px] ${STATUS_COLORS[std.status]}`} value={std.status}
                    onChange={e => onUpdate(std.id, { status: e.target.value as StandardStatus })}>
                    {STANDARD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className={td}>
                  <input type="number" min={0} className={`${inputCls} text-right w-16`} value={std.orderedQty}
                    onChange={e => onUpdate(std.id, { orderedQty: Number(e.target.value) || 0 })} />
                </td>
                <td className={td}>
                  <input type="number" min={0} className={`${inputCls} text-right w-16`} value={std.deliveredQty}
                    onChange={e => onUpdate(std.id, { deliveredQty: Number(e.target.value) || 0 })} />
                </td>
                <td className={`${td} text-right font-mono text-xs ${c.outstandingQty > 0 ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                  {c.outstandingQty.toLocaleString()}
                </td>
                <td className={td}>
                  <input className={`${inputCls} min-w-[100px]`} value={std.notes}
                    onChange={e => onUpdate(std.id, { notes: e.target.value })} placeholder="—" />
                </td>
                <td className={td}>
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => onDuplicate(std.id)}
                      className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
                      title="Duplicate row">
                      <Copy className="h-3 w-3" />
                    </button>
                    <button onClick={() => onDelete(std.id)}
                      className="h-6 w-6 rounded hover:bg-destructive/15 hover:text-destructive flex items-center justify-center text-muted-foreground"
                      title="Delete row">
                      <Trash2 className="h-3 w-3" />
                    </button>
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

// ── By Supplier ──────────────────────────────────────────────────────────
function BySupplierView({
  standards, suppliers, categories,
}: { standards: RoomStandard[]; suppliers: Supplier[]; categories: ProcurementCategory[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const grouped = useMemo(() => {
    const map = new Map<string, RoomStandard[]>();
    standards.forEach(s => {
      const key = s.supplierId || '__unassigned__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return map;
  }, [standards]);

  const supplierName = (id: string) =>
    id === '__unassigned__' ? 'Unassigned' : (suppliers.find(s => s.id === id)?.name || 'Unknown');
  const catName = (id: string) => categories.find(c => c.id === id)?.nameEn || '—';

  const exportPO = (supplierId: string, rows: RoomStandard[]) => {
    const sup = suppliers.find(s => s.id === supplierId);
    const lines: string[] = [];
    lines.push(`Purchase Order CSV`);
    lines.push(`Supplier,${sup?.name || 'Unassigned'}`);
    lines.push(`Contact,${sup?.contactPerson || ''}`);
    lines.push(`Email,${sup?.email || ''}`);
    lines.push(`Date,${new Date().toISOString().slice(0, 10)}`);
    lines.push('');
    lines.push('Room Size,Category,Item Name,Spec,Qty Needed,Ordered,Delivered,Unit Price (€),Line Cost (€),Status,Notes');
    let total = 0;
    rows.forEach(s => {
      const c = computeStandard(s);
      total += c.lineCost;
      const row = [
        ROOM_SIZE_LABELS[s.roomSize], catName(s.categoryId),
        s.itemName, s.spec, c.hotelQtyNeeded, s.orderedQty, s.deliveredQty,
        s.unitPriceEur ?? '', c.lineCost.toFixed(2), s.status, s.notes,
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
      lines.push(row);
    });
    lines.push('');
    lines.push(`,,,,,,,,Total,€${total.toFixed(2)}`);
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `PO_${(sup?.name || 'unassigned').replace(/\s+/g, '_')}_${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="bg-card rounded-lg border shadow-sm p-3 space-y-2">
      {grouped.size === 0 && (
        <div className="p-12 text-center text-sm text-muted-foreground">No standards defined yet.</div>
      )}
      {[...grouped.entries()].map(([supId, rows]) => {
        const isOpen = open[supId] ?? true;
        const totals = rows.reduce((acc, s) => {
          const c = computeStandard(s);
          acc.qty += c.hotelQtyNeeded;
          acc.ordered += s.orderedQty || 0;
          acc.delivered += s.deliveredQty || 0;
          acc.cost += c.lineCost;
          return acc;
        }, { qty: 0, ordered: 0, delivered: 0, cost: 0 });

        return (
          <div key={supId} className="border rounded-md">
            <div className="flex items-center justify-between p-3 bg-muted/30">
              <button
                onClick={() => setOpen(o => ({ ...o, [supId]: !isOpen }))}
                className="flex items-center gap-2 text-sm font-semibold flex-1 text-left"
              >
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {supplierName(supId)}
                <span className="text-xs font-normal text-muted-foreground">· {rows.length} SKU(s)</span>
              </button>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-muted-foreground">Qty: <span className="font-mono font-semibold text-foreground">{totals.qty}</span></span>
                <span className="text-muted-foreground">Ordered: <span className="font-mono">{totals.ordered}</span></span>
                <span className="text-muted-foreground">Delivered: <span className="font-mono">{totals.delivered}</span></span>
                <span className="text-accent font-semibold">{eur(totals.cost)}</span>
                {supId !== '__unassigned__' && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => exportPO(supId, rows)}>
                    <Download className="h-3 w-3 mr-1" />PO CSV
                  </Button>
                )}
              </div>
            </div>
            {isOpen && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-t bg-muted/10 text-muted-foreground">
                    <th className="px-3 py-1.5 text-left">Room</th>
                    <th className="px-3 py-1.5 text-left">Category</th>
                    <th className="px-3 py-1.5 text-left">Item</th>
                    <th className="px-3 py-1.5 text-right">Qty Needed</th>
                    <th className="px-3 py-1.5 text-right">Ordered</th>
                    <th className="px-3 py-1.5 text-right">Delivered</th>
                    <th className="px-3 py-1.5 text-right">Line Cost</th>
                    <th className="px-3 py-1.5 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(s => {
                    const c = computeStandard(s);
                    return (
                      <tr key={s.id} className="border-t">
                        <td className="px-3 py-1.5">{ROOM_SIZE_LABELS[s.roomSize]}</td>
                        <td className="px-3 py-1.5">{catName(s.categoryId)}</td>
                        <td className="px-3 py-1.5 font-medium">{s.itemName || <span className="text-muted-foreground italic">unnamed</span>}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{c.hotelQtyNeeded}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{s.orderedQty}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{s.deliveredQty}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{eur(c.lineCost)}</td>
                        <td className="px-3 py-1.5">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${STATUS_COLORS[s.status]}`}>{s.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── By Category Roll-up ──────────────────────────────────────────────────
function ByCategoryView({
  standards, categories,
}: { standards: RoomStandard[]; categories: ProcurementCategory[] }) {
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const active = categories.filter(c => !c.archived).sort((a, b) => a.order - b.order);
  useEffect(() => { if (!selectedCat && active.length > 0) setSelectedCat(active[0].id); }, [active, selectedCat]);

  if (!selectedCat) return null;
  const catRows = standards.filter(s => s.categoryId === selectedCat);

  const bySize = RESIDENTIAL_ROOM_SIZES.map(rs => {
    const rows = catRows.filter(s => s.roomSize === rs);
    const totals = rows.reduce((acc, s) => {
      const c = computeStandard(s);
      acc.qty += c.hotelQtyNeeded;
      acc.outstanding += c.outstandingQty;
      acc.cost += c.lineCost;
      acc.delivered += (s.deliveredQty || 0) * (s.unitPriceEur || 0);
      return acc;
    }, { qty: 0, outstanding: 0, cost: 0, delivered: 0 });
    return { rs, count: rows.length, ...totals };
  });

  return (
    <div className="bg-card rounded-lg border shadow-sm p-4 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Category:</span>
        <select className="h-8 rounded-md border bg-background px-2 text-sm"
          value={selectedCat} onChange={e => setSelectedCat(e.target.value)}>
          {active.map(c => <option key={c.id} value={c.id}>{c.nameEn}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {bySize.map(b => (
          <div key={b.rs} className="border rounded-md p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold">{ROOM_SIZE_LABELS[b.rs]}</div>
              {b.count > 0 && (
                <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${
                  b.outstanding === 0
                    ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                    : 'bg-destructive/15 text-destructive'
                }`}>
                  {b.outstanding === 0 ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                  {b.outstanding === 0 ? 'Complete' : `${b.outstanding} short`}
                </span>
              )}
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">SKUs</span><span className="font-mono">{b.count}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Qty Needed</span><span className="font-mono">{b.qty}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Budget</span><span className="font-mono font-semibold text-accent">{eur(b.cost)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Delivered</span><span className="font-mono">{eur(b.delivered)}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Budget Panel ─────────────────────────────────────────────────────────
function BudgetView({
  standards, categories, budgets, onUpdateBudget,
}: {
  standards: RoomStandard[];
  categories: ProcurementCategory[];
  budgets: Record<string, number>;
  onUpdateBudget: (b: Record<string, number>) => void;
}) {
  const active = categories.filter(c => !c.archived).sort((a, b) => a.order - b.order);
  return (
    <div className="bg-card rounded-lg border shadow-sm p-4 space-y-2">
      <div className="text-sm font-semibold mb-2">Budget vs Actual by Category</div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-[10px] uppercase tracking-wider text-muted-foreground">
            <th className="text-left py-2">Category</th>
            <th className="text-right py-2">Target Budget</th>
            <th className="text-right py-2">Actual Spend</th>
            <th className="text-right py-2">Variance</th>
            <th className="py-2 w-1/3">Progress</th>
          </tr>
        </thead>
        <tbody>
          {active.map(cat => {
            const actual = standards
              .filter(s => s.categoryId === cat.id)
              .reduce((sum, s) => sum + computeStandard(s).lineCost, 0);
            const target = budgets[cat.id] || 0;
            const variance = target - actual;
            const pct = target > 0 ? Math.min(100, (actual / target) * 100) : 0;
            const over = target > 0 && actual > target;
            return (
              <tr key={cat.id} className="border-b last:border-0">
                <td className="py-2">
                  <div className="font-medium text-sm">{cat.nameEn}</div>
                  <div className="text-[10px] text-muted-foreground" dir="rtl">{cat.nameHe}</div>
                </td>
                <td className="text-right py-2">
                  <input type="number" min={0} className="h-7 w-28 rounded border bg-background px-2 text-xs text-right"
                    value={target || ''} placeholder="0"
                    onChange={e => onUpdateBudget({ ...budgets, [cat.id]: Number(e.target.value) || 0 })} />
                </td>
                <td className="text-right py-2 font-mono text-xs">{eur(actual)}</td>
                <td className={`text-right py-2 font-mono text-xs font-semibold ${
                  target === 0 ? 'text-muted-foreground' : variance < 0 ? 'text-destructive' : 'text-green-600 dark:text-green-400'
                }`}>
                  {target === 0 ? '—' : (variance >= 0 ? '+' : '') + eur(variance)}
                </td>
                <td className="py-2">
                  {target > 0 && (
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full transition-all ${over ? 'bg-destructive' : 'bg-accent'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Order Tracker ────────────────────────────────────────────────────────
function OrderTrackerView({
  standards, suppliers, categories, onUpdate,
}: {
  standards: RoomStandard[]; suppliers: Supplier[]; categories: ProcurementCategory[];
  onUpdate: (id: string, patch: Partial<RoomStandard>) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<StandardStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const supName = (id?: string) => suppliers.find(s => s.id === id)?.name || '—';
  const catName = (id: string) => categories.find(c => c.id === id)?.nameEn || '—';

  const filtered = standards.filter(s => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (search && !(`${s.itemName} ${s.spec} ${supName(s.supplierId)}`.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  return (
    <div className="bg-card rounded-lg border shadow-sm p-3 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Input placeholder="Search items, suppliers…" value={search} onChange={e => setSearch(e.target.value)}
          className="h-8 max-w-xs text-sm" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StandardStatus | 'all')}
          className="h-8 rounded-md border bg-background px-2 text-xs">
          <option value="all">All statuses</option>
          {STANDARD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} row(s)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left py-2 px-2">Room</th>
              <th className="text-left py-2 px-2">Category</th>
              <th className="text-left py-2 px-2">Item</th>
              <th className="text-left py-2 px-2">Supplier</th>
              <th className="text-right py-2 px-2">Needed</th>
              <th className="text-right py-2 px-2">Ordered</th>
              <th className="text-right py-2 px-2">Delivered</th>
              <th className="text-right py-2 px-2">Outstanding</th>
              <th className="text-left py-2 px-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => {
              const c = computeStandard(s);
              return (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-1.5 px-2">{ROOM_SIZE_LABELS[s.roomSize]}</td>
                  <td className="py-1.5 px-2">{catName(s.categoryId)}</td>
                  <td className="py-1.5 px-2 font-medium">{s.itemName || <span className="italic text-muted-foreground">unnamed</span>}</td>
                  <td className="py-1.5 px-2 text-muted-foreground">{supName(s.supplierId)}</td>
                  <td className="py-1.5 px-2 text-right font-mono">{c.hotelQtyNeeded}</td>
                  <td className="py-1.5 px-2 text-right">
                    <input type="number" min={0} className="h-6 w-16 rounded border bg-background px-1 text-xs text-right"
                      value={s.orderedQty}
                      onChange={e => onUpdate(s.id, { orderedQty: Number(e.target.value) || 0 })} />
                  </td>
                  <td className="py-1.5 px-2 text-right">
                    <input type="number" min={0} className="h-6 w-16 rounded border bg-background px-1 text-xs text-right"
                      value={s.deliveredQty}
                      onChange={e => onUpdate(s.id, { deliveredQty: Number(e.target.value) || 0 })} />
                  </td>
                  <td className={`py-1.5 px-2 text-right font-mono ${c.outstandingQty > 0 ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                    {c.outstandingQty}
                  </td>
                  <td className="py-1.5 px-2">
                    <select value={s.status} onChange={e => onUpdate(s.id, { status: e.target.value as StandardStatus })}
                      className={`h-6 rounded border bg-background px-1 text-xs ${STATUS_COLORS[s.status]}`}>
                      {STANDARD_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
                    </select>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="py-12 text-center text-muted-foreground">No rows match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
