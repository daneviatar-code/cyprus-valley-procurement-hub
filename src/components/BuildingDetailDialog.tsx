/**
 * BuildingDetailDialog — shows a per-item breakdown for a single building.
 * Triggered from the "Breakdown per Building" cards in the Standard tab.
 */
import { useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { eur, ProcurementCategory } from '@/data/roomStandardsData';
import {
  StandardItem, ApartmentType, APARTMENT_TYPES, ApartmentTypeQuantity,
} from '@/data/standardItemsData';
import { RoomSize, ROOM_SIZE_LABELS } from '@/data/masterData';
import { Supplier } from '@/data/supplierData';
import SpecCell from './SpecCell';

type PdfCol = 'item' | 'spec' | 'dimensions' | 'supplier' | 'perType' | 'qty' | 'total';
const PDF_COL_LABELS: Record<PdfCol, string> = {
  item: 'Item Name', spec: 'Spec', dimensions: 'Dimensions', supplier: 'Supplier',
  perType: 'Per-type breakdown', qty: 'Qty לבניין', total: 'Total €',
};
const ALL_PDF_COLS: PdfCol[] = ['item', 'spec', 'dimensions', 'supplier', 'perType', 'qty', 'total'];

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
  const [pdfCols, setPdfCols] = useState<Set<PdfCol>>(new Set(ALL_PDF_COLS));
  const [activeCategory, setActiveCategory] = useState<string>('__all__');
  const togglePdfCol = (c: PdfCol) => setPdfCols(prev => {
    const next = new Set(prev);
    next.has(c) ? next.delete(c) : next.add(c);
    return next;
  });

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

  // All defined categories (from Standard screen) — even those with 0 items in this building
  const allCategories = useMemo(
    () => categories.map(c => c.nameEn).filter(Boolean),
    [categories],
  );

  const countsByCategory = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach(r => map.set(r.categoryName, (map.get(r.categoryName) || 0) + 1));
    return map;
  }, [rows]);

  const filteredRows = useMemo(
    () => activeCategory === '__all__' ? rows : rows.filter(r => r.categoryName === activeCategory),
    [rows, activeCategory],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filteredRows>();
    filteredRows.forEach(r => {
      const arr = map.get(r.categoryName) || [];
      arr.push(r);
      map.set(r.categoryName, arr);
    });
    return Array.from(map.entries());
  }, [filteredRows]);

  const totals = useMemo(() => {
    let qty = 0, cost = 0;
    filteredRows.forEach(r => { qty += r.totalQty; cost += r.totalCost; });
    return { qty, cost };
  }, [filteredRows]);

  const totalUnits = types.reduce((s, at) => s + (buildingCounts[at] || 0), 0);

  const exportCsv = () => {
    if (!building) return;
    const header = ['Category', 'Item', 'Spec', 'Supplier', 'Unit Price €',
      ...types.flatMap(at => [`${ROOM_SIZE_LABELS[at]} per-unit`, `${ROOM_SIZE_LABELS[at]} units`, `${ROOM_SIZE_LABELS[at]} qty`]),
      'Total Qty', 'Total Cost €',
    ];
    const lines = [header.join(',')];
    filteredRows.forEach(r => {
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

  const exportPdf = () => {
    if (!building) return;
    const show = (c: PdfCol) => pdfCols.has(c);
    const showPerType = show('perType');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const headers: string[] = [];
    if (show('item')) headers.push(show('spec') ? 'Item / Spec' : 'Item');
    if (show('dimensions')) headers.push('Dimensions');
    if (show('supplier')) headers.push('Supplier');
    if (showPerType) types.forEach(at => headers.push(`${ROOM_SIZE_LABELS[at]}\nper × units`));
    if (show('qty')) headers.push('Qty Building');
    if (show('total')) headers.push('Total EUR');

    const body: (string | number)[][] = [];
    grouped.forEach(([catName, catRows]) => {
      const catQty = catRows.reduce((s, r) => s + r.totalQty, 0);
      const catCost = catRows.reduce((s, r) => s + r.totalCost, 0);
      const catLine = [catName];
      while (catLine.length < headers.length) catLine.push('');
      if (show('qty')) catLine[headers.indexOf('Qty Building')] = catQty.toLocaleString();
      if (show('total')) catLine[headers.indexOf('Total EUR')] = eur(catCost);
      body.push(catLine);

      catRows.forEach(r => {
        const row: (string | number)[] = [];
        if (show('item')) row.push(show('spec') && r.item.spec ? `${r.item.itemName || '—'}\n${r.item.spec}` : r.item.itemName || '—');
        if (show('dimensions')) row.push(r.item.dimensions || '—');
        if (show('supplier')) row.push(r.supplierName || '—');
        if (showPerType) types.forEach(at => {
          const d = r.perType[at];
          row.push(d ? `${d.perUnit}x${d.units} = ${d.qty}` : '—');
        });
        if (show('qty')) row.push(r.totalQty.toLocaleString());
        if (show('total')) row.push(eur(r.totalCost));
        body.push(row);
      });
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(`Building ${building} — Quantity Breakdown`, 40, 34);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Items: ${filteredRows.length.toLocaleString()}   Total Qty: ${totals.qty.toLocaleString()}   Total Cost: ${eur(totals.cost)}   Units: ${totalUnits}`, 40, 52);

    autoTable(doc, {
      head: [headers],
      body,
      startY: 68,
      theme: 'grid',
      margin: { left: 40, right: 40 },
      styles: { font: 'helvetica', fontSize: 7, cellPadding: 4, overflow: 'linebreak', valign: 'top' },
      headStyles: { fillColor: [24, 49, 74], textColor: 255, fontStyle: 'bold', halign: 'left' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didParseCell: (data) => {
        const raw = String(data.row.raw?.[0] ?? '');
        const isCategory = data.section === 'body' && allCategories.includes(raw);
        if (isCategory) {
          data.cell.styles.fillColor = [238, 242, 247];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = [24, 49, 74];
        }
        if (data.column.index >= headers.length - 2) data.cell.styles.halign = 'right';
      },
    });

    const fileName = `building-${building}-breakdown.pdf`;
    // Open in new tab so the user sees the PDF immediately
    try {
      const blobUrl = doc.output('bloburl');
      window.open(blobUrl, '_blank');
    } catch (e) {
      console.warn('Could not open PDF in new tab', e);
    }
    // Also trigger a download as backup
    doc.save(fileName);
    toast.success(`PDF נפתח בטאב חדש והורד: ${fileName}`, {
      description: 'בדוק בתיקיית ההורדות של הדפדפן',
      duration: 6000,
    });
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
            <div className="flex items-center gap-2 shrink-0">
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-2">
                    <FileText className="w-4 h-4" /> PDF
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-3">
                  <div className="text-xs font-semibold mb-2 text-foreground">Columns to include</div>
                  <div className="space-y-1.5 mb-3">
                    {ALL_PDF_COLS.map(c => (
                      <label key={c} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/40 rounded px-1 py-0.5">
                        <Checkbox
                          checked={pdfCols.has(c)}
                          onCheckedChange={() => togglePdfCol(c)}
                        />
                        <span>{PDF_COL_LABELS[c]}</span>
                      </label>
                    ))}
                  </div>
                  <Button size="sm" className="w-full gap-2" onClick={exportPdf} disabled={pdfCols.size === 0}>
                    <FileText className="w-3.5 h-3.5" /> Export PDF
                  </Button>
                </PopoverContent>
              </Popover>
              <Button size="sm" variant="outline" onClick={exportCsv} className="gap-2">
                <Download className="w-4 h-4" /> CSV
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Totals strip */}
        <div className="grid grid-cols-3 gap-3 bg-muted/30 border rounded-md p-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Items</div>
            <div className="text-sm font-semibold font-mono">{filteredRows.length.toLocaleString()}</div>
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

        {/* Category tabs */}
        {allCategories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-border pb-0">
            <button
              onClick={() => setActiveCategory('__all__')}
              className={`px-3 py-2 text-xs font-semibold rounded-t-md border-2 border-b-0 transition-colors ${
                activeCategory === '__all__'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              All <span className="opacity-70 ml-1">({rows.length})</span>
            </button>
            {allCategories.map(cat => {
              const count = countsByCategory.get(cat) || 0;
              const isActive = activeCategory === cat;
              const isEmpty = count === 0;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-2 text-xs font-semibold rounded-t-md border-2 border-b-0 transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary'
                      : isEmpty
                        ? 'bg-muted/20 border-border/60 text-muted-foreground/60 hover:text-foreground hover:bg-muted/40'
                        : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {cat} <span className="opacity-70 ml-1">({count})</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="overflow-auto flex-1 -mx-6 px-6">
          {grouped.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12">
              No items with quantities for this building.
            </div>
          ) : (
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col style={{ width: '28%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
                {types.map(at => <col key={at} style={{ width: `${Math.max(8, 36 / types.length)}%` }} />)}
                <col style={{ width: '10%' }} />
                <col style={{ width: '12%' }} />
              </colgroup>
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b">
                  <th className="text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-2 py-2">Item</th>
                  <th className="text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-2 py-2">Dimensions</th>
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
                        <td colSpan={3 + types.length} className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-foreground">
                          {catName}
                        </td>
                        <td className="px-2 py-1.5 text-right text-[11px] font-mono font-semibold bg-primary/5">{catQty.toLocaleString()}</td>
                        <td className="px-2 py-1.5 text-right text-[11px] font-mono font-semibold">{eur(catCost)}</td>
                      </tr>
                      {catRows.map(r => (
                        <tr key={r.item.id} className="border-b hover:bg-muted/20 align-top">
                          <td className="px-2 py-1.5 min-w-0">
                            <div className="font-medium text-foreground">{r.item.itemName || '—'}</div>
                            {r.item.spec && <div className="text-[10px] text-muted-foreground whitespace-pre-wrap break-words mt-0.5">{r.item.spec}</div>}
                          </td>
                          <td className="px-2 py-1.5 text-xs text-foreground/80 whitespace-pre-wrap break-words">{r.item.dimensions || '—'}</td>
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
