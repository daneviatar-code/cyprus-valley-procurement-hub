import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Package } from '@/data/packagesData';
import { CatalogProduct } from '@/data/catalogData';

interface Row {
  idx: number;
  name: string;
  sku: string;
  supplier: string;
  discipline: string;
  qty: number;
  unitPrice: number;
  total: number;
  isExtra: boolean;
}

function buildRows(pkg: Package, catalogById: Map<string, CatalogProduct>): Row[] {
  return pkg.items.map((it, i) => {
    const p = catalogById.get(it.productId);
    const unitPrice = p?.unitPriceEur ?? 0;
    return {
      idx: i + 1,
      name: p?.name ?? it.productId,
      sku: p?.sku ?? '',
      supplier: p?.supplierName ?? '',
      discipline: p?.discipline ?? '',
      qty: it.quantity,
      unitPrice,
      total: unitPrice * it.quantity,
      isExtra: !!it.isExtra,
    };
  });
}

function sanitize(name: string): string {
  return name.replace(/[^\w\-]+/g, '_').slice(0, 80) || 'package';
}

export function exportPackageToExcel(pkg: Package, catalogById: Map<string, CatalogProduct>) {
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
    [],
  ];

  const tableHeader = ['#', 'Product', 'SKU', 'Supplier', 'Discipline', 'Qty', 'Unit Price (€)', 'Total (€)'];

  const toRow = (r: Row) => [r.idx, r.name, r.sku, r.supplier, r.discipline, r.qty, r.unitPrice, r.total];

  const sheetData: any[][] = [
    ...headerInfo,
    ['Main Items'],
    tableHeader,
    ...main.map(toRow),
    ['', '', '', '', '', '', 'Subtotal', mainTotal],
  ];
  if (extras.length > 0) {
    sheetData.push([], ['Extras (excluded from total)'], tableHeader, ...extras.map(toRow),
      ['', '', '', '', '', '', 'Extras Subtotal', extrasTotal]);
  }
  sheetData.push([], ['', '', '', '', '', '', 'PACKAGE TOTAL', mainTotal]);

  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  ws['!cols'] = [{ wch: 4 }, { wch: 40 }, { wch: 14 }, { wch: 20 }, { wch: 16 }, { wch: 6 }, { wch: 14 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Package');
  XLSX.writeFile(wb, `${sanitize(pkg.name)}.xlsx`);
}

export function exportPackageToPdf(pkg: Package, catalogById: Map<string, CatalogProduct>) {
  const rows = buildRows(pkg, catalogById);
  const main = rows.filter(r => !r.isExtra);
  const extras = rows.filter(r => r.isExtra);
  const mainTotal = main.reduce((s, r) => s + r.total, 0);
  const extrasTotal = extras.reduce((s, r) => s + r.total, 0);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const margin = 32;
  let y = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(pkg.name || 'Package', margin, y);
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (pkg.description) {
    const lines = doc.splitTextToSize(pkg.description, doc.internal.pageSize.getWidth() - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 12;
  }
  doc.text(`Block: ${pkg.block}`, margin, y); y += 12;
  if (pkg.buildings?.length) { doc.text(`Buildings: ${pkg.buildings.join(', ')}`, margin, y); y += 12; }
  if (pkg.roomTypes?.length) {
    const lines = doc.splitTextToSize(`Room Types: ${pkg.roomTypes.join(', ')}`, doc.internal.pageSize.getWidth() - margin * 2);
    doc.text(lines, margin, y); y += lines.length * 12;
  }
  y += 6;

  const head = [['#', 'Product', 'SKU', 'Supplier', 'Discipline', 'Qty', 'Unit € ', 'Total €']];
  const mainBody = main.map(r => [r.idx, r.name, r.sku, r.supplier, r.discipline, r.qty, r.unitPrice.toFixed(2), r.total.toFixed(2)]);

  autoTable(doc, {
    startY: y,
    head: [[{ content: 'Main Items', colSpan: 8, styles: { halign: 'left', fillColor: [30, 41, 59], textColor: 255 } } as any]],
    body: [],
    theme: 'plain',
    margin: { left: margin, right: margin },
  });
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY,
    head,
    body: mainBody,
    foot: [['', '', '', '', '', '', 'Subtotal', mainTotal.toFixed(2)]],
    theme: 'striped',
    headStyles: { fillColor: [51, 65, 85] },
    footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 4 },
    margin: { left: margin, right: margin },
  });

  if (extras.length > 0) {
    const extrasBody = extras.map(r => [r.idx, r.name, r.sku, r.supplier, r.discipline, r.qty, r.unitPrice.toFixed(2), r.total.toFixed(2)]);
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 12,
      head: [[{ content: 'Extras (excluded from total)', colSpan: 8, styles: { halign: 'left', fillColor: [120, 113, 108], textColor: 255 } } as any]],
      body: [],
      theme: 'plain',
      margin: { left: margin, right: margin },
    });
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY,
      head,
      body: extrasBody,
      foot: [['', '', '', '', '', '', 'Extras Subtotal', extrasTotal.toFixed(2)]],
      theme: 'striped',
      headStyles: { fillColor: [120, 113, 108] },
      footStyles: { fillColor: [245, 245, 244], textColor: 20, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 4 },
      margin: { left: margin, right: margin },
    });
  }

  const finalY = (doc as any).lastAutoTable.finalY + 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`PACKAGE TOTAL: € ${mainTotal.toFixed(2)}`, margin, finalY);

  doc.save(`${sanitize(pkg.name)}.pdf`);
}
