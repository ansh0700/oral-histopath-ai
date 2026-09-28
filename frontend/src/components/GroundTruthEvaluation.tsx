import React from 'react';
import { Target, CheckCircle2, AlertCircle, Award } from 'lucide-react';
import { EvaluationMetrics } from '../types/analysis';

interface GroundTruthEvaluationProps {
  metrics?: EvaluationMetrics | null;
  groundTruthUrl?: string | null;
}

export const GroundTruthEvaluation: React.FC<GroundTruthEvaluationProps> = ({
  metrics,
  groundTruthUrl,
}) => {
  if (!groundTruthUrl) {
    return (
      <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-xs text-slate-500 flex items-center space-x-2">
        <AlertCircle className="w-4 h-4 text-slate-600 shrink-0" />
        <span>Ground truth annotations unavailable for this slide image.</span>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-xl space-y-2.5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center space-x-2 text-emerald-400">
          <Award className="w-4 h-4" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-100">
            Ground-Truth Evaluation (OPMD / OSCC)
          </h3>
        </div>
        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800/40">
          Verified Mask
        </span>
      </div>

      {metrics ? (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 text-center">
            <span className="text-slate-500 text-[10px] block">Dice Score</span>
            <span className="font-mono font-bold text-emerald-400 text-sm">
              {(metrics.dice * 100).toFixed(1)}%
            </span>
          </div>

          <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 text-center">
            <span className="text-slate-500 text-[10px] block">IoU (Jaccard)</span>
            <span className="font-mono font-bold text-cyan-400 text-sm">
              {(metrics.iou * 100).toFixed(1)}%
            </span>
          </div>

          <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 text-center">
            <span className="text-slate-500 text-[10px] block">F1 Score</span>
            <span className="font-mono font-bold text-indigo-400 text-sm">
              {(metrics.f1_score * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400">
          Run AI segmentation to compute Dice and IoU metrics against the pathologist ground-truth mask.
        </p>
      )}
    </div>
  );
};
