/**
 * Public Area Plans — file attachments per node (floor plans / furniture
 * layouts). Small files (≤ 1 MB) keep their dataUrl in the localStorage
 * record. Larger files store the blob in IndexedDB under
 * `cyprusValley_publicAreaPlanBlobs` and the metadata record only carries
 * a `storageKey` reference. A small thumbnail (max 400px) is generated on
 * upload and cached as base64 in metadata for fast tree rendering.
 */

export interface PublicAreaPlan {
  id: string;
  nodeId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  label: string;
  /** Inline base64 for files ≤ 1 MB. Mutually exclusive with storageKey. */
  dataUrl?: string;
  /** IndexedDB key for files > 1 MB. */
  storageKey?: string;
  /** Always present — small base64 image for fast preview. */
  thumbnailDataUrl?: string;
  uploadedAt: string;
  order: number;
  archived?: boolean;
}

export const PLANS_META_KEY = 'cyprus-valley_publicAreaPlans';
export const PLANS_DB = 'cyprusValley_publicAreaPlans';
export const PLANS_STORE = 'cyprusValley_publicAreaPlanBlobs';

export const ACCEPT_MIME = [
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml',
  'application/pdf',
];
export const ACCEPT_EXT = '.png,.jpg,.jpeg,.webp,.svg,.pdf';
export const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const INLINE_MAX = 1 * 1024 * 1024; // 1 MB
export const THUMB_MAX_W = 400;

export const genPlanId = () =>
  `pap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// ── Persistence (metadata) ───────────────────────────────────────────────
export function loadPlans(): PublicAreaPlan[] {
  try {
    const raw = localStorage.getItem(PLANS_META_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch { return []; }
}
export const savePlans = (plans: PublicAreaPlan[]) =>
  localStorage.setItem(PLANS_META_KEY, JSON.stringify(plans));

// ── IndexedDB helpers (blobs) ────────────────────────────────────────────
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PLANS_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PLANS_STORE)) {
        db.createObjectStore(PLANS_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putBlob(key: string, dataUrl: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PLANS_STORE, 'readwrite');
    tx.objectStore(PLANS_STORE).put(dataUrl, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
export async function getBlob(key: string): Promise<string | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PLANS_STORE, 'readonly');
    const req = tx.objectStore(PLANS_STORE).get(key);
    req.onsuccess = () => { db.close(); resolve((req.result as string) ?? null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}
export async function deleteBlob(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PLANS_STORE, 'readwrite');
    tx.objectStore(PLANS_STORE).delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

// ── File reading ─────────────────────────────────────────────────────────
export const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

// ── Thumbnail generation ─────────────────────────────────────────────────
export async function makeThumbnail(file: File, dataUrl: string): Promise<string | undefined> {
  // SVG → use the dataUrl directly (vector, tiny).
  if (file.type === 'image/svg+xml') return dataUrl;
  // PDF → no first-page render without a heavy lib; use a generic icon.
  if (file.type === 'application/pdf') return undefined;
  // Raster image → downscale via canvas.
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('img load'));
      i.src = dataUrl;
    });
    const scale = Math.min(1, THUMB_MAX_W / img.width);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch { return undefined; }
}

// ── Resolve full data url (inline or from IndexedDB) ────────────────────
export async function resolvePlanDataUrl(plan: PublicAreaPlan): Promise<string | null> {
  if (plan.dataUrl) return plan.dataUrl;
  if (plan.storageKey) return await getBlob(plan.storageKey);
  return null;
}

// ── Format helpers ───────────────────────────────────────────────────────
export const formatBytes = (b: number) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
};
