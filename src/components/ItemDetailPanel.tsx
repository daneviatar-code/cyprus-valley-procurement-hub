import { useState } from 'react';
import { X } from 'lucide-react';
import { UserItemData, Status, categoryEmojis, getUserItemData } from '@/data/projectData';
import { ComputedProcurementItem, ALL_BUILDING_LIST } from '@/data/masterData';

interface ItemDetailPanelProps {
  item: ComputedProcurementItem;
  userData: UserItemData;
  onSave: (id: number, data: UserItemData) => void;
  onClose: () => void;
}

export default function ItemDetailPanel({ item, userData, onSave, onClose }: ItemDetailPanelProps) {
  const [form, setForm] = useState<UserItemData>({ ...userData });

  const handleSave = () => {
    onSave(item.id, form);
    onClose();
  };

  const labelClass = 'block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1';
  const inputClass = 'w-full h-9 rounded-md border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50';

  // Per-building breakdown
  const buildingsWithQty = ALL_BUILDING_LIST.filter(b => (item.qtyByBuilding[b] || 0) > 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-foreground/20" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card shadow-xl border-l overflow-y-auto animate-fade-in">
        <div className="sticky top-0 bg-card border-b px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{categoryEmojis[item.category]} {item.category}</p>
            <h2 className="text-lg font-semibold text-foreground">{item.name}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Concept Quantities */}
          <div>
            <p className={labelClass}>Quantities by Concept</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Happiness (A)', value: item.qtyA, color: 'border-happiness' },
                { label: 'Wellness (B)', value: item.qtyB, color: 'border-wellness' },
                { label: 'Boutique (C)', value: item.qtyC, color: 'border-boutique' },
                { label: 'Grand Total', value: item.grandTotal, color: 'border-accent' },
              ].map((q) => (
                <div key={q.label} className={`rounded-md border-l-2 ${q.color} bg-muted/40 p-2 text-center`}>
                  <p className="text-lg font-bold text-foreground">{q.value}</p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{q.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Per-Building Breakdown */}
          {buildingsWithQty.length > 0 && (
            <div>
              <p className={labelClass}>Per Building</p>
              <div className="grid grid-cols-3 gap-1.5">
                {buildingsWithQty.map(b => (
                  <div key={b} className="rounded-md bg-muted/30 px-2 py-1.5 text-center">
                    <p className="text-sm font-bold text-foreground">{item.qtyByBuilding[b]}</p>
                    <p className="text-[9px] text-muted-foreground font-medium">{b}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Editable Fields */}
          <div>
            <label className={labelClass}>Supplier Name</label>
            <input className={inputClass} value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>Supplier Contact</label>
            <input className={inputClass} value={form.supplierContact} onChange={(e) => setForm({ ...form, supplierContact: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>Catalogue Ref / SKU</label>
            <input className={inputClass} value={form.catalogueRef} onChange={(e) => setForm({ ...form, catalogueRef: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Unit Price (€)</label>
              <input
                type="number"
                className={inputClass}
                value={form.unitPrice ?? ''}
                onChange={(e) => setForm({ ...form, unitPrice: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
            <div>
              <label className={labelClass}>Total Cost (€)</label>
              <div className="h-9 rounded-md bg-muted/60 px-3 flex items-center text-sm font-medium text-foreground">
                {form.unitPrice ? `€${(item.grandTotal * form.unitPrice).toLocaleString()}` : '—'}
              </div>
            </div>
          </div>
          <div>
            <label className={labelClass}>Lead Time (weeks)</label>
            <input className={inputClass} value={form.leadTime} onChange={(e) => setForm({ ...form, leadTime: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as Status })}
            >
              <option value="">— None —</option>
              <option value="Pending">Pending</option>
              <option value="Ordered">Ordered</option>
              <option value="Delivered">Delivered</option>
              <option value="Issue">Issue</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Image URL</label>
            <input className={inputClass} value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." />
          </div>
          <div>
            <label className={labelClass}>Notes</label>
            <textarea
              className="w-full rounded-md border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 min-h-[80px]"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <button
            onClick={handleSave}
            className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
