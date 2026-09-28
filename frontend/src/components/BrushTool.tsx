import React from 'react';
import {
  Scissors,
  Circle,
  Sparkles,
  Waves,
  Edit3,
  Paintbrush,
  Eraser,
  Hand,
  Undo2,
  Redo2,
  Trash2,
  Crop,
  CheckCircle2,
  PlusCircle,
  XCircle,
} from 'lucide-react';
import { BrushMode, LineStyle } from '../types/segmentation';

interface BrushToolProps {
  mode: BrushMode;
  setMode: (mode: BrushMode) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
  strokeWidth: number;
  setStrokeWidth: (width: number) => void;
  lineStyle?: LineStyle;
  setLineStyle?: (style: LineStyle) => void;
  maskOpacity: number;
  setMaskOpacity: (opacity: number) => void;
  showOriginal: boolean;
  setShowOriginal: (show: boolean) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onConfirmSelection: () => void;
  onExtract: () => void;
  isProcessing: boolean;
  hasSelection: boolean;
  isConfirmed: boolean;
  selectedVertexIndex: number | null;
  onAddVertex?: () => void;
  onDeleteSelectedVertex: () => void;
  onSmoothContour?: () => void;
  onTrimSpikes?: () => void;
  vertexCount: number;
}

const BRUSH_SIZE_PRESETS = [2, 5, 10, 20, 40, 80];
const STROKE_WIDTH_PRESETS = [
  { label: '1px (Hairline)', val: 1.0 },
  { label: '1.5px (Fine)', val: 1.5 },
  { label: '2px (Medium)', val: 2.0 },
  { label: '3px (Bold)', val: 3.0 },
  { label: '5px (Extra Bold)', val: 5.0 },
  { label: '8px (Thick)', val: 8.0 },
  { label: '12px (Heavy)', val: 12.0 },
  { label: '20px (Ultra Heavy)', val: 20.0 },
];

export const BrushTool: React.FC<BrushToolProps> = React.memo(({
  mode,
  setMode,
  brushSize,
  setBrushSize,
  strokeWidth,
  setStrokeWidth,
  lineStyle = 'dotted',
  setLineStyle,
  maskOpacity,
  setMaskOpacity,
  showOriginal,
  setShowOriginal,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  onConfirmSelection,
  onExtract,
  isProcessing,
  hasSelection,
  isConfirmed,
  selectedVertexIndex,
  onAddVertex,
  onDeleteSelectedVertex,
  onSmoothContour,
  onTrimSpikes,
  vertexCount,
}) => {
  return (
    <div className="bg-slate-900/95 backdrop-blur border border-slate-800 rounded-xl p-3 shadow-xl space-y-3">
      {/* 1. Main Tool Selection & History Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Tool Mode Buttons */}
        <div className="flex items-center space-x-2">
          <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
            {/* 1. FREE SELECT (Freehand Drawing) */}
            <button
              onClick={() => setMode('FREE_SELECT')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                mode === 'FREE_SELECT'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title="FREE SELECT — Freely drag around any biological shape to create a selection"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>FREE SELECT</span>
            </button>

            {/* 2. CIRCLE / ELLIPSE ROI */}
            <button
              onClick={() => setMode('CIRCLE')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                mode === 'CIRCLE'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title="CIRCLE / ELLIPSE — Drag to create a smooth circular or oval nucleus ROI"
            >
              <Circle className="w-3.5 h-3.5" />
              <span>CIRCLE</span>
            </button>

            {/* 3. RESHAPE / SCULPT (Direct Contour Reshaping) */}
            <button
              onClick={() => setMode('RESHAPE')}
              disabled={!hasSelection}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all disabled:opacity-30 ${
                mode === 'RESHAPE'
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-900/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title="RESHAPE / SCULPT — Drag boundary edge to smoothly push/pull the whole curve, or draw a stroke across the boundary to reshape it"
            >
              <Waves className="w-3.5 h-3.5" />
              <span>RESHAPE</span>
            </button>

            {/* 4. EDIT VERTICES (Optional Point Control) */}
            <button
              onClick={() => setMode(mode === 'EDIT_VERTICES' ? 'FREE_SELECT' : 'EDIT_VERTICES')}
              disabled={!hasSelection}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all disabled:opacity-30 ${
                mode === 'EDIT_VERTICES'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-900/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title="EDIT VERTICES — Point-by-point vertex editing"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>VERTICES</span>
            </button>

            {/* 5. ADD BRUSH */}
            <button
              onClick={() => setMode('ADD')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                mode === 'ADD'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title="ADD BRUSH — Paint to expand the selection"
            >
              <Paintbrush className="w-3.5 h-3.5" />
              <span>ADD</span>
            </button>

            {/* 6. ERASE BRUSH */}
            <button
              onClick={() => setMode('ERASE')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                mode === 'ERASE'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-900/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title="ERASE BRUSH — Paint to subtract from selection"
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>ERASE</span>
            </button>

            {/* 7. PAN TOOL */}
            <button
              onClick={() => setMode('PAN')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                mode === 'PAN'
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title="PAN TOOL — Move viewport freely (or hold Spacebar + drag)"
            >
              <Hand className="w-3.5 h-3.5" />
              <span>PAN</span>
            </button>
          </div>

          {/* History Controls */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-30 transition-colors"
              title="Undo action"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-30 transition-colors"
              title="Redo action"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Shape Refinement & Action Buttons */}
        <div className="flex items-center space-x-2">
          {/* Smooth / Relax Contour Action Button */}
          {hasSelection && onSmoothContour && (
            <button
              onClick={onSmoothContour}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 text-xs font-semibold rounded-lg border border-indigo-700/80 shadow-sm transition-all"
              title="Smooth Curve — Removes hand jitter and makes the boundary silky smooth"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Smooth Curve</span>
            </button>
          )}

          {/* 1-Click Trim Spikes & Hairpin Loops Action Button */}
          {hasSelection && onTrimSpikes && (
            <button
              onClick={onTrimSpikes}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 text-xs font-semibold rounded-lg border border-rose-800/80 shadow-sm transition-all"
              title="Trim Spikes — Instantly clips sharp needle protrusions and hairpin loops from boundary"
            >
              <Scissors className="w-3.5 h-3.5 text-rose-400" />
              <span>Trim Spikes</span>
            </button>
          )}

          {/* Vertex Editing Buttons (When in EDIT_VERTICES mode) */}
          {mode === 'EDIT_VERTICES' && hasSelection && onAddVertex && (
            <button
              onClick={onAddVertex}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-950/90 hover:bg-emerald-900 text-emerald-300 text-xs font-semibold rounded-lg border border-emerald-700/80 shadow-sm transition-all"
              title="Add a new point along the boundary"
            >
              <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Add Point</span>
            </button>
          )}

          {mode === 'EDIT_VERTICES' && selectedVertexIndex !== null && vertexCount > 3 && (
            <button
              onClick={onDeleteSelectedVertex}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-950/90 hover:bg-rose-900 text-rose-300 text-xs font-semibold rounded-lg border border-rose-800/80 shadow-sm transition-all"
              title="Delete the currently selected boundary point (or press Delete/Backspace)"
            >
              <XCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>Delete Point</span>
            </button>
          )}

          <button
            onClick={onClear}
            disabled={!hasSelection}
            className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-950 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 disabled:opacity-30 text-xs font-semibold rounded-lg border border-slate-800 transition-colors"
            title="Explicitly clear current selection"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* 2. Mode-Specific Hint, Line Thickness & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 text-xs pt-1 border-t border-slate-800/80">
        {mode === 'FREE_SELECT' ? (
          <div className="flex items-center space-x-2 text-slate-400 text-[11px]">
            <span className="text-cyan-400 font-semibold">Freehand Select:</span>
            <span>Drag cursor around any cell/nucleus shape • Release to close loop</span>
          </div>
        ) : mode === 'CIRCLE' ? (
          <div className="flex items-center space-x-2 text-slate-400 text-[11px]">
            <span className="text-indigo-400 font-semibold">Circle / Ellipse ROI:</span>
            <span>Click and drag to draw a smooth circular or oval cell ROI</span>
          </div>
        ) : mode === 'RESHAPE' ? (
          <div className="flex items-center space-x-2 text-slate-400 text-[11px]">
            <span className="text-teal-400 font-semibold">Reshape / Sculpt:</span>
            <span>Drag boundary to smoothly push/pull curve • Or draw across boundary to reshape</span>
          </div>
        ) : mode === 'EDIT_VERTICES' ? (
          <div className="flex items-center space-x-2 text-slate-400 text-[11px]">
            <span className="text-amber-400 font-semibold">Vertex Edit Mode:</span>
            <span>Drag boundary points (🟠) • Click [Add Point] to insert • Select & delete point</span>
          </div>
        ) : (mode === 'ADD' || mode === 'ERASE') ? (
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-medium">Brush Size:</span>
            <div className="flex items-center space-x-1">
              {BRUSH_SIZE_PRESETS.map((sz) => (
                <button
                  key={sz}
                  onClick={() => setBrushSize(sz)}
                  className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
                    brushSize === sz
                      ? 'bg-slate-700 text-white font-bold'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {sz}px
                </button>
              ))}
            </div>
            <input
              type="range"
              min="1"
              max="100"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-20 accent-medical-500 cursor-pointer"
            />
            <span className="font-mono text-slate-300 w-8">{brushSize}px</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2 text-slate-400 text-[11px]">
            <span className="text-sky-400 font-semibold">Pan Mode:</span>
            <span>Click and drag to pan viewport • Use mouse wheel to zoom</span>
          </div>
        )}

        <div className="flex items-center space-x-4">
          {/* Line Thickness Control */}
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-400 font-medium text-[11px]">Line Width:</span>
            <div className="flex items-center space-x-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
              <button
                onClick={() => setStrokeWidth(Math.max(0.5, Math.round((strokeWidth <= 3 ? strokeWidth - 0.5 : strokeWidth - 1) * 10) / 10))}
                className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold flex items-center justify-center border border-slate-700 transition-transform active:scale-95"
                title="Decrease Line Width (-0.5px)"
              >
                -
              </button>
              <span className="font-mono text-xs font-bold px-1 text-cyan-300 min-w-[36px] text-center">
                {strokeWidth}px
              </span>
              <button
                onClick={() => setStrokeWidth(Math.min(100, Math.round((strokeWidth < 3 ? strokeWidth + 0.5 : strokeWidth + 1) * 10) / 10))}
                className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold flex items-center justify-center border border-slate-700 transition-transform active:scale-95"
                title="Increase Line Width (+0.5px)"
              >
                +
              </button>
              <div className="h-4 w-px bg-slate-800 mx-0.5" />
              {STROKE_WIDTH_PRESETS.map((sw) => (
                <button
                  key={sw.val}
                  onClick={() => setStrokeWidth(sw.val)}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono transition-colors ${
                    strokeWidth === sw.val
                      ? 'bg-cyan-600 text-white font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title={sw.label}
                >
                  {sw.val}px
                </button>
              ))}
            </div>
          </div>

          {/* Opacity Control */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-medium text-[11px]">Opacity:</span>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={maskOpacity}
              onChange={(e) => setMaskOpacity(Number(e.target.value))}
              className="w-16 accent-medical-500 cursor-pointer"
            />
            <span className="font-mono text-slate-300 text-[11px] w-7">{Math.round(maskOpacity * 100)}%</span>
          </div>
        </div>
      </div>

      {/* 3. Action Buttons: Confirm & Extract */}
      <div className="flex items-center space-x-2 pt-2 border-t border-slate-800/80">
        <button
          onClick={onConfirmSelection}
          disabled={!hasSelection || isProcessing}
          className={`flex-1 flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold border transition-all ${
            isConfirmed
              ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-inner'
              : hasSelection
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-950 ring-2 ring-emerald-400/30 font-bold'
              : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
          }`}
          title={
            isConfirmed
              ? 'Region locked! Now draw around another cell to create the next selection.'
              : 'Click to lock and confirm this selection before drawing the next one'
          }
        >
          <CheckCircle2 className={`w-4 h-4 ${isConfirmed ? 'text-emerald-400' : hasSelection ? 'text-white' : 'text-slate-500'}`} />
          <span>{isConfirmed ? '✓ CONFIRMED (Ready for Next Cell)' : 'CONFIRM SELECTION'}</span>
        </button>

        <button
          onClick={onExtract}
          disabled={!hasSelection || isProcessing}
          className="flex-1 flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg shadow-md shadow-emerald-950 disabled:opacity-40 transition-colors"
          title="Extract original color H&E crop and transparent object cutout"
        >
          <Crop className="w-4 h-4" />
          <span>EXTRACT REGION</span>
        </button>
      </div>
    </div>
  );
});
