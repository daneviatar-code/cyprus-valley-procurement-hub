import { useState, useMemo } from 'react';
import {
  procurementItems,
  categoryEmojis,
  UserItemData,
  Status,
  getUserItemData,
} from '@/data/projectData';
import StatusBadge from './StatusBadge';
import FilterBar from './FilterBar';
import ExportButton from './ExportButton';
import ItemDetailPanel from './ItemDetailPanel';

interface ProcurementTableProps {
  userData: Record<number, UserItemData>;
  onUpdateItem: (id: number, data: UserItemData) => void;
}

export default function ProcurementTable({ userData, onUpdateItem }: ProcurementTableProps) {
  const [search, setSearch] = useState('');
  const [concept, setConcept] = useState('All');
  const [category, setCategory] = useState('All');
  const [status, setStatus] = useState('All');
  const [selectedItem, setSelectedItem] = useState<number | null>(null);

  const filteredItems = useMemo(() => {
    return procurementItems.filter((item) => {
      if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (category !== 'All' && item.category !== category) return false;
      if (concept !== 'All') {
        if (concept.includes('A') && item.qtyA === 0) return false;
        if (concept.includes('B') && item.qtyB === 0) return false;
        if (concept.includes('C') && item.qtyC === 0) return false;
      }
      if (status !== 'All') {
        const ud = getUserItemData(userData, item.id);
        if (status === 'No Status' && ud.status) return false;
        if (status !== 'No Status' && ud.status !== status) return false;
      }
      return true;
    });
  }, [search, concept, category, status, userData]);

  const handleInlineChange = (id: number, field: keyof UserItemData, value: string | number | null) => {
    const current = getUserItemData(userData, id);
    onUpdateItem(id, { ...current, [field]: value });
  };

  const selected = selectedItem !== null ? procurementItems.find((i) => i.id === selectedItem) : null;

  const thClass = 'px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-left whitespace-nowrap';
  const tdClass = 'px-3 py-2.5 text-sm';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterBar
          search={search} onSearchChange={setSearch}
          concept={concept} onConceptChange={setConcept}
          category={category} onCategoryChange={setCategory}
          status={status} onStatusChange={setStatus}
        />
        <ExportButton userData={userData} concept={concept} category={category} status={status} />
      </div>

      <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left table-striped">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className={thClass}>#</th>
                <th className={thClass}>Item Name</th>
                <th className={thClass}>Category</th>
                <th className={`${thClass} text-center`}>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-happiness" />A
                  </span>
                </th>
                <th className={`${thClass} text-center`}>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-wellness" />B
                  </span>
                </th>
                <th className={`${thClass} text-center`}>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-boutique" />C
                  </span>
                </th>
                <th className={`${thClass} text-center`}>Total</th>
                <th className={thClass}>Supplier</th>
                <th className={thClass}>Price (€)</th>
                <th className={thClass}>Cost (€)</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, idx) => {
                const ud = getUserItemData(userData, item.id);
                const totalCost = ud.unitPrice ? item.grandTotal * ud.unitPrice : null;
                return (
                  <tr
                    key={item.id}
                    className="border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedItem(item.id)}
                  >
                    <td className={`${tdClass} text-muted-foreground text-xs`}>{idx + 1}</td>
                    <td className={`${tdClass} font-medium text-foreground whitespace-nowrap`}>{item.name}</td>
                    <td className={`${tdClass} text-muted-foreground whitespace-nowrap`}>
                      <span className="mr-1">{categoryEmojis[item.category]}</span>
                      {item.category}
                    </td>
                    <td className={`${tdClass} text-center font-mono text-sm`}>{item.qtyA || '—'}</td>
                    <td className={`${tdClass} text-center font-mono text-sm`}>{item.qtyB || '—'}</td>
                    <td className={`${tdClass} text-center font-mono text-sm`}>{item.qtyC || '—'}</td>
                    <td className={`${tdClass} text-center font-mono text-sm font-bold text-accent`}>
                      {item.grandTotal.toLocaleString()}
                    </td>
                    <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                      <input
                        className="h-7 w-28 rounded border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent/50"
                        value={ud.supplier}
                        onChange={(e) => handleInlineChange(item.id, 'supplier', e.target.value)}
                        placeholder="—"
                      />
                    </td>
                    <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="number"
                        className="h-7 w-20 rounded border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent/50"
                        value={ud.unitPrice ?? ''}
                        onChange={(e) => handleInlineChange(item.id, 'unitPrice', e.target.value ? Number(e.target.value) : null)}
                        placeholder="—"
                      />
                    </td>
                    <td className={`${tdClass} font-mono text-xs whitespace-nowrap`}>
                      {totalCost ? `€${totalCost.toLocaleString()}` : '—'}
                    </td>
                    <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                      <select
                        className="h-7 rounded border bg-background px-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent/50"
                        value={ud.status}
                        onChange={(e) => handleInlineChange(item.id, 'status', e.target.value)}
                      >
                        <option value="">—</option>
                        <option value="Pending">Pending</option>
                        <option value="Ordered">Ordered</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Issue">Issue</option>
                      </select>
                    </td>
                    <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                      <input
                        className="h-7 w-28 rounded border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent/50"
                        value={ud.notes}
                        onChange={(e) => handleInlineChange(item.id, 'notes', e.target.value)}
                        placeholder="—"
                      />
                    </td>
                  </tr>
                );
              })}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-3 py-12 text-center text-muted-foreground">
                    No items match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary row */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>Showing {filteredItems.length} of {procurementItems.length} items</span>
        <span>
          Grand Total: <strong className="text-accent">{filteredItems.reduce((s, i) => s + i.grandTotal, 0).toLocaleString()}</strong> items
        </span>
      </div>

      {/* Detail panel */}
      {selected && (
        <ItemDetailPanel
          item={selected}
          userData={getUserItemData(userData, selected.id)}
          onSave={onUpdateItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
