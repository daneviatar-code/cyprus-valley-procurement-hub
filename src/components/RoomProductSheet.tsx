import { useMemo, useRef } from 'react';
import { Printer, X, FileText } from 'lucide-react';
import { Concept } from '@/data/masterData';
import { categoryEmojis } from '@/data/projectData';
import { loadPackage } from '@/data/packageData';

interface RoomProductSheetProps {
  concept: Concept;
  unitCode: string;
  unitDescription: string;
  building: string;
  roomNumber?: string;
  furniture: { itemName: string; category: string; qty: number }[];
  onClose: () => void;
}

export default function RoomProductSheet({
  concept,
  unitCode,
  unitDescription,
  building,
  roomNumber,
  furniture,
  onClose,
}: RoomProductSheetProps) {
  const printRef = useRef<HTMLDivElement>(null);

  // Load package data for pricing
  const pkg = useMemo(() => loadPackage(concept, unitCode), [concept, unitCode]);
  const priceMap = useMemo(() => {
    const map: Record<string, number> = {};
    pkg.items.forEach(it => {
      map[it.itemName] = it.unitPrice;
    });
    return map;
  }, [pkg]);

  // Merge furniture list with pricing
  const rows = useMemo(() => {
    return furniture.map((f, i) => {
      const unitPrice = priceMap[f.itemName] || 0;
      return {
        idx: i + 1,
        itemName: f.itemName,
        category: f.category,
        qty: f.qty,
        unitPrice,
        lineTotal: f.qty * unitPrice,
      };
    });
  }, [furniture, priceMap]);

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, typeof rows> = {};
    rows.forEach(r => {
      if (!groups[r.category]) groups[r.category] = [];
      groups[r.category].push(r);
    });
    return groups;
  }, [rows]);

  const grandTotal = rows.reduce((s, r) => s + r.lineTotal, 0);
  const totalPieces = rows.reduce((s, r) => s + r.qty, 0);

  const conceptNames: Record<Concept, string> = { A: 'Happiness', B: 'Wellness', C: 'Boutique' };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head>
      <title>Room Product Sheet — ${building} ${roomNumber || unitCode}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #1a1a1a; font-size: 12px; }
        h2 { font-size: 18px; margin-bottom: 2px; }
        .meta { color: #666; margin-bottom: 16px; font-size: 13px; }
        .cat-header { font-size: 13px; font-weight: 700; margin: 16px 0 6px; padding: 4px 0; border-bottom: 2px solid #333; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
        th, td { border: 1px solid #ddd; padding: 5px 8px; }
        th { background: #f5f5f5; font-weight: 600; text-align: left; }
        .text-right { text-align: right; }
        .cat-subtotal { background: #f9f9f9; font-weight: 600; }
        .grand-total td { border-top: 3px double #333; font-weight: 700; font-size: 14px; background: #f0f0f0; }
        @media print { body { padding: 0; } }
      </style>
    </head><body>${content.innerHTML}</body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8">
      <div className="bg-card rounded-xl border shadow-2xl w-full max-w-4xl mx-4">
        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30 rounded-t-xl">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-accent" />
            <div>
              <h2 className="text-base font-semibold text-foreground">Room Product Sheet</h2>
              <p className="text-xs text-muted-foreground">
                {building} · {roomNumber ? `Room ${roomNumber}` : `Unit ${unitCode}`} · {unitDescription}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Printer className="h-4 w-4" /> Print
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable content */}
        <div ref={printRef} className="p-6">
          <h2 style={{ fontSize: 18, marginBottom: 2 }}>
            Room Product Sheet — {conceptNames[concept]} ({building})
          </h2>
          <div className="meta" style={{ color: '#666', marginBottom: 16, fontSize: 13 }}>
            {roomNumber ? `Room ${roomNumber} · ` : ''}Unit Code: {unitCode} · Type: {unitDescription} · {rows.length} items · {totalPieces} pieces
          </div>

          {Object.entries(grouped).map(([cat, items]) => {
            const emoji = categoryEmojis[cat as keyof typeof categoryEmojis] || '📦';
            const catSubtotal = items.reduce((s, r) => s + r.lineTotal, 0);
            const catPieces = items.reduce((s, r) => s + r.qty, 0);

            return (
              <div key={cat} style={{ marginBottom: 16 }}>
                <div className="cat-header" style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, paddingBottom: 4, borderBottom: '2px solid currentColor' }}>
                  <span>{emoji}</span> {cat}
                </div>
                <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr className="bg-muted/40">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground w-8">#</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Item Name</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground w-16">Qty</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground w-28">Unit Price €</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground w-28">Line Total €</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map(r => (
                      <tr key={r.idx} className="hover:bg-muted/20">
                        <td className="px-3 py-1.5 text-muted-foreground">{r.idx}</td>
                        <td className="px-3 py-1.5 text-foreground font-medium">{r.itemName}</td>
                        <td className="px-3 py-1.5 text-right text-foreground">{r.qty}</td>
                        <td className="px-3 py-1.5 text-right text-foreground">
                          {r.unitPrice > 0 ? `€${r.unitPrice.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className="px-3 py-1.5 text-right font-medium text-foreground">
                          {r.lineTotal > 0 ? `€${r.lineTotal.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                        </td>
                      </tr>
                    ))}
                    <tr className="cat-subtotal" style={{ background: 'var(--muted, #f5f5f5)' }}>
                      <td colSpan={2} className="px-3 py-1.5 text-right text-xs font-semibold text-muted-foreground">
                        {cat} Subtotal
                      </td>
                      <td className="px-3 py-1.5 text-right font-semibold text-foreground">{catPieces}</td>
                      <td className="px-3 py-1.5"></td>
                      <td className="px-3 py-1.5 text-right font-semibold text-foreground">
                        {catSubtotal > 0 ? `€${catSubtotal.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}

          {/* Grand total */}
          <div style={{ borderTop: '3px double #333', marginTop: 8, paddingTop: 12 }}>
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
              <tbody>
                <tr className="grand-total">
                  <td colSpan={2} className="px-3 py-3 text-right font-bold text-foreground text-sm" style={{ border: 'none' }}>
                    Grand Total
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-foreground w-16" style={{ border: 'none' }}>
                    {totalPieces}
                  </td>
                  <td className="w-28" style={{ border: 'none' }}></td>
                  <td className="px-3 py-3 text-right font-bold text-foreground text-base w-28" style={{ border: 'none' }}>
                    €{grandTotal.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
