/**
 * RFQ PDF export — reuses the BuildingDetailDialog PDF template,
 * but aggregates data across selected blocks (A/B/C) and filters by a category.
 */
import { useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import { toast } from 'sonner';
import { eur, ProcurementCategory } from '@/data/roomStandardsData';
import {
  StandardItem, ApartmentType, APARTMENT_TYPES, ApartmentTypeQuantity,
} from '@/data/standardItemsData';
import { RoomSize, ROOM_SIZE_LABELS, ALL_BUILDING_LIST, conceptForBuilding, Concept } from '@/data/masterData';
import { Supplier } from '@/data/supplierData';

type PdfCol = 'item' | 'spec' | 'dimensions' | 'supplier' | 'unitPrice' | 'perType' | 'qty' | 'total';
const PDF_COL_LABELS: Record<PdfCol, string> = {
  item: 'Item Name', spec: 'Spec', dimensions: 'Dimensions', supplier: 'Supplier',
  unitPrice: 'Unit Price €', perType: 'Per-type breakdown', qty: 'Qty לבניין', total: 'Total €',
};
const ALL_PDF_COLS: PdfCol[] = ['item', 'spec', 'dimensions', 'supplier', 'unitPrice', 'perType', 'qty', 'total'];

const eurFull = (n: number): string =>
  `€${(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const BLOCK_LABELS: Record<Concept, string> = { A: 'Block A (HAPPINESS)', B: 'Block B (WELLNESS)', C: 'Block C (BOUTIQUE)' };
const BLOCK_SHORT: Record<Concept, string> = { A: 'Block A', B: 'Block B', C: 'Block C' };

interface Props {
  items: StandardItem[];
  qtysByItem: Map<string, Record<ApartmentType, ApartmentTypeQuantity | undefined>>;
  categories: ProcurementCategory[];
  suppliers: Supplier[];
  unitCountsPerBuilding: Record<string, Record<RoomSize, number>>;
}

export default function RfqExportButton({
  items, qtysByItem, categories, suppliers, unitCountsPerBuilding,
}: Props) {
  const [pdfCols, setPdfCols] = useState<Set<PdfCol>>(new Set(ALL_PDF_COLS));
  const [blocks, setBlocks] = useState<Set<Concept>>(new Set(['A', 'B', 'C']));
  const [categoryId, setCategoryId] = useState<string>('__all__');

  const togglePdfCol = (c: PdfCol) => setPdfCols(prev => {
    const next = new Set(prev); next.has(c) ? next.delete(c) : next.add(c); return next;
  });
  const toggleBlock = (b: Concept) => setBlocks(prev => {
    const next = new Set(prev); next.has(b) ? next.delete(b) : next.add(b); return next;
  });

  const allCategories = useMemo(
    () => categories.map(c => c.nameEn).filter(Boolean),
    [categories],
  );

  // Aggregated unit counts across selected blocks
  const aggregatedCounts = useMemo(() => {
    const out: Record<RoomSize, number> = { studio: 0, '1br': 0, '2br': 0, '3br': 0, '4br': 0, public: 0 };
    ALL_BUILDING_LIST.forEach(b => {
      if (!blocks.has(conceptForBuilding(b))) return;
      const bc = unitCountsPerBuilding[b]; if (!bc) return;
      (Object.keys(out) as RoomSize[]).forEach(rs => { out[rs] += bc[rs] || 0; });
    });
    return out;
  }, [blocks, unitCountsPerBuilding]);

  const types: ApartmentType[] = [...APARTMENT_TYPES];

  const exportPdf = () => {
    if (blocks.size === 0) { toast.error('Select at least one block'); return; }

    const selectedCatName = categoryId === '__all__'
      ? 'All'
      : (categories.find(c => c.id === categoryId)?.nameEn || 'All');

    // Build rows (filter by category + has qty in aggregated counts)
    const rows: {
      item: StandardItem;
      categoryName: string;
      perType: Partial<Record<ApartmentType, { perUnit: number; units: number; qty: number }>>;
      totalQty: number;
      totalCost: number;
      supplierName: string;
    }[] = [];

    items.forEach(i => {
      if (i.archived) return;
      if (categoryId !== '__all__' && i.categoryId !== categoryId) return;
      const row = qtysByItem.get(i.id);
      if (!row) return;
      const perType: Partial<Record<ApartmentType, { perUnit: number; units: number; qty: number }>> = {};
      let totalQty = 0;
      types.forEach(at => {
        const q = row[at]; if (!q) return;
        const perUnit = (q.qtyPerPackage || 0) + (q.sparePerPackage || 0);
        const units = aggregatedCounts[at] || 0;
        const qty = perUnit * units;
        if (qty > 0) {
          perType[at] = { perUnit, units, qty };
          totalQty += qty;
        }
      });
      if (totalQty === 0) return;
      rows.push({
        item: i,
        categoryName: categories.find(c => c.id === i.categoryId)?.nameEn || '—',
        perType,
        totalQty,
        totalCost: totalQty * (i.unitPriceEur || 0),
        supplierName: suppliers.find(s => s.id === i.supplierId)?.name || '',
      });
    });

    rows.sort((a, b) =>
      a.categoryName.localeCompare(b.categoryName) ||
      (a.item.itemName || '').localeCompare(b.item.itemName || ''),
    );

    if (rows.length === 0) { toast.error('No items to export with current filters'); return; }

    const grouped = new Map<string, typeof rows>();
    rows.forEach(r => {
      const arr = grouped.get(r.categoryName) || [];
      arr.push(r); grouped.set(r.categoryName, arr);
    });

    const totals = rows.reduce((acc, r) => {
      acc.qty += r.totalQty; acc.cost += r.totalCost; return acc;
    }, { qty: 0, cost: 0 });
    const totalUnits = types.reduce((s, at) => s + (aggregatedCounts[at] || 0), 0);

    const show = (c: PdfCol) => pdfCols.has(c);
    const showPerType = show('perType');

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const headers: string[] = [];
    if (show('item')) headers.push(show('spec') ? 'Item / Spec' : 'Item');
    if (show('dimensions')) headers.push('Dimensions');
    if (show('supplier')) headers.push('Supplier');
    if (show('unitPrice')) headers.push('Unit Price EUR');
    if (showPerType) types.forEach(at => headers.push(`${ROOM_SIZE_LABELS[at]}\nper × units`));
    if (show('qty')) headers.push('Qty Building');
    if (show('total')) headers.push('Total EUR');

    const body: (string | number)[][] = [];
    Array.from(grouped.entries()).forEach(([catName, catRows]) => {
      const catQty = catRows.reduce((s, r) => s + r.totalQty, 0);
      const catCost = catRows.reduce((s, r) => s + r.totalCost, 0);
      const catLine: (string | number)[] = [catName];
      while (catLine.length < headers.length) catLine.push('');
      if (show('qty')) catLine[headers.indexOf('Qty Building')] = catQty.toLocaleString();
      if (show('total')) catLine[headers.indexOf('Total EUR')] = eur(catCost);
      body.push(catLine);

      catRows.forEach(r => {
        const row: (string | number)[] = [];
        if (show('item')) row.push(show('spec') && r.item.spec ? `${r.item.itemName || '—'}\n${r.item.spec}` : r.item.itemName || '—');
        if (show('dimensions')) row.push(r.item.dimensions || '—');
        if (show('supplier')) row.push(r.supplierName || '—');
        if (show('unitPrice')) row.push(eurFull(r.item.unitPriceEur || 0));
        if (showPerType) types.forEach(at => {
          const d = r.perType[at];
          row.push(d ? `${d.perUnit}x${d.units} = ${d.qty}` : '—');
        });
        if (show('qty')) row.push(r.totalQty.toLocaleString());
        if (show('total')) row.push(eur(r.totalCost));
        body.push(row);
      });
    });

    const sortedBlocks = (['A', 'B', 'C'] as Concept[]).filter(b => blocks.has(b));
    const blockNames = sortedBlocks.map(b => BLOCK_SHORT[b]).join(', ');
    const title = `RFQ — Cyprus Valley — ${blockNames} — ${selectedCatName}`;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(title, 40, 34);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Items: ${rows.length.toLocaleString()}   Total Qty: ${totals.qty.toLocaleString()}   Total Cost: ${eur(totals.cost)}   Units: ${totalUnits}`, 40, 52);

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

    const blockTag = sortedBlocks.join('-');
    const catTag = selectedCatName.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'All';
    const fileName = `RFQ-CyprusValley-${blockTag}-${catTag}.pdf`;

    try {
      doc.save(fileName);
      toast.success('PDF נשלח להורדה', { description: fileName, duration: 5000 });
    } catch (err) {
      console.error('RFQ PDF export failed', err);
      toast.error('שגיאה בייצוא PDF');
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <FileText className="w-4 h-4" /> PDF
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        {/* Blocks */}
        <div className="text-xs font-semibold mb-2 text-foreground">Blocks</div>
        <div className="space-y-1.5 mb-3">
          {(['A', 'B', 'C'] as Concept[]).map(b => (
            <label key={b} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/40 rounded px-1 py-0.5">
              <Checkbox checked={blocks.has(b)} onCheckedChange={() => toggleBlock(b)} />
              <span>{BLOCK_LABELS[b]}</span>
            </label>
          ))}
        </div>

        {/* Category */}
        <div className="text-xs font-semibold mb-2 text-foreground">Category</div>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full mb-3 text-xs border border-input bg-background rounded-md px-2 py-1.5"
        >
          <option value="__all__">All</option>
          {categories.filter(c => !c.archived).map(c => (
            <option key={c.id} value={c.id}>{c.nameEn}</option>
          ))}
        </select>

        {/* Columns */}
        <div className="text-xs font-semibold mb-2 text-foreground">Columns to include</div>
        <div className="space-y-1.5 mb-3">
          {ALL_PDF_COLS.map(c => (
            <label key={c} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/40 rounded px-1 py-0.5">
              <Checkbox checked={pdfCols.has(c)} onCheckedChange={() => togglePdfCol(c)} />
              <span>{PDF_COL_LABELS[c]}</span>
            </label>
          ))}
        </div>

        <Button
          size="sm"
          className="w-full gap-2"
          onClick={exportPdf}
          disabled={pdfCols.size === 0 || blocks.size === 0}
        >
          <FileText className="w-3.5 h-3.5" /> Export PDF
        </Button>
      </PopoverContent>
    </Popover>
  );
}
