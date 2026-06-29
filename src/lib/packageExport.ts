import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Package } from '@/data/packagesData';
import { CatalogProduct } from '@/data/catalogData';

interface Row {
  idx: number;
  name: string;
  description: string;
  sku: string;
  supplier: string;
  discipline: string;
  qty: number;
  unitPrice: number;
  total: number;
  isExtra: boolean;
  imageUrl: string;
}

function buildRows(pkg: Package, catalogById: Map<string, CatalogProduct>): Row[] {
  return pkg.items.map((it, i) => {
    const p = catalogById.get(it.productId);
    const unitPrice = p?.unitPriceEur ?? 0;
    return {
      idx: i + 1,
      name: p?.name ?? it.productId,
      description: p?.description ?? '',
      sku: p?.sku ?? '',
      supplier: p?.supplierName ?? '',
      discipline: p?.discipline ?? '',
      qty: it.quantity,
      unitPrice,
      total: unitPrice * it.quantity,
      isExtra: !!it.isExtra,
      imageUrl: p?.imageUrl ?? '',
    };
  });
}

function sanitize(name: string): string {
  return name.replace(/[^\w\-]+/g, '_').slice(0, 80) || 'package';
}

interface LoadedImage { dataUrl: string; width: number; height: number; format: 'JPEG' | 'PNG' }

async function loadImage(url: string): Promise<LoadedImage | null> {
  if (!url) return null;
  try {
    let dataUrl = url;
    if (!url.startsWith('data:')) {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) return null;
      const blob = await res.blob();
      dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
      });
    }
    const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth || 100, h: img.naturalHeight || 100 });
      img.onerror = () => reject(new Error('img load'));
      img.src = dataUrl;
    });
    const format: 'JPEG' | 'PNG' = dataUrl.includes('image/png') ? 'PNG' : 'JPEG';
    return { dataUrl, width: dims.w, height: dims.h, format };
  } catch {
    return null;
  }
}

async function preloadImages(urls: string[]): Promise<Map<string, LoadedImage>> {
  const unique = Array.from(new Set(urls.filter(Boolean)));
  const results = await Promise.all(unique.map(u => loadImage(u).then(img => [u, img] as const)));
  const map = new Map<string, LoadedImage>();
  results.forEach(([u, img]) => { if (img) map.set(u, img); });
  return map;
}

export async function exportPackageToExcel(pkg: Package, catalogById: Map<string, CatalogProduct>) {
  const rows = buildRows(pkg, catalogById);
  const main = rows.filter(r => !r.isExtra);
  const extras = rows.filter(r => r.isExtra);
  const mainTotal = main.reduce((s, r) => s + r.total, 0);
  const extrasTotal = extras.reduce((s, r) => s + r.total, 0);

  const headerInfo: any[][] = [
    [pkg.name],
    [pkg.description || ''],
    [`Block: ${pkg.block}`],
    [`Buildings: ${(pkg.buildings ?? []).join(', ')}`],
    [`Room Types: ${(pkg.roomTypes ?? []).join(', ')}`],
    [`Cover Image: ${pkg.imageUrl || '—'}`],
    [],
  ];

  const tableHeader = ['#', 'Image', 'Product', 'Description', 'SKU', 'Supplier', 'Discipline', 'Qty', 'Unit Price (€)', 'Total (€)'];
  const toRow = (r: Row) => [r.idx, r.imageUrl || '', r.name, r.description, r.sku, r.supplier, r.discipline, r.qty, r.unitPrice, r.total];

  const sheetData: any[][] = [
    ...headerInfo,
    ['Main Items'],
    tableHeader,
    ...main.map(toRow),
    ['', '', '', '', '', '', '', '', 'Subtotal', mainTotal],
  ];
  if (extras.length > 0) {
    sheetData.push([], ['Extras (excluded from total)'], tableHeader, ...extras.map(toRow),
      ['', '', '', '', '', '', '', '', 'Extras Subtotal', extrasTotal]);
  }
  sheetData.push([], ['', '', '', '', '', '', '', '', 'PACKAGE TOTAL', mainTotal]);

  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  ws['!cols'] = [{ wch: 4 }, { wch: 30 }, { wch: 40 }, { wch: 40 }, { wch: 14 }, { wch: 20 }, { wch: 16 }, { wch: 6 }, { wch: 14 }, { wch: 14 }];

  // Convert image URLs in column B to clickable hyperlinks
  const range = XLSX.utils.decode_range(ws['!ref']!);
  for (let R = range.s.r; R <= range.e.r; R++) {
    const addr = XLSX.utils.encode_cell({ r: R, c: 1 });
    const cell = ws[addr];
    if (cell && typeof cell.v === 'string' && /^https?:|^data:/.test(cell.v)) {
      cell.l = { Target: cell.v, Tooltip: 'Open image' };
      if (cell.v.startsWith('data:')) cell.v = '(embedded image)';
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Package');
  XLSX.writeFile(wb, `${sanitize(pkg.name)}.xlsx`);
}

export async function exportPackageToPdf(pkg: Package, catalogById: Map<string, CatalogProduct>) {
  const rows = buildRows(pkg, catalogById);
  const main = rows.filter(r => !r.isExtra);
  const extras = rows.filter(r => r.isExtra);
  const mainTotal = main.reduce((s, r) => s + r.total, 0);
  const extrasTotal = extras.reduce((s, r) => s + r.total, 0);

  const allUrls: string[] = [];
  if (pkg.imageUrl) allUrls.push(pkg.imageUrl);
  rows.forEach(r => { if (r.imageUrl) allUrls.push(r.imageUrl); });
  const images = await preloadImages(allUrls);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 32;
  let y = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(pkg.name || 'Package', margin, y);
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (pkg.description) {
    const lines = doc.splitTextToSize(pkg.description, pageWidth - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 12;
  }
  doc.text(`Block: ${pkg.block}`, margin, y); y += 12;
  if (pkg.buildings?.length) { doc.text(`Buildings: ${pkg.buildings.join(', ')}`, margin, y); y += 12; }
  if (pkg.roomTypes?.length) {
    const lines = doc.splitTextToSize(`Room Types: ${pkg.roomTypes.join(', ')}`, pageWidth - margin * 2);
    doc.text(lines, margin, y); y += lines.length * 12;
  }
  y += 6;

  // Cover image
  const cover = pkg.imageUrl ? images.get(pkg.imageUrl) : null;
  if (cover) {
    const maxW = pageWidth - margin * 2;
    const maxH = 180;
    const ratio = Math.min(maxW / cover.width, maxH / cover.height);
    const w = cover.width * ratio;
    const h = cover.height * ratio;
    try { doc.addImage(cover.dataUrl, cover.format, margin, y, w, h); y += h + 12; } catch {}
  }

  const head = [['#', 'Image', 'Product', 'Description', 'SKU', 'Supplier', 'Discipline', 'Qty', 'Unit € ', 'Total €']];
  const buildBody = (list: Row[]) => list.map(r => [r.idx, '', r.name, r.description, r.sku, r.supplier, r.discipline, r.qty, r.unitPrice.toFixed(2), r.total.toFixed(2)]);

  const drawImageCell = (list: Row[]) => (data: any) => {
    if (data.section !== 'body' || data.column.index !== 1) return;
    const row = list[data.row.index];
    if (!row) return;
    const img = row.imageUrl ? images.get(row.imageUrl) : null;
    if (!img) return;
    const cell = data.cell;
    const pad = 2;
    const maxW = cell.width - pad * 2;
    const maxH = cell.height - pad * 2;
    const ratio = Math.min(maxW / img.width, maxH / img.height);
    const w = img.width * ratio;
    const h = img.height * ratio;
    const x = cell.x + (cell.width - w) / 2;
    const yy = cell.y + (cell.height - h) / 2;
    try { doc.addImage(img.dataUrl, img.format, x, yy, w, h); } catch {}
  };

  const columnStyles: any = {
    0: { cellWidth: 22, halign: 'center' },
    1: { cellWidth: 60, minCellHeight: 50 },
    2: { cellWidth: 130 },
    3: { cellWidth: 180 },
    4: { cellWidth: 60 },
    5: { cellWidth: 80 },
    6: { cellWidth: 70 },
    7: { cellWidth: 28, halign: 'right' },
    8: { cellWidth: 52, halign: 'right' },
    9: { cellWidth: 60, halign: 'right' },
  };

  // Main section
  autoTable(doc, {
    startY: y,
    head: [[{ content: 'Main Items', colSpan: 10, styles: { halign: 'left', fillColor: [30, 41, 59], textColor: 255 } } as any]],
    body: [],
    theme: 'plain',
    margin: { left: margin, right: margin },
  });
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY,
    head,
    body: buildBody(main),
    foot: [['', '', '', '', '', '', '', '', 'Subtotal', mainTotal.toFixed(2)]],
    theme: 'striped',
    headStyles: { fillColor: [51, 65, 85] },
    footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 3, valign: 'middle', overflow: 'linebreak' },
    columnStyles,
    margin: { left: margin, right: margin },
    didDrawCell: drawImageCell(main),
  });

  if (extras.length > 0) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 12,
      head: [[{ content: 'Extras (excluded from total)', colSpan: 10, styles: { halign: 'left', fillColor: [120, 113, 108], textColor: 255 } } as any]],
      body: [],
      theme: 'plain',
      margin: { left: margin, right: margin },
    });
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY,
      head,
      body: buildBody(extras),
      foot: [['', '', '', '', '', '', '', '', 'Extras Subtotal', extrasTotal.toFixed(2)]],
      theme: 'striped',
      headStyles: { fillColor: [120, 113, 108] },
      footStyles: { fillColor: [245, 245, 244], textColor: 20, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3, valign: 'middle', overflow: 'linebreak' },
      columnStyles,
      margin: { left: margin, right: margin },
      didDrawCell: drawImageCell(extras),
    });
  }

  const finalY = (doc as any).lastAutoTable.finalY + 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`PACKAGE TOTAL: € ${mainTotal.toFixed(2)}`, margin, finalY);

  doc.save(`${sanitize(pkg.name)}.pdf`);
}
