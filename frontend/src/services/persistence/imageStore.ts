import { STORES, idbGet, idbGetAll, idbSet, idbDelete } from './db';
import { ImageItem } from '../../types/region';

export interface StoredImageData extends ImageItem {
  blob?: Blob;
  dataUrl?: string;
  savedAt: string;
}

export const imageStore = {
  async getImage(imageId: string): Promise<StoredImageData | undefined> {
    return idbGet<StoredImageData>(STORES.IMAGES, imageId);
  },

  async getAllImages(): Promise<StoredImageData[]> {
    return idbGetAll<StoredImageData>(STORES.IMAGES);
  },

  async saveImage(image: ImageItem, blob?: Blob, dataUrl?: string): Promise<void> {
    const toSave: StoredImageData = {
      ...image,
      blob,
      dataUrl,
      savedAt: new Date().toISOString(),
    };
    await idbSet(STORES.IMAGES, toSave);
  },

  async deleteImage(imageId: string): Promise<void> {
    await idbDelete(STORES.IMAGES, imageId);
  },
};
