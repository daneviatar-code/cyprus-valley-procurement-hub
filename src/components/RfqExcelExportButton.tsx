/**
 * Excel (XLSX) export — same data shape as RfqExportButton (PDF),
 * aggregating across selected blocks (A/B/C) and filtered by category.
 */
import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { ProcurementCategory } from '@/data/roomStandardsData';
import {
  StandardItem, ApartmentType, APARTMENT_TYPES, ApartmentTypeQuantity,
} from '@/data/standardItemsData';
import { RoomSize, ROOM_SIZE_LABELS, ALL_BUILDING_LIST, conceptForBuilding, Concept } from '@/data/masterData';
import { Supplier } from '@/data/supplierData';

const BLOCK_LABELS: Record<Concept, string> = { A: 'Block A (HAPPINESS)', B: 'Block B (WELLNESS)', C: 'Block C (BOUTIQUE)' };

interface Props {
  items: StandardItem[];
  qtysByItem: Map<string, Record<ApartmentType, ApartmentTypeQuantity | undefined>>;
  categories: ProcurementCategory[];
  suppliers: Supplier[];
  unitCountsPerBuilding: Record<string, Record<RoomSize, number>>;
}

export default function RfqExcelExportButton({
  items, qtysByItem, categories, suppliers, unitCountsPerBuilding,
}: Props) {
  const [blocks, setBlocks] = useState<Set<Concept>>(new Set(['A', 'B', 'C']));
  const [categoryId, setCategoryId] = useState<string>('__all__');

  const toggleBlock = (b: Concept) => setBlocks(prev => {
    const next = new Set(prev); next.has(b) ? next.delete(b) : next.add(b); return next;
  });

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

  const handleExport = () => {
    if (blocks.size === 0) { toast.error('Select at least one block'); return; }

    const selectedCatName = categoryId === '__all__'
      ? 'All'
      : (categories.find(c => c.id === categoryId)?.nameEn || 'All');

    const rows: any[] = [];
    let totalQty = 0;
    let totalCost = 0;

    items
      .filter(i => !i.archived)
      .filter(i => categoryId === '__all__' || i.categoryId === categoryId)
      .sort((a, b) => {
        const ca = categories.find(c => c.id === a.categoryId)?.nameEn || '';
        const cb = categories.find(c => c.id === b.categoryId)?.nameEn || '';
        return ca.localeCompare(cb) || (a.itemName || '').localeCompare(b.itemName || '');
      })
      .forEach(i => {
        const row = qtysByItem.get(i.id);
        if (!row) return;
        let itemQty = 0;
        const perTypeQty: Record<ApartmentType, number> = {
          studio: 0, '1br': 0, '2br': 0, '3br': 0, '4br': 0,
        };
        types.forEach(at => {
          const q = row[at]; if (!q) return;
          const perUnit = (q.qtyPerPackage || 0) + (q.sparePerPackage || 0);
          const units = aggregatedCounts[at] || 0;
          const qty = perUnit * units;
          perTypeQty[at] = qty;
          itemQty += qty;
        });
        if (itemQty === 0) return;
        const lineCost = itemQty * (i.unitPriceEur || 0);
        totalQty += itemQty;
        totalCost += lineCost;
        rows.push({
          Category: categories.find(c => c.id === i.categoryId)?.nameEn || '—',
          Item: i.itemName || '—',
          Spec: i.spec || '',
          Dimensions: i.dimensions || '',
          Supplier: suppliers.find(s => s.id === i.supplierId)?.name || '',
          'Unit Price (EUR)': Number((i.unitPriceEur || 0).toFixed(2)),
          ...types.reduce((acc, at) => {
            acc[`${ROOM_SIZE_LABELS[at]} Qty`] = perTypeQty[at];
            return acc;
          }, {} as Record<string, number>),
          'Total Qty': itemQty,
          'Total Cost (EUR)': Number(lineCost.toFixed(2)),
        });
      });

    if (rows.length === 0) { toast.error('No items to export with current filters'); return; }

    rows.push({});
    rows.push({
      Category: 'TOTAL',
      'Total Qty': totalQty,
      'Total Cost (EUR)': Number(totalCost.toFixed(2)),
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    // Auto width
    const colKeys = Object.keys(rows[0] || {});
    ws['!cols'] = colKeys.map(k => {
      const maxLen = Math.max(
        k.length,
        ...rows.map(r => String(r[k] ?? '').length),
      );
      return { wch: Math.min(40, Math.max(10, maxLen + 2)) };
    });

    const wb = XLSX.utils.book_new();
    const sortedBlocks = (['A', 'B', 'C'] as Concept[]).filter(b => blocks.has(b));
    XLSX.utils.book_append_sheet(wb, ws, 'RFQ');

    const blockTag = sortedBlocks.join('-');
    const catTag = selectedCatName.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'All';
    const fileName = `RFQ-CyprusValley-${blockTag}-${catTag}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success('Excel נשלח להורדה', { description: fileName, duration: 5000 });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <FileSpreadsheet className="w-4 h-4" /> Excel
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="text-xs font-semibold mb-2 text-foreground">Blocks</div>
        <div className="space-y-1.5 mb-3">
          {(['A', 'B', 'C'] as Concept[]).map(b => (
            <label key={b} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/40 rounded px-1 py-0.5">
              <Checkbox checked={blocks.has(b)} onCheckedChange={() => toggleBlock(b)} />
              <span>{BLOCK_LABELS[b]}</span>
            </label>
          ))}
        </div>

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

        <Button
          size="sm"
          className="w-full gap-2"
          onClick={handleExport}
          disabled={blocks.size === 0}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" /> Export Excel
        </Button>
      </PopoverContent>
    </Popover>
  );
}
