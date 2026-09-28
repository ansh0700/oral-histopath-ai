import React from 'react';
import { History, Play, Plus, Clock, Layers, FolderOpen } from 'lucide-react';
import { ProjectMetadata } from '../types/project';

interface RestoreSessionModalProps {
  isOpen: boolean;
  project: ProjectMetadata;
  regionCount: number;
  onContinueSession: () => void;
  onStartNewProject: () => void;
}

export const RestoreSessionModal: React.FC<RestoreSessionModalProps> = ({
  isOpen,
  project,
  regionCount,
  onContinueSession,
  onStartNewProject,
}) => {
  if (!isOpen) return null;

  const savedDate = new Date(project.updatedAt).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-center space-x-3 text-medical-400">
          <div className="p-2.5 bg-medical-950/80 border border-medical-800/60 rounded-xl">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">Previous Session Found</h2>
            <p className="text-xs text-slate-400">Restore your saved oral histopathology workspace</p>
          </div>
        </div>

        {/* Project Card Summary */}
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm text-slate-100">{project.name}</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              v{project.version || 1}
            </span>
          </div>

          <div className="flex items-center space-x-4 text-xs text-slate-400 font-mono">
            <div className="flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>{savedDate}</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-medical-400" />
              <span>{regionCount} Region{regionCount === 1 ? '' : 's'}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <button
            onClick={onContinueSession}
            className="w-full flex items-center justify-center space-x-2 py-2.5 bg-gradient-to-r from-medical-600 to-cyan-600 hover:from-medical-500 hover:to-cyan-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-medical-950 transition-all active:scale-[0.99]"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Continue Session</span>
          </button>

          <button
            onClick={onStartNewProject}
            className="w-full flex items-center justify-center space-x-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition-colors"
          >
            <Plus className="w-4 h-4 text-slate-400" />
            <span>Start New Project</span>
          </button>
        </div>
      </div>
    </div>
  );
};
