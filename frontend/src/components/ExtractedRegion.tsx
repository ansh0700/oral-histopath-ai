import React, { useState } from 'react';
import {
  Crop,
  Download,
  Image as ImageIcon,
  Maximize2,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle2,
  Columns,
  Sparkles,
  Scissors
} from 'lucide-react';

interface ExtractedRegionProps {
  cropUrl?: string | null;
  cutoutUrl?: string | null;
  cropBase64?: string | null;
  cutoutBase64?: string | null;
  bbox?: [number, number, number, number] | null;
  areaPixels?: number | null;
  hasSelection?: boolean;
  onExtract?: () => void;
  isProcessing?: boolean;
}

export const ExtractedRegion: React.FC<ExtractedRegionProps> = React.memo(({
  cropUrl,
  cutoutUrl,
  cropBase64,
  cutoutBase64,
  bbox,
  areaPixels,
  hasSelection = false,
  onExtract,
  isProcessing = false,
}) => {
  const displayCrop = cropBase64 || cropUrl;
  const displayCutout = cutoutBase64 || cutoutUrl;

  // Modal / Lightbox State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalViewMode, setModalViewMode] = useState<'crop' | 'cutout' | 'split'>('split');
  const [modalZoom, setModalZoom] = useState<number>(2.0);
  const [bgStyle, setBgStyle] = useState<'checker' | 'dark' | 'white'>('checker');

  const downloadImage = (url: string, filename: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const openPreview = (initialMode: 'crop' | 'cutout' | 'split') => {
    setModalViewMode(initialMode);
    setModalZoom(2.5);
    setIsModalOpen(true);
  };

  return (
    <>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl space-y-3.5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="flex items-center space-x-2 text-cyan-400">
            <Crop className="w-4 h-4" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-100">
              Manual Region Extraction
            </h3>
          </div>
          {displayCrop && (
            <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/40 flex items-center space-x-1">
              <CheckCircle2 className="w-2.5 h-2.5" />
              <span>Extracted</span>
            </span>
          )}
        </div>

        {!displayCrop && !displayCutout ? (
          <div className="py-6 text-center text-slate-500 text-xs space-y-3">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 inline-block">
              <Scissors className="w-6 h-6 text-cyan-400 opacity-80" />
            </div>
            {hasSelection ? (
              <div className="space-y-2">
                <p className="text-slate-300 font-semibold">Selection Active & Ready</p>
                {bbox && (
                  <p className="text-[11px] font-mono text-slate-400">
                    BBox: [{bbox.join(', ')}] • {areaPixels ? `${areaPixels.toLocaleString()} px` : ''}
                  </p>
                )}
                {onExtract && (
                  <button
                    onClick={onExtract}
                    disabled={isProcessing}
                    className="mt-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-md transition-colors"
                  >
                    Extract Region Now
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-slate-400">No active selection.</p>
                <p className="text-[11px] text-slate-600">
                  Select a region using <strong className="text-slate-400">FREE SELECT</strong> or <strong className="text-slate-400">ADD BRUSH</strong>, then click <strong className="text-slate-400">EXTRACT REGION</strong>.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Metadata Bar & Inspect Fullscreen Trigger */}
            <div className="flex items-center justify-between text-[11px] font-mono bg-slate-950 p-2 rounded-lg border border-slate-800 text-slate-400">
              <div>
                <span>BBox: [{bbox?.join(', ')}]</span>
                <span className="mx-2">•</span>
                <span className="text-emerald-400 font-bold">{areaPixels?.toLocaleString()} px</span>
              </div>
              <button
                onClick={() => openPreview('split')}
                className="flex items-center space-x-1 px-2 py-0.5 rounded bg-medical-950 text-medical-300 hover:bg-medical-900 border border-medical-800/60 text-[10px] font-sans font-semibold transition-colors"
                title="Open interactive high-res preview"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Inspect HD</span>
              </button>
            </div>

            {/* Grid of 2 outputs */}
            <div className="grid grid-cols-2 gap-3">
              {/* OUTPUT 1: Bounding Box Crop */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-300">
                    1. RGB Color Crop
                  </span>
                  {displayCrop && (
                    <button
                      onClick={(e) => downloadImage(displayCrop, 'he_color_crop.png', e)}
                      className="text-slate-400 hover:text-slate-200 p-1 hover:bg-slate-800 rounded transition-colors"
                      title="Download RGB Crop"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div
                  onClick={() => openPreview('crop')}
                  className="group relative aspect-square bg-slate-950 rounded-lg border border-slate-800 hover:border-cyan-500/60 overflow-hidden flex items-center justify-center p-1.5 cursor-pointer transition-all shadow-inner"
                  title="Click to view full-resolution preview"
                >
                  {displayCrop ? (
                    <>
                      <img
                        src={displayCrop}
                        alt="Original Color Crop"
                        className="max-w-full max-h-full object-contain rounded transition-transform group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-1.5 text-xs text-white font-medium">
                        <ZoomIn className="w-4 h-4 text-cyan-400" />
                        <span>Inspect HD</span>
                      </div>
                    </>
                  ) : (
                    <span className="text-[10px] text-slate-600">Pending</span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Uncompressed original H&E colors.
                </p>
              </div>

              {/* OUTPUT 2: Object Cutout */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-300">
                    2. Exact Cutout (RGBA)
                  </span>
                  {displayCutout && (
                    <button
                      onClick={(e) => downloadImage(displayCutout, 'he_object_cutout.png', e)}
                      className="text-slate-400 hover:text-slate-200 p-1 hover:bg-slate-800 rounded transition-colors"
                      title="Download Transparent Cutout"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div
                  onClick={() => openPreview('cutout')}
                  className="group relative aspect-square rounded-lg border border-slate-800 hover:border-emerald-500/60 overflow-hidden flex items-center justify-center p-1.5 cursor-pointer transition-all shadow-inner"
                  style={{
                    backgroundImage: `linear-gradient(45deg, #1e293b 25%, transparent 25%), linear-gradient(-45deg, #1e293b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1e293b 75%), linear-gradient(-45deg, transparent 75%, #1e293b 75%)`,
                    backgroundSize: '10px 10px',
                    backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px',
                    backgroundColor: '#0f172a',
                  }}
                  title="Click to view full-resolution transparent cutout"
                >
                  {displayCutout ? (
                    <>
                      <img
                        src={displayCutout}
                        alt="Object Cutout"
                        className="max-w-full max-h-full object-contain transition-transform group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-1.5 text-xs text-white font-medium">
                        <ZoomIn className="w-4 h-4 text-emerald-400" />
                        <span>Inspect HD</span>
                      </div>
                    </>
                  ) : (
                    <span className="text-[10px] text-slate-600">Pending</span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Transparent background clipped to polygon.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* INTERACTIVE HIGH-RESOLUTION LIGHTBOX PREVIEW MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col p-4 sm:p-6 animate-in fade-in duration-150">
          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl mb-3 shadow-2xl shrink-0">
            <div className="flex items-center space-x-3">
              <div className="p-1.5 bg-cyan-950 border border-cyan-700/60 rounded-lg text-cyan-400">
                <Crop className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                  <span>High-Resolution Morphological Inspection</span>
                  {bbox && (
                    <span className="text-[11px] font-mono text-slate-400 font-normal">
                      [{bbox.join(', ')}] • {areaPixels?.toLocaleString()} px
                    </span>
                  )}
                </h2>
                <p className="text-[11px] text-slate-400">
                  Magnified cellular & nuclear H&E optical structure inspector
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
                <button
                  onClick={() => setModalViewMode('split')}
                  className={`flex items-center space-x-1.5 px-3 py-1 rounded-md font-semibold transition-all ${
                    modalViewMode === 'split'
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span>Side-by-Side</span>
                </button>
                <button
                  onClick={() => setModalViewMode('crop')}
                  className={`flex items-center space-x-1.5 px-3 py-1 rounded-md font-semibold transition-all ${
                    modalViewMode === 'crop'
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>1. RGB Crop</span>
                </button>
                <button
                  onClick={() => setModalViewMode('cutout')}
                  className={`flex items-center space-x-1.5 px-3 py-1 rounded-md font-semibold transition-all ${
                    modalViewMode === 'cutout'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>2. Isolated Cutout</span>
                </button>
              </div>

              <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                <span className="text-[10px] text-slate-500 px-1">BG:</span>
                <button
                  onClick={() => setBgStyle('checker')}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    bgStyle === 'checker' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Grid
                </button>
                <button
                  onClick={() => setBgStyle('dark')}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    bgStyle === 'dark' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Dark
                </button>
                <button
                  onClick={() => setBgStyle('white')}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    bgStyle === 'white' ? 'bg-slate-200 text-slate-900' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  White
                </button>
              </div>

              <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                <button
                  onClick={() => setModalZoom((z) => Math.max(0.5, Number((z * 0.8).toFixed(1))))}
                  className="p-1 rounded text-slate-400 hover:text-slate-200"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-slate-200 font-bold px-1.5">
                  {Math.round(modalZoom * 100)}%
                </span>
                <button
                  onClick={() => setModalZoom((z) => Math.min(16.0, Number((z * 1.25).toFixed(1))))}
                  className="p-1 rounded text-slate-400 hover:text-slate-200"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setModalZoom(1.0)}
                  className="p-1 rounded text-slate-400 hover:text-slate-200 ml-1"
                  title="Reset to 100% 1:1"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>

              {displayCrop && (
                <button
                  onClick={(e) => downloadImage(displayCrop, 'he_color_crop.png', e)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                  title="Download Crop"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-700 transition-colors ml-2"
                title="Close Inspection Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden relative flex items-center justify-center p-6 shadow-2xl">
            {modalViewMode === 'split' ? (
              <div className="grid grid-cols-2 gap-6 w-full h-full">
                <div className="flex flex-col h-full bg-slate-900/60 rounded-xl border border-slate-800/80 overflow-hidden">
                  <div className="px-3 py-1.5 bg-slate-950/80 border-b border-slate-800 text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                    <span>1. Original Color H&E Crop (Uncompressed)</span>
                    {displayCrop && (
                      <button
                        onClick={(e) => downloadImage(displayCrop, 'he_color_crop.png', e)}
                        className="text-slate-400 hover:text-slate-200 flex items-center space-x-1"
                      >
                        <Download className="w-3 h-3" />
                        <span className="text-[10px]">Save</span>
                      </button>
                    )}
                  </div>
                  <div className="flex-1 overflow-auto flex items-center justify-center p-4">
                    {displayCrop && (
                      <img
                        src={displayCrop}
                        alt="Original Crop"
                        style={{ transform: `scale(${modalZoom})`, imageRendering: modalZoom > 3 ? 'pixelated' : 'auto' }}
                        className="max-w-[85%] max-h-[85%] object-contain rounded-lg shadow-2xl transition-transform"
                      />
                    )}
                  </div>
                </div>

                <div className="flex flex-col h-full bg-slate-900/60 rounded-xl border border-slate-800/80 overflow-hidden">
                  <div className="px-3 py-1.5 bg-slate-950/80 border-b border-slate-800 text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                    <span>2. Exact Transparent Object Cutout</span>
                    {displayCutout && (
                      <button
                        onClick={(e) => downloadImage(displayCutout, 'he_cutout.png', e)}
                        className="text-slate-400 hover:text-slate-200 flex items-center space-x-1"
                      >
                        <Download className="w-3 h-3" />
                        <span className="text-[10px]">Save</span>
                      </button>
                    )}
                  </div>
                  <div
                    className="flex-1 overflow-auto flex items-center justify-center p-4"
                    style={{
                      backgroundImage:
                        bgStyle === 'checker'
                          ? `linear-gradient(45deg, #1e293b 25%, transparent 25%), linear-gradient(-45deg, #1e293b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1e293b 75%), linear-gradient(-45deg, transparent 75%, #1e293b 75%)`
                          : 'none',
                      backgroundSize: '16px 16px',
                      backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                      backgroundColor: bgStyle === 'white' ? '#f8fafc' : bgStyle === 'dark' ? '#090d16' : '#0f172a',
                    }}
                  >
                    {displayCutout && (
                      <img
                        src={displayCutout}
                        alt="Cutout"
                        style={{ transform: `scale(${modalZoom})`, imageRendering: modalZoom > 3 ? 'pixelated' : 'auto' }}
                        className="max-w-[85%] max-h-[85%] object-contain rounded-lg shadow-2xl transition-transform"
                      />
                    )}
                  </div>
                </div>
              </div>
            ) : modalViewMode === 'crop' ? (
              <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
                {displayCrop && (
                  <img
                    src={displayCrop}
                    alt="Original Crop"
                    style={{ transform: `scale(${modalZoom})`, imageRendering: modalZoom > 3 ? 'pixelated' : 'auto' }}
                    className="max-w-[85%] max-h-[85%] object-contain rounded-lg shadow-2xl transition-transform"
                  />
                )}
              </div>
            ) : (
              <div
                className="w-full h-full overflow-auto flex items-center justify-center p-4 rounded-xl"
                style={{
                  backgroundImage:
                    bgStyle === 'checker'
                      ? `linear-gradient(45deg, #1e293b 25%, transparent 25%), linear-gradient(-45deg, #1e293b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1e293b 75%), linear-gradient(-45deg, transparent 75%, #1e293b 75%)`
                      : 'none',
                  backgroundSize: '16px 16px',
                  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                  backgroundColor: bgStyle === 'white' ? '#f8fafc' : bgStyle === 'dark' ? '#090d16' : '#0f172a',
                }}
              >
                {displayCutout && (
                  <img
                    src={displayCutout}
                    alt="Cutout"
                    style={{ transform: `scale(${modalZoom})`, imageRendering: modalZoom > 3 ? 'pixelated' : 'auto' }}
                    className="max-w-[85%] max-h-[85%] object-contain rounded-lg shadow-2xl transition-transform"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
});
