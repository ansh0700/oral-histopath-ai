import React from 'react';
import {
  Activity,
  Microscope,
  BookOpen,
  ShieldAlert,
  Percent,
  CircleDot,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import { AnalysisResponse } from '../types/analysis';

interface AnalysisPanelProps {
  analysis?: AnalysisResponse | null;
  inferenceTimeMs?: number | null;
  modelUsed?: string | null;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = React.memo(({
  analysis,
  inferenceTimeMs,
  modelUsed,
}) => {
  if (!analysis) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl text-center py-10 space-y-2 text-slate-500 text-xs">
        <Microscope className="w-8 h-8 mx-auto text-slate-600 opacity-50" />
        <p>No morphological analysis available.</p>
        <p className="text-[11px] text-slate-600">
          Select or paint a cellular region and extract it to compute geometric measurements and grounded WHO criteria explanations.
        </p>
      </div>
    );
  }

  const { measurements, feature, feature_category, explanation } = analysis;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center space-x-2 text-medical-400">
          <Activity className="w-4 h-4" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-100">
            Morphological & Stain Analysis
          </h3>
        </div>

        {inferenceTimeMs && (
          <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
            Latency: {inferenceTimeMs} ms
          </span>
        )}
      </div>

      {/* Feature Classification Badge */}
      <div className="p-3 bg-gradient-to-br from-slate-950 to-slate-900 rounded-lg border border-slate-800 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            WHO Criteria Classification
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-medical-950 text-medical-300 border border-medical-800/50">
            {feature_category}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-bold text-sm text-slate-100">{feature}</span>
          <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
            Quantitative Rule Match
          </span>
        </div>
      </div>

      {/* Morphological Metrics Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Quantitative Measurements
          </h4>
          <span className="text-[10px] text-slate-500 font-mono">0.5 µm/px</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 bg-slate-950 rounded-lg border border-slate-800/80">
            <span className="text-slate-500 text-[10px] block">Area</span>
            <span className="font-mono font-semibold text-slate-200">
              {measurements.area_pixels.toLocaleString()} px
            </span>
            {measurements.area_microns_sq && (
              <span className="text-[10px] text-slate-400 block font-mono">
                {measurements.area_microns_sq} µm²
              </span>
            )}
          </div>

          <div className="p-2 bg-slate-950 rounded-lg border border-slate-800/80">
            <span className="text-slate-500 text-[10px] block">Perimeter</span>
            <span className="font-mono font-semibold text-slate-200">
              {measurements.perimeter_pixels} px
            </span>
            {measurements.perimeter_microns && (
              <span className="text-[10px] text-slate-400 block font-mono">
                {measurements.perimeter_microns} µm
              </span>
            )}
          </div>

          <div className="p-2 bg-slate-950 rounded-lg border border-slate-800/80">
            <span className="text-slate-500 text-[10px] block">Circularity (0-1)</span>
            <span className="font-mono font-semibold text-slate-200">
              {measurements.circularity.toFixed(3)}
            </span>
            <span className="text-[10px] text-slate-500 block">
              {measurements.circularity > 0.75 ? 'Smooth / Round' : 'Irregular Contour'}
            </span>
          </div>

          <div className="p-2 bg-slate-950 rounded-lg border border-slate-800/80">
            <span className="text-slate-500 text-[10px] block">Solidity</span>
            <span className="font-mono font-semibold text-slate-200">
              {measurements.solidity.toFixed(3)}
            </span>
            <span className="text-[10px] text-slate-500 block">
              Aspect Ratio: {measurements.aspect_ratio.toFixed(2)}
            </span>
          </div>

          <div className="p-2 bg-slate-950 rounded-lg border border-slate-800/80">
            <span className="text-slate-500 text-[10px] block">Hematoxylin OD</span>
            <span className="font-mono font-semibold text-purple-300">
              {measurements.hematoxylin_optical_density.toFixed(3)}
            </span>
            <span className="text-[10px] text-slate-500 block">
              {measurements.hematoxylin_optical_density >= 0.35 ? 'Hyperchromatic' : 'Baseline Absorption'}
            </span>
          </div>

          <div className="p-2 bg-slate-950 rounded-lg border border-slate-800/80">
            <span className="text-slate-500 text-[10px] block">Eosin OD</span>
            <span className="font-mono font-semibold text-pink-300">
              {measurements.eosin_optical_density.toFixed(3)}
            </span>
            <span className="text-[10px] text-slate-500 block">
              Stain Ratio (H/E): {measurements.stain_ratio.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Grounded Educational Explanation */}
      <div className="space-y-1.5 p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-300">
        <div className="flex items-center space-x-1.5 text-medical-400 font-bold text-[11px] uppercase tracking-wider">
          <BookOpen className="w-3.5 h-3.5" />
          <span>Grounded Educational Reference</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
          {explanation}
        </p>
      </div>
    </div>
  );
});
