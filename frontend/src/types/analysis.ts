export interface MorphologyMeasurements {
  area_pixels: number;
  area_microns_sq?: number | null;
  perimeter_pixels: number;
  perimeter_microns?: number | null;
  equivalent_diameter: number;
  aspect_ratio: number;
  circularity: number;
  solidity: number;
  eccentricity: number;
  extent: number;
  major_axis_length: number;
  minor_axis_length: number;
  centroid: [number, number];
  bbox: [number, number, number, number];
  mean_intensity_r: number;
  mean_intensity_g: number;
  mean_intensity_b: number;
  hematoxylin_optical_density: number;
  eosin_optical_density: number;
  stain_ratio: number;
}

export interface AnalysisResponse {
  success: boolean;
  model: string;
  feature: string;
  feature_category: string;
  confidence?: number | null;
  measurements: MorphologyMeasurements;
  explanation: string;
  medical_disclaimer: string;
}

export interface EvaluationMetrics {
  success: boolean;
  dice: number;
  iou: number;
  precision: number;
  recall: number;
  f1_score: number;
  boundary_f1?: number | null;
  true_positive_pixels: number;
  false_positive_pixels: number;
  false_negative_pixels: number;
}
