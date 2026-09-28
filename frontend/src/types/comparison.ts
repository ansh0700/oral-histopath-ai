export interface SingleModelComparisonResult {
  model_id: string;
  model_name: string;
  status: string;
  inference_time_ms?: number | null;
  supported_prompt_used: string;
  mask_url?: string | null;
  crop_url?: string | null;
  cutout_url?: string | null;
  bbox?: [number, number, number, number] | null;
  confidence?: number | null;
  dice?: number | null;
  iou?: number | null;
  precision?: number | null;
  recall?: number | null;
  f1?: number | null;
  notes?: string | null;
}

export interface ModelComparisonResponse {
  success: boolean;
  image_id: string;
  results: SingleModelComparisonResult[];
  ground_truth_available: boolean;
  evaluation_summary?: string | null;
}
