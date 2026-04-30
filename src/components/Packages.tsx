import { useState, useMemo, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, X, ImageIcon, Package as PackageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Package, PackageLineItem, loadPackages, savePackages, subscribePackages,
  generatePackageId, getRoomTypesForBlock, BlockRoomType,
  getRoomTypesByFloorForBlock, floorLabel,
} from '@/data/packagesData';
import { ChevronRight } from 'lucide-react';
import {
  CatalogProduct, loadCatalog, subscribeCatalog,
} from '@/data/catalogData';
import { Concept } from '@/data/masterData';
import { toast } from '@/hooks/use-toast';

const BLOCKS: { id: Concept; label: string }[] = [
  { id: 'A', label: 'Block A (HAPPINESS)' },
  { id: 'B', label: 'Block B (WELLNESS)' },
  { id: 'C', label: 'Block C (BOUTIQUE)' },
];

interface FormState {
  name: string;
  description: string;
  items: PackageLineItem[];
  roomTypes: string[];
}

const emptyForm = (): FormState => ({
  name: '',
  description: '',
  items: [],
  roomTypes: [],
});

function priceOf(p: CatalogProduct | undefined): number {
  return p?.unitPriceEur ?? 0;
}

export default function Packages() {
  const [packages, setPackages] = useState<Package[]>(loadPackages);
  const [catalog, setCatalog] = useState<CatalogProduct[]>(loadCatalog);
  const [activeBlock, setActiveBlock] = useState<Concept>('A');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [rtSearch, setRtSearch] = useState('');
  const [expandedFloors, setExpandedFloors] = useState<Set<number>>(new Set());

  useEffect(() => subscribePackages(setPackages), []);
  useEffect(() => subscribeCatalog(setCatalog), []);

  const persist = useCallback((data: Package[]) => {
    setPackages(data);
    savePackages(data);
  }, []);

  const catalogById = useMemo(() => {
    const m = new Map<string, CatalogProduct>();
    catalog.forEach(p => m.set(p.id, p));
    return m;
  }, [catalog]);

  const blockRoomTypes: BlockRoomType[] = useMemo(
    () => getRoomTypesForBlock(activeBlock),
    [activeBlock]
  );

  const roomTypesByFloor = useMemo(() => {
    const list = getRoomTypesByFloorForBlock(activeBlock);
    const groups = new Map<number, typeof list>();
    list.forEach(rt => {
      if (!groups.has(rt.floor)) groups.set(rt.floor, []);
      groups.get(rt.floor)!.push(rt);
    });
    return Array.from(groups.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([floor, items]) => ({ floor, items }));
  }, [activeBlock]);

  const visiblePackages = useMemo(
    () => packages.filter(p => p.block === activeBlock),
    [packages, activeBlock]
  );

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm());
    setRtSearch('');
    setExpandedFloors(new Set());
    setEditorOpen(true);
  };

  const openEdit = (p: Package) => {
    setEditId(p.id);
    setForm({
      name: p.name,
      description: p.description,
      items: p.items.map(it => ({ ...it })),
      roomTypes: [...p.roomTypes],
    });
    setRtSearch('');
    setExpandedFloors(new Set());
    setEditorOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    let next: Package[];
    if (editId) {
      next = packages.map(p => p.id === editId
        ? { ...p, name: form.name.trim(), description: form.description, items: form.items, roomTypes: form.roomTypes }
        : p);
    } else {
      const newPkg: Package = {
        id: generatePackageId(),
        name: form.name.trim(),
        description: form.description,
        block: activeBlock,
        items: form.items,
        roomTypes: form.roomTypes,
      };
      next = [...packages, newPkg];
    }
    persist(next);
    setEditorOpen(false);
    toast({ title: editId ? 'Package updated' : 'Package created' });
  };

  const handleDelete = () => {
    if (!deleteId) return;
    persist(packages.filter(p => p.id !== deleteId));
    setDeleteId(null);
    toast({ title: 'Package deleted' });
  };

  const addProductToForm = (productId: string) => {
    const existing = form.items.find(it => it.productId === productId);
    if (existing) {
      setForm({
        ...form,
        items: form.items.map(it => it.productId === productId ? { ...it, quantity: it.quantity + 1 } : it),
      });
    } else {
      setForm({ ...form, items: [...form.items, { productId, quantity: 1 }] });
    }
  };

  const updateItemQty = (productId: string, qty: number) => {
    setForm({
      ...form,
      items: form.items.map(it => it.productId === productId ? { ...it, quantity: Math.max(1, qty) } : it),
    });
  };

  const removeItem = (productId: string) => {
    setForm({ ...form, items: form.items.filter(it => it.productId !== productId) });
  };

  const setTokens = (tokens: string[]) => {
    setForm(f => ({ ...f, roomTypes: tokens }));
  };

  const toggleToken = (token: string) => {
    setForm(f => ({
      ...f,
      roomTypes: f.roomTypes.includes(token)
        ? f.roomTypes.filter(t => t !== token)
        : [...f.roomTypes, token],
    }));
  };

  const formTotal = useMemo(
    () => form.items.reduce((s, it) => s + priceOf(catalogById.get(it.productId)) * it.quantity, 0),
    [form.items, catalogById]
  );

  const filteredCatalog = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.supplierName.toLowerCase().includes(q)
    );
  }, [catalog, pickerSearch]);

  const computeCardTotal = (p: Package): number =>
    p.items.reduce((s, it) => s + priceOf(catalogById.get(it.productId)) * it.quantity, 0);

  const roomTypeLabel = (code: string) => {
    const rt = blockRoomTypes.find(r => r.code === code);
    return rt ? `${rt.code} (${rt.description})` : code;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <PackageIcon className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold text-foreground">Packages</h2>
          <span className="text-xs text-muted-foreground">
            Reusable furniture packages built from the Catalog
          </span>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="w-4 h-4" /> Create Package
        </Button>
      </div>

      <Tabs value={activeBlock} onValueChange={(v) => setActiveBlock(v as Concept)}>
        <TabsList>
          {BLOCKS.map(b => (
            <TabsTrigger key={b.id} value={b.id}>{b.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="text-xs text-muted-foreground">
        {visiblePackages.length} package{visiblePackages.length === 1 ? '' : 's'} in {BLOCKS.find(b => b.id === activeBlock)?.label}
      </div>

      {visiblePackages.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-card border rounded-lg">
          No packages yet in this block. Click "Create Package" to start.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visiblePackages.map(p => {
            const total = computeCardTotal(p);
            return (
              <div key={p.id} className="bg-card border rounded-lg p-4 flex flex-col gap-2 group">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-foreground truncate">{p.name}</h3>
                    {p.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{p.description}</p>
                    )}
                  </div>
                  <span className="text-sm font-bold text-foreground whitespace-nowrap">
                    €{total.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="text-xs text-muted-foreground">
                  {p.items.length} item{p.items.length === 1 ? '' : 's'}
                </div>

                {p.roomTypes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {p.roomTypes.map(rt => (
                      <Badge key={rt} variant="secondary" className="text-[10px] font-normal">
                        {rt}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="flex gap-1 mt-2 pt-2 border-t opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="outline" size="sm" className="flex-1 h-7 text-xs gap-1" onClick={() => openEdit(p)}>
                    <Pencil className="w-3 h-3" /> Edit
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                    onClick={() => setDeleteId(p.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Package' : 'Create Package'}</DialogTitle>
            <DialogDescription>
              {BLOCKS.find(b => b.id === activeBlock)?.label}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Studio Standard Package"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Optional notes about this package"
                rows={2}
              />
            </div>

            {/* Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => { setPickerSearch(''); setPickerOpen(true); }} className="gap-1">
                  <Plus className="w-3 h-3" /> Add Item
                </Button>
              </div>

              {form.items.length === 0 ? (
                <div className="text-xs text-muted-foreground border rounded-md p-4 text-center">
                  No items yet. Click "Add Item" to pick from the Catalog.
                </div>
              ) : (
                <div className="border rounded-md divide-y">
                  {form.items.map(it => {
                    const prod = catalogById.get(it.productId);
                    const price = priceOf(prod);
                    const lineTotal = price * it.quantity;
                    return (
                      <div key={it.productId} className="flex items-center gap-3 p-2">
                        <div className="w-12 h-12 bg-muted rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                          {prod?.imageUrl ? (
                            <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">
                            {prod?.name || <span className="italic text-muted-foreground">Deleted product</span>}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {prod?.supplierName || '—'} · €{price.toFixed(2)}
                          </div>
                        </div>
                        <Input
                          type="number"
                          min={1}
                          value={it.quantity}
                          onChange={e => updateItemQty(it.productId, parseInt(e.target.value) || 1)}
                          className="w-16 h-8 text-sm text-center"
                        />
                        <div className="w-20 text-right text-sm font-semibold whitespace-nowrap">
                          €{lineTotal.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeItem(it.productId)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                  <div className="flex justify-between items-center px-3 py-2 bg-muted/30">
                    <span className="text-xs font-medium text-muted-foreground">Total</span>
                    <span className="text-base font-bold text-foreground">
                      €{formTotal.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Room Types */}
            <div className="space-y-2">
              <Label>Compatible Room Types ({BLOCKS.find(b => b.id === activeBlock)?.label})</Label>
              {roomTypesByFloor.length === 0 ? (
                <div className="text-xs text-muted-foreground">No room types available for this block.</div>
              ) : (() => {
                const q = rtSearch.trim().toLowerCase();
                const matches = (rt: { code: string; description: string }) =>
                  !q || rt.code.toLowerCase().includes(q) || rt.description.toLowerCase().includes(q);

                const allVisibleTokens: string[] = [];
                roomTypesByFloor.forEach(g => g.items.forEach(rt => {
                  if (matches(rt)) allVisibleTokens.push(rt.token);
                }));

                const selectAllVisible = () => {
                  const set = new Set(form.roomTypes);
                  allVisibleTokens.forEach(t => set.add(t));
                  setTokens([...set]);
                };
                const deselectAllVisible = () => {
                  const set = new Set(form.roomTypes);
                  allVisibleTokens.forEach(t => set.delete(t));
                  setTokens([...set]);
                };

                return (
                  <div className="border rounded-md p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                          value={rtSearch}
                          onChange={e => setRtSearch(e.target.value)}
                          placeholder="Search room types..."
                          className="pl-8 h-8 text-xs"
                        />
                      </div>
                      <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={selectAllVisible}>
                        Select All
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={deselectAllVisible}>
                        Deselect All
                      </Button>
                    </div>

                    <div className="space-y-1">
                      {roomTypesByFloor.map(({ floor, items }) => {
                        const visibleItems = items.filter(matches);
                        if (visibleItems.length === 0) return null;
                        const isExpanded = expandedFloors.has(floor) || q.length > 0;
                        const visibleTokens = visibleItems.map(i => i.token);
                        const selectedInFloor = visibleTokens.filter(t => form.roomTypes.includes(t)).length;
                        const allSelected = selectedInFloor === visibleTokens.length && visibleTokens.length > 0;
                        const someSelected = selectedInFloor > 0 && !allSelected;

                        const toggleFloorExpand = () => {
                          const next = new Set(expandedFloors);
                          if (next.has(floor)) next.delete(floor); else next.add(floor);
                          setExpandedFloors(next);
                        };

                        const toggleAllInFloor = () => {
                          const set = new Set(form.roomTypes);
                          if (allSelected) {
                            visibleTokens.forEach(t => set.delete(t));
                          } else {
                            visibleTokens.forEach(t => set.add(t));
                          }
                          setTokens([...set]);
                        };

                        return (
                          <div key={floor} className="border rounded-md">
                            <div className="flex items-center justify-between px-2 py-1.5 bg-muted/30">
                              <button
                                type="button"
                                onClick={toggleFloorExpand}
                                className="flex items-center gap-1.5 text-xs font-medium text-foreground hover:text-accent"
                              >
                                <ChevronRight
                                  className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                />
                                {floorLabel(floor)}
                                <span className="text-muted-foreground font-normal">
                                  ({selectedInFloor}/{visibleTokens.length})
                                </span>
                              </button>
                              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                                All in floor
                                <Checkbox
                                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                                  onCheckedChange={toggleAllInFloor}
                                />
                              </label>
                            </div>
                            {isExpanded && (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2">
                                {visibleItems.map(rt => {
                                  const checked = form.roomTypes.includes(rt.token);
                                  return (
                                    <label key={rt.token} className="flex items-center gap-2 cursor-pointer text-xs">
                                      <Checkbox
                                        checked={checked}
                                        onCheckedChange={() => toggleToken(rt.token)}
                                      />
                                      <span className="text-foreground">
                                        <span className="font-medium">{rt.code}</span>
                                        <span className="text-muted-foreground"> ({rt.description})</span>
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editId ? 'Save Changes' : 'Create Package'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Catalog product picker */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Pick a Catalog Product</DialogTitle>
            <DialogDescription>Click a product to add it to the package.</DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={pickerSearch}
              onChange={e => setPickerSearch(e.target.value)}
              placeholder="Search by name, SKU, or supplier"
              className="pl-9"
              autoFocus
            />
          </div>

          <div className="overflow-y-auto flex-1 -mx-2 px-2">
            {filteredCatalog.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {catalog.length === 0 ? 'Catalog is empty. Add products in the Catalog tab first.' : 'No products match.'}
              </div>
            ) : (
              <div className="divide-y border rounded-md">
                {filteredCatalog.map(p => (
                  <button
                    key={p.id}
                    onClick={() => addProductToForm(p.id)}
                    className="w-full flex items-center gap-3 p-2 hover:bg-muted/50 text-left transition-colors"
                  >
                    <div className="w-12 h-12 bg-muted rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{p.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {p.supplierName || '—'}
                        {p.sku && ` · ${p.sku}`}
                      </div>
                    </div>
                    <div className="text-sm font-semibold whitespace-nowrap">
                      {p.unitPriceEur != null ? `€${p.unitPriceEur.toFixed(2)}` : '—'}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPickerOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this package?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
