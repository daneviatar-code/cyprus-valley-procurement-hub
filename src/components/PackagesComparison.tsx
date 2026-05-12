import { useState, useMemo, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, X, ImageIcon, GitCompare, ArrowRight, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  HoverCard, HoverCardTrigger, HoverCardContent,
} from '@/components/ui/hover-card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  CatalogProduct, loadCatalog, saveCatalog, subscribeCatalog,
  generateProductId, DISCIPLINES, uploadCatalogImage,
} from '@/data/catalogData';
import { Package, loadPackages, subscribePackages } from '@/data/packagesData';
import { Concept } from '@/data/masterData';
import {
  AlternativesMap, loadAlternatives, subscribeAlternatives,
  addAlternative, removeAlternative,
} from '@/data/alternativesData';
import { toast } from '@/hooks/use-toast';

const BLOCKS: { id: Concept | 'ALL'; label: string }[] = [
  { id: 'ALL', label: 'All Blocks' },
  { id: 'A', label: 'Block A' },
  { id: 'B', label: 'Block B' },
  { id: 'C', label: 'Block C' },
];

function fmtEur(v: number | null | undefined): string {
  if (v == null) return '—';
  return `€${v.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Thumb({ src, alt }: { src?: string; alt: string }) {
  if (!src) return (
    <div className="w-16 h-16 bg-muted rounded flex items-center justify-center shrink-0">
      <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
    </div>
  );
  return <img src={src} alt={alt} className="w-16 h-16 object-cover rounded border shrink-0" />;
}

function SmallThumb({ src, alt }: { src?: string; alt: string }) {
  if (!src) return (
    <div className="w-10 h-10 bg-muted rounded flex items-center justify-center shrink-0">
      <ImageIcon className="w-4 h-4 text-muted-foreground/40" />
    </div>
  );
  return <img src={src} alt={alt} className="w-10 h-10 object-cover rounded border shrink-0" />;
}

export default function PackagesComparison() {
  const [catalog, setCatalog] = useState<CatalogProduct[]>(loadCatalog);
  const [packages, setPackages] = useState<Package[]>(loadPackages);
  const [alts, setAlts] = useState<AlternativesMap>(loadAlternatives);
  const [block, setBlock] = useState<Concept | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');

  // New product creation state
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [productDraft, setProductDraft] = useState<CatalogProduct | null>(null);
  const [uploadingProductImg, setUploadingProductImg] = useState(false);

  // Edit product state
  const [editProductOpen, setEditProductOpen] = useState(false);
  const [editProductDraft, setEditProductDraft] = useState<CatalogProduct | null>(null);
  const [editUploadingImg, setEditUploadingImg] = useState(false);

  useEffect(() => subscribeCatalog(setCatalog), []);
  useEffect(() => subscribePackages(setPackages), []);
  useEffect(() => subscribeAlternatives(setAlts), []);

  const productMap = useMemo(() => {
    const m = new Map<string, CatalogProduct>();
    catalog.forEach(p => m.set(p.id, p));
    return m;
  }, [catalog]);

  // Unique product ids actually used in packages (filtered by block)
  const usedItems = useMemo(() => {
    const usage = new Map<string, { qty: number; packages: Set<string> }>();
    packages.forEach(pkg => {
      if (block !== 'ALL' && pkg.block !== block) return;
      pkg.items.forEach(it => {
        const cur = usage.get(it.productId) ?? { qty: 0, packages: new Set() };
        cur.qty += it.quantity;
        cur.packages.add(pkg.name);
        usage.set(it.productId, cur);
      });
    });
    const term = search.trim().toLowerCase();
    return [...usage.entries()]
      .map(([productId, u]) => ({
        productId,
        product: productMap.get(productId),
        totalQty: u.qty,
        packageNames: [...u.packages],
      }))
      .filter(x => x.product)
      .filter(x => !term ||
        x.product!.name.toLowerCase().includes(term) ||
        x.product!.supplierName.toLowerCase().includes(term) ||
        x.product!.discipline.toLowerCase().includes(term))
      .sort((a, b) => a.product!.name.localeCompare(b.product!.name));
  }, [packages, block, search, productMap]);

  const pickerCandidates = useMemo(() => {
    if (!pickerFor) return [];
    const base = productMap.get(pickerFor);
    const existingAlts = new Set(alts[pickerFor] ?? []);
    const term = pickerSearch.trim().toLowerCase();
    return catalog
      .filter(p => p.id !== pickerFor && !existingAlts.has(p.id))
      .filter(p => !base || p.discipline === base.discipline || !term)
      .filter(p => !term ||
        p.name.toLowerCase().includes(term) ||
        p.supplierName.toLowerCase().includes(term) ||
        p.discipline.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [pickerFor, pickerSearch, catalog, alts, productMap]);

  const openNewProduct = () => {
    const base = pickerFor ? productMap.get(pickerFor) : null;
    const draft: CatalogProduct = {
      id: generateProductId(),
      name: '',
      description: '',
      imageUrl: '',
      unitPriceEur: null,
      supplierId: null,
      supplierName: '',
      discipline: base?.discipline ?? DISCIPLINES[0],
      area: 'Indoor',
      sku: '',
    };
    setProductDraft(draft);
    setNewProductOpen(true);
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

  const saveNewProduct = () => {
    if (!productDraft || !pickerFor) return;
    if (!productDraft.name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    const nextCatalog = [...catalog, productDraft];
    setCatalog(nextCatalog);
    saveCatalog(nextCatalog);

    addAlternative(pickerFor, productDraft.id);
    toast({ title: 'New product created and added as alternative' });
    setNewProductOpen(false);
    setProductDraft(null);
    setPickerFor(null);
  };

  const openEditProduct = (productId: string) => {
    const p = productMap.get(productId);
    if (!p) return;
    setEditProductDraft({ ...p });
    setEditProductOpen(true);
  };

  const handleEditImageUpload = async (file: File) => {
    if (!editProductDraft) return;
    setEditUploadingImg(true);
    try {
      const url = await uploadCatalogImage(file);
      setEditProductDraft({ ...editProductDraft, imageUrl: url });
      toast({ title: 'Image uploaded' });
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    } finally {
      setEditUploadingImg(false);
    }
  };

  const saveEditProduct = () => {
    if (!editProductDraft) return;
    if (!editProductDraft.name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    const next = catalog.map(p => p.id === editProductDraft.id ? editProductDraft : p);
    setCatalog(next);
    saveCatalog(next);
    toast({ title: 'Product updated' });
    setEditProductOpen(false);
    setEditProductDraft(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <GitCompare className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold text-foreground">Item Comparison</h2>
          <span className="text-xs text-muted-foreground">
            All items used in packages, with optional alternatives for price comparison
          </span>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items, suppliers..."
            className="pl-8 h-9"
          />
        </div>
      </div>

      <Tabs value={block} onValueChange={(v) => setBlock(v as Concept | 'ALL')}>
        <TabsList>
          {BLOCKS.map(b => (
            <TabsTrigger key={b.id} value={b.id}>{b.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="text-xs text-muted-foreground">
        {usedItems.length} unique item{usedItems.length === 1 ? '' : 's'} used
      </div>

      {usedItems.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-card border rounded-lg">
          No items found. Add items to packages first.
        </div>
      ) : (
        <div className="space-y-3">
          {usedItems.map(({ productId, product, totalQty, packageNames }) => {
            const altIds = alts[productId] ?? [];
            const basePrice = product!.unitPriceEur ?? 0;
            return (
              <div key={productId} className="bg-card border rounded-lg overflow-hidden">
                {/* Base row */}
                <div className="flex items-start gap-3 p-3 bg-muted/30">
                  <Thumb src={product!.imageUrl} alt={product!.name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="default" className="text-[10px] h-5">BASE</Badge>
                          <h3 className="text-sm font-semibold text-foreground truncate">{product!.name}</h3>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                          {product!.discipline && <span>{product!.discipline}</span>}
                          {product!.supplierName && <span>Supplier: {product!.supplierName}</span>}
                          {product!.sku && <span>SKU: {product!.sku}</span>}
                          <span>Used: {totalQty}× in {packageNames.length} pkg</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex items-start gap-1">
                        <div>
                          <div className="text-base font-bold text-foreground">{fmtEur(product!.unitPriceEur)}</div>
                          <div className="text-[10px] text-muted-foreground">unit price</div>
                        </div>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => openEditProduct(productId)}
                          title="Edit product"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    {packageNames.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {packageNames.slice(0, 6).map(n => (
                          <Badge key={n} variant="secondary" className="text-[10px] font-normal">{n}</Badge>
                        ))}
                        {packageNames.length > 6 && (
                          <span className="text-[10px] text-muted-foreground">+{packageNames.length - 6} more</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Alternatives */}
                {altIds.length > 0 && (
                  <div className="divide-y">
                    {altIds.map(altId => {
                      const alt = productMap.get(altId);
                      if (!alt) return null;
                      const altPrice = alt.unitPriceEur ?? 0;
                      const diff = altPrice - basePrice;
                      const diffPct = basePrice > 0 ? (diff / basePrice) * 100 : 0;
                      const cheaper = diff < 0;
                      return (
                        <div key={altId} className="flex items-start gap-3 p-3 pl-8 bg-background">
                          <ArrowRight className="w-4 h-4 text-muted-foreground mt-6 shrink-0" />
                          <Thumb src={alt.imageUrl} alt={alt.name} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[10px] h-5">ALT</Badge>
                                  <h4 className="text-sm font-medium text-foreground truncate">{alt.name}</h4>
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                                  {alt.discipline && <span>{alt.discipline}</span>}
                                  {alt.supplierName && <span>Supplier: {alt.supplierName}</span>}
                                  {alt.sku && <span>SKU: {alt.sku}</span>}
                                </div>
                              </div>
                              <div className="text-right shrink-0 flex items-start gap-2">
                                <div>
                                  <div className="text-base font-semibold text-foreground">{fmtEur(alt.unitPriceEur)}</div>
                                  {basePrice > 0 && altPrice > 0 && (
                                    <div className={`text-[10px] font-medium ${cheaper ? 'text-emerald-600' : 'text-destructive'}`}>
                                      {cheaper ? '▼' : '▲'} {fmtEur(Math.abs(diff))} ({diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}%)
                                    </div>
                                  )}
                                </div>
                                <Button
                                  variant="ghost" size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                  onClick={() => openEditProduct(altId)}
                                  title="Edit product"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost" size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => {
                                    removeAlternative(productId, altId);
                                    toast({ title: 'Alternative removed' });
                                  }}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add alt button */}
                <div className="border-t p-2 bg-card">
                  <Button
                    variant="ghost" size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => { setPickerFor(productId); setPickerSearch(''); }}
                  >
                    <Plus className="w-3.5 h-3.5" /> Add alternative
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Picker dialog */}
      <Dialog open={!!pickerFor} onOpenChange={(o) => !o && setPickerFor(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Select alternative product</DialogTitle>
                <DialogDescription>
                  Pick a catalog product to compare against{' '}
                  <span className="font-medium text-foreground">
                    {pickerFor ? productMap.get(pickerFor)?.name : ''}
                  </span>
                </DialogDescription>
              </div>
              <Button variant="outline" size="sm" className="gap-1" onClick={openNewProduct}>
                <Plus className="w-3.5 h-3.5" /> New Product
              </Button>
            </div>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              autoFocus
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder="Search by name, supplier, discipline..."
              className="pl-8 h-9"
            />
            {pickerSearch && (
              <button
                onClick={() => setPickerSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            {pickerCandidates.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">No matching products</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {pickerCandidates.map(p => {
                  const base = pickerFor ? productMap.get(pickerFor) : null;
                  const baseP = base?.unitPriceEur ?? 0;
                  const altP = p.unitPriceEur ?? 0;
                  const diff = altP - baseP;
                  const diffPct = baseP > 0 ? (diff / baseP) * 100 : 0;
                  const cheaper = diff < 0;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        if (!pickerFor) return;
                        addAlternative(pickerFor, p.id);
                        toast({ title: 'Alternative added' });
                        setPickerFor(null);
                      }}
                      className="flex items-start gap-2 p-2 border rounded-md hover:border-accent hover:bg-accent/5 text-left"
                    >
                      <SmallThumb src={p.imageUrl} alt={p.name} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{p.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {p.discipline}{p.supplierName ? ` · ${p.supplierName}` : ''}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm font-semibold">{fmtEur(p.unitPriceEur)}</span>
                          {baseP > 0 && altP > 0 && (
                            <span className={`text-[10px] font-medium ${cheaper ? 'text-emerald-600' : 'text-destructive'}`}>
                              {cheaper ? '▼' : '▲'} {diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* New Product dialog */}
      <Dialog open={newProductOpen} onOpenChange={(o) => !o && setNewProductOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Product</DialogTitle>
            <DialogDescription>
              Create a new catalog product. It will be added to the catalog and set as an alternative.
            </DialogDescription>
          </DialogHeader>
          {productDraft && (
            <div
              className="space-y-3"
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
                  <div className="w-16 h-16 border rounded flex items-center justify-center bg-muted overflow-hidden">
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
            <Button variant="outline" onClick={() => { setNewProductOpen(false); setProductDraft(null); }}>Cancel</Button>
            <Button onClick={saveNewProduct}>Save & Add Alternative</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Product dialog */}
      <Dialog open={editProductOpen} onOpenChange={(o) => !o && setEditProductOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>
              Update catalog product details. Changes apply everywhere this product is used.
            </DialogDescription>
          </DialogHeader>
          {editProductDraft && (
            <div
              className="space-y-3"
              onPaste={(e) => {
                const items = e.clipboardData?.items;
                if (!items) return;
                for (let i = 0; i < items.length; i++) {
                  const it = items[i];
                  if (it.type.startsWith('image/')) {
                    const file = it.getAsFile();
                    if (file) {
                      e.preventDefault();
                      handleEditImageUpload(file);
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
                    if (file && file.type.startsWith('image/')) handleEditImageUpload(file);
                  }}
                >
                  <div className="w-16 h-16 border rounded flex items-center justify-center bg-muted overflow-hidden">
                    {editProductDraft.imageUrl ? (
                      <img src={editProductDraft.imageUrl} alt="preview" className="w-full h-full object-cover" />
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
                          if (f) handleEditImageUpload(f);
                        }}
                      />
                      <div className="inline-flex items-center gap-2 px-3 py-2 border rounded-md text-sm hover:bg-accent">
                        <Upload className="w-4 h-4" />
                        {editUploadingImg ? 'Uploading...' : (editProductDraft.imageUrl ? 'Replace image' : 'Upload image')}
                      </div>
                    </label>
                    {editProductDraft.imageUrl && (
                      <Button type="button" variant="ghost" size="sm" className="ml-2 text-destructive" onClick={() => setEditProductDraft({ ...editProductDraft, imageUrl: '' })}>
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
                <Input value={editProductDraft.name} onChange={e => setEditProductDraft({ ...editProductDraft, name: e.target.value })} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={editProductDraft.description} onChange={e => setEditProductDraft({ ...editProductDraft, description: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Unit Price (EUR)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editProductDraft.unitPriceEur ?? ''}
                    onChange={e => setEditProductDraft({ ...editProductDraft, unitPriceEur: e.target.value === '' ? null : parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>SKU</Label>
                  <Input value={editProductDraft.sku} onChange={e => setEditProductDraft({ ...editProductDraft, sku: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Supplier</Label>
                <Input value={editProductDraft.supplierName} onChange={e => setEditProductDraft({ ...editProductDraft, supplierName: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Discipline</Label>
                  <select
                    value={editProductDraft.discipline}
                    onChange={e => setEditProductDraft({ ...editProductDraft, discipline: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Area</Label>
                  <select
                    value={editProductDraft.area}
                    onChange={e => setEditProductDraft({ ...editProductDraft, area: e.target.value as 'Indoor' | 'Outdoor' })}
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
            <Button variant="outline" onClick={() => { setEditProductOpen(false); setEditProductDraft(null); }}>Cancel</Button>
            <Button onClick={saveEditProduct}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
