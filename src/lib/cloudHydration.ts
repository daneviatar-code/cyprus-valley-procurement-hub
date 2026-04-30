/**
 * Cloud hydration: pulls data from Lovable Cloud once at app start,
 * and exposes it through the existing subscribe* APIs.
 */
import { hydrateSuppliersFromCloud } from '@/data/supplierData';
import { hydrateStandardItemsFromCloud } from '@/data/standardItemsData';
import { hydratePublicAreasFromCloud } from '@/data/publicAreasData';
import { hydratePublicAreaPlansFromCloud } from '@/data/publicAreaPlansData';
import { hydrateCatalogFromCloud } from '@/data/catalogData';

let started = false;

export function startCloudHydration() {
  if (started) return;
  started = true;
  // Fire all in parallel; failures are logged inside each.
  void hydrateSuppliersFromCloud();
  void hydrateStandardItemsFromCloud();
  void hydratePublicAreasFromCloud();
  void hydratePublicAreaPlansFromCloud();
}
