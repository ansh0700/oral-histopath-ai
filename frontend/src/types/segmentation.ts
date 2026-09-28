export type BrushMode = 'FREE_SELECT' | 'CIRCLE' | 'RESHAPE' | 'EDIT_VERTICES' | 'ADD' | 'ERASE' | 'PAN' | 'POINT_POSITIVE' | 'POINT_NEGATIVE' | 'BOX';

export type LineStyle = 'dotted' | 'solid';

export type SegmentationInteractionMode = 'exact' | 'strict';

export interface Point2D {
  x: number;
  y: number;
}

export interface BrushStrokePoint extends Point2D {
  pressure?: number;
}

export interface BrushStroke {
  id: string;
  mode: 'ADD' | 'ERASE';
  points: BrushStrokePoint[];
  size: number;
  color: string;
}

export interface PointPrompt {
  x: number;
  y: number;
  label: 1 | 0; // 1 = positive, 0 = negative
  radius?: number;
}

export interface VectorSelection {
  id: string;
  points: Point2D[];              // Boundary vertices in original image coordinates
  initialPoints?: Point2D[];       // Original boundary before edits
  bbox: [number, number, number, number]; // [minX, minY, maxX, maxY]
  areaPixels: number;
  isClosed: boolean;
  isConfirmed: boolean;
  mode: 'exact' | 'ai_refined';
  rotation?: number;              // In radians
}

export interface SegmentationResponse {
  success: boolean;
  model: string;
  mode_used: 'strict' | 'exact';
  mask: string; // Base64 PNG mask
  contour?: number[][][] | null;
  bbox?: [number, number, number, number] | null;
  user_brush_area?: number | null;
  ai_suggested_area?: number | null;
  expansion_ratio?: number | null;
  expansion_warning?: string | null;
  confidence?: number | null;
  inference_time_ms: number;
  message?: string | null;
}
