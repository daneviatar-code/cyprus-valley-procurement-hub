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
    const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
    const show = (c: PdfCol) => pdfCols.has(c);
    const showPerType = show('perType');

    const headers: string[] = [];
    if (show('item')) headers.push('<th>Item</th>');
    if (show('dimensions')) headers.push('<th>Dimensions</th>');
    if (show('supplier')) headers.push('<th>Supplier</th>');
    if (showPerType) types.forEach(at => headers.push(`<th style="text-align:right;font-size:10px;text-transform:uppercase;color:#666">${esc(ROOM_SIZE_LABELS[at])}<br/><span style="font-weight:normal;font-size:9px">per × units</span></th>`));
    if (show('qty')) headers.push('<th style="text-align:right;background:#f5f8ff">Qty לבניין</th>');
    if (show('total')) headers.push('<th style="text-align:right">Total €</th>');

    const beforeQtyCount = (show('item') ? 1 : 0) + (show('dimensions') ? 1 : 0) + (show('supplier') ? 1 : 0) + (showPerType ? types.length : 0);

    const bodyRows = grouped.map(([catName, catRows]) => {
      const catQty = catRows.reduce((s, r) => s + r.totalQty, 0);
      const catCost = catRows.reduce((s, r) => s + r.totalCost, 0);
      const itemRows = catRows.map(r => {
        const cells: string[] = [];
        if (show('item')) cells.push(`<td style="padding:6px 8px">
            <div style="font-weight:600">${esc(r.item.itemName || '—')}</div>
            ${show('spec') && r.item.spec ? `<div style="font-size:10px;color:#666;white-space:pre-wrap;margin-top:2px">${esc(r.item.spec)}</div>` : ''}
          </td>`);
        if (show('dimensions')) cells.push(`<td style="padding:6px 8px;font-size:11px;color:#444">${esc(r.item.dimensions || '—')}</td>`);
        if (show('supplier')) cells.push(`<td style="padding:6px 8px;font-size:11px;color:#666">${esc(r.supplierName || '—')}</td>`);
        if (showPerType) types.forEach(at => {
          const d = r.perType[at];
          cells.push(`<td style="padding:6px 8px;text-align:right;font-family:monospace;font-size:11px;white-space:nowrap">${d ? `<span style="color:#666">${d.perUnit}×${d.units}</span> <b>= ${d.qty}</b>` : '—'}</td>`);
        });
        if (show('qty')) cells.push(`<td style="padding:6px 8px;text-align:right;font-family:monospace;font-weight:700;background:#f5f8ff">${r.totalQty.toLocaleString()}</td>`);
        if (show('total')) cells.push(`<td style="padding:6px 8px;text-align:right;font-family:monospace">${esc(eur(r.totalCost))}</td>`);
        return `<tr style="border-bottom:1px solid #eee;vertical-align:top">${cells.join('')}</tr>`;
      }).join('');
      const catCells: string[] = [];
      if (beforeQtyCount > 0) catCells.push(`<td colspan="${beforeQtyCount}" style="padding:6px 8px;font-size:11px;font-weight:700;text-transform:uppercase">${esc(catName)}</td>`);
      if (show('qty')) catCells.push(`<td style="padding:6px 8px;text-align:right;font-family:monospace;font-weight:700;background:#f5f8ff">${catQty.toLocaleString()}</td>`);
      if (show('total')) catCells.push(`<td style="padding:6px 8px;text-align:right;font-family:monospace;font-weight:700">${esc(eur(catCost))}</td>`);
      return `<tr style="background:#f0f0f0">${catCells.join('')}</tr>${itemRows}`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Building ${esc(building)} — Breakdown</title>
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        body { font-family: Inter, Arial, sans-serif; color: #111; margin: 0; padding: 16px; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        .sub { font-size: 11px; color: #666; margin-bottom: 12px; }
        .totals { display:flex; gap:24px; padding:10px 12px; background:#f7f7f7; border:1px solid #e5e5e5; border-radius:6px; margin-bottom:12px; font-size:12px; }
        .totals b { display:block; font-size:14px; font-family:monospace; }
        table { width:100%; border-collapse: collapse; font-size:12px; }
        th { text-align:left; padding:6px 8px; border-bottom:2px solid #333; font-size:10px; text-transform:uppercase; color:#666; }
        tr { page-break-inside: avoid; }
      </style></head><body>
      <h1>Building ${esc(building)} — Quantity Breakdown</h1>
      <div class="sub" dir="rtl">פירוט כמויות לבניין · ${totalUnits} units · ${types.map(t => `${esc(ROOM_SIZE_LABELS[t])}: ${buildingCounts[t] || 0}`).join(' · ')}</div>
      <div class="totals">
        <div>ITEMS<b>${filteredRows.length.toLocaleString()}</b></div>
        <div>TOTAL QTY<b>${totals.qty.toLocaleString()}</b></div>
        <div>TOTAL COST<b>${esc(eur(totals.cost))}</b></div>
      </div>
      <table>
        <thead><tr>${headers.join('')}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
      </body></html>`;

    // Strategy: open new tab and trigger print. If popup blocked, fall back to HTML download.
    const fullHtml = html.replace(
      '</body>',
      `<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},300);};</script></body>`
    );

    const win = window.open('', '_blank');
    if (win && !win.closed) {
      try {
        win.document.open();
        win.document.write(fullHtml);
        win.document.close();
        return;
      } catch (e) {
        console.error('Print window failed, falling back to download:', e);
        try { win.close(); } catch {}
      }
    }

    // Fallback: download as .html (user opens it and prints to PDF)
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `building-${building}-breakdown.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
