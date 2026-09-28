export interface ModelCapability {
  id: string;
  name: string;
  display_name: string;
  description: string;
  enabled: boolean;
  checkpoint: string;
  device: string;
  status: 'READY' | 'NOT CONFIGURED' | 'ERROR';
  status_detail?: string | null;
  supports_point_prompt: boolean;
  supports_box_prompt: boolean;
  supports_scribble_prompt: boolean;
  supports_mask_prompt: boolean;
  supports_iterative_refinement: boolean;
}

export interface ModelConfigRequest {
  model_id: string;
  enabled: boolean;
  checkpoint?: string;
  device?: string;
}
