import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Trash2,
  CheckCircle2,
  Target,
  ChevronLeft,
  ChevronRight,
  Eye,
  Download,
  Edit2,
  MessageSquare,
  Check,
  X,
} from 'lucide-react';
import { RegionObject } from '../types/region';

interface RegionListProps {
  regions: RegionObject[];
  activeRegionId: string;
  onSelectRegion: (id: string) => void;
  onAddRegion: (category: RegionObject['category']) => void;
  onDeleteRegion: (id: string, e: React.MouseEvent) => void;
  onFocusRegion?: (id: string) => void;
  onShowAllRegions?: () => void;
  onPrevRegion?: () => void;
  onNextRegion?: () => void;
  onExtractAll?: () => void;
  onExportAnnotatedSlide?: () => void;
  onUpdateRegionName?: (id: string, name: string) => void;
  onUpdateRegionComment?: (id: string, comment: string) => void;
}

const REGION_CATEGORIES: RegionObject['category'][] = [
  'Nucleus',
  'Cell',
  'Mitotic figure',
  'Dysplastic Epithelium',
  'Keratin Pearl',
  'Stromal Infiltration',
  'Other',
];

export const RegionList: React.FC<RegionListProps> = React.memo(({
  regions,
  activeRegionId,
  onSelectRegion,
  onAddRegion,
  onDeleteRegion,
  onFocusRegion,
  onShowAllRegions,
  onPrevRegion,
  onNextRegion,
  onExtractAll,
  onExportAnnotatedSlide,
  onUpdateRegionName,
  onUpdateRegionComment,
}) => {
  const currentIdx = regions.findIndex((r) => r.id === activeRegionId);
  const selectedCount = regions.filter((r) => r.vectorSelection || r.bbox).length;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<string>('');

  const startRename = (region: RegionObject, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(region.id);
    setEditingName(region.name);
  };

  const saveRename = (id: string, e?: React.FormEvent) => {
    e?.preventDefault();
    if (editingName.trim() && onUpdateRegionName) {
      onUpdateRegionName(id, editingName.trim());
    }
    setEditingId(null);
  };

  const toggleCommentInput = (region: RegionObject, e: React.MouseEvent) => {
    e.stopPropagation();
    if (editingCommentId === region.id) {
      setEditingCommentId(null);
    } else {
      setEditingCommentId(region.id);
      setEditingComment(region.comment || '');
    }
  };

  const saveComment = (id: string, e?: React.FormEvent) => {
    e?.preventDefault();
    if (onUpdateRegionComment) {
      onUpdateRegionComment(id, editingComment.trim());
    }
    setEditingCommentId(null);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-xl space-y-2.5">
      {/* Header with Navigation & Show All */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center space-x-2 text-medical-400">
          <Layers className="w-4 h-4" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-100">
            Multi-Region Selections ({regions.length})
          </h3>
        </div>

        <div className="flex items-center space-x-1">
          {/* Previous / Next Region Navigation */}
          {regions.length > 1 && (
            <div className="flex items-center bg-slate-950 rounded border border-slate-800 p-0.5 mr-1">
              <button
                onClick={onPrevRegion}
                className="p-0.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                title="Previous Region (←)"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <span className="text-[10px] font-mono text-slate-400 px-1">
                {currentIdx + 1}/{regions.length}
              </span>
              <button
                onClick={onNextRegion}
                className="p-0.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                title="Next Region (→)"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Show All Overview Button */}
          {regions.length > 1 && onShowAllRegions && (
            <button
              onClick={onShowAllRegions}
              className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-indigo-300 border border-slate-800 text-[10px] font-semibold transition-colors"
              title="Show all regions overview in viewport"
            >
              <Eye className="w-2.5 h-2.5" />
              <span>Show All</span>
            </button>
          )}

          {/* Batch Extract All Button */}
          {selectedCount > 1 && onExtractAll && (
            <button
              onClick={onExtractAll}
              className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 text-[10px] font-semibold transition-colors"
              title="Extract & analyze all selected regions"
            >
              <Target className="w-2.5 h-2.5 text-emerald-400" />
              <span>Extract All</span>
            </button>
          )}
        </div>
      </div>

      {/* Region Add Quick Pills (Clean Single '+' Icon) */}
      <div className="flex flex-wrap gap-1">
        {REGION_CATEGORIES.slice(0, 4).map((cat) => (
          <button
            key={cat}
            onClick={() => onAddRegion(cat)}
            className="flex items-center space-x-1 px-2 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded text-[10px] border border-slate-800 transition-colors"
          >
            <Plus className="w-2.5 h-2.5 text-medical-400" />
            <span>{cat}</span>
          </button>
        ))}
      </div>

      {/* Regions List */}
      <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
        {regions.map((region) => {
          const isActive = region.id === activeRegionId;
          const hasResult = !!(region.aiMaskB64 || region.cropUrl);
          const hasSelection = !!(region.vectorSelection || region.bbox);
          const area = region.analysis?.measurements.area_pixels || region.vectorSelection?.areaPixels;
          const isRenaming = editingId === region.id;
          const isCommenting = editingCommentId === region.id;

          return (
            <div
              key={region.id}
              onClick={() => onSelectRegion(region.id)}
              onDoubleClick={() => onFocusRegion && onFocusRegion(region.id)}
              className={`p-2 rounded-lg border transition-all cursor-pointer text-xs space-y-1.5 ${
                isActive
                  ? 'bg-slate-800 border-medical-500 text-slate-100 shadow-md ring-1 ring-medical-500/30'
                  : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 min-w-0 flex-1 mr-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: region.color }}
                  />

                  {/* Inline Rename Form or Display Name */}
                  {isRenaming ? (
                    <form
                      onSubmit={(e) => saveRename(region.id, e)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center space-x-1 flex-1"
                    >
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        autoFocus
                        className="bg-slate-950 text-slate-100 border border-medical-500 px-1.5 py-0.5 rounded text-xs w-full focus:outline-none"
                        placeholder="Enter custom shape name..."
                      />
                      <button
                        type="submit"
                        className="p-0.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded"
                        title="Save Name"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="p-0.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded"
                        title="Cancel"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </form>
                  ) : (
                    <div className="truncate flex-1">
                      <div className="flex items-center space-x-1.5 truncate group">
                        <span
                          className="font-semibold truncate hover:text-medical-300 transition-colors"
                          title="Click pencil icon or double click to rename"
                        >
                          {region.name}
                        </span>
                        <button
                          onClick={(e) => startRename(region, e)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-slate-200 transition-opacity"
                          title="Rename Shape Manually"
                        >
                          <Edit2 className="w-2.5 h-2.5" />
                        </button>
                        {isActive && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-medical-950 text-medical-300 border border-medical-700/50">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono block">
                        {region.category} • {hasSelection ? `${area ? `${area.toLocaleString()} px` : 'Selected'}` : 'Draft'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  {/* Custom Comment / Notes Button */}
                  <button
                    onClick={(e) => toggleCommentInput(region, e)}
                    className={`p-1 rounded transition-colors ${
                      region.comment
                        ? 'text-amber-400 hover:bg-amber-950/40'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                    }`}
                    title={region.comment ? `Edit Note: "${region.comment}"` : 'Add Custom Comment / Note'}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>

                  {hasSelection && onFocusRegion && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectRegion(region.id);
                        onFocusRegion(region.id);
                      }}
                      className={`p-1 rounded transition-colors ${
                        isActive
                          ? 'text-medical-400 hover:text-medical-200 hover:bg-medical-950'
                          : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                      }`}
                      title="Focus viewport on this region"
                    >
                      <Target className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {hasResult && (
                    <span title="Extraction & Analysis complete">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    </span>
                  )}

                  {regions.length > 1 && (
                    <button
                      onClick={(e) => onDeleteRegion(region.id, e)}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                      title="Delete Region"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Display existing comment note */}
              {region.comment && !isCommenting && (
                <div className="text-[10px] italic text-amber-300/90 bg-amber-950/30 border border-amber-800/40 px-2 py-0.5 rounded flex items-center space-x-1">
                  <MessageSquare className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                  <span className="truncate">{region.comment}</span>
                </div>
              )}

              {/* Comment Input Box */}
              {isCommenting && (
                <form
                  onSubmit={(e) => saveComment(region.id, e)}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center space-x-1 pt-1"
                >
                  <input
                    type="text"
                    value={editingComment}
                    onChange={(e) => setEditingComment(e.target.value)}
                    autoFocus
                    className="bg-slate-950 text-slate-200 border border-amber-500/80 px-2 py-0.5 rounded text-[11px] w-full focus:outline-none placeholder-slate-500"
                    placeholder="Add clinical note or comment..."
                  />
                  <button
                    type="submit"
                    className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-[10px] rounded"
                  >
                    Save
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>

      {/* Download Full Slide with All Marks */}
      {selectedCount > 0 && onExportAnnotatedSlide && (
        <button
          onClick={onExportAnnotatedSlide}
          className="w-full mt-2 flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 hover:from-amber-500/30 hover:to-yellow-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold shadow-sm transition-all"
          title="Download full slide image with all marked shape boundaries"
        >
          <Download className="w-3.5 h-3.5 text-amber-400 font-bold" />
          <span>Download Full Slide with Marks ({selectedCount})</span>
        </button>
      )}
    </div>
  );
});
