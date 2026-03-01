import { Search } from 'lucide-react';
import { Category, Status } from '@/data/projectData';

interface FilterBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  concept: string;
  onConceptChange: (v: string) => void;
  category: string;
  onCategoryChange: (v: string) => void;
  status: string;
  onStatusChange: (v: string) => void;
}

const concepts = ['All', 'HAPPINESS (A)', 'WELLNESS (B)', 'BOUTIQUE (C)'];
const categories = ['All', 'Dining', 'Living Room', 'Bedroom', 'Outdoor'];
const statuses = ['All', 'Pending', 'Ordered', 'Delivered', 'Issue', 'No Status'];

export default function FilterBar(props: FilterBarProps) {
  const selectClass =
    'h-9 rounded-md border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50';

  return (
    <div className="flex flex-wrap items-center gap-3">
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

      <select value={props.concept} onChange={(e) => props.onConceptChange(e.target.value)} className={selectClass}>
        {concepts.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      <select value={props.category} onChange={(e) => props.onCategoryChange(e.target.value)} className={selectClass}>
        {categories.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      <select value={props.status} onChange={(e) => props.onStatusChange(e.target.value)} className={selectClass}>
        {statuses.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </div>
  );
}
