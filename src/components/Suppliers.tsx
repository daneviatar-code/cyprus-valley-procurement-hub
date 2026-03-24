import { useState, useMemo, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, ExternalLink, Package, Search, ChevronDown, ChevronRight, FileText, CalendarIcon } from 'lucide-react';
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
  Supplier, SupplierItem, loadSuppliers, saveSuppliers, generateSupplierId,
} from '@/data/supplierData';
import {
  PurchaseOrder, POLineItem, loadPurchaseOrders, savePurchaseOrders, generatePONumber, generatePOId,
} from '@/data/purchaseOrderData';
import { loadAllSelections } from '@/data/selectionData';
import { toast } from '@/hooks/use-toast';

const CATEGORIES = ['Furniture', 'Lighting', 'Textiles', 'Appliances', 'Bathroom', 'Kitchen', 'Outdoor', 'Accessories', 'Other'];
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

  // Purchase Orders state
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(loadPurchaseOrders);
  const [poModalOpen, setPoModalOpen] = useState(false);
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
      quantity: 1,
      unitPrice: i.unitPrice,
      selected: false,
    }));
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

  const savePO = () => {
    if (!poSupplierId) return;
    const selectedLines = poForm.lineItems.filter(l => l.selected);
    if (selectedLines.length === 0) { toast({ title: 'Select at least one item' }); return; }
    const po: PurchaseOrder = {
      id: generatePOId(),
      poNumber: poForm.poNumber,
      supplierId: poSupplierId,
      items: selectedLines.map(({ selected, ...rest }) => rest),
      status: poForm.status,
      expectedDelivery: poForm.expectedDelivery?.toISOString() || '',
      notes: poForm.notes,
      createdAt: new Date().toISOString(),
    };
    persistPOs([...purchaseOrders, po]);
    setPoModalOpen(false);
    toast({ title: `Purchase Order ${po.poNumber} created` });
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
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
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
    </div>
  );
}
