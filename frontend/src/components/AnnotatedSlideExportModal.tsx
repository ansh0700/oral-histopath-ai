import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  X,
  Sparkles,
  Image as ImageIcon,
  Layers,
  Check,
  Palette,
  Type,
  Maximize2,
  FileCheck
} from 'lucide-react';
import { RegionObject } from '../types/region';
import { VectorSelection } from '../types/segmentation';
import {
  ExportSlideOptions,
  DEFAULT_EXPORT_OPTIONS,
  generateAnnotatedSlideCanvas,
  downloadAnnotatedSlide,
} from '../utils/exportSlide';

interface AnnotatedSlideExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  slideName: string;
  clinicalContext?: string;
  regions: RegionObject[];
  activeVectorSelection: VectorSelection | null;
  activeRegionId: string;
}

export const AnnotatedSlideExportModal: React.FC<AnnotatedSlideExportModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  imageWidth,
  imageHeight,
  slideName,
  clinicalContext,
  regions,
  activeVectorSelection,
  activeRegionId,
}) => {
  const [options, setOptions] = useState<ExportSlideOptions>({
    ...DEFAULT_EXPORT_OPTIONS,
    slideName,
    clinicalContext,
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  // Count valid marked regions
  const markedCount = regions.filter(
    (r) =>
      (r.id === activeRegionId && activeVectorSelection?.points && activeVectorSelection.points.length >= 3) ||
      (r.vectorSelection?.points && r.vectorSelection.points.length >= 3)
  ).length;

  // Generate live preview whenever options change
  useEffect(() => {
    if (!isOpen || !imageUrl) return;

    let isCancelled = false;
    setIsGenerating(true);

    generateAnnotatedSlideCanvas(
      imageUrl,
      imageWidth,
      imageHeight,
      regions,
      activeVectorSelection,
      activeRegionId,
      options
    )
      .then((canvas) => {
        if (!isCancelled) {
          setPreviewUrl(canvas.toDataURL('image/jpeg', 0.85));
          setIsGenerating(false);
        }
      })
      .catch((err) => {
        console.error('Failed generating preview:', err);
        if (!isCancelled) setIsGenerating(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, imageUrl, imageWidth, imageHeight, regions, activeVectorSelection, activeRegionId, options]);

  if (!isOpen) return null;

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      await downloadAnnotatedSlide(
        imageUrl,
        imageWidth,
        imageHeight,
        regions,
        activeVectorSelection,
        activeRegionId,
        options
      );
      setDownloadSuccess(true);
      setTimeout(() => {
        setDownloadSuccess(false);
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Failed downloading annotated slide:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 shadow-lg shadow-amber-500/20">
              <Download className="w-5 h-5 font-bold" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <span>Download Full Slide with ROI Marks</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                  {markedCount} {markedCount === 1 ? 'Mark' : 'Marks'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Export full high-resolution slide with your marked shape boundaries to explain and identify cells.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Live Preview (7 cols) */}
          <div className="lg:col-span-7 flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span>Full Image Preview</span>
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                {imageWidth} × {imageHeight} px
              </span>
            </div>

            <div className="relative flex-1 min-h-[300px] max-h-[440px] bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex items-center justify-center p-2">
              {isGenerating && (
                <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-10">
                  <div className="flex items-center space-x-2 text-xs text-amber-300">
                    <Sparkles className="w-4 h-4 animate-spin" />
                    <span>Rendering slide preview...</span>
                  </div>
                </div>
              )}

              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Annotated Slide Preview"
                  className="max-w-full max-h-full object-contain rounded-lg shadow-md"
                />
              ) : (
                <div className="text-xs text-slate-500">Generating preview...</div>
              )}
            </div>

            <p className="text-[11px] text-slate-500 italic">
              💡 The downloaded file will be exported in original 100% full uncompressed resolution.
            </p>
          </div>

          {/* Right Column: Customization Controls (5 cols) */}
          <div className="lg:col-span-5 flex flex-col space-y-4">
            {/* 1. Outline Color Palette */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
              <label className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                <Palette className="w-4 h-4 text-amber-400" />
                <span>Marking Outline Color</span>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOptions({ ...options, colorMode: 'vibrant_yellow' })}
                  className={`flex items-center space-x-2 p-2 rounded-lg text-xs font-medium border transition-all ${
                    options.colorMode === 'vibrant_yellow'
                      ? 'bg-amber-950/60 border-amber-500 text-amber-200 shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="w-3.5 h-3.5 rounded-full bg-yellow-400 border border-white/60 shadow-xs shrink-0" />
                  <span className="truncate">Vibrant Yellow</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOptions({ ...options, colorMode: 'region_colors' })}
                  className={`flex items-center space-x-2 p-2 rounded-lg text-xs font-medium border transition-all ${
                    options.colorMode === 'region_colors'
                      ? 'bg-cyan-950/60 border-cyan-500 text-cyan-200 shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex -space-x-1 shrink-0">
                    <span className="w-3 h-3 rounded-full bg-sky-400 border border-slate-900" />
                    <span className="w-3 h-3 rounded-full bg-emerald-400 border border-slate-900" />
                    <span className="w-3 h-3 rounded-full bg-rose-400 border border-slate-900" />
                  </div>
                  <span className="truncate">Multi-Color</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOptions({ ...options, colorMode: 'custom', customColor: '#10b981' })}
                  className={`flex items-center space-x-2 p-2 rounded-lg text-xs font-medium border transition-all ${
                    options.colorMode === 'custom' && options.customColor === '#10b981'
                      ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200 shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-white/60 shadow-xs shrink-0" />
                  <span className="truncate">Emerald Green</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOptions({ ...options, colorMode: 'custom', customColor: '#38bdf8' })}
                  className={`flex items-center space-x-2 p-2 rounded-lg text-xs font-medium border transition-all ${
                    options.colorMode === 'custom' && options.customColor === '#38bdf8'
                      ? 'bg-sky-950/60 border-sky-500 text-sky-200 shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="w-3.5 h-3.5 rounded-full bg-sky-400 border border-white/60 shadow-xs shrink-0" />
                  <span className="truncate">Electric Cyan</span>
                </button>
              </div>
            </div>

            {/* 2. Shape Labels & Numbering */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
              <label className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                <Type className="w-4 h-4 text-amber-400" />
                <span>Annotation Badges / Labels</span>
              </label>

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setOptions({ ...options, showLabels: 'none' })}
                  className={`p-2 rounded-lg text-xs font-medium border text-center transition-all ${
                    options.showLabels === 'none'
                      ? 'bg-amber-950/60 border-amber-500 text-amber-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  Marks Only
                </button>

                <button
                  type="button"
                  onClick={() => setOptions({ ...options, showLabels: 'numbers_only' })}
                  className={`p-2 rounded-lg text-xs font-medium border text-center transition-all ${
                    options.showLabels === 'numbers_only'
                      ? 'bg-amber-950/60 border-amber-500 text-amber-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  Numbered (#1, #2)
                </button>

                <button
                  type="button"
                  onClick={() => setOptions({ ...options, showLabels: 'full_names' })}
                  className={`p-2 rounded-lg text-xs font-medium border text-center transition-all ${
                    options.showLabels === 'full_names'
                      ? 'bg-amber-950/60 border-amber-500 text-amber-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  Full Names
                </button>
              </div>
            </div>

            {/* 3. Line Thickness & File Format */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-slate-200">Line Thickness</span>
                  <span className="font-mono text-amber-400">{options.lineWidth} px</span>
                </div>
                <div className="flex items-center space-x-2">
                  {[1.5, 2.5, 3.5, 5.0].map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setOptions({ ...options, lineWidth: w })}
                      className={`flex-1 py-1 rounded text-xs font-mono border transition-all ${
                        options.lineWidth === w
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {w}px
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">Export Format</span>
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => setOptions({ ...options, format: 'png' })}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                      options.format === 'png'
                        ? 'bg-cyan-600 text-white shadow-sm'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    PNG (HD)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOptions({ ...options, format: 'jpeg' })}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                      options.format === 'jpeg'
                        ? 'bg-cyan-600 text-white shadow-sm'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    JPG
                  </button>
                </div>
              </div>

              {/* Include Metadata Footer Toggle */}
              <label className="flex items-center space-x-2 text-xs text-slate-300 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!options.includeMetadataFooter}
                  onChange={(e) => setOptions({ ...options, includeMetadataFooter: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0 cursor-pointer"
                />
                <span>Include clinical title & date footer bar</span>
              </label>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading || isGenerating}
            className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-bold shadow-xl transition-all ${
              downloadSuccess
                ? 'bg-emerald-600 text-white'
                : 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 shadow-amber-500/20 active:scale-95'
            }`}
          >
            {downloadSuccess ? (
              <>
                <FileCheck className="w-4 h-4" />
                <span>Downloaded Successfully!</span>
              </>
            ) : isDownloading ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin" />
                <span>Generating Full-Res Image...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 font-bold" />
                <span>Download Full Annotated Image ({options.format.toUpperCase()})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
