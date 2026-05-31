import { useState, useMemo, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, X, ImageIcon, Package as PackageIcon, GitCompare } from 'lucide-react';
import PackagesComparison from './PackagesComparison';
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
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

function ProductThumb({ src, alt }: { src?: string; alt: string }) {
  if (!src) {
    return <ImageIcon className="w-5 h-5 text-muted-foreground/40" />;
  }
  return (
    <HoverCard openDelay={150} closeDelay={50}>
      <HoverCardTrigger asChild>
        <img src={src} alt={alt} className="w-full h-full object-cover cursor-zoom-in" />
      </HoverCardTrigger>
      <HoverCardContent side="right" className="p-1 w-auto bg-background border shadow-lg">
        <img src={src} alt={alt} className="max-w-[320px] max-h-[320px] object-contain" />
      </HoverCardContent>
    </HoverCard>
  );
}
import {
  Package, PackageLineItem, loadPackages, savePackages, subscribePackages,
  generatePackageId, getRoomTypesForBlock, BlockRoomType,
  getRoomTypesByFloorForBlock, floorLabel,
  UnitCoverageMap, coverageKey, getBuildingUnitTypes, unitCodeFromToken,
  totalUnitsInBuilding,
} from '@/data/packagesData';
import { ChevronRight } from 'lucide-react';
import {
  CatalogProduct, loadCatalog, saveCatalog, subscribeCatalog, uploadCatalogImage,
  generateProductId, DISCIPLINES,
} from '@/data/catalogData';
import { Concept, ALL_BUILDINGS } from '@/data/masterData';
import { toast } from '@/hooks/use-toast';
import { Upload } from 'lucide-react';

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
  buildings: string[];
  unitCoverage: UnitCoverageMap;
}

const emptyForm = (): FormState => ({
  name: '',
  description: '',
  items: [],
  roomTypes: [],
  buildings: [],
  unitCoverage: {},
});

function priceOf(p: CatalogProduct | undefined): number {
  return p?.unitPriceEur ?? 0;
}

export default function Packages() {
  const [packages, setPackages] = useState<Package[]>(loadPackages);
  const [catalog, setCatalog] = useState<CatalogProduct[]>(loadCatalog);
  const [activeBlock, setActiveBlock] = useState<Concept>('A');
  const [view, setView] = useState<'packages' | 'comparison'>('packages');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerSort, setPickerSort] = useState<'default' | 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc' | 'supplier' | 'discipline'>('default');
  const [pickerDragMode, setPickerDragMode] = useState<'merge' | 'reorder'>('merge');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [rtSearch, setRtSearch] = useState('');
  const [expandedFloors, setExpandedFloors] = useState<Set<number>>(new Set());
  const [editProductId, setEditProductId] = useState<string | null>(null);
  const [productDraft, setProductDraft] = useState<CatalogProduct | null>(null);
  const [uploadingProductImg, setUploadingProductImg] = useState(false);
  const [dragProductId, setDragProductId] = useState<string | null>(null);
  const [dragOverProductId, setDragOverProductId] = useState<string | null>(null);

  const mergeItems = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setForm(f => {
      const src = f.items.find(it => it.productId === sourceId);
      if (!src) return f;
      return {
        ...f,
        items: f.items
          .filter(it => it.productId !== sourceId)
          .map(it => it.productId === targetId
            ? { ...it, quantity: it.quantity + src.quantity }
            : it),
      };
    });
    toast({ title: 'Items merged' });
  };

  const [pickerDragId, setPickerDragId] = useState<string | null>(null);
  const [pickerDragOverId, setPickerDragOverId] = useState<string | null>(null);
  const [mergeConfirm, setMergeConfirm] = useState<{ sourceId: string; targetId: string } | null>(null);

  const mergeCatalogProducts = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    // Update all packages: replace sourceId with targetId, summing quantities
    const updatedPackages = packages.map(pkg => {
      if (!pkg.items.some(it => it.productId === sourceId)) return pkg;
      const merged: PackageLineItem[] = [];
      const qtyMap = new Map<string, number>();
      pkg.items.forEach(it => {
        const id = it.productId === sourceId ? targetId : it.productId;
        qtyMap.set(id, (qtyMap.get(id) || 0) + it.quantity);
      });
      qtyMap.forEach((quantity, productId) => merged.push({ productId, quantity }));
      return { ...pkg, items: merged };
    });
    persist(updatedPackages);

    // Update current form draft too
    if (form.items.some(it => it.productId === sourceId)) {
      const qtyMap = new Map<string, number>();
      form.items.forEach(it => {
        const id = it.productId === sourceId ? targetId : it.productId;
        qtyMap.set(id, (qtyMap.get(id) || 0) + it.quantity);
      });
      const merged: PackageLineItem[] = [];
      qtyMap.forEach((quantity, productId) => merged.push({ productId, quantity }));
      setForm(f => ({ ...f, items: merged }));
    }

    // Remove source from catalog
    const nextCatalog = catalog.filter(p => p.id !== sourceId);
    setCatalog(nextCatalog);
    saveCatalog(nextCatalog);
    toast({ title: 'Products merged' });
  };

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

  const openProductEditor = (productId: string) => {
    const p = catalogById.get(productId);
    if (!p) {
      toast({ title: 'Product not found in catalog', variant: 'destructive' });
      return;
    }
    setEditProductId(productId);
    setProductDraft({ ...p });
  };

  const handleProductImageUpload = async (file: File) => {
    if (!productDraft) return;
    setUploadingProductImg(true);
    try {
      const url = await uploadCatalogImage(file);
      setProductDraft({ ...productDraft, imageUrl: url });
      toast({ title: 'Image uploaded' });
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    } finally {
      setUploadingProductImg(false);
    }
  };

  const saveProductDraft = () => {
    if (!productDraft) return;
    const exists = catalog.some(p => p.id === productDraft.id);
    const next = exists
      ? catalog.map(p => p.id === productDraft.id ? productDraft : p)
      : [...catalog, productDraft];
    setCatalog(next);
    saveCatalog(next);
    setEditProductId(null);
    setProductDraft(null);
    toast({ title: exists ? 'Product updated' : 'Product added' });
  };

  const createNewProduct = () => {
    const draft: CatalogProduct = {
      id: generateProductId(),
      name: '',
      description: '',
      imageUrl: '',
      unitPriceEur: null,
      supplierId: null,
      supplierName: '',
      discipline: DISCIPLINES[0],
      area: 'Indoor',
      sku: '',
    };
    setEditProductId(draft.id);
    setProductDraft(draft);
  };

  const deleteCatalogProduct = (productId: string) => {
    // Remove from all packages
    const updatedPackages = packages.map(pkg =>
      pkg.items.some(it => it.productId === productId)
        ? { ...pkg, items: pkg.items.filter(it => it.productId !== productId) }
        : pkg
    );
    persist(updatedPackages);
    if (form.items.some(it => it.productId === productId)) {
      setForm(f => ({ ...f, items: f.items.filter(it => it.productId !== productId) }));
    }
    const nextCatalog = catalog.filter(p => p.id !== productId);
    setCatalog(nextCatalog);
    saveCatalog(nextCatalog);
    toast({ title: 'Product deleted' });
  };

  const [deleteCatalogId, setDeleteCatalogId] = useState<string | null>(null);


  const filteredCatalog = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    const base = q
      ? catalog.filter(p =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.supplierName.toLowerCase().includes(q)
        )
      : [...catalog];
    const sorted = [...base];
    switch (pickerSort) {
      case 'name-asc': sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'name-desc': sorted.sort((a, b) => b.name.localeCompare(a.name)); break;
      case 'price-asc': sorted.sort((a, b) => (a.unitPriceEur ?? Infinity) - (b.unitPriceEur ?? Infinity)); break;
      case 'price-desc': sorted.sort((a, b) => (b.unitPriceEur ?? -Infinity) - (a.unitPriceEur ?? -Infinity)); break;
      case 'supplier': sorted.sort((a, b) => (a.supplierName || '').localeCompare(b.supplierName || '')); break;
      case 'discipline': sorted.sort((a, b) => (a.discipline || '').localeCompare(b.discipline || '')); break;
      case 'default': default: break;
    }
    return sorted;
  }, [catalog, pickerSearch, pickerSort]);

  const computeCardTotal = (p: Package): number =>
    p.items.reduce((s, it) => s + priceOf(catalogById.get(it.productId)) * it.quantity, 0);

  const roomTypeLabel = (code: string) => {
    const rt = blockRoomTypes.find(r => r.code === code);
    return rt ? `${rt.code} (${rt.description})` : code;
  };

  return (
    <div className="space-y-4">
      <Tabs value={view} onValueChange={(v) => setView(v as 'packages' | 'comparison')}>
        <TabsList>
          <TabsTrigger value="packages" className="gap-1.5"><PackageIcon className="w-4 h-4" /> Packages</TabsTrigger>
          <TabsTrigger value="comparison" className="gap-1.5"><GitCompare className="w-4 h-4" /> Item Comparison</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === 'comparison' ? <PackagesComparison /> : (
      <>
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
                      <div
                        key={it.productId}
                        draggable
                        onDragStart={(e) => { setDragProductId(it.productId); e.dataTransfer.effectAllowed = 'move'; }}
                        onDragEnd={() => { setDragProductId(null); setDragOverProductId(null); }}
                        onDragOver={(e) => {
                          if (dragProductId && dragProductId !== it.productId) {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            if (dragOverProductId !== it.productId) setDragOverProductId(it.productId);
                          }
                        }}
                        onDragLeave={() => { if (dragOverProductId === it.productId) setDragOverProductId(null); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragProductId) mergeItems(dragProductId, it.productId);
                          setDragProductId(null);
                          setDragOverProductId(null);
                        }}
                        className={`flex items-center gap-3 p-2 cursor-move transition-colors ${
                          dragOverProductId === it.productId ? 'bg-accent/30 ring-2 ring-accent ring-inset' : ''
                        } ${dragProductId === it.productId ? 'opacity-50' : ''}`}
                      >
                        <div className="w-12 h-12 bg-muted rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                          <ProductThumb src={prod?.imageUrl} alt={prod?.name || ''} />
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
                        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={() => openProductEditor(it.productId)} title="Edit product (image, price, supplier...)">
                          <Pencil className="w-4 h-4" />
                        </Button>
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
        <DialogContent className="max-w-none w-screen h-screen sm:rounded-none p-4 sm:p-6 overflow-hidden flex flex-col gap-3">
          <DialogHeader>
            <DialogTitle>Pick a Catalog Product</DialogTitle>
            <DialogDescription>
              Click to add. Use the drag mode toggle to either <strong>merge</strong> duplicates or <strong>reorder</strong> products manually.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={pickerSearch}
                onChange={e => setPickerSearch(e.target.value)}
                placeholder="Search by name, SKU, or supplier"
                className="pl-9"
                autoFocus
              />
            </div>
            <select
              value={pickerSort}
              onChange={e => setPickerSort(e.target.value as typeof pickerSort)}
              className="h-10 rounded-md border border-input bg-background px-2 text-sm"
              title="Sort"
            >
              <option value="default">Manual order</option>
              <option value="name-asc">Name (A→Z)</option>
              <option value="name-desc">Name (Z→A)</option>
              <option value="price-asc">Price (low→high)</option>
              <option value="price-desc">Price (high→low)</option>
              <option value="supplier">Supplier</option>
              <option value="discipline">Discipline</option>
            </select>
            <Tabs value={pickerDragMode} onValueChange={(v) => setPickerDragMode(v as 'merge' | 'reorder')}>
              <TabsList className="h-10">
                <TabsTrigger value="merge" className="text-xs">Drag = Merge</TabsTrigger>
                <TabsTrigger value="reorder" className="text-xs" disabled={pickerSort !== 'default' || !!pickerSearch.trim()}>Drag = Reorder</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button type="button" size="sm" onClick={createNewProduct} className="gap-1 h-10">
              <Plus className="w-4 h-4" /> New Product
            </Button>
          </div>

          <div className="overflow-y-auto flex-1 -mx-2 px-2">
            {filteredCatalog.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {catalog.length === 0 ? 'Catalog is empty. Add products in the Catalog tab first.' : 'No products match.'}
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                {filteredCatalog.map(p => (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={(e) => { setPickerDragId(p.id); e.dataTransfer.effectAllowed = 'move'; }}
                    onDragEnd={() => { setPickerDragId(null); setPickerDragOverId(null); }}
                    onDragOver={(e) => {
                      if (pickerDragId && pickerDragId !== p.id) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (pickerDragOverId !== p.id) setPickerDragOverId(p.id);
                      }
                    }}
                    onDragLeave={() => { if (pickerDragOverId === p.id) setPickerDragOverId(null); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (pickerDragId && pickerDragId !== p.id) {
                        if (pickerDragMode === 'reorder' && pickerSort === 'default' && !pickerSearch.trim()) {
                          // Reorder: move source before target in the catalog
                          const next = [...catalog];
                          const fromIdx = next.findIndex(x => x.id === pickerDragId);
                          const toIdx = next.findIndex(x => x.id === p.id);
                          if (fromIdx !== -1 && toIdx !== -1) {
                            const [moved] = next.splice(fromIdx, 1);
                            const insertAt = next.findIndex(x => x.id === p.id);
                            next.splice(insertAt, 0, moved);
                            setCatalog(next);
                            saveCatalog(next);
                            toast({ title: 'Order updated' });
                          }
                        } else {
                          setMergeConfirm({ sourceId: pickerDragId, targetId: p.id });
                        }
                      }
                      setPickerDragId(null);
                      setPickerDragOverId(null);
                    }}
                    onClick={() => addProductToForm(p.id)}
                    className={`group relative bg-card border rounded-md overflow-hidden flex flex-col cursor-pointer hover:border-accent hover:shadow-sm transition-all ${
                      pickerDragOverId === p.id ? 'ring-2 ring-accent border-accent' : ''
                    } ${pickerDragId === p.id ? 'opacity-50' : ''}`}
                  >
                    <div className="absolute top-1 right-1 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openProductEditor(p.id); }}
                        className="bg-background/90 border rounded p-1 hover:bg-accent hover:text-accent-foreground"
                        title="Edit product"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setDeleteCatalogId(p.id); }}
                        className="bg-background/90 border rounded p-1 hover:bg-destructive hover:text-destructive-foreground"
                        title="Delete product"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-muted-foreground/40" />
                      )}
                    </div>
                    <div className="p-1.5 flex-1 flex flex-col gap-0.5">
                      <div className="text-[11px] font-medium text-foreground line-clamp-2 leading-tight">{p.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{p.supplierName || '—'}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{p.discipline || '—'}</div>
                      <div className="text-[11px] font-bold text-foreground mt-auto pt-0.5">
                        {p.unitPriceEur != null ? `€${p.unitPriceEur.toFixed(2)}` : '—'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPickerOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product editor (edit catalog product inline from package) */}
      <Dialog open={!!editProductId} onOpenChange={(o) => { if (!o) { setEditProductId(null); setProductDraft(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{catalog.some(p => p.id === editProductId) ? 'Edit Product' : 'New Product'}</DialogTitle>
            <DialogDescription>Changes apply across the catalog and all packages.</DialogDescription>
          </DialogHeader>
          {productDraft && (
            <div
              className="space-y-3 py-2"
              onPaste={(e) => {
                const items = e.clipboardData?.items;
                if (!items) return;
                for (let i = 0; i < items.length; i++) {
                  const it = items[i];
                  if (it.type.startsWith('image/')) {
                    const file = it.getAsFile();
                    if (file) {
                      e.preventDefault();
                      handleProductImageUpload(file);
                      break;
                    }
                  }
                }
              }}
            >
              <div>
                <Label>Image</Label>
                <div
                  className="flex items-center gap-3 mt-1 border-2 border-dashed border-transparent hover:border-muted-foreground/30 rounded-md p-2 transition-colors"
                  onDragOver={(e) => { e.preventDefault(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file && file.type.startsWith('image/')) handleProductImageUpload(file);
                  }}
                >
                  <div className="w-20 h-20 bg-muted border rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                    {productDraft.imageUrl ? (
                      <img src={productDraft.imageUrl} alt="preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) handleProductImageUpload(f);
                        }}
                      />
                      <div className="inline-flex items-center gap-2 px-3 py-2 border rounded-md text-sm hover:bg-accent">
                        <Upload className="w-4 h-4" />
                        {uploadingProductImg ? 'Uploading...' : (productDraft.imageUrl ? 'Replace image' : 'Upload image')}
                      </div>
                    </label>
                    {productDraft.imageUrl && (
                      <Button type="button" variant="ghost" size="sm" className="ml-2 text-destructive" onClick={() => setProductDraft({ ...productDraft, imageUrl: '' })}>
                        Remove
                      </Button>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Tip: paste an image with Ctrl/Cmd+V or drag & drop here
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <Label>Name</Label>
                <Input value={productDraft.name} onChange={e => setProductDraft({ ...productDraft, name: e.target.value })} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={productDraft.description} onChange={e => setProductDraft({ ...productDraft, description: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Unit Price (EUR)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={productDraft.unitPriceEur ?? ''}
                    onChange={e => setProductDraft({ ...productDraft, unitPriceEur: e.target.value === '' ? null : parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>SKU</Label>
                  <Input value={productDraft.sku} onChange={e => setProductDraft({ ...productDraft, sku: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Supplier</Label>
                <Input value={productDraft.supplierName} onChange={e => setProductDraft({ ...productDraft, supplierName: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Discipline</Label>
                  <select
                    value={productDraft.discipline}
                    onChange={e => setProductDraft({ ...productDraft, discipline: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Area</Label>
                  <select
                    value={productDraft.area}
                    onChange={e => setProductDraft({ ...productDraft, area: e.target.value as 'Indoor' | 'Outdoor' })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="Indoor">Indoor</option>
                    <option value="Outdoor">Outdoor</option>
                  </select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditProductId(null); setProductDraft(null); }}>Cancel</Button>
            <Button onClick={saveProductDraft}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


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

      {/* Merge confirmation */}
      <AlertDialog open={!!mergeConfirm} onOpenChange={(o) => !o && setMergeConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Merge these products?</AlertDialogTitle>
            <AlertDialogDescription>
              {mergeConfirm && (() => {
                const src = catalog.find(p => p.id === mergeConfirm.sourceId);
                const tgt = catalog.find(p => p.id === mergeConfirm.targetId);
                return (
                  <>
                    <strong>"{src?.name}"</strong> will be removed from the catalog and replaced everywhere by <strong>"{tgt?.name}"</strong>. Quantities in all packages will be summed. This cannot be undone.
                  </>
                );
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (mergeConfirm) mergeCatalogProducts(mergeConfirm.sourceId, mergeConfirm.targetId);
                setMergeConfirm(null);
              }}
            >
              Merge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete catalog product confirmation */}
      <AlertDialog open={!!deleteCatalogId} onOpenChange={(o) => !o && setDeleteCatalogId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCatalogId && (() => {
                const p = catalog.find(x => x.id === deleteCatalogId);
                return <>This will remove <strong>"{p?.name}"</strong> from the catalog and from all packages. This cannot be undone.</>;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteCatalogId) deleteCatalogProduct(deleteCatalogId);
                setDeleteCatalogId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </>
      )}
    </div>
  );
}
