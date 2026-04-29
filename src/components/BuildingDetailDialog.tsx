/**
 * BuildingDetailDialog — shows a per-item breakdown for a single building.
 * Triggered from the "Breakdown per Building" cards in the Standard tab.
 */
import { useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { eur, ProcurementCategory } from '@/data/roomStandardsData';
import {
  StandardItem, ApartmentType, APARTMENT_TYPES, ApartmentTypeQuantity,
} from '@/data/standardItemsData';
import { RoomSize, ROOM_SIZE_LABELS } from '@/data/masterData';
import { Supplier } from '@/data/supplierData';
import SpecCell from './SpecCell';

type View = 'standard' | ApartmentType;

interface Props {
  open: boolean;
  onClose: () => void;
  building: string | null;
  view: View;
  items: StandardItem[];
  qtysByItem: Map<string, Record<ApartmentType, ApartmentTypeQuantity | undefined>>;
  categories: ProcurementCategory[];
  suppliers: Supplier[];
  buildingCounts: Record<RoomSize, number>;
}

export default function BuildingDetailDialog({
  open, onClose, building, view, items, qtysByItem, categories, suppliers, buildingCounts,
}: Props) {
  const types: ApartmentType[] = view === 'standard' ? [...APARTMENT_TYPES] : [view as ApartmentType];

  const rows = useMemo(() => {
    if (!building) return [];
    const out: {
      item: StandardItem;
      categoryName: string;
      perType: Partial<Record<ApartmentType, { perUnit: number; units: number; qty: number }>>;
      totalQty: number;
      totalCost: number;
      supplierName: string;
    }[] = [];

    items.forEach(i => {
      if (i.archived) return;
      const row = qtysByItem.get(i.id);
      if (!row) return;
      const perType: Partial<Record<ApartmentType, { perUnit: number; units: number; qty: number }>> = {};
      let totalQty = 0;
      types.forEach(at => {
        const q = row[at]; if (!q) return;
        const perUnit = (q.qtyPerPackage || 0) + (q.sparePerPackage || 0);
        const units = buildingCounts[at] || 0;
        const qty = perUnit * units;
        if (qty > 0) {
          perType[at] = { perUnit, units, qty };
          totalQty += qty;
        }
      });
      if (totalQty === 0) return;
      out.push({
        item: i,
        categoryName: categories.find(c => c.id === i.categoryId)?.nameEn || '—',
        perType,
        totalQty,
        totalCost: totalQty * (i.unitPriceEur || 0),
        supplierName: suppliers.find(s => s.id === i.supplierId)?.name || '',
      });
    });

    // Group by category, then sort by item name
    return out.sort((a, b) =>
      a.categoryName.localeCompare(b.categoryName) ||
      (a.item.itemName || '').localeCompare(b.item.itemName || ''),
    );
  }, [building, items, qtysByItem, categories, suppliers, buildingCounts, types]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof rows>();
    rows.forEach(r => {
      const arr = map.get(r.categoryName) || [];
      arr.push(r);
      map.set(r.categoryName, arr);
    });
    return Array.from(map.entries());
  }, [rows]);

  const totals = useMemo(() => {
    let qty = 0, cost = 0;
    rows.forEach(r => { qty += r.totalQty; cost += r.totalCost; });
    return { qty, cost };
  }, [rows]);

  const totalUnits = types.reduce((s, at) => s + (buildingCounts[at] || 0), 0);

  const exportCsv = () => {
    if (!building) return;
    const header = ['Category', 'Item', 'Spec', 'Supplier', 'Unit Price €',
      ...types.flatMap(at => [`${ROOM_SIZE_LABELS[at]} per-unit`, `${ROOM_SIZE_LABELS[at]} units`, `${ROOM_SIZE_LABELS[at]} qty`]),
      'Total Qty', 'Total Cost €',
    ];
    const lines = [header.join(',')];
    rows.forEach(r => {
      const cells: (string | number)[] = [
        r.categoryName, r.item.itemName, r.item.spec || '', r.supplierName,
        (r.item.unitPriceEur || 0).toFixed(2),
      ];
      types.forEach(at => {
        const d = r.perType[at];
        cells.push(d?.perUnit ?? 0, d?.units ?? 0, d?.qty ?? 0);
      });
      cells.push(r.totalQty, r.totalCost.toFixed(2));
      lines.push(cells.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `building-${building}-breakdown.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-lg">
                Building {building} — Quantity Breakdown
              </DialogTitle>
              <div className="text-xs text-muted-foreground mt-1" dir="rtl">
                פירוט כמויות לבניין · {totalUnits} units · {types.map(t => `${ROOM_SIZE_LABELS[t]}: ${buildingCounts[t] || 0}`).join(' · ')}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={exportCsv} className="gap-2 shrink-0">
              <Download className="w-4 h-4" /> CSV
            </Button>
          </div>
        </DialogHeader>

        {/* Totals strip */}
        <div className="grid grid-cols-3 gap-3 bg-muted/30 border rounded-md p-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Items</div>
            <div className="text-sm font-semibold font-mono">{rows.length.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Qty</div>
            <div className="text-sm font-semibold font-mono">{totals.qty.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Cost</div>
            <div className="text-sm font-semibold font-mono">{eur(totals.cost)}</div>
          </div>
        </div>

        <div className="overflow-auto flex-1 -mx-6 px-6">
          {grouped.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12">
              No items with quantities for this building.
            </div>
          ) : (
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col style={{ width: '32%' }} />
                <col style={{ width: '14%' }} />
                {types.map(at => <col key={at} style={{ width: `${Math.max(10, 38 / types.length)}%` }} />)}
                <col style={{ width: '10%' }} />
                <col style={{ width: '12%' }} />
              </colgroup>
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b">
                  <th className="text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-2 py-2">Item</th>
                  <th className="text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-2 py-2">Supplier</th>
                  {types.map(at => (
                    <th key={at} className="text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-2 py-2 whitespace-nowrap">
                      {ROOM_SIZE_LABELS[at]}<br />
                      <span className="font-normal normal-case text-[9px]">per × units</span>
                    </th>
                  ))}
                  <th className="text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-2 py-2 bg-primary/5">Qty לבניין</th>
                  <th className="text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-2 py-2">Total €</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map(([catName, catRows]) => {
                  const catQty = catRows.reduce((s, r) => s + r.totalQty, 0);
                  const catCost = catRows.reduce((s, r) => s + r.totalCost, 0);
                  return (
                    <>
                      <tr key={`cat-${catName}`} className="bg-muted/40">
                        <td colSpan={2 + types.length} className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-foreground">
                          {catName}
                        </td>
                        <td className="px-2 py-1.5 text-right text-[11px] font-mono font-semibold bg-primary/5">{catQty.toLocaleString()}</td>
                        <td className="px-2 py-1.5 text-right text-[11px] font-mono font-semibold">{eur(catCost)}</td>
                      </tr>
                      {catRows.map(r => (
                        <tr key={r.item.id} className="border-b hover:bg-muted/20 align-top">
                          <td className="px-2 py-1.5 min-w-0">
                            <div className="flex items-start gap-1">
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-foreground truncate">{r.item.itemName || '—'}</div>
                                {r.item.spec && <div className="text-[10px] text-muted-foreground line-clamp-2" title={r.item.spec}>{r.item.spec}</div>}
                              </div>
                              {r.item.spec && (
                                <SpecCell value={r.item.spec} onChange={() => {}} itemName={r.item.itemName} viewOnly />
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-xs text-muted-foreground truncate">{r.supplierName || '—'}</td>
                          {types.map(at => {
                            const d = r.perType[at];
                            return (
                              <td key={at} className="px-2 py-1.5 text-right font-mono text-xs whitespace-nowrap">
                                {d ? (
                                  <>
                                    <span className="text-muted-foreground">{d.perUnit}×{d.units}</span>{' '}
                                    <span className="text-foreground font-semibold">= {d.qty}</span>
                                  </>
                                ) : <span className="text-muted-foreground/40">—</span>}
                              </td>
                            );
                          })}
                          <td className="px-2 py-1.5 text-right font-mono font-bold text-foreground bg-primary/5 whitespace-nowrap">{r.totalQty.toLocaleString()}</td>
                          <td className="px-2 py-1.5 text-right font-mono text-foreground whitespace-nowrap">{eur(r.totalCost)}</td>
                        </tr>
                      ))}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
