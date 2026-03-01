import { Download } from 'lucide-react';
import { procurementItems, UserItemData, getUserItemData } from '@/data/projectData';

interface ExportButtonProps {
  userData: Record<number, UserItemData>;
  concept: string;
  category: string;
  status: string;
}

export default function ExportButton({ userData, concept, category, status }: ExportButtonProps) {
  const handleExport = () => {
    let items = [...procurementItems];

    if (concept !== 'All') {
      if (concept.includes('A')) items = items.filter((i) => i.qtyA > 0);
      if (concept.includes('B')) items = items.filter((i) => i.qtyB > 0);
      if (concept.includes('C')) items = items.filter((i) => i.qtyC > 0);
    }
    if (category !== 'All') items = items.filter((i) => i.category === category);
    if (status !== 'All') {
      items = items.filter((i) => {
        const ud = getUserItemData(userData, i.id);
        if (status === 'No Status') return !ud.status;
        return ud.status === status;
      });
    }

    const headers = ['Item', 'Category', 'Qty A (Happiness)', 'Qty B (Wellness)', 'Qty C (Boutique)', 'Grand Total', 'Supplier', 'Unit Price (€)', 'Total Cost (€)', 'Status', 'Notes'];
    const rows = items.map((item) => {
      const ud = getUserItemData(userData, item.id);
      const totalCost = ud.unitPrice ? item.grandTotal * ud.unitPrice : '';
      return [
        item.name,
        item.category,
        item.qtyA,
        item.qtyB,
        item.qtyC,
        item.grandTotal,
        ud.supplier,
        ud.unitPrice ?? '',
        totalCost,
        ud.status,
        ud.notes,
      ];
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
      className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
    >
      <Download className="h-4 w-4" />
      Export CSV
    </button>
  );
}
