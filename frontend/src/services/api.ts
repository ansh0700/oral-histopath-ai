import { ModelCapability, ModelConfigRequest } from '../types/model';
import { SegmentationResponse, PointPrompt, SegmentationInteractionMode } from '../types/segmentation';
import { AnalysisResponse, EvaluationMetrics } from '../types/analysis';
import { ImageItem } from '../types/region';
import { ModelComparisonResponse } from '../types/comparison';

const API_BASE = '/api';

async function safeParseJson<T>(res: Response, defaultErrorMsg: string): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    if (!text) {
      throw new Error(`${defaultErrorMsg} (Server returned empty response ${res.status})`);
    }
    try {
      const json = JSON.parse(text);
      throw new Error(json.detail || json.message || defaultErrorMsg);
    } catch (e: any) {
      if (e.message && !e.message.includes('JSON')) throw e;
      throw new Error(`${defaultErrorMsg} (${res.status}): ${text.slice(0, 100)}`);
    }
  }
  if (!text) {
    throw new Error(`${defaultErrorMsg}: Server returned empty payload`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${defaultErrorMsg}: Server returned invalid JSON payload`);
  }
}

export const api = {
  // 1. Upload & Sample Datasets
  async uploadImage(file: File): Promise<ImageItem> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData,
    });
    return safeParseJson<ImageItem>(res, 'Image upload failed');
  },

  async getSampleDatasets(): Promise<ImageItem[]> {
    const res = await fetch(`${API_BASE}/samples`);
    return safeParseJson<ImageItem[]>(res, 'Failed to fetch sample datasets');
  },

  async deleteImage(imageId: string): Promise<void> {
    await fetch(`${API_BASE}/image/${imageId}`, { method: 'DELETE' });
  },

  // 2. Models
  async getModels(): Promise<ModelCapability[]> {
    const res = await fetch(`${API_BASE}/models`);
    return safeParseJson<ModelCapability[]>(res, 'Failed to fetch AI models');
  },

  async testModel(modelId: string): Promise<{ success: boolean; status: string; message: string }> {
    const res = await fetch(`${API_BASE}/models/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_id: modelId }),
    });
    return safeParseJson<{ success: boolean; status: string; message: string }>(res, 'Model test failed');
  },

  async configureModel(config: ModelConfigRequest): Promise<{ success: boolean; model: ModelCapability }> {
    const res = await fetch(`${API_BASE}/models/configure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return safeParseJson<{ success: boolean; model: ModelCapability }>(res, 'Model configuration failed');
  },

  // 3. Segmentation & Refinement (Strict Mode / Exact Mode)
  async segment(params: {
    imageId: string;
    model: string;
    mode?: SegmentationInteractionMode;
    roiPadding?: number;
    maxExpansionRatio?: number;
    positiveScribble?: string;
    negativeScribble?: string;
    previousMask?: string;
    points?: PointPrompt[];
    bbox?: [number, number, number, number];
  }): Promise<SegmentationResponse> {
    const payload = {
      image_id: params.imageId,
      model: params.model,
      mode: params.mode || 'strict',
      roi_padding: params.roiPadding ?? 20,
      max_expansion_ratio: params.maxExpansionRatio ?? 0.20,
      positive_scribble: params.positiveScribble,
      negative_scribble: params.negativeScribble,
      previous_mask: params.previousMask,
      points: params.points,
      bbox: params.bbox,
    };
    const res = await fetch(`${API_BASE}/segment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return safeParseJson<SegmentationResponse>(res, 'Segmentation failed');
  },

  async refine(params: {
    imageId: string;
    model: string;
    mode?: SegmentationInteractionMode;
    roiPadding?: number;
    maxExpansionRatio?: number;
    currentMask: string;
    addScribble?: string;
    eraseScribble?: string;
    previousMask?: string;
  }): Promise<SegmentationResponse> {
    const payload = {
      image_id: params.imageId,
      model: params.model,
      mode: params.mode || 'strict',
      roi_padding: params.roiPadding ?? 20,
      max_expansion_ratio: params.maxExpansionRatio ?? 0.20,
      current_mask: params.currentMask,
      add_scribble: params.addScribble,
      erase_scribble: params.eraseScribble,
      previous_mask: params.previousMask,
    };
    const res = await fetch(`${API_BASE}/refine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return safeParseJson<SegmentationResponse>(res, 'Refinement failed');
  },

  // 4. Region Extraction (RGB Crop + Transparent RGBA Cutout)
  async extractRegion(params: {
    imageId: string;
    mask: string;
    paddingPercent?: number;
  }): Promise<{
    success: boolean;
    crop_url: string;
    cutout_url: string;
    crop_base64?: string;
    cutout_base64?: string;
    bbox: [number, number, number, number];
    width: number;
    height: number;
    area_pixels: number;
  }> {
    const res = await fetch(`${API_BASE}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_id: params.imageId,
        mask: params.mask,
        padding_percent: params.paddingPercent ?? 0.05,
      }),
    });
    return safeParseJson(res, 'Extraction failed');
  },

  // 5. Morphological Analysis
  async analyze(params: {
    imageId: string;
    mask: string;
    model?: string;
    confidence?: number;
    micronsPerPixel?: number;
  }): Promise<AnalysisResponse> {
    const res = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_id: params.imageId,
        mask: params.mask,
        model: params.model,
        confidence: params.confidence,
        microns_per_pixel: params.micronsPerPixel ?? 0.5,
      }),
    });
    return safeParseJson<AnalysisResponse>(res, 'Analysis failed');
  },

  // 6. Multi-Model Comparison
  async compareModels(params: {
    imageId: string;
    mode?: SegmentationInteractionMode;
    roiPadding?: number;
    positiveScribble?: string;
    negativeScribble?: string;
    points?: PointPrompt[];
    bbox?: [number, number, number, number];
    models?: string[];
    groundTruthMask?: string;
  }): Promise<ModelComparisonResponse> {
    const res = await fetch(`${API_BASE}/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_id: params.imageId,
        mode: params.mode || 'strict',
        roi_padding: params.roiPadding ?? 20,
        positive_scribble: params.positiveScribble,
        negative_scribble: params.negativeScribble,
        points: params.points,
        bbox: params.bbox,
        models: params.models,
        ground_truth_mask: params.groundTruthMask,
      }),
    });
    return safeParseJson<ModelComparisonResponse>(res, 'Model comparison failed');
  },

  // 7. Ground Truth Evaluation
  async evaluate(predictedMask: string, groundTruthMask: string): Promise<EvaluationMetrics> {
    const res = await fetch(`${API_BASE}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        predicted_mask: predictedMask,
        ground_truth_mask: groundTruthMask,
      }),
    });
    return safeParseJson<EvaluationMetrics>(res, 'Evaluation failed');
  },

  // 8. Research Logs
  async getLogs(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/logs`);
    return safeParseJson<any[]>(res, 'Failed to fetch research logs');
  },
};
