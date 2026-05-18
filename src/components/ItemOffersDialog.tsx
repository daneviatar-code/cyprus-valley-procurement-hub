/**
 * ItemOffersDialog — manage multiple supplier offers for one StandardItem.
 *
 * Modes: list (compare/select), edit (add or modify offer), history (audit).
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus, Trash2, Pencil, History, ArrowLeft, DollarSign, Zap, Save, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { StandardItem } from '@/data/standardItemsData';
import {
  ItemOffer, ItemOfferHistoryRow, genOfferId,
  saveItemOffer, deleteItemOffer, selectItemOffer,
  loadItemOffers, subscribeItemOffers,
  getOffersForItem, getCheapestOffer, getFastestOffer,
  fetchOfferHistory,
} from '@/data/itemOffersData';
import {
  Supplier, loadSuppliers, subscribeSuppliers, saveSuppliers, generateSupplierId,
} from '@/data/supplierData';
import { SUPPORTED_CURRENCIES, toEur, formatMoney, refreshRatesIfNeeded } from '@/lib/fxRates';

type Mode = 'list' | 'edit' | 'history';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: StandardItem | null;
}

const emptyOffer = (standardItemId: string): ItemOffer => ({
  id: genOfferId(),
  standardItemId,
  supplierId: null,
  productName: '',
  productSku: '',
  spec: '',
  dimensions: '',
  imageUrl: '',
  price: 0,
  currency: 'EUR',
  priceEur: 0,
  leadTimeDays: null,
  moq: null,
  validUntil: null,
  notes: '',
  isSelected: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export default function ItemOffersDialog({ open, onOpenChange, item }: Props) {
  const [mode, setMode] = useState<Mode>('list');
  const [allOffers, setAllOffers] = useState<ItemOffer[]>(loadItemOffers);
  const [suppliers, setSuppliers] = useState<Supplier[]>(loadSuppliers);
  const [editingOffer, setEditingOffer] = useState<ItemOffer | null>(null);
  const [history, setHistory] = useState<ItemOfferHistoryRow[]>([]);
  const [quickSupplierName, setQuickSupplierName] = useState('');
  const [showQuickSupplier, setShowQuickSupplier] = useState(false);

  useEffect(() => subscribeItemOffers(setAllOffers), []);
  useEffect(() => subscribeSuppliers(setSuppliers), []);

  useEffect(() => {
    if (open) {
      setMode('list');
      void refreshRatesIfNeeded();
    }
  }, [open, item?.id]);

  const offers = useMemo(
    () => item ? getOffersForItem(allOffers, item.id) : [],
    [allOffers, item],
  );

  const cheapest = useMemo(() => getCheapestOffer(offers), [offers]);
  const fastest = useMemo(() => getFastestOffer(offers), [offers]);

  const supplierName = (id?: string | null) =>
    suppliers.find(s => s.id === id)?.name || '—';

  const openEdit = (o?: ItemOffer) => {
    if (!item) return;
    setEditingOffer(o ? { ...o } : emptyOffer(item.id));
    setMode('edit');
  };

  const openHistory = async () => {
    if (!item) return;
    setMode('history');
    const rows = await fetchOfferHistory(item.id);
    setHistory(rows);
  };

  const handleSelect = async (o: ItemOffer) => {
    await selectItemOffer(o.id);
    toast.success('Selected offer updated');
  };

  const handleDelete = async (o: ItemOffer) => {
    if (!confirm(`Delete offer from ${supplierName(o.supplierId)}?`)) return;
    await deleteItemOffer(o.id);
    toast.success('Offer deleted');
  };

  const handleSaveEdit = async () => {
    if (!editingOffer) return;
    if (!editingOffer.productName.trim()) {
      toast.error('Product name is required');
      return;
    }
    if (!(editingOffer.price >= 0)) {
      toast.error('Price must be ≥ 0');
      return;
    }
    await saveItemOffer(editingOffer);
    toast.success('Offer saved');
    setMode('list');
    setEditingOffer(null);
  };

  const handleQuickAddSupplier = () => {
    const name = quickSupplierName.trim();
    if (!name) return;
    const newSup: Supplier = {
      id: generateSupplierId(),
      name,
      contactPerson: '', email: '', phone: '', website: '',
      country: '', address: '', paymentTerms: '', currency: 'EUR',
      notes: '', category: 'Furniture', items: [],
      createdAt: new Date().toISOString(),
    };
    const next = [...suppliers, newSup];
    setSuppliers(next);
    saveSuppliers(next);
    setEditingOffer(prev => prev ? { ...prev, supplierId: newSup.id } : prev);
    setQuickSupplierName('');
    setShowQuickSupplier(false);
    toast.success('Supplier created');
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Price Comparison · {item.itemName || '(unnamed item)'}</span>
            <span className="text-xs text-muted-foreground font-normal">{item.spec}</span>
          </DialogTitle>
        </DialogHeader>

        {mode === 'list' && (
          <ListMode
            offers={offers}
            cheapest={cheapest}
            fastest={fastest}
            supplierName={supplierName}
            onAdd={() => openEdit()}
            onEdit={openEdit}
            onDelete={handleDelete}
            onSelect={handleSelect}
            onHistory={openHistory}
          />
        )}

        {mode === 'edit' && editingOffer && (
          <EditMode
            offer={editingOffer}
            setOffer={setEditingOffer}
            suppliers={suppliers}
            showQuickSupplier={showQuickSupplier}
            setShowQuickSupplier={setShowQuickSupplier}
            quickSupplierName={quickSupplierName}
            setQuickSupplierName={setQuickSupplierName}
            onQuickAddSupplier={handleQuickAddSupplier}
            onCancel={() => { setMode('list'); setEditingOffer(null); }}
            onSave={handleSaveEdit}
          />
        )}

        {mode === 'history' && (
          <HistoryMode
            history={history}
            supplierName={supplierName}
            onBack={() => setMode('list')}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ───── List Mode ─────
function ListMode({
  offers, cheapest, fastest, supplierName,
  onAdd, onEdit, onDelete, onSelect, onHistory,
}: {
  offers: ItemOffer[];
  cheapest?: ItemOffer;
  fastest?: ItemOffer;
  supplierName: (id?: string | null) => string;
  onAdd: () => void;
  onEdit: (o: ItemOffer) => void;
  onDelete: (o: ItemOffer) => void;
  onSelect: (o: ItemOffer) => void;
  onHistory: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {offers.length} offer{offers.length === 1 ? '' : 's'}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onHistory} className="gap-1">
            <History className="w-3.5 h-3.5" /> History
          </Button>
          <Button size="sm" onClick={onAdd} className="gap-1">
            <Plus className="w-3.5 h-3.5" /> Add Offer
          </Button>
        </div>
      </div>

      {offers.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-muted rounded-lg">
          <p className="text-sm text-muted-foreground mb-3">No offers yet for this item.</p>
          <Button size="sm" onClick={onAdd}><Plus className="w-3.5 h-3.5" /> Add first offer</Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-y">
              <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-2 py-1.5 w-10">Pick</th>
                <th className="px-2 py-1.5">Supplier</th>
                <th className="px-2 py-1.5">Product</th>
                <th className="px-2 py-1.5 text-right">Price</th>
                <th className="px-2 py-1.5 text-right">EUR</th>
                <th className="px-2 py-1.5 text-right">Lead</th>
                <th className="px-2 py-1.5 text-right">MOQ</th>
                <th className="px-2 py-1.5">Valid</th>
                <th className="px-2 py-1.5 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {offers.map(o => {
                const isCheapest = cheapest?.id === o.id;
                const isFastest = fastest?.id === o.id;
                return (
                  <tr key={o.id}
                    className={`border-b last:border-0 ${o.isSelected ? 'bg-accent/10' : 'hover:bg-muted/30'}`}>
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="radio"
                        checked={o.isSelected}
                        onChange={() => onSelect(o)}
                        className="cursor-pointer"
                        aria-label="Select offer"
                      />
                    </td>
                    <td className="px-2 py-1.5 font-medium">{supplierName(o.supplierId)}</td>
                    <td className="px-2 py-1.5">
                      <div>{o.productName || '—'}</div>
                      {o.productSku && <div className="text-[10px] text-muted-foreground">{o.productSku}</div>}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">{formatMoney(o.price, o.currency)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      <span className="inline-flex items-center gap-1">
                        {isCheapest && <DollarSign className="w-3 h-3 text-green-600" />}
                        {formatMoney(o.priceEur ?? toEur(o.price, o.currency), 'EUR')}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      <span className="inline-flex items-center gap-1">
                        {isFastest && <Zap className="w-3 h-3 text-blue-600" />}
                        {o.leadTimeDays != null ? `${o.leadTimeDays}d` : '—'}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">{o.moq ?? '—'}</td>
                    <td className="px-2 py-1.5">{o.validUntil || '—'}</td>
                    <td className="px-2 py-1.5 text-right">
                      <button onClick={() => onEdit(o)} className="p-1 text-muted-foreground hover:text-foreground" title="Edit">
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button onClick={() => onDelete(o)} className="p-1 text-muted-foreground hover:text-destructive" title="Delete">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ───── Edit Mode ─────
function EditMode({
  offer, setOffer, suppliers, showQuickSupplier, setShowQuickSupplier,
  quickSupplierName, setQuickSupplierName, onQuickAddSupplier, onCancel, onSave,
}: {
  offer: ItemOffer;
  setOffer: (o: ItemOffer | null | ((p: ItemOffer | null) => ItemOffer | null)) => void;
  suppliers: Supplier[];
  showQuickSupplier: boolean;
  setShowQuickSupplier: (v: boolean) => void;
  quickSupplierName: string;
  setQuickSupplierName: (v: string) => void;
  onQuickAddSupplier: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const patch = (p: Partial<ItemOffer>) =>
    setOffer(prev => prev ? { ...prev, ...p } : prev);

  const eurPreview = toEur(offer.price, offer.currency);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {/* Supplier */}
        <div className="col-span-2">
          <Label className="text-xs">Supplier</Label>
          <div className="flex items-center gap-2 mt-1">
            <select
              className="flex-1 h-9 px-2 text-sm border rounded bg-background"
              value={offer.supplierId || ''}
              onChange={e => patch({ supplierId: e.target.value || null })}
            >
              <option value="">—</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <Button type="button" size="sm" variant="outline"
              onClick={() => setShowQuickSupplier(!showQuickSupplier)}>
              <Plus className="w-3 h-3" /> New
            </Button>
          </div>
          {showQuickSupplier && (
            <div className="flex items-center gap-2 mt-2">
              <Input placeholder="New supplier name" value={quickSupplierName}
                onChange={e => setQuickSupplierName(e.target.value)} className="h-8 text-sm" />
              <Button size="sm" onClick={onQuickAddSupplier}>Add</Button>
            </div>
          )}
        </div>

        <div className="col-span-2">
          <Label className="text-xs">Product name <span className="text-destructive">*</span></Label>
          <Input value={offer.productName}
            onChange={e => patch({ productName: e.target.value })}
            className="mt-1 h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs">SKU</Label>
          <Input value={offer.productSku || ''}
            onChange={e => patch({ productSku: e.target.value })}
            className="mt-1 h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Dimensions</Label>
          <Input value={offer.dimensions || ''}
            onChange={e => patch({ dimensions: e.target.value })}
            className="mt-1 h-9 text-sm" placeholder="W×D×H cm" />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Spec</Label>
          <Textarea value={offer.spec || ''}
            onChange={e => patch({ spec: e.target.value })}
            className="mt-1 text-sm" rows={2} />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Image URL</Label>
          <Input value={offer.imageUrl || ''}
            onChange={e => patch({ imageUrl: e.target.value })}
            className="mt-1 h-9 text-sm" placeholder="https://…" />
        </div>
      </div>

      <div className="border-t pt-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Commercial terms</div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Price <span className="text-destructive">*</span></Label>
            <Input type="number" step="0.01" value={offer.price ?? 0}
              onChange={e => patch({ price: Math.max(0, +e.target.value) })}
              className="mt-1 h-9 text-sm text-right font-mono" />
          </div>
          <div>
            <Label className="text-xs">Currency</Label>
            <select className="mt-1 h-9 w-full px-2 text-sm border rounded bg-background"
              value={offer.currency}
              onChange={e => patch({ currency: e.target.value })}>
              {SUPPORTED_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">≈ in EUR</Label>
            <div className="mt-1 h-9 px-2 text-sm border rounded bg-muted flex items-center font-mono">
              {formatMoney(eurPreview, 'EUR')}
            </div>
          </div>
          <div>
            <Label className="text-xs">Lead time (days)</Label>
            <Input type="number" value={offer.leadTimeDays ?? ''}
              onChange={e => patch({ leadTimeDays: e.target.value === '' ? null : Math.max(0, +e.target.value) })}
              className="mt-1 h-9 text-sm text-right font-mono" />
          </div>
          <div>
            <Label className="text-xs">MOQ</Label>
            <Input type="number" value={offer.moq ?? ''}
              onChange={e => patch({ moq: e.target.value === '' ? null : Math.max(0, +e.target.value) })}
              className="mt-1 h-9 text-sm text-right font-mono" />
          </div>
          <div>
            <Label className="text-xs">Valid until</Label>
            <Input type="date" value={offer.validUntil || ''}
              onChange={e => patch({ validUntil: e.target.value || null })}
              className="mt-1 h-9 text-sm" />
          </div>
          <div className="col-span-3">
            <Label className="text-xs">Notes</Label>
            <Textarea value={offer.notes || ''}
              onChange={e => patch({ notes: e.target.value })}
              className="mt-1 text-sm" rows={2} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t pt-3">
        <Checkbox id="is-selected" checked={offer.isSelected}
          onCheckedChange={(v) => patch({ isSelected: !!v })} />
        <label htmlFor="is-selected" className="text-sm cursor-pointer">
          Set as the selected offer for this item
        </label>
      </div>

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button variant="outline" onClick={onCancel}><X className="w-3.5 h-3.5" /> Cancel</Button>
        <Button onClick={onSave}><Save className="w-3.5 h-3.5" /> Save</Button>
      </div>
    </div>
  );
}

// ───── History Mode ─────
const ACTION_COLORS: Record<string, string> = {
  created: 'bg-green-100 text-green-800',
  updated: 'bg-blue-100 text-blue-800',
  deleted: 'bg-destructive/10 text-destructive',
  selected: 'bg-accent/20 text-accent-foreground',
  deselected: 'bg-muted text-muted-foreground',
};

function HistoryMode({
  history, supplierName, onBack,
}: {
  history: ItemOfferHistoryRow[];
  supplierName: (id?: string | null) => string;
  onBack: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button size="sm" variant="outline" onClick={onBack}>
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </Button>
        <div className="text-xs text-muted-foreground">{history.length} events</div>
      </div>
      {history.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No history yet.
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-y sticky top-0">
              <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-2 py-1.5">When</th>
                <th className="px-2 py-1.5">Action</th>
                <th className="px-2 py-1.5">Supplier</th>
                <th className="px-2 py-1.5">Product</th>
                <th className="px-2 py-1.5 text-right">Price</th>
                <th className="px-2 py-1.5 text-right">EUR</th>
              </tr>
            </thead>
            <tbody>
              {history.map(h => {
                const snap = h.snapshot || {};
                return (
                  <tr key={h.historyId} className="border-b last:border-0">
                    <td className="px-2 py-1.5 font-mono text-[10px]">
                      {new Date(h.changedAt).toLocaleString()}
                    </td>
                    <td className="px-2 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ACTION_COLORS[h.action] || 'bg-muted'}`}>
                        {h.action}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">{supplierName(snap.supplier_id)}</td>
                    <td className="px-2 py-1.5">{snap.product_name || '—'}</td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      {formatMoney(snap.price, snap.currency)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      {formatMoney(snap.price_eur, 'EUR')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
