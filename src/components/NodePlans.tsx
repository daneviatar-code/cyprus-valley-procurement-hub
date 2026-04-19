/**
 * NodePlans — Floor plan / furniture layout attachments for a Public Areas
 * node. Sits above the items table in the right pane. Supports multiple
 * files per node, per-plan rename, lightbox, embedded PDF preview, and a
 * "Download All (ZIP)" bundle. Storage: ≤1 MB → inline base64 in
 * localStorage; >1 MB → IndexedDB blob with key reference in metadata.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Upload, Image as ImageIcon, FileText, Trash2, Download, Replace,
  Pencil, Check, X, ZoomIn, ChevronLeft, ChevronRight, Plus, Loader2, Package,
} from 'lucide-react';
import JSZip from 'jszip';
import { toast } from 'sonner';
import {
  PublicAreaPlan, ACCEPT_MIME, ACCEPT_EXT, MAX_BYTES, INLINE_MAX,
  genPlanId, readAsDataUrl, makeThumbnail, resolvePlanDataUrl,
  putBlob, deleteBlob, formatBytes,
} from '@/data/publicAreaPlansData';

interface Props {
  nodeId: string;
  nodeName: string;
  plans: PublicAreaPlan[];
  onChange: (next: PublicAreaPlan[]) => void;
}

export default function NodePlans({ nodeId, nodeName, plans, onChange }: Props) {
  const myPlans = useMemo(
    () => plans.filter(p => p.nodeId === nodeId && !p.archived).sort((a, b) => a.order - b.order),
    [plans, nodeId],
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; mime: string; label: string } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [zipBusy, setZipBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetId = useRef<string | null>(null);

  // Default-select the first plan when the active one disappears or list changes.
  useEffect(() => {
    if (myPlans.length === 0) { setActiveId(null); return; }
    if (!activeId || !myPlans.find(p => p.id === activeId)) {
      setActiveId(myPlans[0].id);
    }
  }, [myPlans, activeId]);

  const active = myPlans.find(p => p.id === activeId) || null;

  // Resolve the active plan's full data URL (may live in IndexedDB).
  useEffect(() => {
    let cancelled = false;
    setPreviewUrl(null);
    if (!active) return;
    resolvePlanDataUrl(active).then(url => { if (!cancelled) setPreviewUrl(url); });
    return () => { cancelled = true; };
  }, [active]);

  // ── Validation ──────────────────────────────────────────────────────────
  const validateFile = (f: File): string | null => {
    const name = f.name.toLowerCase();
    const okExt = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.pdf']
      .some(e => name.endsWith(e));
    if (!ACCEPT_MIME.includes(f.type) && !okExt) {
      return 'סוג קובץ לא נתמך — Unsupported file type';
    }
    if (f.size > MAX_BYTES) {
      return 'הקובץ גדול מדי — מקסימום 10MB';
    }
    if (f.size === 0) return 'קובץ ריק או פגום — Empty / corrupt file';
    return null;
  };

  // ── Add ─────────────────────────────────────────────────────────────────
  const handleFiles = async (files: FileList | null, replaceId?: string) => {
    if (!files?.length) return;
    const list = Array.from(files);
    setProgress(0);
    try {
      const next = [...plans];
      for (let i = 0; i < list.length; i++) {
        const file = list[i];
        const err = validateFile(file);
        if (err) { toast.error(err); continue; }
        let dataUrl: string;
        try { dataUrl = await readAsDataUrl(file); }
        catch { toast.error(`כשל בקריאת ${file.name}`); continue; }
        const thumbnailDataUrl = await makeThumbnail(file, dataUrl).catch(() => undefined);

        const inline = file.size <= INLINE_MAX;
        let storageKey: string | undefined;
        if (!inline) {
          storageKey = `${nodeId}__${genPlanId()}`;
          try { await putBlob(storageKey, dataUrl); }
          catch {
            toast.error(`שגיאה בשמירה ל-IndexedDB: ${file.name}`);
            continue;
          }
        }

        if (replaceId) {
          const idx = next.findIndex(p => p.id === replaceId);
          if (idx >= 0) {
            const old = next[idx];
            if (old.storageKey) await deleteBlob(old.storageKey).catch(() => undefined);
            next[idx] = {
              ...old,
              fileName: file.name,
              mimeType: file.type || old.mimeType,
              fileSize: file.size,
              dataUrl: inline ? dataUrl : undefined,
              storageKey: inline ? undefined : storageKey,
              thumbnailDataUrl,
              uploadedAt: new Date().toISOString(),
            };
          }
          replaceId = undefined; // only replace one
        } else {
          const order = next.filter(p => p.nodeId === nodeId && !p.archived).length;
          next.push({
            id: genPlanId(),
            nodeId,
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            fileSize: file.size,
            label: file.name.replace(/\.[^.]+$/, ''),
            dataUrl: inline ? dataUrl : undefined,
            storageKey: inline ? undefined : storageKey,
            thumbnailDataUrl,
            uploadedAt: new Date().toISOString(),
            order,
          });
        }
        setProgress(Math.round(((i + 1) / list.length) * 100));
      }
      onChange(next);
      toast.success('תוכנית הועלתה בהצלחה');
    } finally {
      setProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (replaceInputRef.current) replaceInputRef.current.value = '';
    }
  };

  // ── Drop zone ───────────────────────────────────────────────────────────
  const [dragOver, setDragOver] = useState(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  // ── Remove ──────────────────────────────────────────────────────────────
  const removePlan = async (p: PublicAreaPlan) => {
    if (!confirm(`להסיר "${p.label}"? — Remove this plan?`)) return;
    if (p.storageKey) await deleteBlob(p.storageKey).catch(() => undefined);
    onChange(plans.filter(x => x.id !== p.id));
    toast.success('התוכנית הוסרה — Plan removed');
  };

  // ── Download a single plan ──────────────────────────────────────────────
  const downloadPlan = async (p: PublicAreaPlan) => {
    const url = await resolvePlanDataUrl(p);
    if (!url) { toast.error('לא ניתן למצוא את הקובץ'); return; }
    const a = document.createElement('a');
    a.href = url; a.download = p.fileName; a.click();
  };

  // ── ZIP all ─────────────────────────────────────────────────────────────
  const downloadAllZip = async () => {
    if (myPlans.length === 0) return;
    setZipBusy(true);
    try {
      const zip = new JSZip();
      for (const p of myPlans) {
        const url = await resolvePlanDataUrl(p);
        if (!url) continue;
        const b64 = url.split(',')[1] || '';
        const safeLabel = p.label.replace(/[^\w\-]+/g, '_');
        const ext = (p.fileName.match(/\.[^.]+$/)?.[0]) || '';
        zip.file(`${safeLabel}__${p.fileName}${p.fileName.endsWith(ext) ? '' : ext}`, b64, { base64: true });
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${nodeName.replace(/\s+/g, '-')}_plans.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('שגיאה ביצירת ZIP');
    } finally {
      setZipBusy(false);
    }
  };

  // ── Rename ──────────────────────────────────────────────────────────────
  const startRename = (p: PublicAreaPlan) => {
    setRenamingId(p.id); setRenameValue(p.label);
  };
  const commitRename = () => {
    if (!renamingId) return;
    onChange(plans.map(p => p.id === renamingId ? { ...p, label: renameValue.trim() || p.fileName } : p));
    setRenamingId(null);
  };

  const isImage = (mime: string) => mime.startsWith('image/');
  const isPdf = (mime: string) => mime === 'application/pdf';

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 p-3 border-b bg-muted/30 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <ImageIcon className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold text-foreground">
            Floor Plan <span className="text-muted-foreground font-normal">— תוכנית האזור</span>
          </h3>
          {myPlans.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {myPlans.length}
            </span>
          )}
        </div>
        {myPlans.length > 0 && (
          <div className="flex items-center gap-1">
            <button onClick={downloadAllZip} disabled={zipBusy}
              className="inline-flex items-center gap-1 h-7 px-2 rounded border text-xs hover:bg-muted disabled:opacity-50">
              {zipBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Package className="h-3 w-3" />}
              Download All (ZIP)
            </button>
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" multiple accept={ACCEPT_EXT} className="hidden"
        onChange={e => handleFiles(e.target.files)} />
      <input ref={replaceInputRef} type="file" accept={ACCEPT_EXT} className="hidden"
        onChange={e => handleFiles(e.target.files, replaceTargetId.current || undefined)} />

      {/* Empty state */}
      {myPlans.length === 0 ? (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`m-3 cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            dragOver ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50 hover:bg-muted/30'
          }`}
        >
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <div className="text-sm font-medium text-foreground">
            Drag & drop a plan here, or click to upload
          </div>
          <div className="text-xs text-muted-foreground mt-1" dir="rtl">
            גרור תוכנית או לחץ להעלאה
          </div>
          <div className="text-[10px] text-muted-foreground mt-2">
            PNG · JPG · WEBP · SVG · PDF · max 10 MB
          </div>
        </div>
      ) : (
        <div className="p-3 space-y-3">
          {/* Thumbnail strip */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {myPlans.map(p => (
              <button key={p.id} onClick={() => setActiveId(p.id)}
                className={`shrink-0 relative rounded-md border-2 overflow-hidden transition-all ${
                  activeId === p.id ? 'border-accent shadow-sm' : 'border-border hover:border-accent/50'
                }`}
                style={{ width: 96, height: 72 }}
                title={p.label}
              >
                {p.thumbnailDataUrl ? (
                  <img src={p.thumbnailDataUrl} alt={p.label} className="w-full h-full object-cover" />
                ) : isPdf(p.mimeType) ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-muted text-muted-foreground">
                    <FileText className="h-6 w-6" />
                    <span className="text-[9px] mt-0.5">PDF</span>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate text-left">
                  {p.label}
                </div>
              </button>
            ))}
            <button onClick={() => fileInputRef.current?.click()}
              className="shrink-0 inline-flex flex-col items-center justify-center rounded-md border-2 border-dashed border-border hover:border-accent/60 hover:bg-muted/40 text-muted-foreground"
              style={{ width: 96, height: 72 }}>
              <Plus className="h-5 w-5" />
              <span className="text-[9px] mt-0.5">Add Plan</span>
            </button>
          </div>

          {/* Active preview */}
          {active && (
            <div className="border rounded-md overflow-hidden bg-muted/20">
              <div className="relative" style={{ minHeight: 240 }}>
                {!previewUrl ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : isImage(active.mimeType) ? (
                  <button
                    onClick={() => setLightbox({ url: previewUrl, mime: active.mimeType, label: active.label })}
                    className="block w-full group"
                  >
                    <img src={previewUrl} alt={active.label}
                      className="w-full max-h-[480px] object-contain bg-background" />
                    <div className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded bg-card/90 border text-[10px] text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      <ZoomIn className="h-3 w-3" /> Zoom
                    </div>
                  </button>
                ) : isPdf(active.mimeType) ? (
                  <div className="space-y-2 p-2">
                    <embed src={previewUrl + '#page=1&view=FitH'} type="application/pdf"
                      className="w-full bg-background border rounded" style={{ height: 420 }} />
                    <div className="flex justify-center">
                      <button onClick={() => setLightbox({ url: previewUrl, mime: active.mimeType, label: active.label })}
                        className="inline-flex items-center gap-1 h-7 px-3 rounded border text-xs hover:bg-muted">
                        <ZoomIn className="h-3 w-3" /> Open full PDF
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-sm text-muted-foreground text-center">
                    Preview unavailable for this file type.
                  </div>
                )}
              </div>

              {/* Metadata + actions */}
              <div className="flex items-center justify-between gap-2 p-2 border-t bg-card flex-wrap">
                <div className="min-w-0 flex-1">
                  {renamingId === active.id ? (
                    <div className="flex items-center gap-1">
                      <input value={renameValue} onChange={e => setRenameValue(e.target.value)}
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingId(null); }}
                        className="h-6 rounded border bg-background px-1.5 text-xs flex-1 min-w-0 focus:outline-none focus:ring-1 focus:ring-accent/50" />
                      <button onClick={commitRename} className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-muted"><Check className="h-3 w-3 text-success" /></button>
                      <button onClick={() => setRenamingId(null)} className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-muted"><X className="h-3 w-3" /></button>
                    </div>
                  ) : (
                    <button onClick={() => startRename(active)} className="group inline-flex items-center gap-1 text-left">
                      <span className="text-sm font-semibold text-foreground truncate">{active.label}</span>
                      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    </button>
                  )}
                  <div className="text-[10px] text-muted-foreground truncate">
                    {active.fileName} · {formatBytes(active.fileSize)} · {new Date(active.uploadedAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => { replaceTargetId.current = active.id; replaceInputRef.current?.click(); }}
                    className="inline-flex items-center gap-1 h-7 px-2 rounded border text-xs hover:bg-muted">
                    <Replace className="h-3 w-3" /> Replace <span className="text-muted-foreground">— החלף</span>
                  </button>
                  <button onClick={() => downloadPlan(active)}
                    className="inline-flex items-center gap-1 h-7 px-2 rounded border text-xs hover:bg-muted">
                    <Download className="h-3 w-3" /> Download <span className="text-muted-foreground">— הורד</span>
                  </button>
                  <button onClick={() => removePlan(active)}
                    className="inline-flex items-center gap-1 h-7 px-2 rounded border text-xs text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3 w-3" /> Remove <span className="opacity-70">— הסר</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Progress */}
      {progress !== null && (
        <div className="px-3 pb-3">
          <div className="h-1.5 rounded bg-muted overflow-hidden">
            <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">Uploading… {progress}%</div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <Lightbox onClose={() => setLightbox(null)} {...lightbox} />
      )}
    </div>
  );
}

// ── Lightbox ──────────────────────────────────────────────────────────────
function Lightbox({ url, mime, label, onClose }: { url: string; mime: string; label: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const start = useRef({ x: 0, y: 0, px: 0, py: 0 });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isImg = mime.startsWith('image/');
  const isPdf = mime === 'application/pdf';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
      onWheel={e => { if (isImg) { e.preventDefault(); setScale(s => Math.max(0.5, Math.min(6, s + (e.deltaY > 0 ? -0.2 : 0.2)))); } }}
    >
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-white text-sm z-10" onClick={e => e.stopPropagation()}>
        <div className="truncate max-w-[60%]">{label}</div>
        <div className="flex items-center gap-1">
          {isImg && (
            <>
              <button onClick={() => setScale(s => Math.min(s + 0.3, 6))} className="px-2 py-1 rounded bg-white/10 hover:bg-white/20">+</button>
              <button onClick={() => setScale(s => Math.max(s - 0.3, 0.5))} className="px-2 py-1 rounded bg-white/10 hover:bg-white/20">−</button>
              <button onClick={() => { setScale(1); setPos({ x: 0, y: 0 }); }} className="px-2 py-1 rounded bg-white/10 hover:bg-white/20">Reset</button>
              <span className="text-xs font-mono px-2">{Math.round(scale * 100)}%</span>
            </>
          )}
          <button onClick={onClose} className="px-2 py-1 rounded bg-white/10 hover:bg-white/20"><X className="h-4 w-4" /></button>
        </div>
      </div>

      {isImg && (
        <div
          className="overflow-hidden flex items-center justify-center w-full h-full"
          onClick={e => e.stopPropagation()}
          onMouseDown={e => { if (scale > 1) { dragging.current = true; start.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }; } }}
          onMouseMove={e => { if (dragging.current) setPos({ x: start.current.px + (e.clientX - start.current.x), y: start.current.py + (e.clientY - start.current.y) }); }}
          onMouseUp={() => { dragging.current = false; }}
          onMouseLeave={() => { dragging.current = false; }}
          style={{ cursor: scale > 1 ? 'grab' : 'zoom-in' }}
        >
          <img src={url} alt={label} draggable={false}
            style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`, transition: dragging.current ? 'none' : 'transform 0.15s ease-out' }}
            className="max-w-full max-h-[85vh] object-contain select-none" />
        </div>
      )}
      {isPdf && (
        <div className="w-full h-[88vh]" onClick={e => e.stopPropagation()}>
          <embed src={url} type="application/pdf" className="w-full h-full bg-white rounded" />
        </div>
      )}
    </div>
  );
}

// Re-export ChevronLeft/Right to avoid unused import warning if tree-shaken later.
export { ChevronLeft, ChevronRight };
