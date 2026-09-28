import { BrushStroke, PointPrompt, VectorSelection } from './segmentation';
import { AnalysisResponse } from './analysis';

export interface RegionObject {
  id: string;
  name: string;
  category: 'Nucleus' | 'Cell' | 'Mitotic figure' | 'Dysplastic Epithelium' | 'Keratin Pearl' | 'Stromal Infiltration' | 'Other';
  color: string;
  vectorSelection?: VectorSelection | null;
  positiveStrokes: BrushStroke[];
  negativeStrokes: BrushStroke[];
  points: PointPrompt[];
  bbox?: [number, number, number, number] | null;
  contour?: number[][][] | null;
  aiMaskB64?: string | null;
  finalEditedMaskB64?: string | null;
  cropUrl?: string | null;
  cutoutUrl?: string | null;
  cropBase64?: string | null;
  cutoutBase64?: string | null;
  analysis?: AnalysisResponse | null;
  modelUsed?: string | null;
  inferenceTimeMs?: number | null;
  isConfirmed?: boolean;
  comment?: string;
  timestamp: string;
}

export interface ImageItem {
  image_id: string;
  filename: string;
  width: number;
  height: number;
  channels: number;
  url: string;
  thumbnail_url?: string | null;
  is_sample: boolean;
  ground_truth_url?: string | null;
  metadata?: {
    format?: string;
    clinical_context?: string;
    pathology_notes?: string;
    file_size_bytes?: number;
    width?: number;
    height?: number;
    mode?: string;
    channels?: number;
  };
}
