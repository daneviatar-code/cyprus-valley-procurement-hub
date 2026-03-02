import { useState, useMemo } from 'react';
import {
  procurementItems,
  categoryEmojis,
  UserItemData,
  Status,
  getUserItemData,
} from '@/data/projectData';
import {
  getBuildingData,
  buildingAUnits,
  buildingBUnits,
  buildingCUnits,
  buildingAFurniture,
  buildingBFurniture,
  buildingCFurniture,
  FurniturePerUnit,
  UnitType,
} from '@/data/unitFurnitureData';
import StatusBadge from './StatusBadge';
import FilterBar, { ViewMode } from './FilterBar';
import ExportButton from './ExportButton';
import ItemDetailPanel from './ItemDetailPanel';

interface ProcurementTableProps {
  userData: Record<number, UserItemData>;
  onUpdateItem: (id: number, data: UserItemData) => void;
}

// Extract concept letter from filter string
function getConceptId(concept: string): 'A' | 'B' | 'C' | null {
  if (concept.includes('A')) return 'A';
  if (concept.includes('B')) return 'B';
  if (concept.includes('C')) return 'C';
  return null;
}

export default function ProcurementTable({ userData, onUpdateItem }: ProcurementTableProps) {
  const [search, setSearch] = useState('');
  const [selectedConcepts, setSelectedConcepts] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedUnitCodes, setSelectedUnitCodes] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('byItem');
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [roomTypeConceptOverride, setRoomTypeConceptOverride] = useState<'A' | 'B' | 'C'>('A');

  // Available unit codes based on selected concepts
  const availableUnitCodes = useMemo(() => {
    const conceptIds = selectedConcepts.map(c => getConceptId(c)).filter(Boolean) as ('A' | 'B' | 'C')[];
    if (conceptIds.length === 0) return [] as string[];
    const codes: string[] = [];
    conceptIds.forEach(id => {
      const { units } = getBuildingData(id);
      units.forEach(u => {
        if (!codes.includes(u.code)) codes.push(u.code);
      });
    });
    return codes.sort();
  }, [selectedConcepts]);

  // For "By Room Type" mode, determine which concept to show
  const roomTypeConcept = useMemo((): 'A' | 'B' | 'C' => {
    if (selectedConcepts.length === 1) {
      return getConceptId(selectedConcepts[0]) || roomTypeConceptOverride;
    }
    return roomTypeConceptOverride;
  }, [selectedConcepts, roomTypeConceptOverride]);

  // Get unit codes for the room type view
  const roomTypeUnits = useMemo(() => {
    const { units } = getBuildingData(roomTypeConcept);
    return units;
  }, [roomTypeConcept]);

  const roomTypeFurniture = useMemo(() => {
    const { furniture } = getBuildingData(roomTypeConcept);
    return furniture;
  }, [roomTypeConcept]);

  const filteredItems = useMemo(() => {
    return procurementItems.filter((item) => {
      if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (selectedCategories.length > 0 && !selectedCategories.includes(item.category)) return false;

      // Concept filter: OR within concepts
      if (selectedConcepts.length > 0) {
        const matchesConcept = selectedConcepts.some(c => {
          const id = getConceptId(c);
          if (id === 'A') return item.qtyA > 0;
          if (id === 'B') return item.qtyB > 0;
          if (id === 'C') return item.qtyC > 0;
          return false;
        });
        if (!matchesConcept) return false;
      }

      // Unit code filter
      if (selectedUnitCodes.length > 0) {
        const conceptIds = selectedConcepts.length > 0
          ? selectedConcepts.map(c => getConceptId(c)).filter(Boolean) as ('A' | 'B' | 'C')[]
          : ['A', 'B', 'C'] as const;

        const matchesUnit = conceptIds.some(id => {
          const { furniture } = getBuildingData(id);
          const fItem = furniture.find(f => f.itemName === item.name);
          if (!fItem) return false;
          return selectedUnitCodes.some(code => (fItem.quantities[code] || 0) > 0);
        });
        if (!matchesUnit) return false;
      }

      // Status filter
      if (selectedStatuses.length > 0) {
        const ud = getUserItemData(userData, item.id);
        const matchesStatus = selectedStatuses.some(s => {
          if (s === 'No Status') return !ud.status;
          return ud.status === s;
        });
        if (!matchesStatus) return false;
      }

      return true;
    });
  }, [search, selectedConcepts, selectedCategories, selectedStatuses, selectedUnitCodes, userData]);

  const handleInlineChange = (id: number, field: keyof UserItemData, value: string | number | null) => {
    const current = getUserItemData(userData, id);
    onUpdateItem(id, { ...current, [field]: value });
  };

  const clearAll = () => {
    setSearch('');
    setSelectedConcepts([]);
    setSelectedCategories([]);
    setSelectedStatuses([]);
    setSelectedUnitCodes([]);
  };

  const hasActiveFilters = search !== '' || selectedConcepts.length > 0 || selectedCategories.length > 0 || selectedStatuses.length > 0 || selectedUnitCodes.length > 0;

  const selected = selectedItem !== null ? procurementItems.find((i) => i.id === selectedItem) : null;

  const thClass = 'px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-left whitespace-nowrap';
  const tdClass = 'px-3 py-2.5 text-sm';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <FilterBar
          search={search} onSearchChange={setSearch}
          concepts={selectedConcepts} onConceptsChange={setSelectedConcepts}
          categories={selectedCategories} onCategoriesChange={setSelectedCategories}
          statuses={selectedStatuses} onStatusesChange={setSelectedStatuses}
          unitCodes={selectedUnitCodes} onUnitCodesChange={setSelectedUnitCodes}
          availableUnitCodes={availableUnitCodes}
          viewMode={viewMode} onViewModeChange={setViewMode}
          onClearAll={clearAll}
          hasActiveFilters={hasActiveFilters}
        />
        <ExportButton userData={userData} concepts={selectedConcepts} categories={selectedCategories} statuses={selectedStatuses} />
      </div>

      {/* Room Type concept selector (when in byRoomType mode and multiple/no concepts selected) */}
      {viewMode === 'byRoomType' && selectedConcepts.length !== 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Show unit columns for:</span>
          {(['A', 'B', 'C'] as const).map(id => (
            <button
              key={id}
              onClick={() => setRoomTypeConceptOverride(id)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                roomTypeConcept === id
                  ? `bg-${id === 'A' ? 'happiness' : id === 'B' ? 'wellness' : 'boutique'} text-primary-foreground`
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {id === 'A' ? 'HAPPINESS (A)' : id === 'B' ? 'WELLNESS (B)' : 'BOUTIQUE (C)'}
            </button>
          ))}
        </div>
      )}

      <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left table-striped">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className={thClass}>#</th>
                <th className={thClass}>Item Name</th>
                <th className={thClass}>Category</th>

                {viewMode === 'byItem' ? (
                  <>
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
                  </>
                ) : (
                  <>
                    {roomTypeUnits.map(u => (
                      <th key={u.code} className={`${thClass} text-center`}>
                        <div className="text-[9px]">{u.code}</div>
                        <div className="text-[8px] text-muted-foreground/60">{u.description.slice(0, 4)}</div>
                      </th>
                    ))}
                    <th className={`${thClass} text-center`}>Bldg Total</th>
                  </>
                )}

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

                // For room type view, find the furniture data for this item
                const roomTypeFItem = viewMode === 'byRoomType'
                  ? roomTypeFurniture.find(f => f.itemName === item.name)
                  : null;

                // Calculate building total for room type view
                const buildingTotal = roomTypeFItem
                  ? roomTypeUnits.reduce((sum, u) => {
                      const perUnit = roomTypeFItem.quantities[u.code] || 0;
                      let instances = 0;
                      u.floors.forEach(f => { instances += u.unitsPerFloor[f] || 0; });
                      return sum + perUnit * instances;
                    }, 0)
                  : 0;

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

                    {viewMode === 'byItem' ? (
                      <>
                        <td className={`${tdClass} text-center font-mono text-sm`}>{item.qtyA || '—'}</td>
                        <td className={`${tdClass} text-center font-mono text-sm`}>{item.qtyB || '—'}</td>
                        <td className={`${tdClass} text-center font-mono text-sm`}>{item.qtyC || '—'}</td>
                        <td className={`${tdClass} text-center font-mono text-sm font-bold text-accent`}>
                          {item.grandTotal.toLocaleString()}
                        </td>
                      </>
                    ) : (
                      <>
                        {roomTypeUnits.map(u => {
                          const qty = roomTypeFItem?.quantities[u.code] || 0;
                          return (
                            <td key={u.code} className={`${tdClass} text-center font-mono text-xs`}>
                              {qty || '—'}
                            </td>
                          );
                        })}
                        <td className={`${tdClass} text-center font-mono text-sm font-bold text-accent`}>
                          {buildingTotal || '—'}
                        </td>
                      </>
                    )}

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
                  <td colSpan={viewMode === 'byItem' ? 12 : roomTypeUnits.length + 9} className="px-3 py-12 text-center text-muted-foreground">
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
