import { RegionObject, ImageItem } from './region';
import { BrushMode, SegmentationInteractionMode } from './segmentation';

export interface ViewerCameraState {
  zoom: number;
  panX: number;
  panY: number;
}

export interface ProjectMetadata {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  schemaVersion: number;
  currentImageId?: string | null;
  activeRegionId?: string | null;
  viewerState?: ViewerCameraState | null;
  toolMode?: BrushMode;
  interactionMode?: SegmentationInteractionMode;
  roiPadding?: number;
  brushSize?: number;
  maskOpacity?: number;
}

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

export interface ProjectExportPackage {
  schemaVersion: number;
  exportedAt: string;
  project: ProjectMetadata;
  image?: ImageItem | null;
  regions: RegionObject[];
}
