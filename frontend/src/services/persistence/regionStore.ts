import { STORES, idbGet, idbSet, idbDelete, idbGetByIndex, getDB } from './db';
import { RegionObject } from '../../types/region';

export interface StoredRegionData extends RegionObject {
  projectId: string;
  imageId: string;
  updatedAt: string;
}

export const regionStore = {
  async saveRegionsForProject(
    projectId: string,
    imageId: string,
    regions: RegionObject[]
  ): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(STORES.REGIONS, 'readwrite');
    const store = tx.objectStore(STORES.REGIONS);
    const index = store.index('projectImageKey');

    // 1. Fetch existing stored keys for this project & image
    const activeIds = new Set(regions.map((r) => r.id));
    const req = index.getAllKeys(IDBKeyRange.only([projectId, imageId]));

    return new Promise((resolve, reject) => {
      req.onsuccess = () => {
        const storedKeys = req.result;
        // Purge keys that were deleted from current regions list
        for (const k of storedKeys) {
          if (!activeIds.has(k as string)) {
            store.delete(k);
          }
        }
        // Save current regions
        for (const r of regions) {
          const stored: StoredRegionData = {
            ...r,
            projectId,
            imageId,
            updatedAt: new Date().toISOString(),
          };
          store.put(stored);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getRegionsForProject(projectId: string, imageId: string): Promise<RegionObject[]> {
    const all = await idbGetByIndex<StoredRegionData>(
      STORES.REGIONS,
      'projectImageKey',
      IDBKeyRange.only([projectId, imageId])
    );
    return all.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  },

  async deleteRegion(regionId: string): Promise<void> {
    await idbDelete(STORES.REGIONS, regionId);
  },

  async deleteRegionsForProject(projectId: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(STORES.REGIONS, 'readwrite');
    const store = tx.objectStore(STORES.REGIONS);
    const index = store.index('projectId');
    const req = index.getAllKeys(projectId);

    return new Promise((resolve, reject) => {
      req.onsuccess = () => {
        const keys = req.result;
        for (const k of keys) {
          store.delete(k);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};
