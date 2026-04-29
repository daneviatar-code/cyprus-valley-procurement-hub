import { useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface SpecCellProps {
  value: string;
  onChange: (v: string) => void;
  itemName?: string;
  inputClassName?: string;
  placeholder?: string;
  inline?: boolean; // use bare input style (for PublicAreas compact tables)
  viewOnly?: boolean; // render only the expand button (no input)
}

export default function SpecCell({ value, onChange, itemName, inputClassName, placeholder = 'Spec/model', inline, viewOnly }: SpecCellProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  const handleOpen = () => {
    setDraft(value);
    setOpen(true);
  };

  const handleSave = () => {
    onChange(draft);
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-1 w-full">
      {inline ? (
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-6 rounded border bg-background px-1 text-xs w-28 flex-1 min-w-0"
        />
      ) : (
        <Input
          className={inputClassName}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
      <button
        type="button"
        onClick={handleOpen}
        className="shrink-0 p-1 rounded hover:bg-accent/30 text-muted-foreground hover:text-foreground transition-colors"
        title="View / edit full SPEC"
      >
        <Maximize2 className="w-3 h-3" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>SPEC {itemName ? `— ${itemName}` : ''}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Full specification, model, materials, finishes…"
            className="min-h-[260px] text-sm font-mono whitespace-pre-wrap"
            dir="auto"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
