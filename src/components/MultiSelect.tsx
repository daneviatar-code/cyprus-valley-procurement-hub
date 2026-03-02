import { useState, useRef, useEffect } from 'react';
import { X, ChevronDown } from 'lucide-react';

interface MultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  colorMap?: Record<string, string>;
}

export default function MultiSelect({ label, options, selected, onChange, placeholder = 'All', colorMap }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter(v => v !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const remove = (val: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter(v => v !== val));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="h-9 min-w-[140px] max-w-[280px] rounded-md border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 flex items-center gap-1.5"
      >
        {selected.length === 0 ? (
          <span className="text-muted-foreground">{placeholder}</span>
        ) : (
          <div className="flex flex-wrap gap-1 flex-1 overflow-hidden">
            {selected.slice(0, 2).map(v => (
              <span
                key={v}
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  colorMap?.[v] || 'bg-accent/15 text-accent'
                }`}
              >
                {v}
                <X className="h-2.5 w-2.5 cursor-pointer hover:opacity-70" onClick={(e) => remove(v, e)} />
              </span>
            ))}
            {selected.length > 2 && (
              <span className="text-[10px] text-muted-foreground">+{selected.length - 2}</span>
            )}
          </div>
        )}
        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0 ml-auto" />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 min-w-[180px] max-h-[240px] overflow-y-auto rounded-md border bg-card shadow-lg py-1">
          {options.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50 flex items-center gap-2 transition-colors ${
                selected.includes(opt) ? 'text-accent font-medium' : 'text-foreground'
              }`}
            >
              <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[9px] ${
                selected.includes(opt) ? 'bg-accent border-accent text-accent-foreground' : 'border-muted-foreground/30'
              }`}>
                {selected.includes(opt) && '✓'}
              </span>
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
