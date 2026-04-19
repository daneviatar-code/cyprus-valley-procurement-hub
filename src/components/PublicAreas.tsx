/**
 * Public Areas — top-level tab for FF&E of common / shared spaces
 * (Lobby, Restaurant, Spa, Pool, Meeting Rooms, BOH, Gym, Rooftop).
 *
 * Reads from the same masterData store as Procurement (filtering for zone
 * unitCodes) and from the same selections store, so any edit to suppliers,
 * prices, or quantities propagates everywhere automatically.
 */

import { useMemo, useState } from 'react';
import { Download, Search, X } from 'lucide-react';
import {
  MasterRow,
  computePublicAreaItems,
  ALL_BUILDING_LIST,
} from '@/data/masterData';
import { loadAllSelections } from '@/data/selectionData';
import { categoryEmojis, UserItemData, getUserItemData } from '@/data/projectData';
import MultiSelect from './MultiSelect';

const ZONE_LABELS: Record<string, string> = {
  LOBBY: 'Lobby',
  RESTAURANT: 'Restaurant & F&B',
  SPA: 'Spa & Wellness',
  POOL: 'Pool Area',
  MEETING: 'Meeting Rooms',
  BOH: 'Back of House',
  GYM: 'Gym & Fitness',
  ROOFTOP: 'Rooftop & Terrace',
};

interface PublicAreasProps {
  masterData: MasterRow[];
  userData: Record<number, UserItemData>;
  onUpdateItem: (id: number, data: UserItemData) => void;
}

export default function PublicAreas({ masterData, userData, onUpdateItem }: PublicAreasProps) {
  const allSelections = useMemo(() => loadAllSelections(), [masterData]);
  const allItems = useMemo(() => computePublicAreaItems(masterData), [masterData]);

  const [search, setSearch] = useState('');
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  const allZones = useMemo(() => {
    const set = new Set(allItems.map(i => i.zone));
    return Array.from(set).sort();
  }, [allItems]);

  const allCategories = useMemo(() => {
    const set = new Set(allItems.map(i => i.category));
    return Array.from(set).sort();
  }, [allItems]);

  // Aggregate identical (itemName, zone) across buildings — supplier-style rollup
  const aggregated = useMemo(() => {
    const map = new Map<string, {
      name: string;
      category: string;
      zone: string;
      qtyByBuilding: Record<string, number>;
      totalQty: number;
      // synthetic id stable per (name+zone) for userData lookup
      id: number;
    }>();
    let id = 1_000_000; // separate id-space from procurement
    allItems.forEach(it => {
      const key = `${it.zone}::${it.name}`;
      let entry = map.get(key);
      if (!entry) {
        entry = { name: it.name, category: it.category, zone: it.zone, qtyByBuilding: {}, totalQty: 0, id: id++ };
        // deterministic id from string hash so it's stable across renders
        let h = 0;
        for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
        entry.id = 2_000_000 + Math.abs(h);
        map.set(key, entry);
      }
      entry.qtyByBuilding[it.building] = (entry.qtyByBuilding[it.building] || 0) + it.qty;
      entry.totalQty += it.qty;
    });
    return Array.from(map.values()).sort((a, b) => {
      if (a.zone !== b.zone) return a.zone.localeCompare(b.zone);
      return a.name.localeCompare(b.name);
    });
  }, [allItems]);

  const filtered = useMemo(() => {
    return aggregated.filter(r => {
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (selectedZones.length > 0 && !selectedZones.includes(r.zone)) return false;
      if (selectedCategories.length > 0 && !selectedCategories.includes(r.category)) return false;
      if (selectedBuildings.length > 0) {
        const hasBuilding = selectedBuildings.some(b => (r.qtyByBuilding[b] || 0) > 0);
        if (!hasBuilding) return false;
      }
      if (selectedStatuses.length > 0) {
        const ud = getUserItemData(userData, r.id);
        const ok = selectedStatuses.some(s => s === 'No Status' ? !ud.status : ud.status === s);
        if (!ok) return false;
      }
      return true;
    });
  }, [aggregated, search, selectedZones, selectedCategories, selectedBuildings, selectedStatuses, userData]);

  const handleInlineChange = (id: number, field: keyof UserItemData, value: string | number | null) => {
    const current = getUserItemData(userData, id);
    onUpdateItem(id, { ...current, [field]: value });
  };

  const exportCSV = () => {
    const headers = ['Zone', 'Item', 'Category', ...ALL_BUILDING_LIST.map(b => `Qty ${b}`), 'Total Qty', 'Supplier', 'Unit Price (€)', 'Total Cost (€)', 'Status', 'Notes'];
    const rows = filtered.map(r => {
      const ud = getUserItemData(userData, r.id);
      const sel = allSelections[r.name];
      const supplier = ud.supplier || sel?.supplier || '';
      const price = ud.unitPrice ?? sel?.unitPrice ?? '';
      const totalCost = price ? r.totalQty * Number(price) : '';
      return [
        ZONE_LABELS[r.zone] || r.zone,
        r.name,
        r.category,
        ...ALL_BUILDING_LIST.map(b => r.qtyByBuilding[b] || 0),
        r.totalQty,
        supplier,
        price,
        totalCost,
        ud.status,
        ud.notes,
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cyprus-valley-public-areas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearAll = () => {
    setSearch('');
    setSelectedBuildings([]);
    setSelectedZones([]);
    setSelectedCategories([]);
    setSelectedStatuses([]);
  };

  const hasActiveFilters = !!search || selectedBuildings.length > 0 || selectedZones.length > 0 || selectedCategories.length > 0 || selectedStatuses.length > 0;

  // Per-zone summary stats
  const zoneSummary = useMemo(() => {
    const map = new Map<string, { items: number; qty: number }>();
    aggregated.forEach(r => {
      const cur = map.get(r.zone) || { items: 0, qty: 0 };
      cur.items += 1;
      cur.qty += r.totalQty;
      map.set(r.zone, cur);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [aggregated]);

  const thClass = 'px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-left whitespace-nowrap';
  const tdClass = 'px-3 py-2.5 text-sm';

  // Empty state
  if (allItems.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-foreground">Public Areas</h2>
          <span className="text-xs text-muted-foreground">FF&E for shared spaces (lobby, restaurant, gym, spa, pool, etc.)</span>
        </div>
        <div className="bg-card border rounded-lg p-12 text-center">
          <div className="text-4xl mb-2">🏛</div>
          <h3 className="text-base font-semibold text-foreground mb-1">No Public Area items yet</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            Add furniture and equipment for common areas in <strong>Project Data</strong> by setting the Unit Code to a zone (LOBBY, SPA, POOL, GYM, etc.).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-foreground">Public Areas</h2>
        <span className="text-xs text-muted-foreground">FF&E for shared spaces — synced with the master procurement store</span>
      </div>

      {/* Per-zone summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {zoneSummary.map(([zone, s]) => (
          <button
            key={zone}
            onClick={() => setSelectedZones(selectedZones.includes(zone) ? selectedZones.filter(z => z !== zone) : [...selectedZones, zone])}
            className={`text-left rounded-lg border p-3 transition-all hover:shadow-sm ${
              selectedZones.includes(zone) ? 'bg-accent/10 border-accent' : 'bg-card'
            }`}
          >
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              {ZONE_LABELS[zone] || zone}
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold text-foreground">{s.items}</span>
              <span className="text-[10px] text-muted-foreground">items · {s.qty.toLocaleString()} qty</span>
            </div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search items..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-9 rounded-md border bg-card pl-9 pr-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>
          <MultiSelect label="Building" options={ALL_BUILDING_LIST} selected={selectedBuildings} onChange={setSelectedBuildings} placeholder="All Buildings" />
          <MultiSelect label="Zone" options={allZones} selected={selectedZones} onChange={setSelectedZones} placeholder="All Zones" />
          <MultiSelect label="Category" options={allCategories} selected={selectedCategories} onChange={setSelectedCategories} placeholder="All Categories" />
          <MultiSelect label="Status" options={['Pending', 'Ordered', 'Delivered', 'Issue', 'No Status']} selected={selectedStatuses} onChange={setSelectedStatuses} placeholder="All Statuses" />
          {hasActiveFilters && (
            <button onClick={clearAll} className="inline-flex items-center gap-1 h-9 px-3 rounded-md text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors">
              <X className="h-3 w-3" /> Clear all
            </button>
          )}
        </div>
        <button
          onClick={exportCSV}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors shrink-0"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left table-striped">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className={thClass}>#</th>
                <th className={thClass}>Zone</th>
                <th className={thClass}>Item Name</th>
                <th className={thClass}>Category</th>
                <th className={`${thClass} text-center`}>Total Qty</th>
                <th className={thClass}>Supplier</th>
                <th className={thClass}>Price (€)</th>
                <th className={thClass}>Cost (€)</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, idx) => {
                const ud = getUserItemData(userData, row.id);
                const sel = allSelections[row.name];
                const effectiveSupplier = ud.supplier || sel?.supplier || '';
                const effectivePrice = ud.unitPrice ?? sel?.unitPrice ?? null;
                const totalCost = effectivePrice ? row.totalQty * effectivePrice : null;
                return (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className={`${tdClass} text-muted-foreground text-xs`}>{idx + 1}</td>
                    <td className={`${tdClass} text-foreground whitespace-nowrap`}>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-accent/10 text-accent text-[11px] font-semibold">
                        {ZONE_LABELS[row.zone] || row.zone}
                      </span>
                    </td>
                    <td className={`${tdClass} font-medium text-foreground whitespace-nowrap`}>{row.name}</td>
                    <td className={`${tdClass} text-muted-foreground whitespace-nowrap`}>
                      <span className="mr-1">{categoryEmojis[row.category as keyof typeof categoryEmojis]}</span>
                      {row.category}
                    </td>
                    <td className={`${tdClass} text-center font-mono text-sm font-bold text-accent`}>
                      {row.totalQty.toLocaleString()}
                    </td>
                    <td className={`${tdClass} text-muted-foreground text-xs whitespace-nowrap`}>
                      {effectiveSupplier || '—'}
                    </td>
                    <td className={`${tdClass} font-mono text-xs whitespace-nowrap`}>
                      {effectivePrice ? `€${effectivePrice.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className={`${tdClass} font-mono text-xs whitespace-nowrap`}>
                      {totalCost ? `€${totalCost.toLocaleString()}` : '—'}
                    </td>
                    <td className={tdClass}>
                      <select
                        className="h-7 rounded border bg-background px-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent/50"
                        value={ud.status}
                        onChange={(e) => handleInlineChange(row.id, 'status', e.target.value)}
                      >
                        <option value="">—</option>
                        <option value="Pending">Pending</option>
                        <option value="Ordered">Ordered</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Issue">Issue</option>
                      </select>
                    </td>
                    <td className={tdClass}>
                      <input
                        className="h-7 w-28 rounded border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent/50"
                        value={ud.notes}
                        onChange={(e) => handleInlineChange(row.id, 'notes', e.target.value)}
                        placeholder="—"
                      />
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-12 text-center text-muted-foreground">
                    No public-area items match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>Showing {filtered.length} of {aggregated.length} public-area items</span>
        <span>
          Total Qty: <strong className="text-accent">{filtered.reduce((s, r) => s + r.totalQty, 0).toLocaleString()}</strong>
        </span>
      </div>
    </div>
  );
}
