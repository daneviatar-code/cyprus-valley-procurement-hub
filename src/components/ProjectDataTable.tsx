import { useState, useMemo } from 'react';
import { Plus, Trash2, Search, ChevronDown, ChevronRight } from 'lucide-react';
import {
  MasterRow,
  Concept,
  RoomType,
  generateRowId,
} from '@/data/masterData';
import { buildingAUnits, buildingBUnits, buildingCUnits } from '@/data/unitFurnitureData';

type GroupBy = 'none' | 'concept' | 'unitCode' | 'roomType';

interface ProjectDataTableProps {
  masterData: MasterRow[];
  onUpdate: (data: MasterRow[]) => void;
}

const conceptLabels: Record<Concept, string> = { A: 'HAPPINESS (A)', B: 'WELLNESS (B)', C: 'BOUTIQUE (C)' };
const conceptColors: Record<Concept, string> = { A: 'bg-happiness', B: 'bg-wellness', C: 'bg-boutique' };
const roomTypes: RoomType[] = ['Dining', 'Living Room', 'Bedroom', 'Outdoor'];

function getUnitCodesForConcept(concept: Concept): string[] {
  const units = concept === 'A' ? buildingAUnits : concept === 'B' ? buildingBUnits : buildingCUnits;
  return units.map(u => u.code);
}

export default function ProjectDataTable({ masterData, onUpdate }: ProjectDataTableProps) {
  const [search, setSearch] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('concept');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [filterConcept, setFilterConcept] = useState<Concept | ''>('');
  const [filterRoomType, setFilterRoomType] = useState<RoomType | ''>('');

  const filtered = useMemo(() => {
    return masterData.filter(row => {
      if (search && !row.itemName.toLowerCase().includes(search.toLowerCase()) && !row.unitCode.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterConcept && row.concept !== filterConcept) return false;
      if (filterRoomType && row.roomType !== filterRoomType) return false;
      return true;
    });
  }, [masterData, search, filterConcept, filterRoomType]);

  const grouped = useMemo(() => {
    if (groupBy === 'none') return { '': filtered };
    const groups: Record<string, MasterRow[]> = {};
    filtered.forEach(row => {
      const key = groupBy === 'concept' ? conceptLabels[row.concept]
        : groupBy === 'unitCode' ? `${conceptLabels[row.concept]} › ${row.unitCode}`
        : row.roomType;
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    });
    return groups;
  }, [filtered, groupBy]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const updateRow = (id: string, field: keyof MasterRow, value: string | number) => {
    const next = masterData.map(r =>
      r.id === id ? { ...r, [field]: field === 'qtyPerUnit' ? Math.max(0, Number(value) || 0) : value } : r
    );
    onUpdate(next);
  };

  const deleteRow = (id: string) => {
    onUpdate(masterData.filter(r => r.id !== id));
  };

  const addRow = () => {
    const concept: Concept = (filterConcept as Concept) || 'A';
    const unitCodes = getUnitCodesForConcept(concept);
    const newRow: MasterRow = {
      id: generateRowId(),
      concept,
      unitCode: unitCodes[0] || 'AT',
      roomType: (filterRoomType as RoomType) || 'Living Room',
      itemName: 'New Item',
      qtyPerUnit: 1,
    };
    onUpdate([...masterData, newRow]);
  };

  const thClass = 'px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-left whitespace-nowrap';
  const tdClass = 'px-3 py-1.5';
  const inputClass = 'h-7 w-full rounded border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent/50';
  const selectClass = 'h-7 w-full rounded border bg-background px-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent/50';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">Project Data</h2>
        <p className="text-sm text-muted-foreground">Master table — all quantities flow from here</p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search items or unit codes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-9 rounded-md border bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>

        <select
          value={filterConcept}
          onChange={e => setFilterConcept(e.target.value as Concept | '')}
          className="h-9 rounded-md border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          <option value="">All Concepts</option>
          <option value="A">HAPPINESS (A)</option>
          <option value="B">WELLNESS (B)</option>
          <option value="C">BOUTIQUE (C)</option>
        </select>

        <select
          value={filterRoomType}
          onChange={e => setFilterRoomType(e.target.value as RoomType | '')}
          className="h-9 rounded-md border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          <option value="">All Room Types</option>
          {roomTypes.map(rt => <option key={rt} value={rt}>{rt}</option>)}
        </select>

        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          <span className="text-[10px] font-medium text-muted-foreground px-2">Group:</span>
          {(['none', 'concept', 'unitCode', 'roomType'] as const).map(g => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                groupBy === g ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {g === 'none' ? 'None' : g === 'concept' ? 'Concept' : g === 'unitCode' ? 'Unit Code' : 'Room Type'}
            </button>
          ))}
        </div>

        <button
          onClick={addRow}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Row
        </button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>{filtered.length} of {masterData.length} rows</span>
        <span>·</span>
        <span>{new Set(filtered.map(r => r.itemName)).size} unique items</span>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10">
              <tr className="border-b bg-muted/80 backdrop-blur">
                <th className={thClass} style={{ width: 40 }}></th>
                <th className={thClass}>Concept</th>
                <th className={thClass}>Unit Code</th>
                <th className={thClass}>Room Type</th>
                <th className={thClass}>Item Name</th>
                <th className={thClass} style={{ width: 90 }}>Qty/Unit</th>
                <th className={thClass} style={{ width: 50 }}></th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([groupKey, rows]) => (
                <GroupSection
                  key={groupKey}
                  groupKey={groupKey}
                  rows={rows}
                  collapsed={collapsedGroups.has(groupKey)}
                  onToggle={() => toggleGroup(groupKey)}
                  showGroupHeader={groupBy !== 'none'}
                  tdClass={tdClass}
                  inputClass={inputClass}
                  selectClass={selectClass}
                  onUpdateRow={updateRow}
                  onDeleteRow={deleteRow}
                />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-12 text-center text-muted-foreground">
                    No rows match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Group section sub-component ──
interface GroupSectionProps {
  groupKey: string;
  rows: MasterRow[];
  collapsed: boolean;
  onToggle: () => void;
  showGroupHeader: boolean;
  tdClass: string;
  inputClass: string;
  selectClass: string;
  onUpdateRow: (id: string, field: keyof MasterRow, value: string | number) => void;
  onDeleteRow: (id: string) => void;
}

function GroupSection({ groupKey, rows, collapsed, onToggle, showGroupHeader, tdClass, inputClass, selectClass, onUpdateRow, onDeleteRow }: GroupSectionProps) {
  return (
    <>
      {showGroupHeader && (
        <tr
          className="bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors"
          onClick={onToggle}
        >
          <td colSpan={7} className="px-3 py-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {groupKey}
              <span className="text-xs font-normal text-muted-foreground">({rows.length} rows)</span>
            </div>
          </td>
        </tr>
      )}
      {!collapsed && rows.map(row => (
        <EditableRow
          key={row.id}
          row={row}
          tdClass={tdClass}
          inputClass={inputClass}
          selectClass={selectClass}
          onUpdate={onUpdateRow}
          onDelete={onDeleteRow}
        />
      ))}
    </>
  );
}

// ── Editable row sub-component ──
interface EditableRowProps {
  row: MasterRow;
  tdClass: string;
  inputClass: string;
  selectClass: string;
  onUpdate: (id: string, field: keyof MasterRow, value: string | number) => void;
  onDelete: (id: string) => void;
}

function EditableRow({ row, tdClass, inputClass, selectClass, onUpdate, onDelete }: EditableRowProps) {
  const unitCodes = getUnitCodesForConcept(row.concept);
  const conceptDot = row.concept === 'A' ? 'bg-happiness' : row.concept === 'B' ? 'bg-wellness' : 'bg-boutique';

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors">
      <td className={tdClass}>
        <span className={`inline-block w-2 h-2 rounded-full ${conceptDot}`} />
      </td>
      <td className={tdClass}>
        <select
          className={selectClass}
          value={row.concept}
          onChange={e => onUpdate(row.id, 'concept', e.target.value)}
        >
          <option value="A">A — HAPPINESS</option>
          <option value="B">B — WELLNESS</option>
          <option value="C">C — BOUTIQUE</option>
        </select>
      </td>
      <td className={tdClass}>
        <select
          className={selectClass}
          value={row.unitCode}
          onChange={e => onUpdate(row.id, 'unitCode', e.target.value)}
        >
          {unitCodes.map(c => <option key={c} value={c}>{c}</option>)}
          {!unitCodes.includes(row.unitCode) && (
            <option value={row.unitCode}>{row.unitCode}</option>
          )}
        </select>
      </td>
      <td className={tdClass}>
        <select
          className={selectClass}
          value={row.roomType}
          onChange={e => onUpdate(row.id, 'roomType', e.target.value)}
        >
          {roomTypes.map(rt => <option key={rt} value={rt}>{rt}</option>)}
        </select>
      </td>
      <td className={tdClass}>
        <input
          className={inputClass}
          value={row.itemName}
          onChange={e => onUpdate(row.id, 'itemName', e.target.value)}
        />
      </td>
      <td className={tdClass}>
        <input
          type="number"
          min={0}
          className={`${inputClass} text-center font-mono`}
          value={row.qtyPerUnit}
          onChange={e => onUpdate(row.id, 'qtyPerUnit', e.target.value)}
        />
      </td>
      <td className={tdClass}>
        <button
          onClick={() => onDelete(row.id)}
          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          title="Delete row"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}
