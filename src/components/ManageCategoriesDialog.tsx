import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Category, UNCATEGORIZED_ID,
  loadCategoriesShared, saveCategoriesShared,
  subscribeCategories, genCategoryIdShared,
} from '@/data/categoriesData';
import { loadSuppliers, saveSuppliers } from '@/data/supplierData';
import { loadCatalog, saveCatalog } from '@/data/catalogData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

async function countUsage(cat: Category): Promise<{ suppliers: number; catalog: number; standard: number; total: number }> {
  const suppliers = loadSuppliers().filter(s => s.category === cat.nameEn).length;
  const catalog = loadCatalog().filter(p => p.discipline === cat.nameEn).length;
  let standard = 0;
  try {
    const { count } = await supabase.from('standard_items').select('id', { count: 'exact', head: true }).eq('category_id', cat.id);
    standard = count ?? 0;
  } catch {}
  return { suppliers, catalog, standard, total: suppliers + catalog + standard };
}

async function reassignToUncategorized(cat: Category) {
  // suppliers
  const sups = loadSuppliers();
  const sNext = sups.map(s => s.category === cat.nameEn ? { ...s, category: 'Uncategorized' } : s);
  if (JSON.stringify(sups) !== JSON.stringify(sNext)) saveSuppliers(sNext);
  // catalog
  const cat2 = loadCatalog();
  const cNext = cat2.map(p => p.discipline === cat.nameEn ? { ...p, discipline: 'Uncategorized' } : p);
  if (JSON.stringify(cat2) !== JSON.stringify(cNext)) saveCatalog(cNext);
  // standard items (DB-only update)
  try {
    await supabase.from('standard_items').update({ category_id: UNCATEGORIZED_ID }).eq('category_id', cat.id);
  } catch {}
}

export default function ManageCategoriesDialog({ open, onOpenChange }: Props) {
  const [list, setList] = useState<Category[]>(loadCategoriesShared);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => subscribeCategories(setList), []);
  useEffect(() => { if (open) setList(loadCategoriesShared()); }, [open]);

  const sorted = useMemo(() =>
    [...list].sort((a, b) => (a.order || 0) - (b.order || 0) || a.nameEn.localeCompare(b.nameEn))
  , [list]);

  const startRename = (c: Category) => { setEditing(c.id); setEditName(c.nameEn); };

  const saveRename = (c: Category) => {
    const name = editName.trim();
    if (!name) { toast({ title: 'Name required' }); return; }
    if (list.some(x => x.id !== c.id && x.nameEn.toLowerCase() === name.toLowerCase())) {
      toast({ title: 'A category with this name already exists' }); return;
    }
    const oldName = c.nameEn;
    const next = list.map(x => x.id === c.id ? { ...x, nameEn: name } : x);
    saveCategoriesShared(next);
    // Update suppliers (which store by nameEn)
    const sups = loadSuppliers();
    const sNext = sups.map(s => s.category === oldName ? { ...s, category: name } : s);
    if (JSON.stringify(sups) !== JSON.stringify(sNext)) saveSuppliers(sNext);
    setEditing(null);
    toast({ title: 'Category renamed' });
  };

  const handleDelete = async (c: Category) => {
    if (c.id === UNCATEGORIZED_ID) { toast({ title: 'Cannot delete Uncategorized' }); return; }
    const usage = await countUsage(c);
    if (usage.total > 0) {
      const ok = window.confirm(`${usage.total} item(s) use this category. They will be moved to Uncategorized. Continue?`);
      if (!ok) return;
      // ensure Uncategorized exists
      let next = list;
      if (!next.some(x => x.id === UNCATEGORIZED_ID)) {
        next = [...next, { id: UNCATEGORIZED_ID, nameEn: 'Uncategorized', nameHe: 'לא מסווג', scope: 'both', order: 999 }];
      }
      await reassignToUncategorized(c);
      next = next.filter(x => x.id !== c.id);
      saveCategoriesShared(next);
    } else {
      if (!window.confirm(`Delete category "${c.nameEn}"?`)) return;
      saveCategoriesShared(list.filter(x => x.id !== c.id));
    }
    toast({ title: 'Category deleted' });
  };

  const addNew = () => {
    const name = newName.trim();
    if (!name) { toast({ title: 'Name required' }); return; }
    if (list.some(x => x.nameEn.toLowerCase() === name.toLowerCase())) {
      toast({ title: 'A category with this name already exists' }); return;
    }
    const order = (list.reduce((m, c) => Math.max(m, c.order || 0), 0) || 0) + 1;
    const cat: Category = { id: genCategoryIdShared(), nameEn: name, nameHe: '', scope: 'both', order };
    saveCategoriesShared([...list, cat]);
    setNewName(''); setAdding(false);
    toast({ title: 'Category added' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Manage Categories</DialogTitle></DialogHeader>
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {sorted.map(c => (
            <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50">
              {editing === c.id ? (
                <>
                  <Input className="h-7 text-sm" value={editName} onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveRename(c); if (e.key === 'Escape') setEditing(null); }} autoFocus />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveRename(c)}><Check className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">{c.nameEn}{c.nameHe ? <span className="text-xs text-muted-foreground ml-2">{c.nameHe}</span> : null}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startRename(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="border-t pt-3">
          {adding ? (
            <div className="flex items-center gap-2">
              <Input className="h-8 text-sm" placeholder="New category name" value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addNew(); if (e.key === 'Escape') { setAdding(false); setNewName(''); } }} autoFocus />
              <Button size="sm" onClick={addNew}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNewName(''); }}>Cancel</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Category
            </Button>
          )}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
