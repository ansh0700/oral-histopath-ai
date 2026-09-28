import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  PlayCircle,
  Settings,
  Cpu,
  Check,
  Info,
  Sparkles
} from 'lucide-react';
import { ModelCapability } from '../types/model';

interface ModelSelectorProps {
  models: ModelCapability[];
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
  onTestModel: (modelId: string) => Promise<void>;
  onConfigureModel: (modelId: string, enabled: boolean, checkpoint?: string) => Promise<void>;
}

export const ModelSelector: React.FC<ModelSelectorProps> = React.memo(({
  models,
  selectedModelId,
  onSelectModel,
  onTestModel,
  onConfigureModel,
}) => {
  const [testingModelId, setTestingModelId] = useState<string | null>(null);
  const [configModalModel, setConfigModalModel] = useState<ModelCapability | null>(null);
  const [configCheckpoint, setConfigCheckpoint] = useState<string>('');
  const [configEnabled, setConfigEnabled] = useState<boolean>(false);

  const handleRunTest = async (modelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTestingModelId(modelId);
    try {
      await onTestModel(modelId);
    } finally {
      setTestingModelId(null);
    }
  };

  const openConfigModal = (m: ModelCapability, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfigModalModel(m);
    setConfigCheckpoint(m.checkpoint || '');
    setConfigEnabled(m.enabled);
  };

  const handleSaveConfig = async () => {
    if (!configModalModel) return;
    await onConfigureModel(configModalModel.id, configEnabled, configCheckpoint);
    setConfigModalModel(null);
  };

  const activeReadyModels = models.filter((m) => m.status === 'READY');

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 w-80 shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Cpu className="w-5 h-5 text-medical-500" />
          <h2 className="font-bold text-sm text-slate-100 uppercase tracking-wider">
            AI Segmentation Models
          </h2>
        </div>
        <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
          {activeReadyModels.length} Active Model{activeReadyModels.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Model Cards List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {models.map((model) => {
          const isSelected = selectedModelId === model.id;
          const isReady = model.status === 'READY';

          return (
            <div
              key={model.id}
              onClick={() => onSelectModel(model.id)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer relative ${
                isSelected
                  ? 'bg-slate-800/90 border-medical-500 shadow-md shadow-medical-950/50'
                  : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
              }`}
            >
              {/* Title & Status Badge */}
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border ${
                      isSelected
                        ? 'border-medical-400 bg-medical-500/20 text-medical-400'
                        : 'border-slate-700 bg-slate-800 text-transparent'
                    }`}
                  >
                    <Check className="w-2.5 h-2.5" />
                  </div>
                  <span className="font-semibold text-xs text-slate-100">
                    {model.name}
                  </span>
                </div>

                <div className="flex items-center space-x-1">
                  {isReady ? (
                    <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      <span>READY</span>
                    </span>
                  ) : (
                    <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono bg-amber-950/60 text-amber-300 border border-amber-500/30">
                      <AlertCircle className="w-2.5 h-2.5" />
                      <span>WEIGHTS REQUIRED</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-[11px] text-slate-400 leading-snug mb-2.5">
                {model.description}
              </p>

              {/* Capability Badges */}
              <div className="flex flex-wrap gap-1 mb-2.5">
                {model.supports_scribble_prompt && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-cyan-950/80 text-cyan-300 border border-cyan-800/40">
                    ✓ Scribble Brush
                  </span>
                )}
                {model.supports_point_prompt && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-950/80 text-indigo-300 border border-indigo-800/40">
                    ✓ Point Interaction
                  </span>
                )}
                {model.supports_box_prompt && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-950/80 text-purple-300 border border-purple-800/40">
                    ✓ Box ROI Constraint
                  </span>
                )}
                {model.supports_iterative_refinement && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-800/40">
                    ✓ Iterative Refine
                  </span>
                )}
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/70 text-[11px]">
                <span className="text-slate-500 font-mono text-[10px]">
                  Engine: PyTorch ({model.device.toUpperCase()})
                </span>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => handleRunTest(model.id, e)}
                    disabled={testingModelId === model.id}
                    className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                    title="Test model forward pass"
                  >
                    <PlayCircle
                      className={`w-3.5 h-3.5 ${
                        testingModelId === model.id ? 'animate-spin text-medical-400' : ''
                      }`}
                    />
                  </button>

                  <button
                    onClick={(e) => openConfigModal(model, e)}
                    className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                    title="Configure weights & checkpoint"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Informative Note */}
        <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl text-[11px] text-slate-400 space-y-1.5">
          <div className="flex items-center space-x-1.5 text-medical-400 font-semibold">
            <Info className="w-3.5 h-3.5" />
            <span>AI Architecture & Integrity</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            Only genuinely loaded neural architectures with verified weights are presented as <strong>READY</strong>. No simulated or mock models are active.
          </p>
        </div>
      </div>

      {/* Model Configuration Modal */}
      {configModalModel && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
              <Settings className="w-5 h-5 text-medical-500" />
              <span>Configure {configModalModel.name}</span>
            </h3>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="font-semibold text-slate-200">Enable Model</span>
                <input
                  type="checkbox"
                  checked={configEnabled}
                  onChange={(e) => setConfigEnabled(e.target.checked)}
                  className="w-4 h-4 accent-medical-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-400">
                  Checkpoint / Weights Path:
                </label>
                <input
                  type="text"
                  value={configCheckpoint}
                  onChange={(e) => setConfigCheckpoint(e.target.value)}
                  placeholder="e.g. weights/model.pth"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-medical-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Model only transitions to READY upon verifying genuine pretrained weights and successful test inference.
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setConfigModalModel(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfig}
                className="px-4 py-1.5 bg-medical-600 hover:bg-medical-500 text-white text-xs font-semibold rounded-lg"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
