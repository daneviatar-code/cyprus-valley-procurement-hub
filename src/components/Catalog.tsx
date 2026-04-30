import { useState, useMemo, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, ImageIcon, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  CatalogProduct, DISCIPLINES, Area, loadCatalog, saveCatalog, generateProductId,
  subscribeCatalog, uploadCatalogImage,
} from '@/data/catalogData';
import { Supplier, loadSuppliers, subscribeSuppliers } from '@/data/supplierData';
import { toast } from '@/hooks/use-toast';

type FormState = Omit<CatalogProduct, 'id' | 'createdAt'>;

const emptyForm = (): FormState => ({
  name: '',
  description: '',
  imageUrl: '',
  unitPriceEur: null,
  supplierId: null,
  supplierName: '',
  discipline: 'Furniture',
  area: 'Indoor',
  sku: '',
});

export default function Catalog() {
  const [products, setProducts] = useState<CatalogProduct[]>(loadCatalog);
  const [suppliers, setSuppliers] = useState<Supplier[]>(loadSuppliers);
  const [search, setSearch] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState<string>('all');
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => subscribeCatalog(setProducts), []);
  useEffect(() => subscribeSuppliers(setSuppliers), []);

  const persist = useCallback((data: CatalogProduct[]) => {
    setProducts(data);
    saveCatalog(data);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p => {
      if (q && !p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q)) return false;
      if (disciplineFilter !== 'all' && p.discipline !== disciplineFilter) return false;
      if (areaFilter !== 'all' && p.area !== areaFilter) return false;
      if (supplierFilter !== 'all') {
        const key = p.supplierId || p.supplierName || '';
        if (key !== supplierFilter) return false;
      }
      return true;
    });
  }, [products, search, disciplineFilter, areaFilter, supplierFilter]);

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (p: CatalogProduct) => {
    setEditId(p.id);
    setForm({
      name: p.name, description: p.description, imageUrl: p.imageUrl,
      unitPriceEur: p.unitPriceEur, supplierId: p.supplierId, supplierName: p.supplierName,
      discipline: p.discipline, area: p.area, sku: p.sku,
    });
    setModalOpen(true);
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadCatalogImage(file);
      setForm(f => ({ ...f, imageUrl: url }));
      toast({ title: 'Image uploaded' });
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    if (editId) {
      persist(products.map(p => p.id === editId ? { ...p, ...form } : p));
    } else {
      const newP: CatalogProduct = {
        id: generateProductId(),
        createdAt: new Date().toISOString(),
        ...form,
      };
      persist([...products, newP]);
    }
    setModalOpen(false);
    toast({ title: editId ? 'Product updated' : 'Product added' });
  };

  const handleDelete = () => {
    if (!deleteId) return;
    persist(products.filter(p => p.id !== deleteId));
    setDeleteId(null);
    toast({ title: 'Product deleted' });
  };

  const supplierOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { key: string; label: string }[] = [];
    suppliers.forEach(s => {
      opts.push({ key: s.id, label: s.name || '(unnamed)' });
      seen.add(s.id);
    });
    products.forEach(p => {
      if (p.supplierId && !seen.has(p.supplierId)) {
        opts.push({ key: p.supplierId, label: p.supplierName || p.supplierId });
        seen.add(p.supplierId);
      } else if (!p.supplierId && p.supplierName && !seen.has(p.supplierName)) {
        opts.push({ key: p.supplierName, label: p.supplierName });
        seen.add(p.supplierName);
      }
    });
    return opts;
  }, [suppliers, products]);

  const onSupplierChange = (value: string) => {
    if (value === '__none__') {
      setForm(f => ({ ...f, supplierId: null, supplierName: '' }));
      return;
    }
    if (value.startsWith('id:')) {
      const id = value.slice(3);
      const s = suppliers.find(x => x.id === id);
      setForm(f => ({ ...f, supplierId: id, supplierName: s?.name || '' }));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-foreground">Product Catalog</h2>
          <span className="text-xs text-muted-foreground">{filtered.length} of {products.length} products</span>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="w-4 h-4" /> Add Product
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-card border rounded-lg">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or SKU..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={disciplineFilter} onValueChange={setDisciplineFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Discipline" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Disciplines</SelectItem>
            {DISCIPLINES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={areaFilter} onValueChange={setAreaFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Area" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Areas</SelectItem>
            <SelectItem value="Indoor">Indoor</SelectItem>
            <SelectItem value="Outdoor">Outdoor</SelectItem>
          </SelectContent>
        </Select>
        <Select value={supplierFilter} onValueChange={setSupplierFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Supplier" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Suppliers</SelectItem>
            {supplierOptions.map(o => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-card border rounded-lg">
          {products.length === 0 ? 'No products yet. Click "Add Product" to begin.' : 'No products match the filters.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(p => (
            <div key={p.id} className="bg-card border rounded-lg overflow-hidden flex flex-col group">
              <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <ImageIcon className="w-10 h-10 text-muted-foreground/40" />
                )}
              </div>
              <div className="p-3 flex-1 flex flex-col gap-1.5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground line-clamp-2">{p.name}</h3>
                  <span className="text-sm font-bold text-foreground whitespace-nowrap">
                    {p.unitPriceEur != null ? `€${p.unitPriceEur.toFixed(2)}` : '—'}
                  </span>
                </div>
                {p.sku && <p className="text-[10px] text-muted-foreground font-mono">{p.sku}</p>}
                <p className="text-xs text-muted-foreground line-clamp-1">{p.supplierName || '—'}</p>
                <div className="flex items-center gap-1 flex-wrap mt-1">
                  {p.discipline && <Badge variant="secondary" className="text-[10px] font-normal">{p.discipline}</Badge>}
                  <Badge variant="outline" className="text-[10px] font-normal">{p.area}</Badge>
                </div>
                <div className="flex gap-1 mt-2 pt-2 border-t opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="outline" size="sm" className="flex-1 h-7 text-xs gap-1" onClick={() => openEdit(p)}>
                    <Pencil className="w-3 h-3" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => setDeleteId(p.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Product' : 'Add Product'}</DialogTitle>
            <DialogDescription>Catalog product details</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="DOUBLE BED" />
            </div>

            <div className="col-span-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="UPHOLSTERED, METAL LEGS" rows={2} />
            </div>

            <div className="col-span-2">
              <Label>Image</Label>
              <div className="flex items-center gap-3">
                <div className="w-20 h-20 bg-muted border rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                  {form.imageUrl ? (
                    <img src={form.imageUrl} alt="preview" className="w-full h-full object-cover" />
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
                        if (f) handleImageUpload(f);
                      }}
                    />
                    <div className="inline-flex items-center gap-2 px-3 py-2 border rounded-md text-sm hover:bg-accent">
                      <Upload className="w-4 h-4" />
                      {uploading ? 'Uploading...' : (form.imageUrl ? 'Replace image' : 'Upload image')}
                    </div>
                  </label>
                  {form.imageUrl && (
                    <Button type="button" variant="ghost" size="sm" className="ml-2 text-destructive" onClick={() => setForm({ ...form, imageUrl: '' })}>
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <Label>Unit Price (EUR)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.unitPriceEur ?? ''}
                onChange={e => setForm({ ...form, unitPriceEur: e.target.value === '' ? null : parseFloat(e.target.value) })}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label>SKU / Code</Label>
              <Input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} placeholder="Optional" />
            </div>

            <div>
              <Label>Supplier</Label>
              {suppliers.length > 0 ? (
                <Select
                  value={form.supplierId ? `id:${form.supplierId}` : '__none__'}
                  onValueChange={onSupplierChange}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={`id:${s.id}`}>{s.name || '(unnamed)'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={form.supplierName}
                  onChange={e => setForm({ ...form, supplierName: e.target.value, supplierId: null })}
                  placeholder="Supplier name"
                />
              )}
            </div>

            <div>
              <Label>Area</Label>
              <Select value={form.area} onValueChange={(v) => setForm({ ...form, area: v as Area })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Indoor">Indoor</SelectItem>
                  <SelectItem value="Outdoor">Outdoor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label>Discipline</Label>
              <Select value={form.discipline} onValueChange={(v) => setForm({ ...form, discipline: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DISCIPLINES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editId ? 'Save Changes' : 'Add Product'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
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
