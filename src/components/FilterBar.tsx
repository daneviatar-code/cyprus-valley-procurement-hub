import { Search, X } from 'lucide-react';
import MultiSelect from './MultiSelect';

export type ViewMode = 'byItem' | 'byRoomType';

interface FilterBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  concepts: string[];
  onConceptsChange: (v: string[]) => void;
  categories: string[];
  onCategoriesChange: (v: string[]) => void;
  statuses: string[];
  onStatusesChange: (v: string[]) => void;
  unitCodes: string[];
  onUnitCodesChange: (v: string[]) => void;
  availableUnitCodes: string[];
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
  onClearAll: () => void;
  hasActiveFilters: boolean;
}

const conceptOptions = ['HAPPINESS (A)', 'WELLNESS (B)', 'BOUTIQUE (C)'];
const categoryOptions = ['Dining', 'Living Room', 'Bedroom', 'Outdoor'];
const statusOptions = ['Pending', 'Ordered', 'Delivered', 'Issue', 'No Status'];

const conceptColors: Record<string, string> = {
  'HAPPINESS (A)': 'bg-happiness/15 text-happiness',
  'WELLNESS (B)': 'bg-wellness/15 text-wellness',
  'BOUTIQUE (C)': 'bg-boutique/15 text-boutique',
};

export default function FilterBar(props: FilterBarProps) {
  return (
    <div className="space-y-3 w-full">
      {/* Top row: View mode toggle + search */}
      <div className="flex flex-wrap items-center gap-3">
        {/* View mode toggle */}
        <div className="flex items-center bg-muted rounded-lg p-0.5">
          <button
            onClick={() => props.onViewModeChange('byItem')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              props.viewMode === 'byItem'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            📦 By Item
          </button>
          <button
            onClick={() => props.onViewModeChange('byRoomType')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              props.viewMode === 'byRoomType'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            🛏 By Room Type
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search items..."
            value={props.search}
            onChange={(e) => props.onSearchChange(e.target.value)}
            className="w-full h-9 rounded-md border bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelect
          label="Concept"
          options={conceptOptions}
          selected={props.concepts}
          onChange={props.onConceptsChange}
          placeholder="All Concepts"
          colorMap={conceptColors}
        />

        <MultiSelect
          label="Category"
          options={categoryOptions}
          selected={props.categories}
          onChange={props.onCategoriesChange}
          placeholder="All Categories"
        />

        <MultiSelect
          label="Status"
          options={statusOptions}
          selected={props.statuses}
          onChange={props.onStatusesChange}
          placeholder="All Statuses"
        />

        {props.availableUnitCodes.length > 0 && (
          <MultiSelect
            label="Unit Code"
            options={props.availableUnitCodes}
            selected={props.unitCodes}
            onChange={props.onUnitCodesChange}
            placeholder="All Units"
          />
        )}

        {props.hasActiveFilters && (
          <button
            onClick={props.onClearAll}
            className="inline-flex items-center gap-1 h-9 px-3 rounded-md text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <X className="h-3 w-3" />
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
