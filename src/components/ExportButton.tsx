import { Download } from 'lucide-react';
import { UserItemData, getUserItemData } from '@/data/projectData';
import { ComputedProcurementItem } from '@/data/masterData';

interface ExportButtonProps {
  userData: Record<number, UserItemData>;
  concepts: string[];
  categories: string[];
  statuses: string[];
  procurementItems: ComputedProcurementItem[];
}

export default function ExportButton({ userData, concepts, categories, statuses, procurementItems }: ExportButtonProps) {
  const handleExport = () => {
    let items = [...procurementItems];

    if (concepts.length > 0) {
      items = items.filter(i => {
        return concepts.some(c => {
          if (c.includes('A')) return i.qtyA > 0;
          if (c.includes('B')) return i.qtyB > 0;
          if (c.includes('C')) return i.qtyC > 0;
          return false;
        });
      });
    }
    if (categories.length > 0) items = items.filter(i => categories.includes(i.category));
    if (statuses.length > 0) {
      items = items.filter(i => {
        const ud = getUserItemData(userData, i.id);
        return statuses.some(s => {
          if (s === 'No Status') return !ud.status;
          return ud.status === s;
        });
      });
    }

    const headers = ['Item', 'Category', 'Qty A (Happiness)', 'Qty B (Wellness)', 'Qty C (Boutique)', 'Grand Total', 'Supplier', 'Unit Price (€)', 'Total Cost (€)', 'Status', 'Notes'];
    const rows = items.map((item) => {
      const ud = getUserItemData(userData, item.id);
      const totalCost = ud.unitPrice ? item.grandTotal * ud.unitPrice : '';
      return [item.name, item.category, item.qtyA, item.qtyB, item.qtyC, item.grandTotal, ud.supplier, ud.unitPrice ?? '', totalCost, ud.status, ud.notes];
    });

    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cyprus-valley-procurement-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors shrink-0"
    >
      <Download className="h-4 w-4" />
      Export CSV
    </button>
  );
}
