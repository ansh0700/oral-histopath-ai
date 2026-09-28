import React from 'react';
import { CheckCircle2, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import { SaveStatus } from '../types/project';

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  lastSavedAt?: string;
  version?: number;
  projectName: string;
  onOpenProjectManager: () => void;
}

export const SaveStatusIndicator: React.FC<SaveStatusIndicatorProps> = React.memo(({
  status,
  lastSavedAt,
  version,
  projectName,
  onOpenProjectManager,
}) => {
  const formattedTime = lastSavedAt
    ? new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '';

  return (
    <div className="flex items-center space-x-2.5 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800 text-xs">
      <button
        onClick={onOpenProjectManager}
        className="font-semibold text-slate-200 hover:text-medical-400 transition-colors flex items-center space-x-1.5"
        title="Open Project Manager"
      >
        <span className="text-slate-500 font-mono text-[10px]">Project:</span>
        <span className="max-w-[140px] truncate">{projectName}</span>
      </button>

      <div className="h-3 w-px bg-slate-800" />

      <div className="flex items-center space-x-1 font-mono text-[10px]">
        {status === 'saved' && (
          <span className="flex items-center space-x-1 text-emerald-400">
            <CheckCircle2 className="w-3 h-3" />
            <span>Saved {formattedTime}</span>
          </span>
        )}

        {status === 'saving' && (
          <span className="flex items-center space-x-1 text-cyan-400">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Saving...</span>
          </span>
        )}

        {status === 'unsaved' && (
          <span className="flex items-center space-x-1 text-amber-400">
            <Clock className="w-3 h-3" />
            <span>Unsaved</span>
          </span>
        )}

        {status === 'error' && (
          <span className="flex items-center space-x-1 text-rose-400">
            <AlertCircle className="w-3 h-3" />
            <span>Save error</span>
          </span>
        )}
      </div>
    </div>
  );
});
