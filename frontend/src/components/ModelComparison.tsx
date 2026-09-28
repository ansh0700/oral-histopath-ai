import React, { useState } from 'react';
import {
  GitCompare,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  Eye,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import { ModelComparisonResponse, SingleModelComparisonResult } from '../types/comparison';

interface ModelComparisonProps {
  comparisonData: ModelComparisonResponse | null;
  onClose: () => void;
}

export const ModelComparison: React.FC<ModelComparisonProps> = ({
  comparisonData,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'MASKS' | 'CROPS' | 'METRICS'>('METRICS');

  if (!comparisonData) return null;

  const { results, ground_truth_available, evaluation_summary } = comparisonData;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-2 text-indigo-400">
            <GitCompare className="w-5 h-5" />
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Multi-Model Oral Histopathology Benchmark Comparison
              </h2>
              <p className="text-xs text-slate-400">
                Identical Region & Prompt evaluated across candidate AI models
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Tab switchers */}
            <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setActiveTab('METRICS')}
                className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                  activeTab === 'METRICS'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Compare Metrics
              </button>
              <button
                onClick={() => setActiveTab('CROPS')}
                className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                  activeTab === 'CROPS'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Compare Crops
              </button>
              <button
                onClick={() => setActiveTab('MASKS')}
                className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                  activeTab === 'MASKS'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Compare Cutouts
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Evaluation Warning Banner if Ground Truth is Missing */}
        {!ground_truth_available && (
          <div className="px-4 py-2 bg-amber-950/40 border-b border-amber-500/20 text-amber-300 text-xs flex items-center space-x-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Ground truth unavailable for this sample — quantitative segmentation metrics (Dice, IoU, Precision, Recall) cannot be calculated.
            </span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* TAB 1: METRICS BENCHMARK TABLE */}
          {activeTab === 'METRICS' && (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="p-3">Model</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Prompt Interaction</th>
                      <th className="p-3 text-right">Inference Latency</th>
                      <th className="p-3 text-right">Dice Score</th>
                      <th className="p-3 text-right">IoU (Jaccard)</th>
                      <th className="p-3 text-right">Precision</th>
                      <th className="p-3 text-right">Recall</th>
                      <th className="p-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-900/50 text-slate-200">
                    {results.map((res) => {
                      const isReady = res.status === 'READY';
                      return (
                        <tr key={res.model_id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 font-semibold text-slate-100 flex items-center space-x-2">
                            <span>{res.model_name}</span>
                          </td>
                          <td className="p-3">
                            {isReady ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-500/30 font-semibold">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                <span>READY</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-950/60 text-amber-300 border border-amber-500/30 font-semibold">
                                <AlertCircle className="w-2.5 h-2.5" />
                                <span>NOT CONFIGURED</span>
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-slate-400 font-mono text-[11px]">
                            {res.supported_prompt_used}
                          </td>
                          <td className="p-3 text-right font-mono font-semibold text-cyan-300">
                            {res.inference_time_ms ? `${res.inference_time_ms} ms` : '—'}
                          </td>
                          <td className="p-3 text-right font-mono font-semibold text-emerald-300">
                            {res.dice !== null && res.dice !== undefined ? res.dice.toFixed(4) : '—'}
                          </td>
                          <td className="p-3 text-right font-mono font-semibold text-emerald-300">
                            {res.iou !== null && res.iou !== undefined ? res.iou.toFixed(4) : '—'}
                          </td>
                          <td className="p-3 text-right font-mono text-slate-300">
                            {res.precision !== null && res.precision !== undefined ? res.precision.toFixed(4) : '—'}
                          </td>
                          <td className="p-3 text-right font-mono text-slate-300">
                            {res.recall !== null && res.recall !== undefined ? res.recall.toFixed(4) : '—'}
                          </td>
                          <td className="p-3 text-slate-400 text-[11px] max-w-xs truncate" title={res.notes || ''}>
                            {res.notes || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2 & 3: CROPS & CUTOUTS GRID */}
          {(activeTab === 'CROPS' || activeTab === 'MASKS') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {results.map((res) => {
                const isReady = res.status === 'READY';
                const imgDisplay = activeTab === 'CROPS' ? res.crop_url : res.cutout_url;

                return (
                  <div
                    key={res.model_id}
                    className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5 flex flex-col"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-100">{res.model_name}</span>
                      {isReady ? (
                        <span className="text-[10px] font-mono text-emerald-400">READY</span>
                      ) : (
                        <span className="text-[10px] font-mono text-amber-400">NOT CONFIGURED</span>
                      )}
                    </div>

                    <div
                      className="relative aspect-square rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center p-1"
                      style={
                        activeTab === 'MASKS'
                          ? {
                              backgroundImage: `linear-gradient(45deg, #1e293b 25%, transparent 25%), linear-gradient(-45deg, #1e293b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1e293b 75%), linear-gradient(-45deg, transparent 75%, #1e293b 75%)`,
                              backgroundSize: '12px 12px',
                              backgroundColor: '#0f172a',
                            }
                          : { backgroundColor: '#020617' }
                      }
                    >
                      {imgDisplay ? (
                        <img
                          src={imgDisplay}
                          alt={res.model_name}
                          className="max-w-full max-h-full object-contain rounded"
                        />
                      ) : (
                        <div className="text-center p-4 text-slate-600 text-xs space-y-1">
                          <AlertCircle className="w-6 h-6 mx-auto text-slate-700" />
                          <p>Output Unavailable</p>
                          <p className="text-[10px] text-slate-600">Model not configured with weights</p>
                        </div>
                      )}
                    </div>

                    <div className="pt-1 text-[11px] text-slate-400 font-mono flex items-center justify-between border-t border-slate-900 mt-auto">
                      <span>Latency: {res.inference_time_ms ? `${res.inference_time_ms} ms` : 'N/A'}</span>
                      {res.dice !== null && res.dice !== undefined && (
                        <span className="text-emerald-400">Dice: {res.dice.toFixed(3)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
