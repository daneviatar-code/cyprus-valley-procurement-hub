import { useState, useMemo, useCallback, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, ExternalLink, Package, Search, ChevronDown, ChevronRight, FileText, CalendarIcon, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Supplier, SupplierItem, loadSuppliers, saveSuppliers, generateSupplierId, subscribeSuppliers,
} from '@/data/supplierData';
import {
  PurchaseOrder, POLineItem, loadPurchaseOrders, savePurchaseOrders, generatePONumber, generatePOId,
} from '@/data/purchaseOrderData';
import { loadAllSelections } from '@/data/selectionData';
import {
  Category, loadCategoriesShared, saveCategoriesShared,
  subscribeCategories, genCategoryIdShared,
} from '@/data/categoriesData';
import ManageCategoriesDialog from './ManageCategoriesDialog';
import { toast } from '@/hooks/use-toast';

const STATUS_OPTIONS: SupplierItem['status'][] = ['quoted', 'ordered', 'delivered', 'cancelled'];

const statusColors: Record<SupplierItem['status'], string> = {
  quoted: 'bg-muted text-muted-foreground',
  ordered: 'bg-primary/15 text-primary',
  delivered: 'bg-accent text-accent-foreground',
  cancelled: 'bg-destructive/15 text-destructive',
};

const emptySupplier = (): Omit<Supplier, 'id' | 'createdAt'> => ({
  name: '', contactPerson: '', email: '', phone: '', website: '', country: '', address: '', paymentTerms: '', currency: 'EUR', notes: '', category: 'Furniture', items: [],
});

const emptyItem = (): SupplierItem => ({
  itemName: '', unitPrice: 0, leadTimeDays: 0, status: 'quoted', notes: '',
});

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>(loadSuppliers);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptySupplier());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [itemModal, setItemModal] = useState(false);
  const [editItemIdx, setEditItemIdx] = useState<number | null>(null);
  const [itemForm, setItemForm] = useState<SupplierItem>(emptyItem());
  const [itemSupplierId, setItemSupplierId] = useState<string | null>(null);

  // Shared categories
  const [categories, setCategories] = useState<Category[]>(loadCategoriesShared);
  const [manageCatsOpen, setManageCatsOpen] = useState(false);
  const [addingCatInline, setAddingCatInline] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  useEffect(() => subscribeCategories(setCategories), []);

  const sortedCategories = useMemo(() =>
    [...categories].sort((a, b) => (a.order || 0) - (b.order || 0) || a.nameEn.localeCompare(b.nameEn))
  , [categories]);

  const inlineAddCategory = () => {
    const name = newCatName.trim();
    if (!name) return;
    if (categories.some(c => c.nameEn.toLowerCase() === name.toLowerCase())) {
      toast({ title: 'Category already exists' });
      return;
    }
    const order = (categories.reduce((m, c) => Math.max(m, c.order || 0), 0) || 0) + 1;
    const cat: Category = { id: genCategoryIdShared(), nameEn: name, nameHe: '', scope: 'both', order };
    saveCategoriesShared([...categories, cat]);
    setForm(f => ({ ...f, category: name }));
    setNewCatName(''); setAddingCatInline(false);
  };

  // Sync with cloud after hydration
  useEffect(() => subscribeSuppliers(setSuppliers), []);

  // Purchase Orders state
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(loadPurchaseOrders);
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [editPoId, setEditPoId] = useState<string | null>(null);
  const [poSupplierId, setPoSupplierId] = useState<string | null>(null);
  const [poForm, setPoForm] = useState<{
    poNumber: string;
    status: PurchaseOrder['status'];
    expectedDelivery: Date | undefined;
    notes: string;
    lineItems: (POLineItem & { selected: boolean })[];
  }>({ poNumber: '', status: 'Draft', expectedDelivery: undefined, notes: '', lineItems: [] });

  const persistPOs = useCallback((data: PurchaseOrder[]) => {
    setPurchaseOrders(data);
    savePurchaseOrders(data);
  }, []);

  const openCreatePO = (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return;
    const lines = supplier.items.map(i => ({
      itemName: i.itemName,
      qty: 1,
      unitPrice: i.unitPrice,
      totalPrice: i.unitPrice,
      selected: false,
    }));
    setEditPoId(null);
    setPoSupplierId(supplierId);
    setPoForm({
      poNumber: generatePONumber(purchaseOrders),
      status: 'Draft',
      expectedDelivery: undefined,
      notes: '',
      lineItems: lines,
    });
    setPoModalOpen(true);
  };

  const openEditPO = (po: PurchaseOrder) => {
    setEditPoId(po.id);
    setPoSupplierId(po.supplierId);
    setPoForm({
      poNumber: po.poNumber,
      status: po.status,
      expectedDelivery: po.expectedDelivery ? new Date(po.expectedDelivery) : undefined,
      notes: po.notes,
      lineItems: po.items.map(i => ({ ...i, selected: true })),
    });
    setPoModalOpen(true);
  };

  const loadFromSelections = () => {
    if (!poSupplierId) return;
    const supplier = suppliers.find(s => s.id === poSupplierId);
    if (!supplier) return;
    const PREFIX = 'cyprus-valley-selections';
    // Scan all selection keys and aggregate items matching this supplier
    const itemAgg = new Map<string, { qty: number; unitPrice: number }>();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(PREFIX)) continue;
      try {
        const map = JSON.parse(localStorage.getItem(key) || '{}');
        for (const [itemName, sel] of Object.entries(map) as [string, any][]) {
          if (sel.supplier === supplier.name) {
            const prev = itemAgg.get(itemName);
            if (prev) {
              prev.qty += 1;
            } else {
              itemAgg.set(itemName, { qty: 1, unitPrice: sel.unitPrice ?? 0 });
            }
          }
        }
      } catch {}
    }
    const existing = new Set(poForm.lineItems.map(l => l.itemName));
    const newLines = Array.from(itemAgg.entries())
      .filter(([name]) => !existing.has(name))
      .map(([name, { qty, unitPrice }]) => ({
        itemName: name,
        qty,
        unitPrice,
        totalPrice: qty * unitPrice,
        selected: true,
      }));
    if (newLines.length === 0) { toast({ title: 'No new items found in Selections for this supplier' }); return; }
    setPoForm(f => ({ ...f, lineItems: [...f.lineItems, ...newLines] }));
    toast({ title: `${newLines.length} item(s) loaded from Selections` });
  };

  const savePO = () => {
    if (!poSupplierId) return;
    const supplier = suppliers.find(s => s.id === poSupplierId);
    const selectedLines = poForm.lineItems.filter(l => l.selected);
    if (selectedLines.length === 0) { toast({ title: 'Select at least one item' }); return; }
    const items = selectedLines.map(({ selected, ...rest }) => ({ ...rest, totalPrice: rest.qty * rest.unitPrice }));
    const totalValue = items.reduce((a, i) => a + i.totalPrice, 0);
    if (editPoId) {
      const next = purchaseOrders.map(p => p.id === editPoId ? {
        ...p,
        status: poForm.status,
        expectedDelivery: poForm.expectedDelivery?.toISOString() || '',
        items,
        totalValue,
        notes: poForm.notes,
      } : p);
      persistPOs(next);
      setPoModalOpen(false);
      toast({ title: `${poForm.poNumber} updated` });
    } else {
      const po: PurchaseOrder = {
        id: generatePOId(),
        poNumber: poForm.poNumber,
        supplierId: poSupplierId,
        supplierName: supplier?.name || '',
        items,
        status: poForm.status,
        expectedDelivery: poForm.expectedDelivery?.toISOString() || '',
        totalValue,
        currency: supplier?.currency || 'EUR',
        notes: poForm.notes,
        createdAt: new Date().toISOString(),
      };
      persistPOs([...purchaseOrders, po]);
      setPoModalOpen(false);
      toast({ title: `Purchase Order ${po.poNumber} created` });
    }
  };

  const deletePO = (poId: string) => {
    persistPOs(purchaseOrders.filter(p => p.id !== poId));
    toast({ title: 'Purchase order deleted' });
  };

  const updatePOStatus = (poId: string, status: PurchaseOrder['status']) => {
    persistPOs(purchaseOrders.map(p => p.id === poId ? { ...p, status } : p));
  };

  // auto-link from selections
  const allSelections = useMemo(() => loadAllSelections(), []);
  const selectionItems = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [itemName, sel] of Object.entries(allSelections)) {
      if (sel.supplier) {
        const list = map.get(sel.supplier) || [];
        list.push(itemName);
        map.set(sel.supplier, list);
      }
    }
    return map;
  }, [allSelections]);

  const persist = useCallback((data: Supplier[]) => {
    setSuppliers(data);
    saveSuppliers(data);
  }, []);

  const filtered = useMemo(() => {
    let list = suppliers;
    if (catFilter !== 'all') list = list.filter(s => s.category === catFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.contactPerson.toLowerCase().includes(q) ||
        s.items.some(i => i.itemName.toLowerCase().includes(q))
      );
    }
    return list;
  }, [suppliers, search, catFilter]);

  const openNew = () => { setEditId(null); setForm(emptySupplier()); setModalOpen(true); };
  const openEdit = (s: Supplier) => {
    setEditId(s.id);
    setForm({ name: s.name, contactPerson: s.contactPerson, email: s.email, phone: s.phone, website: s.website, country: s.country || '', address: s.address || '', paymentTerms: s.paymentTerms || '', currency: s.currency || 'EUR', notes: s.notes || '', category: s.category, items: s.items });
    setModalOpen(true);
  };

  const saveSupplier = () => {
    if (!form.name.trim()) { toast({ title: 'Supplier name is required' }); return; }
    let next: Supplier[];
    if (editId) {
      next = suppliers.map(s => s.id === editId ? { ...s, ...form } : s);
    } else {
      next = [...suppliers, { ...form, id: generateSupplierId(), createdAt: new Date().toISOString() } as Supplier];
    }
    persist(next);
    setModalOpen(false);
    toast({ title: editId ? 'Supplier updated' : 'Supplier added' });
  };

  const deleteSupplier = (id: string) => {
    persist(suppliers.filter(s => s.id !== id));
    if (expandedId === id) setExpandedId(null);
    toast({ title: 'Supplier deleted' });
  };

  // Item CRUD
  const openNewItem = (supplierId: string) => {
    setItemSupplierId(supplierId); setEditItemIdx(null); setItemForm(emptyItem()); setItemModal(true);
  };
  const openEditItem = (supplierId: string, idx: number, item: SupplierItem) => {
    setItemSupplierId(supplierId); setEditItemIdx(idx); setItemForm({ ...item }); setItemModal(true);
  };
  const saveItem = () => {
    if (!itemForm.itemName.trim() || !itemSupplierId) return;
    const next = suppliers.map(s => {
      if (s.id !== itemSupplierId) return s;
      const items = [...s.items];
      if (editItemIdx !== null) items[editItemIdx] = itemForm;
      else items.push(itemForm);
      return { ...s, items };
    });
    persist(next);
    setItemModal(false);
    toast({ title: editItemIdx !== null ? 'Item updated' : 'Item added' });
  };
  const deleteItem = (supplierId: string, idx: number) => {
    const next = suppliers.map(s => {
      if (s.id !== supplierId) return s;
      return { ...s, items: s.items.filter((_, i) => i !== idx) };
    });
    persist(next);
  };

  const totalItems = suppliers.reduce((a, s) => a + s.items.length, 0);
  const totalValue = suppliers.reduce((a, s) => a + s.items.reduce((b, i) => b + i.unitPrice, 0), 0);

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Suppliers', value: suppliers.length },
          { label: 'Total Items', value: totalItems },
          { label: 'Categories', value: new Set(suppliers.map(s => s.category)).size },
          { label: 'Total Value', value: `€${totalValue.toLocaleString()}` },
        ].map(s => (
          <div key={s.label} className="bg-card border rounded-lg p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search suppliers or items…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {sortedCategories.map(c => <SelectItem key={c.id} value={c.nameEn}>{c.nameEn}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => setManageCatsOpen(true)} title="Manage Categories">
          <Settings className="h-4 w-4 mr-1" /> Manage Categories
        </Button>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Add Supplier</Button>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-8" />
              <TableHead>Supplier</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-center">Items</TableHead>
              <TableHead className="text-right">Total Value €</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No suppliers yet. Add your first supplier to get started.</TableCell></TableRow>
            )}
            {filtered.map(s => {
              const isExpanded = expandedId === s.id;
              const selItems = selectionItems.get(s.name) || [];
              const supplierValue = s.items.reduce((a, i) => a + i.unitPrice, 0);
              const deliveredCount = s.items.filter(i => i.status === 'delivered').length;
              const summaryStatus = s.items.length === 0 ? 'none' : deliveredCount === s.items.length ? 'delivered' : 'in-progress';
              return (
                <>
                  <TableRow key={s.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setExpandedId(isExpanded ? null : s.id)}>
                    <TableCell>{isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}</TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">{s.name}</div>
                      {s.website && <a href={s.website} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1" onClick={e => e.stopPropagation()}><ExternalLink className="h-3 w-3" />Website</a>}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-foreground">{s.contactPerson}</div>
                      <div className="text-xs text-muted-foreground">{s.email}</div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{s.category}</Badge></TableCell>
                    <TableCell className="text-center">{s.items.length}{selItems.length > 0 && <span className="text-xs text-primary ml-1">(+{selItems.length} sel)</span>}</TableCell>
                    <TableCell className="text-right font-mono text-sm">€{supplierValue.toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      {summaryStatus === 'none' && <Badge variant="outline" className="text-xs">—</Badge>}
                      {summaryStatus === 'delivered' && <Badge className="bg-accent text-accent-foreground text-xs">Complete</Badge>}
                      {summaryStatus === 'in-progress' && <Badge className="bg-primary/15 text-primary text-xs">{deliveredCount}/{s.items.length}</Badge>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteSupplier(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow key={`${s.id}-items`}>
                      <TableCell colSpan={8} className="bg-muted/20 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2"><Package className="h-4 w-4" /> Items & Pricing</h4>
                          <Button variant="outline" size="sm" onClick={() => openNewItem(s.id)}><Plus className="h-3.5 w-3.5 mr-1" /> Add Item</Button>
                        </div>
                        {s.items.length === 0 && selItems.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No items assigned yet.</p>}
                        {(s.items.length > 0 || selItems.length > 0) && (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Item Name</TableHead>
                                <TableHead className="text-right">Unit Price €</TableHead>
                                <TableHead className="text-center">Lead Time</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                                <TableHead>Notes</TableHead>
                                <TableHead className="w-20" />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {s.items.map((item, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="font-medium">{item.itemName}</TableCell>
                                  <TableCell className="text-right font-mono">€{item.unitPrice.toLocaleString()}</TableCell>
                                  <TableCell className="text-center">{item.leadTimeDays > 0 ? `${item.leadTimeDays}d` : '—'}</TableCell>
                                  <TableCell className="text-center"><Badge className={`text-xs ${statusColors[item.status]}`}>{item.status}</Badge></TableCell>
                                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{item.notes || '—'}</TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditItem(s.id, idx, item)}><Pencil className="h-3 w-3" /></Button>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteItem(s.id, idx)}><Trash2 className="h-3 w-3" /></Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                              {selItems.filter(name => !s.items.some(i => i.itemName === name)).map(name => (
                                <TableRow key={`sel-${name}`} className="opacity-60">
                                  <TableCell className="font-medium">{name} <Badge variant="outline" className="text-[10px] ml-1">from selections</Badge></TableCell>
                                  <TableCell className="text-right font-mono">€{allSelections[name]?.unitPrice?.toLocaleString() ?? '—'}</TableCell>
                                  <TableCell className="text-center">—</TableCell>
                                  <TableCell className="text-center"><Badge className="text-xs bg-muted text-muted-foreground">linked</Badge></TableCell>
                                  <TableCell className="text-xs text-muted-foreground">Auto-linked from Selections</TableCell>
                                  <TableCell />
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}

                        {/* Purchase Orders Section */}
                        <div className="mt-6 border-t pt-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2"><FileText className="h-4 w-4" /> Purchase Orders</h4>
                            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openCreatePO(s.id); }}>
                              <Plus className="h-3.5 w-3.5 mr-1" /> Create PO
                            </Button>
                          </div>
                          {(() => {
                            const supplierPOs = purchaseOrders.filter(p => p.supplierId === s.id);
                            if (supplierPOs.length === 0) return <p className="text-sm text-muted-foreground py-3 text-center">No purchase orders yet.</p>;
                            const poStatusColors: Record<string, string> = {
                              Draft: 'bg-muted text-muted-foreground',
                              Sent: 'bg-status-pending/15 text-status-pending',
                              Confirmed: 'bg-status-ordered/15 text-status-ordered',
                              Delivered: 'bg-status-delivered/15 text-status-delivered',
                            };
                            return (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {supplierPOs.map(po => {
                                  const poTotal = po.totalValue || po.items.reduce((a, i) => a + i.qty * i.unitPrice, 0);
                                  return (
                                    <div key={po.id} className="border rounded-lg p-4 bg-card hover:shadow-sm transition-shadow cursor-pointer" onClick={() => openEditPO(po)}>
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="font-mono font-semibold text-sm text-foreground">{po.poNumber}</span>
                                        <div className="flex items-center gap-1">
                                          <Badge className={`text-[10px] ${poStatusColors[po.status] || poStatusColors.Draft}`}>{po.status}</Badge>
                                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); deletePO(po.id); }}>
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                      <div className="space-y-1 text-xs text-muted-foreground">
                                        <div className="flex justify-between">
                                          <span>Date</span>
                                          <span className="text-foreground">{po.createdAt ? format(new Date(po.createdAt), 'dd MMM yyyy') : '—'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>Items</span>
                                          <span className="text-foreground">{po.items.length}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>Total</span>
                                          <span className="text-foreground font-mono font-medium">€{poTotal.toLocaleString()}</span>
                                        </div>
                                        {po.expectedDelivery && (
                                          <div className="flex justify-between">
                                            <span>Delivery</span>
                                            <span className="text-foreground">{format(new Date(po.expectedDelivery), 'dd MMM yyyy')}</span>
                                          </div>
                                        )}
                                      </div>
                                      <div className="mt-2 pt-2 border-t" onClick={e => e.stopPropagation()}>
                                        <Select value={po.status} onValueChange={(v: PurchaseOrder['status']) => updatePOStatus(po.id, v)}>
                                          <SelectTrigger className="h-7 text-xs w-full">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {(['Draft', 'Sent', 'Confirmed', 'Delivered'] as const).map(st => (
                                              <SelectItem key={st} value={st}>{st}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Supplier Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Company Name *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Contact Person</label>
                <Input value={form.contactPerson} onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Phone</label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Website</label>
                <Input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Country</label>
                <Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="e.g. Cyprus" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Address</label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Street, City, Zip" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Payment Terms</label>
              <Input value={form.paymentTerms} onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))} placeholder="e.g. Net 30" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Currency</label>
              <Input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} placeholder="EUR" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Notes</label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes…" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={saveSupplier}>{editId ? 'Update' : 'Add Supplier'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Modal */}
      <Dialog open={itemModal} onOpenChange={setItemModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editItemIdx !== null ? 'Edit Item' : 'Add Item'}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Item Name *</label>
              <Input value={itemForm.itemName} onChange={e => setItemForm(f => ({ ...f, itemName: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Unit Price €</label>
                <Input type="number" value={itemForm.unitPrice || ''} onChange={e => setItemForm(f => ({ ...f, unitPrice: +e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Lead Time (days)</label>
                <Input type="number" value={itemForm.leadTimeDays || ''} onChange={e => setItemForm(f => ({ ...f, leadTimeDays: +e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={itemForm.status} onValueChange={(v: SupplierItem['status']) => setItemForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Notes</label>
              <Input value={itemForm.notes} onChange={e => setItemForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemModal(false)}>Cancel</Button>
            <Button onClick={saveItem}>{editItemIdx !== null ? 'Update' : 'Add Item'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit PO Modal */}
      <Dialog open={poModalOpen} onOpenChange={setPoModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editPoId ? `Edit ${poForm.poNumber}` : 'Create Purchase Order'}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">PO Number</label>
                <Input value={poForm.poNumber} readOnly className="bg-muted" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <Select value={poForm.status} onValueChange={(v: PurchaseOrder['status']) => setPoForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['Draft', 'Sent', 'Confirmed', 'Delivered'] as const).map(st => (
                      <SelectItem key={st} value={st}>{st}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Expected Delivery</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !poForm.expectedDelivery && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {poForm.expectedDelivery ? format(poForm.expectedDelivery, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={poForm.expectedDelivery} onSelect={d => setPoForm(f => ({ ...f, expectedDelivery: d }))} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted-foreground">Select Items & Quantities</label>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={loadFromSelections}>
                  <Package className="h-3 w-3 mr-1" /> Load from Selections
                </Button>
              </div>
              <div className="border rounded-md max-h-60 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead>Item Name</TableHead>
                      <TableHead className="w-20 text-right">Qty</TableHead>
                      <TableHead className="w-28 text-right">Unit Price €</TableHead>
                      <TableHead className="w-28 text-right">Total €</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {poForm.lineItems.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-4">No items available — add items to this supplier first.</TableCell></TableRow>
                    )}
                    {poForm.lineItems.map((line, idx) => (
                      <TableRow key={idx} className={cn(line.selected && "bg-primary/5")}>
                        <TableCell>
                          <Checkbox checked={line.selected} onCheckedChange={checked => {
                            setPoForm(f => {
                              const items = [...f.lineItems];
                              items[idx] = { ...items[idx], selected: !!checked };
                              return { ...f, lineItems: items };
                            });
                          }} />
                        </TableCell>
                        <TableCell className="text-sm font-medium">{line.itemName}</TableCell>
                        <TableCell className="text-right">
                          <Input type="number" min={1} value={line.qty} onChange={e => {
                            setPoForm(f => {
                              const items = [...f.lineItems];
                              items[idx] = { ...items[idx], qty: Math.max(1, +e.target.value) };
                              return { ...f, lineItems: items };
                            });
                          }} className="w-16 h-7 text-xs text-right ml-auto" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input type="number" min={0} value={line.unitPrice || ''} onChange={e => {
                            setPoForm(f => {
                              const items = [...f.lineItems];
                              items[idx] = { ...items[idx], unitPrice: +e.target.value };
                              return { ...f, lineItems: items };
                            });
                          }} className="w-24 h-7 text-xs text-right ml-auto" />
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">€{(line.qty * line.unitPrice).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {poForm.lineItems.some(l => l.selected) && (
                <div className="mt-2 text-right text-sm font-semibold text-foreground border-t pt-2">
                  Grand Total: €{poForm.lineItems.filter(l => l.selected).reduce((a, l) => a + l.qty * l.unitPrice, 0).toLocaleString()}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Notes</label>
              <Textarea value={poForm.notes} onChange={e => setPoForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Additional notes…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPoModalOpen(false)}>Cancel</Button>
            <Button onClick={savePO}>{editPoId ? 'Save Changes' : 'Create PO'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
