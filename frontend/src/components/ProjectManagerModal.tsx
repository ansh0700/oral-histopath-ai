import React, { useState, useRef } from 'react';
import {
  FolderOpen,
  Plus,
  Trash2,
  Download,
  Upload,
  X,
  Clock,
  Layers,
  Edit2,
  Check,
  Play
} from 'lucide-react';
import { ProjectMetadata } from '../types/project';

interface ProjectManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: ProjectMetadata[];
  activeProjectId: string;
  onSwitchProject: (id: string) => Promise<void>;
  onCreateNewProject: (name?: string) => Promise<void>;
  onRenameProject: (id: string, newName: string) => Promise<void>;
  onDeleteProject: (id: string) => Promise<void>;
  onExportCurrentProject: () => void;
  onImportProject: (jsonString: string) => Promise<void>;
}

export const ProjectManagerModal: React.FC<ProjectManagerModalProps> = ({
  isOpen,
  onClose,
  projects,
  activeProjectId,
  onSwitchProject,
  onCreateNewProject,
  onRenameProject,
  onDeleteProject,
  onExportCurrentProject,
  onImportProject,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [newProjectName, setNewProjectName] = useState<string>('');
  const [showNewInput, setShowNewInput] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const importFileRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleStartRename = (p: ProjectMetadata, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(p.id);
    setEditName(p.name);
  };

  const handleSaveRename = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (editName.trim()) {
      await onRenameProject(id, editName.trim());
    }
    setEditingId(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onCreateNewProject(newProjectName.trim() || undefined);
    setNewProjectName('');
    setShowNewInput(false);
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await onImportProject(text);
      onClose();
    } catch (err: any) {
      alert(`Import error: ${err.message}`);
    } finally {
      if (importFileRef.current) importFileRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/90 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-2 text-medical-400">
            <FolderOpen className="w-5 h-5" />
            <div>
              <h2 className="text-base font-bold text-slate-100">Project Management & Research Sessions</h2>
              <p className="text-xs text-slate-400">IndexedDB Local Persistence & Session Switching</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Export Current Project */}
            <button
              onClick={onExportCurrentProject}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
              title="Export project and regions as JSON"
            >
              <Download className="w-3.5 h-3.5 text-medical-400" />
              <span>Export</span>
            </button>

            {/* Import Project */}
            <input
              type="file"
              ref={importFileRef}
              onChange={handleImportFileChange}
              accept=".json"
              className="hidden"
            />
            <button
              onClick={() => importFileRef.current?.click()}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
              title="Import project package from JSON"
            >
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              <span>Import</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* New Project Trigger / Input */}
          {showNewInput ? (
            <form onSubmit={handleCreateSubmit} className="flex items-center space-x-2 p-2 bg-slate-950 rounded-xl border border-slate-800">
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Enter new project name..."
                autoFocus
                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-medical-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-medical-600 hover:bg-medical-500 text-white font-semibold text-xs rounded-lg shadow"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowNewInput(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              onClick={() => setShowNewInput(true)}
              className="w-full flex items-center justify-center space-x-2 py-2.5 bg-slate-950 hover:bg-slate-800 text-medical-400 hover:text-medical-300 font-semibold text-xs rounded-xl border border-dashed border-slate-800 hover:border-medical-500/60 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Start New Project</span>
            </button>
          )}

          {/* Projects List */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Saved Projects ({projects.length})
            </h3>

            {projects.map((p) => {
              const isActive = p.id === activeProjectId;
              const isEditing = editingId === p.id;
              const dateStr = new Date(p.updatedAt).toLocaleString([], {
                dateStyle: 'short',
                timeStyle: 'short',
              });

              return (
                <div
                  key={p.id}
                  onClick={() => !isEditing && onSwitchProject(p.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    isActive
                      ? 'bg-slate-800/90 border-medical-500 shadow-md shadow-medical-950/40 ring-1 ring-medical-500/20'
                      : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/40 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className={`p-2 rounded-lg ${isActive ? 'bg-medical-950 text-medical-400' : 'bg-slate-900 text-slate-500'}`}>
                      <FolderOpen className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <div className="flex items-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="bg-slate-950 border border-medical-500 rounded px-2 py-0.5 text-xs text-slate-100 font-semibold focus:outline-none"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(p.id)}
                          />
                          <button
                            onClick={(e) => handleSaveRename(p.id, e)}
                            className="p-1 rounded bg-medical-600 hover:bg-medical-500 text-white"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2 truncate">
                          <span className="font-semibold text-xs text-slate-100 truncate">{p.name}</span>
                          {isActive && (
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-medical-950 text-medical-300 border border-medical-700/50">
                              ACTIVE
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center space-x-3 text-[11px] text-slate-500 font-mono mt-0.5">
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-slate-600" />
                          <span>{dateStr}</span>
                        </span>
                        <span>v{p.version || 1}</span>
                      </div>
                    </div>
                  </div>

                  {/* Project Actions */}
                  <div className="flex items-center space-x-1 ml-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => handleStartRename(p, e)}
                      className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                      title="Rename Project"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {projects.length > 1 && (
                      <button
                        onClick={() => setDeletingId(p.id)}
                        className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                        title="Delete Project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {deletingId && (
          <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-rose-800/80 rounded-xl max-w-sm w-full p-5 space-y-3 shadow-2xl">
              <h4 className="text-sm font-bold text-rose-300">Delete Project?</h4>
              <p className="text-xs text-slate-400">
                Are you sure you want to permanently delete this project and all its saved annotations and masks? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={() => setDeletingId(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await onDeleteProject(deletingId);
                    setDeletingId(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
